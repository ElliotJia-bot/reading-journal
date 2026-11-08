import React, { useState } from "react";
import { Text, View } from "react-native";
import { useJournal, type InsightReport } from "../lib/journal";
import { api } from "../lib/api";
import { Button, styles, message } from "./ui";
import { DetailFold, SmallBlock } from "./insight-blocks";
export default function ReadingCoach({
  days,
  sessionCount,
}: {
  days: number;
  sessionCount: number;
}) {
  const { profile, insight, setInsight } = useJournal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      setInsight(
        await api<InsightReport>("/v1/insights", "POST", {
          days,
          timezone: profile.timezone,
        }),
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function rate(value: string) {
    setError("");
    try {
      await api(`/v1/insights/${insight!.id}/feedback`, "PUT", {
        value,
        reason: "",
      });
      setFeedback("Thanks. Your feedback is saved.");
    } catch (error) {
      setError(message(error));
    }
  }
  return (
    <View style={{ gap: 22 }}>
      <View style={styles.card}>
        <Text style={styles.heading}>Your personal reading insights</Text>
        <Text style={styles.muted}>
          This sends reading statistics, topic labels, and your reading goal to
          Thinking Machines. Your email and private notes stay out of the
          request.
        </Text>
        <Button
          title={busy ? "Reflecting on your reading…" : "Generate My Insights"}
          busy={busy}
          disabled={!sessionCount}
          onPress={() => void generate()}
        />
        {!sessionCount && (
          <Text style={styles.muted}>
            Log a reading session in this period to get started.
          </Text>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {insight && insight.period !== days && (
        <Text style={styles.muted}>
          Generate insights for this period to see matching suggestions.
        </Text>
      )}
      {insight && insight.period === days && (
        <>
          {insight.cards.map((card) => (
            <SmallBlock
              key={card.kind}
              label={card.kind.toUpperCase()}
              title={card.title}
              body={card.body}
              evidence={`Based on ${card.evidenceIds.map((id) => ({ summary: "session totals", locations: "location records", topics: "topic records", times: "reading times" })[id] ?? id).join(", ")}.`}
            />
          ))}
          <DetailFold title="About these insights">
            <Text style={styles.muted}>
              Generated {new Date(insight.generatedAt).toLocaleString()} ·{" "}
              {insight.period ? `${insight.period}-day view` : "All time"}.
              Refresh after changing records.
            </Text>
          </DetailFold>
          <Text style={styles.label}>Was this helpful?</Text>
          <Button
            title="Helpful"
            secondary
            onPress={() => void rate("helpful")}
          />
          <Button
            title="Not for me"
            secondary
            onPress={() => void rate("not-for-me")}
          />
          {!!feedback && <Text style={styles.body}>{feedback}</Text>}
        </>
      )}
    </View>
  );
}
