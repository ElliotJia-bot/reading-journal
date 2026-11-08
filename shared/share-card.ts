// Layout only: no network, account identifiers, or reading telemetry enters a card.
export interface ShareCardContent {
  name: string;
  date: number;
  thought: string;
  bookTitle: string;
  bookAuthor: string;
}
export function wrapCardText(
  text: string,
  width: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
      if (line && measure(line + token) > width) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (!line && !token.trim()) continue;
      for (const { segment } of segmenter.segment(token)) {
        if (line && measure(line + segment) > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        if (line || segment.trim()) line += segment;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export function cardTextPages(
  text: string,
  width: number,
  height: number,
  measure: (text: string, size: number) => number,
) {
  for (const size of [52, 48, 44, 40, 36]) {
    const lineHeight = size * 1.5;
    let lines = wrapCardText(text, width, (line) => measure(line, size));
    const perPage = Math.max(1, Math.floor(height / lineHeight));
    if (size === 36 && lines.length > perPage * 6) {
      // Reflow unusually newline-heavy notes rather than allocate dozens of images.
      // All words/graphemes are retained; only whitespace is condensed.
      lines = wrapCardText(text.replace(/\s+/gu, " ").trim(), width, (line) =>
        measure(line, size),
      );
    }
    if (lines.length <= perPage || size === 36) {
      const pages: string[][] = [];
      for (let offset = 0; offset < lines.length; offset += perPage)
        pages.push(lines.slice(offset, offset + perPage));
      return { size, lineHeight, pages };
    }
  }
  throw new Error("Unable to lay out this reflection.");
}
