import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { useFonts, Newsreader_400Regular } from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { JournalProvider } from "../lib/journal";
import { color } from "../components/ui";
import { BrandMark } from "../components/brand";
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
        <BrandMark size={80} />
        <ActivityIndicator color={color.green} />
      </View>
    );
  return (
    <JournalProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.paper },
        }}
      />
    </JournalProvider>
  );
}
