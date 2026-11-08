import React from "react";
import { Image, View } from "react-native";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/brand/remarked-mark.jpg")}
      accessibilityLabel="Remarked app icon"
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
    />
  );
}

export function BrandWordmark({ hero = false }: { hero?: boolean }) {
  return (
    <View
      style={
        hero
          ? {
              width: "100%",
              maxWidth: 420,
              aspectRatio: 1600 / 533,
              borderRadius: 16,
              alignSelf: "flex-start",
              overflow: "hidden",
            }
          : { width: 168, height: 56, borderRadius: 10, overflow: "hidden" }
      }
    >
      <Image
        source={require("../../assets/brand/remarked-wordmark.jpg")}
        accessibilityLabel="Remarked"
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
