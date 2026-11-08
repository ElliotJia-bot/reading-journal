import { z } from "zod";
import type { Book, ReadingSession, Profile } from "../../shared/domain.js";
import {
  recentRecommendationSessions,
  type RecommendationEvidence,
} from "../../shared/recommendation-evidence.js";

const feature = z.object({
  styles: z
    .array(
      z.enum([
        "dialogue-led",
        "character-driven",
        "reflective",
        "idea-led",
        "adventurous",
      ]),
    )
    .max(5),
  dialoguePercent: z.number().finite().min(0).max(100).optional(),
  averageChapterPages: z.number().finite().positive().max(150).optional(),
  meanSentenceWords: z.number().finite().positive().max(100).optional(),
});
// Admin-seeded, account-private fixtures. Never inferred from a title or promoted
// into the shared catalog, and never used for accounts without this document.
export const demoFeaturesSchema = z.object({
  synthetic: z.literal(true),
  presentationMode: z.boolean().default(false),
  batchId: z.string(),
  library: z.record(z.string(), feature),
  candidates: z.record(z.string(), feature),
});
export type DemoFeatures = z.infer<typeof demoFeaturesSchema>;
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b),
    i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
};

export function bookFitEvidence(
  books: Book[],
  sessions: ReadingSession[],
  profile: Profile,
  candidateId: string,
  features?: DemoFeatures,
  now = Date.now(),
): RecommendationEvidence[] {
  const candidate = features?.candidates[candidateId];
  if (!candidate || !features) return [];
  const language = profile.language || "eng";
  const eligibleBooks = books.filter(
    (b) =>
      b.demoData?.synthetic &&
      (b.language || language) === language &&
      features.library[b.id],
  );
  const rows = recentRecommendationSessions(
    eligibleBooks,
    sessions,
    profile,
    now,
  ).filter(
    (s) =>
      s.demoData?.synthetic &&
      s.source === "manual" &&
      s.unit === "pages" &&
      s.endPosition > s.startPosition &&
      !eligibleBooks.find((b) => b.id === s.bookId)?.reader,
  );
  const totals = (logs: ReadingSession[]) => ({
    sessions: logs.length,
    books: new Set(logs.map((s) => s.bookId)).size,
    minutes: logs.reduce((n, s) => n + s.durationSeconds / 60, 0),
    pages: logs.reduce((n, s) => n + s.endPosition - s.startPosition, 0),
  });
  const enough = (t: ReturnType<typeof totals>) =>
    t.sessions >= 3 && t.books >= 2 && t.minutes >= 30;
  const result: RecommendationEvidence[] = [];
  const add = (
    id: string,
    summary: string,
    numbers: number[],
    values: Record<string, unknown>,
  ) =>
    result.push({
      id: `fit-${id}`,
      text: JSON.stringify({
        synthetic: true,
        summary,
        allowedNumbers: numbers,
        ...values,
      }),
    });
  const matching = eligibleBooks.filter((b) =>
    features.library[b.id].styles.some((s) => candidate.styles.includes(s)),
  );
  const matchedRows = rows.filter((s) =>
    matching.some((b) => b.id === s.bookId),
  );
  const matchTotals = totals(matchedRows);
  const anchor = matching
    .filter((b) => b.status === "Reading")
    .sort(
      (a, b) =>
        rows.filter((s) => s.bookId === b.id).length -
        rows.filter((s) => s.bookId === a.id).length,
    )[0];
  if (anchor)
    add(
      "connection",
      `You are currently reading ${anchor.title}; its shared style features are ${features.library[anchor.id].styles.filter((s) => candidate.styles.includes(s)).join(" and ")}.`,
      [],
      { title: anchor.title, status: anchor.status },
    );

  for (const style of candidate.styles) {
    const ids = new Set(
      eligibleBooks
        .filter((b) => features.library[b.id].styles.includes(style))
        .map((b) => b.id),
    );
    const a = totals(rows.filter((s) => ids.has(s.bookId))),
      b = totals(rows.filter((s) => !ids.has(s.bookId)));
    if (!enough(a) || !enough(b)) continue;
    const percentChange = Math.round(
      (a.pages / a.minutes / (b.pages / b.minutes) - 1) * 100,
    );
    const dialogue =
      style === "dialogue-led" && candidate.dialoguePercent != null
        ? candidate.dialoguePercent
        : null;
    const percentValues = [
      Math.abs(percentChange),
      ...(dialogue == null ? [] : [dialogue]),
    ];
    add(
      "pace",
      `Your ${style} page pace runs ${Math.abs(percentChange)}% ${percentChange >= 0 ? "above" : "below"} your other profiled books over the last 30 days.${dialogue == null ? "" : ` This book has ${dialogue}% dialogue by word count.`}`,
      [...percentValues, 30],
      {
        style,
        percentChange,
        allowedPercents: percentValues,
        rate: a.pages / a.minutes,
        baselineRate: b.pages / b.minutes,
        target: a,
        baseline: b,
        dialoguePercent: dialogue,
      },
    );
    break;
  }
  for (const style of candidate.styles) {
    const resolved = eligibleBooks.filter(
      (b) =>
        features.library[b.id].styles.includes(style) &&
        ["Finished", "Dropped"].includes(b.status) &&
        (b.completedAt || b.droppedAt || 0) <= now,
    );
    if (resolved.length < 3) continue;
    const finished = resolved.filter((b) => b.status === "Finished").length;
    const percent = Math.round((finished / resolved.length) * 100);
    add(
      "completion",
      `You finished ${finished} of ${resolved.length} ${style} books you finished or set aside, a ${percent}% completion rate across your recorded history. This candidate shares that style.`,
      [finished, resolved.length, percent],
      {
        style,
        finished,
        resolved: resolved.length,
        allowedPercents: [percent],
        period:
          "all recorded outcomes; excludes in-progress and wishlist books",
      },
    );
    break;
  }
  if (
    rows.length >= 3 &&
    candidate.averageChapterPages &&
    enough(matchTotals)
  ) {
    const sittingMinutes = Math.round(
      median(rows.map((s) => s.durationSeconds / 60)),
    );
    const chapterMinutes = Math.ceil(
      candidate.averageChapterPages / (matchTotals.pages / matchTotals.minutes),
    );
    add(
      "session",
      `Chapters average ${candidate.averageChapterPages} pages, roughly ${chapterMinutes} minutes at your page pace on books with shared style features. Your typical sitting is ${sittingMinutes} minutes.`,
      [candidate.averageChapterPages, chapterMinutes, sittingMinutes],
      {
        averageChapterPages: candidate.averageChapterPages,
        estimatedChapterMinutes: chapterMinutes,
        medianSittingMinutes: sittingMinutes,
        allowedPercents: [],
        fits: chapterMinutes <= sittingMinutes,
        periodDays: 30,
      },
    );
  }
  const relaxed = eligibleBooks.filter(
    (b) =>
      features.library[b.id].meanSentenceWords &&
      rows.some((s) => s.bookId === b.id && s.reaction === "Relaxing"),
  );
  if (relaxed.length >= 2 && candidate.meanSentenceWords) {
    const baseline = Math.round(
      median(relaxed.map((b) => features.library[b.id].meanSentenceWords!)),
    );
    add(
      "sentences",
      `Sentences average ${candidate.meanSentenceWords} words here, compared with ${baseline} in books you marked Relaxing. This describes sentence length, not comprehension or a personal ability limit.`,
      [candidate.meanSentenceWords, baseline],
      {
        meanSentenceWords: candidate.meanSentenceWords,
        relaxingBooksMedianSentenceWords: baseline,
        allowedPercents: [],
      },
    );
  }
  return result;
}
