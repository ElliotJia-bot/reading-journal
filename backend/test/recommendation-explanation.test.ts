import { test } from "node:test";
import assert from "node:assert/strict";
import {
  explanationEvidence,
  explanationSupport,
  validateBookExplanation,
  parseBookExplanation,
} from "../src/recommendation-explanation.js";
import type { Book } from "../../shared/domain.js";
const evidence = [
  {
    id: "book-0",
    text: JSON.stringify({
      title: "Freedom of Money",
      status: "Reading",
      sessions: 16,
      minutes: 430,
      likedSessions: 13,
      syntheticSessions: 16,
    }),
  },
  {
    id: "book-1",
    text: JSON.stringify({
      title: "An Earlier Book",
      status: "Finished",
      sessions: 3,
      minutes: 60,
      likedSessions: 2,
    }),
  },
];
const reason =
  "Freedom of Money is on your current reading shelf, with Finance and Business among its recorded topics. This recommendation offers a move from those nonfiction interests into a fictional setting, giving you a different way to explore choices and consequences.\n\nYour demo journal includes several explicitly liked sessions. That is a reason to offer an adjacent theme to sample, without assuming that time spent reading proves enjoyment or that the books have identical writing styles.";
test("Expanded explanations must name a cited currently-reading book and reject invented references", () => {
  assert.equal(
    validateBookExplanation({ reason, evidenceIds: ["book-0"] }, evidence)
      .reason,
    reason,
  );
  assert.equal(
    validateBookExplanation(
      {
        reason: reason.replace("Freedom of Money", "Freedom of Money (book-0)"),
        evidenceIds: ["book-0"],
      },
      evidence,
    ).reason,
    reason,
  );
  assert.throws(() =>
    validateBookExplanation(
      { reason: "A short generic recommendation.", evidenceIds: ["book-0"] },
      evidence,
    ),
  );
  assert.throws(() =>
    validateBookExplanation({ reason, evidenceIds: ["invented"] }, evidence),
  );
  assert.throws(() =>
    validateBookExplanation(
      {
        reason: reason.replaceAll("Freedom of Money", "An Earlier Book"),
        evidenceIds: ["book-1"],
      },
      evidence,
    ),
  );
  assert.throws(() =>
    validateBookExplanation(
      { reason, evidenceIds: ["book-0", "book-1"] },
      evidence,
    ),
  );
});
test("Current books without sessions can supply a title connection without leaking private book fields", () => {
  const books = [
    { title: "Freedom of Money", status: "Reading" },
    {
      id: "private-id",
      title: "New Current Book",
      author: "Author",
      status: "Reading",
      topics: ["History"],
      note: "PRIVATE_NOTE",
      reader: { documentId: "PRIVATE_DOC" },
    },
    { title: "Wishlist", status: "Want to Read" },
  ] as unknown as Book[];
  const result = explanationEvidence(books, evidence);
  assert.equal(result.length, 3);
  assert.equal(JSON.parse(result[2].text).title, "New Current Book");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|private-id|Wishlist/);
  assert.doesNotThrow(() =>
    validateBookExplanation(
      {
        reason: reason.replaceAll("Freedom of Money", "New Current Book"),
        evidenceIds: ["library-0"],
      },
      result,
    ),
  );
});
test("Explanation supports preserve demo labels and cold starts do not invent a library connection", () => {
  assert.match(
    explanationSupport(["book-0"], evidence)[0],
    /16 sessions.*Includes demo records/,
  );
  assert.doesNotThrow(() =>
    validateBookExplanation(
      {
        reason: reason.replaceAll("Freedom of Money", "Your stated interest"),
        evidenceIds: [],
      },
      [],
    ),
  );
});
test("Generated percentages must be backed by a cited computed comparison", () => {
  const withPercent = reason + " Your logged page pace was 90% faster.";
  const pace = {
    id: "pace-0",
    text: JSON.stringify({ percentChange: 90, summary: "Recorded comparison" }),
  };
  assert.throws(() =>
    validateBookExplanation({ reason: withPercent, evidenceIds: ["book-0"] }, [
      ...evidence,
      pace,
    ]),
  );
  assert.doesNotThrow(() =>
    validateBookExplanation(
      { reason: withPercent, evidenceIds: ["book-0", "pace-0"] },
      [...evidence, pace],
    ),
  );
  assert.throws(() =>
    validateBookExplanation(
      {
        reason: withPercent.replace("90%", "95%"),
        evidenceIds: ["book-0", "pace-0"],
      },
      [...evidence, pace],
    ),
  );
});
test("Plain-text model responses retain book links and numeric validation", () => {
  assert.deepEqual(parseBookExplanation(reason, evidence), {
    reason,
    evidenceIds: ["book-0"],
  });
  assert.throws(() =>
    parseBookExplanation(reason + " You read 90% faster.", evidence),
  );
  assert.deepEqual(
    parseBookExplanation(
      JSON.stringify({ reason, evidenceIds: ["book-0"] }),
      evidence,
    ),
    { reason, evidenceIds: ["book-0"] },
  );
});
