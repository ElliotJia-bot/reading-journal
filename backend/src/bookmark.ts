import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { database, userRef } from "./store.js";
import { identifier } from "./schema.js";
import { bookmarkBatchInput, bookmarkClaimInput, bookmarkPairInput } from "./bookmark-schema.js";
import { applyBookmarkEvent, initialBookmark, type BookmarkState } from "../../shared/bookmark.js";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const sessionRef = (uid: string, id: string) => userRef(uid).collection("bookmarkSessions").doc(id);
export const bookmark = Router();
export const bookmarkBridge = Router();
const claims = new Map<string, { count: number; reset: number }>();
bookmarkBridge.use((req, _res, next) => {
  const key = req.ip ?? "bridge";
  const now = Date.now();
  if (claims.size > 5000) for (const [k, v] of claims) if (v.reset < now) claims.delete(k);
  const entry = claims.get(key);
  if (entry && entry.reset > now) { if (++entry.count > 180) return next(Object.assign(new Error("Too many bridge requests; retry shortly."), { status: 429 })); }
  else claims.set(key, { count: 1, reset: now + 60000 });
  next();
});
bookmark.post("/pair", async (req, res) => {
  const { sessionId, bookId, startPage } = bookmarkPairInput.parse(req.body);
  const uid: string = res.locals.uid, now = Date.now(), code = randomBytes(16).toString("hex");
  const ref = sessionRef(uid, sessionId), activeRef = userRef(uid).collection("private").doc("bookmark-active");
  const state = initialBookmark(sessionId, bookId, startPage, now);
  await database.runTransaction(async tx => {
    const [book, active, existing] = await Promise.all([tx.get(userRef(uid).collection("books").doc(bookId)), tx.get(activeRef), tx.get(ref)]);
    if (!book.exists) fail("Book not found.", 404);
    if (book.data()?.unit !== "pages" || book.data()?.reader) fail("Use a page-based physical-book entry for the bookmark.");
    if (startPage > (book.data()?.totalPages ?? 100000)) fail("Starting page exceeds the book length.");
    if (existing.exists && existing.data()?.state.status !== "waiting") fail("This session already has bookmark records. Finish it first.", 409);
    if (active.exists && active.data()?.sessionId !== sessionId) {
      const other = await tx.get(sessionRef(uid, active.data()!.sessionId));
      if (other.exists && !other.data()?.state.savedAt && other.data()?.state.status !== "ended") fail("Finish the other bookmark session first.", 409);
    }
    tx.set(ref, { state, pairingHash: hash(code), maxPage: book.data()?.totalPages ?? 100000 });
    tx.set(activeRef, { sessionId });
    tx.set(database.collection("bookmarkPairings").doc(hash(code)), { uid, sessionId, expiresAt: now + 600000, tokenHash: null });
  });
  res.json({ code, expiresAt: now + 600000, state });
});
bookmark.get("/", async (_req, res) => {
  const active = await userRef(res.locals.uid).collection("private").doc("bookmark-active").get();
  const doc = active.exists ? await sessionRef(res.locals.uid, active.data()!.sessionId).get() : null;
  const state = doc?.data()?.state as BookmarkState | undefined;
  res.json({ status: state && !state.savedAt ? state.status : "not-connected", device: state ? "Raspberry Pi Pico W" : null, trackingAvailable: true, session: state && !state.savedAt ? state : null });
});
bookmark.get("/sessions/:id", async (req, res) => {
  const doc = await sessionRef(res.locals.uid, identifier.parse(req.params.id)).get();
  if (!doc.exists) fail("Bookmark session not found.", 404);
  res.json(doc.data()!.state);
});
bookmark.get("/sessions/:id/visits", async (req, res) => {
  const ref = sessionRef(res.locals.uid, identifier.parse(req.params.id));
  const doc = await ref.get(); if (!doc.exists) fail("Bookmark session not found.", 404);
  const visits = await ref.collection("visits").orderBy("sequence", "desc").limit(1000).get();
  res.json({ visits: visits.docs.map(d => d.data()).reverse(), total: doc.data()!.state.completedVisits });
});
bookmark.post("/sessions/:id/stop", async (req, res) => {
  const ref = sessionRef(res.locals.uid, identifier.parse(req.params.id));
  const state = await database.runTransaction(async tx => {
    const doc = await tx.get(ref); if (!doc.exists) fail("Bookmark session not found.", 404);
    const s = doc.data()!.state as BookmarkState;
    if (s.savedAt) fail("This reading session is already saved.", 409);
    // Recovery uses only device-confirmed time, never an interpolated UI clock.
    const next = { ...s, status: "ended" as const, endedAt: Math.max(s.startedAt, Math.round(s.lastEventAt)), connected: false, interrupted: true, ...(s.activeSeconds < 1 ? { savedAt: Date.now() } : {}) };
    tx.update(ref, { state: next }); return next;
  });
  res.json(state);
});
bookmarkBridge.post("/pair", async (req, res) => {
  const { code, token } = bookmarkClaimInput.parse(req.body), tokenHash = hash(token), now = Date.now();
  const pairingRef = database.collection("bookmarkPairings").doc(hash(code));
  const result = await database.runTransaction(async tx => {
    const pairing = await tx.get(pairingRef), p = pairing.data();
    if (!p || p.expiresAt < now || (p.tokenHash && p.tokenHash !== tokenHash)) fail("Pairing code is invalid or expired.", 401);
    const target = await tx.get(sessionRef(p.uid, p.sessionId));
    if (!target.exists || target.data()?.pairingHash !== hash(code) || target.data()?.state.status !== "waiting") fail("Pair a fresh reading session.", 409);
    tx.update(pairingRef, { tokenHash });
    tx.set(database.collection("bookmarkDevices").doc(tokenHash), { uid: p.uid, sessionId: p.sessionId, expiresAt: now + 86400000, pairingHash: hash(code) });
    return { sessionId: p.sessionId, startPage: target.data()!.state.startPage };
  });
  res.json(result);
});
bookmarkBridge.use(async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail("A paired bookmark token is required.", 401);
  const device = await database.collection("bookmarkDevices").doc(hash(token!)).get();
  if (!device.exists || device.data()!.expiresAt < Date.now()) fail("Bookmark pairing expired. Connect again.", 401);
  res.locals.device = device.data(); next();
});
bookmarkBridge.post("/events", async (req, res) => {
  const { events } = bookmarkBatchInput.parse(req.body), device = res.locals.device;
  const ref = sessionRef(device.uid, device.sessionId);
  for (const item of events) {
    if (item.observedAt > Date.now() + 60000 || item.observedAt < Date.now() - 86400000) fail("Check the bridge computer's clock.");
    await database.runTransaction(async tx => {
      const [doc, old] = await Promise.all([tx.get(ref), tx.get(ref.collection("events").doc(String(item.sequence)))]);
      if (!doc.exists || doc.data()!.pairingHash !== device.pairingHash) fail("Bookmark pairing is no longer active.", 401);
      const digest = hash(JSON.stringify(item));
      if (old.exists) { if (old.data()!.digest !== digest) fail("Conflicting bookmark retry.", 409); return; }
      let result;
      try { result = applyBookmarkEvent(doc.data()!.state, item.event, item.sequence, item.observedAt); }
      catch (error) { fail((error as Error).message, 409); }
      if (result!.state.currentPage > doc.data()!.maxPage) fail("Page exceeds the book length. Check your edition.");
      tx.update(ref, { state: result!.state });
      tx.create(ref.collection("events").doc(String(item.sequence)), { ...item, digest, receivedAt: Date.now() });
      if (result!.visit) tx.create(ref.collection("visits").doc(String(item.sequence)), result!.visit);
    });
  }
  res.json({ acceptedThrough: events.at(-1)!.sequence });
});
bookmarkBridge.post("/heartbeat", async (req, res) => {
  const { connected } = z.object({ connected: z.boolean() }).strict().parse(req.body), device = res.locals.device;
  const ref = sessionRef(device.uid, device.sessionId);
  await database.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data()!.pairingHash !== device.pairingHash) fail("Bookmark pairing is no longer active.", 401);
    if (doc.data()!.state.status === "ended") return;
    tx.update(ref, { "state.connected": connected, "state.lastSeenAt": Date.now() });
  });
  res.json({ ok: true });
});
