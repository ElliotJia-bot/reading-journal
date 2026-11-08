import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { AppState, Platform } from "react-native";
import { auth } from "./firebase";
import { api } from "./api";
import type { ReaderDraft } from "../../../shared/reader-session";
import {
  elapsedSeconds,
  type Book,
  type ReadingSession,
  type Profile,
  type InsightReport,
} from "../../../shared/domain";

export type { Book, ReadingSession, InsightReport };
export interface Timer {
  id: string;
  bookId: string;
  startedAt: number;
  startPosition: number;
  accumulatedSeconds: number;
  runningSince: number | null;
  endedAt: number | null;
  reader?: ReaderDraft;
}
interface JournalData {
  books: Book[];
  sessions: ReadingSession[];
  profile: Profile;
  insight: InsightReport | null;
}
const empty: JournalData = {
  books: [],
  sessions: [],
  profile: {
    goal: "Build a reading habit",
    topics: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  insight: null,
};
interface JournalContext extends JournalData {
  user: User | null;
  loading: boolean;
  timer: Timer | null;
  error: string;
  refresh: () => Promise<void>;
  start: (book: Book) => Promise<void>;
  updateTimer: (timer: Timer | null) => Promise<void>;
  saveBook: (id: string, input: unknown) => Promise<void>;
  saveSession: (id: string, input: unknown) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setInsight: (report: InsightReport) => void;
}
const Context = createContext<JournalContext | null>(null);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(empty);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [error, setError] = useState("");
  const uid = useRef<string | null>(null);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const owner = auth.currentUser?.uid;
    if (!owner) return;
    const sequence = ++refreshSequence.current;
    try {
      const next = await api<JournalData>("/v1/data");
      if (uid.current !== owner || sequence !== refreshSequence.current) return;
      setData(next);
      setError("");
      await AsyncStorage.setItem(`journal:${owner}`, JSON.stringify(next));
    } catch (error) {
      if (uid.current === owner && sequence === refreshSequence.current)
        setError(error instanceof Error ? error.message : "Unable to sync.");
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    if (Platform.OS === "web") {
      const onReturn = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      window.addEventListener("focus", onReturn);
      window.addEventListener("online", onReturn);
      document.addEventListener("visibilitychange", onReturn);
      return () => {
        window.removeEventListener("focus", onReturn);
        window.removeEventListener("online", onReturn);
        document.removeEventListener("visibilitychange", onReturn);
      };
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [user, refresh]);
  useEffect(
    () =>
      onAuthStateChanged(auth, async (next) => {
        setLoading(true);
        uid.current = next?.uid ?? null;
        setUser(next);
        setData(empty);
        setTimer(null);
        setError("");
        if (next) {
          try {
            const [cached, active] = await Promise.all([
              AsyncStorage.getItem(`journal:${next.uid}`),
              AsyncStorage.getItem(`timer:${next.uid}`),
            ]);
            if (uid.current === next.uid) {
              if (cached) setData(JSON.parse(cached));
              if (active) setTimer(JSON.parse(active));
            }
            await refresh();
          } catch {
            setError("Unable to restore local records. Please refresh.");
          }
        }
        setLoading(false);
      }),
    [refresh],
  );
  async function updateTimer(next: Timer | null) {
    if (!user) return;
    if (next)
      await AsyncStorage.setItem(`timer:${user.uid}`, JSON.stringify(next));
    else await AsyncStorage.removeItem(`timer:${user.uid}`);
    setTimer(next);
  }
  async function start(book: Book) {
    if (timer) throw new Error("Finish your current reading session first.");
    const now = Date.now();
    await updateTimer({
      id: randomUUID(),
      bookId: book.id,
      startedAt: now,
      startPosition: book.position,
      accumulatedSeconds: 0,
      runningSince: now,
      endedAt: null,
    });
  }
  async function saveBook(id: string, input: unknown) {
    await api(`/v1/books/${id}`, "PUT", input);
    await refresh();
  }
  async function saveSession(id: string, input: unknown) {
    await api(`/v1/sessions/${id}`, "PUT", input);
    if (timer?.id === id) await updateTimer(null);
    await refresh();
  }
  async function deleteSession(id: string) {
    await api(`/v1/sessions/${id}`, "DELETE");
    await refresh();
  }
  return (
    <Context.Provider
      value={{
        ...data,
        user,
        loading,
        timer,
        error,
        refresh,
        start,
        updateTimer,
        saveBook,
        saveSession,
        deleteSession,
        setInsight: (insight) =>
          setData((current) => ({ ...current, insight })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useJournal() {
  const context = useContext(Context);
  if (!context) throw new Error("JournalProvider missing");
  return context;
}
export function timerSeconds(timer: Timer) {
  return elapsedSeconds(timer);
}
