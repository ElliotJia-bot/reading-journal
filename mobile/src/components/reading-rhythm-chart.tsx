import React, { useId } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, {
  Line,
  Polyline,
  Rect,
  Circle,
  Polygon,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import type {
  SlowdownPoint,
  RhythmRange,
} from "../../../shared/book-insights";
import { color, styles } from "./ui";
export default function ReadingRhythmChart({
  points,
  ranges,
  reader,
}: {
  points: SlowdownPoint[];
  ranges: RhythmRange[];
  reader: boolean;
}) {
  const fillId = `rhythm-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { width } = useWindowDimensions();
  const labelSize = (11 * 560) / Math.max(270, Math.min(width, 640) - 48);
  const measured = points.filter((p) => p.relative !== null);
  if (!measured.length) return null;
  const first = Math.min(...points.map((p) => p.start)),
    last = Math.max(first + 1, ...points.map((p) => p.end));
  const ceiling = Math.max(
    2,
    Math.ceil(Math.max(...measured.map((p) => p.relative!))),
  );
  const x = (page: number) => 38 + ((page - first) / (last - first)) * 500,
    y = (v: number) => 156 - (v / ceiling) * 130;
  const lines: SlowdownPoint[][] = [];
  for (const p of measured) {
    const line = lines.at(-1);
    if (reader && line && line.at(-1)!.end + 1 === p.start) line.push(p);
    else lines.push([p]);
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.between}>
        <Text style={styles.muted}>Time compared with usual</Text>
        <Text style={[styles.muted, { color: color.green }]}>1× baseline</Text>
      </View>
      <View
        style={{ width: "100%", aspectRatio: 2.65 }}
        accessibilityRole="image"
        accessibilityLabel={`Reading rhythm across pages ${first} to ${last}. Below the 1 times baseline means less time; above means more time. Green highlights quicker stretches and coral highlights longer stays.`}
      >
        <Svg width="100%" height="100%" viewBox="0 0 560 210">
          <Defs>
            <LinearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={color.green} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={color.green} stopOpacity={0.01} />
            </LinearGradient>
            <LinearGradient id={`${fillId}-coral`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={color.coral} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={color.coral} stopOpacity={0.06} />
            </LinearGradient>
          </Defs>
          {ranges.map((r) => (
            <Rect
              key={r.key}
              x={Math.max(38, x(r.start) - 4)}
              y={26}
              width={Math.max(8, x(r.end) - x(r.start))}
              height={130}
              fill={`url(#${r.direction === "quicker" ? fillId : `${fillId}-coral`})`}
            />
          ))}
          {[0, 1, ceiling].map((v) => (
            <React.Fragment key={v}>
              <Line
                x1={38}
                x2={538}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 1 ? "#8c7c70" : "#ded5cb"}
                strokeDasharray="5 5"
              />
              <SvgText
                x={29}
                y={y(v) + 4}
                textAnchor="end"
                fill={color.muted}
                fontSize={labelSize}
              >
                {v}×
              </SvgText>
            </React.Fragment>
          ))}
          {lines.map((line, i) =>
            reader ? (
              <React.Fragment key={i}>
                {line.length > 1 && (
                  <Polygon
                    points={`${x(line[0].start)},156 ${line.map((p) => `${x(p.start)},${y(p.relative!)}`).join(" ")} ${x(line.at(-1)!.end)},156`}
                    fill={`url(#${fillId})`}
                  />
                )}
                <Polyline
                  points={line
                    .map((p) => `${x(p.start)},${y(p.relative!)}`)
                    .join(" ")}
                  fill="none"
                  stroke={color.green}
                  strokeWidth={2.5}
                />
                {line.length === 1 && (
                  <Circle
                    cx={x(line[0].start)}
                    cy={y(line[0].relative!)}
                    r={3}
                    fill={color.green}
                  />
                )}
              </React.Fragment>
            ) : (
              <Line
                key={i}
                x1={x(line[0].start)}
                x2={x(line[0].end)}
                y1={y(line[0].relative!)}
                y2={y(line[0].relative!)}
                stroke={line[0].relative! >= 1.5 ? color.rust : line[0].relative! <= 0.9 ? color.green : "#8c9b90"}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ),
          )}
          {[first, Math.round((first + last) / 2), last].map((v, i) => (
            <SvgText
              key={i}
              x={x(v)}
              y={181}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fill={color.muted}
              fontSize={labelSize}
            >
              p. {v}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <Text style={[styles.muted, { color: color.green }]}>↓ Quicker stretches</Text>
        <Text style={[styles.muted, { color: color.rust }]}>↑ More time here</Text>
      </View>
    </View>
  );
}
