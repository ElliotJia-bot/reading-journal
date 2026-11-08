import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { storeEbook } from "../lib/ebook.web";
import { useJournal } from "../lib/journal";
import { api } from "../lib/api";
import { Button, Chips, styles, message } from "./ui";
import { DetailFold, SmallBlock } from "./insight-blocks";
import { passageClue } from "../../../shared/reading-insights";
import type { PassageReport } from "../../../shared/reader";
export default function PassageAnalysis({
  bookId,
  page,
  sessionId,
  sessionIds,
  reactions = [],
  compact = false,
  rhythm,
}: {
  bookId: string;
  page: number;
  sessionId?: string;
  sessionIds?: string[];
  reactions?: string[];
  compact?: boolean;
  rhythm?: "quicker" | "longer";
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
          if (active) setError("Could not open the ebook on this device.");
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
          ...(sessionId ? { sessionId } : { sessionIds }),
          consent: true,
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const clue = passageClue(text ?? "", reactions, rhythm);
  if (compact)
    return (
      <View style={{ gap: 10 }}>
        {loading ? (
          <Text style={styles.muted}>Opening passage clues…</Text>
        ) : (
          <>
            <Text style={styles.body}>
              {report
                ? report.result.possibleReasons[0] || "No clear cause yet."
                : clue.body}
            </Text>
            <DetailFold title={`Explore page ${page + 1}`}>
              <Text style={styles.muted}>
                Try next: {report?.result.nextStep || clue.next}
              </Text>
              <Text style={styles.label}>
                {report ? "POSSIBLE WHY · AI" : clue.title.toUpperCase()}
              </Text>
              <Text style={styles.muted}>
                {report?.result.uncertainty || clue.evidence}
              </Text>
              {report?.result.observations.slice(0, 2).map((o, i) => (
                <Text key={i} style={styles.body}>
                  {o.explanation}
                </Text>
              ))}
              {text ? (
                <>
                  <Text style={styles.quote}>{text}</Text>
                  {!report && (
                    <>
                      <Text style={styles.muted}>
                        Allow Thinking Machines to analyze this passage and its
                        reading measurements for possible explanations.
                      </Text>
                      <Chips
                        values={["Allow passage analysis"]}
                        value={consent ? "Allow passage analysis" : ""}
                        onChange={() => setConsent(!consent)}
                      />
                      <Button
                        title="Analyze this passage"
                        busy={busy}
                        disabled={!consent}
                        onPress={() => void analyze()}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.muted}>
                    Import the same ebook on this device to explore its content.
                  </Text>
                  <Button
                    title="Open reader"
                    secondary
                    onPress={() =>
                      router.push({
                        pathname: "/reader/[id]",
                        params: { id: bookId },
                      })
                    }
                  />
                </>
              )}
            </DetailFold>
          </>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {loading ? (
        <Text style={styles.muted}>Opening passage clues…</Text>
      ) : (
        <>
          {report ? (
            <>
              <SmallBlock
                label="POSSIBLE WHY · AI"
                title={report.result.possibleReasons[0] || "No clear cause yet"}
              />
              <SmallBlock
                label="TRY NEXT"
                title="One small step"
                body={report.result.nextStep}
              />
              <DetailFold title="More content insights">
                {report.result.possibleReasons.slice(1).map((reason, i) => (
                  <Text key={i} style={styles.body}>
                    {reason}
                  </Text>
                ))}
                {report.result.observations.map((o) => (
                  <SmallBlock
                    key={o.dimension}
                    label={o.dimension.toUpperCase()}
                    title={o.explanation}
                    body={o.quote ? `“${o.quote}”` : undefined}
                  />
                ))}
                {report.result.interestSignals.map((s, i) => (
                  <Text key={i} style={styles.body}>
                    {s}
                  </Text>
                ))}
                <Text style={styles.muted}>{report.result.uncertainty}</Text>
              </DetailFold>
            </>
          ) : (
            <SmallBlock
              label="POSSIBLE WHY"
              title={clue.title}
              body={clue.body}
              evidence={clue.evidence}
            />
          )}
          {text ? (
            <>
              <DetailFold title={`Read passage · page ${page + 1}`}>
                <Text style={styles.quote}>{text}</Text>
              </DetailFold>
              {!report && (
                <DetailFold title="Explore the text with AI">
                  <Text style={styles.muted}>
                    Send this passage and its reading measurements to Thinking
                    Machines for possible explanations.
                  </Text>
                  <Chips
                    values={["Allow passage analysis"]}
                    value={consent ? "Allow passage analysis" : ""}
                    onChange={() => setConsent(!consent)}
                  />
                  <Button
                    title="Analyze this passage"
                    busy={busy}
                    disabled={!consent}
                    onPress={() => void analyze()}
                  />
                </DetailFold>
              )}
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.muted}>
                Content clues need the ebook on this device. Import the same
                edition to explore this page.
              </Text>
              <Button
                title="Open reader"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/reader/[id]",
                    params: { id: bookId },
                  })
                }
              />
            </View>
          )}
          <Text style={styles.muted}>
            Possible explanations, not a confirmed cause.
          </Text>
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
