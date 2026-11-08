import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useJournal } from "../../lib/journal";
import { bookmarkConnected } from "../../../../shared/bookmark";
import { homeMetrics, finishEstimate } from "../../../../shared/metrics";
import { BrandWordmark } from "../../components/brand";
import { SurfaceFade } from "../../components/surface-fade";
import {
  Page,
  Button,
  Cover,
  Progress,
  styles,
  color,
} from "../../components/ui";

export default function Home() {
  const { width } = useWindowDimensions();
  const compactHeader = width < 390;
  const logoWidth =
    width < 350 ? 106 : width < 390 ? 132 : width < 600 ? 156 : 210;
  const { books, sessions, profile, timer, error, refresh } =
    useJournal();
  const [now, setNow] = useState(Date.now);
  const bookmark = timer?.bookmark && bookmarkConnected(timer.bookmark, now) && timer.bookmark.status !== "ended" ? "Bookmark connected" : "Bookmark not connected";
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  const metrics = useMemo(
    () => homeMetrics(sessions, books, profile.timezone, now),
    [sessions, books, profile.timezone, now],
  );
  const reading = books
    .filter((b) => b.status === "Reading")
    .sort((a, b) => {
      const last = (id: string) =>
        Math.max(
          0,
          ...sessions.filter((s) => s.bookId === id).map((s) => s.endedAt),
        );
      return last(b.id) - last(a.id) || b.updatedAt - a.updatedAt;
    });
  const current = reading[0],
    estimate = current ? finishEstimate(current, sessions) : null;
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: profile.timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return (
    <Page>
      <View
        style={[styles.between, { gap: compactHeader ? 8 : 12 }]}
        testID="home-header"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: compactHeader ? 10 : 16,
            flex: 1,
            minWidth: 0,
          }}
        >
          <BrandWordmark width={logoWidth} />
          <Text
            style={[styles.muted, { flexShrink: 0 }]}
            numberOfLines={1}
            testID="home-greeting"
          >
            {hour < 12
              ? "Good morning"
              : hour < 18
                ? "Good afternoon"
                : "Good evening"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
          style={{
            padding: 10,
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="settings" size={21} color={color.green} />
        </Pressable>
      </View>
      <Text style={[styles.title, { fontSize: 38, lineHeight: 43 }]}>
        Ready to turn the page?
      </Text>
      <Text style={styles.muted}>○ {bookmark}</Text>
      {!!error && (
        <View>
          <Text style={styles.error}>{error}</Text>
          <Button title="Retry sync" secondary onPress={() => void refresh()} />
        </View>
      )}
      {timer && (
        <Button
          title={
            timer.reader
              ? "Finish & log your reading"
              : "Return to active session"
          }
          onPress={() => router.push(timer.endedAt ? "/finish" : "/session")}
        />
      )}
      {current ? (
        <View
          style={[styles.card, { padding: 24 }]}
        >
          <SurfaceFade tone="forest" />
          <Text style={styles.label}>CURRENTLY READING</Text>
          <View style={styles.row}>
            <Cover title={current.title} uri={current.cover} />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.heading}>{current.title}</Text>
              <Text style={styles.muted}>{current.author}</Text>
            </View>
          </View>
          <Progress
            position={current.position}
            total={current.totalPages}
            unit={current.unit}
          />
          {estimate && (
            <Text style={styles.muted}>
              About {estimate.minutes} minutes left · based on {estimate.sample}{" "}
              sessions
            </Text>
          )}
          <Button
            title="Continue reading"
            onPress={() =>
              router.push({
                pathname: current.reader || current.cloudEbook ? "/reader/[id]" : "/book/[id]",
                params: { id: current.id },
              })
            }
          />
          {reading.length > 1 && (
            <Button
              title={`View all ${reading.length} books in progress`}
              secondary
              onPress={() => router.push("/(tabs)/library")}
            />
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.heading}>Your next chapter starts here.</Text>
          <Text style={styles.body}>
            Add a book, import an ebook, or discover something that catches your
            eye.
          </Text>
          <Button
            title="Add your first book"
            onPress={() => router.push("/add-book")}
          />
          <Button
            title="Find a book for me"
            secondary
            onPress={() => router.push("/(tabs)/for-you")}
          />
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[
          [
            `${metrics.currentStreak} ${metrics.currentStreak === 1 ? "day" : "days"}`,
            "Current streak",
            `Personal best: ${metrics.bestStreak} ${metrics.bestStreak === 1 ? "day" : "days"}`,
          ],
          [
            String(metrics.booksThisYear),
            "Books this year",
            metrics.undatedFinished
              ? `${metrics.undatedFinished} earlier completion dates unknown`
              : "Completed books with a recorded date",
          ],
          [
            `${metrics.minutes} min`,
            "Minutes this week",
            metrics.changePercent === null
              ? "No reading in the matching period last week"
              : `${metrics.changePercent >= 0 ? "+" : ""}${metrics.changePercent}% vs the same days last week`,
          ],
          [
            String(metrics.pages),
            "Pages this week",
            `Personal best: ${metrics.bestWeeklyPages} in a week`,
          ],
        ].map(([value, label, detail], index) => (
          <View
            key={label}
            style={[styles.card, { width: "47%", flexGrow: 1, padding: 16 }]}
          >
            <SurfaceFade tone={index === 0 ? "coral" : index === 1 ? "forest" : "stone"} />
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.heading}>{value}</Text>
            <Text style={styles.muted}>{detail}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>
        Weeks start Monday. A streak day includes more than 3 minutes of saved
        reading. Pages mean forward progress; ebook sections and print pages
        differ. Percentage logs do not add pages.
      </Text>
      <View style={[styles.card, styles.cardCoral]}>
        <Text style={styles.label}>A LITTLE REFLECTION</Text>
        <Text style={styles.heading}>
          Discover what helps you keep reading.
        </Text>
        <Text style={styles.body}>
          Explore your rhythm, a book, or a single reading session.
        </Text>
        <Button
          title="Explore Insights"
          secondary
          onPress={() => router.push("/(tabs)/insights")}
        />
      </View>
    </Page>
  );
}
