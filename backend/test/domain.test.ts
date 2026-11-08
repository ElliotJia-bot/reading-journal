import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  deriveProgress,
  elapsedSeconds,
  type Book,
  type ReadingSession,
} from "../../shared/domain.js";
import { sessionInput } from "../src/schema.js";
const book = {
  id: "book",
  baselinePosition: 10,
  topics: ["Fiction", "Design"],
} as Book;
function session(
  id: string,
  patch: Partial<ReadingSession> = {},
): ReadingSession {
  return {
    id,
    bookId: "book",
    startedAt: Date.parse("2026-11-06T18:00:00Z"),
    endedAt: Date.parse("2026-11-06T18:20:00Z"),
    durationSeconds: 1200,
    startPosition: 10,
    endPosition: 20,
    unit: "pages",
    location: "Home",
    reaction: "",
    stopReason: "",
    topics: [],
    note: "",
    source: "manual",
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}
test("Topics split duration and likes are based on explicit feedback", () => {
  const stats = aggregate(
    [session("one"), session("two", { reaction: "Liked it" })],
    [book],
    7,
    "America/New_York",
    Date.parse("2026-11-07T18:00:00Z"),
  );
  assert.equal(stats.totalMinutes, 40);
  assert.equal(stats.topics.Fiction, 1200);
  assert.equal(stats.likedTopics.Fiction, 1);
});
test("Rereads retain furthest progress and deletion recalculates current position", () => {
  const a = session("a", { endPosition: 40 });
  const b = session("b", { endPosition: 20, endedAt: a.endedAt + 1000 });
  assert.deepEqual(deriveProgress(book, [b, a]), {
    position: 20,
    furthestPosition: 40,
  });
  assert.deepEqual(deriveProgress(book, [a]), {
    position: 40,
    furthestPosition: 40,
  });
  assert.deepEqual(deriveProgress(book, []), {
    position: 10,
    furthestPosition: 10,
  });
});
test("Calendar ranges include DST and exclude local day outside range", () => {
  const now = Date.parse("2026-11-07T03:00:00Z"); // Nov 6 locally, including Oct 31.
  const sessions = [
    session("a", { startedAt: Date.parse("2026-10-31T04:30:00Z") }),
    session("b", { startedAt: Date.parse("2026-10-31T03:30:00Z") }),
  ];
  assert.equal(
    aggregate(sessions, [book], 7, "America/New_York", now).sessionCount,
    1,
  );
});
test("Background timer uses timestamps and excludes paused intervals", () => {
  assert.equal(
    elapsedSeconds({ accumulatedSeconds: 60, runningSince: 1000 }, 121000),
    180,
  );
  assert.equal(
    elapsedSeconds({ accumulatedSeconds: 60, runningSince: null }, 121000),
    60,
  );
});
test("Reject duration outside session interval and untrusted source", () => {
  const { id, createdAt, updatedAt, ...valid } = session("a");
  assert.equal(sessionInput.safeParse(valid).success, true);
  assert.equal(
    sessionInput.safeParse({ ...valid, durationSeconds: 9999 }).success,
    false,
  );
  assert.equal(
    sessionInput.safeParse({ ...valid, source: "chrome" }).success,
    false,
  );
});
