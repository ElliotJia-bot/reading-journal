export type BookmarkEventName = "reading_started" | "page_completed" | "page_started" | "reading_paused" | "reading_resumed" | "navigation_limit" | "reading_ended";
export interface BookmarkEvent {
  event: BookmarkEventName;
  page: number;
  paused: boolean;
  elapsed_seconds: number;
  active_reading_seconds: number;
  paused_seconds: number;
  start_page?: number;
  completed_page?: number;
  new_page?: number;
  current_page?: number;
  last_page?: number;
  time_on_page_seconds?: number;
  visit_number?: number;
  navigation_reason?: "next" | "back" | "session_end";
  direction?: "next" | "back";
  forward_turns?: number;
  backward_turns?: number;
  total_active_seconds?: number;
  total_paused_seconds?: number;
  firmware_version?: string;
}
export interface BookmarkVisit {
  sequence: number;
  page: number;
  visitNumber: number;
  activeSeconds: number;
  rawSeconds: number;
  endedAt: number;
  reason: "next" | "back" | "session_end";
  corrected: boolean;
}
export interface BookmarkState {
  id: string;
  bookId: string;
  startPage: number;
  currentPage: number;
  firmwareStart: number;
  status: "waiting" | "reading" | "paused" | "ended";
  startedAt: number;
  endedAt: number | null;
  lastEventAt: number;
  lastSeenAt: number;
  connected: boolean;
  lastSequence: number;
  elapsedSeconds: number;
  activeSeconds: number;
  pausedSeconds: number;
  completedSeconds: number;
  completedVisits: number;
  visitedPages: number[];
  forwardTurns: number;
  backwardTurns: number;
  notice: string;
  savedAt?: number;
  interrupted?: boolean;
}
export function initialBookmark(id: string, bookId: string, startPage: number, now: number): BookmarkState {
  return { id, bookId, startPage, currentPage: startPage, firmwareStart: 1, status: "waiting", startedAt: now, endedAt: null, lastEventAt: now, lastSeenAt: 0, connected: false, lastSequence: 0, elapsedSeconds: 0, activeSeconds: 0, pausedSeconds: 0, completedSeconds: 0, completedVisits: 0, visitedPages: [], forwardTurns: 0, backwardTurns: 0, notice: "" };
}
export function bookmarkConnected(s: BookmarkState, now = Date.now()) {
  return s.connected && now - s.lastSeenAt < 15000;
}
export function bookmarkSeconds(s: BookmarkState, now = Date.now()) {
  // Only interpolate while the bridge reports an open serial connection. A new
  // device event replaces this display estimate with its device-time total.
  const end = Math.min(now, s.lastSeenAt + 15000);
  return Math.floor(s.activeSeconds + (s.status === "reading" && s.connected ? Math.max(0, end - s.lastEventAt) / 1000 : 0));
}
export function applyBookmarkEvent(previous: BookmarkState, event: BookmarkEvent, sequence: number, observedAt: number) {
  if (sequence !== previous.lastSequence + 1) throw new Error("Bookmark event sequence is out of order.");
  if (previous.status === "ended" || previous.savedAt) throw new Error("This bookmark session has ended. Pair a new session.");
  if (event.event === "reading_started" && previous.status !== "waiting") throw new Error("The bookmark restarted. Finish this session before pairing again.");
  if (event.event !== "reading_started" && previous.status === "waiting") throw new Error("Start the V2 program after connecting the bridge.");
  if (event.elapsed_seconds + 0.2 < previous.elapsedSeconds) throw new Error("Bookmark clock moved backwards. Pair a new session.");
  const s: BookmarkState = { ...previous, visitedPages: [...previous.visitedPages], lastSequence: sequence, elapsedSeconds: event.elapsed_seconds, lastSeenAt: observedAt, connected: true, notice: "" };
  if (event.event === "reading_started") {
    s.startedAt = observedAt - Math.round(event.elapsed_seconds * 1000);
    s.firmwareStart = event.start_page ?? event.page;
    s.status = "reading";
  }
  const mapPage = (p: number) => s.startPage + p - s.firmwareStart;
  s.currentPage = mapPage(event.page);
  if (s.currentPage < 1 || s.currentPage > 100000) throw new Error("Bookmark page is outside the supported range.");
  s.pausedSeconds = event.total_paused_seconds ?? event.paused_seconds;
  // V2's active_reading_seconds omits the currently-running interval on turns.
  const active = event.event === "reading_ended" ? event.total_active_seconds ?? event.active_reading_seconds
    : event.event === "page_completed" && event.navigation_reason === "session_end" ? event.active_reading_seconds
    : event.event === "reading_paused" || event.paused ? event.active_reading_seconds
      : Math.max(0, event.elapsed_seconds - s.pausedSeconds);
  if (active + 0.3 < previous.activeSeconds || active > event.elapsed_seconds + 0.3) throw new Error("Bookmark timing is inconsistent.");
  s.activeSeconds = Math.max(previous.activeSeconds, active);
  s.lastEventAt = s.startedAt + event.elapsed_seconds * 1000;
  let visit: BookmarkVisit | null = null;
  if (event.event === "page_completed") {
    if (event.time_on_page_seconds === undefined || !event.navigation_reason) throw new Error("Missing completed-page timing.");
    const page = mapPage(event.completed_page ?? event.page);
    // V2 end_session adds the last active interval twice to the last page visit.
    // Its session active total is correct. Use the remaining session time once.
    const seconds = event.navigation_reason === "session_end"
      ? Math.max(0, s.activeSeconds - previous.completedSeconds)
      : event.time_on_page_seconds;
    if (seconds > s.activeSeconds - previous.completedSeconds + 0.5) throw new Error("Page timing exceeds the session's active time.");
    visit = { sequence, page, visitNumber: event.visit_number ?? 1, activeSeconds: Math.round(seconds * 10) / 10, rawSeconds: event.time_on_page_seconds, endedAt: s.lastEventAt, reason: event.navigation_reason, corrected: Math.abs(seconds - event.time_on_page_seconds) > 0.15 };
    s.completedSeconds = Math.round((s.completedSeconds + visit.activeSeconds) * 10) / 10;
    s.completedVisits++;
    if (!s.visitedPages.includes(page)) s.visitedPages.push(page);
  }
  if (event.event === "page_started") {
    s.currentPage = mapPage(event.new_page ?? event.page);
    s.forwardTurns = event.forward_turns ?? s.forwardTurns + (event.direction === "next" ? 1 : 0);
    s.backwardTurns = event.backward_turns ?? s.backwardTurns + (event.direction === "back" ? 1 : 0);
  }
  if (event.event === "reading_paused") s.status = "paused";
  if (event.event === "reading_resumed") s.status = "reading";
  if (event.event === "navigation_limit") s.notice = "You are at the first page tracked in this V2 session.";
  if (event.event === "reading_ended") {
    s.status = "ended"; s.endedAt = Math.round(s.lastEventAt);
    s.forwardTurns = event.forward_turns ?? s.forwardTurns;
    s.backwardTurns = event.backward_turns ?? s.backwardTurns;
  }
  return { state: s, visit };
}
