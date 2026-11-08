import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useJournal } from "../lib/journal";
import { Avatar } from "./community";
import { Button, Chips, color, styles } from "./ui";
import {
  leaderboardCategories,
  rankReaders,
  type LeaderboardData,
  type LeaderboardMetric,
  type ReaderTier,
} from "../../../shared/leaderboard";

export default function LeaderboardPanel({
  data,
  loading,
  error,
  refresh,
  manage = true,
}: {
  data: LeaderboardData | null;
  loading: boolean;
  error: string;
  refresh: () => void;
  manage?: boolean;
}) {
  const { user } = useJournal();
  const [selectedTier, setTier] = useState<ReaderTier | null>(null);
  const [metric, setMetric] = useState<LeaderboardMetric>("booksFinished");
  const tier = selectedTier ?? data?.participation.tier ?? "Beginner";
  const category = leaderboardCategories.find((c) => c.id === metric)!;
  const ranking = rankReaders(data?.readers ?? [], tier, metric);
  const own = ranking.find((r) => r.id === user?.uid);
  const rows = ranking.slice(0, 10);
  if (own && !rows.some((r) => r.id === own.id)) rows.push(own);
  const icons = {
    booksFinished: "book-open",
    bestDayPages: "layers",
    growthMinutes: "trending-up",
    longestMinutes: "clock",
  } as const;
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.between}>
        <Text style={styles.heading}>Leaderboard</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh leaderboard"
          disabled={loading}
          onPress={refresh}
          style={{ padding: 12 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={color.green} />
          ) : (
            <Feather name="refresh-cw" size={18} color={color.green} />
          )}
        </Pressable>
      </View>
      <Chips
        values={["Beginner", "Experienced"]}
        value={tier}
        onChange={(value) => setTier(value as ReaderTier)}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {leaderboardCategories.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={c.title}
            accessibilityState={{ selected: metric === c.id }}
            onPress={() => setMetric(c.id)}
            style={{
              flexBasis: "46%",
              flexGrow: 1,
              minHeight: 88,
              padding: 14,
              gap: 9,
              borderRadius: 14,
              backgroundColor: metric === c.id ? color.green : color.card,
            }}
          >
            <Feather
              name={icons[c.id]}
              size={18}
              color={metric === c.id ? "#fffdf9" : color.green}
            />
            <Text
              style={[
                styles.label,
                {
                  marginBottom: 0,
                  color: metric === c.id ? "#fffdf9" : color.green,
                  fontSize: 12,
                  lineHeight: 18,
                },
              ]}
            >
              {c.title}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 5 }}>
        <Text style={styles.heading}>{category.title}</Text>
        <Text style={styles.muted}>{category.description}</Text>
      </View>
      {!!error && (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Try again" secondary onPress={refresh} />
        </View>
      )}
      {!loading && !error && !rows.length && (
        <View style={styles.card}>
          <Text style={styles.heading}>Your next small win could be here.</Text>
          <Text style={styles.body}>
            No ranked reading in this group yet. Keep reading at your own pace.
          </Text>
        </View>
      )}
      {!!rows.length && (
        <View
          style={{
            backgroundColor: "#fffdf9",
            borderRadius: 18,
            paddingHorizontal: 16,
          }}
        >
          {rows.map((reader, i) => (
            <Pressable
              key={reader.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${reader.displayName}'s profile`}
              onPress={() =>
                router.push({
                  pathname: "/community/reader/[id]",
                  params: { id: reader.id },
                })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 15,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: color.line,
              }}
            >
              <Text
                style={[
                  styles.heading,
                  {
                    width: 26,
                    textAlign: "center",
                    fontSize: 21,
                    color: reader.rank <= 3 ? color.rust : color.green,
                  },
                ]}
              >
                {reader.rank}
              </Text>
              <Avatar name={reader.displayName} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.body, { fontWeight: "600" }]}>
                  {reader.displayName}
                </Text>
                <Text style={styles.muted}>
                  {reader.id === user?.uid ? "You" : reader.tier}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={styles.heading}>
                  {metric === "growthMinutes" ? "+" : ""}
                  {reader[metric]}
                </Text>
                <Text style={styles.muted}>
                  {reader[metric] === 1 && category.unit !== "min"
                    ? category.unit.slice(0, -1)
                    : category.unit}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={color.muted} />
            </Pressable>
          ))}
        </View>
      )}
      {manage && (
        <Button
          title={
            data?.participation.active
              ? "Manage my leaderboard profile"
              : "Join the leaderboard"
          }
          secondary
          onPress={() => router.push("/community/leaderboard")}
        />
      )}
    </View>
  );
}
