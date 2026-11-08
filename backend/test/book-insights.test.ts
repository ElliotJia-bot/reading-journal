import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readingClock,
  hourLabel,
  slowdownOverview,
} from "../../shared/book-insights.ts";
import type { Book, ReadingSession } from "../../shared/domain.ts";
import type { PageVisit } from "../../shared/reader.ts";
const now = Date.parse("2026-11-08T17:00:00Z");
const book = { id: "book", unit: "pages", totalPages: 300 } as Book;
const session = (
  id: string,
  at: string,
  start = 0,
  end = 20,
  minutes = 20,
): ReadingSession =>
  ({
    id,
    bookId: "book",
    unit: "pages",
    startPosition: start,
    endPosition: end,
    durationSeconds: minutes * 60,
    startedAt: Date.parse(at),
    endedAt: Date.parse(at) + minutes * 60000,
    reaction: "",
    stopReason: "",
    topics: [],
  }) as ReadingSession;
test("Reading clock uses the local start hour and actual active duration, not a paused wall-clock span", () => {
  const s = session("one", "2026-11-06T01:30:00Z");
  const clock = readingClock(
    book,
    [
      { ...s, endedAt: s.startedAt + 3 * 3600000 },
      session("two", "2026-11-07T01:30:00Z"),
      session("three", "2026-11-08T02:30:00Z"),
    ],
    "America/New_York",
    now,
  );
  assert.equal(clock.hours[20].minutes, 40);
  assert.equal(clock.hours[21].minutes, 20);
  assert.equal(clock.minutes, 60);
  assert.equal(clock.peak?.start, 20);
  assert.equal(clock.sessions, 3);
  assert.equal(hourLabel(24), "12 AM");
});
test("Clock never claims a usual window from a single sitting; unknown, future and invalid records are excluded", () => {
  const s = session("one", "2026-11-07T01:30:00Z");
  const clock = readingClock(
    book,
    [
      s,
      { ...s, bookId: "other" },
      { ...s, durationSeconds: 180 },
      { ...s, durationSeconds: Infinity },
      { ...s, endedAt: now + 1 },
      { ...s, durationSeconds: 999999 },
    ],
    "UTC",
    now,
  );
  assert.equal(clock.sessions, 1);
  assert.equal(clock.peak, null);
  assert.equal(clock.hours.length, 24);
  assert.equal(readingClock(book, [], "UTC", now).minutes, 0);
});
test("Clock groups both repeated local hours at the DST fall-back, without inventing a second day", () => {
  const a = session("a", "2026-11-01T05:15:00Z"),
    b = session("b", "2026-11-01T06:15:00Z");
  const clock = readingClock(book, [a, b], "America/New_York", now);
  assert.equal(clock.hours[1].minutes, 40);
  assert.equal(clock.minutes, 40);
});
const logs = [
  session("a", "2026-11-03T18:00:00Z", 0, 20),
  session("b", "2026-11-04T18:00:00Z", 20, 40),
  session("c", "2026-11-05T18:00:00Z", 40, 60),
  session("d", "2026-11-06T18:00:00Z", 60, 80, 40),
];
test("Manual slowdown is an observed sitting range, not fabricated per-page samples", () => {
  const result = slowdownOverview(book, logs, [], now);
  assert.equal(result.points.length, 4);
  assert.equal(result.ranges.length, 1);
  assert.equal(result.ranges[0].start, 60);
  assert.equal(result.ranges[0].end, 80);
  assert.equal(result.ranges[0].relative, 2);
  assert.equal(result.ranges[0].page, null);
  assert.deepEqual(result.ranges[0].pages, []);
  assert.equal(result.ranges[0].sessionIds[0], "d");
  assert.equal(slowdownOverview(book, logs.slice(0, 3), [], now).comparable, 0);
});
test("Percentage logs, zero or out-of-range progress and other books cannot affect page comparison", () => {
  const s = logs[3];
  const result = slowdownOverview(
    book,
    [
      ...logs,
      { ...s, id: "percent", unit: "percent" },
      { ...s, id: "back", endPosition: 50 },
      { ...s, id: "outside", endPosition: 1000 },
      { ...s, id: "other", bookId: "other" },
    ],
    [],
    now,
  );
  assert.equal(result.points.length, 4);
  assert.equal(result.ranges[0].relative, 2);
});
test("Ebook slowdowns group adjacent sections, preserve gaps and use the strongest measured page for the clue", () => {
  const ebook = {
    ...book,
    reader: { documentId: "doc", pageCount: 30 },
  } as Book;
  const s = session("a", "2026-11-07T18:00:00Z", 0, 20, 30);
  const visit = (page: number, ms: number): PageVisit =>
    ({
      id: String(page),
      page,
      activeMs: ms,
      sessionId: "a",
      documentId: "doc",
      characters: 500,
      words: 100,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      reaction: "",
    }) as PageVisit;
  const visits = [
    visit(0, 30000),
    visit(1, 30000),
    visit(2, 30000),
    visit(3, 60000),
    visit(4, 90000),
    visit(6, 90000),
    { ...visit(7, 999000), sessionId: "other" },
    { ...visit(8, 999000), documentId: "different" },
  ];
  const result = slowdownOverview(ebook, [s], visits, now);
  assert.equal(result.points.length, 6);
  assert.equal(result.ranges.length, 2);
  assert.deepEqual(result.ranges[0].pages, [3, 4]);
  assert.equal(result.ranges[0].start, 4);
  assert.equal(result.ranges[0].end, 5);
  assert.equal(result.ranges[0].page, 4);
  assert.equal(result.ranges[0].relative, 3);
  assert.equal(result.ranges[1].start, 7);
});
test("Slowdown cards are limited to the three largest differences", () => {
  const more = Array.from({ length: 5 }, (_, i) =>
    session(
      `slow-${i}`,
      "2026-11-07T18:00:00Z",
      90 + i * 20,
      110 + i * 20,
      50 + i * 10,
    ),
  );
  const baseline = Array.from({ length: 10 }, (_, i) => ({
    ...logs[0],
    id: `base-${i}`,
  }));
  const result = slowdownOverview(book, [...baseline, ...more], [], now);
  assert.equal(result.ranges.length, 3);
  assert(result.ranges[0].relative! > result.ranges[2].relative!);
});
