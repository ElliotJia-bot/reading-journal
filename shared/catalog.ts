import type { Book } from "./domain.js";

export interface SharedBook {
  documentId: string;
  title: string;
  author: string;
  cover: string;
  description: string;
  pageCount: number;
  language: "eng" | "chi" | "fre" | "spa" | "ger" | "jpn";
  topics: string[];
  isbn?: string;
  titleAliases?: string[];
}

// Match the exact edition, never just the title: positions and passage hashes
// must continue to refer to the same text when a reader changes devices.
export function existingEdition(books: Book[], documentId: string) {
  return books.find((book) => book.reader?.documentId === documentId);
}

export function sharedLibraryBook(entry: SharedBook, now: number): Book {
  return {
    id: `ebook-${entry.documentId.slice(0, 32)}`,
    title: entry.title,
    author: entry.author,
    cover: entry.cover,
    isbn: entry.isbn || "",
    language: entry.language,
    topics: entry.topics,
    unit: "pages",
    totalPages: entry.pageCount,
    baselinePosition: 0,
    position: 0,
    furthestPosition: 0,
    status: "Reading",
    createdAt: now,
    updatedAt: now,
    reader: { documentId: entry.documentId, pageCount: entry.pageCount },
  };
}

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchingSharedEdition(book: Book, entries: SharedBook[]) {
  if (book.reader) return entries.find(entry => entry.documentId === book.reader!.documentId);
  const matches = entries.filter(entry =>
    (!book.language || book.language === entry.language) &&
    ((book.isbn && entry.isbn && book.isbn.replace(/[- ]/g, "") === entry.isbn.replace(/[- ]/g, "")) ||
      ([entry.title, ...(entry.titleAliases || [])].some(title => normalize(book.title) === normalize(title)) && !!normalize(book.author) && normalize(book.author) === normalize(entry.author))),
  );
  // A title alone is not enough to silently select an edition.
  return matches.length === 1 ? matches[0] : undefined;
}
