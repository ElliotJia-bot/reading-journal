import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readingSummary,
  peerMatches,
  type PublicReader,
} from "../../shared/discovery.js";
import {
  catalogBooks,
  sameBook,
  usefulSubjects,
} from "../../shared/book-recommendations.js";
import { bookInput } from "../src/schema.js";
import type { Book, ReadingSession } from "../../shared/domain.js";
const now = Date.parse("2026-11-07T18:00:00Z");
const book = {
  id: "private-id",
  title: "A story",
  author: "Author",
  cover: "",
  unit: "pages",
  topics: ["Fiction"],
  status: "Reading",
  catalogId: "OL1W",
  language: "eng",
  totalPages: 100,
  completedAt: now,
} as Book;
const session = {
  id: "private-session",
  bookId: book.id,
  durationSeconds: 601,
  startPosition: 5,
  endPosition: 15,
  unit: "pages",
  startedAt: now - 601000,
  endedAt: now,
  note: "SECRET_NOTE",
  location: "SECRET_LOCATION",
  reaction: "Liked it",
} as ReadingSession;
test("Public summaries exclude synthetic books and sessions and allowlist every shared field", () => {
  const summary = readingSummary(
    [book, { ...book, id: "demo", demoData: { synthetic: true } }],
    [
      session,
      { ...session, bookId: "demo", durationSeconds: 99999 },
      { ...session, durationSeconds: 99999, demoData: { synthetic: true } },
    ],
    now,
  );
  assert.equal(summary.pages, 10);
  assert.equal(summary.longestMinutes, 10);
  assert.equal(summary.booksFinished, 1);
  assert.doesNotMatch(
    JSON.stringify(summary),
    /SECRET_|private-id|private-session|startedAt|endedAt|note|location/,
  );
  assert.equal(summary.books[0].id, "OL1W");
  assert.equal(
    readingSummary([book], [{ ...session, unit: "percent" }], now).pages,
    0,
  );
});
test("Peer recommendations need real eligible peers, repeated likes, matching language and never the user's own book", () => {
  const reader = (id: string): PublicReader => ({
    id,
    displayName: id,
    tier: "Beginner",
    updatedAt: now,
    language: "eng",
    ...readingSummary([book], [session], now),
  });
  assert.equal(
    peerMatches([reader("a"), reader("b")], "me", ["Fiction"], "eng", [], [])
      .matches.length,
    0,
  );
  const population = [reader("a"), reader("b"), reader("c")];
  assert.equal(
    peerMatches(population, "me", ["Fiction"], "eng", [], []).matches.length,
    1,
  );
  assert.equal(
    peerMatches(population, "me", ["Fiction"], "eng", [book], []).matches
      .length,
    0,
  );
  assert.equal(
    peerMatches(population, "me", ["Fiction"], "eng", [], ["OL1W"]).matches
      .length,
    0,
  );
  assert.equal(
    peerMatches(population, "a", ["Fiction"], "eng", [], []).matches.length,
    0,
  );
  assert.equal(
    peerMatches(population, "me", ["Fiction"], "fre", [], []).matches.length,
    0,
  );
});
test("Catalog language selection and work identity exclude a translation of an owned book", () => {
  const payload = {
    docs: [
      {
        key: "/works/OL1W",
        title: "Original title",
        language: ["eng", "ara"],
        editions: {
          docs: [
            { title: "Arabic edition", language: ["ara"] },
            { title: "English edition", language: ["eng"] },
          ],
        },
      },
      { key: "/works/OL2W", title: "Another language", language: ["ara"] },
    ],
  };
  const matches = catalogBooks(payload, "eng");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, "English edition");
  assert.equal(sameBook(matches[0], book), true);
  assert.deepEqual(
    usefulSubjects([
      "Malagasy language",
      "Texts",
      "Translations into Arabic",
      "Friendship",
      "Adventure",
    ]),
    ["Friendship", "Adventure"],
  );
});
test("Dropped status requires a reason and cannot receive server completion metadata", () => {
  const input = {
    title: "A book",
    unit: "pages",
    totalPages: 100,
    baselinePosition: 0,
    status: "Dropped",
    topics: [],
  };
  assert.equal(bookInput.safeParse(input).success, false);
  assert.equal(
    bookInput.safeParse({ ...input, dropReason: "Not the right time" }).success,
    true,
  );
  assert.equal(
    bookInput.safeParse({
      ...input,
      dropReason: "Not the right time",
      completedAt: now,
    }).success,
    false,
  );
});

test("Bilingual and article variants resolve to the original work instead of recommending it again", () => {
  const original = {
    id: "owned",
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
  };
  for (const title of ["Little Prince", "El Principito / The Little Prince"]) {
    assert.equal(
      sameBook(
        {
          id: "OL10263W",
          title,
          authors: ["Antoine de Saint-Exupery"],
          subjects: [],
          cover: "",
        },
        original,
      ),
      true,
    );
  }
  assert.equal(
    sameBook(
      {
        id: "OL2W",
        title: "Night Flight",
        authors: [original.author],
        subjects: [],
        cover: "",
      },
      original,
    ),
    false,
  );
  assert.equal(
    catalogBooks(
      {
        docs: [
          {
            key: "/works/OL1W",
            title: "Unverified edition",
            language: ["eng"],
          },
        ],
      },
      "eng",
    ).length,
    0,
  );
});
