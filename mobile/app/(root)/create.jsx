import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useState } from "react";
import { styles } from "../../assets/styles/create.styles";
import { COLORS } from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { API_URL } from "../../constants/api";

const DAY_LABELS = [
  { short: "S", full: "Sunday" },
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "Th", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
];

const DAY_COL_WIDTH = 72;
const PRIORITY_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

const CreateScreen = () => {
  const router = useRouter();
  const { user } = useUser();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");

  // priority selector (1..10) - default 1
  const [priority, setPriority] = useState(1);

  // Track By (REQUIRED)
  const [trackBy, setTrackBy] = useState("");

  // Categories (OPTIONAL)
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState([]);

  // Same times every day
  const [sameTimesEveryDay, setSameTimesEveryDay] = useState(false);
  const [everyDayTimes, setEveryDayTimes] = useState([]);

  // Per-day schedules (when not sameTimesEveryDay)
  const [dayTimes, setDayTimes] = useState({
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  });

  // Picker state
  const [pickerForDay, setPickerForDay] = useState(null); // number | "ALL" | null
  const [tempTime, setTempTime] = useState(new Date());

  // Goals (REQUIRED)
  const [yearlyGoal, setYearlyGoal] = useState("");
  const [monthlyGoal, setMonthlyGoal] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState("");
  const [dailyGoal, setDailyGoal] = useState("");

  // --- 24-hour formatter "HH:MM" ---
  const formatHHMM = (d) => {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // per-day mode
  const addTime = (day, t) => {
    setDayTimes((prev) => {
      const existing = new Set(prev[day]);
      existing.add(t);
      const next = Array.from(existing).sort();
      return { ...prev, [day]: next };
    });
  };
  const removeTime = (day, t) => {
    setDayTimes((prev) => ({ ...prev, [day]: prev[day].filter((x) => x !== t) }));
  };

  // every-day mode
  const addEveryDayTime = (t) => {
    setEveryDayTimes((prev) => {
      const s = new Set(prev);
      s.add(t);
      return Array.from(s).sort();
    });
  };
  const removeEveryDayTime = (t) => {
    setEveryDayTimes((prev) => prev.filter((x) => x !== t));
  };

  const onOpenPicker = (day) => {
    setPickerForDay(day);
    setTempTime(new Date());
  };
  const onOpenPickerAll = () => {
    setPickerForDay("ALL");
    setTempTime(new Date());
  };

  const onTimeChange = (event, date) => {
    if (pickerForDay === null || pickerForDay === undefined) return;

    if (event.type === "dismissed") {
      if (Platform.OS === "android") setPickerForDay(null);
      return;
    }

    const d = date || tempTime;
    setTempTime(d);

    // Android: add immediately and close
    if (Platform.OS === "android") {
      const t = formatHHMM(d);
      if (pickerForDay === "ALL") {
        addEveryDayTime(t);
      } else {
        addTime(pickerForDay, t);
      }
      setPickerForDay(null);
    }
  };

  const handleAddFromIOS = () => {
    if (pickerForDay === null || pickerForDay === undefined) return;
    const t = formatHHMM(tempTime);
    if (pickerForDay === "ALL") addEveryDayTime(t);
    else addTime(pickerForDay, t);
  };

  // Categories helpers
  const addCategory = () => {
    const c = (categoryInput || "").trim();
    if (!c) return;
    const exists = categories.some((x) => x.toLowerCase() === c.toLowerCase());
    if (exists) {
      setCategoryInput("");
      return;
    }
    setCategories((prev) => [...prev, c]);
    setCategoryInput("");
  };
  const removeCategory = (c) => {
    setCategories((prev) => prev.filter((x) => x !== c));
  };

  const validateRequired = () => {
    const errors = [];

    const trimmedName = name.trim();
    if (trimmedName.length < 2) errors.push("Task name must be at least 2 characters.");

    if (!trackBy.trim()) errors.push("Track By is required.");

    // At least one time somewhere
    const totalTimes = sameTimesEveryDay
      ? everyDayTimes.length
      : Object.values(dayTimes).reduce((acc, arr) => acc + arr.length, 0);
    if (totalTimes === 0) errors.push("Please add at least one scheduled time.");

    const yg = Number(yearlyGoal);
    const mg = Number(monthlyGoal);
    const wg = Number(weeklyGoal);
    const dg = Number(dailyGoal);

    const isValidNumber = (n) => Number.isFinite(n) && n > 0;

    if (!isValidNumber(yg)) errors.push("Yearly Goal must be a number greater than 0.");
    if (!isValidNumber(mg)) errors.push("Monthly Goal must be a number greater than 0.");
    if (!isValidNumber(wg)) errors.push("Weekly Goal must be a number greater than 0.");
    if (!isValidNumber(dg)) errors.push("Daily Goal must be a number greater than 0.");

    if (errors.length > 0) {
      Alert.alert("Missing/Invalid Fields", errors.join("\n"));
      return null;
    }

    return {
      name: trimmedName,
      yearlyGoal: yg,
      monthlyGoal: mg,
      weeklyGoal: wg,
      dailyGoal: dg,
    };
  };

  const handleCreate = async () => {
    const validated = validateRequired();
    if (!validated) return;

    // Build schedules payload
    let schedules;
    if (sameTimesEveryDay) {
      schedules = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, times: everyDayTimes }));
    } else {
      schedules = Object.keys(dayTimes)
        .map((k) => Number(k))
        .filter((day) => dayTimes[day].length > 0)
        .map((day) => ({ dayOfWeek: day, times: dayTimes[day] }));
    }

    setIsLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        name: validated.name,
        schedules,
        priority,
        trackBy: trackBy.trim(),
        categories, // optional; can be []
        yearlyGoal: validated.yearlyGoal,
        monthlyGoal: validated.monthlyGoal,
        weeklyGoal: validated.weeklyGoal,
        dailyGoal: validated.dailyGoal,
        is_active: true,
      };

      const response = await fetch(`${API_URL}/taskType`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Read body ONCE to avoid "Already read"
      const raw = await response.text();

      if (!response.ok) {
        let msg = raw;
        try {
          const j = JSON.parse(raw || "{}");
          msg = j.message || j.error || msg || `HTTP ${response.status}`;
        } catch {
          msg = raw || `HTTP ${response.status}`;
        }
        throw new Error(msg);
      }

      Alert.alert("Success", "New task created!");
      router.back();
    } catch (error) {
      console.error("Create error:", error);
      Alert.alert("Error", error.message || "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Task</Text>
        <TouchableOpacity
          style={[styles.saveButtonContainer, isLoading && styles.saveButtonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          <Text style={styles.saveButton}>{isLoading ? "Saving..." : "Save"}</Text>
          {!isLoading && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Name (required) */}
          <Text style={styles.sectionTitle}>
            <Ionicons name="create-outline" size={16} color={COLORS.text} /> Task Name *
          </Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="pricetag-outline"
              size={22}
              color={COLORS.textLight}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="e.g., Drink Water Bottle, Gym, Read"
              placeholderTextColor={COLORS.textLight}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={60}
            />
          </View>
          <Text style={{ color: COLORS.textLight, marginTop: 6 }}>
            {name.trim().length}/60 characters
          </Text>

          {/* Priority (required) */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            <Ionicons name="flame-outline" size={16} color={COLORS.text} /> Priority *
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8, paddingRight: 8 }}
          >
            <View style={{ flexDirection: "row" }}>
              {PRIORITY_VALUES.map((p) => {
                const selected = p === priority;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Priority ${p}`}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                      backgroundColor: selected ? COLORS.primary : "transparent",
                      borderWidth: 1,
                      borderColor: selected ? COLORS.primary : COLORS.border || "#ccc",
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? COLORS.white : COLORS.text,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Track By (required) */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            <Ionicons name="options-outline" size={16} color={COLORS.text} /> Track By *
          </Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="funnel-outline"
              size={22}
              color={COLORS.textLight}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="e.g., duration, count, completion"
              placeholderTextColor={COLORS.textLight}
              value={trackBy}
              onChangeText={setTrackBy}
              autoCapitalize="none"
              returnKeyType="done"
              maxLength={60}
            />
          </View>

          {/* Categories (optional) */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            <Ionicons name="pricetags-outline" size={16} color={COLORS.text} /> Categories
          </Text>
          <View style={[styles.inputContainer, { alignItems: "center" }]}>
            <Ionicons
              name="list-outline"
              size={22}
              color={COLORS.textLight}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { paddingRight: 40 }]}
              placeholder="Add a category (e.g., Health, Work)"
              placeholderTextColor={COLORS.textLight}
              value={categoryInput}
              onChangeText={setCategoryInput}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={addCategory}
              maxLength={40}
            />
            <TouchableOpacity
              onPress={addCategory}
              style={{ position: "absolute", right: 12, padding: 4 }}
              accessibilityLabel="Add category"
            >
              <Ionicons name="add-circle" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {categories.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
              {categories.map((c) => (
                <View
                  key={c}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: COLORS.border || "#d0d0d0",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 14,
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: COLORS.text, fontSize: 13 }}>{c}</Text>
                  <TouchableOpacity onPress={() => removeCategory(c)}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={COLORS.textLight}
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Goals (required) */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            <Ionicons name="trophy-outline" size={16} color={COLORS.text} /> Goals *
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Yearly Goal (number > 0)"
              placeholderTextColor={COLORS.textLight}
              value={yearlyGoal}
              onChangeText={setYearlyGoal}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Monthly Goal (number > 0)"
              placeholderTextColor={COLORS.textLight}
              value={monthlyGoal}
              onChangeText={setMonthlyGoal}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Weekly Goal (number > 0)"
              placeholderTextColor={COLORS.textLight}
              value={weeklyGoal}
              onChangeText={setWeeklyGoal}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Daily Goal (number > 0)"
              placeholderTextColor={COLORS.textLight}
              value={dailyGoal}
              onChangeText={setDailyGoal}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* Same times every day */}
          <View
            style={{
              marginTop: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="copy-outline" size={18} color={COLORS.text} />
              <Text style={{ marginLeft: 8, color: COLORS.text, fontWeight: "600" }}>
                Same times every day
              </Text>
            </View>
            <Switch
              value={sameTimesEveryDay}
              onValueChange={(v) => {
                setSameTimesEveryDay(v);
                setPickerForDay(null);
              }}
              trackColor={{ true: COLORS.primary, false: COLORS.border || "#ccc" }}
              thumbColor={COLORS.white}
            />
          </View>

          {/* Schedule (required) */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.text} /> Schedule *
          </Text>

          {sameTimesEveryDay ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: COLORS.textLight, marginBottom: 8 }}>Every day</Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {everyDayTimes.map((t) => (
                  <View
                    key={t}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: COLORS.border || "#d0d0d0",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 14,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: COLORS.text, fontSize: 13 }}>{t}</Text>
                    <TouchableOpacity onPress={() => removeEveryDayTime(t)}>
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={COLORS.textLight}
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity onPress={onOpenPickerAll} style={{ marginTop: 4, alignSelf: "flex-start" }}>
                <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              {pickerForDay === "ALL" && Platform.OS === "ios" && (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker mode="time" value={tempTime} onChange={onTimeChange} display="spinner" />
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
                    <TouchableOpacity
                      onPress={() => setPickerForDay(null)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 }}
                    >
                      <Text style={{ color: COLORS.textLight }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddFromIOS}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: COLORS.primary,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: COLORS.white, fontWeight: "600" }}>Add Time</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {pickerForDay === "ALL" && Platform.OS === "android" && (
                <DateTimePicker mode="time" value={tempTime} onChange={onTimeChange} />
              )}
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 8, paddingRight: 8 }}
              >
                <View style={{ flexDirection: "row" }}>
                  {DAY_LABELS.map((d, idx) => {
                    const hasTimes = dayTimes[idx].length > 0;
                    return (
                      <View key={d.full} style={{ alignItems: "center", width: DAY_COL_WIDTH, marginRight: 12 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: hasTimes ? COLORS.primary : "transparent",
                            borderWidth: 1,
                            borderColor: hasTimes ? COLORS.primary : COLORS.border || "#ccc",
                          }}
                        >
                          <Text
                            style={{
                              color: hasTimes ? COLORS.white : COLORS.text,
                              fontWeight: "700",
                              fontSize: d.short.length === 2 ? 12 : 14,
                            }}
                          >
                            {d.short}
                          </Text>
                        </View>

                        <View style={{ marginTop: 8, minHeight: 22 }}>
                          {dayTimes[idx].map((t) => (
                            <View
                              key={t}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: COLORS.border || "#d0d0d0",
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 12,
                                marginBottom: 6,
                                maxWidth: DAY_COL_WIDTH - 8,
                              }}
                            >
                              <Text style={{ color: COLORS.text, fontSize: 12 }}>{t}</Text>
                              <TouchableOpacity onPress={() => removeTime(idx, t)}>
                                <Ionicons
                                  name="close-circle"
                                  size={14}
                                  color={COLORS.textLight}
                                  style={{ marginLeft: 6 }}
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>

                        <TouchableOpacity onPress={() => onOpenPicker(idx)} style={{ marginTop: 4 }}>
                          <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {pickerForDay !== null && pickerForDay !== "ALL" && Platform.OS === "ios" && (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker mode="time" value={tempTime} onChange={onTimeChange} display="spinner" />
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
                    <TouchableOpacity
                      onPress={() => setPickerForDay(null)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 }}
                    >
                      <Text style={{ color: COLORS.textLight }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddFromIOS}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: COLORS.primary,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: COLORS.white, fontWeight: "600" }}>Add Time</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {pickerForDay !== null && pickerForDay !== "ALL" && Platform.OS === "android" && (
                <DateTimePicker mode="time" value={tempTime} onChange={onTimeChange} />
              )}
            </>
          )}
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default CreateScreen;
