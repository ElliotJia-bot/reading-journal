import React from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useJournal } from "../../../lib/journal";
import { Page, Button, styles } from "../../../components/ui";
import { DetailFold, StatBlocks } from "../../../components/insight-blocks";
import PaceInsights from "../../../components/pace-insights";
import { finishEstimate, pagesRead } from "../../../../../shared/metrics";
import { durationLabel } from "../../../../../shared/reading-insights";
export default function SessionInsights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, books, sessions } = useJournal();
  const session = sessions.find((s) => s.id === id),
    book = books.find((b) => b.id === session?.bookId);
  if (!session || !book)
    return (
      <Page title="Session unavailable" back>
        <Text style={styles.body}>This session may have been removed.</Text>
      </Page>
    );
  const pages = pagesRead(session),
    estimate = finishEstimate(
      book,
      sessions.filter((s) => s.bookId === book.id),
    );
  return (
    <Page title="This reading moment" back>
      <View style={{ gap: 5 }}>
        <Text style={styles.heading}>{book.title}</Text>
        <Text style={styles.muted}>
          {new Date(session.startedAt).toLocaleString()}
        </Text>
      </View>
      <StatBlocks
        items={[
          {
            label: "Reading time",
            value: durationLabel(session.durationSeconds),
          },
          {
            label: pages === null ? "Progress" : "Pages read",
            value:
              pages === null
                ? `${session.startPosition}% → ${session.endPosition}%`
                : pages,
            detail:
              pages === null
                ? undefined
                : `p. ${session.startPosition} → ${session.endPosition}`,
          },
          { label: "Place", value: session.location || "Not recorded" },
          { label: "How it felt", value: session.reaction || "Not recorded" },
        ]}
      />
      <PaceInsights
        key={`${user?.uid}:${id}`}
        book={book}
        sessions={[session]}
        sessionId={id}
      />
      {(session.note || estimate) && (
        <DetailFold title="Reflection & next chapter">
          {!!session.note && <Text style={styles.quote}>{session.note}</Text>}
          {estimate && (
            <Text style={styles.muted}>
              About {estimate.minutes} min left · based on {estimate.sample}{" "}
              sessions.
            </Text>
          )}
        </DetailFold>
      )}
      <Button
        title="Edit this reading log"
        secondary
        onPress={() =>
          router.push({ pathname: "/finish", params: { editId: id } })
        }
      />
      <Button
        title="View book Insights"
        onPress={() =>
          router.push({
            pathname: "/insights/book/[id]",
            params: { id: book.id },
          })
        }
      />
    </Page>
  );
}
