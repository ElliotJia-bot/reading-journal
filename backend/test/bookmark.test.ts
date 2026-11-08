import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBookmarkEvent, initialBookmark, bookmarkSeconds, type BookmarkEvent } from "../../shared/bookmark.js";
import { bookmarkBatchInput, bookmarkClaimInput, bookmarkPairInput } from "../src/bookmark-schema.js";
const base = 1700000000000;
function event(name: BookmarkEvent["event"], page: number, elapsed: number, extra: Partial<BookmarkEvent> = {}): BookmarkEvent {
  return { event: name, page, elapsed_seconds: elapsed, active_reading_seconds: 0, paused_seconds: 0, paused: false, ...extra };
}
test("V2 forward/back visits, page mapping, pause/resume, and stale active headers", () => {
  let state = initialBookmark("test", "book", 42, base);
  const visits = [];
  const events = [
    event("reading_started", 1, 0, { start_page: 1 }),
    event("page_completed", 1, 10, { completed_page: 1, time_on_page_seconds: 10, visit_number: 1, navigation_reason: "next" }),
    event("page_started", 2, 10, { new_page: 2, direction: "next", forward_turns: 1, backward_turns: 0 }),
    event("reading_paused", 2, 15, { paused: true, active_reading_seconds: 15 }),
    event("reading_resumed", 2, 35, { active_reading_seconds: 15, paused_seconds: 20, total_paused_seconds: 20 }),
    event("page_completed", 2, 40, { active_reading_seconds: 15, paused_seconds: 20, completed_page: 2, time_on_page_seconds: 10, visit_number: 1, navigation_reason: "back" }),
    event("page_started", 1, 40, { active_reading_seconds: 15, paused_seconds: 20, new_page: 1, direction: "back", forward_turns: 1, backward_turns: 1 }),
    // V2 incorrectly doubles the final 5-second interval. Session total is 25s.
    event("page_completed", 1, 45, { active_reading_seconds: 25, paused_seconds: 20, time_on_page_seconds: 10, visit_number: 2, navigation_reason: "session_end" }),
    event("reading_ended", 1, 45, { active_reading_seconds: 25, paused_seconds: 20, total_active_seconds: 25, total_paused_seconds: 20, forward_turns: 1, backward_turns: 1 }),
  ];
  for (const [i, e] of events.entries()) {
    const next = applyBookmarkEvent(state, e, i + 1, base + e.elapsed_seconds * 1000);
    state = next.state; if (next.visit) visits.push(next.visit);
  }
  assert.equal(state.activeSeconds, 25); assert.equal(state.pausedSeconds, 20);
  assert.equal(state.currentPage, 42); assert.equal(state.completedSeconds, 25);
  assert.equal(state.completedVisits, 3); assert.deepEqual(state.visitedPages, [42, 43]);
  assert.deepEqual(visits.map(v => v.activeSeconds), [10, 10, 5]);
  assert.equal(visits[2].corrected, true); assert.equal(visits[2].rawSeconds, 10);
  assert.equal(state.status, "ended"); assert.equal(bookmarkSeconds(state, base + 999000), 25);
});
test("Paused ending excludes ongoing pause, live clock is heartbeat-bounded", () => {
  let s = initialBookmark("test", "book", 1, base);
  s = applyBookmarkEvent(s, event("reading_started", 1, 0), 1, base).state;
  assert.equal(bookmarkSeconds(s, base + 100000), 15);
  s = applyBookmarkEvent(s, event("reading_paused", 1, 12, { paused: true, active_reading_seconds: 12 }), 2, base + 12000).state;
  assert.equal(bookmarkSeconds(s, base + 100000), 12);
  const end = applyBookmarkEvent(s, event("page_completed", 1, 30, { paused: true, active_reading_seconds: 12, paused_seconds: 18, navigation_reason: "session_end", time_on_page_seconds: 12 }), 3, base + 30000);
  assert.equal(end.visit?.activeSeconds, 12); assert.equal(end.visit?.corrected, false);
  s = applyBookmarkEvent(end.state, event("reading_ended", 1, 30, { paused: true, active_reading_seconds: 12, total_active_seconds: 12, total_paused_seconds: 18 }), 4, base + 30000).state;
  assert.equal(s.activeSeconds, 12); assert.equal(s.pausedSeconds, 18);
});
test("Reject missing starts, firmware restart, backwards clocks, and event order gaps", () => {
  const s = initialBookmark("test", "book", 1, base);
  assert.throws(() => applyBookmarkEvent(s, event("page_started", 2, 10), 1, base), /Start the V2/);
  assert.throws(() => applyBookmarkEvent(s, event("reading_started", 1, 0), 2, base), /sequence/);
  const started = applyBookmarkEvent(s, event("reading_started", 1, 1), 1, base).state;
  assert.throws(() => applyBookmarkEvent(started, event("reading_started", 1, 0), 2, base), /restarted/);
  assert.throws(() => applyBookmarkEvent(started, event("navigation_limit", 1, 0), 2, base), /clock moved/);
});
test("Bridge schemas reject oversize, wrong types, short pairing codes and invalid pages", () => {
  assert.equal(bookmarkPairInput.safeParse({ sessionId: "a", bookId: "b", startPage: 0 }).success, false);
  assert.equal(bookmarkClaimInput.safeParse({ code: "123456", token: "a".repeat(64) }).success, false);
  const e = { sequence: 1, observedAt: base, event: event("reading_started", 1, 0) };
  assert.equal(bookmarkBatchInput.safeParse({ events: [e] }).success, true);
  assert.equal(bookmarkBatchInput.safeParse({ events: Array(21).fill(e) }).success, false);
  assert.equal(bookmarkBatchInput.safeParse({ events: [{ ...e, event: { ...e.event, paused: "false" } }] }).success, false);
  assert.equal(bookmarkBatchInput.parse({ events: [{ ...e, event: { ...e.event, page_visit_history: Array(5).fill({}) } }] }).events[0].event.hasOwnProperty("page_visit_history"), false);
});
