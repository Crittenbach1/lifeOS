// components/TaskCard.tsx
// Shows ONLY the current (released) task for today.
// Preempts: if a higher-priority task releases while lower-priority items are pending,
// it takes over the card. Within the same priority, earlier time wins.
// Pull-to-refresh supported. Auto-updates every minute. Resets at midnight.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { API_URL } from "../constants/api";

type Schedule = { dayOfWeek: number; times: string[] };
type TaskTypeRow = {
  id: number;
  user_id: string;
  name: string;
  schedules: Schedule[];
  priority: number; // 1 = highest
  trackBy: string;
  categories: string[];
  yearlyGoal: number;
  monthlyGoal: number;
  weeklyGoal: number;
  dailyGoal: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type QueueEntry = {
  taskTypeID: number;
  taskName: string;
  priority: number;
  hhmm: string;
  scheduledAt: Date;
};

function parseHHMMToDateToday(hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}
function msUntilNextMinute() {
  const now = new Date();
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}
function msUntilTomorrow() {
  const now = new Date();
  const t = new Date(now);
  t.setDate(now.getDate() + 1);
  t.setHours(0, 0, 0, 0);
  return t.getTime() - now.getTime();
}
function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TaskCard() {
  const { user, isLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taskTypes, setTaskTypes] = useState<TaskTypeRow[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Track completions client-side for today (keyed by taskTypeID + hhmm)
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});

  const minuteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midnightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch helpers (supports either route style) ---
  const fetchTaskTypes = useCallback(async () => {
    if (!user?.id) throw new Error("No user id");
    const base = API_URL.replace(/\/$/, "");
    const urls = [
      `${base}/taskType/user/${encodeURIComponent(user.id)}?is_active=true`,
      `${base}/taskType?user_id=${encodeURIComponent(user.id)}&is_active=true`,
    ];
    const errors: string[] = [];
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const body = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status} – ${body || "No body"}`);
        const data = JSON.parse(body);
        if (!Array.isArray(data)) throw new Error("Expected array response");
        return data as TaskTypeRow[];
      } catch (e: any) {
        errors.push(`${url} -> ${e?.message}`);
      }
    }
    throw new Error(errors.join(" | "));
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!isLoaded || !user?.id) return;
    setLoading(true);
    setLastError(null);
    try {
      const rows = await fetchTaskTypes();
      setTaskTypes(rows || []);
      setNow(new Date());
    } catch (e: any) {
      console.error("TaskCard load error:", e);
      setLastError(e?.message ?? "Failed to fetch tasks.");
    } finally {
      setLoading(false);
    }
  }, [fetchTaskTypes, isLoaded, user?.id]);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    setLastError(null);
    try {
      const rows = await fetchTaskTypes();
      setTaskTypes(rows || []);
      setNow(new Date());
    } catch (e: any) {
      console.error("TaskCard refresh error:", e);
      setLastError(e?.message ?? "Failed to refresh.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchTaskTypes, user?.id]);

  // Initial load
  useEffect(() => { if (isLoaded) load(); }, [isLoaded, load]);

  // Minute tick (so new arrivals/preemptions are reflected)
  useEffect(() => {
    function armMinute() {
      if (minuteTimer.current) clearTimeout(minuteTimer.current);
      minuteTimer.current = setTimeout(() => {
        setNow(new Date());
        armMinute();
      }, msUntilNextMinute());
    }
    armMinute();
    return () => { if (minuteTimer.current) clearTimeout(minuteTimer.current); };
  }, []);

  // Midnight reset (also clear client-side completion flags)
  useEffect(() => {
    function armMidnight() {
      if (midnightTimer.current) clearTimeout(midnightTimer.current);
      midnightTimer.current = setTimeout(() => {
        setCompletedToday({});
        load();
        setNow(new Date());
        armMidnight();
      }, msUntilTomorrow());
    }
    armMidnight();
    return () => { if (midnightTimer.current) clearTimeout(midnightTimer.current); };
  }, [load]);

  // Build today's RELEASED entries (scheduledAt <= now) and pick the single current one.
  // PREEMPTION RULE: among released & not yet completed, pick the LOWEST priority first.
  // If priorities tie, pick the earliest scheduledAt; final tie-breaker: id/hhmm for stability.
  const current: QueueEntry | null = useMemo(() => {
    const day = new Date().getDay();
    const entries: QueueEntry[] = [];

    for (const tt of taskTypes) {
      if (!tt.is_active) continue;
      const sched = (tt.schedules || []).find((s) => Number(s.dayOfWeek) === day);
      const times = sched?.times || [];
      for (const hhmm of times) {
        entries.push({
          taskTypeID: tt.id,
          taskName: tt.name,
          priority: tt.priority,
          hhmm,
          scheduledAt: parseHHMMToDateToday(hhmm),
        });
      }
    }

    const released = entries.filter((e) => e.scheduledAt.getTime() <= now.getTime());

    released.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority; // priority first (1 wins)
      const t = a.scheduledAt.getTime() - b.scheduledAt.getTime();   // earlier time next
      if (t !== 0) return t;
      if (a.taskTypeID !== b.taskTypeID) return a.taskTypeID - b.taskTypeID; // stable
      return a.hhmm.localeCompare(b.hhmm);
    });

    for (const e of released) {
      const key = `${e.taskTypeID}-${e.hhmm}`;
      if (!completedToday[key]) return e;
    }
    return null;
  }, [taskTypes, now, completedToday]);

  // Lookup helper
  const getTaskTypeById = useCallback(
    (id: number) => taskTypes.find((t) => t.id === id),
    [taskTypes]
  );

  // --- Create a taskItem on completion ---
  const handleComplete = useCallback(async () => {
    if (!current) return;
    setBusy(true);

    // Optimistic UI: mark this (taskTypeID + hhmm) as done locally
    const key = `${current.taskTypeID}-${current.hhmm}`;
    setCompletedToday((prev) => ({ ...prev, [key]: true }));

    try {
      const tt = getTaskTypeById(current.taskTypeID);
      const base = API_URL.replace(/\/$/, "");

      const payload = {
        taskTypeID: current.taskTypeID,                               // required by your API
        name: tt?.name ?? current.taskName ?? null,                   // optional
        amount: null,                                                 // optional
        description: `Completed at ${formatTime(new Date())} (${current.hhmm})`, // optional
        taskCategory: tt?.categories?.[0] ?? null,                    // optional
      };

      const res = await fetch(`${base}/taskItem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Roll back optimistic update on failure
        setCompletedToday((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        const body = await res.text();
        throw new Error(`HTTP ${res.status} – ${body || "No body"}`);
      }

      // const created = await res.json(); // if you want the row
    } catch (e: any) {
      console.warn("Create taskItem failed:", e?.message);
      Alert.alert("Save failed", e?.message ?? "Could not create task item.");
    } finally {
      setBusy(false);
    }
  }, [current, getTaskTypeById]);

  // ---------- UI ----------
  if (!isLoaded || loading) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 16,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator />
            <Text style={{ fontWeight: "600" }}>Loading…</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      alwaysBounceVertical
    >
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 16,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Ionicons name="time-outline" size={18} />
          <Text style={{ fontSize: 18, fontWeight: "800" }}>Current Task</Text>
        </View>

        {lastError ? (
          <View style={{ backgroundColor: "#fdecea", borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ color: "#b42318" }}>{lastError}</Text>
          </View>
        ) : null}

        {current ? (
          <>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>{current.taskName}</Text>
            <Text style={{ opacity: 0.65, marginTop: 4 }}>
              Scheduled at {formatTime(current.scheduledAt)} · Priority {current.priority}
            </Text>

            <TouchableOpacity
              onPress={handleComplete}
              disabled={busy}
              style={{
                alignSelf: "flex-start",
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: busy ? "#e5e7eb" : "#111827",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "700" }}>{busy ? "Saving…" : "Complete"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={{ opacity: 0.6 }}>
            Nothing released yet (or everything released so far is done). Pull down to refresh any time.
          </Text>
        )}

        <Text style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
          Preemptive: highest priority among released tasks always shows. Pull to refresh · minute updates · resets at midnight.
        </Text>
      </View>
    </ScrollView>
  );
}
