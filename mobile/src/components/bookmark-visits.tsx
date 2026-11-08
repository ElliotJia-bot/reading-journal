import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { BookmarkVisit } from "../../../shared/bookmark";
import { api } from "../lib/api";
import { Button, color, message, styles } from "./ui";
import { DetailFold } from "./insight-blocks";
export default function BookmarkVisits({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<{ visits: BookmarkVisit[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void api<{ visits: BookmarkVisit[]; total: number }>(`/v1/bookmark/sessions/${sessionId}/visits`)
      .then(v => { if (active) { setData(v); setError(""); } })
      .catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [sessionId, attempt]);
  const rows = data?.visits.slice(-24) ?? [], max = Math.max(1, ...rows.map(v => v.activeSeconds));
  return <View style={styles.card}>
    <Text style={styles.heading}>Bookmark page visits</Text>
    {!!error && <><Text style={styles.error}>{error}</Text><Button title="Retry page visits" secondary onPress={() => setAttempt(n => n + 1)} /></>}
    {!data && !error && <Text style={styles.muted}>Loading recorded visits…</Text>}
    {data && <>
      <Text style={styles.muted}>{data.total} completed visits · each bar is one visit, including rereads</Text>
      <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
        {rows.map(v => <View key={v.sequence} accessibilityLabel={`Page ${v.page}, visit ${v.visitNumber}, ${v.activeSeconds} seconds`} style={{ width: 44, gap: 5, alignItems: "center" }}>
          <Text style={[styles.muted, { fontSize: 10 }]}>{v.activeSeconds}s</Text>
          <View style={{ height: 100, justifyContent: "flex-end" }}><View style={{ width: 22, height: Math.max(2, v.activeSeconds / max * 100), borderRadius: 3, backgroundColor: v.visitNumber > 1 ? color.coral : color.green }} /></View>
          <Text style={styles.muted}>p. {v.page}</Text>
        </View>)}
      </ScrollView>
      {data.total > 24 && <Text style={styles.muted}>Showing the latest 24 visits.</Text>}
      <DetailFold title="How bookmark timing works">
        <Text style={styles.muted}>The button records time between page changes, excluding pauses. Revisited pages keep separate visits. V2’s duplicate final-page interval is corrected against its session total; the original event is retained. These records measure page dwell, not comprehension.</Text>
      </DetailFold>
    </>}
  </View>;
}
