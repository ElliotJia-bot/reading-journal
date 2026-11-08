import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import type { Book, ReadingSession } from "../../../shared/domain";
import { hourLabel, readingClock } from "../../../shared/book-insights";
import { color, styles } from "./ui";
import { SurfaceFade } from "./surface-fade";
import { DetailFold } from "./insight-blocks";
const polar = (r: number, degrees: number) => [
  150 + r * Math.sin((degrees * Math.PI) / 180),
  150 - r * Math.cos((degrees * Math.PI) / 180),
];
function bar(hour: number, radius: number) {
  const [a, b] = polar(40, hour * 15 - 5.8),
    [c, d] = polar(radius, hour * 15 - 5.8),
    [e, f] = polar(radius, hour * 15 + 5.8),
    [g, h] = polar(40, hour * 15 + 5.8);
  return `M${a},${b} L${c},${d} A${radius},${radius} 0 0 1 ${e},${f} L${g},${h} A40,40 0 0 0 ${a},${b} Z`;
}
export default function ReadingClock({
  book,
  sessions,
  timezone,
}: {
  book: Book;
  sessions: ReadingSession[];
  timezone: string;
}) {
  const data = readingClock(book, sessions, timezone),
    max = Math.max(1, ...data.hours.map((h) => h.minutes));
  const peak = data.peak;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: "#f8f5f0",
          borderWidth: 1,
          borderColor: color.line,
          gap: 12,
        },
      ]}
    >
      <SurfaceFade tone="stone" />
      <Text style={[styles.label, { marginBottom: 0, letterSpacing: 1.5 }]}>
        YOUR RHYTHM · THIS BOOK
      </Text>
      <Text style={styles.heading}>The reading clock</Text>
      {peak && (
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "#e3ebe5",
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 20,
          }}
        >
          <Text style={[styles.muted, { color: color.green }]}>
            {hourLabel(peak.start)}–{hourLabel(peak.start + 2)} · your usual
            window
          </Text>
        </View>
      )}
      <View
        style={{
          width: "100%",
          maxWidth: 330,
          alignSelf: "center",
          aspectRatio: 1,
        }}
        accessibilityRole="image"
        accessibilityLabel={`Reading clock. ${Math.round(data.minutes)} minutes across ${data.sessions} sessions.${peak ? ` Most time in sittings starting ${hourLabel(peak.start)} to ${hourLabel(peak.start + 2)}.` : ""}`}
      >
        <Svg width="100%" height="100%" viewBox="0 0 300 300">
          {[40, 65, 90, 115].map((r) => (
            <Circle
              key={r}
              cx={150}
              cy={150}
              r={r}
              stroke="#ded5cb"
              strokeDasharray="3 4"
              fill="none"
            />
          ))}
          {data.hours
            .filter((h) => h.minutes > 0)
            .map((h) => (
              <Path
                key={h.hour}
                d={bar(h.hour, 40 + (h.minutes / max) * 75)}
                fill={
                  peak && [peak.start, (peak.start + 1) % 24].includes(h.hour)
                    ? color.green
                    : "#7b9987"
                }
              />
            ))}
          {[
            [0, "12 AM"],
            [6, "6 AM"],
            [12, "12 PM"],
            [18, "6 PM"],
          ].map(([h, label]) => {
            const [x, y] = polar(135, Number(h) * 15);
            return (
              <SvgText
                key={h}
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill={color.muted}
                fontSize={11}
              >
                {label}
              </SvgText>
            );
          })}
          <SvgText
            x={150}
            y={148}
            textAnchor="middle"
            fontSize={23}
            fill={color.green}
          >
            {data.sessions}
          </SvgText>
          <SvgText
            x={150}
            y={166}
            textAnchor="middle"
            fontSize={10}
            fill={color.muted}
          >
            sessions
          </SvgText>
        </Svg>
      </View>
      <Text style={styles.muted}>
        {data.sessions
          ? "Longer bars mean more reading time. All sessions with this book."
          : "Your clock will take shape after a reading session."}
      </Text>
      <DetailFold title="How to read the clock">
        <Text style={styles.muted}>
          Active minutes are grouped by the hour a session started, in your
          reading timezone. The darker bars mark the two-hour window with the
          most logged time, once it contains at least 3 sittings.
        </Text>
      </DetailFold>
    </View>
  );
}
