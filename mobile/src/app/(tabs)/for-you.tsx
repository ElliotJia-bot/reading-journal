import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useJournal } from "../../lib/journal";
import { findBookRecommendations } from "../../lib/book-recommendations";
import {
  sameBook,
  type BookMatch,
} from "../../../../shared/book-recommendations";
import {
  Page,
  Button,
  Chips,
  Cover,
  styles,
  color,
  message,
} from "../../components/ui";

export default function ForYou() {
  const { user } = useJournal();
  return <BookDiscovery key={user?.uid ?? "signed-out"} />;
}
function BookDiscovery() {
  const { user, books, sessions, profile, saveBook } = useJournal();
  const liked = new Set(
    sessions.filter((s) => s.reaction === "Liked it").map((s) => s.bookId),
  );
  const seeds = [...books].sort(
    (a, b) =>
      Number(liked.has(b.id)) - Number(liked.has(a.id)) ||
      Number(b.status === "Reading") - Number(a.status === "Reading") ||
      b.updatedAt - a.updatedAt,
  );
  const [seedId, setSeedId] = useState<string | null>(null);
  const seed =
    seedId === ""
      ? undefined
      : (seeds.find((b) => b.id === seedId) ?? seeds[0]);
  const [topic, setTopic] = useState("");
  const selectedTopic = topic || profile.topics[0] || "Fiction";
  const topicChoices = [
    ...new Set([
      ...profile.topics,
      "Fiction",
      "Fantasy",
      "Mystery",
      "Science fiction",
      "History",
      "Psychology",
      "Philosophy",
    ]),
  ].slice(0, 12);
  const [results, setResults] = useState<BookMatch[] | null>(null);
  const [basis, setBasis] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const preferenceKey = `book-discovery-hidden:${user?.uid}`;
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(preferenceKey)
      .then((raw) => {
        if (cancelled) return;
        const values = raw ? JSON.parse(raw) : [];
        if (Array.isArray(values))
          setDismissed(values.filter((id) => typeof id === "string"));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preferenceKey]);
  function choose(id: string, nextTopic = topic) {
    if (busy) return;
    setSeedId(id);
    setTopic(nextTopic);
    setResults(null);
    setError("");
    setNotice("");
  }
  async function discover() {
    setBusy(true);
    setError("");
    setNotice("");
    setResults(null);
    setBasis(seed ? `Inspired by ${seed.title}` : `Exploring ${selectedTopic}`);
    try {
      const response = await findBookRecommendations(
        seed,
        selectedTopic,
        books,
        dismissed,
      );
      setResults(response.matches);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function add(book: BookMatch) {
    if (books.some((b) => sameBook(book, b))) return;
    setSaving(book.id);
    setError("");
    setNotice("");
    try {
      await saveBook(`ol-${book.id}`, {
        title: book.title.slice(0, 240),
        author: book.authors.join(", ").slice(0, 160),
        cover: book.cover,
        isbn: "",
        totalPages: null,
        unit: "pages",
        baselinePosition: 0,
        status: "Want to Read",
        topics: book.matchedTopics.slice(0, 8),
      });
      setNotice(`${book.title} is in Want to Read.`);
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving("");
    }
  }
  async function hide(book: BookMatch) {
    try {
      const next = [...new Set([...dismissed, book.id])].slice(-200);
      await AsyncStorage.setItem(preferenceKey, JSON.stringify(next));
      setDismissed(next);
      setNotice("We’ll leave this book out on this device.");
    } catch {
      setError("Could not save your preference. Please try again.");
    }
  }
  const visible = results
    ?.filter((book) => !dismissed.includes(book.id))
    .slice(0, 6);
  return (
    <Page title="Your next good book">
      <Text style={styles.body}>
        More stories, ideas, and authors to get lost in.
      </Text>
      {!results && (
        <View style={styles.card}>
          <Text style={styles.label}>
            {seeds.length
              ? "START WITH A BOOK IN YOUR LIBRARY"
              : "WHAT WOULD YOU LIKE TO EXPLORE?"}
          </Text>
          {seeds.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
            >
              {seeds.map((book) => (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Similar to ${book.title}`}
                  accessibilityState={{
                    selected: seed?.id === book.id,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => choose(book.id)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor:
                      seed?.id === book.id ? color.green : color.line,
                    backgroundColor:
                      seed?.id === book.id ? "#e4ecdf" : color.paper,
                    width: 180,
                    gap: 5,
                  }}
                >
                  <Text numberOfLines={2} style={styles.body}>
                    {book.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.muted}>
                    {liked.has(book.id)
                      ? "You marked a session Liked it"
                      : book.author || "From your library"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {seeds.length > 0 && (
            <Text style={styles.muted}>Or explore a topic</Text>
          )}
          <Chips
            values={topicChoices}
            value={seed ? "" : selectedTopic}
            onChange={(value) => choose("", value)}
          />
          <Button
            title={
              busy
                ? "Finding your next chapter…"
                : seed
                  ? "Find similar books"
                  : "Find books for me"
            }
            busy={busy}
            disabled={!ready || !!saving}
            onPress={() => void discover()}
          />
          <Text style={styles.muted}>
            Searches Open Library using the selected title, author or topics.
            Your reading times and private notes stay private.
          </Text>
        </View>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {notice}
        </Text>
      )}
      {results && (
        <>
          <Text style={styles.heading}>{basis}</Text>
          <Button
            title="Change book or topic"
            secondary
            disabled={!!saving}
            onPress={() => {
              setResults(null);
              setNotice("");
            }}
          />
          <Text style={styles.muted}>
            Matches by catalog themes and author. These are starting points to
            explore, not a prediction of what you’ll love.
          </Text>
          {!visible?.length && (
            <View style={styles.card}>
              <Text style={styles.heading}>A different starting point?</Text>
              <Text style={styles.body}>
                No new matches for this selection. Try another book or topic.
              </Text>
            </View>
          )}
          {visible?.map((book) => {
            const onShelf = books.some((b) => sameBook(book, b));
            return (
              <View key={book.id} style={styles.card}>
                <View style={[styles.row, { alignItems: "flex-start" }]}>
                  <Cover title={book.title} uri={book.cover} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.heading}>{book.title}</Text>
                    <Text style={styles.muted}>
                      {book.authors.join(", ") || "Author not listed"}
                    </Text>
                    <Text style={[styles.body, { fontSize: 12 }]}>
                      {book.reason}
                    </Text>
                  </View>
                </View>
                <Button
                  title={
                    onShelf ? "In your library ✓" : "＋ Add to Want to Read"
                  }
                  busy={saving === book.id}
                  disabled={onShelf || !!saving}
                  onPress={() => void add(book)}
                />
                <View style={styles.between}>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`View ${book.title} on Open Library`}
                    onPress={() =>
                      void Linking.openURL(
                        `https://openlibrary.org/works/${book.id}`,
                      ).catch((e) => setError(message(e)))
                    }
                    style={{ paddingVertical: 10 }}
                  >
                    <Text
                      style={[
                        styles.muted,
                        { textDecorationLine: "underline" },
                      ]}
                    >
                      About this book ↗
                    </Text>
                  </Pressable>
                  {!onShelf && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Not for me: ${book.title}`}
                      disabled={!!saving}
                      onPress={() => void hide(book)}
                      style={{ paddingVertical: 10 }}
                    >
                      <Text style={styles.muted}>Not for me</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          {!!dismissed.length && (
            <Button
              title="Reset hidden suggestions"
              secondary
              onPress={() => {
                void AsyncStorage.removeItem(preferenceKey)
                  .then(() => {
                    setDismissed([]);
                    setNotice(
                      "Hidden suggestions reset. Search again to include them.",
                    );
                  })
                  .catch(() => setError("Please try again."));
              }}
            />
          )}
        </>
      )}
      <Text style={styles.muted}>
        Book information from Open Library. Adding a title saves it to your
        wishlist; it does not import the ebook.
      </Text>
    </Page>
  );
}
