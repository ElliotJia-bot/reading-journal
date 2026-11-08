import DemoDataNotice from "../../components/demo-data-notice";
import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { aggregate } from "../../../../shared/domain";
import { useJournal } from "../../lib/journal";
import { Page, Button, Chips, styles } from "../../components/ui";
import SessionChart from "../../components/session-chart";
import ReadingCoach from "../../components/reading-coach";
import { StatBlocks, DetailFold } from "../../components/insight-blocks";
import LibraryInsightSearch from "../../components/library-insight-search";

export default function Insights() {
  const { books, sessions, profile, error, refresh } = useJournal();
  const [metric, setMetric] = useState<"Time" | "Pages">("Time");
  const [section, setSection] = useState("Overview");
  const [range, setRange] = useState("Last 7 Days");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const days = range === "Last 7 Days" ? 7 : range === "Last 30 Days" ? 30 : 0;
  const stats = useMemo(
    () => aggregate(sessions, books, days, profile.timezone, now),
    [sessions, books, days, profile.timezone, now],
  );
  const places = Object.entries(stats.locations)
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 3);
  const topTimes = Object.entries(stats.times)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const favoriteAuthor = Object.entries(stats.authors).sort(
    (a, b) => b[1].seconds - a[1].seconds,
  )[0];
  const topTopics = Object.entries(stats.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const likedTopTopics = topTopics
    .map(([topic]) => [topic, stats.likedTopics[topic] ?? 0] as const)
    .filter(([, count]) => count > 0);
  return (
    <Page title={section === "Overview" ? "Overall insights" : "Reading coach"}>
      <DemoDataNotice />
      <Chips
        values={["Overview", "Reading coach"]}
        value={section}
        onChange={setSection}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {section === "Overview" && (
        <Chips
          values={["Last 7 Days", "Last 30 Days", "All Time"]}
          value={range}
          onChange={setRange}
        />
      )}
      {section === "Overview" && (
        <>
          <StatBlocks
            items={[
              { label: "Minutes", value: stats.totalMinutes },
              { label: "Reading days", value: stats.readingDays },
              { label: "Min / session", value: stats.averageMinutes },
              { label: "Sessions", value: stats.sessionCount },
            ]}
          />
          <SessionChart
            sessions={sessions}
            timezone={profile.timezone}
            days={days}
            metric={metric}
            onMetric={setMetric}
            now={now}
          />
          <View style={[styles.card, { zIndex: 10, padding: 16, gap: 10 }]}>
            <Text style={styles.heading}>Book insights</Text>
            <LibraryInsightSearch books={books} />
          </View>
        </>
      )}
      {section === "Reading coach" ? (
        <ReadingCoach now={now} />
      ) : (
        <>
          {stats.sessionCount === 0 ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Every habit starts somewhere.</Text>
              <Text style={styles.body}>
                No reading logged in this period. Save a session to discover how
                reading fits into your day.
              </Text>
              <Button
                title="Go to Library"
                onPress={() => router.push("/(tabs)/library")}
              />
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.heading}>When you read</Text>
                <StatBlocks
                  items={topTimes.map(([time, count]) => ({
                    label: time,
                    value: count,
                    detail: "sessions",
                  }))}
                />
              </View>
              <View style={styles.card}>
                <Text style={styles.heading}>Places you read</Text>
                {places.length ? (
                  places.map(([place, value]) => (
                    <View key={place} style={styles.between}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.body}>{place}</Text>
                        <Text style={styles.muted}>
                          {value.count}{" "}
                          {value.count === 1 ? "session" : "sessions"}
                        </Text>
                      </View>
                      <Text style={styles.heading}>
                        {Math.round(value.seconds / 60)}m
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.body}>
                    Choose a location when saving your next session.
                  </Text>
                )}
              </View>
              <View style={styles.card}>
                <Text style={styles.heading}>Interests & topics</Text>

                {topTopics.map(([topic, seconds]) => (
                  <View key={topic} style={styles.between}>
                    <Text style={[styles.body, { flex: 1 }]}>{topic}</Text>
                    <Text style={styles.label}>
                      {Math.round(seconds / 60)} min
                    </Text>
                  </View>
                ))}
                {!Object.keys(stats.topics).length && (
                  <Text style={styles.body}>
                    Add topic tags to your books to explore this view.
                  </Text>
                )}
                <DetailFold title="Topics you liked & calculation">
                  <Text style={styles.muted}>
                    Time is shared equally across a session’s topics.
                  </Text>
                  <Text style={styles.label}>YOU EXPLICITLY LIKED</Text>
                  {likedTopTopics.map(([topic, count]) => (
                    <Text key={topic} style={styles.body}>
                      {topic} · {count} positive{" "}
                      {count === 1 ? "reaction" : "reactions"}
                    </Text>
                  ))}
                  {!likedTopTopics.length && (
                    <Text style={styles.muted}>
                      Mark a session “Liked it” and add book topics to explore
                      your preferences.
                    </Text>
                  )}
                </DetailFold>
                <Button
                  title="Find books with similar themes"
                  secondary
                  onPress={() => router.push("/(tabs)/for-you")}
                />
              </View>
              {favoriteAuthor && (
                <View style={styles.card}>
                  <Text style={styles.heading}>Favorite author</Text>
                  <Text style={styles.body}>{favoriteAuthor[0]}</Text>
                  <Text style={styles.muted}>
                    {Math.round(favoriteAuthor[1].seconds / 60)} min · Most time
                    spent in this period
                  </Text>
                </View>
              )}
            </>
          )}
          <Button
            title="Refresh records"
            secondary
            onPress={() => void refresh()}
          />
        </>
      )}
    </Page>
  );
}
