import { Router } from "express";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import { database, userRef } from "./store.js";
import { existingEdition, matchingSharedEdition, sharedLibraryBook, type SharedBook } from "../../shared/catalog.js";
import type { Book } from "../../shared/domain.js";
import type { Ebook } from "../../shared/reader.js";
import { identifier } from "./schema.js";

export const catalog = Router();
const documentIdInput = z.string().regex(/^[a-f0-9]{64}$/);
const entries = database.collection("sharedBooks");
const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT || "project-b00660ba-d6d4-4c9a-a05"}-ebooks`;

// An explicit projection keeps licensing records and storage metadata private.
function publicEntry(id: string, data: FirebaseFirestore.DocumentData): SharedBook {
  return {
    documentId: id, title: data.title, author: data.author,
    cover: data.cover || "", description: data.description || "",
    pageCount: data.pageCount, language: data.language, topics: data.topics || [],
    isbn: data.isbn || "",
    titleAliases: data.titleAliases || [],
  };
}

export async function publishedEbooks() {
  const snapshot = await entries.where("published", "==", true).limit(100).get();
  return snapshot.docs.map(doc => publicEntry(doc.id, doc.data()));
}

catalog.get("/:documentId/content", async (req, res) => {
  const documentId = documentIdInput.parse(req.params.documentId);
  const entry = await entries.doc(documentId).get();
  // A personal import need not exist in the shared catalog.
  if (!entry.exists || entry.data()?.published !== true) {
    res.json({ ebook: null });
    return;
  }
  const [bytes] = await getStorage().bucket(bucketName)
    .file(`editions/${documentId}/reader.json`).download();
  const ebook = JSON.parse(bytes.toString("utf8")) as Ebook;
  if (ebook.documentId !== documentId || ebook.pages.length !== entry.data()!.pageCount ||
    createHash("sha256").update(JSON.stringify(ebook.pages)).digest("hex") !== documentId)
    throw new Error("CATALOG_EDITION_MISMATCH");
  res.json({ ebook });
});

catalog.post("/books/:bookId/open", async (req, res) => {
  const bookId = identifier.parse(req.params.bookId);
  const books = userRef(res.locals.uid).collection("books");
  const available = await publishedEbooks();
  const book = await database.runTransaction(async tx => {
    const ownRef = books.doc(bookId);
    const own = await tx.get(ownRef);
    if (!own.exists) throw Object.assign(new Error("Book not found in your library."), { status: 404 });
    const original = { ...own.data(), id: own.id } as Book;
    const match = matchingSharedEdition(original, available);
    if (!match) return null;
    const documentId = match.documentId;
    const entry = await tx.get(entries.doc(documentId));
    if (!entry.exists || entry.data()?.published !== true)
      throw Object.assign(new Error("This ebook is no longer available."), { status: 404 });
    const matches = await tx.get(books.where("reader.documentId", "==", documentId).limit(1));
    const existing = existingEdition(matches.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Book), documentId);
    if (existing) return existing;
    const sessions = await tx.get(userRef(res.locals.uid).collection("sessions").where("bookId", "==", bookId).limit(1));
    const created = sharedLibraryBook(publicEntry(entry.id, entry.data()!), Date.now());
    // An untouched metadata-only entry can adopt the ebook without a duplicate.
    // Existing physical-book history keeps its original edition and page units.
    if (sessions.empty && original.position === 0 && original.baselinePosition === 0 && original.furthestPosition === 0) {
      const attached = { ...original, reader: created.reader, unit: created.unit,
        totalPages: created.totalPages, updatedAt: Date.now() };
      tx.set(ownRef, attached);
      return attached;
    }
    const ref = books.doc(created.id);
    const occupied = await tx.get(ref);
    // Never overwrite a different personal book, even if it has a conflicting ID.
    if (occupied.exists)
      throw Object.assign(new Error("A different book uses this library entry. Please contact support."), { status: 409 });
    tx.create(ref, created);
    return created;
  });
  res.json({ book });
});
