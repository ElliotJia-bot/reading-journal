import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { EmailAuthProvider, linkWithCredential } from "firebase/auth";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";
import { useJournal } from "../lib/journal";
import { Page, Button, Chips, Field, styles, message } from "../components/ui";
import { LogOutButton } from "../components/log-out-button";
export default function Settings() {
  const { user, profile, refresh } = useJournal();
  const [draft, setDraft] = useState<{ goal: string; topics: string } | null>(
    null,
  );
  const [language, setLanguage] = useState<string | null>(null);
  const languages: Record<string, string> = {
    English: "eng",
    中文: "chi",
    Français: "fre",
    Español: "spa",
    Deutsch: "ger",
    日本語: "jpn",
  };
  const goal = draft?.goal ?? profile.goal;
  const topics = draft?.topics ?? profile.topics.join(", ");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function save() {
    setBusy(true);
    try {
      await api("/v1/profile", "PUT", {
        language: language ?? profile.language ?? "eng",
        goal,
        topics: topics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await refresh();
      setDraft(null);
      setFeedback("Your preferences are saved.");
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function link() {
    setBusy(true);
    try {
      await linkWithCredential(
        auth.currentUser!,
        EmailAuthProvider.credential(email.trim(), password),
      );
      await refresh();
      setFeedback("Your journal is now linked to your account.");
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Make it yours" back>
      <Text style={styles.body}>
        {user?.isAnonymous ? "Guest journal" : user?.email}
      </Text>
      <Field
        label="Your reading goal"
        value={goal}
        onChangeText={(value) => {
          setDraft({ goal: value, topics });
        }}
      />
      <Field
        label="Topics you enjoy"
        value={topics}
        onChangeText={(value) => {
          setDraft({ goal, topics: value });
        }}
      />
      <Text style={styles.muted}>
        Reading times are grouped in {profile.timezone}.
      </Text>
      <Text style={styles.label}>Book recommendation language</Text>
      <Chips
        values={Object.keys(languages)}
        value={
          Object.keys(languages).find(
            (k) => languages[k] === (language ?? profile.language ?? "eng"),
          ) ?? "English"
        }
        onChange={(v) => setLanguage(languages[v])}
      />
      <Button
        title="Save preferences"
        busy={busy}
        onPress={() => void save()}
      />
      {user?.isAnonymous && (
        <View style={styles.card}>
          <Text style={styles.heading}>Keep your journal with you</Text>
          <Text style={styles.body}>
            Create an account to access these same records on other devices.
          </Text>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button
            title="Create account and keep records"
            busy={busy}
            disabled={!email || password.length < 8}
            onPress={() => void link()}
          />
        </View>
      )}
      {!!feedback && <Text style={styles.body}>{feedback}</Text>}
      <View style={styles.card}>
        <Text style={styles.heading}>One journal, every device</Text>
        <Text style={styles.body}>
          Sign in with the same email on your phone and computer. Saved records
          refresh when you return to the app. Finish an active timer on the
          device where you started it.
        </Text>
        <Button
          title="Refresh saved records"
          secondary
          onPress={() => void refresh()}
        />
        <Button
          title="Install & testing guide"
          secondary
          onPress={() => router.push("/install")}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Chrome Extension</Text>
        <Text style={styles.muted}>
          Coming soon · Automatic reading records from supported websites.
        </Text>
      </View>
      <LogOutButton />
    </Page>
  );
}
