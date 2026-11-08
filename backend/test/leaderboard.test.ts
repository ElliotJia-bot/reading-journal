import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leaderboardSummary,
  rankReaders,
  type LeaderboardReader,
} from "../../shared/leaderboard.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
const now = Date.parse("2026-11-08T17:00:00Z");
const book = {
  id: "private-book",
  title: "Book",
  totalPages: 300,
  status: "Finished",
  completedAt: now - 86400000,
} as Book;
const log = (
  id: string,
  at: string,
  pages: number,
  minutes = 20,
): ReadingSession =>
  ({
    id,
    bookId: book.id,
    startedAt: Date.parse(at),
    endedAt: Date.parse(at) + minutes * 60000,
    durationSeconds: minutes * 60,
    startPosition: 10,
    endPosition: 10 + pages,
    unit: "pages",
    source: "manual",
    location: "PRIVATE_LOCATION",
    note: "PRIVATE_NOTE",
  }) as ReadingSession;
test("Daily pages ranks the best single local day, sums same-day sittings and computes growth from two calendar weeks", () => {
  const result = leaderboardSummary(
    [book],
    [
      log("old", "2026-10-30T15:00:00Z", 5, 10),
      log("one", "2026-11-06T15:00:00Z", 20, 20),
      log("two", "2026-11-06T20:00:00Z", 25, 30),
      log("three", "2026-11-07T18:00:00Z", 40, 40),
    ],
    now,
    "America/New_York",
  );
  assert.deepEqual(result, {
    booksFinished: 1,
    bestDayPages: 45,
    growthMinutes: 80,
    longestMinutes: 40,
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_|private-book|startedAt|note|location/,
  );
});
test("Invalid, future and brief sessions, ebook sections and percentage progress cannot inflate page rankings", () => {
  const base = log("s", "2026-11-07T18:00:00Z", 10);
  const noPages = [
    { ...base, durationSeconds: 180 },
    { ...base, unit: "percent" as const },
    { ...base, endPosition: 5 },
    { ...base, endPosition: 301 },
    { ...base, endedAt: now + 1 },
    { ...base, durationSeconds: 99999 },
    log("midnight", "2026-11-08T04:55:00Z", 20),
  ];
  assert.equal(
    leaderboardSummary([book], noPages, now, "America/New_York").bestDayPages,
    0,
  );
  assert.equal(
    leaderboardSummary(
      [{ ...book, reader: { documentId: "private-doc", pageCount: 300 } }],
      [base],
      now,
    ).bestDayPages,
    0,
  );
  assert.equal(
    leaderboardSummary([{ ...book, status: "Reading" }], [base], now)
      .booksFinished,
    0,
  );
  assert.equal(
    leaderboardSummary([{ ...book, completedAt: now + 1 }], [base], now)
      .booksFinished,
    0,
  );
});
test("Synthetic reading is private by default and only the explicit demo option admits it", () => {
  const b = { ...book, demoData: { synthetic: true } },
    s = {
      ...log("demo", "2026-11-07T18:00:00Z", 25),
      demoData: { synthetic: true },
    };
  assert.deepEqual(leaderboardSummary([b], [s], now), {
    booksFinished: 0,
    bestDayPages: 0,
    growthMinutes: 0,
    longestMinutes: 0,
  });
  assert.equal(leaderboardSummary([b], [s], now, "UTC", true).bestDayPages, 25);
  assert.equal(leaderboardSummary([book], [s], now).bestDayPages, 0);
});
test("Local calendar boundaries stay correct across the daylight-saving transition", () => {
  const inside = log("inside", "2026-11-02T05:15:00Z", 20),
    outside = log("outside", "2026-11-02T04:15:00Z", 80);
  assert.equal(
    leaderboardSummary([book], [inside, outside], now, "America/New_York")
      .bestDayPages,
    20,
  );
  assert.equal(
    leaderboardSummary([book], [inside, outside], now, "America/New_York")
      .growthMinutes,
    0,
  );
});
test("Tiers never compete with each other, equal scores share rank and zeros do not rank", () => {
  const reader = (
    id: string,
    n: number,
    tier: "Beginner" | "Experienced" = "Beginner",
  ) =>
    ({
      id,
      displayName: id,
      tier,
      booksFinished: n,
      bestDayPages: n,
      growthMinutes: n,
      longestMinutes: n,
    }) as LeaderboardReader;
  const ranking = rankReaders(
    [
      reader("B", 4),
      reader("A", 4),
      reader("C", 2),
      reader("Expert", 40, "Experienced"),
      reader("Zero", 0),
    ],
    "Beginner",
    "bestDayPages",
  );
  assert.deepEqual(
    ranking.map((r) => [r.id, r.rank]),
    [
      ["A", 1],
      ["B", 1],
      ["C", 3],
    ],
  );
});
