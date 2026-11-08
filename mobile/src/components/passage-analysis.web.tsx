import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { storeEbook } from "../lib/ebook.web";
import { useJournal } from "../lib/journal";
import { api } from "../lib/api";
import { Button, Chips, styles, message } from "./ui";
import type { PassageReport } from "../../../shared/reader";
export default function PassageAnalysis({
  bookId,
  page,
  sessionId,
}: {
  bookId: string;
  page: number;
  sessionId: string;
}) {
  const { user } = useJournal();
  const [text, setText] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [consent, setConsent] = useState(false),
    [report, setReport] = useState<PassageReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (user)
      void storeEbook(user.uid, bookId)
        .then((e) => {
          if (active) setText(e?.pages[page]?.text ?? null);
        })
        .catch(() => {
          if (active)
            setError("Could not open the ebook stored on this device.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [user, bookId, page]);
  async function analyze() {
    if (!text || !consent) return;
    setBusy(true);
    setError("");
    try {
      setReport(
        await api<PassageReport>(`/v1/reader/books/${bookId}/analyze`, "POST", {
          page,
          text,
          sessionId,
          consent: true,
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Inside page {page + 1}</Text>
      {loading ? (
        <Text style={styles.muted}>Opening this passage…</Text>
      ) : text ? (
        <>
          <Text style={styles.body}>{text}</Text>
          <Text style={styles.muted}>
            Analyze vocabulary, sentences, abstraction, information density,
            literary structure and pacing in this passage. Timing can suggest
            questions; it cannot establish why you slowed down or what you
            understood.
          </Text>
          <Chips
            values={["Allow analysis of this passage"]}
            value={consent ? "Allow analysis of this passage" : ""}
            onChange={() => setConsent(!consent)}
          />
          <Text style={styles.muted}>
            This sends this passage and its reading measurements to Thinking
            Machines. Your other book text and private notes are not included.
          </Text>
          <Button
            title="Analyze this passage"
            busy={busy}
            disabled={!consent}
            onPress={() => void analyze()}
          />
        </>
      ) : (
        <>
          <Text style={styles.body}>
            The ebook file is stored on the device where you imported it. Open
            the reader and import the same edition here to view and analyze this
            passage.
          </Text>
          <Button
            title="Open reader"
            secondary
            onPress={() =>
              router.push({ pathname: "/reader/[id]", params: { id: bookId } })
            }
          />
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {report && (
        <>
          <Text style={styles.label}>POSSIBLE EXPLANATIONS · AI ANALYSIS</Text>
          {report.result.observations.map((o) => (
            <View key={o.dimension} style={{ gap: 4 }}>
              <Text style={styles.label}>{o.dimension}</Text>
              <Text style={styles.body}>{o.explanation}</Text>
              {!!o.quote && <Text style={styles.quote}>“{o.quote}”</Text>}
            </View>
          ))}
          {report.result.possibleReasons.map((s, i) => (
            <Text key={`reason${i}`} style={styles.body}>
              {s}
            </Text>
          ))}
          {report.result.interestSignals.map((s, i) => (
            <Text key={`interest${i}`} style={styles.body}>
              {s}
            </Text>
          ))}
          <Text style={styles.heading}>Try next</Text>
          <Text style={styles.body}>{report.result.nextStep}</Text>
          <Text style={styles.muted}>{report.result.uncertainty}</Text>
        </>
      )}
    </View>
  );
}
