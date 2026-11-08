import { test } from "node:test";
import assert from "node:assert/strict";
import { sharedCheckin, progressLabel } from "../../shared/community.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
import { communityPostInput } from "../src/community-schema.js";

const book = {
  id: "private-book",
  title: "A book",
  author: "An author",
  cover: "",
  topics: ["Private topic"],
} as Book;
const session = {
  id: "private-session",
  bookId: "private-book",
  startedAt: 1,
  endedAt: 1001,
  durationSeconds: 600,
  startPosition: 20,
  endPosition: 36,
  unit: "pages",
  note: "SECRET_NOTE",
  location: "PRIVATE_PLACE",
  reaction: "Liked it",
} as ReadingSession;
test("Public check-ins contain only explicitly selected reading fields", () => {
  assert.deepEqual(sharedCheckin(book, session, false, false), {
    book: { title: "A book", author: "An author", cover: "" },
    reading: {},
  });
  const all = sharedCheckin(book, session, true, true);
  assert.deepEqual(all.reading, {
    durationSeconds: 600,
    progress: { start: 20, end: 36, unit: "pages" },
  });
  assert.doesNotMatch(
    JSON.stringify(all),
    /SECRET_NOTE|PRIVATE_PLACE|private-session|startedAt|topics|reaction/,
  );
});
test("Percentage progress and revisiting never invent a pages-read number", () => {
  assert.equal(
    progressLabel({ start: 20, end: 36, unit: "pages" }),
    "Pages 20–36 (+16 pages)",
  );
  assert.equal(
    progressLabel({ start: 40, end: 20, unit: "pages" }),
    "Pages 40–20 · revisiting",
  );
  assert.equal(
    progressLabel({ start: 20, end: 36, unit: "percent" }),
    "20% → 36%",
  );
});
test("Post schema rejects forged author or private journal fields", () => {
  const input = {
    circleId: "fiction",
    displayName: "Reader",
    kind: "checkin",
    sessionId: "session",
    includeDuration: false,
    includeProgress: false,
    body: "",
  };
  assert.equal(communityPostInput.safeParse(input).success, true);
  assert.equal(
    communityPostInput.safeParse({ ...input, authorId: "another-reader" })
      .success,
    false,
  );
  assert.equal(
    communityPostInput.safeParse({ ...input, note: "private" }).success,
    false,
  );
  assert.equal(
    communityPostInput.safeParse({ ...input, displayName: "  " }).success,
    false,
  );
});

test("Margin notes require a bounded excerpt, reflection and owned-book reference", () => {
  const input = {
    circleId: "fiction",
    displayName: "Reader",
    kind: "reflection",
    bookId: "book",
    page: 0,
    quote: "A short sentence.",
    body: "My own reflection.",
  };
  assert.equal(communityPostInput.safeParse(input).success, true);
  for (const change of [
    { quote: "x".repeat(601) },
    { body: " " },
    { page: -1 },
    { location: "private" },
    { authorId: "forged" },
  ])
    assert.equal(
      communityPostInput.safeParse({ ...input, ...change }).success,
      false,
    );
});
