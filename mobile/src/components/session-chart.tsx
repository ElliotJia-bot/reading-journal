import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { ReadingSession } from "../../../shared/domain";
import { calendarRange, pagesRead, sessionDays } from "../../../shared/metrics";
import { styles, color, Chips, Button } from "./ui";
import { DetailFold } from "./insight-blocks";
export default function SessionChart({
  sessions,
  timezone,
  days,
  metric,
  onMetric,
  now: providedNow,
}: {
  sessions: ReadingSession[];
  timezone: string;
  days: number;
  metric: "Time" | "Pages";
  onMetric: (v: "Time" | "Pages") => void;
  now?: number;
}) {
  const chartScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [initialNow] = useState(Date.now);
  const now = providedNow ?? initialNow;
  const earliest = sessions.length
    ? Math.min(...sessions.map((s) => s.startedAt))
    : now;
  const keys = calendarRange(days, timezone, now, earliest),
    daily = sessionDays(sessions, timezone, now);
  const value = (s: ReadingSession) =>
    metric === "Time" ? s.durationSeconds / 60 : (pagesRead(s) ?? 0);
  const total = (key: string) =>
    (daily[key]?.sessions ?? []).reduce((n, s) => n + value(s), 0);
  const max = Math.max(5, ...keys.map(total)),
    ceiling = Math.ceil(max / 5) * 5;
  const sum =
    keys.reduce(
      (n, key) =>
        n +
        (metric === "Time"
          ? (daily[key]?.seconds ?? 0)
          : (daily[key]?.pages ?? 0)),
      0,
    ) / (metric === "Time" ? 60 : 1);
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {days ? `Your last ${days} days` : "Since your first session"}
      </Text>
      <Chips
        values={["Time", "Pages"]}
        value={metric}
        onChange={(v) => onMetric(v as "Time" | "Pages")}
      />
      <Text style={styles.body}>
        {Math.round(sum * 10) / 10}{" "}
        {metric === "Time" ? "minutes" : "pages of forward progress"} ·{" "}
        {keys[0]} – {keys.at(-1)}
      </Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View
          style={{
            height: 136,
            paddingTop: 24,
            width: 30,
            justifyContent: "space-between",
          }}
        >
          {[ceiling, ceiling / 2, 0].map((v) => (
            <Text key={v} style={[styles.muted, { fontSize: 10 }]}>
              {v}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={chartScroll}
          onContentSizeChange={() => {
            if (keys.length > 7)
              chartScroll.current?.scrollToEnd({ animated: false });
          }}
          horizontal
          showsHorizontalScrollIndicator={keys.length > 7}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, gap: 4 }}
        >
          {keys.map((key, index) => (
            <View
              key={key}
              style={{ minWidth: 32, flex: 1, alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  height: 136,
                  width: "100%",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderColor: color.line,
                }}
              >
                <Text style={[styles.muted, { fontSize: 10, marginBottom: 4 }]}>
                  {Math.round(total(key) * 10) / 10}
                </Text>
                {(daily[key]?.sessions ?? [])
                  .sort((a, b) => b.startedAt - a.startedAt)
                  .filter((s) => value(s) > 0)
                  .map((s, i) => (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${key}, session ${i + 1}: ${Math.round(value(s) * 10) / 10} ${metric === "Time" ? "minutes" : "pages"}. Open session insights.`}
                      onPress={() =>
                        router.push({
                          pathname: "/insights/session/[id]",
                          params: { id: s.id },
                        })
                      }
                      style={{
                        height: Math.max(2, (value(s) / ceiling) * 105),
                        width: 22,
                        backgroundColor:
                          index === keys.length - 1
                            ? color.coral
                            : i % 2
                              ? color.greenLift
                              : color.green,
                        borderTopWidth: 1,
                        borderColor: color.paper,
                        borderRadius: 2,
                      }}
                    />
                  ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View sessions on ${key}`}
                accessibilityState={{ selected: selectedDay === key }}
                accessibilityHint="View reading sessions for this day"
                onPress={() => setSelectedDay(key)}
                style={{
                  minWidth: 32,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selectedDay === key ? color.green : color.stone,
                  backgroundColor:
                    selectedDay === key ? color.green : color.greenSoft,
                  paddingVertical: 7,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Text
                  style={[
                    styles.muted,
                    {
                      fontSize: 10,
                      color: selectedDay === key ? color.onDark : color.green,
                    },
                  ]}
                >
                  {new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
                </Text>
                <Text
                  style={[
                    styles.label,
                    {
                      fontSize: 10,
                      marginBottom: 0,
                      color: selectedDay === key ? color.onDark : color.green,
                    },
                  ]}
                >
                  {Number(key.slice(5, 7))}/{Number(key.slice(8))}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
      <Text style={styles.muted}>
        Tap a bar or date for sessions
        {keys.length > 7 ? " · Swipe for earlier days" : ""}
      </Text>
      {metric === "Pages" && (
        <DetailFold title="About page totals">
          <Text style={styles.muted}>
            Forward progress only. Percentage logs are excluded; print pages and
            ebook sections differ.
          </Text>
        </DetailFold>
      )}
      {selectedDay && keys.includes(selectedDay) && (
        <View style={{ gap: 10 }}>
          <Text style={styles.label}>Sessions on {selectedDay}</Text>
          {!daily[selectedDay]?.sessions.length && (
            <Text style={styles.muted}>No reading logged on this day.</Text>
          )}
          {daily[selectedDay]?.sessions.map((s) => (
            <Button
              key={s.id}
              title={`${new Date(s.startedAt).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" })} · ${Math.floor(s.durationSeconds / 60)}m ${s.durationSeconds % 60}s`}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/insights/session/[id]",
                  params: { id: s.id },
                })
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}
