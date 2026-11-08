import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { timerSeconds, useJournal } from "../lib/journal";
import { Button, message, styles } from "./ui";

export function LogOutButton() {
  const { user, timer, updateTimer } = useJournal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.isAnonymous) return null;

  async function logOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Preserve an unfinished session without counting time spent logged out.
      if (timer?.runningSince != null) {
        await updateTimer({
          ...timer,
          accumulatedSeconds: timerSeconds(timer),
          runningSince: null,
        });
      }
      await signOut(auth);
      router.replace("/");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Button title="Log out" secondary busy={busy} onPress={() => void logOut()} />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
