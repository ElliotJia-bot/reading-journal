import { test } from "node:test";
import assert from "node:assert/strict";
import {
  profileContent,
  profileVisibility,
} from "../../shared/reader-profile.js";
import { postDTO } from "../src/community-view.js";
import type { Book, ReadingSession } from "../../shared/domain.js";

const now = Date.parse("2026-11-08T17:00:00Z");
const book = {
  id: "PRIVATE_BOOK_ID",
  title: "A Book",
  author: "An Author",
  cover: "",
  status: "Reading",
  position: 75,
  totalPages: 300,
  unit: "pages",
  updatedAt: now,
  reader: { documentId: "PRIVATE_DOCUMENT" },
} as Book;
const session = (startedAt: string, topics = ["Fiction"]): ReadingSession =>
  ({
    id: "PRIVATE_SESSION_ID",
    bookId: book.id,
    startedAt: Date.parse(startedAt),
    endedAt: Date.parse(startedAt) + 1200000,
    durationSeconds: 1200,
    topics,
    startPosition: 50,
    endPosition: 75,
    unit: "pages",
    note: "PRIVATE_NOTE",
    location: "PRIVATE_LOCATION",
    source: "manual",
  }) as ReadingSession;

test("Legacy and opted-out profiles keep both sections private; owner access is independent", () => {
  assert.deepEqual(profileVisibility(false, {}), {
    library: false,
    habits: false,
  });
  assert.deepEqual(profileVisibility(false, { active: true }), {
    library: false,
    habits: false,
  });
  assert.deepEqual(
    profileVisibility(false, { active: true, shareLibrary: true }),
    { library: true, habits: false },
  );
  assert.deepEqual(
    profileVisibility(false, { active: true, shareHabits: true }),
    { library: false, habits: true },
  );
  assert.deepEqual(
    profileVisibility(false, {
      active: false,
      shareLibrary: true,
      shareHabits: true,
    }),
    { library: false, habits: false },
  );
  assert.deepEqual(profileVisibility(true, {}), {
    library: true,
    habits: true,
  });
});
test("Public profile is an allowlist with local seven-day chart and only three favorite topics", () => {
  const result = profileContent(
    [book],
    [
      session("2026-11-07T20:00:00Z", ["Fiction", "Mystery"]),
      session("2026-11-08T16:00:00Z", ["Science", "Nature", "Philosophy"]),
      session("2026-11-02T04:00:00Z"), // November 1 local, outside seven-day chart
      session("2026-10-01T16:00:00Z"), // Outside 30 days
    ],
    "America/New_York",
    now,
  );
  assert.equal(result.library[0].progress, 25);
  assert.equal(result.habits.sessions, 3);
  assert.equal(result.habits.minutes, 60);
  assert.equal(result.habits.readingDays, 3);
  assert.equal(result.habits.topTopics.length, 3);
  assert.deepEqual(
    result.habits.week.map((d) => d.minutes),
    [0, 0, 0, 0, 0, 20, 20],
  );
  assert.equal(result.habits.week.filter((d) => d.today).length, 1);
  assert.equal(result.habits.week[6].day, "Sun");
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_|startedAt|endedAt|note|location|bookId|documentId/,
  );
});
test("Invalid sessions and synthetic records cannot inflate a visitor profile", () => {
  const log = session("2026-11-07T20:00:00Z");
  const bad = [
    { ...log, durationSeconds: 180 },
    { ...log, durationSeconds: Infinity },
    { ...log, endedAt: now + 1 },
    { ...log, durationSeconds: 99999 },
    { ...log, bookId: "missing" },
    { ...log, demoData: { synthetic: true } },
  ];
  assert.equal(profileContent([book], bad, "UTC", now).habits.sessions, 0);
  const demoBook = { ...book, demoData: { synthetic: true } };
  assert.equal(profileContent([demoBook], [log], "UTC", now).library.length, 0);
  const demo = profileContent(
    [demoBook],
    [{ ...log, demoData: { synthetic: true } }],
    "UTC",
    now,
    true,
  );
  assert.equal(demo.library.length, 1);
  assert.equal(demo.habits.sessions, 1);
});
test("Shelf progress handles completed, percent and unknown-length books", () => {
  const result = profileContent(
    [
      { ...book, status: "Finished" },
      { ...book, unit: "percent", position: 62 },
      { ...book, totalPages: null },
      { ...book, position: 999 },
    ],
    [],
    "UTC",
    now,
  );
  assert.deepEqual(
    result.library.map((b) => b.progress),
    [100, 62, null, 100],
  );
});
test("Reused post projection only returns already-shared fields", () => {
  const result = postDTO(
    "post",
    {
      circleId: "fiction",
      authorId: "author",
      authorName: "Name",
      kind: "reflection",
      title: "Thought",
      body: "Published reflection",
      book: null,
      reading: null,
      createdAt: now,
      commentCount: 2,
      encouragementCount: 0,
      note: "PRIVATE_NOTE",
      email: "PRIVATE_EMAIL",
      demoData: { synthetic: true },
    },
    "viewer",
    false,
  );
  assert.equal(result.isOwn, false);
  assert.equal(result.body, "Published reflection");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|demoData/);
});
