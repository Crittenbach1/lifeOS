// components/WaterProgressCup.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, Animated } from "react-native";
import Svg, { Defs, ClipPath, Path, Rect, G } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export default function WaterProgressCup({
  summary,
  goal = 3,      // liters/day
  width = 180,
  height = 220,
}) {
  // Pull liters for "today" from the summary (supports several common keys)
  const litersToday = useMemo(() => {
    const t = summary?.today;
    if (typeof t === "number") return t;
    if (t && typeof t === "object") {
      const n = Number(t.liters ?? t.amount ?? t.total ?? t.value ?? 0);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }, [summary]);

  const percent = goal > 0 ? clamp((litersToday / goal) * 100, 0, 100) : 0;

  // animate water height (0 → 100)
  const anim = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: percent, duration: 700, useNativeDriver: false }).start();
  }, [percent, anim]);

  // cup geometry
  const pad = 12;
  const cupW = width - pad * 2;
  const cupH = height - pad * 2;
  const rimR = 10;
  const baseR = 16;
  const neckIn = 10;
  const bodyInset = 6;

  const cupPath = `
    M ${rimR} 0
    H ${cupW - rimR}
    Q ${cupW} 0 ${cupW} ${rimR}
    L ${cupW - neckIn} ${cupH * 0.2}
    Q ${cupW - bodyInset} ${cupH * 0.55} ${cupW - baseR} ${cupH - rimR}
    H ${baseR}
    Q ${bodyInset} ${cupH * 0.55} ${neckIn} ${cupH * 0.2}
    L 0 ${rimR}
    Q 0 0 ${rimR} 0
    Z
  `;

  const waterHeight = Animated.multiply(anim, cupH / 100); // px
  const waterY = Animated.subtract(cupH, waterHeight);     // bottom aligned

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Svg width={width} height={height} viewBox={`0 0 ${cupW} ${cupH}`}>
        <Defs>
          <ClipPath id="cup-clip">
            <Path d={cupPath} />
          </ClipPath>
        </Defs>

        {/* Cup body (back) */}
        <Path d={cupPath} fill="#f3f5f7" stroke="#cfd6dd" strokeWidth={2} />

        {/* Water fill */}
        <G clipPath="url(#cup-clip)">
          <AnimatedRect x={0} y={waterY} width={cupW} height={waterHeight} fill="#4aa3ff" />
          {/* subtle top shimmer */}
          <AnimatedRect x={0} y={waterY} width={cupW} height={10} fill="#8bc2ff" opacity={0.35} />
        </G>

        {/* Front stroke for crisp edge */}
        <Path d={cupPath} fill="transparent" stroke="#aeb7c2" strokeWidth={2} />
      </Svg>

      <Text style={{ fontSize: 20, fontWeight: "700" }}>{Math.round(percent)}%</Text>
      <Text style={{ fontSize: 14, color: "#64748b" }}>
        {litersToday.toFixed(1)} / {goal.toFixed(1)} L
      </Text>
      <Text style={{ fontSize: 12, color: "#94a3b8" }}>Today</Text>
    </View>
  );
}
