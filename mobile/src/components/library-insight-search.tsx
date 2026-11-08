import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { Book } from "../../../shared/domain";
import { color, styles } from "./ui";
import { Feather } from "@expo/vector-icons";

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
    <View style={{ position: "relative", zIndex: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: open ? color.green : color.line,
          borderRadius: 10,
          backgroundColor: color.surface,
        }}
      >
        <Feather name="search" size={16} color={color.muted} />
        <TextInput
          accessibilityLabel="Search your library"
          accessibilityState={{ expanded: open }}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your library"
          placeholderTextColor={color.muted}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            outlineWidth: 0,
            fontSize: 14,
            color: color.ink,
            fontFamily: "PlusJakartaSans_400Regular",
            paddingVertical: 10,
          }}
          onFocus={() => setOpen(true)}
          onPressIn={() => setOpen(true)}
          onBlur={Platform.OS === "web" ? undefined : () => setOpen(false)}
        />
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={color.muted}
        />
      </View>
      {open && (
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 0,
            right: 0,
            zIndex: 20,
            elevation: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: color.line,
            backgroundColor: color.surface,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(75,60,53,0.10)",
          }}
        >
          <ScrollView
            style={{ maxHeight: 196 }}
            keyboardShouldPersistTaps="handled"
          >
            {matches.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`View insights for ${b.title}`}
                onPress={() => {
                  setOpen(false);
                  router.push({
                    pathname: "/insights/book/[id]",
                    params: { id: b.id },
                  });
                }}
                style={({ pressed }) => ({
                  minHeight: 58,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderBottomWidth: 1,
                  borderBottomColor: color.line,
                  backgroundColor: pressed ? color.greenSoft : color.surface,
                  gap: 2,
                })}
              >
                <Text style={styles.body} numberOfLines={1}>
                  {b.title}
                </Text>
                {!!b.author && (
                  <Text style={styles.muted} numberOfLines={1}>
                    {b.author}
                  </Text>
                )}
              </Pressable>
            ))}
            {!matches.length && (
              <Text style={[styles.muted, { padding: 14 }]}>
                {books.length
                  ? "No matching books in your library."
                  : "Add a book to explore its insights."}
              </Text>
            )}
          </ScrollView>
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
