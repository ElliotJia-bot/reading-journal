import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, Redirect } from "expo-router";
import { useJournal, timerSeconds } from "../lib/journal";
import { Page, Button, Cover, styles, color, message } from "../components/ui";
export default function Session() {
  const { timer, books, updateTimer } = useJournal();
  const [, tick] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const book = books.find((book) => book.id === timer?.bookId);
  if (!timer || !book)
    return (
      <Page title="Ready when you are" back>
        <Button
          title="Go to Library"
          onPress={() => router.replace("/(tabs)")}
        />
      </Page>
    );
  if (timer.reader) return <Redirect href="/finish" />;
  const seconds = timerSeconds(timer);
  const display = `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds / 60) % 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  async function change(finish = false) {
    setBusy(true);
    try {
      await updateTimer({
        ...timer!,
        accumulatedSeconds: seconds,
        runningSince: finish || timer!.runningSince ? null : Date.now(),
        endedAt: finish ? Date.now() : null,
      });
      if (finish) router.replace("/finish");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page back>
      <View style={styles.row}>
        <Cover title={book.title} uri={book.cover} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>{book.title}</Text>
          <Text style={styles.muted}>
            Starting at {timer.startPosition} {book.unit}
          </Text>
        </View>
      </View>
      <View
        style={{
          alignSelf: "center",
          width: 258,
          height: 258,
          borderRadius: 129,
          borderWidth: 2,
          borderColor: color.green,
          alignItems: "center",
          justifyContent: "center",
          marginVertical: 25,
          gap: 12,
        }}
      >
        <Text style={styles.label}>
          {timer.runningSince ? "YOUR READING TIME" : "PAUSED"}
        </Text>
        <Text
          style={[
            styles.title,
            { fontSize: 43, fontVariant: ["tabular-nums"] },
          ]}
        >
          {display}
        </Text>
      </View>
      <Text style={[styles.body, { textAlign: "center" }]}>
        The timer continues while you read in Kindle, Apple Books, or on paper.
        Pause whenever you take a break.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={timer.runningSince ? "Pause timer" : "Resume reading"}
        secondary
        busy={busy}
        onPress={() => void change()}
      />
      <Button
        title="Finish & log"
        disabled={seconds < 1}
        busy={busy}
        onPress={() => void change(true)}
      />
    </Page>
  );
}
