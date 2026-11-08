import React, { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  Page,
  Button,
  Chips,
  Cover,
  color,
  styles,
} from "../../../components/ui";
import { Avatar, Badge } from "../../../components/community";
import { LogOutButton } from "../../../components/log-out-button";
import { useCommunityResource } from "../../../lib/community";
import { useJournal } from "../../../lib/journal";
import { kindLabels } from "../../../../../shared/community";
import type {
  ReaderProfile,
  ProfileHabits,
} from "../../../../../shared/reader-profile";

export default function ReaderPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useJournal();
  if (loading) return <Page title="Opening profile…" back />;
  if (!user) return <Redirect href="/" />;
  return <Profile key={`${user.uid}:${id}`} id={id} />;
}

function Profile({ id }: { id: string }) {
  const resource = useCommunityResource<ReaderProfile>(
    `/v1/community/readers/${id}`,
  );
  const [tab, setTab] = useState("Library");
  const [shelf, setShelf] = useState("All");
  const reader = resource.data;
  if (!reader)
    return (
      <Page
        title={resource.error ? "Profile unavailable" : "Opening profile…"}
        back
      >
        {resource.loading && <ActivityIndicator color={color.green} />}
        {!!resource.error && (
          <>
            <Text style={styles.body}>{resource.error}</Text>
            <Button
              title="Try again"
              secondary
              onPress={() => void resource.refresh()}
            />
            <Button
              title="Back to Community"
              onPress={() => router.replace("/community")}
            />
          </>
        )}
      </Page>
    );
  const books =
    reader.library?.filter((b) => shelf === "All" || b.status === shelf) ?? [];
  return (
    <Page back>
      <View style={{ gap: 14 }}>
        <View style={styles.row}>
          <Avatar name={reader.displayName} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title}>{reader.displayName}</Text>
            <Text style={styles.muted}>
              {reader.isOwn ? "Your reading space" : "A life in books"}
            </Text>
          </View>
        </View>
        {reader.tier && <Badge text={`${reader.tier} reader`} />}
        {reader.isOwn && (
          <View style={{ gap: 10 }}>
            <Button
              title="Edit profile & sharing"
              secondary
              onPress={() => router.push("/community/leaderboard")}
            />
            <LogOutButton />
          </View>
        )}
      </View>
      <Chips
        values={["Library", "Habits", "Posts"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Library" && (
        <>
          <View style={styles.between}>
            <Text style={styles.heading}>In the library</Text>
            {reader.library !== null && (
              <Text style={styles.muted}>{reader.library.length} books</Text>
            )}
          </View>
          {reader.library === null ? (
            <PrivateSection label="library" />
          ) : (
            <>
              <Chips
                values={[
                  "All",
                  "Reading",
                  "Want to Read",
                  "Finished",
                  "Dropped",
                ]}
                value={shelf}
                onChange={setShelf}
              />
              {reader.isOwn && !reader.sharing.library && (
                <Text style={styles.muted}>
                  Only you can see your library here.
                </Text>
              )}
              {!books.length && <Empty text="No books on this shelf yet." />}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  columnGap: "4%",
                  rowGap: 26,
                }}
              >
                {books.map((book) => (
                  <View key={book.key} style={{ width: "30.6%", gap: 8 }}>
                    <Cover title={book.title} uri={book.cover} />
                    <Text
                      numberOfLines={3}
                      style={[
                        styles.body,
                        { fontSize: 12, lineHeight: 18, fontWeight: "600" },
                      ]}
                    >
                      {book.title}
                    </Text>
                    <Text numberOfLines={2} style={styles.muted}>
                      {book.author}
                    </Text>
                    <Text style={[styles.muted, { color: color.green }]}>
                      {book.status === "Reading" && book.progress !== null
                        ? `${book.progress}% read`
                        : book.status}
                    </Text>
                    {book.status === "Reading" && book.progress !== null && (
                      <View
                        style={{
                          height: 3,
                          borderRadius: 3,
                          backgroundColor: color.line,
                        }}
                      >
                        <View
                          style={{
                            height: 3,
                            borderRadius: 3,
                            backgroundColor: color.green,
                            width: `${book.progress}%`,
                          }}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
      {tab === "Habits" && (
        <>
          <View style={{ gap: 5 }}>
            <Text style={styles.heading}>Reading rhythm</Text>
            <Text style={styles.muted}>Past 30 days</Text>
          </View>
          {reader.habits === null ? (
            <PrivateSection label="reading habits" />
          ) : (
            <>
              {reader.isOwn && !reader.sharing.habits && (
                <Text style={styles.muted}>
                  Only you can see your reading habits here.
                </Text>
              )}
              <Habits habits={reader.habits} />
            </>
          )}
        </>
      )}
      {tab === "Posts" && (
        <>
          <View style={styles.between}>
            <Text style={styles.heading}>Thoughts shared</Text>
            <Text style={styles.muted}>{reader.posts.length} posts</Text>
          </View>
          {!reader.posts.length && (
            <Empty text="No shared thoughts yet. Every good conversation starts with a small thought." />
          )}
          {reader.posts.map((post) => (
            <View
              key={`${post.circleId}:${post.id}`}
              style={[
                styles.card,
                {
                  backgroundColor: "#fffdf9",
                  borderWidth: 1,
                  borderColor: color.line,
                },
              ]}
            >
              <View style={styles.between}>
                <Badge text={kindLabels[post.kind]} />
                <Text style={styles.muted}>
                  {new Date(post.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              {!!post.book && (
                <View style={{ gap: 3 }}>
                  <Text style={styles.heading}>{post.book.title}</Text>
                  <Text style={styles.muted}>{post.book.author}</Text>
                </View>
              )}
              {!!post.title && <Text style={styles.body}>{post.title}</Text>}
              {!!post.excerpt && (
                <Text style={styles.quote}>“{post.excerpt.quote}”</Text>
              )}
              {!!post.body && (
                <Text style={styles.body} numberOfLines={5}>
                  {post.body}
                </Text>
              )}
              <Text style={styles.muted}>
                {post.commentCount}{" "}
                {post.commentCount === 1 ? "reply" : "replies"}
              </Text>
              <Button
                title="View conversation"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/community/post/[id]",
                    params: { id: post.id, circleId: post.circleId },
                  })
                }
              />
            </View>
          ))}
        </>
      )}
    </Page>
  );
}

function Habits({ habits }: { habits: ProfileHabits }) {
  const max = Math.max(1, ...habits.week.map((d) => d.minutes));
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          [habits.minutes, "Minutes read"],
          [habits.sessions, "Sessions"],
          [habits.readingDays, "Reading days"],
          [habits.averageMinutes, "Min per session"],
        ].map(([n, label]) => (
          <View
            key={label}
            style={[styles.card, { flexBasis: "46%", flexGrow: 1, gap: 3 }]}
          >
            <Text style={styles.title}>{n}</Text>
            <Text style={styles.muted}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>The past 7 days</Text>
        <Text style={styles.muted}>Minutes spent reading</Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          {habits.week.map((d, i) => (
            <View
              key={i}
              accessibilityLabel={`${d.day}${d.today ? ", today" : ""}: ${d.minutes} minutes`}
              style={{ flex: 1, alignItems: "center", gap: 7 }}
            >
              <View
                style={{
                  height: 112,
                  justifyContent: "flex-end",
                  alignItems: "center",
                  width: "100%",
                  gap: 5,
                }}
              >
                <Text style={[styles.muted, { fontSize: 10 }]}>
                  {d.minutes || ""}
                </Text>
                <View
                  style={{
                    width: "75%",
                    maxWidth: 35,
                    height: d.minutes ? Math.max(4, (d.minutes / max) * 85) : 1,
                    borderRadius: 3,
                    backgroundColor: d.minutes
                      ? d.today
                        ? color.rust
                        : color.green
                      : color.line,
                  }}
                />
              </View>
              <Text
                style={[
                  styles.muted,
                  { fontSize: 10, color: d.today ? color.rust : color.muted },
                ]}
              >
                {d.day}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {habits.favoriteTime && (
        <View style={styles.card}>
          <Text style={styles.muted}>Favorite time to read</Text>
          <Text style={styles.heading}>{habits.favoriteTime}</Text>
        </View>
      )}
      {!!habits.topTopics.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>Favorite topics</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {habits.topTopics.map((t) => (
              <Badge key={t} text={t} />
            ))}
          </View>
        </View>
      )}
      {!habits.sessions && (
        <Empty text="A reading rhythm will appear after a few reading sessions." />
      )}
    </>
  );
}
function PrivateSection({ label }: { label: string }) {
  return (
    <View style={styles.card}>
      <Feather name="lock" size={22} color={color.green} />
      <Text style={styles.body}>This reader keeps their {label} private.</Text>
    </View>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}
