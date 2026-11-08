import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useFonts, Newsreader_400Regular } from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { JournalProvider, useJournal } from "../lib/journal";
import { Button, Page, styles, color } from "../components/ui";
import { LogOutButton } from "../components/log-out-button";

export default function Layout() {
  const [loaded, error] = useFonts({
    Newsreader_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.paper,
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
        }}
      >
        <ActivityIndicator color={color.green} />
      </View>
    );
  return (
    <JournalProvider>
      <JournalNavigator />
    </JournalProvider>
  );
}


function JournalNavigator() {
  const { user, loading, guestSetupError, retryGuestSetup } = useJournal();
  if (loading) return <Page title={user?.isAnonymous ? "Preparing your guest journal…" : "Opening your journal…"} />;
  if (user?.isAnonymous && guestSetupError) return (
    <Page title="Let’s get your journal ready">
      <Text style={styles.body}>{guestSetupError}</Text>
      <Button title="Retry guest journal" onPress={() => void retryGuestSetup()} />
      <LogOutButton />
    </Page>
  );
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="install" />
      <Stack.Protected guard={!!user} redirectTo="/sign-in">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="finish" />
        <Stack.Screen name="session" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="add-book" />
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="reader/[id]" />
        <Stack.Screen name="insights/book/[id]" />
        <Stack.Screen name="insights/session/[id]" />
        <Stack.Screen name="community/circle/[id]" />
        <Stack.Screen name="community/compose" />
        <Stack.Screen name="community/create" />
        <Stack.Screen name="community/leaderboard" />
        <Stack.Screen name="community/post/[id]" />
        <Stack.Screen name="community/reader/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
