// components/TaskCard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { API_URL } from "../constants/api";

type Props = {
  /** Called after a successful completion so the parent can refresh its list */
  onCompleted?: () => void;
};

type Schedule = { dayOfWeek: number; times: string[] };
type TaskTypeRow = {
  id: number;
  user_id: string;
  name: string;
  schedules?: Schedule[];          // may be undefined or []
  priority: number;                // 1 = highest
  trackby?: string;                // backend lowercase
  trackBy?: string;                // DB camelCase (folds to lowercase)
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
function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function daysSinceMs(ms: number | null) {
  if (ms == null) return 9999; // treat "never" as very starved
  const nowStart = startOfToday().getTime();
  const thenStart = startOfDay(ms);
  const DAY = 86_400_000;
  return Math.max(0, Math.floor((nowStart - thenStart) / DAY));
}

export default function TaskCard({ onCompleted }: Props) {
  const { user, isLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [taskTypes, setTaskTypes] = useState<TaskTypeRow[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const [amount, setAmount] = useState(""); // when there's no default amount
  const [description, setDescription] = useState("");

  // Completed keys for *today*: `${taskTypeID}-${hhmm}` (scheduled-only marker)
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});

  // Unscheduled loop index
  const [unschedIdx, setUnschedIdx] = useState(0);

  // Per-taskType category pointer (cycles through tt.categories)
  // Hydrated from DB based on last completed item's category.
  const [categoryIndexByType, setCategoryIndexByType] = useState<Record<number, number>>({});

  // keep the latest completion time for each type (for starvation sort)
  const [lastDoneAtByType, setLastDoneAtByType] = useState<Record<number, number | null>>({});

  const minuteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midnightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Fetch helpers ---
  const fetchTaskTypes = useCallback(async () => {
    if (!user?.id) throw new Error("No user id");
    const base = API_URL.replace(/\/$/, "");
    const urls = [
      `${base}/taskType/user/${encodeURIComponent(user.id)}?is_active=true`,
      // fallback variant some backends support:
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

  /**
   * Return:
   *  - how many items logged today
   *  - latest item timestamp
   *  - latest *categorized* item’s category (used to advance to "next" category)
   */
  const fetchTaskMetaForType = useCallback(async (taskTypeID: number) => {
    const base = API_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/taskItem/type/${encodeURIComponent(taskTypeID)}`, {
      headers: { Accept: "application/json" },
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${body || "No body"}`);
    const items = JSON.parse(body) as Array<{ id: number; created_at: string; taskcategory?: string | null }>;

    const start = startOfToday().getTime();
    const end = endOfToday().getTime();

    let countToday = 0;
    let lastAt: number | null = null;

    for (const it of items) {
      const t = new Date(it.created_at).getTime();
      if (t >= start && t <= end) countToday++;
      if (lastAt == null || t > lastAt) lastAt = t;
    }

    // Determine the most recent item that has a taskcategory set
    let lastCategory: string | null = null;
    items
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .some((it) => {
        if (it.taskcategory && `${it.taskcategory}`.trim().length > 0) {
          lastCategory = it.taskcategory.trim();
          return true;
        }
        return false;
      });

    return { countToday, lastAt, lastCategory };
  }, []);

  /**
   * Hydrate:
   *  - completedToday for scheduled occurrences
   *  - lastDoneAtByType (used for starvation)
   *  - categoryIndexByType based on the *last completed category* in DB
   *    → next category = (indexOf(lastCategory) + 1) % categories.length
   */
  const hydrateCompletedFromDB = useCallback(
    async (rows: TaskTypeRow[]) => {
      const active = rows.filter((t) => t.is_active);

      const metas = await Promise.all(
        active.map(async (tt) => {
          try {
            const m = await fetchTaskMetaForType(tt.id);
            return { id: tt.id, ...m };
          } catch {
            return { id: tt.id, countToday: 0, lastAt: null as number | null, lastCategory: null as string | null };
          }
        })
      );

      const day = new Date().getDay();
      const completedMap: Record<string, boolean> = {};
      const lastDoneMap: Record<number, number | null> = {};
      const nextCategoryPointer: Record<number, number> = {};

      for (const tt of active) {
        const sched = (tt.schedules ?? []).find((s) => Number(s.dayOfWeek) === day);
        const times = (sched?.times ?? []).slice().sort((a, b) => {
          const [ah, am] = a.split(":").map((n) => parseInt(n, 10));
          const [bh, bm] = b.split(":").map((n) => parseInt(n, 10));
          return ah === bh ? am - bm : ah - bh;
        });

        const m = metas.find((x) => x.id === tt.id);
        lastDoneMap[tt.id] = m?.lastAt ?? null;

        // mark N earliest scheduled times as completed for today (N = countToday)
        const count = Math.max(0, Math.min(m?.countToday ?? 0, times.length));
        for (let i = 0; i < count; i++) {
          const key = `${tt.id}-${times[i]}`;
          completedMap[key] = true;
        }

        // Build category pointer from DB lastCategory -> next
        const list = tt?.categories ?? [];
        if (list.length > 0) {
          const lastCat = (m?.lastCategory ?? null) as string | null;
          const idxLast = lastCat ? list.findIndex((c) => c === lastCat) : -1;
          const nextIdx = (idxLast >= 0 ? idxLast + 1 : 0) % list.length;
          nextCategoryPointer[tt.id] = nextIdx;
        }
      }

      setCompletedToday(completedMap);
      setLastDoneAtByType(lastDoneMap);
      setCategoryIndexByType((prev) => ({ ...prev, ...nextCategoryPointer }));
    },
    [fetchTaskMetaForType]
  );

  const mergeCategoryIndices = useCallback((rows: TaskTypeRow[]) => {
    // Ensure every active type has some pointer (0 by default) so reads are safe.
    setCategoryIndexByType((prev) => {
      const next: Record<number, number> = { ...prev };
      for (const r of rows) if (r.is_active && next[r.id] == null) next[r.id] = 0;
      for (const idStr of Object.keys(next)) {
        const id = Number(idStr);
        if (!rows.find((r) => r.id === id && r.is_active)) delete next[id];
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

  useEffect(() => { if (isLoaded) load(); }, [isLoaded, load]);

  // tick every minute so "current" releases update
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

  // reset at midnight
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

  // --- Unscheduled list (starvation-based only; NO urgent-from-skip) ---
  const unscheduledList = useMemo(() => {
    const isUnscheduled = (tt: TaskTypeRow) => {
      const scheds = tt?.schedules ?? [];
      if (scheds.length === 0) return true;
      return scheds.every((s) => !s?.times || s.times.length === 0);
    };

    const candidateIDs = new Set<number>(
      taskTypes.filter((tt) => tt.is_active && isUnscheduled(tt)).map((tt) => tt.id)
    );

    type Row = {
      tt: TaskTypeRow;
      daysSince: number;   // "starvation"
    };

    const rows: Row[] = [];
    for (const id of candidateIDs) {
      const tt = taskTypes.find((t) => t.id === id)!;
      const lastAt = lastDoneAtByType[id] ?? null;
      const daysSince = daysSinceMs(lastAt);
      rows.push({ tt, daysSince });
    }

    rows.sort((a, b) => {
      if (b.daysSince !== a.daysSince) return b.daysSince - a.daysSince; // starvation desc
      if (a.tt.priority !== b.tt.priority) return a.tt.priority - b.tt.priority; // 1 is highest
      return a.tt.id - b.tt.id;
    });

    return rows.map((r) => r.tt);
  }, [taskTypes, lastDoneAtByType]);

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

  const getDefaultAmount = useCallback((tt?: TaskTypeRow | null): number | null => {
    const raw = (tt as any)?.defaultAmount ?? (tt as any)?.defaultamount;
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, []);

  const getCurrentCategory = useCallback(
    (tt: TaskTypeRow | null | undefined): string | null => {
      const list = tt?.categories ?? [];
      if (!list.length || !tt) return null;
      const idx = categoryIndexByType[tt.id] ?? 0;
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
          description: description || `Completed at ${formatTime(new Date())}`,
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
        setLastDoneAtByType((prev) => ({ ...prev, [currentScheduled.taskTypeID]: Date.now() }));

        // Advance category pointer locally
        incrementCategory(currentScheduled.taskTypeID);
        setAmount("");
        setDescription("");

        onCompleted?.();
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

        setLastDoneAtByType((prev) => ({ ...prev, [tt.id]: Date.now() }));

        // Advance category pointer locally
        incrementCategory(tt.id);
        rotateUnscheduled();

        onCompleted?.();
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
    onCompleted,
  ]);

  // --- Skip handling ---
  const handleSkip = useCallback(() => {
    if (currentScheduled) {
      // Suppress this scheduled occurrence for today ONLY. No urgent carryover.
      const key = `${currentScheduled.taskTypeID}-${currentScheduled.hhmm}`;
      setCompletedToday((prev) => ({ ...prev, [key]: true }));
      setAmount("");
      setDescription("");
    } else if (currentUnscheduled) {
      // For unscheduled, just rotate
      rotateUnscheduled();
    }
  }, [currentScheduled, currentUnscheduled, rotateUnscheduled]);

  // ---------- UI ----------
  if (!isLoaded || loading) {
    return (
      <View style={{ padding: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Text style={{ fontWeight: "600" }}>Loading…</Text>
        </View>
      </View>
    );
  }

  const activeTT: TaskTypeRow | undefined = (() => {
    if (currentScheduled) return getTaskTypeById(currentScheduled.taskTypeID);
    if (currentUnscheduled) return currentUnscheduled;
    return undefined;
  })();

  const currentTrackBy = (activeTT?.trackby ?? activeTT?.trackBy) || "";
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
    <View /* content only; parent wraps with card */>
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
              onPress={handleSkip}
              disabled={busy}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: "#fef3c7",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="play-skip-forward-outline" size={18} />
              <Text style={{ fontWeight: "700" }}>Skip</Text>
            </TouchableOpacity>
          </View>
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
              onPress={handleSkip}
              disabled={busy || !unscheduledList.length}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: "#fef3c7",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="play-skip-forward-outline" size={18} />
              <Text style={{ fontWeight: "700" }}>Skip</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={{ opacity: 0.6 }}>
          Nothing released yet, and no unscheduled loop configured. Pull down to refresh.
        </Text>
      )}
    </View>
  );
}
