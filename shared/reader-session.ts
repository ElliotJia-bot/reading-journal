import type { PageVisit } from "./reader.js";

export const MIN_READING_MS = 3 * 60 * 1000;
export function qualifiesForReadingLog(activeMs: number) {
  return Number.isFinite(activeMs) && activeMs > MIN_READING_MS;
}
export interface ReaderDraft {
  documentId: string;
  effectiveMs: number;
  endPosition: number;
  location: string;
  reaction: string;
  pendingVisits: PageVisit[];
}
export interface ReaderSessionState {
  documentId: string;
  sessionId: string;
  startedAt: number;
  startPosition: number;
  sessionMs: number;
  page: number;
  location: string;
  reaction: string;
  pending: PageVisit[];
}
// Use the reader's stable session/event IDs so interrupted saves can be retried.
export function readerLogDraft(
  s: ReaderSessionState,
  bookId: string,
  endedAt: number,
) {
  if (!qualifiesForReadingLog(s.sessionMs)) return null;
  return {
    id: s.sessionId,
    bookId,
    startedAt: s.startedAt,
    startPosition: s.startPosition,
    accumulatedSeconds: Math.floor(s.sessionMs / 1000),
    runningSince: null,
    endedAt,
    reader: {
      documentId: s.documentId,
      effectiveMs: s.sessionMs,
      endPosition: s.page + 1,
      location: s.location,
      reaction: s.reaction,
      pendingVisits: [...s.pending],
    } satisfies ReaderDraft,
  };
}

export function resetLoggedReader<T extends ReaderSessionState>(
  state: T,
  savedId: string,
  endPosition: number,
  nextId: string,
  now: number,
) {
  if (state.sessionId !== savedId) return state;
  return {
    ...state,
    sessionId: nextId,
    startedAt: now,
    startPosition: endPosition,
    sessionMs: 0,
    paused: true,
    current: null,
    pending: state.pending.filter((visit) => visit.sessionId !== savedId),
    location: "",
    reaction: "",
  };
}
