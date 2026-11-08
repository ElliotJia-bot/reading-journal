import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Book, ReadingSession } from "../../../shared/domain";
import type { PageVisit } from "../../../shared/reader";
import { rangeLabel, slowdownOverview } from "../../../shared/book-insights";
import { api } from "../lib/api";
import { Button, color, message, styles } from "./ui";
import { DetailFold } from "./insight-blocks";
import SlowdownChart from "./slowdown-chart";
import PassageAnalysis from "./passage-analysis";
export default function BookSlowdowns({
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
  const data = slowdownOverview(book, sessions, visits),
    scope = [...new Set(data.points.flatMap((p) => p.sessionIds))];
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 5 }}>
        <Text style={[styles.label, { marginBottom: 0, letterSpacing: 1.4 }]}>
          WHERE & WHY
        </Text>
        <Text style={styles.heading}>Where you slowed down</Text>
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
            <SlowdownChart
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
                  ? "No passage took at least 50% more time than your usual pace in this period."
                  : book.reader
                    ? "Save a session with at least 4 comparable pages to reveal your rhythm."
                    : "Log at least 4 sittings with page progress to compare stretches of this book."}
              </Text>
            </View>
          )}
          {data.ranges.map((r) => (
            <View
              key={r.key}
              style={[
                styles.card,
                {
                  padding: 18,
                  borderLeftWidth: 3,
                  borderLeftColor: color.rust,
                  gap: 12,
                },
              ]}
            >
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
                    backgroundColor: "#f2ded3",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <Text style={[styles.muted, { color: color.rust }]}>
                    {Math.round((r.relative! - 1) * 100)}% more time
                    {r.pages.length > 1 ? " · peak" : ""}
                  </Text>
                </View>
              </View>
              {r.page !== null ? (
                <PassageAnalysis
                  bookId={book.id}
                  page={r.page}
                  sessionIds={scope}
                  reactions={r.reactions}
                  compact
                />
              ) : (
                <>
                  <Text style={styles.body}>{r.reason}</Text>
                  <View
                    style={[styles.row, { alignItems: "flex-start", gap: 8 }]}
                  >
                    <Feather name="sun" size={16} color={color.rust} />
                    <Text style={[styles.muted, { flex: 1 }]}>
                      {r.nextStep}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ))}
          <DetailFold title="About this comparison">
            <Text style={styles.muted}>
              {book.reader
                ? "Compares time per character with at least 3 other pages, averaging repeat sessions. A highlighted range groups adjacent slower ebook sections; its percentage and content clue describe the slowest measured page in that range."
                : "Compares each sitting’s seconds per page with the median of at least 3 other sittings in this view. Manual logs cannot locate a slowdown within the recorded page range."}{" "}
              More time can reflect interest, rereading or interruptions.
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
