import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rankCrossGenre,
  splitShelves,
  visibleFeed,
  type DiscoveryFeed,
  type ShelfBook,
} from "../../shared/for-you.js";
import { peerMatches, type PublicReader } from "../../shared/discovery.js";
import type { Book } from "../../shared/domain.js";
const candidate = (
  n: number,
  subjects = ["History", "Adventure"],
): ShelfBook => ({
  id: `OL${n}W`,
  title: `Book ${n}`,
  authors: [`Author ${n}`],
  subjects,
  language: "eng",
  cover: "",
  matchedTopics: subjects,
  score: 0,
  reason: "Catalog match",
  source: "catalog",
  shelf: "personal",
});
const base = (): DiscoveryFeed => ({
  personal: Array.from({ length: 18 }, (_, i) => candidate(i + 1)),
  explore: Array.from({ length: 18 }, (_, i) => ({
    ...candidate(i + 30),
    shelf: "explore" as const,
  })),
  peers: Array.from({ length: 24 }, (_, i) => ({
    ...candidate(i + 60),
    shelf: "peers" as const,
    source: "popular" as const,
  })),
  votes: {},
  experience: null,
  peerCount: 0,
  peerSource: "popular",
  language: "eng",
  generatedAt: 1,
  usualGenres: ["Fantasy"],
  styleSignals: ["adventurous"],
});
test("Cross-genre ranking rejects usual genres and other languages, prioritizes supported shared style", () => {
  const list = rankCrossGenre(
    [
      candidate(1, ["Fantasy", "Adventure"]),
      candidate(2, ["Biography"]),
      candidate(3),
      { ...candidate(4), language: "chi" },
    ],
    ["Fantasy", "Adventure"],
    [],
    "eng",
  );
  assert.deepEqual(
    list.map((b) => b.id),
    ["OL3W", "OL2W"],
  );
  assert.match(list[0].reason, /adventurous/);
  assert.match(list[1].reason, /uncertain/);
});
test("Each shelf reserves six books; backup candidates do not swallow the next shelf", () => {
  const split = splitShelves(
    Array.from({ length: 40 }, (_, i) => candidate(i + 1)),
  );
  assert.equal(split.personal.length, 18);
  assert.equal(split.explore.length, 18);
  const feed = base();
  feed.peers = [
    { ...candidate(7), shelf: "peers", source: "popular" },
    ...feed.peers,
  ];
  const visible = visibleFeed(feed, [], {});
  assert.equal(visible.personal.length, 6);
  assert.equal(visible.explore.length, 6);
  assert.equal(visible.peers.length, 6);
  assert.equal(visible.peers[0].id, "OL7W");
  assert.equal(
    new Set(
      [...visible.personal, ...visible.explore, ...visible.peers].map(
        (b) => b.id,
      ),
    ).size,
    18,
  );
});
test("Feedback persists: Maybe remains, likes and dislikes are excluded including alternate editions", () => {
  const feed = base();
  feed.personal.unshift({
    ...candidate(900),
    title: "Book 3",
    authors: ["Author 3"],
  });
  const visible = visibleFeed(feed, [], {
    OL1W: { value: "yes", book: candidate(1) },
    OL2W: { value: "maybe", book: { ...candidate(2), shelf: "personal" } },
    OL3W: { value: "no", book: candidate(3) },
  });
  assert.equal(visible.personal[0].id, "OL2W");
  assert.equal(visible.personal.length, 6);
  assert.ok(
    !visible.personal.some((b) => ["OL1W", "OL3W", "OL900W"].includes(b.id)),
  );
});
test("Owned titles never return and Maybe does not bypass language or library filtering", () => {
  const feed = base(),
    owned = [{ id: "ol-OL1W", title: "Book 1", author: "Author 1" }] as Book[];
  const out = visibleFeed(feed, owned, {
    OL1W: { value: "maybe", book: { ...candidate(1), shelf: "personal" } },
    OL99W: {
      value: "maybe",
      book: { ...candidate(99), language: "chi", shelf: "personal" },
    },
  });
  assert.equal(out.personal.length, 6);
  assert.ok(!out.personal.some((b) => b.id === "OL1W" || b.id === "OL99W"));
});
test("Existing Maybe choices from the previous discovery screen remain visible", () => {
  const old = candidate(900);
  const { shelf, ...legacy } = old;
  const out = visibleFeed(base(), [], {
    OL900W: { value: "maybe", book: legacy },
  });
  assert.equal(out.personal[0].id, "OL900W");
});
test("Peer popularity uses self-selected experience and language, with minimum community evidence", () => {
  const readers = Array.from({ length: 4 }, (_, i) => ({
    id: `reader${i}`,
    tier: i === 3 ? "Experienced" : "Beginner",
    language: "eng",
    topics: [],
    books: [candidate(1), ...(i < 2 ? [candidate(2)] : [])],
    updatedAt: 1,
    displayName: "Reader",
    booksFinished: 0,
    pages: 0,
    longestMinutes: 0,
    growthMinutes: 0,
  })) as PublicReader[];
  const beginner = peerMatches(readers, "me", [], "eng", [], [], {
    tier: "Beginner",
    limit: 6,
  });
  assert.equal(beginner.peerCount, 3);
  assert.deepEqual(
    beginner.matches.map((b) => b.score),
    [3, 2],
  );
  assert.equal(
    peerMatches(readers, "me", [], "eng", [], [], { tier: "Experienced" })
      .matches.length,
    0,
  );
  assert.equal(
    peerMatches(readers, "me", [], "chi", [], [], { tier: "Beginner" }).matches
      .length,
    0,
  );
});
