import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { aggregate, dayKey } from "../../../shared/domain";
import { singleFlight } from "../../../shared/single-flight";
import { useJournal, type InsightReport } from "../lib/journal";
import { api } from "../lib/api";
import { Button, color, styles, message } from "./ui";
import { DetailFold, SmallBlock } from "./insight-blocks";

const loadReport = singleFlight<InsightReport>();
export default function ReadingCoach({ now }: { now: number }) {
  const { user, books, sessions, profile } = useJournal();
  const stats = aggregate(sessions, books, 30, profile.timezone, now);
  // Stable across refreshes; changed accounts, records, goals or calendar
  // windows remount the report, preventing stale suggestions from appearing.
  const requestKey = JSON.stringify({
    uid: user?.uid,
    goal: profile.goal,
    day: dayKey(now, profile.timezone),
    stats,
  });
  return (
    <CoachReport
      key={requestKey}
      requestKey={requestKey}
      timezone={profile.timezone}
      hasRecords={!!user && stats.sessionCount > 0}
    />
  );
}
function CoachReport({
  requestKey,
  timezone,
  hasRecords,
}: {
  requestKey: string;
  timezone: string;
  hasRecords: boolean;
}) {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [rating, setRating] = useState(false);
  useEffect(() => {
    if (!hasRecords) return;
    let active = true;
    void loadReport(requestKey, () =>
      api<InsightReport>("/v1/insights", "POST", { days: 30, timezone }),
    )
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [requestKey, timezone, hasRecords, attempt]);
  async function rate(value: string) {
    if (!report || rating) return;
    setRating(true);
    setFeedbackError("");
    try {
      await api(`/v1/insights/${report.id}/feedback`, "PUT", {
        value,
        reason: "",
      });
      setFeedback("Thanks. Your feedback is saved.");
    } catch (e) {
      setFeedbackError(message(e));
    } finally {
      setRating(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 5 }}>
        <Text style={styles.heading}>Behavioral suggestions</Text>
        <Text style={styles.muted}>Based on your recent 30 days</Text>
      </View>
      {!hasRecords ? (
        <SmallBlock
          title="A small start is enough"
          body="Log a reading session to discover suggestions for your next one."
        />
      ) : error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button
            title="Retry suggestions"
            secondary
            onPress={() => {
              setError("");
              setAttempt((a) => a + 1);
            }}
          />
        </>
      ) : !report ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.card, styles.row]}
        >
          <ActivityIndicator color={color.green} />
          <Text style={[styles.muted, { flex: 1 }]}>
            Finding a few small steps for you…
          </Text>
        </View>
      ) : (
        <>
          {report.cards.slice(0, 3).map((card) => (
            <SmallBlock
              key={card.kind}
              title={card.title}
              body={card.body}
              evidence={`Based on ${card.evidenceIds.map((id) => ({ summary: "session totals", locations: "location records", topics: "topic records", times: "reading times" })[id] ?? id).join(", ")}.`}
            />
          ))}
          <Text style={styles.label}>Was this helpful?</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                title="Helpful"
                secondary
                disabled={rating}
                onPress={() => void rate("helpful")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Not for me"
                secondary
                disabled={rating}
                onPress={() => void rate("not-for-me")}
              />
            </View>
          </View>
          {!!feedback && <Text style={styles.muted}>{feedback}</Text>}
          {!!feedbackError && <Text style={styles.error}>{feedbackError}</Text>}
        </>
      )}
      <DetailFold title="About these suggestions">
        <Text style={styles.muted}>
          Thinking Machines uses your reading statistics, topic labels and
          reading goal. Your email and private notes are not sent. Suggestions
          are experiments to try, not proven causes.
        </Text>
        {report && (
          <Text style={styles.muted}>
            Updated {new Date(report.generatedAt).toLocaleString()} · 30-day
            view. Unchanged evidence reuses saved analysis.
          </Text>
        )}
      </DetailFold>
    </View>
  );
}
