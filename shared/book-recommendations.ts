import type { Book } from "./domain.js";

export interface CatalogBook {
  id: string;
  title: string;
  catalogTitle?: string;
  authors: string[];
  subjects: string[];
  cover: string;
  language?: string;
  pageCount?: number | null;
}
export interface BookMatch extends CatalogBook {
  reason: string;
  matchedTopics: string[];
  score: number;
}
export function diverseMatches(matches: BookMatch[], limit = 5) {
  const authors = new Map<string, number>();
  return matches
    .filter((book) => {
      const key = normalized(book.authors.join(", ")) || book.id;
      const count = authors.get(key) ?? 0;
      if (count >= 2) return false;
      authors.set(key, count + 1);
      return true;
    })
    .slice(0, limit);
}
export const normalized = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const titleKeys = (title: string) =>
  title
    .split(/[\/|]/)
    .map((part) => normalized(part).replace(/^(the|a|an) /, ""));
export function catalogBooks(
  payload: unknown,
  language?: string,
): CatalogBook[] {
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
      editionDocs.find(
        (e) =>
          e &&
          typeof e === "object" &&
          (!language ||
            strings((e as Record<string, unknown>).language).includes(
              language,
            )),
      )
        ? (editionDocs.find(
            (e) =>
              e &&
              typeof e === "object" &&
              (!language ||
                strings((e as Record<string, unknown>).language).includes(
                  language,
                )),
          ) as Record<string, unknown>)
        : undefined;
    if (language && !edition) return [];
    return [
      {
        id: match[1],
        title:
          typeof edition?.title === "string" && edition.title.trim()
            ? edition.title.trim()
            : v.title.trim(),
        catalogTitle: v.title.trim(),
        language,
        pageCount:
          typeof v.number_of_pages_median === "number" &&
          v.number_of_pages_median > 0
            ? Math.round(v.number_of_pages_median)
            : null,
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
  owned: Pick<Book, "title" | "author" | "id" | "catalogId">,
) {
  if (owned.id === `ol-${candidate.id}` || owned.catalogId === candidate.id)
    return true;
  if (
    ![candidate.title, candidate.catalogTitle].some(
      (title) =>
        title &&
        titleKeys(title).some((key) => titleKeys(owned.title).includes(key)),
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
            !/^(accessible book|protected daisy|in library|large type books|translations|reading level|nyt:|lcc:|ddc:|texts?$|language$|juvenile literature$)/i.test(
              s,
            ) &&
            !/\blanguage\b|\btranslations?\b|\btextbooks?\b/i.test(s),
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
        (basis.seed &&
          sameBook(book, {
            id: basis.seed.id,
            title: basis.seed.catalogTitle ?? basis.seed.title,
            author: basis.seed.authors.join(", "),
          })) ||
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
