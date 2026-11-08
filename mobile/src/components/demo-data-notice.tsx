import React from "react";
import { Text } from "react-native";
import { useJournal } from "../lib/journal";
import { styles } from "./ui";
export default function DemoDataNotice() {
  const { sessions, books } = useJournal();
  const demo =
    sessions.some((s) => s.demoData?.synthetic) ||
    books.some((b) => b.demoData?.synthetic);
  return demo ? (
    <Text
      style={[
        styles.muted,
        { backgroundColor: "#f2ede8", padding: 10, borderRadius: 8 },
      ]}
    >
      Demo data included · Reading history contains fictional records.
    </Text>
  ) : null;
}
