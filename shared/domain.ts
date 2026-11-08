export type BookStatus = "Reading" | "Want to Read" | "Finished" | "Dropped";
export type PositionUnit = "pages" | "percent";
export interface Book {
  cloudEbook?: boolean;
  reader?: { documentId: string; pageCount: number };
  catalogId?: string;
  language?: string;
  completedAt?: number | null;
  droppedAt?: number | null;
  dropReason?: string;
  statusHistory?: { status: BookStatus; at: number; reason: string }[];
  demoData?: { synthetic?: boolean; batchId?: string };
  id: string;
  title: string;
  author: string;
  cover: string;
  isbn: string;
  totalPages: number | null;
  unit: PositionUnit;
  baselinePosition: number;
  position: number;
  furthestPosition: number;
  status: BookStatus;
  topics: string[];
  createdAt: number;
  updatedAt: number;
}
export interface ReadingSession {
  demoData?: { synthetic?: boolean; batchId?: string };
  id: string;
  bookId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  startPosition: number;
  endPosition: number;
  unit: PositionUnit;
  location: string;
  reaction: string;
  stopReason: string;
  topics: string[];
  note: string;
  source: "manual" | "chrome" | "reader" | "bookmark";
  createdAt: number;
  updatedAt: number;
}
export interface Profile {
  language?: string;
  goal: string;
  timezone: string;
  topics: string[];
}
export function editableBook(book: Book, changes: Partial<Book> = {}) {
  const b = { ...book, ...changes };
  return {
    title: b.title,
    author: b.author,
    cover: b.cover,
    isbn: b.isbn,
    totalPages: b.totalPages,
    unit: b.unit,
    baselinePosition: b.baselinePosition,
    status: b.status,
    topics: b.topics,
    reader: b.reader,
    catalogId: b.catalogId,
    language: b.language,
    dropReason: b.dropReason,
  };
}
export interface InsightCard {
  kind: "habit" | "interest" | "suggestion";
  title: string;
  body: string;
  evidenceIds: string[];
}
export interface InsightReport {
  id: string;
  generatedAt: number;
  period: number;
  cards: InsightCard[];
  evidence: { id: string; text: string }[];
  model: string;
  fingerprint: string;
}

export function dayKey(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function aggregate(
  sessions: ReadingSession[],
  books: Book[],
  days: number,
  timezone: string,
  now = Date.now(),
) {
  // Calendar-day filters use the reader's timezone, including DST transitions.
  const today = dayKey(now, timezone);
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(0, days - 1));
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  const selected = sessions.filter(
    (s) =>
      s.startedAt <= now &&
      (!days || dayKey(s.startedAt, timezone) >= cutoffDay),
  );
  const daily: Record<string, number> = {};
  const locations: Record<
    string,
    { count: number; seconds: number; averageMinutes: number }
  > = {};
  const topics: Record<string, number> = {};
  const likedTopics: Record<string, number> = {};
  const authors: Record<
    string,
    { seconds: number; sessions: number; liked: number }
  > = {};
  const times: Record<string, number> = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    "Late night": 0,
  };
  let totalSeconds = 0;
  for (const session of selected) {
    totalSeconds += session.durationSeconds;
    const day = dayKey(session.startedAt, timezone);
    daily[day] = (daily[day] ?? 0) + session.durationSeconds;
    if (session.location) {
      const location = locations[session.location] ?? {
        count: 0,
        seconds: 0,
        averageMinutes: 0,
      };
      location.count += 1;
      location.seconds += session.durationSeconds;
      location.averageMinutes =
        Math.round(location.seconds / location.count / 6) / 10;
      locations[session.location] = location;
    }
    const book = books.find((book) => book.id === session.bookId);
    if (book?.author) {
      const author = authors[book.author] ?? {
        seconds: 0,
        sessions: 0,
        liked: 0,
      };
      author.seconds += session.durationSeconds;
      author.sessions++;
      if (session.reaction === "Liked it") author.liked++;
      authors[book.author] = author;
    }
    const tags = [
      ...new Set(session.topics.length ? session.topics : (book?.topics ?? [])),
    ];
    for (const tag of tags) {
      topics[tag] = (topics[tag] ?? 0) + session.durationSeconds / tags.length;
      if (session.reaction === "Liked it")
        likedTopics[tag] = (likedTopics[tag] ?? 0) + 1;
    }
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(session.startedAt),
    );
    const time =
      hour < 6
        ? "Late night"
        : hour < 12
          ? "Morning"
          : hour < 18
            ? "Afternoon"
            : "Evening";
    times[time] += 1;
  }
  return {
    days,
    timezone,
    sessionCount: selected.length,
    readingDays: Object.keys(daily).length,
    totalMinutes: Math.round(totalSeconds / 6) / 10,
    averageMinutes: selected.length
      ? Math.round(totalSeconds / selected.length / 6) / 10
      : 0,
    daily,
    locations,
    topics,
    likedTopics,
    authors,
    times,
  };
}

export function elapsedSeconds(
  timer: { accumulatedSeconds: number; runningSince: number | null },
  now = Date.now(),
) {
  return (
    timer.accumulatedSeconds +
    (timer.runningSince === null
      ? 0
      : Math.max(0, Math.floor((now - timer.runningSince) / 1000)))
  );
}

export function deriveProgress(book: Book, sessions: ReadingSession[]) {
  const matching = sessions
    .filter((s) => s.bookId === book.id)
    .sort((a, b) => b.endedAt - a.endedAt || b.id.localeCompare(a.id));
  return {
    position: matching[0]?.endPosition ?? book.baselinePosition,
    furthestPosition: Math.max(
      book.baselinePosition,
      ...matching.map((s) => s.endPosition),
    ),
  };
}

// Advance calendar dates, not 24-hour timestamps: DST must not skip a column.
export function readingWeek(
  daily: Record<string, number>,
  timezone: string,
  now = Date.now(),
) {
  const today = dayKey(now, timezone);
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 6);
  return Array.from({ length: 7 }, () => {
    const key = date.toISOString().slice(0, 10);
    const seconds = Math.max(0, daily[key] ?? 0);
    const day = {
      key,
      seconds,
      isToday: key === today,
      weekday: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      date: new Intl.DateTimeFormat("en-US", {
        month: "numeric",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
      fullDate: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
    };
    date.setUTCDate(date.getUTCDate() + 1);
    return day;
  });
}
