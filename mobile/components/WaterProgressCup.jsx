// components/WaterProgressCup.jsx
import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import Svg, { Defs, ClipPath, Path, Rect, G } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * Props:
 * - value: number (liters consumed)
 * - goal: number (liters target)
 * - width: number (px)
 * - height: number (px)
 */
export default function WaterProgressCup({
  value = 0,
  goal = 2.0, // liters
  width = 160,
  height = 200,
}) {
  const percent = goal > 0 ? clamp((value / goal) * 100, 0, 100) : 0;

  // animate water height (0 -> 100)
  const anim = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [percent, anim]);

  // cup geometry
  const padding = 12;
  const cupW = width - padding * 2;
  const cupH = height - padding * 2;
  const rimRadius = 10;
  const baseRadius = 16;
  const neckIn = 10;
  const bodyInset = 6;

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

  // ✅ Correct fill: grow height from 0 → cupH and move y accordingly
  const waterHeight = Animated.multiply(anim, cupH / 100); // px
  const waterY = Animated.subtract(cupH, waterHeight);     // bottom align

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

        {/* Cup body (behind) */}
        <Path d={cupPath} fill="#f3f5f7" stroke="#cfd6dd" strokeWidth={2} />

        {/* Water fill clipped to cup */}
        <G clipPath="url(#cup-clip)">
          <AnimatedRect
            x={0}
            y={waterY}
            width={cupW}
            height={waterHeight}
            fill={waterColor}
          />
          {/* Subtle top shimmer */}
          <AnimatedRect
            x={0}
            y={waterY}
            width={cupW}
            height={10}
            fill={waterOverlay}
            opacity={0.35}
          />
        </G>

        {/* Front stroke for crisp edge */}
        <Path d={cupPath} fill="transparent" stroke="#aeb7c2" strokeWidth={2} />
      </Svg>

      <Text style={{ fontSize: 20, fontWeight: "700" }}>{Math.round(percent)}%</Text>
      <Text style={{ fontSize: 14, color: "#64748b" }}>
        {value.toFixed(1)} L / {goal.toFixed(1)} L
      </Text>
    </View>
  );
}
