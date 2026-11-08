import type { Book } from "../../../shared/domain";
import {
  catalogBooks,
  normalized,
  rankBookMatches,
  usefulSubjects,
  type CatalogBook,
} from "../../../shared/book-recommendations";

const cache = new Map<string, { at: number; books: CatalogBook[] }>();
let requestQueue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
const quote = (s: string) => `"${s.replace(/["\\]/g, " ")}"`;
async function search(query: string, limit: number) {
  const key = `${query}:${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 30 * 60000) return cached.books;
  // Small, user-triggered lookups; respect the public catalog's 1 req/s limit.
  const request = requestQueue
    .catch(() => {})
    .then(async () => {
      const wait = 1050 - (Date.now() - lastRequest);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        lang: "en",
        fields:
          "key,title,author_name,subject,cover_i,editions,editions.title,editions.language",
      });
      const response = await fetch(
        `https://openlibrary.org/search.json?${params}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (!response.ok)
        throw new Error(
          "The book catalog is unavailable right now. Try again in a moment.",
        );
      const books = catalogBooks(await response.json());
      if (cache.size >= 30) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), books });
      return books;
    });
  requestQueue = request;
  return request;
}
export async function findBookRecommendations(
  seed: Book | undefined,
  topic: string,
  owned: Book[],
  dismissed: string[],
) {
  let resolved: CatalogBook | undefined;
  if (seed) {
    const query = `title:${quote(seed.title)}${seed.author ? ` AND author:${quote(seed.author)}` : ""}`;
    const matches = await search(query, 5);
    resolved = matches.find(
      (b) =>
        [b.title, b.catalogTitle].some(
          (title) => title && normalized(title) === normalized(seed.title),
        ) &&
        (!seed.author ||
          b.authors.some((a) => normalized(a) === normalized(seed.author)) ||
          normalized(b.authors.join(", ")) === normalized(seed.author)),
    );
  }
  const topics = seed
    ? usefulSubjects([...(resolved?.subjects ?? []), ...seed.topics])
    : [topic];
  const authors = resolved?.authors ?? (seed?.author ? [seed.author] : []);
  if (!topics.length && !authors.length)
    throw new Error(
      "We couldn’t find themes for this book yet. Choose a topic below, or add topic tags to the book.",
    );
  const query = [
    ...topics.map((s) => `subject:${quote(s)}`),
    ...authors.slice(0, 1).map((s) => `author:${quote(s)}`),
  ].join(" OR ");
  const candidates = await search(`(${query})`, 40);
  return {
    matches: rankBookMatches(
      candidates,
      { topics, authors, seed: resolved },
      owned,
      dismissed,
    ),
    topics,
  };
}
