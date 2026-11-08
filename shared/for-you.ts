import {
  normalized,
  sameBook,
  type CatalogBook,
  type BookMatch,
} from "./book-recommendations.js";
import type { Book } from "./domain.js";
import type { DiscoveryVote } from "./discovery.js";
export type ShelfKind = "personal" | "explore" | "peers";
export type ReadingExperience = "Beginner" | "Experienced";
export interface ShelfBook extends BookMatch {
  shelf: ShelfKind;
  source: "catalog" | "community" | "popular";
}
export interface DiscoveryFeed {
  personal: ShelfBook[];
  explore: ShelfBook[];
  peers: ShelfBook[];
  votes: Record<string, DiscoveryVote>;
  experience: ReadingExperience | null;
  peerCount: number;
  peerSource: "community" | "popular" | "mixed";
  language: string;
  generatedAt: number;
  usualGenres: string[];
  styleSignals: string[];
}
export interface RecommendationDetail {
  synopsis: string;
  reason: string;
  reasonSource: "ai" | "catalog";
}
const genrePatterns: [string, RegExp][] = [
  ["Fantasy", /\bfantas(y|tic)\b|magic|fairy tales/i],
  ["Science fiction", /science fiction|dystopi|space opera/i],
  ["Mystery", /myster|detective|crime fiction|thriller/i],
  ["Romance", /romance|love stories/i],
  ["History", /histor(y|ical)/i],
  ["Biography", /biograph|memoir/i],
  ["Science", /science|physics|biology|astronomy/i],
  ["Philosophy", /philosoph/i],
  ["Poetry", /poetry|poems|poets/i],
  ["Travel", /travel|journeys/i],
  ["Psychology", /psychology|self.help/i],
  ["Art", /\bart\b|design|painting/i],
];
export const discoveryGenres = genrePatterns.map(([name]) => name);
export function genresFor(tags: string[]) {
  return genrePatterns
    .filter(([, re]) => tags.some((tag) => re.test(tag)))
    .map(([name]) => name)
    .filter(
      (name) =>
        name !== "Science" || !tags.some((t) => /science fiction/i.test(t)),
    );
}
const stylePatterns: [string, RegExp][] = [
  ["humorous", /humor|humour|comic|comedy|satire/i],
  ["reflective", /philosoph|psychological|introspect|meditation/i],
  ["adventurous", /adventure|journey|quest|exploration/i],
  [
    "character-focused",
    /friendship|family|relationships|coming.of.age|bildungsroman/i,
  ],
  ["short-form", /short stories|essays|poetry|poems/i],
  ["suspenseful", /suspense|thriller|detective|mystery/i],
];
export function stylesFor(tags: string[]) {
  return stylePatterns
    .filter(([, re]) => tags.some((tag) => re.test(tag)))
    .map(([s]) => s);
}
export interface FeedbackBook {
  value: DiscoveryVote;
  book?: CatalogBook & Partial<ShelfBook>;
}
export function restoreSavedRecommendation(
  id: string,
  book: NonNullable<FeedbackBook["book"]>,
): ShelfBook {
  return {
    ...book,
    id,
    subjects: book.subjects ?? [],
    shelf: book.shelf ?? "personal",
    source: book.source ?? "catalog",
    matchedTopics: book.matchedTopics ?? genresFor(book.subjects ?? []),
    reason: book.reason ?? "You kept this book as Maybe.",
    score: book.score ?? 0,
  };
}
export function isAvailable(
  book: CatalogBook,
  owned: Book[],
  feedback: Record<string, FeedbackBook>,
  language: string,
) {
  if (book.language !== language || owned.some((b) => sameBook(book, b)))
    return false;
  return !Object.entries(feedback).some(
    ([id, f]) =>
      f.value !== "maybe" &&
      (id === book.id ||
        (f.book &&
          sameBook(book, {
            id: `ol-${id}`,
            title: f.book.title,
            author: f.book.authors.join(", "),
          }))),
  );
}
export function rankCrossGenre(
  candidates: CatalogBook[],
  tags: string[],
  owned: Book[],
  language: string,
) {
  const usual = genresFor(tags),
    style = stylesFor(tags);
  const seen = new Set<string>();
  return candidates
    .flatMap((book) => {
      const genres = genresFor(book.subjects);
      const identity =
        normalized(book.catalogTitle ?? book.title) +
        "|" +
        normalized(book.authors.join(","));
      if (
        seen.has(identity) ||
        book.language !== language ||
        owned.some((b) => sameBook(book, b)) ||
        !genres.length ||
        genres.some((g) => usual.includes(g))
      )
        return [];
      seen.add(identity);
      const common = stylesFor(book.subjects).filter((s) => style.includes(s));
      const topics = book.subjects
        .filter((s) => tags.some((t) => normalized(s) === normalized(t)))
        .slice(0, 2);
      const reason = common.length
        ? `Try ${genres[0].toLowerCase()} with a ${common.join(", ")} feel. Its catalog themes share these style clues with your reading; this is a possible match, not a full-text assessment.`
        : `Explore ${genres[0].toLowerCase()} in your preferred language. This is a new direction beyond your recorded genres; a style match is still uncertain.`;
      return [
        {
          ...book,
          matchedTopics: genres,
          reason,
          score: common.length * 10 + topics.length * 3 + (book.cover ? 1 : 0),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.readingLogCount ?? 0) - (a.readingLogCount ?? 0),
    );
}
// Reserve six positions for each shelf before allocating replacement candidates.
export function splitShelves(matches: BookMatch[]) {
  const personal = matches.slice(0, 6);
  const remaining = matches.slice(6).sort((a, b) => {
    const noveltyA = stylesFor(a.subjects).length ? 1 : 0;
    const noveltyB = stylesFor(b.subjects).length ? 1 : 0;
    return (
      noveltyA - noveltyB || (b.readingLogCount ?? 0) - (a.readingLogCount ?? 0)
    );
  });
  const explore = remaining.slice(0, 6);
  const spare = remaining.slice(6);
  return {
    personal: [...personal, ...spare.filter((_, i) => i % 2 === 0)]
      .slice(0, 18)
      .map((b) => ({
        ...b,
        shelf: "personal" as const,
        source: "catalog" as const,
      })),
    explore: [...explore, ...spare.filter((_, i) => i % 2 === 1)]
      .slice(0, 18)
      .map((b) => ({
        ...b,
        shelf: "explore" as const,
        source: "catalog" as const,
        reason: `A different direction: ${b.matchedTopics[0] ?? "a new subject"}. Try a sample to see whether this new topic suits you.`,
      })),
  };
}
export function visibleFeed(
  feed: DiscoveryFeed,
  owned: Book[],
  feedback: Record<string, FeedbackBook>,
): DiscoveryFeed {
  const seen = new Set<string>();
  const shelves = {} as Pick<DiscoveryFeed, "personal" | "explore" | "peers">;
  for (const kind of ["personal", "explore", "peers"] as const) {
    const maybe = Object.entries(feedback).flatMap(([id, f]) =>
      f.value === "maybe" && f.book && (f.book.shelf ?? "personal") === kind
        ? [restoreSavedRecommendation(id, f.book)]
        : [],
    );
    shelves[kind] = [];
    for (const b of [...maybe, ...feed[kind]]) {
      const identity =
        normalized(b.catalogTitle ?? b.title) +
        "|" +
        normalized(b.authors.join(","));
      if (seen.has(identity) || !isAvailable(b, owned, feedback, feed.language))
        continue;
      seen.add(identity);
      shelves[kind].push(b);
      if (shelves[kind].length === 6) break;
    }
  }
  const sources = shelves.peers.map((b) => b.source);
  return {
    ...feed,
    ...shelves,
    votes: Object.fromEntries(
      Object.entries(feedback).map(([id, f]) => [id, f.value]),
    ),
    peerSource:
      sources.every((s) => s === "community") && sources.length
        ? "community"
        : sources.includes("community")
          ? "mixed"
          : "popular",
  };
}
