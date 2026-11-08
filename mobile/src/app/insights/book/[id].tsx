import React, { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useJournal } from "../../../lib/journal";
import { aggregate, dayKey } from "../../../../../shared/domain";
import { finishEstimate } from "../../../../../shared/metrics";
import { behavioralSuggestions } from "../../../../../shared/reading-insights";
import {
  Page,
  Button,
  Chips,
  Cover,
  Progress,
  color,
  styles,
} from "../../../components/ui";
import { SmallBlock } from "../../../components/insight-blocks";
import SessionChart from "../../../components/session-chart";
import ReadingClock from "../../../components/reading-clock";
import BookReadingRhythm from "../../../components/book-reading-rhythm";
import { validBookSessions } from "../../../../../shared/book-insights";
import { Feather } from "@expo/vector-icons";
export default function BookInsights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, books, sessions, profile } = useJournal();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState("Since starting"),
    [metric, setMetric] = useState<"Time" | "Pages">("Time");
  const book = books.find((b) => b.id === id),
    history = book
      ? validBookSessions(book, sessions).sort(
          (a, b) => b.startedAt - a.startedAt,
        )
      : [];
  if (!book) return <Page title="Book unavailable" back />;
  const days = range === "7 days" ? 7 : range === "30 days" ? 30 : 0,
    stats = aggregate(history, [book], days, profile.timezone),
    totals = aggregate(history, [book], 0, profile.timezone),
    estimate = finishEstimate(book, history);
  const filtered = history.filter((s) =>
    Object.hasOwn(stats.daily, dayKey(s.startedAt, profile.timezone)),
  );
  const suggestions = behavioralSuggestions(book, filtered, profile.timezone);
  return (
    <Page title="Book insights" back>
      <View style={{ gap: 16 }}>
        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <Cover title={book.title} uri={book.cover} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.heading}>{book.title}</Text>
            <Text style={styles.muted}>{book.author}</Text>
            <Text style={styles.muted}>{book.status}</Text>
          </View>
        </View>
        <Progress
          position={book.position}
          total={book.totalPages}
          unit={book.unit}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          {
            label: "Total time",
            value: `${Math.round(totals.totalMinutes)} min`,
          },
          { label: "Sessions", value: String(totals.sessionCount) },
          {
            label: "To finish",
            value: estimate ? `~${estimate.minutes} min` : "—",
          },
        ].map((item) => (
          <View
            key={item.label}
            style={[styles.card, { flex: 1, padding: 12, gap: 5 }]}
          >
            <Text style={styles.muted}>{item.label}</Text>
            <Text style={[styles.heading, { fontSize: 21 }]}>{item.value}</Text>
          </View>
        ))}
      </View>
      <ReadingClock
        book={book}
        sessions={history}
        timezone={profile.timezone}
      />
      <Chips
        values={["7 days", "30 days", "Since starting"]}
        value={range}
        onChange={setRange}
      />
      <SessionChart
        sessions={history}
        timezone={profile.timezone}
        days={days}
        metric={metric}
        onMetric={setMetric}
      />
      <BookReadingRhythm
        key={`${user?.uid}:${id}:${range}:${book.reader?.documentId ?? "manual"}`}
        book={book}
        sessions={filtered}
      />
      <View style={{ gap: 12 }}>
        <Text style={styles.heading}>Behavioral suggestions</Text>
        <Text style={styles.muted}>Small adjustments for this book.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {suggestions.slice(0, 3).map((s, i) => (
            <View
              key={s.title}
              style={[
                styles.card,
                {
                  flexBasis: width >= 700 ? "46%" : "100%",
                  flexGrow: 1,
                  padding: 18,
                  gap: 10,
                  borderWidth: 1,
                  borderColor: color.line,
                  backgroundColor: "#f8f5f0",
                },
              ]}
            >
              <Feather
                name={i === 0 ? "clock" : i === 1 ? "sunrise" : "map-pin"}
                size={18}
                color={color.rust}
              />
              <Text style={[styles.heading, { fontSize: 21, lineHeight: 27 }]}>
                {s.title}
              </Text>
              <Text style={styles.body}>{s.action}</Text>
              <Text style={styles.muted}>{s.evidence}</Text>
            </View>
          ))}
        </View>
      </View>
      {book.dropReason && (
        <SmallBlock
          label="YOUR REFLECTION"
          title="Why you set it aside"
          body={book.dropReason}
        />
      )}
      <Button
        title="Back to book"
        secondary
        onPress={() =>
          router.replace({ pathname: "/book/[id]", params: { id } })
        }
      />
    </Page>
  );
}
