import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useJournal } from "../../lib/journal";
import {
  Page,
  Button,
  Cover,
  Progress,
  styles,
  message,
} from "../../components/ui";
export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { books, sessions, start, timer, deleteSession } = useJournal();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const book = books.find((book) => book.id === id);
  if (!book)
    return (
      <Page title="Book unavailable" back>
        <Text style={styles.body}>
          Return to your library and refresh your records.
        </Text>
      </Page>
    );
  const history = sessions
    .filter((session) => session.bookId === id)
    .sort((a, b) => b.startedAt - a.startedAt);
  async function begin() {
    setBusy(true);
    try {
      await start(book!);
      router.push("/session");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page back>
      <View style={{ alignItems: "center", gap: 16 }}>
        <Cover large title={book.title} uri={book.cover} />
        <Text style={[styles.title, { textAlign: "center" }]}>
          {book.title}
        </Text>
        <Text style={styles.body}>{book.author}</Text>
      </View>
      <Progress
        position={book.position}
        total={book.totalPages}
        unit={book.unit}
      />
      <View style={styles.between}>
        <View>
          <Text style={styles.heading}>
            {Math.round(
              history.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
            )}{" "}
            min
          </Text>
          <Text style={styles.muted}>Total reading time</Text>
        </View>
        <View>
          <Text style={styles.heading}>{history.length}</Text>
          <Text style={styles.muted}>Sessions</Text>
        </View>
        <View>
          <Text style={styles.heading}>{book.furthestPosition}</Text>
          <Text style={styles.muted}>
            Furthest {book.unit === "pages" ? "page" : "%"}
          </Text>
        </View>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {book.reader && (
        <Button
          title="Open Ebook Reader"
          onPress={() =>
            router.push({ pathname: "/reader/[id]", params: { id: book.id } })
          }
        />
      )}
      <Button
        title={timer ? "Return to active session" : "Start Reading"}
        busy={busy}
        onPress={() =>
          timer
            ? router.push(timer.endedAt ? "/finish" : "/session")
            : void begin()
        }
      />
      <Button
        title="Log a past session"
        secondary
        onPress={() =>
          router.push({
            pathname: "/finish",
            params: { bookId: id, manual: "1" },
          })
        }
      />
      <Button
        title="Edit book"
        secondary
        onPress={() => router.push({ pathname: "/add-book", params: { id } })}
      />
      <Text style={styles.heading}>Your reading history</Text>
      {!history.length && (
        <Text style={styles.body}>
          Your first session is the start of a new habit.
        </Text>
      )}
      {history.map((session) => (
        <View key={session.id} style={styles.card}>
          <View style={styles.between}>
            <Text style={styles.body}>
              {new Date(session.startedAt).toLocaleDateString()}
            </Text>
            <Text style={styles.label}>
              {Math.round(session.durationSeconds / 60)} min
            </Text>
          </View>
          <Text style={styles.muted}>
            {session.startPosition} → {session.endPosition} {session.unit} ·{" "}
            {session.location || "Location not recorded"}
          </Text>
          {!!session.note && <Text style={styles.body}>{session.note}</Text>}
          {!!session.reaction && (
            <Text style={styles.muted}>{session.reaction}</Text>
          )}
          <Button
            title="Edit session"
            secondary
            onPress={() =>
              router.push({
                pathname: "/finish",
                params: { editId: session.id },
              })
            }
          />
          <Button
            title={
              confirmDelete === session.id
                ? "Confirm delete session"
                : "Delete session"
            }
            secondary
            onPress={() => {
              if (confirmDelete !== session.id) {
                setConfirmDelete(session.id);
                return;
              }
              void deleteSession(session.id).catch((error) =>
                setError(message(error)),
              );
            }}
          />
        </View>
      ))}
    </Page>
  );
}
