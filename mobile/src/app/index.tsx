import React, { useState } from "react";
import { Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { useJournal } from "../lib/journal";
import { Page, Button, Field, Chips, styles, message } from "../components/ui";
export default function Welcome() {
  const { user, loading } = useJournal();
  const [mode, setMode] = useState("Create account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <Page title="Opening your journal…" />;
  if (user) return <Redirect href="/(tabs)" />;
  async function submit(guest = false) {
    setBusy(true);
    setError("");
    try {
      if (guest) await signInAnonymously(auth);
      else if (mode === "Create account")
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page brand="hero">
      <View style={{ paddingVertical: 22, gap: 18 }}>
        <Text style={[styles.title, { fontSize: 43, lineHeight: 48 }]}>
          Find your{"\n"}reading rhythm.
        </Text>
        <Text style={styles.body}>
          Keep your books close. Discover the places, stories, and little habits
          that help you read.
        </Text>
      </View>
      <View style={styles.card}>
        <Chips
          values={["Create account", "Sign in"]}
          value={mode}
          onChange={setMode}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={
            mode === "Create account" ? "new-password" : "current-password"
          }
        />
        <Text style={styles.muted}>
          Use at least 8 characters for your password.
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button
          title={mode}
          busy={busy}
          disabled={!email || password.length < 8}
          onPress={() => void submit()}
        />
      </View>
      <Button
        title="Try with a guest journal"
        secondary
        busy={busy}
        onPress={() => void submit(true)}
      />
      <Text style={styles.muted}>
        Guest records stay with this device’s sign-in. You can create an account
        in Settings to keep the same journal across devices.
      </Text>
      <Button
        title="Use on your iPhone & computer"
        secondary
        onPress={() => router.push("/install")}
      />
    </Page>
  );
}
