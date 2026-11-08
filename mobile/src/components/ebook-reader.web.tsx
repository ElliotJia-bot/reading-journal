import React, { useCallback, useEffect, useRef, useState } from "react";
import ReaderSheet from "./reader-sheet.web";
import ReaderNotes, {
  type ReaderNote,
  type QuoteSelection,
} from "./reader-notes.web";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useJournal, type Book } from "../lib/journal";
import { api } from "../lib/api";
import { hashText } from "../lib/ebook.web";
import { loadReadableEbook } from "../lib/shared-ebook.web";
import {
  countedMs,
  textFeatures,
  summarizePages,
  type Ebook,
  type PageVisit,
  type PassageReport,
} from "../../../shared/reader";

import {
  qualifiesForReadingLog,
  readerLogDraft,
  resetLoggedReader,
} from "../../../shared/reader-session";

interface ReadingState {
  documentId: string;
  page: number;
  bookmarks: number[];
  size: number;
  theme: "Paper" | "Night";
  font?: "Serif" | "Sans";
  paused: boolean;
  current: PageVisit | null;
  pending: PageVisit[];
  sessionId: string;
  startedAt: number;
  startPosition: number;
  sessionMs: number;
  location: string;
  reaction: string;
}
function stop(s: ReadingState, now = Date.now()): ReadingState {
  return {
    ...s,
    paused: true,
    current: null,
    pending:
      s.current && s.current.activeMs > 0
        ? [...s.pending, { ...s.current, endedAt: now }]
        : s.pending,
  };
}
const buttonStyle: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  border: "1px solid #c4b7a9",
  borderRadius: 10,
  padding: "12px 15px",
  background: "#f0eae3",
  color: "#003422",
  cursor: "pointer",
  minHeight: 44,
};
export default function EbookReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, books, sessions, timer, updateTimer, loading, refresh } = useJournal();
  const [exitReady, setExitReady] = useState(false);
  const leaving = useRef(false);
  const handingOff = useRef(false);
  const book = books.find((b) => b.id === id);
  const [ebook, setEbook] = useState<Ebook | null>(null),
    [state, setState] = useState<ReadingState | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [history, setHistory] = useState<PageVisit[]>([]),
    [sheet, setSheet] = useState<
      | "tools"
      | "appearance"
      | "notes"
      | "contents"
      | "insights"
      | "finish"
      | null
    >(null),
    [consent, setConsent] = useState(false),
    [report, setReport] = useState<PassageReport | null>(null);
  const core = useRef<ReadingState | null>(null),
    lastTick = useRef(0),
    lastInteraction = useRef(0);
  const [selection, setSelection] = useState<QuoteSelection | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [notes, setNotes] = useState<ReaderNote[]>([]);
  const notesRef = useRef<ReaderNote[]>([]);
  const article = useRef<HTMLElement | null>(null);
  const autoStarted = useRef("");
  const loadedKey = useRef("");
  const scrollContainer = useRef<HTMLDivElement | null>(null);
  const [displayKey, setDisplayKey] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (loading || !user || !book || book.reader || !book.cloudEbook) return;
    let cancelled = false;
    void api<{ book: Book | null }>(`/v1/catalog/books/${book.id}/open`, "POST")
      .then(async result => {
        if (cancelled) return;
        if (!result.book) throw new Error("This ebook is no longer available.");
        if (result.book.id !== book.id)
          router.replace({ pathname: "/reader/[id]", params: { id: result.book.id } });
        await refresh();
      }).catch(e => { if (!cancelled) { setError(String(e.message)); setReady(true); } });
    return () => { cancelled = true; };
  }, [loading, user, book, refresh, loadAttempt]);
  const key = `ebook-state:${user?.uid}:${id}`;
  const disablePrevention = usePreventRemove(
    !exitReady &&
      !(timer?.reader && timer.bookId === id) &&
      qualifiesForReadingLog(state?.sessionMs ?? 0),
    () => {
      void task(finish);
    },
  );
  const commit = useCallback(
    (next: ReadingState) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        next = { ...next, paused: true };
        setError(
          "Device storage is full. Keep this page open and sync your records before continuing.",
        );
      }
      core.current = next;
      setState(next);
    },
    [key],
  );
  useEffect(() => {
    let cancelled = false;
    if (loading || !user || !book?.reader || loadedKey.current === key) return;
    Promise.all([
      loadReadableEbook(user.uid, id, book.reader.documentId),
      api<{ visits: PageVisit[] }>(`/v1/reader/books/${id}/visits`).catch(
        () => ({ visits: [] }),
      ),
    ])
      .then(([local, remote]) => {
        if (cancelled) return;
        setHistory(remote.visits);
        setReady(true);
        setDisplayKey(key);
        if (!local) return;
        if (local.documentId !== book.reader!.documentId)
          throw new Error("Import the same edition again to continue.");
        const saved = localStorage.getItem(key);
        let prior: ReadingState | null = null;
        try {
          prior = saved ? JSON.parse(saved) : null;
        } catch {
          /* Start from synced progress if local state is corrupt. */
        }
        let next =
          prior?.documentId === local.documentId
            ? stop(prior)
            : {
                documentId: local.documentId,
                page: Math.min(book.position, local.pages.length - 1),
                bookmarks: [],
                size: 21,
                theme: "Paper" as const,
                paused: true,
                current: null,
                pending: [],
                sessionId: crypto.randomUUID(),
                startedAt: Date.now(),
                startPosition: book.position,
                sessionMs: 0,
                location: "",
                reaction: "",
              };
        const logged = sessions.find(
          (session) => session.id === next.sessionId,
        );
        if (logged)
          next = resetLoggedReader(
            next,
            logged.id,
            logged.endPosition,
            crypto.randomUUID(),
            Date.now(),
          );
        loadedKey.current = key;
        try {
          notesRef.current = JSON.parse(
            localStorage.getItem(`reader-notes:${user.uid}:${id}`) || "[]",
          );
        } catch {
          notesRef.current = [];
        }
        setNotes(notesRef.current);
        setEbook(local);
        commit(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e.message));
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, id, book, key, commit, loading, sessions, loadAttempt]);
  useEffect(() => {
    if (!ebook) return;
    const tick = () => {
      const now = Date.now(),
        s = core.current;
      if (!s) return;
      const elapsed = countedMs(
        lastTick.current,
        now,
        lastInteraction.current,
        document.visibilityState === "visible",
        s.paused,
      );
      const gap = now - lastTick.current;
      lastTick.current = now;
      if (s.paused || !s.current) return;
      let next = {
        ...s,
        sessionMs: s.sessionMs + elapsed,
        current: { ...s.current, activeMs: s.current.activeMs + elapsed },
      };
      if (
        now - lastInteraction.current >= 90000 ||
        document.visibilityState !== "visible" ||
        gap > 5000
      ) {
        next = stop(next) as typeof next;
        setNotice("Paused while away or inactive. Resume when you are ready.");
      }
      commit(next);
    };
    const away = () => {
      tick();
      if (core.current) commit(stop(core.current));
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") away();
    };
    const interact = () => {
      lastInteraction.current = Date.now();
    };
    const interval = setInterval(tick, 1000);
    window.addEventListener("blur", away);
    window.addEventListener("pagehide", away);
    document.addEventListener("visibilitychange", visibility);
    for (const event of ["pointerdown", "keydown", "scroll"])
      window.addEventListener(event, interact, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("blur", away);
      window.removeEventListener("pagehide", away);
      document.removeEventListener("visibilitychange", visibility);
      for (const event of ["pointerdown", "keydown", "scroll"])
        window.removeEventListener(event, interact, true);
      if (core.current) {
        const stopped = stop(core.current);
        core.current = stopped;
        try {
          localStorage.setItem(key, JSON.stringify(stopped));
        } catch {
          /* The visible storage error already asks the user to sync. */
        }
      }
    };
  }, [ebook, key, commit]);
  const resume = useCallback(
    async (s = core.current) => {
      if (!s || !ebook || !s.paused || handingOff.current || leaving.current)
        return;
      if (timer)
        throw new Error(
          "Finish the timer in your library before starting the ebook timer.",
        );
      const page = ebook.pages[s.page],
        now = Date.now(),
        features = textFeatures(page.text);
      const textHash = await hashText(page.text);
      if (core.current !== s || document.visibilityState !== "visible") return;
      lastTick.current = Date.now();
      lastInteraction.current = Date.now();
      commit({
        ...s,
        paused: false,
        startedAt: s.sessionMs ? s.startedAt : now,
        current: {
          id: crypto.randomUUID(),
          sessionId: s.sessionId,
          documentId: ebook.documentId,
          page: s.page,
          chapter: page.chapter,
          start: page.start,
          end: page.end,
          textHash,
          startedAt: now,
          endedAt: now,
          activeMs: 0,
          words: features.words,
          characters: features.characters,
          reaction: "",
        },
      });
      setNotice("");
    },
    [ebook, timer, commit],
  );
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  function sync() {
    const request = syncQueue.current.catch(() => {}).then(flushVisits);
    syncQueue.current = request;
    return request;
  }
  async function flushVisits() {
    const pending = core.current?.pending ?? [];
    for (const visit of pending) {
      const { id: visitId, ...body } = visit;
      await api(`/v1/reader/books/${id}/visits/${visitId}`, "PUT", body);
      const latest = core.current;
      if (latest)
        commit({
          ...latest,
          pending: latest.pending.filter((v) => v.id !== visitId),
        });
    }
    setHistory((previous) =>
      [
        ...new Map([...previous, ...pending].map((v) => [v.id, v])).values(),
      ].slice(-1000),
    );
  }
  async function task(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function move(page: number) {
    const current = core.current;
    if (!current || !ebook) return;
    const next = { ...stop(current), page };
    commit(next);
    setSheet(null);
    setSelection(null);
    setSelectionError("");
    scrollContainer.current?.scrollTo({ top: 0, behavior: "auto" });
    setConsent(false);
    setNotice("");
    await resume(next);
    // Events are saved locally before the upload; failed sync can be retried.
    void sync().catch(() =>
      setNotice("Saved on this device. Open reading tools to retry syncing."),
    );
  }
  async function finish() {
    if (!core.current || !book || handingOff.current) return;
    const now = Date.now();
    commit(stop(core.current, now));
    const draft = readerLogDraft(core.current, id, now);
    if (!draft) {
      setSheet("finish");
      return;
    }
    if (timer && timer.id !== draft.id)
      throw new Error(
        "Save your other reading session from the library first. This reading draft is safe on this device.",
      );
    handingOff.current = true;
    try {
      // Persist the handoff before navigating, even without a connection.
      await updateTimer(draft);
      leaving.current = true;
      setExitReady(true);
      disablePrevention();
      router.replace({
        pathname: "/finish",
        params: { bookId: id, readerSession: draft.id },
      });
    } finally {
      handingOff.current = false;
    }
  }
  useEffect(() => {
    if (!loading && timer?.reader && timer.bookId === id && !leaving.current) {
      leaving.current = true;
      disablePrevention();
      router.replace({
        pathname: "/finish",
        params: { bookId: id, readerSession: timer.id },
      });
    }
  }, [timer, loading, id, disablePrevention]);
  useEffect(() => {
    if (ebook && state && displayKey === key && autoStarted.current !== key) {
      autoStarted.current = key;
      void resume().catch((e) => setError(e.message));
    }
  }, [ebook, state, displayKey, key, resume]);
  useEffect(() => {
    const select = () => {
      const selected = window.getSelection();
      if (
        !selected ||
        selected.isCollapsed ||
        !selected.rangeCount ||
        !article.current
      )
        return;
      const range = selected.getRangeAt(0);
      if (
        !article.current.contains(range.startContainer) ||
        !article.current.contains(range.endContainer)
      )
        return;
      const raw = selected.toString(),
        quote = raw.trim();
      if (!quote) return;
      if (quote.length > 600) {
        setSelection(null);
        setSelectionError("Choose a shorter passage (up to 600 characters).");
        return;
      }
      const prefix = range.cloneRange();
      prefix.selectNodeContents(article.current);
      prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length + raw.indexOf(quote);
      const current = core.current;
      if (!current) return;
      setSelection({
        quote,
        page: current.page,
        start,
        end: start + quote.length,
      });
      setSelectionError("");
      if (!current.paused) commit(stop(current));
    };
    document.addEventListener("selectionchange", select);
    return () => document.removeEventListener("selectionchange", select);
  }, [commit]);
  function openSheet(next: NonNullable<typeof sheet>) {
    if (core.current) commit(stop(core.current));
    setSheet(next);
    void task(sync);
  }
  function closeSheet() {
    setSheet(null);
    setSelection(null);
    setSelectionError("");
    window.getSelection()?.removeAllRanges();
    void task(() => resume());
  }
  function saveNotes(next: ReaderNote[]) {
    const merged = [
      ...new Map(
        [...notesRef.current, ...next].map((note) => [note.id, note]),
      ).values(),
    ].sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(
      `reader-notes:${user!.uid}:${id}`,
      JSON.stringify(merged),
    );
    notesRef.current = merged;
    setNotes(merged);
  }
  if (loading) return <div style={{ padding: 32 }}>Opening your reader…</div>;
  if (!user)
    return (
      <div style={{ padding: 32 }}>
        <a href="/">Sign in to open your reader</a>
      </div>
    );
  if (!ebook || !state || !book || displayKey !== key)
    return (
      <div style={{ padding: 32, fontFamily: "sans-serif", color: "#003422" }}>
        <h1>Ebook Reader</h1>
        <p>
          {error ||
            (ready
              ? "Import this ebook on this device to read it here. Your saved records are already in your account."
              : "Opening ebook…")}
        </p>
        {!!error && (book?.reader || book?.cloudEbook) && <button style={buttonStyle} onClick={() => { setError(""); setReady(false); setLoadAttempt(n => n + 1); }}>Try opening again</button>}
        <button style={buttonStyle} onClick={() => router.push("/add-book")}>
          Import EPUB or TXT
        </button>
      </div>
    );
  const page = ebook.pages[state.page],
    features = textFeatures(page.text);
  const all = [
    ...new Map(
      [
        ...history,
        ...state.pending,
        ...(state.current ? [state.current] : []),
      ].map((v) => [v.id, v]),
    ).values(),
  ];
  const summaries = summarizePages(all),
    thisPage = summaries.find((p) => p.page === state.page);
  const night = state.theme === "Night",
    ink = night ? "#f0eae3" : "#4b3c35",
    paper = night ? "#10271e" : "#f8f5f0";
  const pageNotes = notes.filter((n) => n.page === state.page);
  const points = [
    ...new Set([
      0,
      page.text.length,
      ...pageNotes.flatMap((n) => [n.start, n.end]),
    ]),
  ]
    .filter((n) => n >= 0 && n <= page.text.length)
    .sort((a, b) => a - b);
  const markedText = points.slice(0, -1).map((start, i) => {
    const end = points[i + 1],
      marked = pageNotes.some((n) => n.start <= start && n.end >= end);
    return marked ? (
      <mark key={start}>{page.text.slice(start, end)}</mark>
    ) : (
      <React.Fragment key={start}>{page.text.slice(start, end)}</React.Fragment>
    );
  });
  return (
    <div className="immersive-reader" style={{ background: paper, color: ink }}>
      <style>{readerCss}</style>
      <div ref={scrollContainer} className="reader-scroll">
        <header className="reading-running-head">
          <button
            className="reader-exit"
            aria-label="Finish reading and leave"
            disabled={busy}
            onClick={() => void task(finish)}
          >
            ‹
          </button>
          {book.title} <span> / {page.chapter}</span>
        </header>
        <article
          ref={article}
          aria-label="Book text"
          style={{
            fontSize: state.size,
            fontFamily:
              state.font === "Sans"
                ? "PlusJakartaSans_400Regular,sans-serif"
                : "Newsreader_400Regular,Georgia,serif",
          }}
        >
          {markedText}
        </article>
        <p className="reading-end">
          {state.page === ebook.pages.length - 1 ? (
            <button
              className="reader-end-button"
              disabled={busy}
              onClick={() => void task(finish)}
            >
              End of book · Finish & log
            </button>
          ) : (
            "· · ·"
          )}
        </p>
      </div>
      {!!error && (
        <div className="reader-toast" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {selectionError && (
        <div className="reader-toast" role="status">
          {selectionError}
          <button onClick={() => setSelectionError("")}>Dismiss</button>
        </div>
      )}
      {selection && !sheet && (
        <div className="selection-actions">
          <button className="reader-primary" onClick={() => openSheet("notes")}>
            ✎ Write a note
          </button>
          <button
            aria-label="Cancel text selection"
            onClick={() => {
              setSelection(null);
              window.getSelection()?.removeAllRanges();
              void task(() => resume());
            }}
          >
            ✕
          </button>
        </div>
      )}
      <footer className="reader-footer">
        <button
          aria-label="Previous page"
          disabled={busy || state.page === 0}
          onClick={() => void task(() => move(state.page - 1))}
        >
          ‹
        </button>
        <span>
          {state.page + 1} / {ebook.pages.length}
        </span>
        <button
          aria-label="Open reading tools"
          title="Reading tools"
          onClick={() => openSheet("tools")}
        >
          ☰
        </button>
        {state.paused && !sheet && !selection && (
          <button
            aria-label="Resume reading"
            title="Resume reading"
            onClick={() => void task(() => resume())}
          >
            ▷
          </button>
        )}
        <button
          aria-label="Next page"
          disabled={busy || state.page === ebook.pages.length - 1}
          onClick={() => void task(() => move(state.page + 1))}
        >
          ›
        </button>
      </footer>
      {sheet && (
        <ReaderSheet
          title={
            {
              tools: "Your reading space",
              appearance: "Make yourself comfortable",
              notes: "In the margins",
              contents: "Chapters & bookmarks",
              insights: "Reading insights",
              finish: "A reading moment, kept",
            }[sheet]
          }
          onClose={closeSheet}
        >
          {sheet === "tools" && (
            <>
              {!!notice && (
                <p className="reader-muted" role="status">
                  {notice}
                </p>
              )}
              <p className="reader-muted">
                {book.title} · {Math.floor(state.sessionMs / 60000)} min this
                session
              </p>
              <div className="reading-tools">
                <button onClick={() => setSheet("appearance")}>
                  <span>Aa</span>Appearance
                </button>
                <button
                  onClick={() => {
                    setSelection(null);
                    setSheet("notes");
                  }}
                >
                  <span>✎</span>Notes ({notes.length})
                </button>
                <button onClick={() => setSheet("contents")}>
                  <span>☷</span>Contents
                </button>
                <button
                  onClick={() =>
                    commit({
                      ...state,
                      bookmarks: state.bookmarks.includes(state.page)
                        ? state.bookmarks.filter((p) => p !== state.page)
                        : [...state.bookmarks, state.page],
                    })
                  }
                >
                  <span>
                    {state.bookmarks.includes(state.page) ? "★" : "☆"}
                  </span>
                  {state.bookmarks.includes(state.page)
                    ? "Bookmarked"
                    : "Bookmark"}
                </button>
                <button onClick={() => setSheet("insights")}>
                  <span>⌁</span>Insights
                </button>
                <button disabled={busy} onClick={() => void task(finish)}>
                  <span>✓</span>Finish & log
                </button>
              </div>
              <p className="reader-muted">
                Long-press text to write a margin note. Reading pauses while
                tools are open.
              </p>
              <button className="reader-primary" onClick={closeSheet}>
                Continue reading
              </button>
              <button disabled={busy} onClick={() => void task(finish)}>
                Back to Library
              </button>
            </>
          )}
          {sheet === "appearance" && (
            <>
              <label>
                Font
                <select
                  aria-label="Font"
                  value={state.font || "Serif"}
                  onChange={(e) =>
                    commit({
                      ...state,
                      font: e.target.value as "Serif" | "Sans",
                    })
                  }
                >
                  <option value="Serif">Literary serif</option>
                  <option value="Sans">Simple sans serif</option>
                </select>
              </label>
              <label>
                Text size
                <select
                  aria-label="Text size"
                  value={state.size}
                  onChange={(e) =>
                    commit({ ...state, size: Number(e.target.value) })
                  }
                >
                  {[18, 21, 24, 28].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="theme-options">
                {(["Paper", "Night"] as const).map((theme) => (
                  <button
                    aria-pressed={state.theme === theme}
                    key={theme}
                    onClick={() => commit({ ...state, theme })}
                  >
                    {theme === "Paper" ? "☀" : "☾"} {theme}
                  </button>
                ))}
              </div>
              <p
                style={{
                  fontFamily:
                    state.font === "Sans" ? "sans-serif" : "Georgia,serif",
                  fontSize: state.size,
                  lineHeight: 1.8,
                }}
              >
                A little time. A new chapter.
              </p>
            </>
          )}
          {sheet === "contents" && (
            <>
              <label>
                Chapter and page
                <select
                  aria-label="Chapter and page"
                  value={state.page}
                  disabled={busy}
                  onChange={(e) =>
                    void task(async () => {
                      await move(Number(e.target.value));
                      await resume();
                    })
                  }
                >
                  {ebook.pages.map((p, i) => (
                    <option key={i} value={i}>
                      Page {i + 1} · {p.chapter}
                      {state.bookmarks.includes(i) ? " ★" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <h3>Your bookmarks</h3>
              {state.bookmarks.length ? (
                state.bookmarks.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      void task(async () => {
                        await move(p);
                        await resume();
                      })
                    }
                  >
                    ★ Page {p + 1} · {ebook.pages[p].chapter}
                  </button>
                ))
              ) : (
                <p className="reader-muted">
                  Save a bookmark from reading tools.
                </p>
              )}
            </>
          )}
          {sheet === "notes" && (
            <ReaderNotes
              key={`${user.uid}:${id}:${selection?.page}:${selection?.start}`}
              uid={user.uid}
              bookId={id}
              title={book.title}
              author={book.author}
              selection={selection}
              notes={notes}
              onSave={saveNotes}
              onGo={(p) =>
                void task(async () => {
                  await move(p);
                  await resume();
                })
              }
            />
          )}
          {sheet === "insights" && (
            <section>
              <h3>What happened on this page?</h3>
              <p>
                {Math.round((thisPage?.activeMs ?? 0) / 1000)} seconds
                foreground dwell · {thisPage?.visits ?? 0} visits ·{" "}
                {features.characters} characters
              </p>
              {!features.hasCjk && (
                <p className="reader-muted">
                  {features.words} words · {features.averageWordsPerSentence}{" "}
                  words / sentence · {features.longEnglishWordPercent ?? 0}% of
                  English words have 8+ letters
                </p>
              )}
              <p className="reader-muted">
                These are stable text sections, not print pages. Timing pauses
                when away, while tools are open, or after 90 seconds without
                interaction. Dwell and word length are descriptive proxies, not
                comprehension or difficulty scores.
              </p>
              <h3>Reading map</h3>
              <p className="reader-muted">
                Latest 1,000 synced events. Compare at least three substantial
                pages before drawing a pattern.
              </p>
              {summaries
                .filter((p) => p.activeMs > 0)
                .sort(
                  (a, b) =>
                    b.activeMs / b.characters - a.activeMs / a.characters,
                )
                .slice(0, 8)
                .map((p) => (
                  <button
                    key={p.page}
                    disabled={busy}
                    onClick={() =>
                      void task(async () => {
                        await move(p.page);
                        await resume();
                      })
                    }
                  >
                    Page {p.page + 1} · {Math.round(p.activeMs / 1000)}s ·{" "}
                    {(
                      (p.activeMs / 1000 / Math.max(1, p.characters)) *
                      100
                    ).toFixed(1)}
                    s / 100 characters
                  </button>
                ))}
              <h3>Analyze this passage</h3>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                Send this page’s text, timing, and reactions to Thinking
                Machines via our backend. The analysis and short quotes are
                saved privately; the whole book stays on this device.
              </label>
              <button
                disabled={busy || !consent || !thisPage?.activeMs}
                onClick={() =>
                  void task(async () => {
                    await sync();
                    setReport(
                      await api<PassageReport>(
                        `/v1/reader/books/${id}/analyze`,
                        "POST",
                        { page: state.page, text: page.text, consent: true },
                      ),
                    );
                  })
                }
              >
                {busy ? "Working…" : "Analyze current page"}
              </button>
              {report?.page === state.page && (
                <div aria-label="Passage analysis">
                  <p className="reader-muted">
                    Generated {new Date(report.generatedAt).toLocaleString()} ·
                    observations, not proven causes
                  </p>
                  {report.result.observations.map((o) => (
                    <div key={o.dimension}>
                      <h4 style={{ textTransform: "capitalize" }}>
                        {o.dimension}
                      </h4>
                      <p>{o.explanation}</p>
                      {o.quote && <blockquote>“{o.quote}”</blockquote>}
                    </div>
                  ))}
                  <h4>Possible reasons · not a diagnosis</h4>
                  {report.result.possibleReasons.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                  <h4>Interest signals</h4>
                  {report.result.interestSignals.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                  <h4>Try next</h4>
                  <p>{report.result.nextStep}</p>
                  <p className="reader-muted">{report.result.uncertainty}</p>
                </div>
              )}
            </section>
          )}
          {sheet === "finish" && (
            <>
              <p>
                {Math.floor(state.sessionMs / 60000)} min{" "}
                {Math.floor(state.sessionMs / 1000) % 60} sec of active reading
              </p>
              <p className="reader-muted">
                Read for more than 3 minutes to finish and log. This short visit
                is kept as a draft on this device, ready to continue next time.
              </p>
              <button className="reader-primary" onClick={closeSheet}>
                Continue reading
              </button>
              <button
                onClick={() => {
                  leaving.current = true;
                  setExitReady(true);
                  disablePrevention();
                  router.replace({ pathname: "/book/[id]", params: { id } });
                }}
              >
                Keep draft & leave
              </button>
            </>
          )}
          {!!error && <p role="alert">{error}</p>}
        </ReaderSheet>
      )}
    </div>
  );
}

const readerCss = `
.immersive-reader { height:100vh; height:100dvh; overflow:hidden; position:relative; font-family:PlusJakartaSans_400Regular,sans-serif; }
.immersive-reader * {box-sizing:border-box;}
.reader-exit { position:absolute; left:14px; top:10px; background:transparent; color:inherit; border:0; font-size:28px; min-width:44px; min-height:44px; cursor:pointer; }
.reader-end-button { background:transparent; color:inherit; border:0; font:inherit; padding:16px; cursor:pointer; }
.reader-scroll {height:100%;overflow-y:auto;padding: max(28px,env(safe-area-inset-top)) 28px 110px;scrollbar-width:thin;}
.reading-running-head {max-width:640px;margin:0 auto 38px;text-align:center;font-size:10px;letter-spacing:.1em;opacity:.48;line-height:1.6;}
.reader-scroll article {max-width:640px;margin:0 auto;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text;}
.reader-scroll mark {background:#ee9c9140;color:inherit;border-bottom:1px solid #984d4266;}
.reading-end {text-align:center;opacity:.4;font-size:12px;letter-spacing:.25em;margin:40px 0 10px;}
.reader-footer {position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:20px;background:inherit;padding:10px 12px max(12px,env(safe-area-inset-bottom));font-size:11px;}
.reader-footer button {border:0;background:none;color:inherit;opacity:.55;font-size:23px;width:44px;height:44px;cursor:pointer;border-radius:50%;}
.reader-footer button:hover {background:#8881;opacity:1;}
.reader-footer button:disabled {opacity:.15;}
.reader-footer span {opacity:.45;letter-spacing:.08em;}
.reader-sheet {position:fixed;inset:auto 0 0;margin:0 auto;width:min(100%,680px);max-height:82dvh;overflow:auto;border:0;border-radius:24px 24px 0 0;padding:12px 24px max(28px,env(safe-area-inset-bottom));background:#f8f5f0;color:#4b3c35;box-shadow:0 -8px 60px #0002;}
.reader-sheet::backdrop {background:#00342266;backdrop-filter:blur(3px);}
.sheet-handle {width:36px;height:4px;border-radius:4px;background:#d9cfc3;margin:0 auto 20px;}
.sheet-heading {display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;}
.sheet-heading h2 {font:normal 27px Newsreader_400Regular,Georgia,serif;margin:0;}
.reader-sheet button,.selection-actions button,.reader-toast button {font:inherit;font-size:13px;min-height:44px;border:1px solid #ded5cb;border-radius:12px;background:#f0eae3;color:#003422;padding:10px 16px;cursor:pointer;margin:4px 6px 4px 0;}
.reader-sheet button:disabled {opacity:.45;cursor:default;}
.reader-sheet .reader-primary,.selection-actions .reader-primary {background:#003422;color:#fff;border-color:#003422;}
.reader-sheet input,.reader-sheet select,.reader-sheet textarea {font:inherit;font-size:15px;padding:12px;border:1px solid #ded5cb;border-radius:10px;background:#fffdfa;color:#4b3c35;max-width:100%;}
.reader-sheet select,.reader-sheet textarea,.reader-sheet input:not([type=checkbox]) {display:block;width:100%;margin:10px 0 20px;}
.reader-sheet label {display:block;font-size:13px;line-height:1.6;margin-top:12px;}
.reader-muted {font-size:12px;line-height:1.7;color:#706158;}
.reading-tools {display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0;}
.reading-tools button {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px 4px;min-height:90px;margin:0;background:#f0eae3;border:0;font-size:11px;}
.reading-tools span {font:24px Georgia,serif;}
.reader-sheet blockquote {font:22px/1.6 Newsreader_400Regular,Georgia,serif;border-left:2px solid #ee9c91;padding-left:16px;margin:20px 0;white-space:pre-wrap;overflow-wrap:anywhere;}
.margin-note {border-top:1px solid #ded5cb;margin-top:24px;padding-top:18px;}
.reader-sheet .reader-link {border:0;background:none;font-size:11px;padding:0;color:#706158;}
.reader-sheet a {color:#003422;display:inline-block;padding:12px 0;}
.selection-actions,.reader-toast {position:absolute;bottom:84px;left:50%;transform:translateX(-50%);background:#f8f5f0;color:#4b3c35;box-shadow:0 4px 24px #0002;padding:8px 12px;border-radius:18px;max-width:calc(100% - 24px);width:max-content;font-size:13px;z-index:2;}
.reader-toast {max-width:360px;width:calc(100% - 32px);}
.reader-sheet button:focus-visible,.reader-footer button:focus-visible {outline:2px solid #984d42;outline-offset:3px;}
@media(min-width:800px) {.reader-scroll {padding-top:46px;}.reading-running-head {margin-bottom:50px;}.reader-footer {gap:40px;}}
@media(prefers-reduced-motion:no-preference) {.reader-sheet {animation:reader-sheet-in .2s ease-out;}@keyframes reader-sheet-in {from{transform:translateY(30px);opacity:.5;}to{transform:translateY(0);opacity:1;}}}
`;
