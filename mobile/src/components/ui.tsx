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
import { color } from "../lib/theme";
import { SurfaceFade } from "./surface-fade";
export { color } from "../lib/theme";

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
  card: {
    padding: 20,
    backgroundColor: color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: color.line,
    gap: 14,
  },
  cardGreen: { backgroundColor: color.greenSoft, borderColor: color.line },
  cardCoral: { backgroundColor: color.coralSoft, borderColor: color.line },
  cardStone: { backgroundColor: color.card, borderColor: color.line },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: color.green,
    marginBottom: 8,
  },
  input: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 14,
    padding: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: color.ink,
    minHeight: 48,
  },
  button: {
    backgroundColor: color.green,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: color.onDark,
  },
  error: {
    backgroundColor: color.errorSurface,
    color: color.error,
    padding: 14,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 20,
  },
  cover: {
    width: 86,
    height: 128,
    borderRadius: 5,
    backgroundColor: color.stone,
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
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}>
        <SurfaceFade radius={0} />
      </View>
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
      testID={secondary ? "theme-secondary" : "theme-primary"}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && { backgroundColor: color.greenWash },
        pressed && !disabled && !busy && { opacity: 0.86 },
        (disabled || busy) && { opacity: 0.5 },
      ]}
    >
      {!secondary && <SurfaceFade tone="button" radius={14} />}
      {busy ? (
        <ActivityIndicator color={secondary ? color.green : color.onDark} />
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
        placeholderTextColor={color.muted}
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
          testID="theme-chip"
          accessibilityState={{ selected: value === item }}
          onPress={() => onChange(item)}
          style={{
            backgroundColor: value === item ? color.green : color.greenWash,
            borderRadius: 24,
            paddingHorizontal: 15,
            paddingVertical: 11,
            minHeight: 44,
          }}
        >
          <Text
            style={{
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: value === item ? color.onDark : color.ink,
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
          borderLeftColor: "#b7a99b",
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
          >
            <SurfaceFade tone="progress" radius={5} />
          </View>
        </View>
      )}
    </View>
  );
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
