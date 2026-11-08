import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJournal } from "../../lib/journal";
import { color, Page } from "../../components/ui";
export default function TabsLayout() {
  const { user, loading } = useJournal();
  const insets = useSafeAreaInsets();
  if (loading) return <Page title="Opening your journal…" />;
  if (!user) return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: false,
        animation: "none",
        tabBarActiveTintColor: color.green,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.line,
          height: 60 + Math.max(12, insets.bottom),
          paddingTop: 6,
          paddingBottom: Math.max(12, insets.bottom),
        },
        tabBarLabelStyle: {
          fontFamily: "PlusJakartaSans_600SemiBold",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color: tint }) => (
            <Feather
              name="home"
              size={20}
              color={typeof tint === "string" ? tint : color.green}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color }) => (
            <Feather
              name="book-open"
              size={20}
              color={typeof color === "string" ? color : "#003422"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => (
            <Feather
              name="bar-chart-2"
              size={20}
              color={typeof color === "string" ? color : "#003422"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="for-you"
        options={{
          title: "For You",
          tabBarIcon: ({ color }) => (
            <Feather
              name="sun"
              size={20}
              color={typeof color === "string" ? color : "#003422"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color }) => (
            <Feather
              name="users"
              size={20}
              color={typeof color === "string" ? color : "#003422"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
