import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import { database, userRef } from "./store.js";
import { identifier } from "./schema.js";
import { visitInput, passageInput } from "./reader-schema.js";
import { analyzePassage } from "./reader-model.js";
import {
  summarizePages,
  textFeatures,
  type PageVisit,
} from "../../shared/reader.js";
export const reader = Router();
const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
async function ownedBook(uid: string, id: unknown) {
  const ref = userRef(uid).collection("books").doc(identifier.parse(id));
  const snapshot = await ref.get();
  if (!snapshot.exists || !snapshot.data()?.reader)
    throw fail("Ebook not found in your library.", 404);
  return { ref, book: snapshot.data()! };
}
reader.put("/books/:bookId/visits/:id", async (req, res) => {
  const { ref, book } = await ownedBook(res.locals.uid, req.params.bookId);
  const id = identifier.parse(req.params.id);
  const input = visitInput.parse(req.body);
  if (
    input.documentId !== book.reader.documentId ||
    input.page >= book.reader.pageCount
  )
    throw fail("This reading event belongs to another edition.");
  await database.runTransaction(async (tx) => {
    const doc = ref.collection("readerVisits").doc(id);
    const old = await tx.get(doc);
    if (old.exists) {
      if (
        Object.entries({ id, ...input }).some(
          ([key, value]) => old.data()?.[key] !== value,
        )
      )
        throw fail(
          "Reading events are immutable. Retry the original event.",
          409,
        );
      return;
    }
    tx.set(doc, { id, ...input });
  });
  res.json({ ok: true });
});
reader.get("/books/:bookId/visits", async (req, res) => {
  const { ref } = await ownedBook(res.locals.uid, req.params.bookId);
  const docs = await ref
    .collection("readerVisits")
    .orderBy("endedAt", "desc")
    .limit(1000)
    .get();
  res.json({
    visits: docs.docs.map((d) => d.data()),
    limited: docs.size === 1000,
  });
});
reader.post("/books/:bookId/analyze", async (req, res) => {
  const uid = res.locals.uid as string;
  const { ref, book } = await ownedBook(uid, req.params.bookId);
  const input = passageInput.parse(req.body);
  const hash = createHash("sha256").update(input.text).digest("hex");
  const docs = await ref
    .collection("readerVisits")
    .orderBy("endedAt", "desc")
    .limit(1000)
    .get();
  const visits = docs.docs.map((d) => d.data()) as PageVisit[];
  const matching = visits.filter(
    (v) => v.page === input.page && v.textHash === hash,
  );
  if (!matching.length)
    throw fail("Record and sync this page before requesting an analysis.");
  const metrics = textFeatures(input.text);
  const pages = summarizePages(visits);
  const page = summarizePages(matching)[0];
  const comparable = pages.filter(
    (p) => p.page !== input.page && p.activeMs >= 10000 && p.characters > 100,
  );
  const rates = comparable
    .map((p) => p.activeMs / p.characters)
    .sort((a, b) => a - b);
  const baseline =
    rates.length >= 3 ? rates[Math.floor(rates.length / 2)] : null;
  const evidence = {
    page: input.page + 1,
    ...metrics,
    foregroundSeconds: Math.round(page.activeMs / 1000),
    visits: page.visits,
    explicitReactions: page.reactions,
    comparablePages: rates.length,
    medianMillisecondsPerCharacter: baseline,
    relativeDwell:
      baseline && page.activeMs >= 10000
        ? Math.round((page.activeMs / metrics.characters / baseline) * 100) /
          100
        : null,
    caveat:
      "Foreground dwell only. Background and 90-second inactivity excluded. Visits can include rereading; not verified reading speed.",
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ hash, evidence }))
    .digest("hex");
  const reportRef = ref.collection("readerReports").doc(fingerprint);
  const cached = await reportRef.get();
  if (cached.exists) {
    res.json({ ...cached.data(), cached: true });
    return;
  }
  const control = userRef(uid).collection("private").doc("generation");
  const global = database.collection("private").doc("generation");
  const lease = randomUUID(),
    now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10);
  await database.runTransaction(async (tx) => {
    const own = (await tx.get(control)).data(),
      all = (await tx.get(global)).data();
    const count = own?.day === day ? own.count : 0,
      total = all?.day === day ? all.count : 0;
    if ((own?.expiresAt ?? 0) > now || count >= 10 || total >= 50)
      throw fail(
        "Analysis is busy or today's limit is reached. Your reading records remain available.",
        429,
      );
    tx.set(control, { lease, expiresAt: now + 90000, day, count: count + 1 });
    tx.set(global, { day, count: total + 1 });
  });
  try {
    const result = await analyzePassage(input.text, evidence);
    const report = {
      id: fingerprint,
      page: input.page,
      documentId: book.reader.documentId,
      generatedAt: Date.now(),
      evidence,
      result,
    };
    await reportRef.set(report);
    res.json(report);
  } finally {
    await database.runTransaction(async (tx) => {
      const doc = await tx.get(control);
      if (doc.data()?.lease === lease) tx.update(control, { expiresAt: 0 });
    });
  }
});
