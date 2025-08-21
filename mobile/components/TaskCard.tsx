// components/TaskCard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { API_URL } from "../constants/api";

type Schedule = { dayOfWeek: number; times: string[] };
type TaskTypeRow = {
  id: number;
  user_id: string;
  name: string;
  schedules?: Schedule[];          // may be undefined or []
  priority: number;                // 1 = highest
  trackby?: string;                // some backends send lowercase
  trackBy?: string;                // DB column (folds to lowercase)
  categories?: string[];
  defaultAmount?: number | null;   // support both casings
  defaultamount?: number | null;
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
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function TaskCard() {
  const { user, isLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taskTypes, setTaskTypes] = useState<TaskTypeRow[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const [amount, setAmount] = useState(""); // used only when there's no default amount
  const [description, setDescription] = useState("");

  // Completed keys for *today*: `${taskTypeID}-${hhmm}` (scheduled-only marker)
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});

  // Unscheduled loop index
  const [unschedIdx, setUnschedIdx] = useState(0);

  // Per-taskType category pointer (cycles through tt.categories)
  const [categoryIndexByType, setCategoryIndexByType] = useState<Record<number, number>>({});

  const minuteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midnightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch helpers ---
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

  const fetchTaskItemsForTypeToday = useCallback(async (taskTypeID: number) => {
    const base = API_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/taskItem/type/${encodeURIComponent(taskTypeID)}`, {
      headers: { Accept: "application/json" },
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${body || "No body"}`);
    const items = JSON.parse(body) as Array<{ id: number; created_at: string }>;

    const start = startOfToday().getTime();
    const end = endOfToday().getTime();
    const countToday = items.filter((it) => {
      const t = new Date(it.created_at).getTime();
      return t >= start && t <= end;
    }).length;

    return countToday;
  }, []);

  const hydrateCompletedFromDB = useCallback(
    async (rows: TaskTypeRow[]) => {
      const active = rows.filter((t) => t.is_active);
      const counts = await Promise.all(
        active.map(async (tt) => {
          try {
            const c = await fetchTaskItemsForTypeToday(tt.id);
            return { id: tt.id, count: c };
          } catch {
            return { id: tt.id, count: 0 };
          }
        })
      );

      const day = new Date().getDay();
      const completedMap: Record<string, boolean> = {};

      for (const tt of active) {
        const sched = (tt.schedules ?? []).find((s) => Number(s.dayOfWeek) === day);
        const times = (sched?.times ?? []).slice().sort((a, b) => {
          const [ah, am] = a.split(":").map((n) => parseInt(n, 10));
          const [bh, bm] = b.split(":").map((n) => parseInt(n, 10));
          return ah === bh ? am - bm : ah - bh;
        });

        const cObj = counts.find((c) => c.id === tt.id);
        const count = Math.max(0, Math.min(cObj?.count ?? 0, times.length));

        for (let i = 0; i < count; i++) {
          const key = `${tt.id}-${times[i]}`;
          completedMap[key] = true;
        }
      }

      setCompletedToday(completedMap);
    },
    [fetchTaskItemsForTypeToday]
  );

  const mergeCategoryIndices = useCallback((rows: TaskTypeRow[]) => {
    setCategoryIndexByType((prev) => {
      const next: Record<number, number> = { ...prev };
      for (const r of rows) if (next[r.id] == null) next[r.id] = 0;
      for (const idStr of Object.keys(next)) {
        const id = Number(idStr);
        if (!rows.find((r) => r.id === id)) delete next[id];
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    if (!isLoaded || !user?.id) return;
    setLoading(true);
    setLastError(null);
    try {
      const rows = await fetchTaskTypes();
      setTaskTypes(rows || []);
      mergeCategoryIndices(rows || []);
      await hydrateCompletedFromDB(rows || []);
      setNow(new Date());
    } catch (e: any) {
      setLastError(e?.message ?? "Failed to fetch tasks.");
    } finally {
      setLoading(false);
    }
  }, [fetchTaskTypes, hydrateCompletedFromDB, isLoaded, user?.id, mergeCategoryIndices]);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    setLastError(null);
    try {
      const rows = await fetchTaskTypes();
      setTaskTypes(rows || []);
      mergeCategoryIndices(rows || []);
      await hydrateCompletedFromDB(rows || []);
      setNow(new Date());
    } catch (e: any) {
      setLastError(e?.message ?? "Failed to refresh.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchTaskTypes, hydrateCompletedFromDB, user?.id, mergeCategoryIndices]);

  useEffect(() => { if (isLoaded) load(); }, [isLoaded, load]);

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

  // --- Build scheduled "current" entry ---
  const currentScheduled: QueueEntry | null = useMemo(() => {
    const day = new Date().getDay();
    const entries: QueueEntry[] = [];

    for (const tt of taskTypes) {
      if (!tt.is_active) continue;
      const sched = (tt.schedules ?? []).find((s) => Number(s.dayOfWeek) === day);
      const times = (sched?.times ?? []);
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
      if (a.priority !== b.priority) return a.priority - b.priority;
      const t = a.scheduledAt.getTime() - b.scheduledAt.getTime();
      if (t !== 0) return t;
      if (a.taskTypeID !== b.taskTypeID) return a.taskTypeID - b.taskTypeID;
      return a.hhmm.localeCompare(b.hhmm);
    });

    for (const e of released) {
      const key = `${e.taskTypeID}-${e.hhmm}`;
      if (!completedToday[key]) return e;
    }
    return null;
  }, [taskTypes, now, completedToday]);

  // --- Unscheduled fallback list ---
  const unscheduledList = useMemo(() => {
    const isUnscheduled = (tt: TaskTypeRow) => {
      const scheds = tt?.schedules ?? [];
      if (scheds.length === 0) return true;
      return scheds.every((s) => !s?.times || s.times.length === 0);
    };

    return taskTypes
      .filter((tt) => tt.is_active && isUnscheduled(tt))
      .sort((a, b) => (a.priority - b.priority) || (a.id - b.id));
  }, [taskTypes]);

  useEffect(() => {
    if (!unscheduledList.length) setUnschedIdx(0);
    else setUnschedIdx((prev) => prev % unscheduledList.length);
  }, [unscheduledList.length]);

  const currentUnscheduled = useMemo(() => {
    if (!unscheduledList.length) return null;
    return unscheduledList[unschedIdx % unscheduledList.length];
  }, [unscheduledList, unschedIdx]);

  const getTaskTypeById = useCallback(
    (id: number) => taskTypes.find((t) => t.id === id),
    [taskTypes]
  );

  const getTrackBy = useCallback((tt?: TaskTypeRow | null) => {
    return tt?.trackby ?? tt?.trackBy ?? "";
  }, []);

  // *** FIX HERE: do NOT coerce null to 0 ***
  const getDefaultAmount = useCallback((tt?: TaskTypeRow | null): number | null => {
    const raw = (tt as any)?.defaultAmount ?? (tt as any)?.defaultamount;
    if (raw === null || raw === undefined) return null; // keep "unset" as null
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, []);

  const getCurrentCategory = useCallback(
    (tt: TaskTypeRow | null | undefined): string | null => {
      const list = tt?.categories ?? [];
      if (!list.length) return null;
      const idx = categoryIndexByType[tt!.id] ?? 0;
      return list[idx % list.length] ?? null;
    },
    [categoryIndexByType]
  );

  const incrementCategory = useCallback(
    (taskTypeID: number) => {
      setCategoryIndexByType((prev) => {
        const tt = getTaskTypeById(taskTypeID);
        const list = tt?.categories ?? [];
        if (!list.length) return prev;
        const cur = prev[taskTypeID] ?? 0;
        return { ...prev, [taskTypeID]: (cur + 1) % list.length };
      });
    },
    [getTaskTypeById]
  );

  const rotateUnscheduled = useCallback(() => {
    if (!unscheduledList.length) return;
    setUnschedIdx((i) => (i + 1) % unscheduledList.length);
    setAmount("");
    setDescription("");
  }, [unscheduledList.length]);

  // Save completion (scheduled OR unscheduled), using defaultAmount if present
  const handleComplete = useCallback(async () => {
    setBusy(true);
    try {
      const base = API_URL.replace(/\/$/, "");

      if (currentScheduled) {
        const tt = getTaskTypeById(currentScheduled.taskTypeID);
        const key = `${currentScheduled.taskTypeID}-${currentScheduled.hhmm}`;
        const chosenCategory = getCurrentCategory(tt);
        const def = getDefaultAmount(tt);
        const amt = def != null ? def : (amount ? Number(amount) : null);

        const payload = {
          taskTypeID: currentScheduled.taskTypeID,
          name: tt?.name ?? currentScheduled.taskName ?? null,
          amount: amt,
          description:
            description || `Completed at ${formatTime(new Date())} (${currentScheduled.hhmm})`,
          taskCategory: chosenCategory ?? null,
        };

        const res = await fetch(`${base}/taskItem`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status} – ${body || "No body"}`);
        }

        setCompletedToday((prev) => ({ ...prev, [key]: true }));
        incrementCategory(currentScheduled.taskTypeID);
        setAmount("");
        setDescription("");
      } else if (currentUnscheduled) {
        const tt = currentUnscheduled;
        const chosenCategory = getCurrentCategory(tt);
        const def = getDefaultAmount(tt);
        const amt = def != null ? def : (amount ? Number(amount) : null);

        const payload = {
          taskTypeID: tt.id,
          name: tt.name,
          amount: amt,
          description: description || "Completed (unscheduled loop)",
          taskCategory: chosenCategory ?? null,
        };

        const res = await fetch(`${base}/taskItem`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status} – ${body || "No body"}`);
        }

        incrementCategory(tt.id);
        rotateUnscheduled();
      }
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Could not create task item.");
    } finally {
      setBusy(false);
    }
  }, [
    currentScheduled,
    currentUnscheduled,
    amount,
    description,
    getTaskTypeById,
    getCurrentCategory,
    getDefaultAmount,
    incrementCategory,
    rotateUnscheduled,
  ]);

  // ---------- UI ----------
  if (!isLoaded || loading) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, elevation: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator />
            <Text style={{ fontWeight: "600" }}>Loading…</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const activeTT: TaskTypeRow | undefined = (() => {
    if (currentScheduled) return getTaskTypeById(currentScheduled.taskTypeID);
    if (currentUnscheduled) return currentUnscheduled;
    return undefined;
  })();

  const currentTrackBy = getTrackBy(activeTT);
  const defaultAmt = getDefaultAmount(activeTT);

  const showingScheduled = !!currentScheduled;
  const showingUnscheduled = !currentScheduled && !!currentUnscheduled;
  const currentCategoryLabel = getCurrentCategory(activeTT);

  const AmountBlock = (
    <>
      {defaultAmt != null ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 12, gap: 6 }}>
          <Text style={{ fontWeight: "800", fontSize: 18 }}>{defaultAmt}</Text>
          <Text>{currentTrackBy || "amount"}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          <TextInput
            placeholder="0"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 8,
              padding: 8,
              marginRight: 6,
            }}
          />
          <Text>{currentTrackBy || "amount"}</Text>
        </View>
      )}
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      alwaysBounceVertical
    >
      <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, elevation: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {showingScheduled ? (
            <>
              <Ionicons name="time-outline" size={18} />
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Current Task</Text>
            </>
          ) : showingUnscheduled ? (
            <>
              <Ionicons name="infinite-outline" size={18} />
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Unscheduled (Loop)</Text>
            </>
          ) : (
            <>
              <Ionicons name="time-outline" size={18} />
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Current Task</Text>
            </>
          )}
        </View>

        {lastError ? (
          <View style={{ backgroundColor: "#fdecea", borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ color: "#b42318" }}>{lastError}</Text>
          </View>
        ) : null}

        {showingScheduled && currentScheduled ? (
          <>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>{currentScheduled.taskName}</Text>
            <Text style={{ opacity: 0.65, marginTop: 4 }}>
              Scheduled at {formatTime(currentScheduled.scheduledAt)} · Priority {currentScheduled.priority}
            </Text>
            {currentCategoryLabel ? (
              <Text style={{ marginTop: 4, fontStyle: "italic" }}>Category: {currentCategoryLabel}</Text>
            ) : null}

            {AmountBlock}

            <TextInput
              placeholder="Add a description…"
              value={description}
              onChangeText={setDescription}
              style={{ marginTop: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 }}
            />

            <TouchableOpacity
              onPress={handleComplete}
              disabled={busy}
              style={{
                alignSelf: "stretch",
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: busy ? "#e5e7eb" : "#111827",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "700" }}>{busy ? "Saving…" : "Complete"}</Text>
            </TouchableOpacity>
          </>
        ) : showingUnscheduled && currentUnscheduled ? (
          <>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>{currentUnscheduled.name}</Text>
            {unscheduledList.length ? (
              <Text style={{ opacity: 0.65, marginTop: 4 }}>
                #{(unschedIdx % unscheduledList.length) + 1} of {unscheduledList.length}
              </Text>
            ) : null}
            {currentCategoryLabel ? (
              <Text style={{ marginTop: 4, fontStyle: "italic" }}>Category: {currentCategoryLabel}</Text>
            ) : null}

            {AmountBlock}

            <TextInput
              placeholder="Add a description…"
              value={description}
              onChangeText={setDescription}
              style={{ marginTop: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 }}
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={handleComplete}
                disabled={busy}
                style={{
                  flexGrow: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: busy ? "#e5e7eb" : "#111827",
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                <Text style={{ color: "#fff", fontWeight: "700" }}>{busy ? "Saving…" : "Complete"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => rotateUnscheduled()}
                disabled={busy || !unscheduledList.length}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#eef2ff",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="play-skip-forward-outline" size={18} />
                <Text style={{ fontWeight: "700" }}>Next Task</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={{ opacity: 0.6 }}>
            Nothing released yet, and no unscheduled loop configured. Pull down to refresh.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
