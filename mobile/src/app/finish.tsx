import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { api } from "../lib/api";
import { editedTiming } from "../../../shared/metrics";
import { clearLoggedReader } from "../lib/reader-draft";
import { useJournal, timerSeconds } from "../lib/journal";
import { Page, Button, Field, Chips, styles, message } from "../components/ui";
type FinishParams = {
  bookId?: string;
  manual?: string;
  editId?: string;
  readerSession?: string;
};
export default function Finish() {
  const params = useLocalSearchParams<FinishParams>();
  const { loading } = useJournal();
  if (loading) return <Page title="Opening your reading log…" />;
  return (
    <FinishForm
      params={params}
      key={`${params.bookId ?? ""}:${params.manual ?? ""}:${params.editId ?? ""}:${params.readerSession ?? ""}`}
    />
  );
}
function FinishForm({ params }: { params: FinishParams }) {
  const { user, timer, books, sessions, saveSession, saveBook } = useJournal();
  const [editing] = useState(() =>
    sessions.find((session) => session.id === params.editId),
  );
  const [active] = useState(() =>
    !params.manual && !params.editId ? timer : null,
  );
  const book = books.find(
    (book) => book.id === (editing?.bookId ?? params.bookId ?? active?.bookId),
  );
  const [id] = useState(() => editing?.id ?? active?.id ?? randomUUID());
  const exactDuration =
    editing?.durationSeconds ?? (active ? timerSeconds(active) : 1200);
  const [duration, setDuration] = useState((exactDuration / 60).toFixed(1));
  const [initialDate] = useState(
    () => new Date(editing?.startedAt ?? Date.now() - 20 * 60 * 1000),
  );
  const localDate = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")} ${String(initialDate.getHours()).padStart(2, "0")}:${String(initialDate.getMinutes()).padStart(2, "0")}`;
  const [date, setDate] = useState(localDate);
  const [position, setPosition] = useState(
    String(
      editing?.endPosition ??
        active?.bookmark?.currentPage ??
        active?.reader?.endPosition ??
        book?.position ??
        0,
    ),
  );
  const [startPosition, setStartPosition] = useState(
    String(editing?.startPosition ?? active?.startPosition ?? 0),
  );
  const [location, setLocation] = useState(
    editing?.location ?? active?.reader?.location ?? "",
  );
  const [reaction, setReaction] = useState(
    editing?.reaction ?? active?.reader?.reaction ?? "",
  );
  const [stopReason, setStopReason] = useState(editing?.stopReason ?? "");
  const [topics, setTopics] = useState(editing?.topics.join(", ") ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [expanded, setExpanded] = useState(Boolean(editing));
  const [finishBook, setFinishBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  if (saved)
    return (
      <Page title="A little progress, saved.">
        <Text style={styles.body}>
          Your session is in your reading history. Your statistics have been
          updated.
        </Text>
        <Button
          title="View session Insights"
          onPress={() =>
            router.replace({
              pathname: "/insights/session/[id]",
              params: { id },
            })
          }
        />
        <View style={styles.card}>
          <Text style={styles.heading}>Share a little progress</Text>
          <Text style={styles.body}>
            Celebrate a small step with your reading circle. Sharing is
            optional.
          </Text>
          <Button
            title="Share with a circle"
            onPress={() =>
              router.push({
                pathname: "/community/compose",
                params: { sessionId: id },
              })
            }
          />
        </View>
        <Button
          title="Keep it private · Back to Library"
          secondary
          onPress={() => router.replace("/(tabs)/library")}
        />
      </Page>
    );
  if (params.readerSession && active?.id !== params.readerSession)
    return (
      <Page
        title={
          sessions.some((s) => s.id === params.readerSession)
            ? "This session is already saved"
            : "No pending reading log"
        }
      >
        <Button
          title="Go to Library"
          onPress={() => router.replace("/(tabs)/library")}
        />
      </Page>
    );
  if (!book)
    return (
      <Page title="Choose a book first" back>
        <Button
          title="Go to Library"
          onPress={() => router.replace("/(tabs)/library")}
        />
      </Page>
    );
  async function save() {
    setBusy(true);
    setError("");
    try {
      const edited = editedTiming(
        editing,
        duration,
        date,
        (exactDuration / 60).toFixed(1),
        localDate,
      );
      const seconds = active ? exactDuration : edited.durationSeconds;
      const startedAt = active?.startedAt ?? edited.startedAt;
      const endedAt = active?.endedAt ?? edited.endedAt;
      if (
        !Number.isFinite(startedAt) ||
        !Number.isFinite(seconds) ||
        seconds < 1 ||
        !Number.isInteger(Number(position)) ||
        !Number.isInteger(Number(startPosition))
      )
        throw new Error("Check the date, duration, and ending position.");
      if (active?.reader) {
        for (const { id: visitId, ...visit } of active.reader.pendingVisits) {
          await api(
            `/v1/reader/books/${book!.id}/visits/${visitId}`,
            "PUT",
            visit,
          );
        }
      }
      await saveSession(id, {
        bookId: book!.id,
        startedAt,
        endedAt,
        durationSeconds: seconds,
        startPosition: active?.startPosition ?? Number(startPosition),
        endPosition: Number(position),
        unit: book!.unit,
        location,
        reaction,
        stopReason,
        topics: topics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        note,
        source: editing?.source ?? (active?.bookmark ? "bookmark" : active?.reader ? "reader" : "manual"),
      });
      if (active?.reader && user)
        clearLoggedReader(user.uid, book!.id, id, Number(position));
      if (finishBook)
        await saveBook(book!.id, {
          title: book!.title,
          author: book!.author,
          cover: book!.cover,
          isbn: book!.isbn,
          totalPages: book!.totalPages,
          unit: book!.unit,
          baselinePosition: book!.baselinePosition,
          topics: book!.topics,
          reader: book!.reader,
          status: "Finished",
        });
      setSaved(true);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={editing ? "Edit session" : "Finish and log"}
      back
      onBack={
        active?.reader ? () => router.replace("/(tabs)/library") : undefined
      }
    >
      <View style={styles.card}>
        <Text style={styles.heading}>{book.title}</Text>
        {active ? (
          <>
            <Text style={[styles.title, { fontSize: 40 }]}>
              {Math.floor(exactDuration / 60)} min {exactDuration % 60} sec
            </Text>
            <Text style={styles.muted}>
              {active.bookmark
                ? "Smart bookmark · pauses excluded"
                : active.reader
                ? "Automatically tracked · pauses and time away excluded"
                : "Reading time, excluding pauses"}
            </Text>
            {(active.reader || active.bookmark) && (
              <Text style={styles.body}>
                Pages {active.startPosition} → {position} ·{" "}
                {Math.max(0, Number(position) - active.startPosition)} pages of
                progress
              </Text>
            )}
          </>
        ) : (
          <>
            <Field
              editable={editing?.source !== "bookmark"}
              label="Start date and time"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD HH:mm"
            />
            <Field
              editable={editing?.source !== "bookmark"}
              label="Duration in minutes"
              value={duration}
              onChangeText={setDuration}
              keyboardType="decimal-pad"
            />
          </>
        )}
      </View>
      {!active && (
        <Field
          editable={editing?.source !== "bookmark"}
          label={`Starting ${book.unit === "pages" ? "page" : "percentage"}`}
          value={startPosition}
          onChangeText={setStartPosition}
          keyboardType="number-pad"
        />
      )}
      <Field
        label={`Ending ${book.unit === "pages" ? "page" : "percentage"}`}
        value={position}
        editable={!active?.bookmark && editing?.source !== "bookmark"}
        onChangeText={setPosition}
        keyboardType="number-pad"
      />
      {book.status !== "Finished" && (
        <Chips
          values={["I finished this book"]}
          value={finishBook ? "I finished this book" : ""}
          onChange={() => setFinishBook(!finishBook)}
        />
      )}
      <Text style={styles.label}>Where did you read? (optional)</Text>
      <Chips
        values={["Home", "Library", "Café", "In Transit", "Other"]}
        value={location}
        onChange={(value) => setLocation(value === location ? "" : value)}
      />
      <Button
        title={expanded ? "Hide reflection" : "Add a reflection"}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <View style={styles.card}>
          <Text style={styles.label}>How did it feel?</Text>
          <Chips
            values={["Liked it", "Challenging", "Relaxing", "Want to reread"]}
            value={reaction}
            onChange={(value) => setReaction(value === reaction ? "" : value)}
          />
          <Text style={styles.label}>What made you stop?</Text>
          <Chips
            values={[
              "Time was up",
              "Tired",
              "Distracted",
              "Lost interest",
              "Finished chapter",
            ]}
            value={stopReason}
            onChange={(value) =>
              setStopReason(value === stopReason ? "" : value)
            }
          />
          <Field
            label="Topics covered (optional)"
            value={topics}
            onChangeText={setTopics}
          />
          <Field
            label="A thought to keep"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
          />
        </View>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save Session" busy={busy} onPress={() => void save()} />
      {active?.reader && (
        <Button
          title="Save later · Back to Library"
          secondary
          disabled={busy}
          onPress={() => router.replace("/(tabs)/library")}
        />
      )}
    </Page>
  );
}
