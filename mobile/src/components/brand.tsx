import React from "react";
import { Image, Platform, View } from "react-native";
import layout from "../../assets/brand/wordmark-layout.json";

export function BrandWordmark({ width = 156 }: { width?: number }) {
  const scale = width / layout.width;
  const height = layout.height * scale;
  return (
    <View
      testID="home-wordmark"
      style={{
        width,
        height,
        flexShrink: 0,
        ...Platform.select({
          web: { filter: "drop-shadow(0 1px 1px rgba(20, 66, 45, 0.6))" },
          android: { filter: "drop-shadow(0 1px 1px rgba(20, 66, 45, 0.6))" },
          default: {
            shadowColor: "#14422d",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.6,
            shadowRadius: 1,
          },
        }),
      }}
    >
      <View style={{ width, height, overflow: "hidden" }}>
        <Image
          source={require("../../assets/brand/remarked-wordmark-transparent.png")}
          accessibilityLabel="Remarked"
          resizeMode="contain"
          style={{
            position: "absolute",
            left: -layout.x * scale,
            top: -layout.y * scale,
            width: layout.imageWidth * scale,
            height: layout.imageHeight * scale,
          }}
        />
      </View>
    </View>
  );
}
