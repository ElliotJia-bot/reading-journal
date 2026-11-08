import { unzipSync, strFromU8 } from "fflate";
import { paginate, type Ebook } from "../../../shared/reader";
export async function hashText(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function xml(text: string) {
  if (/<!ENTITY/i.test(text))
    throw new Error("This EPUB uses unsupported XML entities.");
  const doc = new DOMParser().parseFromString(
    text.replace(/<!DOCTYPE[^>]*>/gi, ""),
    "application/xml",
  );
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error(
      "This EPUB contains invalid markup. Try a standard text EPUB or TXT file.",
    );
  return doc;
}
function elements(doc: Document | Element, tag: string) {
  return [...doc.getElementsByTagNameNS("*", tag)];
}
function plain(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (
    node instanceof Element &&
    (["script", "style", "svg", "nav", "audio", "video"].includes(
      node.localName,
    ) ||
      node.hasAttribute("hidden"))
  )
    return "";
  const text = [...node.childNodes].map(plain).join("");
  return node instanceof Element &&
    /^(p|div|h[1-6]|br|li|section)$/.test(node.localName)
    ? text + "\n\n"
    : text;
}
export async function parseEbook(file: File): Promise<Ebook> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a file smaller than 20 MB.");
  let title = file.name.replace(/\.(epub|txt)$/i, ""),
    author = "";
  const chapters: { title: string; text: string }[] = [];
  if (/\.txt$/i.test(file.name)) {
    if (file.size > 2 * 1024 * 1024)
      throw new Error("TXT files must be under 2 MB.");
    chapters.push({ title: "Text", text: await file.text() });
  } else if (/\.epub$/i.test(file.name)) {
    let total = 0,
      entries = 0;
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => {
        if (++entries > 3000) throw new Error("This EPUB has too many files.");
        if (!/\.(xml|opf|xhtml|html|htm)$/i.test(f.name)) return false;
        total += f.originalSize;
        if (f.originalSize > 2 * 1024 * 1024 || total > 8 * 1024 * 1024)
          throw new Error("This EPUB has too much text for the demo reader.");
        return true;
      },
    });
    // Conservative: encrypted EPUBs, including font-obfuscation containers, are unsupported.
    if (files["META-INF/encryption.xml"])
      throw new Error(
        "Encrypted EPUBs are not supported. Import a DRM-free, unencrypted EPUB or TXT.",
      );
    const read = (path: string) => {
      if (!files[path])
        throw new Error("Missing EPUB chapter or package file.");
      return xml(strFromU8(files[path]));
    };
    const root = elements(
      read("META-INF/container.xml"),
      "rootfile",
    )[0]?.getAttribute("full-path");
    if (!root) throw new Error("This file is not a supported EPUB.");
    const opf = read(root);
    title = elements(opf, "title")[0]?.textContent?.trim() || title;
    author = elements(opf, "creator")
      .map((e) => e.textContent?.trim())
      .filter(Boolean)
      .join(", ");
    const manifest = new Map(
      elements(opf, "item").map((e) => [e.getAttribute("id"), e]),
    );
    for (const ref of elements(opf, "itemref")) {
      if (ref.getAttribute("linear") === "no") continue;
      const item = manifest.get(ref.getAttribute("idref"));
      const href = item?.getAttribute("href");
      if (!href || !/html/.test(item?.getAttribute("media-type") ?? ""))
        continue;
      const path = new URL(href, `https://ebook.invalid/${root}`);
      if (path.origin !== "https://ebook.invalid")
        throw new Error("External EPUB chapters are not supported.");
      const doc = read(decodeURIComponent(path.pathname.slice(1)));
      const body = elements(doc, "body")[0];
      if (!body) continue;
      const text = plain(body)
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();
      if (text)
        chapters.push({
          title:
            (
              elements(body, "h1")[0] ?? elements(body, "h2")[0]
            )?.textContent?.trim() || `Chapter ${chapters.length + 1}`,
          text,
        });
    }
  } else
    throw new Error(
      "Choose a DRM-free EPUB or UTF-8 TXT file. PDF, Kindle and Apple Books protected files are not supported.",
    );
  const pages = paginate(chapters);
  if (!pages.length || pages.length > 10000)
    throw new Error("No readable text found, or the book is too large.");
  return {
    documentId: await hashText(JSON.stringify(pages)),
    title: title.slice(0, 240),
    author: author.slice(0, 160),
    pages,
  };
}
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("reading-journal-ebooks", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("books");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Cannot open ebook storage. Enable browser storage and try again.",
        ),
      );
  });
}
export async function storeEbook(
  uid: string,
  bookId: string,
  book?: Ebook,
): Promise<Ebook | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("books", book ? "readwrite" : "readonly");
    const req = book
      ? tx.objectStore("books").put(book, `${uid}:${bookId}`)
      : tx.objectStore("books").get(`${uid}:${bookId}`);
    tx.oncomplete = () => {
      database.close();
      resolve(book ?? req.result);
    };
    tx.onerror = () => {
      database.close();
      reject(
        new Error(
          "Could not save ebook locally. Free some device storage and retry.",
        ),
      );
    };
  });
}
