// components/EditTaskTypeModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../constants/api";

type Schedule = { dayOfWeek: number; times: string[] };

type TaskTypeEditable = {
  id: number | string;
  user_id: string;
  name: string;
  schedules?: Schedule[];          // [] means "unscheduled loop"
  priority: number;                // 1 = highest
  trackBy?: string;
  categories?: string[] | null;
  defaultAmount?: number | null;
  yearlyGoal?: number;
  monthlyGoal?: number;
  weeklyGoal?: number;
  dailyGoal?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Allow DB lowercase fallbacks just in case
  [k: string]: any;
};

type Props = {
  visible: boolean;
  initial: TaskTypeEditable | null;       // the current type to edit
  onClose: () => void;
  onSaved?: (updated: TaskTypeEditable) => void; // called after successful save
};

const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Mode = "unscheduled" | "scheduled";

/* -------------------- helpers -------------------- */

function unique(arr: string[]) {
  const seen = new Set<string>();
  return arr.filter((t) => {
    const k = t.trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sortTimes(arr: string[]) {
  return arr.slice().sort((a, b) => {
    const [ah, am] = a.split(":").map((n) => parseInt(n, 10));
    const [bh, bm] = b.split(":").map((n) => parseInt(n, 10));
    return ah === bh ? am - bm : ah - bh;
  });
}

function sanitizeSchedules(s: Schedule[] | undefined | null): Schedule[] {
  const src = Array.isArray(s) ? s : [];
  const days = Array.from({ length: 7 }, (_, d) => d);
  const byDay = new Map<number, Schedule>();
  src.forEach((row) => {
    if (row && typeof row.dayOfWeek === "number") {
      byDay.set(row.dayOfWeek, {
        dayOfWeek: Number(row.dayOfWeek),
        times: sortTimes((row.times || []).filter((t) => HHMM_RE.test(t))),
      });
    }
  });
  return days.map((d) => byDay.get(d) || ({ dayOfWeek: d, times: [] }));
}

function cleanSchedulesOut(mode: Mode, schedules: Schedule[]): Schedule[] {
  const filtered = schedules
    .map((row) => ({
      dayOfWeek: Number(row.dayOfWeek),
      times: sortTimes((row.times || []).filter((t) => HHMM_RE.test(t))),
    }))
    .filter((row) => row.times.length > 0);

  return mode === "scheduled" ? filtered : []; // unscheduled -> []
}

function safeParseJson<T>(text: string): Partial<T> {
  try {
    const trimmed = (text || "").trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed) as Partial<T>;
  } catch {
    return {};
  }
}

/* -------------------- UI atoms -------------------- */

const inputStyle = {
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 10,
  backgroundColor: "#fff",
} as const;

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
      {icon ? <Ionicons name={icon} size={16} color={dark ? "#fff" : "#111827"} /> : null}
      {label ? <Text style={{ color: dark ? "#fff" : "#111827", fontWeight: "700" }}>{label}</Text> : null}
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
      {icon ? <Ionicons name={icon} size={16} color={active ? "#fff" : "#111827"} /> : null}
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

/* -------------------- main component -------------------- */

export default function EditTaskTypeModal({ visible, initial, onClose, onSaved }: Props) {
  const base = useMemo(() => API_URL.replace(/\/$/, ""), []);

  // Controlled state seeded from `initial`
  const [mode, setMode] = useState<Mode>("unscheduled");

  const [name, setName] = useState("");
  const [trackBy, setTrackBy] = useState("");
  const [useDefaultAmount, setUseDefaultAmount] = useState(false);
  const [defaultAmount, setDefaultAmount] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [yearlyGoal, setYearlyGoal] = useState("0");
  const [monthlyGoal, setMonthlyGoal] = useState("0");
  const [weeklyGoal, setWeeklyGoal] = useState("0");
  const [dailyGoal, setDailyGoal] = useState("0");

  const [priority, setPriority] = useState<number>(1);
  const [schedules, setSchedules] = useState<Schedule[]>(
    Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, times: [] }))
  );
  const [timeDraftByDay, setTimeDraftByDay] = useState<Record<number, string>>({});

  const [busy, setBusy] = useState(false);

  // Seed when modal opens or initial changes
  useEffect(() => {
    if (!visible || !initial) return;

    const initMode: Mode =
      Array.isArray(initial.schedules) && initial.schedules.length > 0 ? "scheduled" : "unscheduled";
    setMode(initMode);

    setName(String(initial.name ?? ""));
    setTrackBy(String(initial.trackBy ?? initial.trackby ?? ""));
    const defAmt =
      initial.defaultAmount != null ? Number(initial.defaultAmount) :
      initial.defaultamount != null ? Number(initial.defaultamount) : null;
    setUseDefaultAmount(defAmt != null && Number.isFinite(defAmt));
    setDefaultAmount(defAmt != null && Number.isFinite(defAmt) ? String(defAmt) : "");

    setCategories(Array.isArray(initial.categories) ? initial.categories : []);
    setCategoryDraft("");

    setYearlyGoal(String(initial.yearlyGoal ?? initial.yearlygoal ?? 0));
    setMonthlyGoal(String(initial.monthlyGoal ?? initial.monthlygoal ?? 0));
    setWeeklyGoal(String(initial.weeklyGoal ?? initial.weeklygoal ?? 0));
    setDailyGoal(String(initial.dailyGoal ?? initial.dailygoal ?? 0));

    setPriority(Number(initial.priority ?? 1));
    setSchedules(sanitizeSchedules(initial.schedules));
    setTimeDraftByDay({});
  }, [visible, initial]);

  /* ---------- categories ---------- */
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

  /* ---------- schedule editting ---------- */
  function setDayTimeDraft(day: number, val: string) {
    setTimeDraftByDay((prev) => ({ ...prev, [day]: val }));
  }
  function addTimeToDay(day: number) {
    const draft = (timeDraftByDay[day] || "").trim();
    if (!HHMM_RE.test(draft)) {
      Alert.alert("Invalid time", "Use 24-hour HH:MM, e.g. 07:30 or 18:00.");
      return;
    }
    setSchedules((prev) =>
      prev.map((row) =>
        row.dayOfWeek === day
          ? { ...row, times: sortTimes(unique([...(row.times || []), draft])) }
          : row
      )
    );
    setDayTimeDraft(day, "");
  }
  function removeTimeFromDay(day: number, idx: number) {
    setSchedules((prev) =>
      prev.map((row) =>
        row.dayOfWeek === day
          ? { ...row, times: (row.times || []).filter((_, i) => i !== idx) }
          : row
      )
    );
  }

  function goalsOut() {
    const yi = Number(yearlyGoal || 0);
    const mi = Number(monthlyGoal || 0);
    const wi = Number(weeklyGoal || 0);
    const di = Number(dailyGoal || 0);
    return { yearly: yi, monthly: mi, weekly: wi, daily: di };
  }

  async function onSubmit() {
    try {
      if (!initial) {
        Alert.alert("Missing data", "No task type to edit.");
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

      const schedulesOut = cleanSchedulesOut(mode, schedules);
      if (mode === "scheduled" && schedulesOut.length === 0) {
        Alert.alert("Schedule required", "Add at least one time or switch to Unscheduled Loop.");
        return;
      }

      const { yearly, monthly, weekly, daily } = goalsOut();

      const payload: any = {
        user_id: initial.user_id,
        name: name.trim(),
        schedules: schedulesOut, // [] in unscheduled mode
        priority: Number(priority) || 1,
        trackBy: trackBy.trim(),
        categories,
        yearlyGoal: yearly,
        monthlyGoal: monthly,
        weeklyGoal: weekly,
        dailyGoal: daily,
        is_active: Boolean(initial.is_active),
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
      const res = await fetch(
        `${base}/taskType/${encodeURIComponent(String(initial.id))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const bodyText = await res.text();
      if (!res.ok) {
        let msg = bodyText || `HTTP ${res.status}`;
        try {
          const j = JSON.parse(bodyText);
          msg = j.message || msg;
        } catch {}
        throw new Error(msg);
      }

      // ✅ Type-safe parse (fixes the ts(2739) complaint)
      const parsed = safeParseJson<Partial<TaskTypeEditable>>(bodyText);
      const updated: TaskTypeEditable = {
        ...(initial as any),
        ...(payload as any),
        ...(parsed as any),
      };

      Alert.alert("Saved", "Task type updated.");
      onSaved?.(updated);
      onClose();
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}
      >
        <View
          style={{
            backgroundColor: "#f6f7fb",
            maxHeight: "92%",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 8,
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 18 }}>Edit Task Type</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
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
              <LabeledInput
                label="Name"
                placeholder="e.g., Gym, Drink Water"
                value={name}
                onChangeText={setName}
              />
              <LabeledInput
                label="Track By"
                placeholder="e.g., count, duration, pages"
                value={trackBy}
                onChangeText={setTrackBy}
              />

              {/* Default Amount */}
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
                    <TextInput
                      value={defaultAmount}
                      onChangeText={setDefaultAmount}
                      placeholder="0"
                      keyboardType="numeric"
                      style={inputStyle}
                    />
                  )}
                </View>
              </View>

              {/* Categories */}
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
                    <SmallButton
                      label=""
                      onPress={() => setPriority((p) => Math.max(1, p - 1))}
                      icon="remove-outline"
                      variant="light"
                    />
                    <Text style={{ fontWeight: "800", fontSize: 20 }}> {priority} </Text>
                    <SmallButton
                      label=""
                      onPress={() => setPriority((p) => Math.min(10, p + 1))}
                      icon="add-outline"
                      variant="light"
                    />
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
                            <RemovablePill
                              key={`${row.dayOfWeek}-${t}-${idx}`}
                              label={t}
                              onRemove={() => removeTimeFromDay(row.dayOfWeek, idx)}
                            />
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
                marginTop: 14,
                backgroundColor: busy ? "#e5e7eb" : "#111827",
                paddingVertical: 14,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="save-outline" size={18} color="#fff" />
              )}
              <Text style={{ color: "#fff", fontWeight: "800" }}>
                {busy ? "Saving…" : "Save Changes"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              style={{
                marginTop: 10,
                backgroundColor: "#f3f4f6",
                paddingVertical: 12,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Ionicons name="close" size={18} />
              <Text style={{ fontWeight: "800" }}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
