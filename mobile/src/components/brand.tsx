import React from "react";
import { Image, View } from "react-native";
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
