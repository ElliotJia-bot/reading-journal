import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { Book } from "../../../shared/domain";
import { Button, Field, styles } from "./ui";

export default function LibraryInsightSearch({ books }: { books: Book[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boundary = useRef<HTMLDivElement>(null);
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  useEffect(() => {
    if (Platform.OS !== "web" || !open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !boundary.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const matches = books
    .filter((b) =>
      `${b.title} ${b.author}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, 5);
  const content = (
    <View style={{ gap: 14 }}>
      <Field
        label="Search your library"
        value={query}
        onChangeText={setQuery}
        placeholder="Title or author"
        onFocus={() => setOpen(true)}
        onPressIn={() => setOpen(true)}
        onBlur={Platform.OS === "web" ? undefined : () => setOpen(false)}
      />
      {open && (
        <View style={{ gap: 10 }}>
          {matches.map((b) => (
            <Button
              key={b.id}
              title={b.title}
              secondary
              onPress={() => {
                setOpen(false);
                router.push({
                  pathname: "/insights/book/[id]",
                  params: { id: b.id },
                });
              }}
            />
          ))}
          {!matches.length && (
            <Text style={styles.muted}>
              {books.length
                ? "No matching books in your library."
                : "Add a book to explore its insights."}
            </Text>
          )}
        </View>
      )}
    </View>
  );
  if (Platform.OS !== "web") return content;
  return (
    <div
      ref={boundary}
      onBlur={(event) => {
        // Keep the list mounted while focus moves from the input to a result,
        // so mouse, touch and keyboard selection all reach the book page.
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {content}
    </div>
  );
}
