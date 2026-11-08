import { createHash } from "node:crypto";
import { database } from "./store.js";
import {
  catalogBooks,
  type CatalogBook,
} from "../../shared/book-recommendations.js";
import { singleFlight } from "../../shared/single-flight.js";
const pending = singleFlight<unknown>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
export const quoteCatalog = (s: string) => `"${s.replace(/["\\]/g, " ")}"`;
async function catalogJSON(path: string): Promise<any> {
  return pending(path, async () => {
    const ref = database
      .collection("private")
      .doc("catalog-" + createHash("sha256").update(path).digest("hex"));
    const cached = (await ref.get()).data();
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const result = queue
      .catch(() => {})
      .then(async () => {
        const wait = 1050 - (Date.now() - lastRequest);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        lastRequest = Date.now();
        const response = await fetch("https://openlibrary.org" + path, {
          signal: AbortSignal.timeout(15000),
          headers: {
            "User-Agent":
              "Remarked/1.0 (reading-journal hackathon; contact: https://project-b00660ba-d6d4-4c9a-a05.web.app)",
          },
        });
        if (!response.ok)
          throw Object.assign(
            new Error(
              "The book catalog is taking a break. Please try again shortly.",
            ),
            { status: 503 },
          );
        return response.json();
      });
    queue = result;
    const value = await result;
    // Keep the shared cache bounded by small search responses, never whole ebooks.
    if (JSON.stringify(value).length < 750000)
      await ref.set({ value, expiresAt: Date.now() + 6 * 3600000 });
    return value;
  });
}
export async function catalogSearch(
  query: string,
  language: string,
  limit = 60,
  popular = false,
): Promise<CatalogBook[]> {
  const params = new URLSearchParams({
    q: `(${query}) AND language:${language}`,
    limit: String(limit),
    lang:
      (
        {
          eng: "en",
          chi: "zh",
          fre: "fr",
          spa: "es",
          ger: "de",
          jpn: "ja",
        } as Record<string, string>
      )[language] ?? "en",
    fields:
      "key,title,author_name,subject,cover_i,number_of_pages_median,readinglog_count,editions,editions.title,editions.language",
  });
  if (popular) params.set("sort", "readinglog");
  return catalogBooks(
    await catalogJSON("/search.json?" + params),
    language,
  ).map((b) => ({ ...b, subjects: b.subjects.slice(0, 50) }));
}
export async function catalogSynopsis(id: string) {
  if (!/^OL\d+W$/.test(id)) throw new Error("Invalid catalog work");
  const data = await catalogJSON(`/works/${id}.json`);
  const raw =
    typeof data.description === "string"
      ? data.description
      : data.description?.value;
  return typeof raw === "string"
    ? raw
        .slice(0, 2200)
        .replace(/<[^>]*>/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim()
    : "";
}
