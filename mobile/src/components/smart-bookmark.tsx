import React, { useState } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "../lib/api";
import { bookmarkTimer, timerSeconds, useJournal, type Book, type Timer } from "../lib/journal";
import { bookmarkConnected, type BookmarkState } from "../../../shared/bookmark";
import { Button, Field, color, message, styles } from "./ui";
import { DetailFold, StatBlocks } from "./insight-blocks";
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export default function SmartBookmark({ timer, book }: { timer: Timer; book: Book }) {
  const { updateTimer } = useJournal();
  const [starting, setStarting] = useState(String(Math.max(1, timer.startPosition)));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = timer.bookmark, connected = state ? bookmarkConnected(state) : false;
  const started = state && state.status !== "waiting";
  const seconds = state ? timerSeconds(timer) : 0;
  const pages = state ? Math.max(0, state.currentPage - state.startPage) : 0;
  async function pair() {
    setBusy(true); setError("");
    try {
      const result = await api<{ code: string; state: BookmarkState }>("/v1/bookmark/pair", "POST", { bookId: book.id, sessionId: timer.id, startPage: Number(starting) });
      await updateTimer(bookmarkTimer(result.state)); setCode(result.code);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError("");
    try {
      const result = await api<BookmarkState>(`/v1/bookmark/sessions/${timer.id}/stop`, "POST", {});
      if (!result.activeSeconds) { setCode(""); await updateTimer(null); }
      else await updateTimer(bookmarkTimer(result));
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  if (book.unit !== "pages" || book.reader) return null;
  return (
    <View style={[styles.card, { gap: 16 }]}>
      <View style={styles.between}>
        <View style={[styles.row, { flex: 1 }]}>
          <Feather name="bookmark" size={23} color={color.green} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.heading}>Smart bookmark</Text>
            <Text style={styles.muted}>USB serial · Raspberry Pi Pico W</Text>
          </View>
        </View>
        <Text style={[styles.label, { color: state?.status === "ended" || connected ? color.green : color.muted }]}>
          {state?.status === "ended" ? "Ended" : connected ? state?.status === "paused" ? "Paused" : "Connected" : state?.status === "waiting" ? "Waiting" : "Disconnected"}
        </Text>
      </View>
      {(!state || state.status === "waiting") && (
        <>
          <Field label="Starting page" value={starting} onChangeText={setStarting} keyboardType="number-pad" />
          <Button title={state ? "Generate a new pairing code" : "Connect Smart Bookmark"} busy={busy} disabled={!Number.isInteger(Number(starting)) || Number(starting) < 1} onPress={() => void pair()} />
          {!state && <Text style={styles.muted}>Bookmark tracking starts a fresh timer for this reading. Keep your computer connected to the bookmark.</Text>}
          {!!code && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>PAIRING CODE · VALID FOR 10 MINUTES</Text>
              <Text selectable style={styles.body}>{code}</Text>
              <Text style={styles.muted}>Enter this code in the computer’s bookmark bridge, then start V2. Close Thonny first so the bridge can use USB.</Text>
            </View>
          )}
          {state && <Button title="Cancel connection" secondary busy={busy} onPress={() => void recover()} />}
        </>
      )}
      <StatBlocks items={[
        { label: "Current page", value: started ? state.currentPage : "—" },
        { label: "Pages read", value: started ? pages : 0 },
        { label: "Reading duration", value: clock(seconds) },
        { label: "Average / page", value: state?.completedVisits ? `${Math.round(state.completedSeconds / state.completedVisits)}s` : "—" },
        { label: "Reading pace", value: started && seconds > 0 ? `${(pages / (seconds / 60)).toFixed(1)} p/min` : "—" },
        { label: "Starting page", value: state?.startPage ?? (starting || "—") },
      ]} />
      {state && state.status !== "ended" && <Text style={styles.body}>Click: next · Double-click: back{"\n"}Hold 1.5s: pause / resume · Triple-click: finish</Text>}
      {!!state?.notice && <Text style={styles.muted}>{state.notice}</Text>}
      {started && !connected && state.status !== "ended" && (
        <View style={{ gap: 10 }}>
          <Text style={styles.muted}>The bridge is not responding. Reconnect to sync queued events. If you cannot reconnect, you can finish using only the received data; later events will not be added.</Text>
          <Button title="Finish with received data" secondary busy={busy} onPress={() => void recover()} />
        </View>
      )}
      {state?.status === "ended" && state.activeSeconds < 1 && <Button title="Close empty session" secondary busy={busy} onPress={() => void recover()} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <DetailFold title="About this reading data">
        <Text style={styles.muted}>Pages read and pace use net forward progress. Average / page uses completed visits, including rereads. Timing comes from button events, excluding pauses; it does not measure attention or comprehension. The display clock runs between events while USB is connected.</Text>
        <Text style={styles.muted}>V2 starts at device page 1; Starting page maps it to your book. Its back-navigation limit is the first page of this tracked reading.</Text>
        {state && <Text style={styles.body}>{state.forwardTurns} forward · {state.backwardTurns} back · {state.visitedPages.length} completed pages · {Math.max(0, state.completedVisits - state.visitedPages.length)} revisits</Text>}
      </DetailFold>
    </View>
  );
}
