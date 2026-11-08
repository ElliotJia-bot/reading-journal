import React, { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { color } from "../lib/theme";

export type FadeTone = "stone" | "forest" | "coral" | "button" | "progress";

/** Decorative only: never intercept gestures or become a screen-reader stop. */
export function SurfaceFade({
  tone = "stone",
  radius = 22,
}: {
  tone?: FadeTone;
  radius?: number;
}) {
  const id = `fade-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const colors: Record<FadeTone, [string, string]> = {
    stone: [color.stone, color.paper],
    forest: [color.greenSoft, color.surface],
    coral: [color.coralSoft, color.surface],
    button: ["#1d5640", color.green],
    progress: [color.green, color.greenLift],
  };
  const [start, end] = colors[tone];
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={start} stopOpacity={tone === "stone" ? 0.38 : 1} />
            <Stop offset="100%" stopColor={end} stopOpacity={tone === "stone" ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
