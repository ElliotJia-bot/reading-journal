import { test } from "node:test";
import assert from "node:assert/strict";
import { countedMs } from "../../shared/reader.js";
import {
  qualifiesForReadingLog,
  readerLogDraft,
  resetLoggedReader,
} from "../../shared/reader-session.js";

test("Reader completion requires strictly more than three effective minutes", () => {
  for (const ms of [0, 179999, 180000, NaN, Infinity])
    assert.equal(qualifiesForReadingLog(ms), false);
  assert.equal(qualifiesForReadingLog(180001), true);
  // A five-minute wall-clock visit with background/paused time does not qualify.
  let effective = 0;
  for (let now = 1000; now <= 300000; now += 1000)
    effective += countedMs(
      now - 1000,
      now,
      now - 1000,
      now <= 120000,
      now > 120000,
    );
  assert.equal(effective, 120000);
  assert.equal(qualifiesForReadingLog(effective), false);
});

test("Reader handoff preserves progress, exact active time, and retry IDs", () => {
  const state = {
    documentId: "edition",
    sessionId: "session",
    startedAt: 1000,
    startPosition: 7,
    sessionMs: 182750,
    page: 10,
    location: "Library",
    reaction: "Liked it",
    pending: [],
  };
  assert.equal(
    readerLogDraft({ ...state, sessionMs: 180000 }, "book", 400000),
    null,
  );
  const draft = readerLogDraft(state, "book", 400000)!;
  assert.equal(draft.id, "session");
  assert.equal(draft.bookId, "book");
  assert.equal(draft.startPosition, 7);
  assert.equal(draft.reader.endPosition, 11);
  assert.equal(draft.reader.effectiveMs, 182750);
  assert.equal(draft.accumulatedSeconds, 182);
  assert.equal(draft.runningSince, null);
  assert.equal(draft.startedAt, 1000);
  assert.equal(draft.endedAt, 400000);
  assert.equal(draft.reader.location, "Library");
  assert.equal(draft.reader.reaction, "Liked it");
  assert.notEqual(draft.reader.pendingVisits, state.pending);
  const reset = resetLoggedReader(state, draft.id, 11, "next-session", 500000);
  assert.equal(reset.sessionMs, 0);
  assert.equal(reset.startPosition, 11);
  assert.equal(reset.sessionId, "next-session");
  assert.equal(reset.paused, true);
  assert.equal(
    resetLoggedReader(reset, draft.id, 11, "duplicate", 600000),
    reset,
  );
});
