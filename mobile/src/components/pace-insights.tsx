import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { Book, ReadingSession } from "../../../shared/domain";
import type { PageVisit } from "../../../shared/reader";
import { durationLabel, pagePace } from "../../../shared/reading-insights";
import { api } from "../lib/api";
import { Button, Chips, message, styles } from "./ui";
import { DetailFold, StatBlocks } from "./insight-blocks";
import PageTimeChart from "./page-time-chart";
import PassageAnalysis from "./passage-analysis";

export default function PaceInsights({
  book,
  sessions,
  sessionId,
}: {
  book: Book;
  sessions: ReadingSession[];
  sessionId?: string;
}) {
  const [visits, setVisits] = useState<PageVisit[]>([]),
    [limited, setLimited] = useState(false),
    [loading, setLoading] = useState(!!book.reader),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    if (!book.reader) return;
    void api<{ visits: PageVisit[]; limited: boolean }>(
      `/v1/reader/books/${book.id}/visits`,
    )
      .then((result) => {
        if (active) {
          setVisits(result.visits);
          setLimited(result.limited);
          setError("");
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
  }, [book.id, book.reader, attempt]);
  const ids = new Set(sessions.map((s) => s.id));
  const scoped = visits.filter(
    (v) => ids.has(v.sessionId) && (!sessionId || v.sessionId === sessionId),
  );
  const rows = pagePace(scoped);
  const slower = rows
    .filter((r) => r.slower)
    .sort((a, b) => b.relative! - a.relative!);
  const focus = slower.length
    ? slower
    : [...rows].sort((a, b) => b.activeMs - a.activeMs);
  const chosen = rows.find((r) => r.page === selected) ?? focus[0];
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.heading}>Where & why you slowed down</Text>
      {loading ? (
        <Text style={styles.muted}>Finding your reading moments…</Text>
      ) : error ? (
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
      ) : !chosen ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            No page timing in this {sessionId ? "session" : "period"}.
          </Text>
          <Text style={styles.muted}>
            Manual logs record total time. Read inside Remarked to explore
            individual pages.
          </Text>
        </View>
      ) : (
        <>
          {sessionId && (
            <PageTimeChart
              rows={rows}
              selected={chosen.page}
              onSelect={setSelected}
            />
          )}
          {!sessionId && (
            <Chips
              values={focus.slice(0, 3).map((r) => `Page ${r.page + 1}`)}
              value={`Page ${chosen.page + 1}`}
              onChange={(value) => setSelected(Number(value.slice(5)) - 1)}
            />
          )}
          <StatBlocks
            items={[
              {
                label: chosen.slower ? "Longer dwell" : "Selected passage",
                value: `Page ${chosen.page + 1}`,
                detail: durationLabel(chosen.activeMs / 1000) + " total",
              },
              {
                label: "Compared with other pages",
                value:
                  chosen.relative !== null
                    ? `${chosen.relative.toFixed(1)}×`
                    : "Not enough data",
                detail:
                  chosen.relative !== null
                    ? "time for the same amount of text"
                    : "Needs 3 other comparable pages",
              },
            ]}
          />
          <PassageAnalysis
            key={`${book.id}:${sessionId ?? "book"}:${chosen.page}`}
            bookId={book.id}
            page={chosen.page}
            sessionId={sessionId}
            sessionIds={[...new Set(scoped.map((v) => v.sessionId))]}
            reactions={chosen.reactions}
          />
          <DetailFold title="How this is measured">
            <Text style={styles.muted}>
              Bars show total foreground time per ebook section, including
              rereading. Comparisons use time per character, averaged across
              sessions in this view; at least 3 other pages are required. Rust
              means 1.5× or more. This identifies longer dwell, not a proven
              difficulty or cause.
            </Text>
          </DetailFold>
        </>
      )}
      {limited && (
        <Text style={styles.muted}>
          Latest 1,000 visits available; older page measurements may be missing.
        </Text>
      )}
    </View>
  );
}
