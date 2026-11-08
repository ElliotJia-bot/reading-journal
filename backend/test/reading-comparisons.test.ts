import { test } from "node:test";
import assert from "node:assert/strict";
import { readingComparisons } from "../../shared/reading-comparisons.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
const books = [
  { id: "sf", topics: ["Science fiction"], language: "eng" },
  { id: "other", topics: ["Philosophy"], language: "eng" },
] as Book[];
const sessions = books.flatMap((b) =>
  [0, 1, 2].map((i) => ({
    id: `${b.id}-${i}`,
    bookId: b.id,
    source: "manual",
    unit: "pages",
    startPosition: 0,
    endPosition: b.id === "sf" ? 19 : 10,
    durationSeconds: 600,
    demoData: { synthetic: true },
  })),
) as ReadingSession[];
const profile = { language: "eng", goal: "Read", topics: [], timezone: "UTC" };
test("Pace compares weighted logged pages per minute, with exact percent and sample sizes", () => {
  const r = readingComparisons(books, sessions, profile).find(
    (r) => r.genre === "Science fiction",
  )!;
  assert.equal(r.percentChange, 90);
  assert.equal(r.rate, 1.9);
  assert.equal(r.baselineRate, 1);
  assert.equal(r.sessions, 3);
  assert.equal(r.comparisonSessions, 3);
  assert.equal(r.books, 1);
  assert.match(
    r.summary,
    /Demo records:.*90% faster.*3 sessions across 1 book/,
  );
});
test("Pace excludes ebook sections, percentages, short logs, no forward progress, sparse and incompatible cohorts", () => {
  assert.equal(
    readingComparisons(
      [
        { ...books[0], reader: { documentId: "ebook", pageCount: 20 } },
        books[1],
      ],
      sessions,
      profile,
    ).length,
    0,
  );
  for (const change of [
    { unit: "percent" },
    { durationSeconds: 180 },
    { endPosition: 0 },
  ])
    assert.equal(
      readingComparisons(
        books,
        sessions.map((s) => ({ ...s, ...change })) as ReadingSession[],
        profile,
      ).length,
      0,
    );
  assert.equal(readingComparisons(books, sessions.slice(1), profile).length, 0);
  assert.equal(
    readingComparisons(
      books,
      sessions.map((s) => ({
        ...s,
        demoData: { synthetic: s.bookId === "sf" },
      })),
      profile,
    ).length,
    0,
  );
  assert.equal(
    readingComparisons(
      [books[0], { ...books[1], language: "fra" }],
      sessions,
      profile,
    ).length,
    0,
  );
});
