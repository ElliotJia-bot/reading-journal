// Administrator-only publisher. Full texts and the manifest stay outside git.
// Run after the backend build with Application Default Credentials configured.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { getStorage } from "../backend/node_modules/firebase-admin/lib/storage/index.js";
import { database } from "../backend/dist/backend/src/store.js";

const manifest = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
const project = process.env.GOOGLE_CLOUD_PROJECT;
if (project !== "project-b00660ba-d6d4-4c9a-a05") throw new Error("Unexpected project");
if (manifest.authorization !== "owner-confirmed-redistribution" || !manifest.confirmedAt)
  throw new Error("Redistribution authorization must be recorded before publishing");
const bucket = getStorage().bucket(`${project}-ebooks`);
const prepared = [];
for (const item of manifest.books) {
  const source = await fs.readFile(item.source);
  if (source.length > 20 * 1024 * 1024 || source.readUInt32LE(0) !== 0x04034b50)
    throw new Error("Invalid EPUB source");
  const ebook = JSON.parse(await fs.readFile(item.reader, "utf8"));
  const digest = createHash("sha256").update(JSON.stringify(ebook.pages)).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(ebook.documentId) || ebook.documentId !== digest ||
      !ebook.pages.length || ebook.pages.length > 10000 || ebook.pages.some(p => typeof p.text !== "string" || p.text.length > 1000))
    throw new Error(`Invalid reader edition: ${item.title}`);
  const reader = Buffer.from(JSON.stringify(ebook));
  if (reader.length > 16 * 1024 * 1024) throw new Error("Reader edition is too large");
  prepared.push({ item, source, ebook, reader });
}
if (new Set(prepared.map(p => p.ebook.documentId)).size !== prepared.length) throw new Error("Duplicate edition");
for (const { item, source, ebook, reader } of prepared) {
  const root = `editions/${ebook.documentId}`;
  for (const [name, bytes, contentType] of [["source.epub", source, "application/epub+zip"], ["reader.json", reader, "application/json; charset=utf-8"]]) {
    await bucket.file(`${root}/${name}`).save(bytes, {
      resumable: false, validation: "crc32c", metadata: { contentType, cacheControl: "private, no-store" },
    });
  }
  // Publish metadata only after both immutable-edition objects are in storage.
  await database.collection("sharedBooks").doc(ebook.documentId).set({
    title: item.title, author: item.author, cover: item.cover || "", isbn: item.isbn || "",
    description: item.description || "", language: item.language || "eng", topics: item.topics || [], titleAliases: [ebook.title],
    pageCount: ebook.pages.length, published: true, publishedAt: Date.now(),
    authorization: manifest.authorization, authorizationConfirmedAt: manifest.confirmedAt,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
  });
  console.log(JSON.stringify({ title: item.title, pages: ebook.pages.length, uploaded: true }));
}
