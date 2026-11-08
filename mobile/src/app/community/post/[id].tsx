import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Page,
  Button,
  Field,
  Chips,
  styles,
  message,
} from "../../../components/ui";
import {
  Avatar,
  Badge,
  LoadState,
  PostCard,
} from "../../../components/community";
import {
  useCommunityDraft,
  useCommunityResource,
} from "../../../lib/community";
import { useJournal } from "../../../lib/journal";
import { api } from "../../../lib/api";
import {
  circles,
  type CommunityPost,
  type CommunityComment,
  type CommunityHome,
} from "../../../../../shared/community";

export default function PostDetail() {
  const params = useLocalSearchParams<{ id: string; circleId: string }>();
  const { user, loading } = useJournal();
  if (loading || !user) return <Page title="Opening the conversation…" back />;
  return (
    <Conversation
      key={`${user.uid}:${params.circleId}:${params.id}`}
      id={params.id}
      circleId={params.circleId}
    />
  );
}
function Conversation({ id, circleId }: { id: string; circleId: string }) {
  const { user } = useJournal();
  const path = `/v1/community/circles/${circleId}/posts/${id}`;
  const post = useCommunityResource<CommunityPost>(path);
  const comments = useCommunityResource<{ comments: CommunityComment[] }>(
    `${path}/comments`,
  );
  const home = useCommunityResource<CommunityHome>("/v1/community");
  const draft = useCommunityDraft(
    `community-reply:${user!.uid}:${circleId}:${id}`,
    { id: randomUUID(), name: "", body: "" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("Spam");
  const circle = home.data?.circles.find((c) => c.id === circleId);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function reply() {
    await api(`${path}/comments/${draft.draft.id}`, "PUT", {
      displayName: draft.draft.name || home.data?.displayName || "",
      body: draft.draft.body,
    });
    draft.setDraft({
      id: randomUUID(),
      name: draft.draft.name || home.data?.displayName || "",
      body: "",
    });
    setNotice("Your encouragement is part of the conversation.");
    await Promise.all([comments.refresh(), post.refresh()]);
  }
  if (post.error && !post.data)
    return (
      <Page title="Conversation unavailable" back>
        <LoadState
          loading={false}
          error={post.error}
          retry={() => void post.refresh()}
        />
        <Button
          title="Back to circle"
          secondary
          onPress={() =>
            router.replace({
              pathname: "/community/circle/[id]",
              params: { id: circleId },
            })
          }
        />
      </Page>
    );
  return (
    <Page
      title={circles.find((c) => c.id === circleId)?.name ?? "Conversation"}
      back
    >
      {home.data?.testMode && (
        <Badge text="Test conversation · isolated from live circles" accent />
      )}
      <LoadState
        loading={post.loading}
        error={post.error || comments.error}
        retry={() => {
          void post.refresh();
          void comments.refresh();
        }}
      />
      {post.data && (
        <>
          <PostCard
            post={post.data}
            busy={busy}
            onEncourage={() =>
              void run(async () => {
                post.setData(
                  await api<CommunityPost>(`${path}/encouragement`, "PUT", {
                    active: !post.data!.encouraged,
                  }),
                );
              })
            }
          />
          <Button
            title={menu ? "Close post options" : "Post options"}
            secondary
            onPress={() => {
              setMenu(!menu);
              setConfirm("");
            }}
          />
          {menu && (
            <View style={styles.card}>
              {post.data.isOwn ? (
                <Button
                  title="Remove my post"
                  secondary
                  onPress={() => setConfirm("delete")}
                />
              ) : (
                <>
                  <Button
                    title="Report this post"
                    secondary
                    onPress={() => setConfirm("report")}
                  />
                  <Button
                    title="Block this reader"
                    secondary
                    onPress={() => setConfirm("block")}
                  />
                </>
              )}
              {confirm === "delete" && (
                <>
                  <Text style={styles.body}>
                    Remove this post and its conversation from the circle? Your
                    private reading session will remain saved.
                  </Text>
                  <Button
                    title="Confirm removal"
                    busy={busy}
                    onPress={() =>
                      void run(async () => {
                        await api(path, "DELETE");
                        router.replace({
                          pathname: "/community/circle/[id]",
                          params: { id: circleId },
                        });
                      })
                    }
                  />
                </>
              )}
              {confirm === "block" && (
                <>
                  <Text style={styles.body}>
                    Hide this reader’s posts and prevent interactions between
                    you. You can undo this from Community.
                  </Text>
                  <Button
                    title="Confirm block"
                    busy={busy}
                    onPress={() =>
                      void run(async () => {
                        await api(
                          `/v1/community/blocks/${post.data!.authorId}`,
                          "PUT",
                          { active: true, displayName: post.data!.authorName },
                        );
                        router.replace({
                          pathname: "/community/circle/[id]",
                          params: { id: circleId },
                        });
                      })
                    }
                  />
                </>
              )}
              {confirm === "report" && (
                <>
                  <Text style={styles.label}>
                    What would you like to report?
                  </Text>
                  <Chips
                    values={[
                      "Spam",
                      "Unkind or harmful",
                      "Privacy concern",
                      "Other",
                    ]}
                    value={reason}
                    onChange={setReason}
                  />
                  <Button
                    title="Submit report"
                    busy={busy}
                    onPress={() =>
                      void run(async () => {
                        await api(`${path}/report`, "PUT", { reason });
                        setNotice(
                          "Report saved for review. You can also block this reader to hide their posts.",
                        );
                        setConfirm("");
                        setMenu(false);
                      })
                    }
                  />
                </>
              )}
            </View>
          )}
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.body}>{notice}</Text>}
      <Text style={styles.heading}>Conversation</Text>
      <Badge text="Chronological · supportive, kind words" />
      {comments.data?.comments.map((comment) => (
        <View key={comment.id} style={styles.card}>
          <View style={styles.row}>
            <Avatar name={comment.authorName} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {comment.authorName}
                {comment.isOwn ? " · You" : ""}
              </Text>
              <Text style={styles.muted}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <Text style={styles.body}>{comment.body}</Text>
        </View>
      ))}
      {!comments.loading && !comments.data?.comments.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>Be the first to cheer them on.</Text>
          <Text style={styles.body}>
            A few kind words can make someone’s next chapter easier to start.
          </Text>
        </View>
      )}
      {circle?.joined ? (
        <View style={styles.card}>
          <Field
            label="Your public display name"
            value={draft.draft.name || home.data?.displayName || ""}
            onChangeText={(name) => draft.setDraft((d) => ({ ...d, name }))}
            maxLength={40}
          />
          <Field
            label="Leave a little encouragement…"
            value={draft.draft.body}
            onChangeText={(body) => draft.setDraft((d) => ({ ...d, body }))}
            multiline
            numberOfLines={3}
            maxLength={600}
          />
          {!!draft.storageError && (
            <Text style={styles.error}>{draft.storageError}</Text>
          )}
          <Button
            title="Send reply"
            disabled={
              !draft.ready ||
              !draft.draft.body.trim() ||
              !(draft.draft.name || home.data?.displayName)?.trim()
            }
            busy={busy}
            onPress={() => void run(reply)}
          />
        </View>
      ) : (
        <Button
          title="Join circle to reply"
          busy={busy}
          onPress={() =>
            void run(async () => {
              await api(`/v1/community/circles/${circleId}/membership`, "PUT", {
                active: true,
              });
              await home.refresh();
            })
          }
        />
      )}
    </Page>
  );
}
