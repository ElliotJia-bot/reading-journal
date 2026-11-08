import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useJournal } from "../../../lib/journal";
import { aggregate, dayKey } from "../../../../../shared/domain";
import { finishEstimate, pagesRead } from "../../../../../shared/metrics";
import { Page, Button, Chips, styles } from "../../../components/ui";
import SessionChart from "../../../components/session-chart";
export default function BookInsights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { books, sessions, profile } = useJournal();
  const [range, setRange] = useState("7 days"),
    [metric, setMetric] = useState<"Time" | "Pages">("Time");
  const book = books.find((b) => b.id === id),
    history = sessions
      .filter((s) => s.bookId === id)
      .sort((a, b) => b.startedAt - a.startedAt);
  if (!book) return <Page title="Book unavailable" back />;
  const days = range === "7 days" ? 7 : range === "30 days" ? 30 : 0,
    stats = aggregate(history, [book], days, profile.timezone),
    estimate = finishEstimate(book, history);
  const filtered = history.filter(
    (s) =>
      !days ||
      Object.hasOwn(stats.daily, dayKey(s.startedAt, profile.timezone)),
  );
  return (
    <Page title={book.title} back>
      <Text style={styles.label}>BOOK INSIGHTS</Text>
      <Text style={styles.muted}>
        {book.author} · {book.status}
      </Text>
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
      <View style={styles.card}>
        <Text style={styles.heading}>
          {stats.totalMinutes} minutes · {stats.sessionCount} sessions
        </Text>
        <Text style={styles.body}>
          Current position: {book.position}
          {book.unit === "percent" ? "%" : ` / ${book.totalPages ?? "?"} pages`}
        </Text>
        <Text style={styles.muted}>
          {estimate
            ? `About ${estimate.minutes} minutes remaining, using ${estimate.sample} sessions in this edition. Pace can change.`
            : "An estimate becomes available after 3 sessions over 3 minutes with at least 10 pages of forward progress."}
        </Text>
        {book.dropReason && (
          <Text style={styles.body}>
            Your reason for setting it aside: {book.dropReason}
          </Text>
        )}
      </View>
      <Text style={styles.heading}>Your sessions</Text>
      {!filtered.length && (
        <Text style={styles.body}>No sessions in this period yet.</Text>
      )}
      {filtered.map((s) => (
        <View key={s.id} style={styles.card}>
          <Text style={styles.body}>
            {new Date(s.startedAt).toLocaleString()}
          </Text>
          <Text style={styles.muted}>
            {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s ·{" "}
            {pagesRead(s) === null
              ? `${s.startPosition}% → ${s.endPosition}%`
              : `${pagesRead(s)} pages of progress`}{" "}
            · {s.location || "Location not recorded"}
          </Text>
          <Button
            title="View session Insights"
            secondary
            onPress={() =>
              router.push({
                pathname: "/insights/session/[id]",
                params: { id: s.id },
              })
            }
          />
        </View>
      ))}
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
