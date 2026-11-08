import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useJournal } from "./journal";
import { auth } from "./firebase";
import { api } from "./api";

export function useCommunityResource<T>(path: string) {
  const { user } = useJournal();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    const owner = user?.uid;
    if (!owner) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const value = await api<T>(path);
      if (current === sequence.current && auth.currentUser?.uid === owner) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (current === sequence.current) {
        setData(null);
        setError(
          e instanceof Error ? e.message : "Unable to load this conversation.",
        );
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [path, user?.uid]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        sequence.current++;
      };
    }, [refresh]),
  );
  return { data, loading, error, refresh, setData, setError };
}

export function useCommunityDraft<T>(key: string, initial: T) {
  const [draft, setDraft] = useState(initial);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storageError, setStorageError] = useState("");
  const stopped = useRef(false);
  const write = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((cached) => {
        if (active && cached) setDraft(JSON.parse(cached));
      })
      .catch(() => {
        if (active)
          setStorageError("Your previous draft could not be restored.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready || stopped.current) return;
    setSaved(false);
    write.current = write.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(draft)))
      .then(() => setSaved(true))
      .catch(() =>
        setStorageError(
          "This draft could not be saved on this device. Keep this screen open to retry.",
        ),
      );
  }, [key, draft, ready]);
  async function clear() {
    stopped.current = true;
    await write.current;
    await AsyncStorage.removeItem(key);
  }
  return { draft, setDraft, ready, saved, storageError, clear };
}
