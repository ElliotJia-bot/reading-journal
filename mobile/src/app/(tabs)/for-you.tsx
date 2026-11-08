import DemoDataNotice from "../../components/demo-data-notice";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJournal } from "../../lib/journal";
import { api } from "../../lib/api";
import { Page, Button, color, styles, message } from "../../components/ui";
import { DetailFold } from "../../components/insight-blocks";
import { singleFlight } from "../../../../shared/single-flight";
import type { DiscoveryVote } from "../../../../shared/discovery";
import type {
  DiscoveryFeed,
  ShelfBook,
  ReadingExperience,
  RecommendationDetail,
} from "../../../../shared/for-you";
const loadFeed = singleFlight<DiscoveryFeed>(),
  loadDetail = singleFlight<RecommendationDetail>();
const shelfTitles = {
  personal: "Books you might like",
  explore: "Books to explore",
  peers: "Readers like you are reading",
};
function Jacket({ book, large = false }: { book: ShelfBook; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={[
        s.jacket,
        large && { width: 146, height: 218, alignSelf: "center" },
      ]}
    >
      {book.cover && !failed ? (
        <Image
          source={{ uri: book.cover.replace("-M.jpg", "-L.jpg") }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${book.title} cover`}
        />
      ) : (
        <View style={s.fallback}>
          <Text
            numberOfLines={5}
            style={[
              styles.heading,
              { fontSize: large ? 22 : 16, lineHeight: large ? 27 : 21 },
            ]}
          >
            {book.title}
          </Text>
          <Text numberOfLines={2} style={[styles.muted, { fontSize: 10 }]}>
            {book.authors.join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
}
function BookSheet({
  book,
  vote,
  saving,
  onVote,
  onClose,
  owner,
  error,
}: {
  book: ShelfBook;
  vote?: DiscoveryVote;
  saving: boolean;
  onVote: (v: DiscoveryVote) => void;
  onClose: () => void;
  owner: string;
  error: string;
}) {
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<RecommendationDetail | null>(null),
    [detailError, setDetailError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    void loadDetail(`${owner}:${book.id}`, () =>
      api<RecommendationDetail>(`/v1/recommendations/${book.id}/details`),
    )
      .then((r) => {
        if (active) setDetails(r);
      })
      .catch((e) => {
        if (active) setDetailError(message(e));
      });
    return () => {
      active = false;
    };
  }, [owner, book.id, attempt]);
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <View style={s.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close book details"
          disabled={saving}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}
        >
          <View style={s.sheetHeader}>
            <Text style={styles.muted}>A new chapter awaits</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close details"
              disabled={saving}
              onPress={onClose}
              style={s.close}
            >
              <Feather name="x" size={22} color={color.ink} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: 24,
              gap: 16,
            }}
          >
            <Jacket book={book} large />
            <View style={{ alignItems: "center", gap: 5 }}>
              <Text
                style={[
                  styles.heading,
                  { fontSize: 27, lineHeight: 33, textAlign: "center" },
                ]}
              >
                {book.title}
              </Text>
              <Text style={[styles.muted, { textAlign: "center" }]}>
                {book.authors.join(", ") || "Author not listed"}
              </Text>
            </View>
            <View style={[styles.card, { padding: 16, gap: 7 }]}>
              <View style={[styles.row, { gap: 7 }]}>
                <Feather name="sun" size={15} color={color.green} />
                <Text style={[styles.label, { marginBottom: 0 }]}>
                  We Selected FOR YOU
                </Text>
              </View>
              {!!details?.relatedBooks?.length && (
                <Text style={[styles.muted, { color: color.green }]}>
                  Connected to your reading: {details.relatedBooks.join(" · ")}
                </Text>
              )}
              {details?.dataPoints?.map((point, i) => (
                <View key={i} style={{ gap: 5, paddingVertical: 8 }}>
                  <Text style={styles.label}>YOUR READING DATA</Text>
                  <Text style={styles.body}>{point}</Text>
                  <Text style={styles.muted}>
                    Based on logged page progress. Page density differs between
                    books; this does not measure comprehension.
                  </Text>
                </View>
              ))}
              {(details?.reason ?? book.reason)
                .split(/\n\s*\n/)
                .map((paragraph, i) => (
                  <Text key={i} style={styles.body}>
                    {paragraph}
                  </Text>
                ))}
              {!details && !detailError && (
                <View style={[styles.row, { gap: 8 }]}>
                  <ActivityIndicator size="small" color={color.green} />
                  <Text style={styles.muted}>
                    Adding a personal recommendation…
                  </Text>
                </View>
              )}
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.heading}>About this book</Text>
              {details ? (
                <Text
                  style={styles.body}
                  numberOfLines={expanded ? undefined : 6}
                >
                  {details.synopsis ||
                    "A description isn’t available from the catalog yet."}
                </Text>
              ) : (
                <Text style={styles.muted}>
                  {detailError
                    ? "Book details are temporarily unavailable."
                    : "Loading the book description…"}
                </Text>
              )}
              {!!details?.synopsis && details.synopsis.length > 320 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpanded(!expanded)}
                  style={{ minHeight: 36, justifyContent: "center" }}
                >
                  <Text style={[styles.label, { marginBottom: 0 }]}>
                    {expanded ? "Show less" : "Read more"}
                  </Text>
                </Pressable>
              )}
              {!!detailError && (
                <Button
                  title="Retry details"
                  secondary
                  onPress={() => {
                    setDetailError("");
                    setAttempt((a) => a + 1);
                  }}
                />
              )}
            </View>
            <DetailFold title="Recommendation details">
              {details?.support?.map((text, i) => (
                <Text key={i} style={styles.body}>
                  {text}
                </Text>
              ))}
              <Text style={styles.muted}>
                {book.source === "community"
                  ? book.reason
                  : book.source === "popular"
                    ? "Popularity comes from public Open Library reading logs, not a matched Remarked reader group."
                    : "Language and catalog genre/style clues guide this suggestion. Style is an estimate, not a full-text comparison."}
              </Text>
              <Text style={styles.muted}>
                Thinking Machines uses catalog information and a summary of your
                recent reading sessions and feedback. Private notes and email
                are never shared. Descriptions come from Open Library.
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    `https://openlibrary.org/works/${book.id}`,
                  ).catch((e) => setDetailError(message(e)))
                }
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={styles.label}>View catalog source ↗</Text>
              </Pressable>
            </DetailFold>
            {!!error && (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={s.actions}>
            {(
              [
                ["yes", "heart", "Like"],
                ["maybe", "bookmark", vote === "maybe" ? "Maybe ✓" : "Maybe"],
                ["no", "thumbs-down", "Not for me"],
              ] as const
            ).map(([value, icon, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={
                  value === "yes" ? "Like · add to Want to Read" : label
                }
                disabled={saving}
                onPress={() => onVote(value)}
                style={[
                  s.action,
                  value === "yes" && { backgroundColor: color.green },
                  saving && { opacity: 0.5 },
                ]}
              >
                <Feather
                  name={icon}
                  size={18}
                  color={value === "yes" ? "white" : color.green}
                />
                <Text
                  style={[
                    styles.label,
                    {
                      marginBottom: 0,
                      fontSize: 11,
                      color: value === "yes" ? "white" : color.green,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
export default function ForYou() {
  const { user, profile } = useJournal();
  return <Discovery key={`${user?.uid}:${profile.language ?? "eng"}`} />;
}
function Discovery() {
  const { user, refresh } = useJournal();
  const [feed, setFeed] = useState<DiscoveryFeed | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<ShelfBook | null>(null),
    [saving, setSaving] = useState(false),
    [voteError, setVoteError] = useState(""),
    [notice, setNotice] = useState(""),
    [showPreferences, setShowPreferences] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const n = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const next = await loadFeed(user!.uid, () =>
        api<DiscoveryFeed>("/v1/recommendations"),
      );
      if (n === sequence.current) setFeed(next);
    } catch (e) {
      if (n === sequence.current) setError(message(e));
    } finally {
      if (n === sequence.current) setBusy(false);
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        sequence.current++;
      };
    }, [load]),
  );
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  async function vote(value: DiscoveryVote) {
    if (!selected || saving) return;
    setSaving(true);
    setVoteError("");
    try {
      await api(`/v1/recommendations/${selected.id}/feedback`, "PUT", {
        value,
      });
      setFeed((previous) =>
        previous
          ? {
              ...previous,
              votes: { ...previous.votes, [selected.id]: value },
              ...Object.fromEntries(
                (["personal", "explore", "peers"] as const).map((kind) => [
                  kind,
                  value === "maybe"
                    ? previous[kind]
                    : previous[kind].filter((b) => b.id !== selected.id),
                ]),
              ),
            }
          : null,
      );
      setSelected(null);
      setNotice(
        value === "yes"
          ? "Added to Library · Want to Read"
          : value === "maybe"
            ? "Kept in your recommendations"
            : "Removed from future recommendations",
      );
      if (value === "yes") await refresh();
      await load();
    } catch (e) {
      setVoteError(message(e));
    } finally {
      setSaving(false);
    }
  }
  async function experience(value: ReadingExperience) {
    setSaving(true);
    setError("");
    try {
      await api("/v1/recommendations/preferences", "PUT", {
        experience: value,
      });
      setShowPreferences(false);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <Page title="For You">
        <DemoDataNotice />
        {feed?.behavior && (
          <Text style={styles.muted}>
            {feed.selectionMode === "ai"
              ? `AI-ranked from ${feed.behavior.sessionCount} reading sessions · Last 30 days`
              : feed.behavior.sessionCount
                ? "Catalog picks · AI ranking is temporarily unavailable"
                : "Read a little to personalize these picks"}
          </Text>
        )}
        <Text style={[styles.muted, { marginTop: -14 }]}>
          Your next chapter, waiting to be found.
        </Text>
        {!!error && (
          <View style={{ gap: 10 }}>
            <Text style={styles.error}>{error}</Text>
            <Button
              title="Try again"
              secondary
              busy={busy}
              onPress={() => void load()}
            />
          </View>
        )}
        {(["personal", "explore", "peers"] as const).map((kind) => (
          <View key={kind} style={s.shelf}>
            <View style={{ gap: 4 }}>
              <View style={[styles.between, { alignItems: "baseline" }]}>
                <Text style={[styles.heading, { flex: 1 }]}>
                  {shelfTitles[kind]}
                </Text>
                <Text
                  style={[styles.muted, { fontSize: 10, letterSpacing: 1 }]}
                >
                  TOP 6
                </Text>
              </View>
              <Text style={styles.muted}>
                {kind === "personal"
                  ? "New genres. A familiar feel."
                  : kind === "explore"
                    ? "A little outside your usual shelf."
                    : feed?.peerSource === "community"
                      ? "Popular with readers at your experience level."
                      : feed?.peerSource === "mixed"
                        ? "Reader favorites, with popular catalog picks."
                        : "Popular picks while your reader group grows."}
              </Text>
            </View>
            {!feed && busy ? (
              <View style={s.grid}>
                {Array.from({ length: 6 }, (_, i) => (
                  <View
                    key={i}
                    style={[s.tile, s.jacket, { backgroundColor: color.card }]}
                  />
                ))}
              </View>
            ) : feed?.[kind].length ? (
              <View style={s.grid}>
                {feed[kind].map((book) => (
                  <Pressable
                    key={book.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${book.title}`}
                    onPress={() => {
                      setVoteError("");
                      setSelected(book);
                    }}
                    style={({ pressed }) => [
                      s.tile,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <Jacket book={book} />
                    {feed.votes[book.id] === "maybe" && (
                      <View style={s.maybe}>
                        <Feather
                          name="bookmark"
                          size={12}
                          color={color.green}
                        />
                        <Text style={[styles.muted, { fontSize: 10 }]}>
                          Maybe
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>
                {busy
                  ? "Finding your next books…"
                  : error
                    ? "Books will appear when the catalog reconnects."
                    : "You’ve seen the available matches. More will appear as your reading grows."}
              </Text>
            )}
            {kind === "peers" && (
              <View style={{ gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose reading experience"
                  onPress={() => setShowPreferences(!showPreferences)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={styles.muted}>
                    {feed?.experience
                      ? `Your reading experience: ${feed.experience === "Beginner" ? "Getting started" : "Regular reader"} · Change`
                      : "Choose your reading experience →"}
                  </Text>
                </Pressable>
                {showPreferences && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.muted}>
                      Choose what feels right. This isn’t a reading ability
                      test.
                    </Text>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Getting started"
                          secondary
                          disabled={saving}
                          onPress={() => void experience("Beginner")}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Regular reader"
                          secondary
                          disabled={saving}
                          onPress={() => void experience("Experienced")}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
        {busy && feed && <ActivityIndicator color={color.green} />}
      </Page>
      {!!notice && (
        <View accessibilityLiveRegion="polite" style={s.toast}>
          <Feather name="check" size={17} color="white" />
          <Text
            style={[styles.body, { color: "white", flex: 1, fontSize: 12 }]}
          >
            {notice}
          </Text>
        </View>
      )}
      {selected && (
        <BookSheet
          key={selected.id}
          book={selected}
          vote={feed?.votes[selected.id]}
          owner={user!.uid}
          saving={saving}
          onVote={(v) => void vote(v)}
          onClose={() => setSelected(null)}
          error={voteError}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  shelf: {
    gap: 18,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 24,
  },
  tile: { width: "30.5%" },
  jacket: {
    width: "100%",
    aspectRatio: 2 / 3,
    backgroundColor: "#dfdfcf",
    borderRadius: 3,
    overflow: "hidden",
    boxShadow: "0 6px 12px rgba(32,28,20,0.12)",
  },
  fallback: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: "#bbc3b2",
  },
  maybe: { flexDirection: "row", gap: 4, alignItems: "center", paddingTop: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.4)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: color.paper,
    width: "100%",
    maxWidth: 600,
    maxHeight: "94%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 24,
    paddingRight: 12,
    paddingVertical: 8,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    paddingTop: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  action: {
    flex: 1,
    minHeight: 62,
    borderRadius: 12,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toast: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    maxWidth: 550,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: color.green,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
});
