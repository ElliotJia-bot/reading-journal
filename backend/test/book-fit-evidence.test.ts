import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookFitEvidence,
  demoFeaturesSchema,
} from "../src/book-fit-evidence.js";
import { parseBookExplanation } from "../src/recommendation-explanation.js";
import type { Book, ReadingSession } from "../../shared/domain.js";

const now = Date.parse("2026-11-08T20:00:00Z");
const profile = {
  language: "eng",
  timezone: "America/New_York",
  topics: [],
  goal: "Read",
};
const books = Array.from({ length: 6 }, (_, i) => ({
  id: `b${i}`,
  title: i === 0 ? "Normal People" : `Book ${i}`,
  author: "Author",
  language: "eng",
  status:
    i === 0
      ? "Reading"
      : i === 3
        ? "Dropped"
        : i === 5
          ? "Want to Read"
          : "Finished",
  completedAt: i === 3 ? null : now - 86400000,
  droppedAt: i === 3 ? now - 86400000 : null,
  demoData: { synthetic: true },
  topics: [],
})) as Book[];
const styles = [
  ["dialogue-led", "character-driven"],
  ["dialogue-led", "character-driven"],
  ["character-driven"],
  ["idea-led"],
  ["character-driven"],
  ["character-driven"],
];
const features = demoFeaturesSchema.parse({
  synthetic: true,
  presentationMode: true,
  batchId: "test",
  library: Object.fromEntries(
    books.map((b, i) => [
      b.id,
      { styles: styles[i], meanSentenceWords: 16 + i * 2 },
    ]),
  ),
  candidates: {
    OL1W: {
      styles: ["dialogue-led", "character-driven"],
      dialoguePercent: 41,
      averageChapterPages: 14,
      meanSentenceWords: 18,
    },
  },
});
const sessions = Array.from({ length: 8 }, (_, i) => ({
  id: `s${i}`,
  bookId: `b${Math.floor(i / 2)}`,
  startedAt: now - (i + 1) * 86400000,
  endedAt: now - (i + 1) * 86400000 + 3000000,
  durationSeconds: 3000,
  startPosition: 0,
  endPosition: i < 4 ? 61 : 50,
  unit: "pages",
  source: "manual",
  reaction: "Relaxing",
  demoData: { synthetic: true },
  note: "PRIVATE_NOTE",
  location: "PRIVATE_ADDRESS",
})) as ReadingSession[];
const evidence = () =>
  bookFitEvidence(books, sessions, profile, "OL1W", features, now);
test("Account-scoped feature matching computes pace, resolved completion and chapter fit from records", () => {
  const facts = Object.fromEntries(
    evidence().map((e) => [e.id, JSON.parse(e.text)]),
  );
  assert.equal(facts["fit-pace"].percentChange, 22);
  assert.equal(facts["fit-pace"].dialoguePercent, 41);
  assert.equal(facts["fit-completion"].finished, 3);
  assert.equal(facts["fit-completion"].resolved, 3);
  assert.deepEqual(facts["fit-completion"].allowedPercents, [100]);
  assert.equal(facts["fit-session"].medianSittingMinutes, 50);
  assert.equal(facts["fit-session"].estimatedChapterMinutes, 13);
  assert.equal(facts["fit-connection"].title, "Normal People");
  assert.doesNotMatch(JSON.stringify(facts), /PRIVATE_|b0|s0/);
  assert.equal(facts["fit-sentences"].relaxingBooksMedianSentenceWords, 19);
});
test("Missing, real, wrong-language and sparse records never acquire demo feature claims", () => {
  assert.deepEqual(
    bookFitEvidence(books, sessions, profile, "OL1W", undefined, now),
    [],
  );
  assert.deepEqual(
    bookFitEvidence(books, sessions, profile, "OL2W", features, now),
    [],
  );
  for (const changed of [
    sessions.map((s) => ({ ...s, demoData: undefined })),
    sessions.map((s) => ({ ...s, source: "reader" as const })),
    sessions.map((s) => ({ ...s, unit: "percent" as const })),
    sessions.map((s) => ({ ...s, startedAt: now + 1, endedAt: now + 10 })),
    sessions.slice(0, 2),
  ]) {
    const facts = bookFitEvidence(
      books,
      changed,
      profile,
      "OL1W",
      features,
      now,
    );
    assert(
      !facts.some((e) =>
        ["fit-pace", "fit-session", "fit-sentences"].includes(e.id),
      ),
    );
  }
  assert(
    !bookFitEvidence(
      books.map((b) => ({ ...b, language: "chi" })),
      sessions,
      profile,
      "OL1W",
      features,
      now,
    ).some((e) => e.id === "fit-pace"),
  );
  assert.equal(
    demoFeaturesSchema.safeParse({ ...features, synthetic: false }).success,
    false,
  );
  assert.equal(
    demoFeaturesSchema.safeParse({
      ...features,
      candidates: { OL1W: { styles: [], dialoguePercent: 130 } },
    }).success,
    false,
  );
});
test("Rich AI prose accepts supported paired facts and rejects fabricated metrics or comprehension ceilings", () => {
  const input = [
    ...evidence(),
    {
      id: "book-0",
      text: JSON.stringify({ title: "Normal People", status: "Reading" }),
    },
  ];
  const prose =
    "Like Normal People, this book has a dialogue-led style. Your pace on dialogue-led books runs 22% above your other books, and dialogue makes up 41% of this book. Chapters average 14 pages, roughly 13 minutes at your page pace, fitting inside your typical 50 minute sitting.";
  assert.equal(parseBookExplanation(prose, input).reason, prose);
  assert.throws(() => parseBookExplanation(prose.replace("41%", "49%"), input));
  assert.throws(() =>
    parseBookExplanation(prose.replace("14 pages", "29 pages"), input),
  );
  assert.throws(() =>
    parseBookExplanation(prose + " This sits under your ceiling.", input),
  );
  assert.throws(() =>
    parseBookExplanation(
      prose,
      input.filter((e) => !e.id.startsWith("fit-")),
    ),
  );
});
