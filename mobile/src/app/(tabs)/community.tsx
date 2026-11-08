import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Page, Button, Chips, styles, message } from "../../components/ui";
import { Avatar, CircleCard, LoadState } from "../../components/community";
import { useCommunityResource } from "../../lib/community";
import { useJournal } from "../../lib/journal";
import { api } from "../../lib/api";
import LeaderboardPanel from "../../components/leaderboard";
import type { LeaderboardData } from "../../../../shared/leaderboard";
import type { Circle, CommunityHome } from "../../../../shared/community";

export default function Community() {
  const resource = useCommunityResource<CommunityHome>("/v1/community");
  const leaderboard = useCommunityResource<LeaderboardData>(
    "/v1/discovery/leaderboard",
  );
  const { profile, user } = useJournal();
  const [filter, setFilter] = useState("All Topics");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const joined = resource.data?.circles.filter((c) => c.joined) ?? [];
  const discover =
    resource.data?.circles.filter(
      (c) => filter === "All Topics" || c.tags.includes(filter),
    ) ?? [];
  async function join(circle: Circle) {
    setBusy(circle.id);
    setError("");
    try {
      await api(`/v1/community/circles/${circle.id}/membership`, "PUT", {
        active: true,
      });
      await resource.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <Page>
      <View style={{ gap: 8 }}>
        <View style={styles.between}>
          <Text style={styles.title}>Community</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open my profile"
            disabled={!user}
            onPress={() =>
              user &&
              router.push({
                pathname: "/community/reader/[id]",
                params: { id: user.uid },
              })
            }
            style={{ padding: 4 }}
          >
            <Avatar
              name={
                leaderboard.data?.participation.displayName ||
                resource.data?.displayName ||
                user?.displayName ||
                "You"
              }
            />
          </Pressable>
        </View>
        <Text style={styles.body}>Every reader has a place to shine.</Text>
      </View>
      <LeaderboardPanel
        data={leaderboard.data}
        loading={leaderboard.loading}
        error={leaderboard.error}
        refresh={() => void leaderboard.refresh()}
      />
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#e3ddd4",
          paddingTop: 24,
          gap: 8,
        }}
      >
        <Text style={styles.heading}>Find your reading people</Text>
        <Text style={styles.muted}>Share a thought. Start a conversation.</Text>
      </View>
      <LoadState
        loading={resource.loading}
        error={resource.error}
        retry={() => void resource.refresh()}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title="Create a circle"
        secondary
        onPress={() => router.push("/community/create")}
      />
      <Text style={styles.heading}>
        My Circles {joined.length ? `· ${joined.length}` : ""}
      </Text>
      {!resource.loading && !joined.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>A quiet place to begin.</Text>
          <Text style={styles.body}>
            Join a circle below. You can listen first and share whenever you
            feel ready.
          </Text>
        </View>
      )}
      {joined.map((circle) => (
        <CircleCard
          key={circle.id}
          circle={circle}
          busy={busy === circle.id}
          onJoin={() => void join(circle)}
        />
      ))}
      <View style={{ gap: 8 }}>
        <Text style={styles.heading}>Discover Circles</Text>
        <Text style={styles.body}>
          Shared curiosities, small steps, and a gentle pace.
        </Text>
      </View>
      <Chips
        values={[
          "All Topics",
          ...new Set(
            resource.data?.circles.flatMap((c) => c.tags) ?? [
              "Fiction",
              "Daily Habit",
              "Nonfiction",
              "Philosophy",
            ],
          ),
        ].slice(0, 12)}
        value={filter}
        onChange={setFilter}
      />
      {discover.map((circle) => {
        const match = profile.topics.find((topic) =>
          circle.tags.some((tag) => tag.toLowerCase() === topic.toLowerCase()),
        );
        return (
          <CircleCard
            key={circle.id}
            circle={circle}
            reason={match ? `Because you selected ${match}` : undefined}
            busy={busy === circle.id}
            onJoin={() => void join(circle)}
          />
        );
      })}
      <View style={styles.card}>
        <Text style={styles.heading}>A quiet sanctuary for readers</Text>
        <Text style={styles.body}>
          Read with curiosity. Share small wins. Give someone a little
          encouragement.
        </Text>
        <Text style={styles.muted}>
          Your journal stays private. You choose what to share.
        </Text>
      </View>
      {!!resource.data?.blockedReaders.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>Blocked readers</Text>
          {resource.data.blockedReaders.map((reader) => (
            <Button
              key={reader.id}
              title={`Unblock ${reader.name}`}
              secondary
              busy={busy === reader.id}
              onPress={() => {
                setBusy(reader.id);
                void api(`/v1/community/blocks/${reader.id}`, "PUT", {
                  active: false,
                })
                  .then(() => resource.refresh())
                  .catch((e) => setError(message(e)))
                  .finally(() => setBusy(""));
              }}
            />
          ))}
        </View>
      )}
    </Page>
  );
}
