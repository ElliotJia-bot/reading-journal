import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pagePace,
  passageClue,
  behavioralSuggestions,
} from "../../shared/reading-insights.ts";
import type { PageVisit } from "../../shared/reader.ts";
import type { Book, ReadingSession } from "../../shared/domain.ts";
import { passageInput } from "../src/reader-schema.ts";
const visit = (
  page: number,
  activeMs: number,
  sessionId = "one",
  characters = 500,
): PageVisit => ({
  id: `${sessionId}-${page}-${activeMs}`,
  page,
  activeMs,
  sessionId,
  characters,
  words: 100,
  documentId: "a".repeat(64),
  textHash: "b".repeat(64),
  chapter: "One",
  start: 0,
  end: 600,
  startedAt: 1000,
  endedAt: 200000,
  reaction: "",
});
test("Slower passages compare equal amounts of text, not raw page length", () => {
  const rows = pagePace([
    visit(0, 30000),
    visit(1, 30000),
    visit(2, 30000),
    visit(3, 60000, "one", 1000),
    visit(4, 90000),
  ]);
  assert.equal(rows[3].relative, 1);
  assert.equal(rows[3].slower, false);
  assert.equal(rows[4].relative, 3);
  assert.equal(rows[4].slower, true);
});
test("Repeated sessions do not create false slowdowns; fragments in a session are combined", () => {
  const rows = pagePace([
    visit(0, 30000),
    visit(1, 30000),
    visit(2, 30000),
    visit(3, 10000),
    visit(3, 20000),
    visit(3, 30000, "two"),
  ]);
  assert.equal(rows[3].activeMs, 60000);
  assert.equal(rows[3].sessionCount, 2);
  assert.equal(rows[3].averageMs, 30000);
  assert.equal(rows[3].relative, 1);
});
test("Insufficient or briefly skimmed pages do not produce a slowdown claim", () => {
  assert.equal(
    pagePace([visit(0, 90000), visit(1, 30000), visit(2, 30000)])[0].relative,
    null,
  );
  assert.equal(
    pagePace([
      visit(0, 90000),
      visit(1, 1000),
      visit(2, 30000),
      visit(3, 30000),
    ])[0].slower,
    false,
  );
  assert.deepEqual(pagePace([]), []);
});
test("Content clues separate explicit enjoyment from inferred difficulty and avoid CJK word proxies", () => {
  assert.match(
    passageClue("Extraordinary terminology", ["Enjoyed"]).title,
    /interest/,
  );
  assert.match(passageClue("Some words", ["Rereading"]).title, /returned/);
  assert.equal(
    passageClue("中文没有空格。".repeat(50), []).title,
    "A moment worth exploring",
  );
  assert.equal(
    passageClue("word ".repeat(40) + ".", []).title,
    "Longer sentences",
  );
});
test("Behavioral suggestions are scoped to this book and require repeated observations", () => {
  const book = { id: "own" } as Book;
  const row = {
    bookId: "other",
    durationSeconds: 1200,
    startedAt: Date.now() - 10000,
    topics: [],
    location: "Library",
    reaction: "",
  } as ReadingSession;
  assert.equal(behavioralSuggestions(book, [row, row, row], "UTC").length, 1);
  assert.match(
    behavioralSuggestions(book, [row, row, row], "UTC")[0].evidence,
    /^0 sessions/,
  );
  const result = behavioralSuggestions(
    book,
    [row, row, row].map((s) => ({ ...s, bookId: "own" })),
    "UTC",
  );
  assert.equal(result.length, 3);
  assert.match(result[0].action, /20-minute/);
});
test("Book-period passage analysis requires a bounded non-empty session scope", () => {
  const input = {
    page: 0,
    text: "An excerpt",
    consent: true,
    sessionIds: ["session-a"],
  };
  assert.equal(passageInput.safeParse(input).success, true);
  assert.equal(
    passageInput.safeParse({ ...input, sessionIds: [] }).success,
    false,
  );
  assert.equal(
    passageInput.safeParse({ ...input, sessionIds: Array(1001).fill("a") })
      .success,
    false,
  );
});
