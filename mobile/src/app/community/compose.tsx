import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Feather } from "@expo/vector-icons";
import {
  Page,
  Button,
  Chips,
  Field,
  color,
  styles,
  message,
} from "../../components/ui";
import { Badge, LoadState, PostCard } from "../../components/community";
import { useCommunityDraft, useCommunityResource } from "../../lib/community";
import { useJournal } from "../../lib/journal";
import { api } from "../../lib/api";
import {
  durationLabel,
  kindLabels,
  sharedCheckin,
  type CommunityHome,
  type CommunityPost,
  type PostKind,
} from "../../../../shared/community";

interface Draft {
  id: string;
  circleId: string;
  displayName: string;
  kind: PostKind;
  sessionId: string;
  title: string;
  body: string;
  bookTitle: string;
  bookAuthor: string;
  includeDuration: boolean;
  includeProgress: boolean;
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={onChange}
      style={{ ...styles.row, minHeight: 48 }}
    >
      <Feather
        name={value ? "check-square" : "square"}
        color={color.green}
        size={23}
      />
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  );
}

export default function Compose() {
  const params = useLocalSearchParams<{
    circleId?: string;
    sessionId?: string;
    kind?: PostKind;
  }>();
  const { user, loading } = useJournal();
  const home = useCommunityResource<CommunityHome>("/v1/community");
  if (loading || !home.data || !user)
    return (
      <Page title="Share a reading moment" back>
        <LoadState
          loading={loading || home.loading}
          error={home.error}
          retry={() => void home.refresh()}
        />
      </Page>
    );
  return (
    <ComposeForm
      key={`${user.uid}:${params.sessionId ?? "general"}:${params.circleId ?? "any"}`}
      home={home.data}
      refresh={home.refresh}
      params={params}
    />
  );
}
function ComposeForm({
  home,
  refresh,
  params,
}: {
  home: CommunityHome;
  refresh: () => Promise<void>;
  params: { circleId?: string; sessionId?: string; kind?: PostKind };
}) {
  const { user, sessions, books } = useJournal();
  const recent = [...sessions]
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, 8);
  const storageKey = `community-draft:${user!.uid}:${params.sessionId ?? "general"}:${params.circleId ?? "any"}`;
  const saved = useCommunityDraft<Draft>(storageKey, {
    id: randomUUID(),
    circleId:
      params.circleId ?? home.circles.find((c) => c.joined)?.id ?? "fiction",
    displayName: home.displayName,
    kind: params.sessionId ? "checkin" : (params.kind ?? "question"),
    sessionId: params.sessionId ?? recent[0]?.id ?? "",
    title: "",
    body: "",
    bookTitle: "",
    bookAuthor: "",
    includeDuration: true,
    includeProgress: true,
  });
  const { draft, setDraft } = saved;
  const update = (change: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...change }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState<CommunityPost | null>(null);
  const circle = home.circles.find((c) => c.id === draft.circleId);
  const session = sessions.find((s) => s.id === draft.sessionId);
  const book = books.find((b) => b.id === session?.bookId);
  const reading =
    draft.kind === "checkin" && session && book
      ? sharedCheckin(
          book,
          session,
          draft.includeDuration,
          draft.includeProgress,
        )
      : null;
  const preview: CommunityPost = {
    id: draft.id,
    circleId: draft.circleId,
    authorId: user!.uid,
    authorName: draft.displayName || "Your display name",
    kind: draft.kind,
    title: draft.kind === "question" ? draft.title : "",
    body: draft.body,
    book:
      draft.kind === "recommendation"
        ? {
            title: draft.bookTitle || "Your recommended book",
            author: draft.bookAuthor,
            cover: "",
          }
        : (reading?.book ?? null),
    reading: reading?.reading ?? null,
    createdAt: 0,
    encouragementCount: 0,
    commentCount: 0,
    encouraged: false,
    isOwn: true,
  };
  const valid =
    circle?.joined &&
    draft.displayName.trim() &&
    (draft.kind === "checkin"
      ? Boolean(reading)
      : draft.kind === "question"
        ? draft.title.trim()
        : draft.bookTitle.trim() && draft.body.trim());
  async function join() {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/community/circles/${draft.circleId}/membership`, "PUT", {
        active: true,
      });
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const base = {
        circleId: draft.circleId,
        displayName: draft.displayName,
        kind: draft.kind,
        body: draft.body,
      };
      const input =
        draft.kind === "checkin"
          ? {
              ...base,
              sessionId: draft.sessionId,
              includeDuration: draft.includeDuration,
              includeProgress: draft.includeProgress,
            }
          : draft.kind === "question"
            ? { ...base, title: draft.title }
            : {
                ...base,
                bookTitle: draft.bookTitle,
                bookAuthor: draft.bookAuthor,
              };
      const result = await api<CommunityPost>(
        `/v1/community/posts/${draft.id}`,
        "PUT",
        input,
      );
      setPosted(result);
      try {
        await saved.clear();
      } catch {
        /* Published successfully; a retry uses the same ID. */
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (posted)
    return (
      <Page title="A little progress, shared.">
        <Text style={styles.body}>Your post is now in {circle?.name}.</Text>
        <Button
          title="View post"
          onPress={() =>
            router.replace({
              pathname: "/community/post/[id]",
              params: { id: posted.id, circleId: posted.circleId },
            })
          }
        />
        <Button
          title="Back to Community"
          secondary
          onPress={() => router.replace("/(tabs)/community")}
        />
      </Page>
    );
  if (!saved.ready) return <Page title="Opening your draft…" back />;
  return (
    <Page
      title={
        params.sessionId ? "Share a little progress" : "Share a reading moment"
      }
      back
    >
      {home.testMode && (
        <Badge
          text="Test community · your post stays in the test space"
          accent
        />
      )}
      {params.sessionId && (
        <View style={styles.card}>
          <Text style={styles.heading}>Your reading session is saved.</Text>
          <Text style={styles.body}>
            Sharing is optional. Your private journal is already safe.
          </Text>
        </View>
      )}
      <Badge
        text={saved.saved ? "Draft saved on this device" : "Saving your draft…"}
      />
      {!!saved.storageError && (
        <Text style={styles.error}>{saved.storageError}</Text>
      )}
      <Chips
        values={Object.entries(kindLabels)
          .filter(([kind]) => kind !== "reflection")
          .map(([, label]) => label)}
        value={kindLabels[draft.kind]}
        onChange={(label) =>
          update({
            kind: (Object.keys(kindLabels) as PostKind[]).find(
              (kind) => kindLabels[kind] === label,
            )!,
          })
        }
      />
      <Text style={styles.label}>CHOOSE A READING CIRCLE</Text>
      {home.circles.map((c) => (
        <Button
          key={c.id}
          title={`${c.id === draft.circleId ? "✓ " : ""}${c.name}`}
          secondary={c.id !== draft.circleId}
          onPress={() => update({ circleId: c.id })}
        />
      ))}
      {!circle?.joined && (
        <View style={styles.card}>
          <Text style={styles.body}>
            Join this circle to share with its readers.
          </Text>
          <Button
            title={`Join ${circle?.name ?? "circle"}`}
            busy={busy}
            onPress={() => void join()}
          />
        </View>
      )}
      <Field
        label="Your public display name"
        value={draft.displayName}
        maxLength={40}
        onChangeText={(displayName) => update({ displayName })}
        placeholder="A first name or nickname"
      />
      {draft.kind === "checkin" && (
        <>
          <Text style={styles.heading}>Choose a reading session</Text>
          {!recent.length && (
            <Text style={styles.body}>
              Save a reading session first, or share a question or
              recommendation.
            </Text>
          )}
          {recent.map((s) => (
            <Button
              key={s.id}
              title={`${s.id === draft.sessionId ? "✓ " : ""}${books.find((b) => b.id === s.bookId)?.title ?? "Book"} · ${durationLabel(s.durationSeconds)} · ${new Date(s.endedAt).toLocaleDateString()}`}
              secondary={s.id !== draft.sessionId}
              onPress={() => update({ sessionId: s.id })}
            />
          ))}
          <View style={styles.card}>
            <Toggle
              label="Include reading duration"
              value={draft.includeDuration}
              onChange={() =>
                update({ includeDuration: !draft.includeDuration })
              }
            />
            <Toggle
              label="Include page or percentage progress"
              value={draft.includeProgress}
              onChange={() =>
                update({ includeProgress: !draft.includeProgress })
              }
            />
          </View>
        </>
      )}
      {draft.kind === "question" && (
        <Field
          label="What would you like to ask the circle?"
          value={draft.title}
          onChangeText={(title) => update({ title })}
          maxLength={140}
          placeholder="What helps you find time for reading?"
        />
      )}
      {draft.kind === "recommendation" && (
        <>
          <Field
            label="Book title"
            value={draft.bookTitle}
            onChangeText={(bookTitle) => update({ bookTitle })}
            maxLength={240}
          />
          <Field
            label="Author (optional)"
            value={draft.bookAuthor}
            onChangeText={(bookAuthor) => update({ bookAuthor })}
            maxLength={160}
          />
        </>
      )}
      <Field
        label={
          draft.kind === "recommendation"
            ? "Why would you recommend it?"
            : draft.kind === "checkin"
              ? "Circle note (optional)"
              : "Add a little context (optional)"
        }
        value={draft.body}
        onChangeText={(body) => update({ body })}
        multiline
        numberOfLines={5}
        maxLength={draft.kind === "checkin" ? 600 : 1200}
        placeholder="A thought you’d like to share…"
      />
      <View style={{ ...styles.card, backgroundColor: "#e7eee2" }}>
        <Text style={styles.heading}>Your privacy comes first</Text>
        <Text style={styles.body}>
          Only what you see in the preview will be shared with signed-in
          readers. Your private notes, reading location, and email stay in your
          journal.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <Text style={styles.label}>LIVE PREVIEW · {circle?.name}</Text>
        <PostCard post={preview} preview />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={
          draft.kind === "checkin" ? "Share to Circle" : "Publish to Circle"
        }
        disabled={!valid}
        busy={busy}
        onPress={() => void publish()}
      />
      <Button
        title={
          params.sessionId
            ? "Keep it private & return to Library"
            : "Save draft & close"
        }
        secondary
        disabled={busy}
        onPress={() =>
          params.sessionId ? router.replace("/(tabs)") : router.back()
        }
      />
    </Page>
  );
}
