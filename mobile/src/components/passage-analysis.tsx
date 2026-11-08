import React from "react";
import { Text } from "react-native";
import { styles } from "./ui";
export default function PassageAnalysis(_props: {
  bookId: string;
  page: number;
  sessionId?: string;
  sessionIds?: string[];
  reactions?: string[];
  compact?: boolean;
  rhythm?: "quicker" | "longer";
}) {
  return (
    <Text style={styles.body}>
      Open the web reader on the device with your ebook to analyze this passage.
    </Text>
  );
}
