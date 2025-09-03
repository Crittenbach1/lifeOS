// app/(root)/index.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import TaskCard from "../../components/TaskCard";
import PageLoader from "../../components/PageLoader";
import { API_URL } from "../../constants/api";

type TaskItem = {
  id: number;
  tasktypeid: number;
  name: string | null;
  amount: number | null;
  description: string | null;
  taskcategory: string | null;
  created_at: string;
  updated_at: string;
};

const TZ = "America/New_York";
const NAVY = "#0a2540";

// We call the API with tz= on this page; server likely returns localized wall-clock.
const SERVER_RETURNS_LOCALIZED_TIME = true;

export default function Page() {
  const { isLoaded, user } = useUser();
  const [items, setItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const url = useMemo(() => {
    if (!user?.id) return null;
    return `${API_URL}/taskItem/today/${encodeURIComponent(
      user.id
    )}?tz=${encodeURIComponent(TZ)}`;
  }, [user?.id]);

  const fetchToday = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let body = "";
        try {
          body = await res.text();
        } catch {}
        throw new Error(`HTTP ${res.status}${body ? ` - ${body}` : ""}`);
      }
      const raw = await res.json();
      const normalized: TaskItem[] = (Array.isArray(raw) ? raw : []).map(
        (r: any) => ({
          ...r,
          amount:
            r.amount === null || r.amount === undefined || r.amount === ""
              ? null
              : Number(r.amount),
        })
      );
      setItems(normalized);
    } catch (e: any) {
      setErrorMsg(String(e?.message || e) ?? "Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (user?.id) fetchToday();
  }, [user?.id, fetchToday]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchToday();
    } finally {
      setRefreshing(false);
    }
  }, [fetchToday]);

  if (!isLoaded) return <PageLoader />;

  return (
    <View style={{ flex: 1, backgroundColor: NAVY }}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 20, // navy blue space before the first card
          paddingBottom: 24,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            titleColor="#fff"
          />
        }
      >
        <SignedIn>
          {/* Current Task card */}
          <View
            style={{
              marginHorizontal: 16,
              backgroundColor: "#fff",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#e6e6e6",
              padding: 14,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <TaskCard onCompleted={fetchToday} />
          </View>

          {/* Completed Today card */}
          <View
            style={{
              marginHorizontal: 16,
              backgroundColor: "#fff",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#e6e6e6",
              padding: 14,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }}
              >
                Completed Today
              </Text>
              <Text style={{ fontSize: 12, color: "#6b7280" }}>({TZ})</Text>
            </View>

            {errorMsg ? (
              <Text style={{ color: "#b00020", marginBottom: 8 }}>
                {errorMsg}
              </Text>
            ) : null}

            {loading ? (
              <ActivityIndicator />
            ) : items.length === 0 ? (
              <Text style={{ opacity: 0.6, color: "#334155" }}>
                No items yet today.
              </Text>
            ) : (
              <View>
                {items.map((it) => (
                  <View
                    key={it.id}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: "#f1f1f1",
                    }}
                  >
                    {/* Line 1: name | amount | time */}
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ color: "#111827" }}
                    >
                      <Text style={{ fontWeight: "700" }}>
                        {formatName(it.name)}
                      </Text>
                      {"  |  "}
                      {it.amount !== null && !Number.isNaN(it.amount)
                        ? formatAmount(it.amount)
                        : "—"}
                      {"  |  "}
                      {formatInTZ(it.created_at, TZ)}
                    </Text>

                    {/* Line 2: category (if present) */}
                    {it.taskcategory && it.taskcategory.trim().length ? (
                      <Text
                        style={{
                          marginTop: 2,
                          color: "#6b7280",
                          fontSize: 12,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {it.taskcategory.trim()}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </SignedIn>

        <SignedOut>
          <Text
            style={{
              marginTop: 16,
              color: "#e5e7eb",
              opacity: 0.9,
              paddingHorizontal: 16,
            }}
          >
            Sign in to see today’s completed items.
          </Text>
        </SignedOut>
      </ScrollView>
    </View>
  );
}

function formatName(name: string | null) {
  return name?.trim().length ? name.trim() : "Untitled task";
}

function formatAmount(n: number) {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(2);
  return s.replace(/\.00$/, ""); // drop .00 if exact
}

/**
 * Formats timestamp for display in `timeZone`.
 * - If the string has no zone, treat it as already in `timeZone` (no shift).
 * - If the string has a zone but the server already localized using `tz=`,
 *   strip the zone and treat it as wall-clock time (prevents double shift).
 * - Otherwise, convert normally using the provided zone.
 */
function formatInTZ(ts: string, timeZone: string) {
  if (!ts) return "";

  const hasZone = /[zZ]|[+\-]\d{2}:\d{2}$/.test(ts);

  const formatNaive = (naive: string) => {
    const m = naive.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (!m) return naive;
    const [, y, mo, da, h, mi, s = "00"] = m;
    const dt = new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +s));
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC", // keep wall-clock the same
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(dt);
  };

  if (!hasZone) return formatNaive(ts);

  if (SERVER_RETURNS_LOCALIZED_TIME) {
    const stripped = ts.replace(/[zZ]|[+\-]\d{2}:\d{2}$/, "");
    return formatNaive(stripped);
  }

  const d = new Date(ts);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
