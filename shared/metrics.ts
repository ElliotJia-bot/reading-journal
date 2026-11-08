import { dayKey, type Book, type ReadingSession } from "./domain.ts";

export function dateShift(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function calendarRange(
  days: number,
  timezone: string,
  now = Date.now(),
  since?: number,
) {
  const end = dayKey(now, timezone);
  const start = days
    ? dateShift(end, 1 - days)
    : since
      ? dayKey(since, timezone)
      : end;
  const result: string[] = [];
  for (
    let key = start;
    key <= end && result.length < 3660;
    key = dateShift(key, 1)
  )
    result.push(key);
  return result;
}
// Forward progress, not unique pages or verified comprehension. Rereads never subtract.
export function pagesRead(session: ReadingSession) {
  return session.unit === "pages"
    ? Math.max(0, session.endPosition - session.startPosition)
    : null;
}
export function sessionDays(
  sessions: ReadingSession[],
  timezone: string,
  now = Date.now(),
) {
  const daily: Record<
    string,
    { seconds: number; pages: number; sessions: ReadingSession[] }
  > = {};
  for (const s of sessions.filter((s) => s.startedAt <= now)) {
    const key = dayKey(s.startedAt, timezone);
    const day = (daily[key] ??= { seconds: 0, pages: 0, sessions: [] });
    day.seconds += s.durationSeconds;
    day.pages += pagesRead(s) ?? 0;
    day.sessions.push(s);
  }
  return daily;
}
function weekStart(day: string) {
  return dateShift(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export function homeMetrics(
  sessions: ReadingSession[],
  books: Book[],
  timezone: string,
  now = Date.now(),
) {
  const daily = sessionDays(sessions, timezone, now);
  const today = dayKey(now, timezone),
    start = weekStart(today);
  const qualifying = Object.keys(daily)
    .filter((d) => daily[d].seconds > 180)
    .sort();
  let best = 0,
    run = 0,
    previous = "";
  for (const day of qualifying) {
    run = previous === dateShift(day, -1) ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  const active = new Set(qualifying);
  let current = 0,
    cursor = active.has(today) ? today : dateShift(today, -1);
  while (active.has(cursor)) {
    current++;
    cursor = dateShift(cursor, -1);
  }
  const sum = (from: string, to: string, field: "seconds" | "pages") =>
    Object.entries(daily).reduce(
      (n, [d, v]) => n + (d >= from && d <= to ? v[field] : 0),
      0,
    );
  const seconds = sum(start, today, "seconds"),
    prior = sum(dateShift(start, -7), dateShift(today, -7), "seconds");
  const weeks: Record<string, number> = {};
  for (const [d, v] of Object.entries(daily))
    weeks[weekStart(d)] = (weeks[weekStart(d)] ?? 0) + v.pages;
  return {
    currentStreak: current,
    bestStreak: best,
    minutes: Math.round(seconds / 6) / 10,
    previousMinutes: Math.round(prior / 6) / 10,
    changePercent: prior ? Math.round(((seconds - prior) / prior) * 100) : null,
    pages: sum(start, today, "pages"),
    bestWeeklyPages: Math.max(0, ...Object.values(weeks)),
    booksThisYear: books.filter(
      (b) =>
        b.completedAt &&
        b.completedAt <= now &&
        dayKey(b.completedAt, timezone).slice(0, 4) === today.slice(0, 4),
    ).length,
    undatedFinished: books.filter(
      (b) => b.status === "Finished" && !b.completedAt,
    ).length,
    weekStart: start,
  };
}
export function finishEstimate(book: Book, sessions: ReadingSession[]) {
  if (!book.totalPages || book.unit !== "pages" || book.status === "Finished")
    return null;
  const sample = sessions.filter(
    (s) =>
      s.bookId === book.id &&
      s.durationSeconds > 180 &&
      (pagesRead(s) ?? 0) > 0,
  );
  const pages = sample.reduce((n, s) => n + (pagesRead(s) ?? 0), 0);
  if (sample.length < 3 || pages < 10) return null;
  const seconds = sample.reduce((n, s) => n + s.durationSeconds, 0);
  return {
    minutes: Math.round(
      (Math.max(0, book.totalPages - book.position) * seconds) / pages / 60,
    ),
    sample: sample.length,
  };
}
export function editedTiming(
  original: ReadingSession | undefined,
  durationText: string,
  dateText: string,
  initialDuration: string,
  initialDate: string,
) {
  const durationSeconds =
    original && durationText === initialDuration
      ? original.durationSeconds
      : Math.round(Number(durationText) * 60);
  const startedAt =
    original && dateText === initialDate
      ? original.startedAt
      : new Date(dateText.replace(" ", "T")).getTime();
  const endedAt =
    original && durationText === initialDuration && dateText === initialDate
      ? original.endedAt
      : startedAt + durationSeconds * 1000;
  return { durationSeconds, startedAt, endedAt };
}
