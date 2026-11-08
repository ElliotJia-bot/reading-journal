import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, {
  Line,
  Polyline,
  Rect,
  Circle,
  Text as SvgText,
} from "react-native-svg";
import type {
  SlowdownPoint,
  SlowdownRange,
} from "../../../shared/book-insights";
import { color, styles } from "./ui";
export default function SlowdownChart({
  points,
  ranges,
  reader,
}: {
  points: SlowdownPoint[];
  ranges: SlowdownRange[];
  reader: boolean;
}) {
  const { width } = useWindowDimensions();
  const labelSize = (12 * 560) / Math.max(270, Math.min(width, 640) - 48);
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
        <Text style={styles.muted}>Time vs. your usual pace</Text>
        <Text style={[styles.muted, { color: color.green }]}>1× = usual</Text>
      </View>
      <View
        style={{ width: "100%", aspectRatio: 2.65 }}
        accessibilityRole="image"
        accessibilityLabel={`Reading pace across pages ${first} to ${last}. Highlighted passages took at least 50 percent more time.`}
      >
        <Svg width="100%" height="100%" viewBox="0 0 560 210">
          {ranges.map((r) => (
            <Rect
              key={r.key}
              x={Math.max(38, x(r.start) - 4)}
              y={26}
              width={Math.max(8, x(r.end) - x(r.start))}
              height={130}
              fill="#f2ded3"
            />
          ))}
          {[0, 1, ceiling].map((v) => (
            <React.Fragment key={v}>
              <Line
                x1={38}
                x2={538}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 1 ? "#8a8f7c" : "#ded8ce"}
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
                <Polyline
                  points={line
                    .map((p) => `${x(p.start)},${y(p.relative!)}`)
                    .join(" ")}
                  fill="none"
                  stroke="#5d6654"
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
                stroke={line[0].relative! >= 1.5 ? color.rust : "#708570"}
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
      <Text style={styles.muted}>
        {reader
          ? "Shaded areas show longer dwell on comparable text."
          : "Each segment is a sitting’s average, across its logged pages."}
      </Text>
    </View>
  );
}
