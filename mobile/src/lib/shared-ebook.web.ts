import type { Ebook } from "../../../shared/reader";
import { api } from "./api";
import { hashText, storeEbook } from "./ebook.web";

const pending = new Map<string, Promise<Ebook | undefined>>();

export function loadReadableEbook(uid: string, bookId: string, documentId: string) {
  const key = `${uid}:${bookId}:${documentId}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const local = await storeEbook(uid, bookId);
    if (local?.documentId === documentId) return local;
    const { ebook } = await api<{ ebook: Ebook | null }>(`/v1/catalog/${documentId}/content`);
    if (!ebook) return undefined;
    if (ebook.documentId !== documentId || await hashText(JSON.stringify(ebook.pages)) !== documentId)
      throw new Error("This ebook could not be verified. Please try again.");
    await storeEbook(uid, bookId, ebook);
    return ebook;
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
