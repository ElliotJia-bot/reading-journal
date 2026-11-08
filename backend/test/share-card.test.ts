import { test } from "node:test";
import assert from "node:assert/strict";
import { cardTextPages, wrapCardText } from "../../shared/share-card.js";
const graphemes = (s: string) => [
  ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s),
];
const measure = (s: string, size: number) => graphemes(s).length * size;
const compact = (s: string) => s.replace(/\s/gu, "");
test("Share cards keep complete English/CJK reflections and fit the available area", () => {
  for (const thought of [
    "A quiet library brings me back to the stories I love.",
    "这是关于阅读与成长的感想。".repeat(85).slice(0, 1200),
    "word ".repeat(240),
    "一\n".repeat(600),
  ]) {
    const layout = cardTextPages(thought, 904, 260, measure);
    assert.equal(compact(layout.pages.flat().join("")), compact(thought));
    for (const page of layout.pages) {
      assert.ok(page.length * layout.lineHeight <= 260);
      assert.ok(page.every((line) => measure(line, layout.size) <= 904));
    }
  }
});
test("Wrapping preserves composed emoji and combining accents", () => {
  const text = "👨‍👩‍👧‍👦 café e\u0301 🏳️‍🌈 ".repeat(20);
  const lines = wrapCardText(text, 150, (s) => measure(s, 30));
  assert.equal(compact(lines.join("")), compact(text));
  assert.ok(
    lines.every(
      (line) =>
        !line.startsWith("\u200d") &&
        !line.endsWith("\u200d") &&
        !line.startsWith("\u0301"),
    ),
  );
});
