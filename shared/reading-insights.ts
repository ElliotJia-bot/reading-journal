import { aggregate, type Book, type ReadingSession } from "./domain.ts";
import { summarizePages, textFeatures, type PageVisit } from "./reader.ts";

export function pagePace(visits: PageVisit[]) {
  const rows = summarizePages(visits).map((row) => {
    const sessionCount = new Set(
      visits.filter((v) => v.page === row.page).map((v) => v.sessionId),
    ).size;
    return { ...row, sessionCount, averageMs: row.activeMs / sessionCount };
  });
  return rows.map((row) => {
    // Compare equal amounts of text, averaging repeated sessions rather than
    // mistaking a book revisited many times for a slow passage.
    const rates = rows
      .filter(
        (p) =>
          p.page !== row.page && p.averageMs >= 10000 && p.characters > 100,
      )
      .map((p) => p.averageMs / p.characters)
      .sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    const baseline =
      rates.length >= 3
        ? (rates[mid] + rates[Math.floor((rates.length - 1) / 2)]) / 2
        : null;
    const relative =
      baseline && row.averageMs >= 10000 && row.characters > 100
        ? row.averageMs / row.characters / baseline
        : null;
    return {
      ...row,
      baseline,
      comparablePages: rates.length,
      relative,
      slower: relative !== null && relative >= 1.5,
    };
  });
}
export type PagePace = ReturnType<typeof pagePace>[number];
export function durationLabel(seconds: number) {
  const value = Math.round(seconds);
  return value >= 60
    ? `${Math.floor(value / 60)}m${value % 60 ? ` ${value % 60}s` : ""}`
    : `${value}s`;
}
export function passageClue(text: string, reactions: string[]) {
  const features = textFeatures(text);
  if (reactions.includes("Enjoyed"))
    return {
      title: "Something held your interest",
      body: "You marked this page Enjoyed. More time here may reflect interest or savoring.",
      evidence: "Your page feedback",
      next: "Save the line you want to return to.",
    };
  if (reactions.includes("Rereading"))
    return {
      title: "You returned to the passage",
      body: "You marked this page Rereading. Revisiting contributes to the time shown.",
      evidence: "Your page feedback",
      next: "Write a one-sentence takeaway before moving on.",
    };
  if (!features.hasCjk && features.averageWordsPerSentence >= 25)
    return {
      title: "Longer sentences",
      body: "Long clauses may take another pass to connect.",
      evidence: `${features.averageWordsPerSentence} words per sentence in this passage`,
      next: "Pause at each clause, then paraphrase one sentence.",
    };
  if (!features.hasCjk && (features.longEnglishWordPercent ?? 0) >= 25)
    return {
      title: "Longer vocabulary",
      body: "Long words may invite a closer look; word length alone does not mean difficulty.",
      evidence: `${features.longEnglishWordPercent}% of English words have 8+ letters`,
      next: "Pick one unfamiliar word and reread it in context.",
    };
  if (reactions.includes("Difficult"))
    return {
      title: "You found this challenging",
      body: "You marked this page Difficult. Timing alone cannot identify the cause.",
      evidence: "Your page feedback",
      next: "Choose one sentence and put it into your own words.",
    };
  return {
    title: "A moment worth exploring",
    body: "Time here may include interest, rereading or a pause. Text analysis can offer more clues.",
    evidence: "No clear cause from timing alone",
    next: "Note what kept you on this page.",
  };
}

export function behavioralSuggestions(
  book: Book,
  sessions: ReadingSession[],
  timezone: string,
) {
  const own = sessions.filter(
    (s) => s.bookId === book.id && s.durationSeconds > 180,
  );
  if (own.length < 3)
    return [
      {
        title: "Start with a small session",
        action: "Try 10 minutes with this book, then note how it felt.",
        evidence: `${own.length} sessions over 3 minutes · 3 needed for a pattern`,
      },
    ];
  const stats = aggregate(own, [book], 0, timezone);
  const minutes = own.map((s) => s.durationSeconds / 60).sort((a, b) => a - b);
  const target = Math.max(
    5,
    Math.min(60, Math.round(minutes[Math.floor(minutes.length / 2)] / 5) * 5),
  );
  const suggestions = [
    {
      title: "Keep a comfortable session length",
      action: `Try another ${target}-minute session with this book.`,
      evidence: `Typical session: ${Math.round(minutes[Math.floor(minutes.length / 2)])} min · ${own.length} sessions`,
    },
  ];
  const time = Object.entries(stats.times).sort((a, b) => b[1] - a[1])[0];
  if (time[1] >= 3)
    suggestions.push({
      title: `Make room in the ${time[0].toLowerCase()}`,
      action: "Try your next chapter in this familiar reading window.",
      evidence: `${time[1]} of ${own.length} sessions in this time window`,
    });
  const place = Object.entries(stats.locations)
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)[0];
  if (place)
    suggestions.push({
      title: `Return to ${place[0]}`,
      action: "Try this setting again and see how the session feels.",
      evidence: `${place[1].count} sessions · ${place[1].averageMinutes} min average here`,
    });
  return suggestions.slice(0, 3);
}
