import type { Book, ReadingSession } from "./domain.ts";
import type { PageVisit } from "./reader.ts";
import { pagePace } from "./reading-insights.ts";

const median = (values: number[]) => {
  const n = [...values].sort((a, b) => a - b);
  return n.length
    ? (n[Math.floor(n.length / 2)] + n[Math.floor((n.length - 1) / 2)]) / 2
    : 0;
};
export function validBookSessions(
  book: Book,
  sessions: ReadingSession[],
  now = Date.now(),
) {
  return sessions.filter(
    (s) =>
      s.bookId === book.id &&
      Number.isFinite(s.durationSeconds) &&
      s.durationSeconds > 180 &&
      Number.isFinite(s.startedAt) &&
      Number.isFinite(s.endedAt) &&
      s.startedAt <= s.endedAt &&
      s.endedAt <= now &&
      s.durationSeconds * 1000 <= s.endedAt - s.startedAt + 1000,
  );
}
export function readingClock(
  book: Book,
  sessions: ReadingSession[],
  timezone: string,
  now = Date.now(),
) {
  const own = validBookSessions(book, sessions, now);
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    minutes: 0,
    sessions: 0,
  }));
  for (const s of own) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(s.startedAt),
    );
    hours[hour].minutes += s.durationSeconds / 60;
    hours[hour].sessions++;
  }
  const windows = hours.map((h, i) => ({
    start: i,
    minutes: h.minutes + hours[(i + 1) % 24].minutes,
    sessions: h.sessions + hours[(i + 1) % 24].sessions,
  }));
  const peak = windows.sort(
    (a, b) =>
      b.minutes - a.minutes || b.sessions - a.sessions || a.start - b.start,
  )[0];
  return {
    hours,
    minutes: own.reduce((n, s) => n + s.durationSeconds / 60, 0),
    sessions: own.length,
    peak: peak.sessions >= 3 ? peak : null,
  };
}
export function hourLabel(hour: number) {
  const h = hour % 24;
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}
export type SlowdownPoint = {
  key: string;
  start: number;
  end: number;
  relative: number | null;
  seconds: number;
  page: number | null;
  sessionIds: string[];
  reactions: string[];
  reason: string;
  nextStep: string;
};
export type SlowdownRange = SlowdownPoint & { pages: number[] };
export function slowdownOverview(
  book: Book,
  sessions: ReadingSession[],
  visits: PageVisit[] = [],
  now = Date.now(),
) {
  const own = validBookSessions(book, sessions, now),
    ids = new Set(own.map((s) => s.id));
  const scoped = visits.filter(
    (v) =>
      ids.has(v.sessionId) &&
      v.documentId === book.reader?.documentId &&
      v.activeMs > 0 &&
      v.endedAt <= now,
  );
  let points: SlowdownPoint[];
  if (book.reader) {
    points = pagePace(scoped).map((r) => ({
      key: `page-${r.page}`,
      start: r.page + 1,
      end: r.page + 1,
      relative: r.relative,
      seconds: r.averageMs / 1000,
      page: r.page,
      sessionIds: [
        ...new Set(
          scoped.filter((v) => v.page === r.page).map((v) => v.sessionId),
        ),
      ],
      reactions: r.reactions,
      reason: "",
      nextStep: "",
    }));
  } else {
    const measured = own.filter(
      (s) =>
        s.unit === "pages" &&
        s.endPosition > s.startPosition &&
        s.startPosition >= 0 &&
        (!book.totalPages || s.endPosition <= book.totalPages),
    );
    points = measured
      .map((s) => {
        const seconds = s.durationSeconds / (s.endPosition - s.startPosition),
          others = measured
            .filter((v) => v.id !== s.id)
            .map((v) => v.durationSeconds / (v.endPosition - v.startPosition)),
          base = others.length >= 3 ? median(others) : null;
        const [reason, nextStep] =
          s.reaction === "Liked it"
            ? [
                "You enjoyed this sitting; the extra time may reflect interest.",
                "Save one idea you want to return to.",
              ]
            : s.reaction === "Challenging"
              ? [
                  "You marked this sitting as challenging.",
                  "Try a shorter stretch and summarize one idea.",
                ]
              : s.stopReason === "Tired"
                ? [
                    "You ended this sitting feeling tired.",
                    "Return to this passage after a short break.",
                  ]
                : s.stopReason === "Distracted"
                  ? [
                      "You noted distractions during this sitting.",
                      "Try a quieter setting for the next stretch.",
                    ]
                  : [
                      "This stretch took more time per page than your other sittings.",
                      "Note whether you were reflecting, rereading or interrupted.",
                    ];
        return {
          key: s.id,
          start: s.startPosition,
          end: s.endPosition,
          relative: base ? seconds / base : null,
          seconds,
          page: null,
          sessionIds: [s.id],
          reactions: [s.reaction].filter(Boolean),
          reason,
          nextStep,
        };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }
  const groups: SlowdownRange[] = [];
  for (const p of points.filter(
    (p) => p.relative !== null && p.relative >= 1.5,
  )) {
    const previous = groups.at(-1);
    // Only adjacent measured ebook pages form a passage. Separate manual sittings
    // and gaps must never be turned into invented continuous page measurements.
    if (book.reader && previous && previous.end + 1 === p.start) {
      previous.end = p.end;
      previous.pages.push(p.page!);
      if (p.relative! > previous.relative!) {
        previous.relative = p.relative;
        previous.page = p.page;
        previous.seconds = p.seconds;
        previous.reactions = p.reactions;
      }
      previous.sessionIds = [
        ...new Set([...previous.sessionIds, ...p.sessionIds]),
      ];
    } else groups.push({ ...p, pages: p.page === null ? [] : [p.page] });
  }
  return {
    points,
    ranges: groups.sort((a, b) => b.relative! - a.relative!).slice(0, 3),
    source: book.reader ? ("reader" as const) : ("manual" as const),
    comparable: points.filter((p) => p.relative !== null).length,
  };
}
export function rangeLabel(start: number, end: number) {
  return start === end ? `Page ${start}` : `Pages ${start}–${end}`;
}

export type RhythmDirection = "quicker" | "longer";
export type RhythmRange = SlowdownRange & { direction: RhythmDirection };

// Keep the comparison on time, not inferred reading speed or comprehension.
export function readingRhythmOverview(
  book: Book,
  sessions: ReadingSession[],
  visits: PageVisit[] = [],
  now = Date.now(),
) {
  const data = slowdownOverview(book, sessions, visits, now);
  const groups: { direction: RhythmDirection; points: SlowdownPoint[] }[] = [];
  for (const point of data.points) {
    const direction =
      point.relative !== null && point.relative >= 1.5
        ? "longer"
        : point.relative !== null && point.relative <= 0.9
          ? "quicker"
          : null;
    if (!direction) continue;
    const previous = groups.at(-1);
    if (
      book.reader &&
      previous?.direction === direction &&
      previous.points.at(-1)!.end + 1 === point.start
    ) {
      previous.points.push(point);
    } else groups.push({ direction, points: [point] });
  }
  const ranges: RhythmRange[] = groups
    // A brief, isolated ebook page is not a sustained quicker stretch.
    .filter((g) => !book.reader || g.direction === "longer" || g.points.length >= 3)
    .map(({ direction, points }) => {
      const relative = points.reduce((n, p) => n + p.relative!, 0) / points.length;
      const representative = [...points].sort(
        (a, b) => Math.abs(a.relative! - relative) - Math.abs(b.relative! - relative),
      )[0];
      return {
        ...representative,
        key: `${direction}-${points[0].key}`,
        start: points[0].start,
        end: points.at(-1)!.end,
        relative,
        direction,
        pages: points.flatMap((p) => p.page === null ? [] : [p.page]),
        sessionIds: [...new Set(points.flatMap((p) => p.sessionIds))],
        ...(direction === "quicker" && representative.page === null
          ? {
              reason: representative.reactions.includes("Liked it")
                ? "You enjoyed this sitting and spent less time per page."
                : representative.reactions.includes("Challenging")
                  ? "You marked this sitting challenging despite spending less time per page."
                  : "You moved through these pages more quickly than your usual rhythm.",
              nextStep: "Recall one idea before moving on.",
            }
          : {}),
      };
    });
  const strongest = (direction: RhythmDirection) =>
    ranges.filter((r) => r.direction === direction).sort((a, b) =>
      direction === "quicker"
        ? a.relative! - b.relative! || a.start - b.start
        : b.relative! - a.relative! || a.start - b.start,
    )[0];
  return {
    ...data,
    ranges: [strongest("quicker"), strongest("longer")].filter(
      (r): r is RhythmRange => !!r,
    ),
  };
}

export function rhythmDifference(range: Pick<RhythmRange, "relative" | "direction">) {
  const difference = Math.round(Math.abs(range.relative! - 1) * 100);
  return `${difference}% ${range.direction === "quicker" ? "less" : "more"} time`;
}
