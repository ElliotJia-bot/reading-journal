import { dayKey, type Book, type ReadingSession } from "./domain.ts";
import { calendarRange } from "./metrics.ts";

export type ReaderTier = "Beginner" | "Experienced";
export interface LeaderboardParticipation {
  active: boolean;
  shareLibrary?: boolean;
  shareHabits?: boolean;
  displayName: string;
  tier: ReaderTier;
}
export interface LeaderboardReader {
  id: string;
  displayName: string;
  tier: ReaderTier;
  booksFinished: number;
  bestDayPages: number;
  growthMinutes: number;
  longestMinutes: number;
}
export interface LeaderboardData {
  readers: LeaderboardReader[];
  participation: LeaderboardParticipation;
  generatedAt: number;
  limit: number;
}
export const leaderboardCategories = [
  {
    id: "booksFinished",
    title: "Most Books Read",
    unit: "books",
    description: "Books finished this year.",
  },
  {
    id: "bestDayPages",
    title: "Most Pages in a Day",
    unit: "pages",
    description: "Your best single day in the past 7 days.",
  },
  {
    id: "growthMinutes",
    title: "Rising Stars",
    unit: "min",
    description:
      "Extra reading minutes this week compared with the previous 7 days.",
  },
  {
    id: "longestMinutes",
    title: "Longest Reading Session",
    unit: "min",
    description: "Your longest active reading session in the past 7 days.",
  },
] as const;
export type LeaderboardMetric = (typeof leaderboardCategories)[number]["id"];

// Only aggregate values cross the public boundary. Each reader's calendar uses
// their saved timezone. Demo records are admitted only by an admin-owned flag.
export function leaderboardSummary(
  books: Book[],
  sessions: ReadingSession[],
  now = Date.now(),
  timezone = "UTC",
  includeDemo = false,
) {
  const eligibleBooks = books.filter(
    (b) => includeDemo || !b.demoData?.synthetic,
  );
  const known = new Map(eligibleBooks.map((b) => [b.id, b]));
  const valid = sessions.filter(
    (s) =>
      known.has(s.bookId) &&
      (includeDemo || !s.demoData?.synthetic) &&
      Number.isFinite(s.durationSeconds) &&
      s.durationSeconds > 180 &&
      s.durationSeconds <= 86400 &&
      s.startedAt <= now &&
      s.endedAt <= now &&
      s.endedAt >= s.startedAt &&
      s.durationSeconds * 1000 <= s.endedAt - s.startedAt + 1000,
  );
  const fourteen = calendarRange(14, timezone, now),
    current = new Set(fourteen.slice(-7)),
    previous = new Set(fourteen.slice(0, 7));
  const recent = valid.filter((s) =>
    current.has(dayKey(s.startedAt, timezone)),
  );
  const oldSeconds = valid
    .filter((s) => previous.has(dayKey(s.startedAt, timezone)))
    .reduce((n, s) => n + s.durationSeconds, 0);
  const daily = new Map<string, number>();
  for (const s of recent) {
    const b = known.get(s.bookId)!;
    // A cross-midnight session cannot attribute its page turns to either day.
    if (
      s.unit !== "pages" ||
      b.reader ||
      s.endPosition <= s.startPosition ||
      !Number.isFinite(s.startPosition) ||
      !Number.isFinite(s.endPosition) ||
      s.startPosition < 0 ||
      (b.totalPages != null && s.endPosition > b.totalPages) ||
      dayKey(s.startedAt, timezone) !== dayKey(s.endedAt, timezone)
    )
      continue;
    const day = dayKey(s.startedAt, timezone);
    daily.set(day, (daily.get(day) ?? 0) + s.endPosition - s.startPosition);
  }
  return {
    booksFinished: eligibleBooks.filter(
      (b) =>
        b.status === "Finished" &&
        b.completedAt &&
        b.completedAt <= now &&
        dayKey(b.completedAt, timezone).slice(0, 4) ===
          dayKey(now, timezone).slice(0, 4),
    ).length,
    bestDayPages: Math.max(0, ...daily.values()),
    growthMinutes: Math.max(
      0,
      Math.round(
        (recent.reduce((n, s) => n + s.durationSeconds, 0) - oldSeconds) / 60,
      ),
    ),
    longestMinutes: Math.round(
      Math.max(0, ...recent.map((s) => s.durationSeconds)) / 60,
    ),
  };
}

export function rankReaders(
  readers: LeaderboardReader[],
  tier: ReaderTier,
  metric: LeaderboardMetric,
) {
  const sorted = readers
    .filter(
      (r) => r.tier === tier && Number.isFinite(r[metric]) && r[metric] > 0,
    )
    .sort(
      (a, b) =>
        b[metric] - a[metric] ||
        a.displayName.localeCompare(b.displayName) ||
        a.id.localeCompare(b.id),
    );
  return sorted.map((r, index) => ({
    ...r,
    rank:
      index && sorted[index - 1][metric] === r[metric]
        ? sorted.findIndex((x) => x[metric] === r[metric]) + 1
        : index + 1,
  }));
}
