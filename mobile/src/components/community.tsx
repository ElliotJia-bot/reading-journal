import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Cover, color, styles } from "./ui";
import {
  durationLabel,
  kindLabels,
  progressLabel,
  type Circle,
  type CommunityPost,
} from "../../../shared/community";

export function Badge({
  text,
  accent = false,
}: {
  text: string;
  accent?: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: accent ? "#f6ded3" : "#e4e9df",
      }}
    >
      <Text
        style={{
          ...styles.muted,
          color: accent ? color.rust : color.green,
          fontSize: 11,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return (
    <>
      {loading && (
        <View style={[styles.row, { justifyContent: "center" }]}>
          <ActivityIndicator color={color.green} />
          <Text style={styles.muted}>Opening your reading circles…</Text>
        </View>
      )}
      {!!error && (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button title="Try again" secondary onPress={retry} />
        </>
      )}
    </>
  );
}
export function CircleCard({
  circle,
  reason,
  busy,
  onJoin,
}: {
  circle: Circle;
  reason?: string;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <View style={styles.card}>
      {!!reason && (
        <Text style={{ ...styles.muted, color: color.green }}>✧ {reason}</Text>
      )}
      <View style={{ ...styles.row, alignItems: "flex-start" }}>
        <View
          style={{
            width: 58,
            height: 76,
            backgroundColor: circle.id === "habit" ? "#e7d9c4" : "#dbe3d1",
            borderRadius: 8,
            borderLeftWidth: 4,
            borderLeftColor: "#b6c0a7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name={circle.icon} size={27} color={color.green} />
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          <Text style={styles.heading}>{circle.name}</Text>
          <Text style={styles.body}>{circle.description}</Text>
        </View>
      </View>
      <View style={{ ...styles.row, flexWrap: "wrap", gap: 6 }}>
        {circle.tags.map((tag) => (
          <Badge key={tag} text={tag} />
        ))}
      </View>
      <View style={styles.between}>
        <Text style={styles.muted}>
          {circle.memberCount} {circle.memberCount === 1 ? "reader" : "readers"}
        </Text>
        <Text style={styles.muted}>
          {circle.joined ? "✓ Joined" : "Everyone is welcome"}
        </Text>
      </View>
      <Button
        title={circle.joined ? "Open circle" : "Join Circle"}
        busy={busy}
        onPress={
          circle.joined
            ? () =>
                router.push({
                  pathname: "/community/circle/[id]",
                  params: { id: circle.id },
                })
            : onJoin
        }
      />
      {!circle.joined && (
        <Button
          title="Take a look"
          secondary
          onPress={() =>
            router.push({
              pathname: "/community/circle/[id]",
              params: { id: circle.id },
            })
          }
        />
      )}
    </View>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#e3e7d9",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ ...styles.heading, fontSize: 22 }}>
        {name.trim().slice(0, 1).toUpperCase() || "R"}
      </Text>
    </View>
  );
}
export function PostCard({
  post,
  preview = false,
  busy = false,
  onEncourage,
  onOpen,
}: {
  post: CommunityPost;
  preview?: boolean;
  busy?: boolean;
  onEncourage?: () => void;
  onOpen?: () => void;
}) {
  return (
    <View
      style={{
        ...styles.card,
        backgroundColor: "#fffdf9",
        borderWidth: 1,
        borderColor: color.line,
      }}
    >
      <View style={styles.row}>
        <Avatar name={post.authorName} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>
            {post.authorName || "Your display name"}
            {post.isOwn && !preview ? " · You" : ""}
          </Text>
          <Text style={styles.muted}>
            {preview
              ? "Post preview"
              : new Date(post.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
          </Text>
        </View>
      </View>
      <Badge text={kindLabels[post.kind]} accent={post.kind === "question"} />
      {!!post.title && <Text style={styles.heading}>{post.title}</Text>}
      {post.book && (
        <View
          style={{
            ...styles.row,
            padding: 12,
            borderRadius: 12,
            backgroundColor: color.card,
          }}
        >
          <Cover title={post.book.title} uri={post.book.cover} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.heading}>{post.book.title}</Text>
            <Text style={styles.muted}>{post.book.author}</Text>
            {post.reading?.durationSeconds !== undefined && (
              <Text style={{ ...styles.muted, color: color.rust }}>
                {durationLabel(post.reading.durationSeconds)} read
              </Text>
            )}
            {post.reading?.progress && (
              <Text style={{ ...styles.muted, color: color.rust }}>
                {progressLabel(post.reading.progress)}
              </Text>
            )}
          </View>
        </View>
      )}
      {!!post.excerpt && (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: "#ab8d60",
            paddingLeft: 14,
            gap: 8,
          }}
        >
          <Text style={styles.heading}>“{post.excerpt.quote}”</Text>
          <Text style={styles.muted}>
            Reading page {post.excerpt.page + 1} · reader-selected excerpt
          </Text>
        </View>
      )}
      {!!post.body && (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: color.rust,
            paddingLeft: 14,
          }}
        >
          <Text
            style={
              post.kind === "checkin"
                ? {
                    ...styles.heading,
                    color: color.ink,
                    fontSize: 21,
                    lineHeight: 30,
                  }
                : styles.body
            }
          >
            {post.body}
          </Text>
        </View>
      )}
      {!preview && (
        <View style={{ gap: 10 }}>
          <View style={{ ...styles.between, flexWrap: "wrap" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                post.encouraged
                  ? "Remove encouragement"
                  : "Encourage this reader"
              }
              accessibilityState={{ selected: post.encouraged }}
              disabled={busy || !onEncourage}
              onPress={onEncourage}
              style={{ ...styles.row, paddingVertical: 12 }}
            >
              <Feather
                name="heart"
                size={20}
                color={post.encouraged ? color.rust : color.green}
              />
              <Text style={styles.body}>
                {post.encouragementCount
                  ? `${post.encouragementCount} encouraged`
                  : "Encourage"}
              </Text>
            </Pressable>
            <Text style={styles.muted}>
              {post.commentCount}{" "}
              {post.commentCount === 1 ? "reply" : "replies"}
            </Text>
          </View>
          {onOpen && (
            <Button title="View conversation" secondary onPress={onOpen} />
          )}
        </View>
      )}
    </View>
  );
}
