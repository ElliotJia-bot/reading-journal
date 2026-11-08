import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { durationLabel, type PagePace } from "../../../shared/reading-insights";
import { color, styles } from "./ui";

export default function PageTimeChart({
  rows,
  selected,
  onSelect,
}: {
  rows: PagePace[];
  selected: number;
  onSelect: (page: number) => void;
}) {
  const ceiling = Math.max(
    30,
    Math.ceil(Math.max(...rows.map((r) => r.activeMs / 1000), 0) / 30) * 30,
  );
  return (
    <View style={[styles.card, { padding: 16 }]}>
      <View style={styles.between}>
        <Text style={styles.heading}>Time per page</Text>
        <Text style={styles.muted}>min / sec</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 5 }}>
        <View
          style={{
            width: 38,
            height: 175,
            paddingTop: 20,
            justifyContent: "space-between",
          }}
        >
          {[ceiling, ceiling / 2, 0].map((n) => (
            <Text key={n} style={[styles.muted, { fontSize: 10 }]}>
              {durationLabel(n)}
            </Text>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={rows.length > 5}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, gap: 6 }}
        >
          {rows.map((r) => (
            <Pressable
              key={r.page}
              accessibilityRole="button"
              accessibilityState={{ selected: r.page === selected }}
              accessibilityLabel={`Page ${r.page + 1}: ${durationLabel(r.activeMs / 1000)}${r.slower ? ", longer dwell" : ""}. View passage insights.`}
              onPress={() => onSelect(r.page)}
              style={{ minWidth: 44, flex: 1, alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  height: 175,
                  justifyContent: "flex-end",
                  alignItems: "center",
                  width: "100%",
                  borderBottomWidth: 1,
                  borderColor: color.line,
                }}
              >
                <Text style={[styles.muted, { fontSize: 10, marginBottom: 5 }]}>
                  {durationLabel(r.activeMs / 1000)}
                </Text>
                <View
                  style={{
                    width: 26,
                    height: r.activeMs
                      ? Math.max(2, (r.activeMs / 1000 / ceiling) * 145)
                      : 0,
                    backgroundColor: r.slower ? color.rust : color.green,
                    opacity: selected === r.page ? 1 : 0.6,
                    borderTopLeftRadius: 5,
                    borderTopRightRadius: 5,
                  }}
                />
              </View>
              <Text style={[styles.label, { marginBottom: 0 }]}>
                p. {r.page + 1}
              </Text>
              <Text
                style={{
                  color: selected === r.page ? color.green : "transparent",
                  fontSize: 12,
                }}
              >
                ●
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Text style={styles.muted}>
        Tap a page · Rust marks longer dwell
        {rows.length > 5 ? " · Swipe for more" : ""}
      </Text>
    </View>
  );
}
