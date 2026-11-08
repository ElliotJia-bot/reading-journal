import { z } from "zod";
import type { Book } from "../../shared/domain.js";
import type { RecommendationEvidence } from "../../shared/recommendation-evidence.js";

export function parseBookExplanation(
  raw: string,
  evidence: RecommendationEvidence[],
) {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    if (clean.startsWith("{"))
      throw new Error("TINKER_INVALID_EXPLANATION_JSON");
  }
  if (parsed && typeof parsed === "object")
    return validateBookExplanation(parsed, evidence);
  const reason = typeof parsed === "string" ? parsed : clean;
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const evidenceIds = evidence
    .filter((e) => {
      if (/^(book|library)-/.test(e.id))
        return normalize(reason).includes(normalize(JSON.parse(e.text).title));
      if (e.id.startsWith("pace-"))
        return [...reason.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].some(
          (m) => Number(m[1]) === Math.abs(JSON.parse(e.text).percentChange),
        );
      if (e.id === "fit-connection")
        return normalize(reason).includes(normalize(JSON.parse(e.text).title));
      if (e.id === "fit-session") return /chapter|sitting/i.test(reason);
      if (e.id === "fit-sentences") return /sentence/i.test(reason);
      if (e.id === "fit-completion") return /complet|finish/i.test(reason);
      if (e.id === "fit-pace")
        return /pace|faster|slower|baseline/i.test(reason);
      return false;
    })
    .map((e) => e.id);
  return validateBookExplanation({ reason, evidenceIds }, evidence);
}

export function explanationEvidence(
  books: Book[],
  evidence: RecommendationEvidence[],
) {
  const titles = new Set(
    evidence
      .filter((e) => e.id.startsWith("book-"))
      .map((e) => JSON.parse(e.text).title),
  );
  const current = books
    .filter((b) => b.status === "Reading" && !titles.has(b.title))
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 12);
  return [
    ...evidence,
    ...current.map((b, i) => ({
      id: `library-${i}`,
      text: JSON.stringify({
        title: b.title,
        author: b.author,
        topics: b.topics,
        status: b.status,
        syntheticDataIncluded: !!b.demoData?.synthetic,
      }),
    })),
  ];
}

export function referencedBooks(
  ids: string[],
  evidence: RecommendationEvidence[],
) {
  return evidence
    .filter((e) => ids.includes(e.id) && /^(book|library)-/.test(e.id))
    .map((e) => JSON.parse(e.text) as { title: string; status: string });
}

export function validateBookExplanation(
  raw: unknown,
  evidence: RecommendationEvidence[],
) {
  const result = z
    .object({
      reason: z.string().trim().min(120).max(1150),
      evidenceIds: z.array(z.string()).max(7),
    })
    .strict()
    .parse(raw);
  // Reference IDs belong in evidenceIds, never in reader-facing prose.
  result.reason = result.reason.replace(/\s*\((?:book|library)-\d+\)/g, "");
  result.reason = result.reason.replace(/\s+/g, " ").trim();
  if (result.reason.split(/\s+/).length > 95)
    throw new Error("TINKER_EXPLANATION_TOO_LONG");
  if (/\b(?:book|library)-\d+\b/.test(result.reason))
    throw new Error("TINKER_VISIBLE_EVIDENCE_ID");
  const known = new Set(evidence.map((e) => e.id));
  if (result.evidenceIds.some((id) => !known.has(id)))
    throw new Error("TINKER_INVALID_EVIDENCE");
  if (
    /comprehend best|comprehension (?:ceiling|limit|score)|under your ceiling|reading ability|diagnos|complexity (?:here )?scores?/i.test(
      result.reason,
    )
  )
    throw new Error("TINKER_UNSUPPORTED_ABILITY_CLAIM");
  const allowedPercents = evidence
    .filter(
      (e) => result.evidenceIds.includes(e.id) && /^(pace|fit)-/.test(e.id),
    )
    .flatMap((e) =>
      e.id.startsWith("pace-")
        ? [Math.abs(JSON.parse(e.text).percentChange)]
        : (JSON.parse(e.text).allowedPercents ?? []),
    );
  if (
    [...result.reason.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].some(
      (m) => !allowedPercents.includes(Number(m[1])),
    )
  )
    throw new Error("TINKER_UNSUPPORTED_PERCENTAGE");
  for (const [pattern, id] of [
    [/chapters?[^.]*\d|\d[^.]*chapters?/i, "fit-session"],
    [/sentences?[^.]*\d|\d[^.]*words per sentence/i, "fit-sentences"],
  ] as const) {
    if (!pattern.test(result.reason)) continue;
    const fact = evidence.find(
      (e) => e.id === id && result.evidenceIds.includes(id),
    );
    if (!fact) throw new Error("TINKER_UNSUPPORTED_BOOK_FEATURE");
    const allowed = JSON.parse(fact.text).allowedNumbers as number[];
    const sentences = result.reason
      .split(/(?<=[.!?])\s+/)
      .filter((s) => pattern.test(s));
    if (
      sentences.some((s) =>
        [
          ...s.matchAll(
            /\b(\d+(?:\.\d+)?)\s*[- ]\s*(?:pages?|minutes?|words?)\b/g,
          ),
        ].some((m) => !allowed.includes(Number(m[1]))),
      )
    )
      throw new Error("TINKER_UNSUPPORTED_BOOK_FEATURE");
  }
  const allBooks = referencedBooks([...known], evidence);
  const cited = referencedBooks(result.evidenceIds, evidence);
  const current = allBooks.filter((b) => b.status === "Reading");
  const preferred = current.length ? current : allBooks;
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (
    preferred.length &&
    !cited.some(
      (b) =>
        preferred.some((p) => p.title === b.title) &&
        normalize(result.reason).includes(normalize(b.title)),
    )
  ) {
    throw new Error("TINKER_MISSING_BOOK_CONNECTION");
  }
  if (cited.some((b) => !normalize(result.reason).includes(normalize(b.title))))
    throw new Error("TINKER_UNEXPLAINED_BOOK_REFERENCE");
  return result;
}

export function explanationSupport(
  ids: string[],
  evidence: RecommendationEvidence[],
) {
  return ids.flatMap((id) => {
    const item = evidence.find((e) => e.id === id);
    if (!item) return [];
    const e = JSON.parse(item.text);
    if (/^(pace|fit)-/.test(id)) return [e.summary];
    if (id === "summary")
      return [
        `${e.sessions} reading sessions · ${e.totalMinutes} minutes · Last 30 days${e.syntheticSessions ? ` · ${e.syntheticSessions} simulated sessions` : ""}`,
      ];
    if (id.startsWith("book-"))
      return [
        `${e.title}: ${e.sessions} sessions · ${e.minutes} minutes · ${e.likedSessions} explicitly liked${e.syntheticSessions ? " · Includes demo records" : ""}`,
      ];
    if (id.startsWith("library-"))
      return [
        `${e.title} · Currently reading${e.syntheticDataIncluded ? " · Demo book" : ""}`,
      ];
    if (id === "rhythm")
      return [
        "Based on your recorded reading times, broad location categories and topic patterns.",
      ];
    return ["Based on your saved Like / Maybe / Not for me choices."];
  });
}
