import {
  aggregate,
  dayKey,
  type Book,
  type ReadingSession,
  type Profile,
} from "./domain.js";
import type { FeedbackBook } from "./for-you.js";
export interface RecommendationEvidence {
  id: string;
  text: string;
}
export function recommendationEvidence(
  books: Book[],
  sessions: ReadingSession[],
  profile: Profile,
  feedback: Record<string, FeedbackBook>,
  now = Date.now(),
) {
  const timezone = profile.timezone || "UTC";
  const cutoff = new Date(`${dayKey(now, timezone)}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const known = new Set(books.map((b) => b.id));
  const selected = sessions.filter(
    (s) =>
      known.has(s.bookId) &&
      s.durationSeconds > 180 &&
      s.startedAt <= now &&
      s.endedAt <= now &&
      dayKey(s.startedAt, timezone) >= cutoff.toISOString().slice(0, 10),
  );
  const safeLocations = new Set([
    "Home",
    "Library",
    "Cafe",
    "Café",
    "In Transit",
    "Other",
  ]);
  const safeSessions = selected.map((s) => ({
    ...s,
    location: safeLocations.has(s.location) ? s.location : "Other",
  }));
  const stats = aggregate(safeSessions, books, 30, timezone, now);
  const synthetic = selected.filter(
    (s) =>
      s.demoData?.synthetic ||
      books.find((b) => b.id === s.bookId)?.demoData?.synthetic,
  ).length;
  const evidence: RecommendationEvidence[] = [
    {
      id: "summary",
      text: JSON.stringify({
        periodDays: 30,
        sessions: stats.sessionCount,
        totalMinutes: stats.totalMinutes,
        readingDays: stats.readingDays,
        averageSessionMinutes: stats.averageMinutes,
        syntheticSessions: synthetic,
        syntheticDataIncluded: synthetic > 0,
      }),
    },
    {
      id: "rhythm",
      text: JSON.stringify({
        sessionCountsByTime: stats.times,
        locations: stats.locations,
        topicMinutes: Object.fromEntries(
          Object.entries(stats.topics).map(([k, v]) => [k, Math.round(v / 60)]),
        ),
        explicitLikedTopics: stats.likedTopics,
      }),
    },
  ];
  const ranked = books
    .map((book) => ({
      book,
      logs: selected.filter((s) => s.bookId === book.id),
    }))
    .filter((x) => x.logs.length)
    .sort(
      (a, b) =>
        b.logs.length - a.logs.length ||
        a.book.title.localeCompare(b.book.title),
    )
    .slice(0, 12);
  for (const { book, logs } of ranked) {
    const minutes = Math.round(
      logs.reduce((n, s) => n + s.durationSeconds, 0) / 60,
    );
    const manual = logs.filter(
      (s) => s.source === "manual" && s.unit === "pages" && !book.reader,
    );
    const pages = manual.reduce(
      (n, s) => n + Math.max(0, s.endPosition - s.startPosition),
      0,
    );
    evidence.push({
      id: `book-${evidence.length - 2}`,
      text: JSON.stringify({
        title: book.title,
        author: book.author,
        topics: book.topics,
        status: book.status,
        sessions: logs.length,
        minutes,
        averageSessionMinutes: Math.round(minutes / logs.length),
        likedSessions: logs.filter((s) => s.reaction === "Liked it").length,
        challengingSessions: logs.filter((s) => s.reaction === "Challenging")
          .length,
        dislikedSessions: logs.filter((s) => s.reaction === "Not for me")
          .length,
        stops: Object.fromEntries(
          ["Tired", "Time was up", "Finished chapter", "Lost interest"].map(
            (reason) => [
              reason,
              logs.filter((s) => s.stopReason === reason).length,
            ],
          ),
        ),
        manualForwardPages: pages,
        manualMinutes: Math.round(
          manual.reduce((n, s) => n + s.durationSeconds, 0) / 60,
        ),
        measurementNote: book.reader
          ? "Ebook positions are sections, not print pages. No per-page speed supplied."
          : "Forward page ranges, including rereads; not per-page dwell or comprehension.",
        syntheticSessions: logs.filter(
          (s) => s.demoData?.synthetic || book.demoData?.synthetic,
        ).length,
      }),
    });
  }
  const choices = Object.values(feedback)
    .filter((f) => f.book)
    .map((f) => ({
      choice: f.value,
      title: f.book!.title,
      subjects: f.book!.subjects.slice(0, 8),
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 30);
  evidence.push({ id: "feedback", text: JSON.stringify(choices) });
  return {
    evidence,
    sessionCount: selected.length,
    syntheticSessionCount: synthetic,
  };
}
