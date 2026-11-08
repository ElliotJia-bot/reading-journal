import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendationEvidence } from "../../shared/recommendation-evidence.js";
import { validateRanking } from "../src/recommendation-ranking.js";
import type { Book, ReadingSession, Profile } from "../../shared/domain.js";
import type { ShelfBook } from "../../shared/for-you.js";
const now = Date.parse("2026-11-08T03:00:00Z"),
  profile: Profile = {
    goal: "Read more",
    timezone: "America/New_York",
    topics: ["Finance"],
  };
const book = {
  id: "private-book",
  title: "A book",
  author: "Author",
  topics: ["Finance"],
  status: "Reading",
  totalPages: 200,
} as Book;
const log = {
  id: "secret",
  bookId: book.id,
  startedAt: now - 3600000,
  endedAt: now - 1800000,
  durationSeconds: 1800,
  startPosition: 0,
  endPosition: 10,
  unit: "pages",
  location: "SECRET_STREET",
  note: "SECRET_NOTE",
  source: "manual",
  reaction: "Liked it",
  stopReason: "Finished chapter",
  topics: [],
} as ReadingSession;
test("Behavior evidence uses 30 local calendar days, valid reading and clearly labels synthetic sessions", () => {
  const result = recommendationEvidence(
    [book],
    [
      log,
      {
        ...log,
        startedAt: now - 40 * 86400000,
        endedAt: now - 40 * 86400000 + 1800000,
      },
      { ...log, durationSeconds: 180 },
      { ...log, endedAt: now + 1 },
      { ...log, demoData: { synthetic: true } },
    ],
    profile,
    {},
    now,
  );
  assert.equal(result.sessionCount, 2);
  assert.equal(result.syntheticSessionCount, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /SECRET_|private-book|startedAt|endedAt/,
  );
  assert.equal(
    JSON.parse(result.evidence.find((e) => e.id === "book-0")!.text)
      .likedSessions,
    2,
  );
});
test("Changes in recorded habit or explicit reaction change ranking evidence, but private notes do not", () => {
  const get = (s: ReadingSession) =>
    recommendationEvidence([book], [s], profile, {}, now);
  assert.notDeepEqual(
    get(log),
    get({ ...log, durationSeconds: 900, reaction: "Challenging" }),
  );
  assert.deepEqual(get(log), get({ ...log, note: "OTHER_PRIVATE_NOTE" }));
});
test("Ebook sections are never described as measured per-page speed", () => {
  const r = recommendationEvidence(
    [{ ...book, reader: { documentId: "demo", pageCount: 200 } }],
    [log],
    profile,
    {},
    now,
  );
  const data = JSON.parse(r.evidence.find((e) => e.id === "book-0")!.text);
  assert.equal(data.manualForwardPages, 0);
  assert.match(data.measurementNote, /sections, not print pages/);
});
test("AI ranking rejects invented IDs, duplicate selections and invented evidence", () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({
    id: `OL${i + 1}W`,
  })) as ShelfBook[];
  const item = (i: number) => ({
    id: `OL${i}W`,
    reason: "Try a new topic.",
    evidenceIds: ["summary"],
  });
  const valid = {
    personal: [1, 2, 3, 4, 5, 6].map(item),
    explore: [7, 8, 9, 10, 11, 12].map(item),
  };
  const evidence = [{ id: "summary", text: "12 sessions" }];
  assert.equal(validateRanking(valid, pool, evidence).personal.length, 6);
  for (const change of [
    { id: "OL999W" },
    { id: "OL7W" },
    { evidenceIds: ["invented"] },
  ]) {
    const bad = structuredClone(valid);
    Object.assign(bad.personal[0], change);
    assert.throws(() => validateRanking(bad, pool, evidence));
  }
});
