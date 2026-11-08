import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import ReadingShareCard from "./reading-share-card.web";
import type { CommunityHome, CommunityPost } from "../../../shared/community";

export interface QuoteSelection {
  quote: string;
  page: number;
  start: number;
  end: number;
}
export interface ReaderNote extends QuoteSelection {
  id: string;
  thought: string;
  createdAt: number;
  shared?: { id: string; circleId: string };
  attempt?: { id: string; circleId: string; displayName: string };
}
export default function ReaderNotes({
  uid,
  bookId,
  title,
  author,
  selection,
  notes,
  onSave,
  onGo,
}: {
  uid: string;
  bookId: string;
  title: string;
  author: string;
  selection: QuoteSelection | null;
  notes: ReaderNote[];
  onSave: (notes: ReaderNote[]) => void;
  onGo: (page: number) => void;
}) {
  const draftKey = `reader-note-draft:${uid}:${bookId}:${selection?.page ?? "none"}:${selection?.start ?? "none"}`;
  const [thought, setThought] = useState(
    () => localStorage.getItem(draftKey) || "",
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState<ReaderNote | null>(null);
  const [home, setHome] = useState<CommunityHome | null>(null);
  const [circleId, setCircleId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState<CommunityPost | null>(null);
  const publishing = useRef(false);
  const success = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (posted) success.current?.scrollIntoView({ block: "start" });
  }, [posted]);
  function editThought(value: string) {
    setThought(value);
    try {
      localStorage.setItem(draftKey, value);
    } catch {
      setError("This draft could not be saved. Keep this window open.");
    }
  }
  function saveNote() {
    if (!selection || !thought.trim()) return;
    try {
      const note = {
        ...selection,
        id: crypto.randomUUID(),
        thought: thought.trim(),
        createdAt: Date.now(),
      };
      onSave([note, ...notes]);
      setSaved(true);
      setError("");
      localStorage.removeItem(draftKey);
    } catch {
      setError(
        "Your note could not be saved. Keep this window open and try again.",
      );
    }
  }
  async function share(note: ReaderNote) {
    setSharing(note);
    setPosted(null);
    setError("");
    setBusy(true);
    try {
      const data = await api<CommunityHome>("/v1/community");
      setHome(data);
      setCircleId(
        note.attempt?.circleId ||
          data.circles.find((c) => c.joined)?.id ||
          data.circles[0].id,
      );
      setDisplayName(note.attempt?.displayName || data.displayName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load circles.");
    } finally {
      setBusy(false);
    }
  }
  async function openShared(note: ReaderNote) {
    if (!note.shared) return;
    setSharing(note);
    setPosted(null);
    setHome(null);
    setError("");
    setBusy(true);
    try {
      setPosted(
        await api<CommunityPost>(
          `/v1/community/circles/${note.shared.circleId}/posts/${note.shared.id}`,
        ),
      );
    } catch (e) {
      setSharing(null);
      setError(
        e instanceof Error ? e.message : "Unable to open this shared note.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/community/circles/${circleId}/membership`, "PUT", {
        active: true,
      });
      setHome(await api<CommunityHome>("/v1/community"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to join circle.");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!sharing || publishing.current) return;
    publishing.current = true;
    setBusy(true);
    setError("");
    try {
      const attempt = sharing.attempt ?? {
        id: crypto.randomUUID(),
        circleId,
        displayName: displayName.trim(),
      };
      const next = { ...sharing, attempt };
      // Save the delivery ID before sending so retry never creates a duplicate.
      onSave(notes.map((n) => (n.id === next.id ? next : n)));
      setSharing(next);
      const post = await api<CommunityPost>(
        `/v1/community/posts/${attempt.id}`,
        "PUT",
        {
          kind: "reflection",
          circleId: attempt.circleId,
          displayName: attempt.displayName,
          bookId,
          quote: next.quote,
          page: next.page,
          body: next.thought,
        },
      );
      setPosted(post);
      onSave(
        notes.map((n) =>
          n.id === next.id
            ? { ...next, shared: { id: post.id, circleId: post.circleId } }
            : n,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to publish. Retry with the same post.",
      );
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }
  const circle = home?.circles.find((c) => c.id === circleId);
  return (
    <div className="reader-notes">
      {!posted && (
        <p className="reader-muted">
          Your margin notes stay private on this device until you choose to
          share.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {sharing ? (
        <>
          {posted ? (
            <div ref={success}>
              <div role="status">
                <h3>Published ✓</h3>
                <p>Your reflection is now in your circle.</p>
              </div>
              <ReadingShareCard key={posted.id} post={posted} />
              <a
                href={`/community/post/${posted.id}?circleId=${posted.circleId}`}
              >
                View conversation →
              </a>
              <button
                onClick={() => {
                  setSharing(null);
                  setPosted(null);
                }}
              >
                Back to notes
              </button>
            </div>
          ) : (
            <>
              {home?.testMode && <p>Test community · isolated test space</p>}
              <blockquote>{sharing.quote}</blockquote>
              <p className="reader-muted">
                {title}
                {author ? ` · ${author}` : ""} · Reading page {sharing.page + 1}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{sharing.thought}</p>
              {!home && !busy && (
                <button onClick={() => void share(sharing)}>
                  Retry loading circles
                </button>
              )}
              {home && (
                <>
                  <label>
                    Choose a circle
                    <select
                      aria-label="Choose a circle"
                      value={circleId}
                      disabled={busy || !!sharing.attempt}
                      onChange={(e) => setCircleId(e.target.value)}
                    >
                      {home.circles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!circle?.joined && (
                    <button disabled={busy} onClick={() => void join()}>
                      Join {circle?.name}
                    </button>
                  )}
                  <label>
                    Your public display name
                    <input
                      aria-label="Your public display name"
                      maxLength={40}
                      value={displayName}
                      disabled={busy || !!sharing.attempt}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </label>
                  <p className="reader-muted">
                    Your quote and reflection will be visible to signed-in
                    readers in this circle.
                  </p>
                  <button
                    className="reader-primary"
                    disabled={busy || !circle?.joined || !displayName.trim()}
                    onClick={() => void publish()}
                  >
                    {busy
                      ? "Publishing…"
                      : sharing.attempt
                        ? "Retry publishing"
                        : "Publish to Circle"}
                  </button>
                </>
              )}
              <button
                disabled={busy}
                onClick={() => {
                  setSharing(null);
                  setHome(null);
                  setError("");
                }}
              >
                Keep private & back to notes
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {selection && !saved && (
            <>
              <blockquote>{selection.quote}</blockquote>
              <label>
                Your thoughts
                <textarea
                  aria-label="Your thoughts"
                  placeholder="What does this sentence bring to mind?"
                  maxLength={1200}
                  rows={5}
                  value={thought}
                  onChange={(e) => editThought(e.target.value)}
                />
              </label>
              <button
                className="reader-primary"
                disabled={!thought.trim()}
                onClick={saveNote}
              >
                Save private note
              </button>
            </>
          )}
          {saved && <p role="status">Note saved privately.</p>}
          {!notes.length && !selection && (
            <p>
              Long-press a sentence in the book, adjust the selection, then tap
              “Write a note”. On a computer, drag to select text.
            </p>
          )}
          {notes.map((note) => (
            <section className="margin-note" key={note.id}>
              <button className="reader-link" onClick={() => onGo(note.page)}>
                Reading page {note.page + 1} ↗
              </button>
              <blockquote>{note.quote}</blockquote>
              <p style={{ whiteSpace: "pre-wrap" }}>{note.thought}</p>
              {note.shared ? (
                <button disabled={busy} onClick={() => void openShared(note)}>
                  Share image
                </button>
              ) : (
                <button onClick={() => void share(note)}>
                  Share to a Circle
                </button>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
