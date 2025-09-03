// app/(root)/task-type/[id].tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { API_URL } from "@/constants/api";
import Svg, { Circle, Path, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ===================== CONFIG ===================== */
const TZ = "America/New_York";
const CELL = 12;
const GAP = 2;
const WEEK_GAP = 3;
const OUTSIDE_OPACITY = 0.25;
const DAY_SINGLE = ["S", "M", "T", "W", "T", "F", "S"];
const LEFT_GUTTER = 20;

// Palettes (light -> dark)
const PALETTES: string[][] = [
  ["#ecfdf5", "#a7f3d0", "#34d399", "#059669", "#065f46"], // green
  ["#eff6ff", "#93c5fd", "#60a5fa", "#2563eb", "#1e40af"], // blue
  ["#f5f3ff", "#c4b5fd", "#a78bfa", "#7c3aed", "#4c1d95"], // purple
  ["#fff1f2", "#fda4af", "#fb7185", "#e11d48", "#881337"], // rose
  ["#fffbeb", "#fcd34d", "#f59e0b", "#d97706", "#92400e"], // amber
  ["#f0fdfa", "#5eead4", "#2dd4bf", "#0d9488", "#115e59"], // teal
  ["#eef2ff", "#a5b4fc", "#818cf8", "#4f46e5", "#3730a3"], // indigo
  ["#f0f9ff", "#7dd3fc", "#38bdf8", "#0284c7", "#0c4a6e"], // sky
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/* ===================== TYPES ===================== */
type Item = {
  id: number;
  tasktypeid: number;
  name: string | null;
  amount: number | null;
  description: string | null;
  taskcategory: string | null;
  created_at: string;
};

type Schedule = { dayOfWeek: number; times: string[] };

type TaskType = {
  id: number | string;
  user_id: string;
  name: string;
  schedules?: Schedule[] | null;
  priority: number;
  trackBy?: string;
  trackby?: string;
  categories?: string[] | null;
  defaultAmount?: number | null;
  defaultamount?: number | null;
  yearlyGoal?: number;
  monthlyGoal?: number;
  weeklyGoal?: number;
  dailyGoal?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  [k: string]: any; // allow lowercase keys from DB
};

/* ===================== HELPERS ===================== */
function toDateKeyInTZ(ts: string, timeZone: string): string {
  const looksNaive = ts && /\d{2}:\d{2}:\d{2}/.test(ts) && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(ts);
  const iso = looksNaive ? `${ts}Z` : ts;
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}
function todayYMDInTZ(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function ymdToDateUTC(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d));
}
function dateUTCToYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDaysYMD(ymd: string, days: number): string {
  const d = ymdToDateUTC(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return dateUTCToYMD(d);
}
function addMonthsYMD(ymd: string, months: number): string {
  const d = ymdToDateUTC(ymd);
  d.setUTCMonth(d.getUTCMonth() + months);
  return dateUTCToYMD(d);
}
function dayOfWeekYMD(ymd: string): number {
  return ymdToDateUTC(ymd).getUTCDay(); // 0=Sun..6=Sat
}
const jan1Y = (year: number) => `${year}-01-01`;
const dec31Y = (year: number) => `${year}-12-31`;
function startOfCalendarForYear(year: number) {
  let ymd = jan1Y(year);
  while (dayOfWeekYMD(ymd) !== 0) ymd = addDaysYMD(ymd, -1);
  return ymd;
}
function endOfCalendarForYear(year: number) {
  let ymd = dec31Y(year);
  while (dayOfWeekYMD(ymd) !== 6) ymd = addDaysYMD(ymd, 1);
  return ymd;
}
function monthAbbrevFromYMD(ymd: string): string {
  const d = ymdToDateUTC(ymd);
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}
function computeQuantiles(values: number[]) {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (v.length === 0) return { q25: 0, q50: 0, q75: 0 };
  const q = (p: number) => v[Math.floor((v.length - 1) * p)];
  return { q25: q(0.25), q50: q(0.5), q75: q(0.75) };
}
function sumRange(totals: Record<string, number>, fromYMD: string, toYMD: string): number {
  let ymd = fromYMD;
  let sum = 0;
  while (ymd <= toYMD) {
    sum += totals[ymd] ?? 0;
    ymd = addDaysYMD(ymd, 1);
  }
  return sum;
}
const numOr = (v: any, or = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : or;
};
const pickNumber = (obj: any, camel: string, lower: string, fallback = 0) =>
  numOr(obj?.[camel] ?? obj?.[lower], fallback);
function hashString(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}
function pickPalette(type: TaskType | null, fallbackIdx = 0): string[] {
  const key = type?.id?.toString() || type?.name || "default";
  const idx = key ? hashString(key) % PALETTES.length : fallbackIdx;
  return PALETTES[idx];
}
function daysBetweenYMD(a: string, b: string): number {
  const da = ymdToDateUTC(a).getTime();
  const db = ymdToDateUTC(b).getTime();
  return Math.floor((db - da) / (1000 * 60 * 60 * 24));
}

/* ===================== HEATMAP BUILDERS ===================== */
function buildYearWeeks(
  year: number,
  totals: Record<string, number>
): { weeks: { ymd: string; amount: number; outside: boolean }[][] } {
  const start = startOfCalendarForYear(year);
  const end = endOfCalendarForYear(year);
  const weeks: { ymd: string; amount: number; outside: boolean }[][] = [];
  let cur = start;
  let wi = 0;
  while (ymdToDateUTC(cur) <= ymdToDateUTC(end)) {
    if (!weeks[wi]) weeks[wi] = Array(7).fill(null) as any;
    const dow = dayOfWeekYMD(cur);
    const outside = cur < jan1Y(year) || cur > dec31Y(year);
    weeks[wi][dow] = { ymd: cur, amount: totals[cur] ?? 0, outside };
    if (dow === 6) wi += 1;
    cur = addDaysYMD(cur, 1);
  }
  return { weeks };
}
function buildMonthSegments(year: number, weeksDesc: { ymd: string; outside: boolean }[][]) {
  const starts: { label: string; index: number }[] = [];
  for (let i = 0; i < weeksDesc.length; i++) {
    const week = weeksDesc[i];
    const first = week.find(
      (c) => c && !c.outside && c.ymd.startsWith(`${year}-`) && c.ymd.endsWith("-01")
    );
    if (first) starts.push({ label: monthAbbrevFromYMD(first.ymd), index: i });
  }
  const segments: { label: string; start: number; span: number }[] = [];
  for (let s = 0; s < starts.length; s++) {
    const cur = starts[s];
    const next = starts[s + 1];
    const span = (next ? next.index : weeksDesc.length) - cur.index;
    segments.push({ label: cur.label, start: cur.index, span });
  }
  return segments;
}

/* ===================== UI BITS ===================== */
function CircularProgress({
  size = 72,
  stroke = 8,
  progress,
  color = "#111827",
  label,
  fractionText,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color?: string;
  label: string;
  fractionText: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const offset = c * (1 - clamped);
  const percentText = `${Math.round((progress || 0) * 100)}%`;
  return (
    <View style={{ width: size, alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "800", fontSize: 12 }}>{percentText}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, color: "#111", marginTop: 6, fontWeight: "700" }}>{label}</Text>
      <Text style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{fractionText}</Text>
    </View>
  );
}

/* ===== Daily SVG Line Chart ===== */
function DailyLineChart({
  points,
  domainDays,
  color = "#2563eb",
}: {
  points: { index: number; value: number; ymd: string }[];
  domainDays: string[];
  color?: string;
}) {
  const screenW = Dimensions.get("window").width;
  const contentW = Math.max(280, screenW - 32);

  const H = 180;
  const PAD_L = 40;
  const PAD_R = 40;
  const PAD_T = 12;
  const PAD_B = 28;

  const nDomain = Math.max(1, domainDays.length);
  const chartW = contentW - PAD_L - PAD_R;
  const STEP = nDomain > 1 ? chartW / (nDomain - 1) : chartW;

  const maxV = Math.max(1, ...points.map((d) => d.value));
  const chartH = H - PAD_T - PAD_B;

  const yFor = (v: number) => PAD_T + (1 - (v / maxV)) * chartH;
  const xFor = (dayIndex: number) => PAD_L + dayIndex * STEP;

  const sortedPts = [...points].sort((a, b) => a.index - b.index);
  let dPath = "";
  sortedPts.forEach((pt, i) => {
    const x = xFor(pt.index);
    const y = yFor(pt.value);
    dPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    p,
    y: PAD_T + (1 - p) * chartH,
    v: Math.round(maxV * p),
  }));

  const lastYMD = domainDays[domainDays.length - 1];
  const monthStarts: { ymd: string; label: string }[] = [];
  for (let i = 3; i >= 0; i--) {
    const ymd = addMonthsYMD(lastYMD.slice(0, 8) + "01", -i);
    monthStarts.push({ ymd, label: monthAbbrevFromYMD(ymd) });
  }
  const firstDomain = domainDays[0];
  const dayIndexOf = (ymd: string) =>
    Math.max(0, Math.min(nDomain - 1, daysBetweenYMD(firstDomain, ymd)));

  return (
    <View>
      <Svg width={contentW} height={H}>
        {ticks.map((t, i) => (
          <SvgLine key={`grid-${i}`} x1={PAD_L} y1={t.y} x2={contentW - PAD_R} y2={t.y} stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {ticks.map((t, i) => (
          <SvgText key={`yl-${i}`} x={PAD_L - 8} y={t.y} fill="#6b7280" fontSize="10" textAnchor="end" alignmentBaseline="middle">
            {t.v}
          </SvgText>
        ))}
        {ticks.map((t, i) => (
          <SvgText key={`yr-${i}`} x={contentW - PAD_R + 8} y={t.y} fill="#6b7280" fontSize="10" textAnchor="start" alignmentBaseline="middle">
            {t.v}
          </SvgText>
        ))}
        {sortedPts.length > 0 && <Path d={dPath} stroke={color} strokeWidth={2} fill="none" />}
        {sortedPts.map((pt, i) => (
          <Circle key={`dot-${i}`} cx={xFor(pt.index)} cy={yFor(pt.value)} r={2.5} fill={color} />
        ))}
        {monthStarts.map((m, i) => {
          const idx = dayIndexOf(m.ymd);
          return (
            <SvgText key={`m-${i}-${m.ymd}`} x={PAD_L + idx * STEP} y={H - 10} fill="#6b7280" fontSize="11" textAnchor="middle">
              {m.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

/* ===== Small UI: Category Chip ===== */
const CategoryChip = ({ value }: { value: string | null | undefined }) => (
  <View
    style={{
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: "#f3f4f6",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#e5e7eb",
    }}
  >
    <Text style={{ fontSize: 12, color: "#111" }}>{value && value.trim().length ? value : "—"}</Text>
  </View>
);

/* ===== Small UI bits reused in Edit Modal ===== */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#eee",
      }}
    >
      {children}
    </View>
  );
}
function SectionTitle({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <Ionicons name={icon} size={18} />
      <Text style={{ fontWeight: "800", fontSize: 16 }}>{title}</Text>
    </View>
  );
}
function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        style={inputStyle}
      />
    </View>
  );
}
function NumberBox({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^\d-]/g, ""))}
        keyboardType="numeric"
        placeholder="0"
        style={inputStyle}
      />
    </View>
  );
}
function SmallButton({
  label,
  onPress,
  icon,
  variant = "dark",
}: {
  label: string;
  onPress: () => void;
  icon?: any;
  variant?: "dark" | "light";
}) {
  const dark = variant === "dark";
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: dark ? "#111827" : "#f3f4f6",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={dark ? "#fff" : "#111827"} />
      ) : null}
      {label ? (
        <Text style={{ color: dark ? "#fff" : "#111827", fontWeight: "700" }}>{label}</Text>
      ) : null}
    </TouchableOpacity>
  );
}
function ToggleButton({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "#111827" : "#e5e7eb",
        backgroundColor: active ? "#111827" : "#fff",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={active ? "#fff" : "#111827"} />
      ) : null}
      <Text style={{ fontWeight: "800", color: active ? "#fff" : "#111827" }}>{label}</Text>
    </TouchableOpacity>
  );
}
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#eef2ff",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#dbeafe",
        }}
      >
        <Ionicons name="close" size={14} />
      </TouchableOpacity>
    </View>
  );
}
function RemovablePill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#e5e7eb",
        }}
      >
        <Ionicons name="close" size={14} />
      </TouchableOpacity>
    </View>
  );
}
const inputStyle = {
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 10,
  backgroundColor: "#fff",
} as const;

/* ===================== EDIT MODAL ===================== */
type Mode = "unscheduled" | "scheduled";
function asSevenDays(schedules?: Schedule[] | null): Schedule[] {
  const base = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, times: [] as string[] }));
  if (!Array.isArray(schedules)) return base;
  const byDay: Record<number, string[]> = {};
  schedules.forEach((r) => {
    const d = Number(r.dayOfWeek);
    if (!byDay[d]) byDay[d] = [];
    (r.times || []).forEach((t) => byDay[d].push(t));
  });
  return base.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    times: (byDay[row.dayOfWeek] || []).slice().sort((a, b) => a.localeCompare(b)),
  }));
}
function sortTimes(arr: string[]) {
  return arr.slice().sort((a, b) => {
    const [ah, am] = a.split(":").map((n) => parseInt(n, 10));
    const [bh, bm] = b.split(":").map((n) => parseInt(n, 10));
    return ah === bh ? am - bm : ah - bh;
  });
}
function unique(arr: string[]) {
  const seen = new Set<string>();
  return arr.filter((t) => {
    const k = t.trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function EditTaskTypeModal({
  visible,
  initial,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initial: TaskType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined;
  const keyboardOffset = Math.max(0, insets.top - 6);

  // Prefill from initial
  const [mode, setMode] = useState<Mode>(() =>
    (initial?.schedules?.length ?? 0) > 0 ? "scheduled" : "unscheduled"
  );
  const [name, setName] = useState<string>(initial?.name ?? "");
  const [trackBy, setTrackBy] = useState<string>(initial?.trackBy ?? initial?.trackby ?? "");
  const [useDefaultAmount, setUseDefaultAmount] = useState<boolean>(
    Number.isFinite(Number((initial as any)?.defaultAmount ?? (initial as any)?.defaultamount))
  );
  const [defaultAmount, setDefaultAmount] = useState<string>(() => {
    const raw = (initial as any)?.defaultAmount ?? (initial as any)?.defaultamount;
    return raw == null ? "" : String(raw);
  });
  const [categories, setCategories] = useState<string[]>(
    Array.isArray(initial?.categories) ? (initial!.categories as string[]) : []
  );
  const [categoryDraft, setCategoryDraft] = useState("");
  const [yearlyGoal, setYearlyGoal] = useState<string>(String(initial?.yearlyGoal ?? 0));
  const [monthlyGoal, setMonthlyGoal] = useState<string>(String(initial?.monthlyGoal ?? 0));
  const [weeklyGoal, setWeeklyGoal] = useState<string>(String(initial?.weeklyGoal ?? 0));
  const [dailyGoal, setDailyGoal] = useState<string>(String(initial?.dailyGoal ?? 0));
  const [priority, setPriority] = useState<number>(Number(initial?.priority ?? 1));
  const [schedules, setSchedules] = useState<Schedule[]>(asSevenDays(initial?.schedules));
  const [timeDraftByDay, setTimeDraftByDay] = useState<Record<number, string>>({});

  const [busy, setBusy] = useState(false);

  // When initial changes (first open), reset fields
  useEffect(() => {
    if (!initial) return;
    setMode((initial?.schedules?.length ?? 0) > 0 ? "scheduled" : "unscheduled");
    setName(initial?.name ?? "");
    setTrackBy(initial?.trackBy ?? initial?.trackby ?? "");
    const raw = (initial as any)?.defaultAmount ?? (initial as any)?.defaultamount;
    setUseDefaultAmount(Number.isFinite(Number(raw)));
    setDefaultAmount(raw == null ? "" : String(raw));
    setCategories(Array.isArray(initial?.categories) ? (initial!.categories as string[]) : []);
    setYearlyGoal(String(initial?.yearlyGoal ?? 0));
    setMonthlyGoal(String(initial?.monthlyGoal ?? 0));
    setWeeklyGoal(String(initial?.weeklyGoal ?? 0));
    setDailyGoal(String(initial?.dailyGoal ?? 0));
    setPriority(Number(initial?.priority ?? 1));
    setSchedules(asSevenDays(initial?.schedules));
    setTimeDraftByDay({});
  }, [initial]);

  function addCategory() {
    const v = categoryDraft.trim();
    if (!v) return;
    if (categories.find((c) => c.toLowerCase() === v.toLowerCase())) {
      setCategoryDraft("");
      return;
    }
    setCategories((prev) => [...prev, v]);
    setCategoryDraft("");
  }
  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }
  function setDayTimeDraft(day: number, val: string) {
    setTimeDraftByDay((prev) => ({ ...prev, [day]: val }));
  }
  function addTimeToDay(day: number) {
    const draft = (timeDraftByDay[day] || "").trim();
    if (!HHMM_RE.test(draft)) {
      Alert.alert("Invalid time", "Use 24-hour HH:MM, e.g. 07:30 or 18:00.");
      return;
    }
    setSchedules((prev) => {
      const next = prev.map((row) =>
        row.dayOfWeek === day
          ? { ...row, times: sortTimes(unique([...row.times, draft])) }
          : row
      );
      return next;
    });
    setDayTimeDraft(day, "");
  }
  function removeTimeFromDay(day: number, idx: number) {
    setSchedules((prev) =>
      prev.map((row) =>
        row.dayOfWeek === day ? { ...row, times: row.times.filter((_, i) => i !== idx) } : row
      )
    );
  }
  function cleanSchedulesOut(): Schedule[] {
    const filtered = schedules
      .map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        times: sortTimes(row.times.filter((t) => HHMM_RE.test(t))),
      }))
      .filter((row) => row.times.length > 0);
    return mode === "scheduled" ? filtered : [];
  }

  async function onSubmit() {
    try {
      if (!initial?.id) {
        Alert.alert("Missing id", "Cannot update without a task type id.");
        return;
      }
      if (name.trim().length < 2) {
        Alert.alert("Name required", "Please enter a name (at least 2 characters).");
        return;
      }
      if (!trackBy.trim()) {
        Alert.alert("Track By required", "Please enter how you track this (e.g., count, duration).");
        return;
      }
      const schedulesOut = cleanSchedulesOut();
      if (mode === "scheduled" && schedulesOut.length === 0) {
        Alert.alert("Schedule required", "Add at least one time or switch to Unscheduled Loop.");
        return;
      }

      const payload: any = {
        name: name.trim(),
        schedules: schedulesOut,
        priority: Number(priority) || 1,
        trackBy: trackBy.trim(),
        categories,
        yearlyGoal: Number(yearlyGoal || 0),
        monthlyGoal: Number(monthlyGoal || 0),
        weeklyGoal: Number(weeklyGoal || 0),
        dailyGoal: Number(dailyGoal || 0),
        is_active: initial.is_active ?? true,
      };
      if (useDefaultAmount && defaultAmount.trim() !== "") {
        const n = Number(defaultAmount);
        if (!Number.isFinite(n)) {
          Alert.alert("Invalid default amount", "Enter a valid number.");
          return;
        }
        payload.defaultAmount = n;
      } else {
        payload.defaultAmount = null;
      }

      setBusy(true);
      const url = `${API_URL.replace(/\/$/, "")}/taskType/${encodeURIComponent(String(initial.id))}`;
      // IMPORTANT: match your backend route which uses PATCH
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        let msg = bodyText || `HTTP ${res.status}`;
        try {
          const j = JSON.parse(bodyText);
          msg = j.message || msg;
        } catch {}
        throw new Error(msg);
      }

      Alert.alert("Saved", "Task type updated.");
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={keyboardBehavior} keyboardVerticalOffset={keyboardOffset} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#f6f7fb", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "92%" }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Edit Task Type</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
              {/* Mode toggle */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <ToggleButton
                  label="Unscheduled Loop"
                  active={mode === "unscheduled"}
                  onPress={() => setMode("unscheduled")}
                  icon="infinite-outline"
                />
                <ToggleButton
                  label="Scheduled"
                  active={mode === "scheduled"}
                  onPress={() => setMode("scheduled")}
                  icon="time-outline"
                />
              </View>

              <Card>
                <SectionTitle icon="create-outline" title="Basics" />
                <LabeledInput label="Name" placeholder="e.g., Gym, Drink Water" value={name} onChangeText={setName} />
                <LabeledInput label="Track By" placeholder="e.g., count, duration, pages" value={trackBy} onChangeText={setTrackBy} />

                {/* Default Amount toggle + input */}
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>Default Amount</Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <SmallButton
                      label={useDefaultAmount ? "On" : "Off"}
                      onPress={() => setUseDefaultAmount((v) => !v)}
                      variant={useDefaultAmount ? "dark" : "light"}
                      icon={useDefaultAmount ? "toggle" : "toggle-outline"}
                    />
                    {useDefaultAmount && (
                      <TextInput value={defaultAmount} onChangeText={setDefaultAmount} placeholder="0" keyboardType="numeric" style={inputStyle} />
                    )}
                  </View>
                </View>

                {/* Categories chips */}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>Categories</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={categoryDraft}
                      onChangeText={setCategoryDraft}
                      placeholder="Type a category and press Add"
                      style={[inputStyle, { flex: 1 }]}
                    />
                    <SmallButton label="Add" onPress={addCategory} icon="add" />
                  </View>
                  {categories.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {categories.map((c, idx) => (
                        <Chip key={`${c}-${idx}`} label={c} onRemove={() => removeCategory(idx)} />
                      ))}
                    </View>
                  )}
                </View>

                {/* Goals */}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>Goals</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <NumberBox label="Yearly" value={yearlyGoal} onChangeText={setYearlyGoal} />
                    <NumberBox label="Monthly" value={monthlyGoal} onChangeText={setMonthlyGoal} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <NumberBox label="Weekly" value={weeklyGoal} onChangeText={setWeeklyGoal} />
                    <NumberBox label="Daily" value={dailyGoal} onChangeText={setDailyGoal} />
                  </View>
                </View>
              </Card>

              {mode === "scheduled" && (
                <>
                  <Card>
                    <SectionTitle icon="flag-outline" title="Priority" />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <SmallButton label="" onPress={() => setPriority((p) => Math.max(1, p - 1))} icon="remove-outline" variant="light" />
                      <Text style={{ fontWeight: "800", fontSize: 20 }}> {priority} </Text>
                      <SmallButton label="" onPress={() => setPriority((p) => Math.min(10, p + 1))} icon="add-outline" variant="light" />
                      <Text style={{ opacity: 0.6 }}>(1 = highest)</Text>
                    </View>
                  </Card>

                  <Card>
                    <SectionTitle icon="calendar-outline" title="Schedule" />
                    <Text style={{ opacity: 0.7, marginBottom: 8 }}>
                      Add one or more HH:MM times to any days you want.
                    </Text>
                    {schedules.map((row) => (
                      <View
                        key={row.dayOfWeek}
                        style={{
                          borderWidth: 1,
                          borderColor: "#eee",
                          borderRadius: 12,
                          padding: 10,
                          marginBottom: 10,
                          backgroundColor: "#fafafa",
                        }}
                      >
                        <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                          {DAY_NAMES[row.dayOfWeek]}
                        </Text>

                        {/* existing times */}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {row.times.length === 0 ? (
                            <Text style={{ opacity: 0.5 }}>No times</Text>
                          ) : (
                            row.times.map((t, idx) => (
                              <RemovablePill key={`${row.dayOfWeek}-${t}-${idx}`} label={t} onRemove={() => removeTimeFromDay(row.dayOfWeek, idx)} />
                            ))
                          )}
                        </View>

                        {/* add time */}
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <TextInput
                            value={timeDraftByDay[row.dayOfWeek] || ""}
                            onChangeText={(v) => setDayTimeDraft(row.dayOfWeek, v)}
                            placeholder="HH:MM"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[inputStyle, { flex: 1 }]}
                          />
                          <SmallButton label="Add" onPress={() => addTimeToDay(row.dayOfWeek)} icon="add" />
                        </View>
                      </View>
                    ))}
                  </Card>
                </>
              )}

              <TouchableOpacity
                onPress={onSubmit}
                disabled={busy}
                style={{
                  marginTop: 4,
                  marginBottom: Math.max(14, insets.bottom + 8),
                  backgroundColor: busy ? "#e5e7eb" : "#111827",
                  paddingVertical: 14,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={{ color: "#fff", fontWeight: "800" }}>{busy ? "Saving…" : "Save Changes"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ===================== PAGE ===================== */
export default function TaskTypeHeatmap() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [typeData, setTypeData] = useState<TaskType | null>(null);

  // Add Log modal state
  const [showAdd, setShowAdd] = useState(false);
  const TODAY = useMemo(() => todayYMDInTZ(TZ), []);
  const [formDate, setFormDate] = useState<string>(TODAY);
  const [formAmount, setFormAmount] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");

  // View Log modal state
  const [viewing, setViewing] = useState<Item | null>(null);

  // NEW: Edit modal state
  const [showEdit, setShowEdit] = useState(false);

  // Refs for auto-scroll behavior inside Add modal
  const formScrollRef = useRef<ScrollView | null>(null);
  const [focusedKey, setFocusedKey] = useState<"date" | "amount" | "desc" | null>(null);

  // NEWEST → OLDEST years
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y - 3];
  }, []);
  const currentYear = years[0];

  const fetchType = useCallback(async () => {
    const resType = await fetch(`${API_URL}/taskType/${encodeURIComponent(String(id))}`);
    if (!resType.ok) throw new Error(`Type HTTP ${resType.status}`);
    const dataType = await resType.json();
    setTypeData(dataType as TaskType);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [resItems] = await Promise.all([
          fetch(`${API_URL}/taskItem/type/${encodeURIComponent(String(id))}`),
        ]);
        if (!resItems.ok) throw new Error(`Items HTTP ${resItems.status}`);
        const dataItems = await resItems.json();
        const sorted = (Array.isArray(dataItems) ? dataItems : []).slice().sort(
          (a: Item, b: Item) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        );
        setItems(sorted);
        await fetchType();
      } catch (e: any) {
        setError(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fetchType]);

  // Palette
  const COLORS = useMemo(() => pickPalette(typeData), [typeData]);
  const PROGRESS_COLOR = COLORS[3];

  // DAILY TOTALS
  const dailyTotals = useMemo(() => {
    const t: Record<string, number> = {};
    if (!items?.length) return t;
    const oldestYear = years[years.length - 1];
    const minDate = jan1Y(oldestYear);
    const defAmt = typeData ? pickNumber(typeData, "defaultAmount", "defaultamount", 0) : 0;

    for (const it of items) {
      const key = toDateKeyInTZ(it.created_at, TZ);
      if (key < minDate) continue;
      const add =
        it.amount === null || it.amount === undefined || (it as any).amount === ""
          ? defAmt
          : numOr(it.amount, 0);
      t[key] = (t[key] ?? 0) + add;
    }
    return t;
  }, [items, years, typeData]);

  // Streak
  const streak = useMemo(() => {
    let pos = 0;
    let d = TODAY;
    while ((dailyTotals[d] ?? 0) > 0) {
      pos += 1;
      d = addDaysYMD(d, -1);
    }
    if (pos > 0) return pos;

    let lastActive: string | null = null;
    for (const key of Object.keys(dailyTotals)) {
      if (key <= TODAY && (dailyTotals[key] ?? 0) > 0) {
        if (!lastActive || key > lastActive) lastActive = key;
      }
    }
    if (!lastActive) return 0;
    const daysSince = daysBetweenYMD(lastActive, TODAY);
    return daysSince >= 1 ? -daysSince : 0;
  }, [TODAY, dailyTotals]);

  // Visible years
  const visibleYears = useMemo(() => {
    const hasDataForYear = (year: number) =>
      Object.entries(dailyTotals).some(([k, v]) => k.startsWith(`${year}-`) && (v ?? 0) > 0);
    return years.filter((y) => y === currentYear || hasDataForYear(y));
  }, [years, currentYear, dailyTotals]);

  // Quantiles from visible years only
  const q = useMemo(() => {
    const vals: number[] = [];
    for (const [k, v] of Object.entries(dailyTotals)) {
      const y = parseInt(k.slice(0, 4), 10);
      if (visibleYears.includes(y)) vals.push(v);
    }
    return computeQuantiles(vals);
  }, [dailyTotals, visibleYears]);

  /* ====== Progress wheels ====== */
  const progressData = useMemo(() => {
    const today = TODAY;
    const [y, m] = [parseInt(today.slice(0, 4), 10), parseInt(today.slice(5, 7), 10)];
    const dow = dayOfWeekYMD(today);
    const weekStart = addDaysYMD(today, -dow);
    const monthStart = `${String(y)}-${String(m).padStart(2, "0")}-01`;
    const yearStart = `${String(y)}-01-01`;

    const daily = dailyTotals[today] ?? 0;
    const weekly = sumRange(dailyTotals, weekStart, today);
    const monthly = sumRange(dailyTotals, monthStart, today);
    const yearly = sumRange(dailyTotals, yearStart, today);

    const goals = {
      daily: typeData ? pickNumber(typeData, "dailyGoal", "dailygoal", 0) : 0,
      weekly: typeData ? pickNumber(typeData, "weeklyGoal", "weeklygoal", 0) : 0,
      monthly: typeData ? pickNumber(typeData, "monthlyGoal", "monthlygoal", 0) : 0,
      yearly: typeData ? pickNumber(typeData, "yearlyGoal", "yearlygoal", 0) : 0,
    };

    const mk = (value: number, goal: number) => {
      const g = Math.max(0, goal);
      const pct = g > 0 ? value / g : 0;
      const clampedPct = Math.min(1, Math.max(0, pct));
      const fraction = g > 0 ? `${value}/${g}` : `${value}`;
      return { value, goal: g, pct: clampedPct, fraction };
    };

    return {
      daily: mk(daily, goals.daily),
      weekly: mk(weekly, goals.weekly),
      monthly: mk(monthly, goals.monthly),
      yearly: mk(yearly, goals.yearly),
    };
  }, [TODAY, dailyTotals, typeData]);

  /* ====== Domain & Points ====== */
  const domainDays = useMemo(() => {
    const start = addMonthsYMD(TODAY, -4);
    const arr: string[] = [];
    let cur = start;
    while (cur <= TODAY) {
      arr.push(cur);
      cur = addDaysYMD(cur, 1);
    }
    return arr;
  }, [TODAY]);

  const dailyPoints = useMemo(() => {
    const pts: { index: number; value: number; ymd: string }[] = [];
    domainDays.forEach((d, idx) => {
      const v = dailyTotals[d] ?? 0;
      if (v > 0) pts.push({ index: idx, value: v, ymd: d });
    });
    return pts;
  }, [domainDays, dailyTotals]);

  /* ====== Color bucketing for heatmap ====== */
  const colorForAmount = (amount: number) => {
    if (!amount || amount <= 0) return COLORS[0];
    const { q25, q50, q75 } = q;
    if (amount <= q25) return COLORS[1];
    if (amount <= q50) return COLORS[2];
    if (amount <= q75) return COLORS[3];
    return COLORS[4];
  };

  /* ====== Logs helpers ====== */
  const fmtDateInTZ = (ts: string) => {
    const looksNaive = ts && /\d{2}:\d{2}:\d{2}/.test(ts) && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(ts);
    const iso = looksNaive ? `${ts}Z` : ts;
    const d = new Date(iso);
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      return `${get("weekday")} ${get("month")} ${get("day")}, ${get("year")}`.trim();
    } catch {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
        .format(d)
        .replace(/\s*\(.*?\)\s*$/, "");
    }
  };

  const refreshItems = async () => {
    const res = await fetch(`${API_URL}/taskItem/type/${encodeURIComponent(String(id))}`);
    const data = await res.json();
    const sorted = (Array.isArray(data) ? data : []).slice().sort(
      (a: Item, b: Item) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    );
    setItems(sorted);
  };

  const onDelete = async (itemId: number) => {
    try {
      const res = await fetch(`${API_URL}/taskItem/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshItems();
      if (viewing?.id === itemId) setViewing(null);
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message || "Please try again.");
    }
  };

  const onAddLog = async () => {
    try {
      const amountNum = formAmount.trim() === "" ? null : Number(formAmount);
      if (formAmount.trim() !== "" && !Number.isFinite(amountNum as number)) {
        Alert.alert("Invalid amount", "Please enter a number or leave blank.");
        return;
      }

      // Include taskTypeID (required) and the task type's name so the item.name is set
      const payload: any = {
        taskTypeID: Number(id),
        name: typeData?.name ?? (typeof name === "string" && name.length ? name : null),
        amount: amountNum,
        description: formDesc.trim() ? formDesc.trim() : null,
        created_at: `${formDate}T12:00:00Z`,
      };

      const res = await fetch(`${API_URL}/taskItem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const t = await res.text();
          const j = JSON.parse(t);
          msg = j.message || t || msg;
        } catch {}
        throw new Error(msg);
      }

      setShowAdd(false);
      setFormDate(TODAY);
      setFormAmount("");
      setFormDesc("");
      await refreshItems();
    } catch (e: any) {
      Alert.alert("Add failed", e?.message || "Please try again.");
    }
  };

  const hasTypeCategories = Array.isArray(typeData?.categories) && (typeData?.categories?.length ?? 0) > 0;

  /* ===================== RENDER ===================== */
  const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined;
  const keyboardOffset = Math.max(0, insets.top - 6);

  if (!id) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Missing task type id.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Title row with Edit button */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 20, fontWeight: "700" }}>
            {typeof name === "string" && name.length ? name : typeData?.name || "Task Type"}
          </Text>
          <TouchableOpacity
            onPress={() => setShowEdit(true)}
            disabled={!typeData}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: typeData ? "#111827" : "#e5e7eb",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800" }}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Streak */}
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 14, color: "#666" }}>Current streak:</Text>
          {(() => {
            const c = streak > 0 ? "#16a34a" : streak < 0 ? "#b91c1c" : "#666";
            return <Text style={{ fontSize: 22, fontWeight: "900", color: c }}>{streak}</Text>;
          })()}
          <Text style={{ fontSize: 14, color: "#666" }}>
            day{Math.abs(streak) === 1 ? "" : "s"}
          </Text>
        </View>

        {loading && (
          <View style={{ marginTop: 16 }}>
            <ActivityIndicator />
          </View>
        )}
        {error && <Text style={{ color: "red", marginTop: 12 }}>{error}</Text>}

        {!loading && !error && (
          <>
            {/* Wheels */}
            <View
              style={{
                marginTop: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <CircularProgress label="Daily" fractionText={progressData.daily.fraction} progress={progressData.daily.pct} color={PROGRESS_COLOR} />
              <CircularProgress label="Weekly" fractionText={progressData.weekly.fraction} progress={progressData.weekly.pct} color={PROGRESS_COLOR} />
              <CircularProgress label="Monthly" fractionText={progressData.monthly.fraction} progress={progressData.monthly.pct} color={PROGRESS_COLOR} />
              <CircularProgress label="Yearly" fractionText={progressData.yearly.fraction} progress={progressData.yearly.pct} color={PROGRESS_COLOR} />
            </View>

            {/* Daily totals line chart */}
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 8 }}>
                Daily totals (last 4 months)
              </Text>
              <DailyLineChart points={dailyPoints} domainDays={domainDays} color={COLORS[4]} />
            </View>
          </>
        )}

        {/* Legend */}
        {!loading && !error && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8 }}>
            <Text style={{ color: "#666", marginRight: 8 }}>Less</Text>
            {COLORS.map((c, i) => (
              <View
                key={i}
                style={{
                  width: CELL,
                  height: CELL,
                  backgroundColor: c,
                  marginRight: GAP,
                  borderRadius: 3,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              />
            ))}
            <Text style={{ color: "#666", marginLeft: 8 }}>More</Text>
          </View>
        )}

        {/* Heatmap */}
        {!loading && !error &&
          visibleYears.map((year) => {
            const { weeks } = buildYearWeeks(year, dailyTotals);
            const weeksDesc = weeks.slice().reverse(); // newest on LEFT
            const cols = weeksDesc.length;
            const segments = buildMonthSegments(year, weeksDesc);
            const WEEK_COL_W = CELL + WEEK_GAP;

            return (
              <View key={year} style={{ marginTop: 20 }}>
                <Text style={{ fontWeight: "700", marginBottom: 8 }}>{year}</Text>

                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  {/* Left gutter: S M T W T F S */}
                  <View style={{ width: LEFT_GUTTER, marginRight: 6 }}>
                    {DAY_SINGLE.map((d, i) => (
                      <View
                        key={i}
                        style={{ height: CELL, marginBottom: GAP, alignItems: "flex-end", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 10, color: "#666" }}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Month header + grid */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      {/* Month header */}
                      <View style={{ flexDirection: "row", height: 16 }}>
                        {segments.length === 0
                          ? weeksDesc.map((_, wi) => (
                              <View key={`mh-${wi}`} style={{ width: CELL, marginRight: wi === cols - 1 ? 0 : WEEK_GAP }} />
                            ))
                          : segments.map((seg, si) => (
                              <View
                                key={`seg-${si}`}
                                style={{
                                  width: seg.span * WEEK_COL_W - WEEK_GAP,
                                  marginRight: WEEK_GAP,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ fontSize: 10, color: "#555" }}>{seg.label}</Text>
                              </View>
                            ))}
                      </View>

                      {/* Grid */}
                      <View style={{ flexDirection: "row" }}>
                        {weeksDesc.map((week, wi) => (
                          <View key={wi} style={{ marginRight: wi === cols - 1 ? 0 : WEEK_GAP, flexDirection: "column" }}>
                            {week.map((cell, di) => {
                              if (!cell) {
                                return <View key={di} style={{ width: CELL, height: CELL, marginBottom: GAP }} />;
                              }
                              const bg = colorForAmount(cell.amount);
                              const isToday = cell.ymd === TODAY;
                              return (
                                <TouchableOpacity
                                  key={cell.ymd}
                                  activeOpacity={0.8}
                                  onPress={() => console.log(`${cell.ymd}: ${cell.amount ?? 0}`)}
                                  style={{
                                    width: CELL,
                                    height: CELL,
                                    marginBottom: GAP,
                                    backgroundColor: bg,
                                    borderRadius: 3,
                                    borderWidth: isToday ? 2 : 1,
                                    borderColor: isToday ? "#000" : "#e5e7eb",
                                    opacity: cell.outside ? OUTSIDE_OPACITY : 1,
                                  }}
                                />
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </View>
              </View>
            );
          })}

        {/* ===== Logs (scrolling list) ===== */}
        {!loading && !error && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Logs</Text>
            <View style={{ maxHeight: 320, borderWidth: 1, borderColor: "#eee", borderRadius: 12, overflow: "hidden" }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {items.length === 0 ? (
                  <Text style={{ padding: 12, color: "#666" }}>No logs yet.</Text>
                ) : (
                  items.map((it) => {
                    const showCategory = hasTypeCategories;
                    return (
                      <View
                        key={it.id}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: "#f1f1f1",
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        {/* Tappable area to view full text */}
                        <TouchableOpacity
                          onPress={() => setViewing(it)}
                          activeOpacity={0.7}
                          style={{ flex: 1, paddingRight: 10 }}
                        >
                          <Text style={{ fontWeight: "700" }}>{fmtDateInTZ(it.created_at)}</Text>
                          <Text style={{ color: "#333", marginTop: 2 }}>
                            Amount: {it.amount == null ? "—" : numOr(it.amount).toString()}
                          </Text>

                          {showCategory && (
                            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={{ color: "#666" }}>Category:</Text>
                              <CategoryChip value={it.taskcategory} />
                            </View>
                          )}

                          {it.description ? (
                            <Text style={{ color: "#666", marginTop: 4 }} numberOfLines={2}>
                              {it.description}
                            </Text>
                          ) : (
                            <Text style={{ color: "#999", marginTop: 4, fontStyle: "italic" }}>
                              No description
                            </Text>
                          )}
                        </TouchableOpacity>

                        {/* Delete button */}
                        <TouchableOpacity
                          onPress={() => onDelete(it.id)}
                          style={{
                            backgroundColor: "#fee2e2",
                            padding: 8,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="trash" size={18} color="#b91c1c" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating + button */}
      <TouchableOpacity
        onPress={() => {
          setFormDate(TODAY);
          setFormAmount("");
          setFormDesc("");
          setShowAdd(true);
        }}
        style={{
          position: "absolute",
          right: 16,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: PROGRESS_COLOR,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Log Modal (keyboard-safe + auto-scroll to focused input) */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={keyboardBehavior} keyboardVerticalOffset={keyboardOffset} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: "90%",
              }}
            >
              {/* Header */}
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 18, fontWeight: "800" }}>Add Log</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Ionicons name="close" size={24} color="#111" />
                </TouchableOpacity>
              </View>

              {/* Scrollable content */}
              <ScrollView
                ref={formScrollRef}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 16 + Math.max(16, insets.bottom) + 84, // room for footer button
                }}
                onContentSizeChange={() => {
                  if (focusedKey === "desc") {
                    requestAnimationFrame(() => {
                      formScrollRef.current?.scrollToEnd({ animated: true });
                    });
                  }
                }}
              >
                <View style={{ marginTop: 4 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 6 }}>Date (YYYY-MM-DD)</Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <TextInput
                      value={formDate}
                      onFocus={() => setFocusedKey("date")}
                      onBlur={() => setFocusedKey((k) => (k === "date" ? null : k))}
                      onChangeText={(t) => setFormDate(t)}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: "#ddd",
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        backgroundColor: "#fff",
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setFormDate(TODAY)}
                      style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#f3f4f6", borderRadius: 8 }}
                    >
                      <Text style={{ fontWeight: "700" }}>Today</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 6 }}>Amount</Text>
                  <TextInput
                    value={formAmount}
                    onFocus={() => setFocusedKey("amount")}
                    onBlur={() => setFocusedKey((k) => (k === "amount" ? null : k))}
                    onChangeText={(t) => setFormAmount(t.replace(/[^\d.\-]/g, ""))}
                    keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric" }) as any}
                    returnKeyType="done"
                    placeholder="e.g., 1"
                    style={{
                      borderWidth: 1,
                      borderColor: "#ddd",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fff",
                    }}
                  />
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 6 }}>Description (optional)</Text>
                  <TextInput
                    value={formDesc}
                    onFocus={() => {
                      setFocusedKey("desc");
                      requestAnimationFrame(() => {
                        formScrollRef.current?.scrollToEnd({ animated: true });
                      });
                    }}
                    onBlur={() => setFocusedKey((k) => (k === "desc" ? null : k))}
                    onChangeText={setFormDesc}
                    placeholder="Notes..."
                    multiline
                    textAlignVertical="top"
                    returnKeyType="default"
                    style={{
                      minHeight: 120,
                      borderWidth: 1,
                      borderColor: "#ddd",
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      backgroundColor: "#fff",
                    }}
                  />
                </View>
              </ScrollView>

              {/* Fixed footer */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: Math.max(14, insets.bottom + 12),
                  backgroundColor: "#fff",
                  borderTopWidth: 1,
                  borderTopColor: "#eee",
                }}
              >
                <TouchableOpacity
                  onPress={onAddLog}
                  style={{
                    backgroundColor: "#111827",
                    paddingVertical: 14,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Save Log</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Log Modal (tap a row to open) */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", maxHeight: "80%" }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Log Details</Text>
              <TouchableOpacity onPress={() => setViewing(null)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {viewing && (
                <>
                  <Text style={{ fontWeight: "700", marginBottom: 4 }}>{fmtDateInTZ(viewing.created_at)}</Text>
                  <Text style={{ color: "#333", marginBottom: 8 }}>
                    Amount: {viewing.amount == null ? "—" : numOr(viewing.amount).toString()}
                  </Text>

                  {hasTypeCategories && (
                    <>
                      <Text style={{ fontWeight: "700", marginBottom: 6 }}>Category</Text>
                      <CategoryChip value={viewing.taskcategory} />
                      <View style={{ height: 12 }} />
                    </>
                  )}

                  <Text style={{ fontWeight: "700", marginBottom: 6 }}>Description</Text>
                  <Text selectable style={{ color: "#111", lineHeight: 20 }}>
                    {viewing.description && viewing.description.trim().length > 0
                      ? viewing.description
                      : "No description."}
                  </Text>
                </>
              )}
            </ScrollView>

            {/* Footer actions */}
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: "#eee", flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              {viewing && (
                <TouchableOpacity
                  onPress={() => onDelete(viewing.id)}
                  style={{ backgroundColor: "#fee2e2", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="trash" size={16} color="#b91c1c" />
                  <Text style={{ color: "#b91c1c", fontWeight: "700" }}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setViewing(null)}
                style={{ backgroundColor: "#111827", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Task Type Modal */}
      <EditTaskTypeModal
        visible={showEdit}
        initial={typeData}
        onClose={() => setShowEdit(false)}
        onSaved={async () => {
          await fetchType();
        }}
      />
    </View>
  );
}
