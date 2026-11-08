import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Book, ReadingSession } from "../../../shared/domain";
import type { PageVisit } from "../../../shared/reader";
import {
  rangeLabel,
  readingRhythmOverview,
  rhythmDifference,
} from "../../../shared/book-insights";
import { api } from "../lib/api";
import { Button, color, message, styles } from "./ui";
import { DetailFold } from "./insight-blocks";
import ReadingRhythmChart from "./reading-rhythm-chart";
import PassageAnalysis from "./passage-analysis";
export default function BookReadingRhythm({
  book,
  sessions,
}: {
  book: Book;
  sessions: ReadingSession[];
}) {
  const [visits, setVisits] = useState<PageVisit[]>([]),
    [loading, setLoading] = useState(!!book.reader),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [limited, setLimited] = useState(false);
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
  const data = useMemo(
      () => readingRhythmOverview(book, sessions, visits),
      [book, sessions, visits],
    ),
    scope = [...new Set(data.points.flatMap((p) => p.sessionIds))];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 5 }}>
        <Text style={[styles.label, { marginBottom: 0, letterSpacing: 1.4 }]}>
          PACE & PATTERNS
        </Text>
        <Text style={styles.heading}>Your reading rhythm</Text>
      </View>
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
      ) : (
        <>
          {!!data.comparable && (
            <ReadingRhythmChart
              points={data.points}
              ranges={data.ranges}
              reader={data.source === "reader"}
            />
          )}
          {!data.ranges.length && (
            <View style={styles.card}>
              <Text style={styles.body}>
                {data.comparable
                  ? "A steady rhythm so far."
                  : "Your reading pattern is still taking shape."}
              </Text>
              <Text style={styles.muted}>
                {data.comparable
                  ? "No standout quicker or longer stretches in this period."
                  : book.reader
                    ? "Save a session with at least 4 comparable pages to reveal your rhythm."
                    : "Log at least 4 sittings with page progress to compare stretches of this book."}
              </Text>
            </View>
          )}
          {data.ranges.map((r) => {
            const quicker = r.direction === "quicker";
            const accent = quicker ? color.green : color.rust;
            return (
              <View
                key={r.key}
                style={[
                  styles.card,
                  {
                    padding: 18,
                    borderLeftWidth: 3,
                    borderLeftColor: accent,
                    backgroundColor: quicker ? "#eef3ed" : "#f7eee8",
                    gap: 10,
                  },
                ]}
              >
                <Text style={[styles.label, { color: accent, marginBottom: 0 }]}>
                  {quicker ? "QUICKER STRETCH" : "MORE TIME HERE"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text style={styles.heading}>{rangeLabel(r.start, r.end)}</Text>
                  <View
                    style={{
                      backgroundColor: quicker ? "#dce8da" : "#f2ded3",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={[styles.muted, { color: accent }]}>
                      {rhythmDifference(r)}
                    </Text>
                  </View>
                </View>
                {r.page !== null ? (
                  <PassageAnalysis
                    key={`${book.id}-${r.key}`}
                    bookId={book.id}
                    page={r.page}
                    sessionIds={scope}
                    reactions={r.reactions}
                    rhythm={r.direction}
                    compact
                  />
                ) : (
                  <>
                    <Text style={styles.body}>{r.reason}</Text>
                    <View
                      style={[styles.row, { alignItems: "flex-start", gap: 8 }]}
                    >
                      <Feather
                        name={quicker ? "arrow-right" : "sun"}
                        size={16}
                        color={accent}
                      />
                      <Text style={[styles.muted, { flex: 1 }]}>
                        {r.nextStep}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            );
          })}
          <DetailFold title="About this comparison">
            <Text style={styles.muted}>
              {book.reader
                ? "Compares time per character with the median of at least 3 other pages, averaging repeat sessions. Quicker highlights need 3 adjacent pages with at least 10% less time; longer highlights need 50% more time. Percentages average the highlighted pages. Content clues refer to one page within the range."
                : "Compares each sitting’s seconds per page with the median of at least 3 other sittings. Quicker means at least 10% less time; longer means at least 50% more. Each segment represents a whole sitting, not individual page measurements."}{" "}
              Time may reflect flow, interest, rereading or interruptions; it does
              not measure comprehension.
              {limited
                ? " Only the latest 1,000 page visits are available."
                : ""}
            </Text>
          </DetailFold>
        </>
      )}
    </View>
  );
}
