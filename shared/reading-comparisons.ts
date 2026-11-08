import type { Book, ReadingSession, Profile } from "./domain.js";
import { genresFor } from "./for-you.js";

// Sessions are already restricted to valid reading in the last 30 local days.
// Compare logged print-page progress only; ebook sections are a different unit.
export function readingComparisons(
  books: Book[],
  sessions: ReadingSession[],
  profile: Profile,
) {
  const rows = sessions.flatMap((s) => {
    const b = books.find((b) => b.id === s.bookId);
    if (
      !b ||
      b.reader ||
      s.source !== "manual" ||
      s.unit !== "pages" ||
      s.durationSeconds <= 180 ||
      s.endPosition <= s.startPosition
    )
      return [];
    const genres = genresFor(b.topics);
    if (!genres.length) return [];
    return [
      {
        bookId: b.id,
        genres,
        language: b.language || profile.language || "unknown",
        synthetic: !!(s.demoData?.synthetic || b.demoData?.synthetic),
        pages: s.endPosition - s.startPosition,
        minutes: s.durationSeconds / 60,
      },
    ];
  });
  const comparisons = [];
  for (const cohort of [
    ...new Set(rows.map((r) => `${r.language}:${r.synthetic}`)),
  ]) {
    const group = rows.filter((r) => `${r.language}:${r.synthetic}` === cohort);
    for (const genre of [...new Set(group.flatMap((r) => r.genres))].sort()) {
      const target = group.filter((r) => r.genres.includes(genre)),
        baseline = group.filter((r) => !r.genres.includes(genre));
      const totals = (items: typeof rows) => ({
        minutes: items.reduce((n, r) => n + r.minutes, 0),
        pages: items.reduce((n, r) => n + r.pages, 0),
        sessions: items.length,
        books: new Set(items.map((r) => r.bookId)).size,
      });
      const a = totals(target),
        b = totals(baseline);
      if (a.sessions < 3 || b.sessions < 3 || a.minutes < 30 || b.minutes < 30)
        continue;
      const rate = a.pages / a.minutes,
        baselineRate = b.pages / b.minutes,
        percentChange = Math.round((rate / baselineRate - 1) * 100);
      const synthetic = target[0].synthetic;
      const summary = `${synthetic ? "Demo records: " : ""}Your logged ${genre} page pace was ${percentChange === 0 ? "about the same as" : `${Math.abs(percentChange)}% ${percentChange > 0 ? "faster" : "slower"} than`} other genres (${rate.toFixed(2)} vs ${baselineRate.toFixed(2)} pages/min; ${a.sessions} sessions across ${a.books} book${a.books === 1 ? "" : "s"} vs ${b.sessions} sessions across ${b.books} book${b.books === 1 ? "" : "s"}, last 30 days).`;
      comparisons.push({
        genre,
        metric: "logged_print_pages_per_minute",
        language: target[0].language,
        synthetic,
        rate,
        baselineRate,
        percentChange,
        sessions: a.sessions,
        books: a.books,
        comparisonSessions: b.sessions,
        comparisonBooks: b.books,
        summary,
        limitation:
          "Self-recorded page progress; page density and book difficulty vary. This is not measured words-per-minute, comprehension or proof of enjoyment.",
      });
    }
  }
  return comparisons
    .sort((a, b) => b.sessions - a.sessions || a.genre.localeCompare(b.genre))
    .slice(0, 12);
}
