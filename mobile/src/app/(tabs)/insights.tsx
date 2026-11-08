import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { aggregate } from "../../../../shared/domain";
import { useJournal } from "../../lib/journal";
import { Page, Button, Chips, Field, styles } from "../../components/ui";
import SessionChart from "../../components/session-chart";
import ReadingCoach from "../../components/reading-coach";

export default function Insights() {
  const { books, sessions, profile, error, refresh } = useJournal();
  const [query, setQuery] = useState("");
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
  const places = Object.entries(stats.locations).sort(
    (a, b) => b[1].averageMinutes - a[1].averageMinutes,
  );
  return (
    <Page title="Your reading rhythm">
      <Text style={styles.body}>
        Understand your habits. Make room for your next chapter.
      </Text>
      <Chips
        values={["Overview", "Reading coach"]}
        value={section}
        onChange={setSection}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.label}>
        {section === "Overview" ? "EXPLORE YOUR HABITS" : "READING SUGGESTIONS"}
      </Text>
      <Chips
        values={["Last 7 Days", "Last 30 Days", "All Time"]}
        value={range}
        onChange={setRange}
      />
      {section === "Overview" && (
        <>
          <SessionChart
            sessions={sessions}
            timezone={profile.timezone}
            days={days}
            metric={metric}
            onMetric={setMetric}
            now={now}
          />
          <View style={styles.card}>
            <Text style={styles.heading}>Explore a book</Text>
            <Field
              label="Search your library"
              value={query}
              onChangeText={setQuery}
              placeholder="Title or author"
            />
            {books
              .filter((b) =>
                `${b.title} ${b.author}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 5)
              .map((b) => (
                <Button
                  key={b.id}
                  title={b.title}
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/insights/book/[id]",
                      params: { id: b.id },
                    })
                  }
                />
              ))}
          </View>
        </>
      )}
      {section === "Reading coach" ? (
        <ReadingCoach
          key={days}
          days={days}
          sessionCount={stats.sessionCount}
        />
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
              <View style={styles.between}>
                {[
                  [stats.totalMinutes, "Minutes"],
                  [stats.readingDays, "Reading days"],
                  [stats.averageMinutes, "Min / session"],
                ].map(([value, label]) => (
                  <View key={label} style={{ alignItems: "center", flex: 1 }}>
                    <Text style={styles.title}>{value}</Text>
                    <Text style={styles.muted}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.card, { backgroundColor: "#e7eee2" }]}>
                <Text style={styles.label}>MAKE YOUR NEXT SESSION YOURS</Text>
                <Text style={styles.heading}>
                  {places.length
                    ? `${places[0][0]} sessions average ${places[0][1].averageMinutes} minutes.`
                    : "Find a small habit that fits."}
                </Text>
                <Text style={styles.muted}>
                  {places.length
                    ? `Based on ${places[0][1].count} ${places[0][0].toLowerCase()} ${places[0][1].count === 1 ? "session" : "sessions"} in this period. This is a pattern to explore, not a rule.`
                    : "Explore suggestions grounded in the time you actually spend reading."}
                </Text>
                <Button
                  title="Explore with your reading coach"
                  secondary
                  onPress={() => setSection("Reading coach")}
                />
              </View>
              <View style={styles.card}>
                <Text style={styles.heading}>When you read</Text>
                <Text style={styles.muted}>
                  {stats.sessionCount} sessions · {profile.timezone}
                </Text>
                {Object.entries(stats.times).map(([time, count]) => (
                  <View key={time} style={styles.between}>
                    <Text style={styles.body}>{time}</Text>
                    <Text style={styles.muted}>{count} sessions</Text>
                  </View>
                ))}
              </View>
              <View style={styles.card}>
                <Text style={styles.heading}>Places you read</Text>
                {places.length ? (
                  places.map(([place, value]) => (
                    <View key={place} style={styles.between}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.body}>{place}</Text>
                        <Text style={styles.muted}>
                          {value.count} sessions · {value.averageMinutes} min
                          average
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
                <Text style={styles.muted}>
                  Time spent, shared equally across each session’s topics.
                </Text>
                {Object.entries(stats.topics)
                  .sort((a, b) => b[1] - a[1])
                  .map(([topic, seconds]) => (
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
                <Text style={styles.label}>YOU EXPLICITLY LIKED</Text>
                {Object.entries(stats.likedTopics).map(([topic, count]) => (
                  <Text key={topic} style={styles.body}>
                    {topic} · {count} positive{" "}
                    {count === 1 ? "reaction" : "reactions"}
                  </Text>
                ))}
                {!Object.keys(stats.likedTopics).length && (
                  <Text style={styles.muted}>
                    Mark a session “Liked it” and add book topics to explore
                    your preferences.
                  </Text>
                )}
                <Button
                  title="Find books with similar themes"
                  secondary
                  onPress={() => router.push("/(tabs)/for-you")}
                />
              </View>
              {Object.keys(stats.authors).length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.heading}>
                    Authors you spend time with
                  </Text>
                  {Object.entries(stats.authors)
                    .sort((a, b) => b[1].seconds - a[1].seconds)
                    .map(([author, value]) => (
                      <View key={author}>
                        <Text style={styles.body}>{author}</Text>
                        <Text style={styles.muted}>
                          {Math.round(value.seconds / 60)} min ·{" "}
                          {value.sessions} sessions · {value.liked} explicitly
                          liked
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </>
          )}
          <View style={styles.card}>
            <Text style={styles.heading}>Your reading journey</Text>
            <Text style={styles.body}>
              {books.filter((b) => b.status === "Finished").length} finished ·{" "}
              {books.filter((b) => b.status === "Reading").length} in progress ·{" "}
              {books.filter((b) => b.status === "Want to Read").length} on your
              wishlist · {books.filter((b) => b.status === "Dropped").length}{" "}
              set aside
            </Text>
            <Text style={styles.muted}>
              Library totals across all time. You decide when a book is
              finished.
            </Text>
          </View>
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
