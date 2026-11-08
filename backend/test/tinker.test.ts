import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInsights } from "../src/tinker.js";

test("Normalizes model envelope variants and rejects unknown evidence", async (t) => {
  const cards = ["habit", "interest", "suggestion"].map((kind) => ({
    kind, title: "Small sample", body: "One session is a starting point.", evidenceIds: ["summary"],
  }));
  let content = JSON.stringify(cards);
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), { status: 200 }));
  const evidence = [{ id: "summary", text: "One session" }];
  assert.equal((await generateInsights(evidence, "Read more", "test-key")).cards.length, 3);
  content = JSON.stringify({ cards });
  assert.equal((await generateInsights(evidence, "Read more", "test-key")).cards.length, 3);
  content = JSON.stringify({ cards: cards.map((card) => ({ ...card, evidenceIds: ["invented"] })) });
  await assert.rejects(generateInsights(evidence, "Read more", "test-key"), /TINKER_INVALID_EVIDENCE/);
  content = "not valid JSON";
  await assert.rejects(generateInsights(evidence, "Read more", "test-key"), /TINKER_INVALID_RESPONSE/);
});
