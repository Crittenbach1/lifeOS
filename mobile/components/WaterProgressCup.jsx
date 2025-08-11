// components/WaterProgressCup.jsx
import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import Svg, { Defs, ClipPath, Path, Rect, G } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Props:
 * - value: number (e.g., ounces consumed today)
 * - goal: number (e.g., 64 for 64 oz)
 * - unit: string ("oz" | "ml"), default "oz"
 * - width: number (px), default 160
 * - height: number (px), default 200
 */
export default function WaterProgressCup({
  value = 0,
  goal = 64,
  unit = "oz",
  width = 160,
  height = 200,
}) {
  const percent = goal > 0 ? clamp((value / goal) * 100, 0, 100) : 0;

  // Animate water height
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [percent, anim]);

  // Cup geometry
  const padding = 12;
  const cupW = width - padding * 2;
  const cupH = height - padding * 2;

  // A nice cup silhouette path (top open, slightly wider than base)
  // Coordinates are normalized to the viewBox (0..cupW x 0..cupH)
  const rimRadius = 10;
  const baseRadius = 16;
  const neckIn = 10; // inset between rim and body
  const bodyInset = 6; // subtle inward curve mid body

  // Path: top-left -> top-right (rim) -> body -> base -> back up
  const cupPath = `
    M ${rimRadius} 0
    H ${cupW - rimRadius}
    Q ${cupW} 0 ${cupW} ${rimRadius}
    L ${cupW - neckIn} ${cupH * 0.2}
    Q ${cupW - bodyInset} ${cupH * 0.55} ${cupW - baseRadius} ${cupH - rimRadius}
    H ${baseRadius}
    Q ${bodyInset} ${cupH * 0.55} ${neckIn} ${cupH * 0.2}
    L 0 ${rimRadius}
    Q 0 0 ${rimRadius} 0
    Z
  `;

  const waterTop = Animated.multiply(
    Animated.subtract(100, anim), // invert
    cupH / 100
  ); // pixel Y for water level (0 at top inside clip)

  const waterColor = "#4aa3ff";
  const waterOverlay = "#8bc2ff";

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Svg width={width} height={height} viewBox={`0 0 ${cupW} ${cupH}`}>
        <Defs>
          <ClipPath id="cup-clip">
            <Path d={cupPath} />
          </ClipPath>
        </Defs>

        {/* Cup outline (behind) */}
        <Path d={cupPath} fill="#f3f5f7" stroke="#cfd6dd" strokeWidth={2} />

        {/* Water fill clipped to the cup */}
        <G clipPath="url(#cup-clip)">
          {/* Water base */}
          <AnimatedRect
            x={0}
            // y will be animated: water fills from bottom upward
            y={Animated.subtract(cupH, waterTop)}
            width={cupW}
            height={cupH}
            fill={waterColor}
          />
          {/* Subtle top shimmer */}
          <AnimatedRect
            x={0}
            y={Animated.subtract(cupH, waterTop)}
            width={cupW}
            height={10}
            fill={waterOverlay}
            opacity={0.35}
          />
        </G>

        {/* Cup outline (front stroke) for a crisp edge */}
        <Path d={cupPath} fill="transparent" stroke="#aeb7c2" strokeWidth={2} />
      </Svg>

      {/* Labels */}
      <Text style={{ fontSize: 20, fontWeight: "700" }}>
        {Math.round(percent)}%
      </Text>
      <Text style={{ fontSize: 14, color: "#64748b" }}>
        {value}{unit} / {goal}{unit}
      </Text>
    </View>
  );
}
