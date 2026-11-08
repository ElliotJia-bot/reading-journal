import test from "node:test";
import assert from "node:assert/strict";
import {
  editedTiming,
  homeMetrics,
  pagesRead,
  calendarRange,
  finishEstimate,
} from "../../shared/metrics.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
const now = Date.parse("2026-11-07T20:00:00Z");
const session = {
  id: "s",
  bookId: "b",
  startedAt: now - 3600423,
  endedAt: now - 3400312,
  durationSeconds: 81,
  startPosition: 0,
  endPosition: 12,
  unit: "pages",
  source: "manual",
  topics: [],
} as ReadingSession;
const book = {
  id: "b",
  unit: "pages",
  totalPages: 100,
  position: 30,
  status: "Reading",
} as Book;
test("Editing only a reflection preserves seconds, timestamps, and elapsed pauses", () => {
  assert.deepEqual(
    editedTiming(session, "1.4", "2026-11-07 14:00", "1.4", "2026-11-07 14:00"),
    {
      durationSeconds: 81,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
  );
  assert.equal(
    editedTiming(session, "2", "2026-11-07 14:00", "1.4", "2026-11-07 14:00")
      .durationSeconds,
    120,
  );
});
test("Forward pages exclude percentage and backwards navigation", () => {
  assert.equal(pagesRead(session), 12);
  assert.equal(pagesRead({ ...session, unit: "percent" }), null);
  assert.equal(
    pagesRead({ ...session, startPosition: 20, endPosition: 10 }),
    0,
  );
});
test("Calendar metrics handle DST, zero comparison, and unknown completion dates", () => {
  const days = calendarRange(7, "America/New_York", now);
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-11-01");
  const result = homeMetrics(
    [{ ...session, durationSeconds: 181 }],
    [{ ...book, status: "Finished" }],
    "America/New_York",
    now,
  );
  assert.equal(result.currentStreak, 1);
  assert.equal(result.changePercent, null);
  assert.equal(result.booksThisYear, 0);
  assert.equal(result.undatedFinished, 1);
  assert.equal(
    homeMetrics(
      [{ ...session, durationSeconds: 180 }],
      [],
      "America/New_York",
      now,
    ).currentStreak,
    0,
  );
});
test("Finish estimates need three substantial sessions in this edition", () => {
  assert.equal(finishEstimate(book, [session]), null);
  const sessions = Array.from({ length: 3 }, (_, i) => ({
    ...session,
    id: String(i),
    durationSeconds: 600,
    startPosition: i * 10,
    endPosition: (i + 1) * 10,
  }));
  assert.deepEqual(finishEstimate(book, sessions), { minutes: 70, sample: 3 });
});
