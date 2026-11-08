import { test } from "node:test";
import assert from "node:assert/strict";
import { readingWeek } from "../../shared/domain.js";
import {
  catalogBooks,
  rankBookMatches,
  sameBook,
  usefulSubjects,
} from "../../shared/book-recommendations.js";
import type { Book } from "../../shared/domain.js";

test("Reading week always has seven local calendar dates, including blank days and DST", () => {
  const week = readingWeek(
    { "2026-11-01": 1200, "2026-11-03": 30, "2026-11-07": 9999 },
    "America/New_York",
    Date.parse("2026-11-07T03:00:00Z"),
  );
  assert.deepEqual(
    week.map((d) => d.key),
    [
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ],
  );
  assert.deepEqual(
    week.map((d) => d.seconds),
    [0, 1200, 0, 30, 0, 0, 0],
  );
  assert.equal(week[1].weekday, "Sun");
  assert.equal(week[6].isToday, true);
  const empty = readingWeek(
    {},
    "Asia/Tokyo",
    Date.parse("2026-12-31T23:00:00Z"),
  );
  assert.equal(empty.length, 7);
  assert.equal(empty[6].key, "2027-01-01");
  assert.equal(
    empty.every((d) => d.seconds === 0),
    true,
  );
});
const candidate = (
  id: string,
  title: string,
  subjects: string[],
  authors = ["Writer"],
) => ({ id, title, subjects, authors, cover: "" });
test("Book discovery explains real metadata matches and excludes owned, hidden and duplicate works", () => {
  const seed = candidate("OL1W", "Seed book", ["Fantasy"]);
  const owned = [
    { id: "owned", title: "Already Read!", author: "Writer" },
  ] as Book[];
  const ranked = rankBookMatches(
    [
      seed,
      candidate("OL2W", "Already read", ["Fantasy"]),
      candidate("OL3W", "A match", ["fantasy"]),
      candidate("OL4W", "A match", ["Fantasy"]),
      candidate("OL5W", "Hidden", ["Fantasy"]),
      candidate("OL6W", "No evidence", ["History"], ["Somebody"]),
      candidate("OL7W", "Same author", [], ["Writer"]),
    ],
    { topics: ["Fantasy"], authors: ["Writer"], seed },
    owned,
    ["OL5W"],
  );
  assert.deepEqual(
    ranked.map((b) => b.id),
    ["OL3W", "OL7W"],
  );
  assert.equal(ranked[0].reason, "Shared themes: Fantasy. Also by Writer.");
  assert.equal(ranked[1].reason, "Another book by Writer.");
  assert.ok(
    sameBook(ranked[0], {
      id: "ol-OL3W",
      title: "Different edition title",
      author: "Writer",
    }),
  );
});
test("Catalog parser accepts only real work identifiers and filters administrative subject tags", () => {
  const parsed = catalogBooks({
    docs: [
      {
        key: "/works/OL123W",
        title: "A book",
        author_name: ["Writer"],
        subject: ["Fantasy"],
        cover_i: 123,
      },
      { key: "javascript:alert(1)", title: "Invalid" },
      { key: "OL1W", title: "" },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "OL123W");
  assert.equal(
    parsed[0].cover,
    "https://covers.openlibrary.org/b/id/123-M.jpg",
  );
  assert.deepEqual(
    usefulSubjects([
      "Fiction",
      "Accessible book",
      "Friendship",
      "Friendship",
      "In library",
      "Video games",
    ]),
    ["Friendship", "Video games", "Fiction"],
  );
  assert.throws(() => catalogBooks({ error: "bad" }));
});

test("Preferred edition titles still exclude the owned original-language work", () => {
  const [book] = catalogBooks({
    docs: [
      {
        key: "/works/OL123W",
        title: "Original title",
        author_name: ["Writer"],
        editions: { docs: [{ title: "English edition" }] },
      },
    ],
  });
  assert.equal(book.title, "English edition");
  assert.ok(
    sameBook(book, { id: "local", title: "Original title", author: "Writer" }),
  );
});
