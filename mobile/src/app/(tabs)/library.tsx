import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useJournal, type Book } from "../../lib/journal";
import { editableBook } from "../../../../shared/domain";
import {
  Page,
  Button,
  Chips,
  Cover,
  Progress,
  styles,
  color,
  message,
} from "../../components/ui";
export default function Library() {
  const { books, sessions, timer, error, refresh, saveBook } = useJournal();
  const [filter, setFilter] = useState("Reading");
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  async function open(book: Book) {
    setOpening(true);
    setOpenError("");
    try {
      const canRead = !!(book.reader || book.cloudEbook);
      if (canRead && (book.status === "Want to Read" || book.status === "Dropped"))
        await saveBook(book.id, editableBook(book, { status: "Reading" }));
      router.push({ pathname: canRead ? "/reader/[id]" : "/book/[id]", params: { id: book.id } });
    } catch (e) { setOpenError(message(e)); }
    finally { setOpening(false); }
  }
  const visible = books
    .filter((book) => book.status === filter)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Page>
      <View style={styles.between}>
        <Text style={styles.title}>My Library</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
          style={{ padding: 12 }}
        >
          <Feather name="settings" size={20} color={color.green} />
        </Pressable>
      </View>
      <Chips
        values={["Reading", "Want to Read", "Finished", "Dropped"]}
        value={filter}
        onChange={setFilter}
      />
      {error ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Retry sync" secondary onPress={() => void refresh()} />
        </View>
      ) : (
        <Text style={styles.muted}>
          Your personal reading journal · Saved to your account
        </Text>
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
      {!!openError && <Text style={styles.error}>{openError}</Text>}
      {visible.map((book, index) => (
        <Pressable
          key={book.id}
          accessibilityRole="button"
          disabled={opening}
          onPress={() => void open(book)}
          style={[styles.card, index === 0 && (filter === "Want to Read" ? styles.cardCoral : styles.cardGreen)]}
        >
          <View style={styles.row}>
            <Cover title={book.title} uri={book.cover} />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.heading}>{book.title}</Text>
              <Text style={styles.muted}>
                {book.author || "Your next chapter"}
              </Text>
              <Text style={styles.muted}>
                {Math.round(
                  sessions
                    .filter((s) => s.bookId === book.id)
                    .reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
                )}{" "}
                min logged
              </Text>
            </View>
          </View>
          <Text style={styles.muted}>
            {sessions.some((s) => s.bookId === book.id)
              ? `Last read ${new Date(Math.max(...sessions.filter((s) => s.bookId === book.id).map((s) => s.endedAt))).toLocaleDateString()}`
              : "No saved reading yet"}
          </Text>
          {filter === "Dropped" && (
            <Text style={styles.muted}>
              Set aside · {book.dropReason || "Reason not recorded"}
            </Text>
          )}
          <Progress
            position={book.position}
            total={book.totalPages}
            unit={book.unit}
          />
          {index === 0 && filter === "Reading" && (
            <View style={styles.button}>
              <Text style={styles.buttonText}>Continue Reading</Text>
            </View>
          )}
          {(book.reader || book.cloudEbook) && <Pressable accessibilityRole="button" accessibilityLabel={`Book details for ${book.title}`} onPress={(event) => { event.stopPropagation(); router.push({ pathname: "/book/[id]", params: { id: book.id } }); }} style={{ paddingVertical: 10 }}><Text style={styles.label}>Book details & insights</Text></Pressable>}
        </Pressable>
      ))}
      {!visible.length && (
        <View style={styles.card}>
          <Feather name="book" size={32} color={color.green} />
          <Text style={styles.heading}>Make room for a good book.</Text>
          <Text style={styles.body}>
            Add a book you’re reading, or save something you’d like to read
            next.
          </Text>
        </View>
      )}
      <Button title="＋ Add Book" onPress={() => router.push("/add-book")} />
    </Page>
  );
}
