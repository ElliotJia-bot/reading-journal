import React from "react";
import { Redirect } from "expo-router";
import { useJournal } from "../lib/journal";
import { Page } from "../components/ui";

export default function Entry() {
  const { user, loading } = useJournal();
  if (loading) return <Page title="Opening your journal…" />;
  return <Redirect href={user ? "/(tabs)" : "/sign-in"} />;
}
