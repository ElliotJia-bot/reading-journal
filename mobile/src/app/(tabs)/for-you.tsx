import React, { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { useJournal } from "../../lib/journal";
import { api } from "../../lib/api";
import { findBookRecommendations } from "../../lib/book-recommendations";
import {
  sameBook,
  diverseMatches,
  type BookMatch,
} from "../../../../shared/book-recommendations";
import {
  peerMatches,
  type PublicReader,
  type DiscoveryVote,
} from "../../../../shared/discovery";
import {
  Page,
  Button,
  Chips,
  Cover,
  styles,
  message,
} from "../../components/ui";

function BookDetails({ book }: { book: BookMatch }) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setOpen(true);
    if (text) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`https://openlibrary.org/works/${book.id}.json`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("Book details are temporarily unavailable.");
      const data = await r.json();
      setText(
        (typeof data.description === "string"
          ? data.description
          : data.description?.value
        )?.slice(0, 1600) || "No synopsis is available in the catalog yet.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        title={open ? "Hide book details" : "Why this book? · Details"}
        secondary
        busy={busy}
        onPress={() => (open ? setOpen(false) : void load())}
      />
      {open && (
        <>
          <Text style={styles.label}>WHY IT APPEARS</Text>
          <Text style={styles.body}>{book.reason}</Text>
          <Text style={styles.label}>CATALOG SYNOPSIS</Text>
          <Text style={styles.body}>{text}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            title="Catalog & reader reviews ↗"
            secondary
            onPress={() =>
              void Linking.openURL(
                `https://openlibrary.org/works/${book.id}`,
              ).catch((e) => setError(message(e)))
            }
          />
          <Text style={styles.muted}>
            Book descriptions and any available reviews are from Open Library.
            Reviews open on its website.
          </Text>
        </>
      )}
    </>
  );
}
export default function ForYou() {
  const { user, profile } = useJournal();
  return (
    <Discovery key={`${user?.uid ?? "guest"}:${profile.language ?? "eng"}`} />
  );
}
function Discovery() {
  const { user, books, sessions, profile, saveBook } = useJournal();
  const [votes, setVotes] = useState<Record<string, DiscoveryVote>>({}),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [group, setGroup] = useState("Likely to enjoy"),
    [topic, setTopic] = useState(""),
    [seedId, setSeedId] = useState<string | null>(null),
    [results, setResults] = useState<{
      personal: BookMatch[];
      explore: BookMatch[];
      peers: BookMatch[];
      peerCount: number;
      exploreTopic: string;
    } | null>(null);
  const [savedMaybe, setSavedMaybe] = useState<BookMatch[]>([]);
  const [generation, setGeneration] = useState(0);
  const choices = [
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
  const liked = new Set(
    sessions.filter((s) => s.reaction === "Liked it").map((s) => s.bookId),
  );
  const seeds = books
    .filter((b) => b.status !== "Dropped" && b.status !== "Want to Read")
    .sort(
      (a, b) =>
        Number(liked.has(b.id)) - Number(liked.has(a.id)) ||
        b.updatedAt - a.updatedAt,
    );
  const seed =
      seedId === ""
        ? undefined
        : (seeds.find((b) => b.id === seedId) ?? seeds[0]),
    selectedTopic = topic || profile.topics[0] || "Fiction";
  useEffect(() => {
    let active = true;
    void api<{ votes: Record<string, DiscoveryVote>; saved: BookMatch[] }>(
      "/v1/discovery/feedback",
    )
      .then((r) => {
        if (active) {
          setVotes(r.votes);
          setSavedMaybe(r.saved);
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [generation]);
  async function discover() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const hidden = Object.keys(votes).filter(
        (id) => votes[id] === "no" || votes[id] === "yes",
      );
      const usual = new Set(
        [
          ...profile.topics,
          ...books
            .filter((b) => b.status !== "Dropped")
            .flatMap((b) => b.topics),
        ].map((t) => t.toLowerCase()),
      );
      const exploreTopic =
        ["History", "Science", "Poetry", "Travel", "Art", "Biography"].find(
          (t) => !usual.has(t.toLowerCase()),
        ) ?? "Nature";
      const [personal, explore, community] = await Promise.all([
        findBookRecommendations(
          seed,
          selectedTopic,
          books,
          hidden,
          profile.language ?? "eng",
        ),
        findBookRecommendations(
          undefined,
          exploreTopic,
          books,
          hidden,
          profile.language ?? "eng",
        ),
        api<{ readers: PublicReader[] }>("/v1/discovery/readers"),
      ]);
      const peers = peerMatches(
        community.readers,
        user!.uid,
        [...profile.topics, ...seeds.flatMap((b) => b.topics)],
        profile.language ?? "eng",
        books,
        hidden,
      );
      const selected = diverseMatches(personal.matches);
      setResults({
        personal: selected,
        explore: diverseMatches(
          explore.matches.filter((b) => !selected.some((p) => p.id === b.id)),
        ),
        peers: peers.matches,
        peerCount: peers.peerCount,
        exploreTopic,
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function vote(book: BookMatch, value: DiscoveryVote) {
    setSaving(book.id);
    setError("");
    setNotice("");
    try {
      if (value === "yes" && !books.some((b) => sameBook(book, b)))
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
          catalogId: book.id,
          language: profile.language ?? "eng",
        });
      await api(`/v1/discovery/feedback/${book.id}`, "PUT", {
        value,
        book: {
          title: book.title.slice(0, 240),
          authors: book.authors.slice(0, 10).map((a) => a.slice(0, 160)),
          cover: book.cover,
          subjects: book.matchedTopics.slice(0, 8).map((s) => s.slice(0, 80)),
          language: profile.language ?? "eng",
          pageCount: book.pageCount ?? null,
        },
      });
      setSavedMaybe((previous) =>
        value === "maybe"
          ? [...previous.filter((b) => b.id !== book.id), book]
          : previous.filter((b) => b.id !== book.id),
      );
      setVotes((v) => ({ ...v, [book.id]: value }));
      setNotice(
        value === "yes"
          ? "Added to Want to Read. Confirm your edition’s page count when you begin."
          : value === "maybe"
            ? "Saved as Maybe. This choice follows your account."
            : "Preference saved. We’ll leave this title out of future suggestions.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving("");
    }
  }
  const visible = (
    group === "Saved for later"
      ? savedMaybe
      : group === "Likely to enjoy"
        ? results?.personal
        : group === "Explore something new"
          ? results?.explore
          : results?.peers
  )?.filter((b) => votes[b.id] !== "no");
  return (
    <Page title="Your next good book">
      <Text style={styles.body}>Three ways to discover your next chapter.</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>Start with your taste</Text>
        <Text style={styles.muted}>
          {seed
            ? `${liked.has(seed.id) ? "You liked a reading session in" : "Based on your library’s"} ${seed.title}. Themes and authors guide these matches; longer reading time alone does not mean you enjoyed a book.`
            : `Based on your selected topic: ${selectedTopic}.`}
        </Text>
        <Chips
          values={["My reading", "Choose a topic"]}
          value={seed ? "My reading" : "Choose a topic"}
          onChange={(v) => {
            if (busy) return;
            setSeedId(v === "My reading" ? null : "");
            setResults(null);
          }}
        />
        {seed ? (
          <>
            <Text style={styles.muted}>Change the starting book</Text>
            {seeds.slice(0, 4).map((b) => (
              <Button
                key={b.id}
                title={`${b.id === seed.id ? "✓ " : ""}${b.title}`}
                secondary
                disabled={busy}
                onPress={() => {
                  setSeedId(b.id);
                  setResults(null);
                }}
              />
            ))}
          </>
        ) : (
          <Chips
            values={choices}
            value={selectedTopic}
            onChange={(v) => {
              if (busy) return;
              setTopic(v);
              setResults(null);
            }}
          />
        )}
        <Button
          title={results ? "Refresh suggestions" : "Find my next books"}
          busy={busy}
          disabled={!ready || !!saving}
          onPress={() => void discover()}
        />
        <Text style={styles.muted}>
          We search Open Library with the chosen title, author or topics. Your
          private notes and reading times are not sent to the catalog.
        </Text>
        <Button
          title="Change recommendation language"
          secondary
          onPress={() => router.push("/settings")}
        />
      </View>
      {!!error && (
        <>
          <Text style={styles.error}>{error}</Text>
          {!ready && (
            <Button
              title="Retry loading preferences"
              secondary
              onPress={() => setGeneration(generation + 1)}
            />
          )}
        </>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {notice}
        </Text>
      )}
      <Chips
        values={[
          "Likely to enjoy",
          "Explore something new",
          "Readers like you",
        ]}
        value={group}
        onChange={setGroup}
      />
      <Button
        title={`Saved for later · ${savedMaybe.length}`}
        secondary
        onPress={() => setGroup("Saved for later")}
      />
      <Text style={styles.label}>
        {group === "Saved for later" ? "YOUR MAYBE LIST" : "UP TO 5 NEW BOOKS"}
      </Text>
      {group === "Readers like you" && (
        <View style={styles.card}>
          <Text style={styles.body}>
            Books explicitly liked by readers who opted in and share a topic
            with you.
          </Text>
          <Text style={styles.muted}>
            At least 3 other matching readers are needed; each suggested book
            must be liked by at least 2.{" "}
            {results
              ? `${results.peerCount} matching readers available.`
              : "Find books above to check the current community."}
          </Text>
          <Button
            title="Community sharing preferences"
            secondary
            onPress={() => router.push("/community/leaderboard")}
          />
        </View>
      )}
      {group === "Explore something new" && results && (
        <Text style={styles.body}>
          Try {results.exploreTopic}: a topic outside your recorded interests.
        </Text>
      )}
      {!results && group !== "Saved for later" && (
        <Text style={styles.muted}>
          Choose a starting point above to load your suggestions.
        </Text>
      )}
      {(results || group === "Saved for later") && !visible?.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>
            {group === "Readers like you"
              ? "This shelf is growing."
              : "No new matches this time."}
          </Text>
          <Text style={styles.body}>
            {group === "Readers like you"
              ? "There isn’t enough shared reading evidence yet. Your personal suggestions are still available."
              : "Try another topic or starting book. Books already in your library and titles you dismissed are excluded."}
          </Text>
        </View>
      )}
      {visible?.map((book) => (
        <View key={book.id} style={styles.card}>
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <Cover title={book.title} uri={book.cover} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.heading}>{book.title}</Text>
              <Text style={styles.muted}>
                {book.authors.join(", ") || "Author not listed"}
              </Text>
              <Text style={styles.label}>
                {book.matchedTopics.slice(0, 2).join(" · ")}
              </Text>
              <Text style={styles.muted}>
                {book.pageCount
                  ? `About ${book.pageCount} pages · catalog edition estimate`
                  : "Page count varies by edition"}
              </Text>
            </View>
          </View>
          <Text style={styles.body}>{book.reason}</Text>
          <BookDetails book={book} />
          <Button
            title={
              books.some((b) => sameBook(book, b))
                ? "In your library ✓"
                : "Yes · Add to Want to Read"
            }
            disabled={!!saving || books.some((b) => sameBook(book, b))}
            busy={saving === book.id}
            onPress={() => void vote(book, "yes")}
          />
          <Button
            title={
              votes[book.id] === "maybe"
                ? "Maybe · saved ✓"
                : "Maybe · Save for later"
            }
            secondary
            disabled={!!saving}
            onPress={() => void vote(book, "maybe")}
          />
          <Button
            title="Not interested"
            secondary
            disabled={!!saving}
            onPress={() => void vote(book, "no")}
          />
        </View>
      ))}
      <Text style={styles.muted}>
        Adding a title creates a library entry; it does not import an ebook.
        Maybe and Not interested are saved to your account. Public catalog
        metadata can be incomplete.
      </Text>
    </Page>
  );
}
