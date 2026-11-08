import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useJournal } from "../../../lib/journal";
import { api } from "../../../lib/api";
import { Page, Button, styles, color, message } from "../../../components/ui";
import PassageAnalysis from "../../../components/passage-analysis";
import { summarizePages, type PageVisit } from "../../../../../shared/reader";
import { finishEstimate, pagesRead } from "../../../../../shared/metrics";
export default function SessionInsights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useJournal();
  return <SessionDetail key={`${user?.uid}:${id}`} />;
}
function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { books, sessions } = useJournal();
  const session = sessions.find((s) => s.id === id),
    book = books.find((b) => b.id === session?.bookId);
  const [visits, setVisits] = useState<PageVisit[]>([]),
    [limited, setLimited] = useState(false),
    [page, setPage] = useState<number | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!book?.reader) return;
    void api<{ visits: PageVisit[]; limited: boolean }>(
      `/v1/reader/books/${book.id}/visits`,
    )
      .then((r) => {
        if (active) {
          setError("");
          setVisits(r.visits.filter((v) => v.sessionId === id));
          setLimited(r.limited);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [book?.id, book?.reader, id, attempt]);
  if (!session || !book)
    return (
      <Page title="Session unavailable" back>
        <Text style={styles.body}>This session may have been removed.</Text>
      </Page>
    );
  const rows = summarizePages(visits),
    max = Math.max(...rows.map((r) => r.activeMs), 1),
    estimate = finishEstimate(
      book,
      sessions.filter((s) => s.bookId === book.id),
    ),
    pages = pagesRead(session);
  const comparable = rows.filter(
      (r) => r.activeMs >= 10000 && r.characters > 100,
    ),
    rates = comparable
      .map((r) => r.activeMs / r.characters)
      .sort((a, b) => a - b),
    median = rates.length >= 3 ? rates[Math.floor(rates.length / 2)] : null;
  return (
    <Page title="This reading moment" back>
      <Text style={styles.heading}>{book.title}</Text>
      <Text style={styles.muted}>
        {new Date(session.startedAt).toLocaleString()}
      </Text>
      <View style={styles.card}>
        <Text style={styles.title}>
          {Math.floor(session.durationSeconds / 60)}m{" "}
          {session.durationSeconds % 60}s
        </Text>
        <Text style={styles.body}>
          {pages === null
            ? `${session.startPosition}% → ${session.endPosition}%`
            : `Page ${session.startPosition} → ${session.endPosition} · ${pages} pages of forward progress`}
        </Text>
        <Text style={styles.muted}>
          {session.location || "No location recorded"} ·{" "}
          {session.reaction || "No reaction recorded"}
        </Text>
        {!!session.note && <Text style={styles.quote}>{session.note}</Text>}
        <Text style={styles.muted}>
          {estimate
            ? `Estimated ${estimate.minutes} minutes left in this book, based on ${estimate.sample} sessions. Pace may change.`
            : "A completion estimate needs 3 sessions over 3 minutes, at least 10 pages of progress, and a known page count."}
        </Text>
      </View>
      <Text style={styles.heading}>Page-by-page rhythm</Text>
      <Text style={styles.muted}>
        Tap a bar to see its passage. Ebook pages are fixed text sections in
        this imported edition, not printed pages. Foreground time excludes
        background and inactivity; it can include rereading.
      </Text>
      {loading && book.reader && (
        <Text style={styles.body}>Loading reading measurements…</Text>
      )}
      {!!error && (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button
            title="Retry measurements"
            secondary
            onPress={() => {
              setLoading(true);
              setAttempt(attempt + 1);
            }}
          />
        </>
      )}
      {(!loading || !book.reader) && !error && !rows.length && (
        <View style={styles.card}>
          <Text style={styles.body}>
            No page-level measurements for this session. Manual logs show the
            time and progress you entered; only the in-app ebook reader records
            page visits.
          </Text>
        </View>
      )}
      {limited && (
        <Text style={styles.muted}>
          Showing available measurements from this book’s latest 1,000 synced
          visits. Older visits may be missing.
        </Text>
      )}
      {rows.map((r) => (
        <Pressable
          key={r.page}
          accessibilityRole="button"
          accessibilityLabel={`Analyze page ${r.page + 1}`}
          onPress={() => setPage(r.page)}
          style={[
            styles.card,
            {
              borderWidth: 1,
              borderColor: page === r.page ? color.green : color.line,
            },
          ]}
        >
          <View style={styles.between}>
            <Text style={styles.body}>Page {r.page + 1}</Text>
            <Text style={styles.muted}>
              {Math.round(r.activeMs / 1000)}s · {r.visits} visit
              {r.visits === 1 ? "" : "s"}
            </Text>
          </View>
          <View
            style={{ height: 10, backgroundColor: color.line, borderRadius: 5 }}
          >
            <View
              style={{
                width: `${Math.max(1, (r.activeMs / max) * 100)}%`,
                height: 10,
                backgroundColor: color.green,
                borderRadius: 5,
              }}
            />
          </View>
          <Text style={styles.muted}>
            {median && r.activeMs >= 10000 && r.characters > 100
              ? `${(r.activeMs / r.characters / median).toFixed(1)}× the session’s median time per character. `
              : ""}
            {r.reactions.length
              ? `Your reactions: ${[...new Set(r.reactions)].join(", ")}`
              : "Tap to explore this passage"}
          </Text>
        </Pressable>
      ))}
      {page !== null && (
        <PassageAnalysis
          key={page}
          bookId={book.id}
          sessionId={id}
          page={page}
        />
      )}
      <Button
        title="Edit this reading log"
        secondary
        onPress={() =>
          router.push({ pathname: "/finish", params: { editId: id } })
        }
      />
      <Button
        title="View book Insights"
        onPress={() =>
          router.push({
            pathname: "/insights/book/[id]",
            params: { id: book.id },
          })
        }
      />
    </Page>
  );
}
