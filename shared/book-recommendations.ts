import type { Book } from "./domain.js";

export interface CatalogBook {
  id: string;
  title: string;
  catalogTitle?: string;
  authors: string[];
  subjects: string[];
  cover: string;
}
export interface BookMatch extends CatalogBook {
  reason: string;
  matchedTopics: string[];
  score: number;
}
export const normalized = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function catalogBooks(payload: unknown): CatalogBook[] {
  const docs = (payload as { docs?: unknown[] })?.docs;
  if (!Array.isArray(docs))
    throw new Error(
      "The book catalog returned an unreadable response. Please try again.",
    );
  return docs.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const v = entry as Record<string, unknown>;
    const match =
      typeof v.key === "string"
        ? v.key.match(/^(?:\/works\/)?(OL\d+W)$/)
        : null;
    if (!match || typeof v.title !== "string" || !v.title.trim()) return [];
    const strings = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((s): s is string => typeof s === "string" && !!s.trim())
        : [];
    const editionDocs = (v.editions as { docs?: unknown[] } | undefined)?.docs;
    const edition =
      Array.isArray(editionDocs) &&
      editionDocs[0] &&
      typeof editionDocs[0] === "object"
        ? (editionDocs[0] as Record<string, unknown>)
        : undefined;
    return [
      {
        id: match[1],
        title:
          typeof edition?.title === "string" && edition.title.trim()
            ? edition.title.trim()
            : v.title.trim(),
        catalogTitle: v.title.trim(),
        authors: strings(v.author_name),
        subjects: strings(v.subject),
        cover:
          typeof v.cover_i === "number" &&
          Number.isInteger(v.cover_i) &&
          v.cover_i > 0
            ? `https://covers.openlibrary.org/b/id/${v.cover_i}-M.jpg`
            : "",
      },
    ];
  });
}
export function sameBook(
  candidate: CatalogBook,
  owned: Pick<Book, "title" | "author" | "id">,
) {
  if (owned.id === `ol-${candidate.id}`) return true;
  if (
    ![candidate.title, candidate.catalogTitle].some(
      (title) => title && normalized(title) === normalized(owned.title),
    )
  )
    return false;
  return (
    !owned.author ||
    !candidate.authors.length ||
    candidate.authors.some((a) => normalized(a) === normalized(owned.author)) ||
    normalized(candidate.authors.join(", ")) === normalized(owned.author)
  );
}
export function usefulSubjects(subjects: string[]) {
  const unique = [
    ...new Map(
      subjects
        .filter(
          (s) =>
            s.length >= 3 &&
            s.length <= 60 &&
            !/^(accessible book|protected daisy|in library|large type books|translations|reading level|nyt:|lcc:|ddc:)/i.test(
              s,
            ),
        )
        .map((s) => [normalized(s), s]),
    ).values(),
  ];
  return unique
    .sort(
      (a, b) =>
        Number(
          /^(fiction|literature|english fiction|american fiction)$/i.test(a),
        ) -
        Number(
          /^(fiction|literature|english fiction|american fiction)$/i.test(b),
        ),
    )
    .slice(0, 3);
}
export function rankBookMatches(
  candidates: CatalogBook[],
  basis: { topics: string[]; authors: string[]; seed?: CatalogBook },
  owned: Book[],
  dismissed: string[] = [],
): BookMatch[] {
  const seen = new Set<string>();
  return candidates
    .flatMap((book) => {
      const identity = `${normalized(book.title)}|${normalized(book.authors.join(", "))}`;
      if (
        seen.has(identity) ||
        dismissed.includes(book.id) ||
        basis.seed?.id === book.id ||
        owned.some((b) => sameBook(book, b))
      )
        return [];
      seen.add(identity);
      const matchedTopics = basis.topics.filter((s) =>
        book.subjects.some((tag) => normalized(tag) === normalized(s)),
      );
      const author = book.authors.find((a) =>
        basis.authors.some((b) => normalized(a) === normalized(b)),
      );
      if (!matchedTopics.length && !author) return [];
      const reason = matchedTopics.length
        ? `Shared themes: ${matchedTopics.slice(0, 2).join(" · ")}.${author ? ` Also by ${author}.` : ""}`
        : `Another book by ${author}.`;
      return [
        {
          ...book,
          matchedTopics,
          reason,
          score: matchedTopics.length * 3 + (author ? 4 : 0),
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
