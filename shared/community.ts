import type { Book, ReadingSession } from "./domain.js";

export const circles = [
  {
    id: "fiction",
    name: "Quiet Fiction Club",
    description:
      "Stories, characters, and thoughtful conversations without the rush.",
    tags: ["Fiction", "Slow Reading"],
    icon: "book-open" as const,
  },
  {
    id: "habit",
    name: "The 10-Minute Reading Habit",
    description:
      "A little reading, a little encouragement. For busy readers and fresh starts.",
    tags: ["Daily Habit", "All Formats"],
    icon: "sunrise" as const,
  },
  {
    id: "philosophy",
    name: "Philosophy & Ideas",
    description:
      "Big questions, one chapter at a time. Beginners warmly welcome.",
    tags: ["Philosophy", "Ideas"],
    icon: "feather" as const,
  },
];
export type Circle = (typeof circles)[number] & {
  joined: boolean;
  memberCount: number;
};
export type PostKind = "checkin" | "question" | "recommendation" | "reflection";
export const kindLabels: Record<PostKind, string> = {
  checkin: "Reading check-in",
  question: "Question",
  recommendation: "Recommendation",
  reflection: "Margin note",
};
export interface SharedBook {
  title: string;
  author: string;
  cover: string;
}
export interface SharedReading {
  durationSeconds?: number;
  progress?: { start: number; end: number; unit: "pages" | "percent" };
}
export interface CommunityPost {
  id: string;
  circleId: string;
  authorId: string;
  authorName: string;
  kind: PostKind;
  title: string;
  body: string;
  book: SharedBook | null;
  reading: SharedReading | null;
  excerpt?: { quote: string; page: number } | null;
  createdAt: number;
  encouragementCount: number;
  commentCount: number;
  encouraged: boolean;
  isOwn: boolean;
}
export interface CommunityComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
  isOwn: boolean;
}
export interface CommunityHome {
  circles: Circle[];
  displayName: string;
  testMode: boolean;
  blockedReaders: { id: string; name: string }[];
}

// Explicit sharing boundary: no private notes, location, source IDs or timestamps.
export function sharedCheckin(
  book: Book,
  session: ReadingSession,
  includeDuration: boolean,
  includeProgress: boolean,
) {
  const reading: SharedReading = {};
  if (includeDuration) reading.durationSeconds = session.durationSeconds;
  if (includeProgress)
    reading.progress = {
      start: session.startPosition,
      end: session.endPosition,
      unit: session.unit,
    };
  return {
    book: { title: book.title, author: book.author, cover: book.cover },
    reading,
  };
}
export function progressLabel(
  progress: NonNullable<SharedReading["progress"]>,
) {
  if (progress.unit === "percent")
    return `${progress.start}% → ${progress.end}%`;
  const delta = progress.end - progress.start;
  return `Pages ${progress.start}–${progress.end}${delta > 0 ? ` (+${delta} pages)` : delta < 0 ? " · revisiting" : ""}`;
}
export function durationLabel(seconds: number) {
  return seconds < 60 ? "Less than 1 min" : `${Math.round(seconds / 60)} min`;
}
