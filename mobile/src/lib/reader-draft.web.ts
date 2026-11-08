import { resetLoggedReader } from "../../../shared/reader-session";

export function clearLoggedReader(
  uid: string,
  bookId: string,
  sessionId: string,
  endPosition: number,
) {
  const key = `ebook-state:${uid}:${bookId}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.sessionId !== sessionId) return;
    localStorage.setItem(
      key,
      JSON.stringify(
        resetLoggedReader(
          state,
          sessionId,
          endPosition,
          crypto.randomUUID(),
          Date.now(),
        ),
      ),
    );
  } catch {
    // The reader also reconciles saved session IDs on load if storage was full.
  }
}
