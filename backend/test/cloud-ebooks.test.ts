import { test } from "node:test";
import assert from "node:assert/strict";
import { matchingSharedEdition, sharedLibraryBook, existingEdition, type SharedBook } from "../../shared/catalog.js";

const entry: SharedBook = { documentId: "a".repeat(64), title: "Little Women", author: "Louisa May Alcott", cover: "", description: "", pageCount: 1159, topics: ["Classics"], language: "eng" };
const book = sharedLibraryBook(entry, 123);
test("An exact reader edition takes precedence over title matching", () => {
  assert.equal(matchingSharedEdition({ ...book, title: "Custom title" }, [entry]), entry);
  assert.equal(matchingSharedEdition({ ...book, reader: { ...book.reader!, documentId: "b".repeat(64) } }, [entry]), undefined);
});
test("Metadata matching requires author and language and rejects ambiguous editions", () => {
  const metadata = { ...book, reader: undefined };
  assert.equal(matchingSharedEdition({ ...metadata, title: " LITTLE WOMEN " }, [entry]), entry);
  assert.equal(matchingSharedEdition({ ...metadata, author: "" }, [entry]), undefined);
  assert.equal(matchingSharedEdition({ ...metadata, author: "Another author" }, [entry]), undefined);
  assert.equal(matchingSharedEdition({ ...metadata, language: "chi" }, [entry]), undefined);
  assert.equal(matchingSharedEdition(metadata, [entry, { ...entry, documentId: "b".repeat(64) }]), undefined);
});
test("Opening a shared edition reuses the original library ID and reading history", () => {
  const existing = { ...book, id: "existing-personal-id", position: 900, status: "Finished" as const };
  assert.equal(existingEdition([existing], entry.documentId), existing);
  assert.equal(existing.position, 900);
  assert.equal(sharedLibraryBook(entry, 123).position, 0);
});
