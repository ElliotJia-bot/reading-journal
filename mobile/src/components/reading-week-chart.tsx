import React from "react";
import { Text, View } from "react-native";
import { readingWeek } from "../../../shared/domain";
import { color, styles } from "./ui";

export default function ReadingWeekChart({
  daily,
  timezone,
  now,
}: {
  daily: Record<string, number>;
  timezone: string;
  now: number;
}) {
  const days = readingWeek(daily, timezone, now);
  const total = days.reduce((sum, day) => sum + day.seconds, 0);
  const active = days.filter((day) => day.seconds > 0).length;
  const maxMinutes = Math.max(0, ...days.map((day) => day.seconds / 60));
  const ceiling = maxMinutes
    ? Math.max(5, Math.ceil(maxMinutes / 10) * 10)
    : 30;
  const minutes = (seconds: number) =>
    seconds > 0 && seconds < 60 ? "<1" : String(Math.round(seconds / 60));
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Your last 7 days</Text>
      <Text style={styles.muted}>
        {days[0].date} – {days[6].date} · Daily reading minutes
      </Text>
      <View style={styles.between}>
        <Text style={styles.title}>
          {minutes(total)} <Text style={styles.body}>min</Text>
        </Text>
        <Text style={styles.body}>{active} of 7 days reading</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View
          importantForAccessibility="no-hide-descendants"
          style={{ width: 23, height: 138 }}
        >
          {[ceiling, ceiling / 2, 0].map((n, index) => (
            <Text
              key={n}
              style={[
                styles.muted,
                {
                  position: "absolute",
                  right: 0,
                  top: 18 + index * 54,
                  fontSize: 10,
                },
              ]}
            >
              {n}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {[24, 78, 132].map((top) => (
            <View
              key={top}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top,
                borderTopWidth: 1,
                borderTopColor: color.line,
              }}
            />
          ))}
          <View style={{ flexDirection: "row", gap: 6 }}>
            {days.map((day) => (
              <View
                key={day.key}
                accessible
                accessibilityLabel={`${day.fullDate}${day.isToday ? ", today" : ""}: ${minutes(day.seconds)} minutes`}
                style={{ flex: 1, alignItems: "center", gap: 7 }}
              >
                <View
                  style={{
                    height: 132,
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <Text
                    style={[
                      styles.muted,
                      {
                        fontSize: 10,
                        color: day.seconds ? color.green : "#8b9188",
                      },
                    ]}
                  >
                    {minutes(day.seconds)}
                  </Text>
                  {day.seconds > 0 && (
                    <View
                      style={{
                        height: Math.max(2, (day.seconds / 60 / ceiling) * 108),
                        width: "72%",
                        maxWidth: 28,
                        borderTopLeftRadius: 5,
                        borderTopRightRadius: 5,
                        backgroundColor: day.isToday ? color.rust : color.green,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.muted,
                    {
                      fontSize: 10,
                      color: day.isToday ? color.rust : color.muted,
                      fontFamily: day.isToday
                        ? "PlusJakartaSans_600SemiBold"
                        : "PlusJakartaSans_400Regular",
                    },
                  ]}
                >
                  {day.isToday ? "Today" : day.weekday}
                </Text>
                <Text style={[styles.muted, { fontSize: 9, marginTop: -7 }]}>
                  {day.date}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.muted}>
        {active
          ? "A little reading, whenever it fits. Blank days mean no logged reading."
          : "Your week is ready for its first reading moment."}
      </Text>
    </View>
  );
}
