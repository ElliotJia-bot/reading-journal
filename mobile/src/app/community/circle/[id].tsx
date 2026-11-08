import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Page, Button, Chips, styles, message } from "../../../components/ui";
import { Badge, LoadState, PostCard } from "../../../components/community";
import { useCommunityResource } from "../../../lib/community";
import { api } from "../../../lib/api";
import {
  circles,
  type CommunityHome,
  type CommunityPost,
} from "../../../../../shared/community";

export default function CircleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const home = useCommunityResource<CommunityHome>("/v1/community");
  const feed = useCommunityResource<{ posts: CommunityPost[] }>(
    `/v1/community/circles/${id}/posts`,
  );
  const circle = home.data?.circles.find((c) => c.id === id);
  const definition = circle ?? circles.find((c) => c.id === id);
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kinds: Record<string, string> = {
    "Check-ins": "checkin",
    Questions: "question",
    Recommendations: "recommendation",
  };
  const posts =
    feed.data?.posts.filter(
      (post) => filter === "All" || post.kind === kinds[filter],
    ) ?? [];
  async function membership() {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/community/circles/${id}/membership`, "PUT", {
        active: !circle?.joined,
      });
      await home.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function encourage(post: CommunityPost) {
    setBusy(true);
    setError("");
    try {
      const next = await api<CommunityPost>(
        `/v1/community/circles/${id}/posts/${post.id}/encouragement`,
        "PUT",
        { active: !post.encouraged },
      );
      feed.setData((current) =>
        current
          ? { posts: current.posts.map((p) => (p.id === next.id ? next : p)) }
          : current,
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!definition)
    return (
      <Page
        title={home.loading ? "Opening your circle…" : "Circle unavailable"}
        back
      >
        <LoadState
          loading={home.loading}
          error={home.error}
          retry={() => void home.refresh()}
        />
        {!home.loading && !home.error && (
          <Text style={styles.body}>
            This circle is unavailable. Return to Community to find another.
          </Text>
        )}
      </Page>
    );
  return (
    <Page back>
      <View style={styles.card}>
        <Badge
          text={home.data?.testMode ? "Test circle" : "A BOOK SANCTUARY"}
        />
        <Text style={styles.title}>{definition.name}</Text>
        <Text style={styles.body}>{definition.description}</Text>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          {definition.tags.map((tag) => (
            <Badge key={tag} text={tag} />
          ))}
        </View>
        <Text style={styles.muted}>
          {circle?.memberCount ?? 0}{" "}
          {circle?.memberCount === 1 ? "reader" : "readers"} ·{" "}
          {circle?.joined ? "You’re part of this circle" : "Beginners welcome"}
        </Text>
        <Button
          title={circle?.joined ? "Share something" : "Join Circle"}
          busy={busy}
          disabled={!circle}
          onPress={
            circle?.joined
              ? () =>
                  router.push({
                    pathname: "/community/compose",
                    params: { circleId: id },
                  })
              : () => void membership()
          }
        />
        {circle?.joined && (
          <Button
            title="Leave circle"
            secondary
            busy={busy}
            onPress={() => void membership()}
          />
        )}
      </View>
      <Chips
        values={["All", "Check-ins", "Questions", "Recommendations"]}
        value={filter}
        onChange={setFilter}
      />
      <LoadState
        loading={home.loading || feed.loading}
        error={home.error || feed.error}
        retry={() => {
          void home.refresh();
          void feed.refresh();
        }}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!feed.loading && !posts.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>
            Every conversation starts somewhere.
          </Text>
          <Text style={styles.body}>
            Share a small reading win, ask a question, or tell us about a book
            you loved.
          </Text>
          {circle?.joined && (
            <Button
              title="Start a conversation"
              onPress={() =>
                router.push({
                  pathname: "/community/compose",
                  params: { circleId: id, kind: "question" },
                })
              }
            />
          )}
        </View>
      )}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          busy={busy}
          onEncourage={() => void encourage(post)}
          onOpen={() =>
            router.push({
              pathname: "/community/post/[id]",
              params: { id: post.id, circleId: id },
            })
          }
        />
      ))}
      {!!posts.length && (
        <Text style={styles.muted}>
          Latest 50 posts · Shared with signed-in readers. Be curious and kind.
        </Text>
      )}
      <Button
        title="Refresh circle"
        secondary
        onPress={() => void feed.refresh()}
      />
    </Page>
  );
}
