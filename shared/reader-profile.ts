import { aggregate, type Book, type ReadingSession } from "./domain.ts";
import { calendarRange } from "./metrics.ts";
import { dayKey } from "./domain.ts";
import type { ReaderTier } from "./leaderboard.ts";
import type { CommunityPost } from "./community.ts";

export interface ProfileBook {
  key: string;
  title: string;
  author: string;
  cover: string;
  status: Book["status"];
  progress: number | null;
}
export interface ProfileHabits {
  sessions: number;
  readingDays: number;
  minutes: number;
  averageMinutes: number;
  favoriteTime: string | null;
  topTopics: string[];
  week: { day: string; minutes: number; today: boolean }[];
}
export interface ReaderProfile {
  id: string;
  displayName: string;
  tier: ReaderTier | null;
  isOwn: boolean;
  sharing: { active: boolean; library: boolean; habits: boolean };
  library: ProfileBook[] | null;
  habits: ProfileHabits | null;
  posts: CommunityPost[];
}
export function profileVisibility(
  own: boolean,
  permission: {
    active?: boolean;
    shareLibrary?: boolean;
    shareHabits?: boolean;
  },
) {
  return {
    library: own || !!(permission.active && permission.shareLibrary),
    habits: own || !!(permission.active && permission.shareHabits),
  };
}

// Never send raw journal entries, private notes, location, timestamps, reader
// documents or source book IDs to a profile visitor.
export function profileContent(
  books: Book[],
  sessions: ReadingSession[],
  timezone: string,
  now = Date.now(),
  includeDemo = false,
) {
  const visible = books.filter((b) => includeDemo || !b.demoData?.synthetic);
  const known = new Set(visible.map((b) => b.id));
  const valid = sessions.filter(
    (s) =>
      known.has(s.bookId) &&
      (includeDemo || !s.demoData?.synthetic) &&
      Number.isFinite(s.durationSeconds) &&
      s.durationSeconds > 180 &&
      s.startedAt <= now &&
      s.endedAt <= now &&
      s.endedAt >= s.startedAt &&
      s.durationSeconds * 1000 <= s.endedAt - s.startedAt + 1000,
  );
  const stats = aggregate(valid, visible, 30, timezone, now);
  const time = Object.entries(stats.times)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const week = calendarRange(7, timezone, now);
  const today = dayKey(now, timezone);
  const habits: ProfileHabits = {
    sessions: stats.sessionCount,
    readingDays: stats.readingDays,
    minutes: Math.round(stats.totalMinutes),
    averageMinutes: Math.round(stats.averageMinutes),
    favoriteTime: time[0]?.[0] ?? null,
    topTopics: Object.entries(stats.topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t),
    week: week.map((d) => ({
      day: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${d}T12:00:00Z`)),
      minutes: Math.round((stats.daily[d] ?? 0) / 60),
      today: d === today,
    })),
  };
  const library: ProfileBook[] = [...visible]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((b, i) => {
      const total = b.unit === "percent" ? 100 : b.totalPages;
      return {
        key: `book-${i}`,
        title: b.title,
        author: b.author,
        cover: b.cover,
        status: b.status,
        progress:
          b.status === "Finished"
            ? 100
            : total && Number.isFinite(b.position)
              ? Math.max(
                  0,
                  Math.min(100, Math.round((b.position / total) * 100)),
                )
              : null,
      };
    });
  return { library, habits };
}
