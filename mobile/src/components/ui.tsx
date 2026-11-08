import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

export const color = {
  paper: "#fdf9f3",
  card: "#f2ede8",
  green: "#14422d",
  ink: "#1c1b19",
  muted: "#626960",
  line: "#e3ded5",
  rust: "#9c4328",
};
export const styles = StyleSheet.create({
  quote: {
    fontFamily: "Newsreader_400Regular",
    fontSize: 19,
    lineHeight: 28,
    color: color.ink,
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: color.ink,
  },
  muted: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 19,
    color: color.muted,
  },
  title: {
    fontFamily: "Newsreader_400Regular",
    fontSize: 32,
    lineHeight: 38,
    color: color.green,
  },
  heading: {
    fontFamily: "Newsreader_400Regular",
    fontSize: 23,
    lineHeight: 29,
    color: color.green,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  card: { padding: 20, backgroundColor: color.card, borderRadius: 18, gap: 14 },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: color.green,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fffdf9",
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 10,
    padding: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: color.ink,
    minHeight: 48,
  },
  button: {
    backgroundColor: color.green,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: "white",
  },
  error: {
    backgroundColor: "#fce7df",
    color: "#7d2c13",
    padding: 14,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  cover: {
    width: 86,
    height: 128,
    borderRadius: 5,
    backgroundColor: "#d8d7c4",
  },
});
export function Page({
  children,
  title,
  back = false,
  onBack,
}: {
  children?: React.ReactNode;
  title?: string;
  back?: boolean;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.paper }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          gap: 22,
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
          paddingBottom: 44,
        }}
      >
        {back && (
          <View style={styles.between}>
            <View style={styles.row}>
              {back && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={
                    onBack ??
                    (() =>
                      router.canGoBack() ? router.back() : router.replace("/"))
                  }
                  style={{ padding: 10 }}
                >
                  <Feather name="arrow-left" size={20} color={color.green} />
                </Pressable>
              )}
            </View>
            <Feather name="book-open" size={22} color={color.green} />
          </View>
        )}
        {title && <Text style={styles.title}>{title}</Text>}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        secondary && { backgroundColor: "#e6e9df" },
        (disabled || busy) && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? color.green : "white"} />
      ) : (
        <Text style={[styles.buttonText, secondary && { color: color.green }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8b9188"
        style={styles.input}
        {...props}
      />
    </View>
  );
}
export function Chips({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item }}
          onPress={() => onChange(item)}
          style={{
            backgroundColor: value === item ? color.green : "#e9e6df",
            borderRadius: 24,
            paddingHorizontal: 15,
            paddingVertical: 11,
            minHeight: 44,
          }}
        >
          <Text
            style={{
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: value === item ? "white" : color.muted,
              fontSize: 12,
            }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Cover({
  title,
  uri,
  large = false,
}: {
  title: string;
  uri: string;
  large?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const size = large ? { width: 142, height: 212 } : {};
  if (uri && !failed)
    return (
      <Image
        accessibilityLabel={`${title} cover`}
        source={{ uri }}
        style={[styles.cover, size]}
        onError={() => setFailed(true)}
      />
    );
  return (
    <View
      style={[
        styles.cover,
        size,
        {
          padding: 10,
          justifyContent: "center",
          borderLeftWidth: 5,
          borderLeftColor: "#bcc2ae",
        },
      ]}
    >
      <Text
        numberOfLines={5}
        style={{
          fontFamily: "Newsreader_400Regular",
          fontSize: large ? 23 : 16,
          color: color.green,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </View>
  );
}
export function Progress({
  position,
  total,
  unit,
}: {
  position: number;
  total: number | null;
  unit: string;
}) {
  const percent =
    unit === "percent"
      ? position
      : total
        ? Math.min(100, (position / total) * 100)
        : null;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.between}>
        <Text style={styles.label}>
          {percent === null
            ? `Page ${position}`
            : `${Math.round(percent)}% complete`}
        </Text>
        <Text style={styles.muted}>
          {unit === "pages" && total ? `${position} / ${total} pages` : ""}
        </Text>
      </View>
      {percent !== null && (
        <View
          style={{ height: 5, borderRadius: 5, backgroundColor: color.line }}
        >
          <View
            style={{
              height: 5,
              borderRadius: 5,
              backgroundColor: color.green,
              width: `${percent}%`,
            }}
          />
        </View>
      )}
    </View>
  );
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
