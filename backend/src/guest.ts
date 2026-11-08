import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database, userRef } from "./store.js";
import { guestTemplatePath } from "./guest-template.js";
import { singleFlight } from "../../shared/single-flight.js";

export const guest = Router();
const flight = singleFlight<{ status: string; version?: string }>();
const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

export function initializeGuest(uid: string) {
  return flight(uid, async () => {
    const root = userRef(uid), marker = root.collection("private").doc("guest-bootstrap");
    const previous = (await marker.get()).data();
    if (previous?.status === "ready" || previous?.status === "skipped")
      return { status: previous.status, version: previous.version };
    const current = (await database.collection("guestTemplates").doc("current").get()).data();
    const version = previous?.version ?? current?.version;
    if (!version || !/^[A-Za-z0-9_-]+$/.test(version))
      throw fail("Your guest journal is not ready yet. Please retry shortly.", 503);
    const template = database.collection("guestTemplates").doc(version);
    const meta = (await template.get()).data();
    if (!meta?.ready || meta.count < 1 || meta.count > 10000)
      throw fail("Your guest journal is temporarily unavailable. Please retry.", 503);
    const lease = randomUUID(), now = Date.now();
    const proceed = await database.runTransaction(async tx => {
      const [state, profile, books, sessions] = await Promise.all([
        tx.get(marker), tx.get(root), tx.get(root.collection("books").limit(1)),
        tx.get(root.collection("sessions").limit(1)),
      ]);
      const old = state.data();
      if (old?.status === "ready" || old?.status === "skipped") return false;
      if (old?.expiresAt > now) throw fail("Your guest journal is still being prepared. Please retry shortly.", 409);
      if (!old && (profile.exists || !books.empty || !sessions.empty)) {
        tx.set(marker, { status: "skipped", reason: "existing-journal", at: now });
        return false;
      }
      // Limit anonymous account churn without charging the AI on every visit.
      const budget = database.collection("private").doc("guest-bootstrap-budget");
      const usage = (await tx.get(budget)).data();
      const day = new Date(now).toISOString().slice(0, 10);
      const count = usage?.day === day ? usage.count : 0;
      if (!old && count >= 200) throw fail("Today's guest journal limit is reached. Please sign in or try later.", 429);
      if (!old) tx.set(budget, { day, count: count + 1 });
      tx.set(marker, { status: "preparing", version, lease, expiresAt: now + 120000 });
      return true;
    });
    if (!proceed) {
      const done = (await marker.get()).data()!;
      return { status: done.status, version: done.version };
    }
    try {
      const records = await template.collection("records").get();
      if (records.size !== meta.count) throw fail("Guest journal is incomplete. Please retry later.", 503);
      const entries = records.docs.map(doc => doc.data());
      for (const item of entries) if (!guestTemplatePath(item.path)) throw fail("Invalid guest journal template.", 503);
      const writer = database.bulkWriter();
      writer.onWriteError(error => error.code !== 6 && error.failedAttempts < 3);
      const jobs = entries.map(item => writer.create(database.doc(`${root.path}/${item.path}`), item.data));
      jobs.push(writer.create(root, meta.profile));
      // create-only is essential: retrying a partial copy must preserve edits.
      const settled = Promise.all(jobs.map(job => job.catch(error => {
        if (error.code !== 6) throw error;
      })));
      await Promise.all([settled, writer.close()]);
      await database.runTransaction(async tx => {
        const state = await tx.get(marker);
        if (state.data()?.lease !== lease) throw fail("Guest setup changed; please retry.", 409);
        tx.update(marker, { status: "ready", completedAt: Date.now(), expiresAt: 0 });
      });
      return { status: "ready", version };
    } catch (error) {
      await database.runTransaction(async tx => {
        const state = await tx.get(marker);
        if (state.data()?.lease === lease) tx.update(marker, { status: "retry", expiresAt: 0 });
      });
      throw error;
    }
  });
}

guest.post("/start", async (req, res) => {
  z.object({}).strict().parse(req.body);
  if (!res.locals.anonymous) throw fail("Guest setup is only available for a guest journal.", 403);
  res.json(await initializeGuest(res.locals.uid));
});
