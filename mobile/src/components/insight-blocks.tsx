import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { color, styles } from "./ui";
import { surfaceColors } from "../lib/theme";
export function StatBlocks({
  items,
}: {
  items: { label: string; value: string | number; detail?: string }[];
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            styles.card,
            { flexGrow: 1, flexBasis: "44%", padding: 16, gap: 5, backgroundColor: surfaceColors[index % surfaceColors.length] },
          ]}
        >
          <Text style={styles.muted}>{item.label}</Text>
          <Text style={[styles.heading, { fontSize: 25 }]}>{item.value}</Text>
          {!!item.detail && <Text style={styles.muted}>{item.detail}</Text>}
        </View>
      ))}
    </View>
  );
}
export function DetailFold({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text style={[styles.body, { color: color.green }]}>
          {open ? "−" : "+"} {title}
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}
export function SmallBlock({
  label,
  title,
  body,
  evidence,
}: {
  label?: string;
  title: string;
  body?: string;
  evidence?: string;
}) {
  return (
    <View style={[styles.card, styles.cardGreen, { padding: 16, gap: 7 }]}>
      {label && (
        <Text style={[styles.label, { marginBottom: 0 }]}>{label}</Text>
      )}
      <Text style={styles.heading}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      {evidence && (
        <DetailFold title="View evidence">
          <Text style={styles.muted}>{evidence}</Text>
        </DetailFold>
      )}
    </View>
  );
}
