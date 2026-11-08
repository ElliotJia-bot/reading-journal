import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useJournal } from "../../../lib/journal";
import { aggregate, dayKey } from "../../../../../shared/domain";
import { finishEstimate } from "../../../../../shared/metrics";
import { behavioralSuggestions } from "../../../../../shared/reading-insights";
import { Page, Button, Chips, styles } from "../../../components/ui";
import { SmallBlock, StatBlocks } from "../../../components/insight-blocks";
import SessionChart from "../../../components/session-chart";
import PaceInsights from "../../../components/pace-insights";
export default function BookInsights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, books, sessions, profile } = useJournal();
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
  const filtered = history.filter((s) =>
    Object.hasOwn(stats.daily, dayKey(s.startedAt, profile.timezone)),
  );
  const suggestions = behavioralSuggestions(book, filtered, profile.timezone);
  return (
    <Page title={book.title} back>
      <Text style={styles.muted}>
        {book.author} · {book.status}
      </Text>
      <StatBlocks
        items={[
          { label: "Reading time", value: `${stats.totalMinutes} min` },
          { label: "Sessions", value: stats.sessionCount },
          {
            label: "Current position",
            value:
              book.unit === "percent"
                ? `${book.position}%`
                : `p. ${book.position}`,
            detail: book.totalPages ? `of ${book.totalPages} pages` : undefined,
          },
          {
            label: "Time remaining",
            value: estimate ? `~${estimate.minutes} min` : "Still learning",
            detail: estimate
              ? `${estimate.sample} sessions`
              : "Needs 3 sessions & 10 pages",
          },
        ]}
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
      <PaceInsights
        key={`${user?.uid}:${id}:${range}`}
        book={book}
        sessions={filtered}
      />
      <View style={{ gap: 12 }}>
        <Text style={styles.heading}>Behavioral suggestions</Text>
        {suggestions.map((s) => (
          <SmallBlock
            key={s.title}
            title={s.title}
            body={s.action}
            evidence={s.evidence}
          />
        ))}
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
