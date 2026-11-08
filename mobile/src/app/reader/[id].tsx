import React from "react";
import { useLocalSearchParams } from "expo-router";
import EbookReader from "../../components/ebook-reader";
import { useJournal } from "../../lib/journal";
export default function ReaderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useJournal();
  return <EbookReader key={`${user?.uid}:${id}`} />;
}
