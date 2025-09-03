// components/EditTaskTypeModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";

type Schedule = { dayOfWeek: number; times: string[] };
type Mode = "unscheduled" | "scheduled";

type TaskTypeEditable = {
  id: number | string;
  user_id: string;
  name: string;
  schedules?: Schedule[] | null;
  priority: number;
  trackBy?: string | null;
  categories?: string[] | null;
  defaultAmount?: number | null;
  yearlyGoal?: number | null;
  monthlyGoal?: number | null;
  weeklyGoal?: number | null;
  dailyGoal?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // allow lowercase variants from DB without breaking
  [k: string]: any;
};

const HHMM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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

function coerceNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((v) => (typeof v === "string" ? v : String(v ?? "")))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* ---------------- Props ---------------- */
export default function EditTaskTypeModal({
  visible,
  onClose,
  initialType,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  initialType: TaskTypeEditable | null;
  onSaved?: (updated: TaskTypeEditable) => void;
}) {
  const base = useMemo(() => API_URL.replace(/\/$/, ""), []);

  // --------- Derived initials ---------
  const initSchedules: Schedule[] = useMemo(() => {
    const raw = (initialType?.schedules ??
      (initialType as any)?.schedule ??
      []) as Schedule[] | undefined;

    if (!raw || !Array.isArray(raw)) return [];
    // normalize: ensure 0..6 present for UI convenience
    const byDay = new Map<number, Schedule>();
    raw.forEach((r) => {
      if (!r) return;
      const d = Number(r.dayOfWeek);
      const times = Array.isArray(r.times) ? r.times.filter((t) => HHMM_RE.test(t)) : [];
      if (Number.isInteger(d) && d >= 0 && d <= 6) byDay.set(d, { dayOfWeek: d, times: sortTimes(times) });
    });
    const full: Schedule[] = Array.from({ length: 7 }, (_, d) => {
      const row = byDay.get(d);
      return row ?? { dayOfWeek: d, times: [] };
    });
    return full;
  }, [initialType]);

  const initialMode: Mode = useMemo(() => {
    const anyTimes = (initSchedules || []).some((r) => (r?.times?.length ?? 0) > 0);
    return anyTimes ? "scheduled" : "unscheduled";
  }, [initSchedules]);

  // --------- Form state ---------
  const [mode, setMode] = useState<Mode>(initialMode);

  const [name, setName] = useState<string>(initialType?.name ?? "");
  const [trackBy, setTrackBy] = useState<string>(
    (initialType?.trackBy ??
      (initialType as any)?.trackby ??
      "") || ""
  );

  const [useDefaultAmount, setUseDefaultAmount] = useState<boolean>(
    coerceNumOrNull(
      (initialType as any)?.defaultAmount ?? (initialType as any)?.defaultamount
    ) !== null
  );
  const [defaultAmount, setDefaultAmount] = useState<string>(() => {
    const v =
      (initialType as any)?.defaultAmount ?? (initialType as any)?.defaultamount;
    const n = coerceNumOrNull(v);
    return n === null ? "" : String(n);
  });

  const [categories, setCategories] = useState<string[]>(
    asStringArray(initialType?.categories)
  );
  const [categoriesText, setCategoriesText] = useState<string>(
    asStringArray(initialType?.categories).join(", ")
  );

  const [yearlyGoal, setYearlyGoal] = useState<string>(
    String(initialType?.yearlyGoal ?? (initialType as any)?.yearlygoal ?? 0)
  );
  const [monthlyGoal, setMonthlyGoal] = useState<string>(
    String(initialType?.monthlyGoal ?? (initialType as any)?.monthlygoal ?? 0)
  );
  const [weeklyGoal, setWeeklyGoal] = useState<string>(
    String(initialType?.weeklyGoal ?? (initialType as any)?.weeklygoal ?? 0)
  );
  const [dailyGoal, setDailyGoal] = useState<string>(
    String(initialType?.dailyGoal ?? (initialType as any)?.dailygoal ?? 0)
  );

  const [priority, setPriority] = useState<number>(
    Number(initialType?.priority ?? 1)
  );

  const [schedules, setSchedules] = useState<Schedule[]>(initSchedules);
  const [timeDraftByDay, setTimeDraftByDay] = useState<Record<number, string>>(
    {}
  );

  const [busy, setBusy] = useState<boolean>(false);

  // When initialType changes (opening different task), re-seed
  useEffect(() => {
    if (!initialType) return;
    setMode(initialMode);
    setName(initialType.name ?? "");
    setTrackBy(
      (initialType.trackBy ?? (initialType as any)?.trackby ?? "") || ""
    );

    const n = coerceNumOrNull(
      (initialType as any)?.defaultAmount ?? (initialType as any)?.defaultamount
    );
    setUseDefaultAmount(n !== null);
    setDefaultAmount(n === null ? "" : String(n));

    const cats = asStringArray(initialType.categories);
    setCategories(cats);
    setCategoriesText(cats.join(", "));

    setYearlyGoal(
      String(initialType?.yearlyGoal ?? (initialType as any)?.yearlygoal ?? 0)
    );
    setMonthlyGoal(
      String(initialType?.monthlyGoal ?? (initialType as any)?.monthlygoal ?? 0)
    );
    setWeeklyGoal(
      String(initialType?.weeklyGoal ?? (initialType as any)?.weeklygoal ?? 0)
    );
    setDailyGoal(
      String(initialType?.dailyGoal ?? (initialType as any)?.dailygoal ?? 0)
    );

    setPriority(Number(initialType?.priority ?? 1));
    setSchedules(initSchedules);
    setTimeDraftByDay({});
  }, [initialType, initSchedules, initialMode]);

  // keep array in sync with editable text field (and vice-versa)
  useEffect(() => {
    setCategories(
      categoriesText
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
    );
  }, [categoriesText]);

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

  function cleanSchedulesOut(): Schedule[] {
    const filtered = schedules
      .map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        times: sortTimes((row.times || []).filter((t) => HHMM_RE.test(t))),
      }))
      .filter((row) => row.times.length > 0);

    return mode === "scheduled" ? filtered : []; // unscheduled -> []
  }

  async function onSubmit() {
    try {
      if (!initialType?.id) return;

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
        Alert.alert("Schedule required", "Add at least one time to your schedule or switch to Unscheduled Loop.");
        return;
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        trackBy: trackBy.trim(),
        priority: Number(priority) || 1,
        schedules: schedulesOut, // [] allowed (unscheduled)
        categories,              // sanitized by backend
        yearlyGoal: Number(yearlyGoal || 0),
        monthlyGoal: Number(monthlyGoal || 0),
        weeklyGoal: Number(weeklyGoal || 0),
        dailyGoal: Number(dailyGoal || 0),
      };

      if (useDefaultAmount) {
        const n = coerceNumOrNull(defaultAmount);
        if (n === null) {
          Alert.alert("Invalid default amount", "Enter a valid number or turn Default Amount Off.");
          return;
        }
        payload.defaultAmount = n;
      } else {
        payload.defaultAmount = null;
      }

      setBusy(true);
      const res = await fetch(`${base}/taskType/${encodeURIComponent(String(initialType.id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const bodyText = await res.text();
      if (!res.ok) {
        // Surface server message if present
        let msg = bodyText || `HTTP ${res.status}`;
        try {
          const j = JSON.parse(bodyText);
          msg = j.message || msg;
        } catch {}
        throw new Error(msg);
      }

      let updated: TaskTypeEditable;
      try {
        updated = JSON.parse(bodyText) as TaskTypeEditable;
      } catch {
        // If API returns no/invalid body, reconstruct best effort
        updated = {
          ...(initialType as any),
          ...payload,
          id: initialType.id,
          user_id: initialType.user_id,
          name: payload.name as string,
        };
      }

      Alert.alert("Saved", "Task type updated.");
      onSaved?.(updated);
      onClose();
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const keyboardBehavior = Platform.select({ ios: "padding", android: undefined }) as
    | "padding"
    | "height"
    | "position"
    | undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: "92%",
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: "#eee",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Edit Task Type</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 + 84 }}>
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
                  onChangeText={(t: string) => setName(t)}
                />
                <LabeledInput
                  label="Track By"
                  placeholder="e.g., count, duration, pages"
                  value={trackBy}
                  onChangeText={(t: string) => setTrackBy(t)}
                />

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
                      <TextInput
                        value={defaultAmount}
                        onChangeText={(t: string) => setDefaultAmount(t)}
                        placeholder="0"
                        keyboardType="numeric"
                        style={inputStyle}
                      />
                    )}
                  </View>
                </View>

                {/* Categories (comma-separated) */}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 6 }}>Categories (comma-separated)</Text>
                  <TextInput
                    value={categoriesText}
                    onChangeText={(t: string) => setCategoriesText(t)}
                    placeholder="work, home, study"
                    style={inputStyle}
                  />
                </View>

                {/* Goals */}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>Goals</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <NumberBox
                      label="Yearly"
                      value={yearlyGoal}
                      onChangeText={(t: string) => setYearlyGoal(t.replace(/[^\d-]/g, ""))}
                    />
                    <NumberBox
                      label="Monthly"
                      value={monthlyGoal}
                      onChangeText={(t: string) => setMonthlyGoal(t.replace(/[^\d-]/g, ""))}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <NumberBox
                      label="Weekly"
                      value={weeklyGoal}
                      onChangeText={(t: string) => setWeeklyGoal(t.replace(/[^\d-]/g, ""))}
                    />
                    <NumberBox
                      label="Daily"
                      value={dailyGoal}
                      onChangeText={(t: string) => setDailyGoal(t.replace(/[^\d-]/g, ""))}
                    />
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
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            marginBottom: 8,
                          }}
                        >
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
                            onChangeText={(v: string) => setDayTimeDraft(row.dayOfWeek, v)}
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
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 14,
                backgroundColor: "#fff",
                borderTopWidth: 1,
                borderTopColor: "#eee",
              }}
            >
              <TouchableOpacity
                onPress={onSubmit}
                disabled={busy}
                style={{
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
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------------- Reusable little UI bits (local) ---------------- */

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
        onChangeText={(t: string) => props.onChangeText(t)}
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
        onChangeText={(t: string) => onChangeText(t)}
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
      {icon ? <Ionicons name={icon} size={16} color={active ? "#fff" : "#111827"} /> : null}
      <Text style={{ fontWeight: "800", color: active ? "#fff" : "#111827" }}>{label}</Text>
    </TouchableOpacity>
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
