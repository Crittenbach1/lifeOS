// app/(root)/task-type/health.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { API_URL } from "@/constants/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";

/* ===================== CONFIG ===================== */
const TZ = "America/New_York";

/* ===================== TYPES ===================== */
type TaskType = {
  id: number | string;
  user_id: string;
  name: string;
  schedules?: { dayOfWeek: number; times: string[] }[] | null;
  dailyGoal?: number | null;
  weeklyGoal?: number | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: any; // allow lowercase keys from DB
};

type Item = {
  id: number;
  tasktypeid: number;
  name: string | null;
  amount: number | null;
  description: string | null;
  taskcategory: string | null;
  created_at: string;
};

/* ===================== DATE HELPERS ===================== */
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
function daysBetweenYMD(a: string, b: string): number {
  const da = ymdToDateUTC(a).getTime();
  const db = ymdToDateUTC(b).getTime();
  return Math.floor((db - da) / (1000 * 60 * 60 * 24));
}

/* ===================== HEALTH COLORS ===================== */
function colorForPct(p: number) {
  if (p >= 0.75) return "#ef4444"; // red-500
  if (p >= 0.5) return "#f59e0b"; // amber-500
  return "#22c55e"; // green-500
}

/* ===================== PAGE ===================== */
export default function TaskTypeHealth() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [itemsByType, setItemsByType] = useState<Record<string, Item[]>>({});

  const TODAY = useMemo(() => todayYMDInTZ(TZ), []);

  const load = useCallback(async () => {
    if (!API_URL) return;
    setError(null);
    setLoading(true);
    try {
      // fetch task types (by user first, then fallback)
      let types: TaskType[] = [];
      const tryUrls = [
        user?.id ? `${API_URL}/taskType/user/${encodeURIComponent(user.id)}` : "",
        `${API_URL}/taskType`,
      ].filter(Boolean);

      let fetched = false;
      for (const url of tryUrls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            types = Array.isArray(data) ? data : [];
            fetched = true;
            break;
          }
        } catch {}
      }
      if (!fetched) throw new Error("Failed to load task types");

      // fetch items per type — tuple typed so fallbacks aren't readonly
      const entries: Array<[string, Item[]]> = await Promise.all(
        types.map(async (tt): Promise<[string, Item[]]> => {
          try {
            const res = await fetch(
              `${API_URL}/taskItem/type/${encodeURIComponent(String(tt.id))}`
            );
            const arr = (res.ok ? await res.json() : []) as unknown[];
            const items: Item[] = Array.isArray(arr) ? (arr as Item[]) : ([] as Item[]);
            items.sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return [String(tt.id), items];
          } catch {
            return [String(tt.id), [] as Item[]];
          }
        })
      );

      const map: Record<string, Item[]> = Object.fromEntries(entries);

      setTaskTypes(types);
      setItemsByType(map);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false); // <- fixed: no parentheses
  }, [load]);

  /* Build raw starvation info (days since last log). */
  const raw = useMemo(() => {
    type Row = {
      id: string;
      name: string;
      daysSince: number | null; // null = Never
      negForDisplay: string; // "-N" or "—"
      lastDateLabel: string; // "Today" / "YYYY-MM-DD" / "Never"
    };

    const out: Row[] = [];
    for (const tt of taskTypes) {
      const id = String(tt.id);
      const items = itemsByType[id] ?? [];

      let lastYMD: string | null = null;
      if (items.length > 0) {
        lastYMD = toDateKeyInTZ(items[0].created_at, TZ);
      }

      if (!lastYMD) {
        out.push({
          id,
          name: tt.name ?? "Untitled",
          daysSince: null,
          negForDisplay: "—",
          lastDateLabel: "Never",
        });
        continue;
      }

      const d = Math.max(0, daysBetweenYMD(lastYMD, TODAY));
      out.push({
        id,
        name: tt.name ?? "Untitled",
        daysSince: d,
        negForDisplay: d > 0 ? `-${d}` : "0",
        lastDateLabel: d === 0 ? "Today" : lastYMD,
      });
    }
    return out;
  }, [taskTypes, itemsByType, TODAY]);

  /**
   * Bars are RELATIVE to the most starving task type.
   * - "Never" => 100%
   * - else pct = daysSince / maxDaysSince
   * - Sort: Never first, then daysSince desc.
   */
  const rows = useMemo(() => {
    if (raw.length === 0) return [];

    const finiteDays = raw
      .filter((r) => r.daysSince != null)
      .map((r) => r.daysSince as number);

    const maxFinite = finiteDays.length ? Math.max(...finiteDays) : 1;
    const denom = Math.max(1, maxFinite);

    const mapped = raw.map((r) => {
      const isNever = r.daysSince == null;
      const pct = isNever ? 1 : Math.max(0, Math.min(1, (r.daysSince as number) / denom));
      return {
        ...r,
        pct,
        color: colorForPct(pct),
        sortScore: isNever ? Number.POSITIVE_INFINITY : (r.daysSince as number),
      };
    });

    mapped.sort((a, b) => b.sortScore - a.sortScore);
    return mapped;
  }, [raw]);

  /* ===================== RENDER ===================== */
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>Health (All Task Types)</Text>
        <Text style={{ color: "#6b7280", marginTop: 2 }}>
          Bars are relative: most-starving is full. Green → Yellow →{" "}
          <Text style={{ color: "#ef4444" }}>Red</Text>.
        </Text>
      </View>

      {loading && (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      )}
      {!!error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: "#b91c1c" }}>{error}</Text>
        </View>
      )}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {rows.length === 0 && !loading ? (
          <Text style={{ color: "#6b7280" }}>No task types yet.</Text>
        ) : (
          rows.map((r) => (
            <View
              key={r.id}
              style={{
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                backgroundColor: "#fff",
              }}
            >
              {/* Top row: Name + starving number */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800" }} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "900",
                    color: r.negForDisplay.startsWith("-") ? "#b91c1c" : "#111827",
                  }}
                >
                  {r.negForDisplay}
                </Text>
              </View>

              {/* Bar */}
              <View
                style={{
                  height: 14,
                  borderRadius: 999,
                  backgroundColor: "#f3f4f6",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${Math.round(r.pct * 100)}%`,
                    height: "100%",
                    backgroundColor: r.color,
                    opacity: 0.95,
                  }}
                />
              </View>

              {/* Footer line: last log (removed "Fill vs most-starving") */}
              <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: "#6b7280" }}>
                  Last: <Text style={{ color: "#111827" }}>{r.lastDateLabel}</Text>
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {Platform.OS === "ios" ? <View style={{ height: insets.bottom }} /> : null}
    </View>
  );
}
