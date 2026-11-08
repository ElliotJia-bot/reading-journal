import { dayKey, type Book, type ReadingSession } from "./domain.ts";
import { calendarRange, pagesRead } from "./metrics.ts";
import {
  normalized,
  sameBook,
  type BookMatch,
} from "./book-recommendations.ts";
export type DiscoveryVote = "yes" | "maybe" | "no";
export interface PublicReader {
  id: string;
  displayName: string;
  tier: "Beginner" | "Experienced";
  updatedAt: number;
  topics: string[];
  language: string;
  booksFinished: number;
  pages: number;
  longestMinutes: number;
  growthMinutes: number;
  books: {
    id: string;
    title: string;
    authors: string[];
    subjects: string[];
    cover: string;
    language: string;
    pageCount: number | null;
  }[];
}
// Explicit allowlist. Private notes, email, locations, raw times and private IDs never leave here.
export function readingSummary(
  books: Book[],
  sessions: ReadingSession[],
  now = Date.now(),
) {
  const realBooks = books.filter((b) => !b.demoData?.synthetic);
  const known = new Set(realBooks.map((b) => b.id));
  const real = sessions.filter(
    (s) => !s.demoData?.synthetic && known.has(s.bookId) && s.startedAt <= now,
  );
  const range = new Set(calendarRange(7, "UTC", now)),
    prior = new Set(calendarRange(7, "UTC", now - 7 * 86400000));
  const current = real.filter((s) => range.has(dayKey(s.startedAt, "UTC")));
  const seconds = current.reduce((n, s) => n + s.durationSeconds, 0),
    old = real
      .filter((s) => prior.has(dayKey(s.startedAt, "UTC")))
      .reduce((n, s) => n + s.durationSeconds, 0);
  const liked = new Set(
    real.filter((s) => s.reaction === "Liked it").map((s) => s.bookId),
  );
  const published = realBooks
    .filter((b) => liked.has(b.id) && b.catalogId && b.status !== "Dropped")
    .slice(0, 20);
  return {
    booksFinished: realBooks.filter(
      (b) =>
        b.completedAt &&
        b.completedAt <= now &&
        dayKey(b.completedAt, "UTC").slice(0, 4) ===
          dayKey(now, "UTC").slice(0, 4),
    ).length,
    pages: current.reduce((n, s) => n + (pagesRead(s) ?? 0), 0),
    longestMinutes: Math.round(
      Math.max(0, ...current.map((s) => s.durationSeconds)) / 60,
    ),
    growthMinutes: Math.max(0, Math.round((seconds - old) / 60)),
    books: published.map((b) => ({
      id: b.catalogId!,
      title: b.title,
      authors: b.author ? [b.author] : [],
      subjects: b.topics,
      cover: b.cover,
      language: b.language ?? "eng",
      pageCount: b.totalPages,
    })),
    topics: [...new Set(published.flatMap((b) => b.topics))].slice(0, 12),
  };
}
export function peerMatches(
  readers: PublicReader[],
  uid: string,
  topics: string[],
  language: string,
  owned: Book[],
  hidden: string[],
) {
  const peers = readers.filter(
    (r) =>
      r.id !== uid &&
      r.language === language &&
      r.topics.some((t) =>
        topics.some((own) => normalized(own) === normalized(t)),
      ),
  );
  if (peers.length < 3)
    return { matches: [] as BookMatch[], peerCount: peers.length };
  const counts = new Map<
    string,
    { book: PublicReader["books"][number]; count: number }
  >();
  for (const peer of peers)
    for (const book of new Map(peer.books.map((b) => [b.id, b])).values()) {
      if (
        book.language !== language ||
        hidden.includes(book.id) ||
        owned.some((b) => sameBook(book, b))
      )
        continue;
      const old = counts.get(book.id);
      counts.set(book.id, { book, count: (old?.count ?? 0) + 1 });
    }
  return {
    peerCount: peers.length,
    matches: [...counts.values()]
      .filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ book, count }) => ({
        ...book,
        score: count,
        matchedTopics: book.subjects,
        reason: `Liked by ${count} opted-in readers with at least one topic in common with you.`,
      })),
  };
}
