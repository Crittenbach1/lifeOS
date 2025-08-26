// app/(tabs)/index.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import TaskCard from "../../components/TaskCard";
import PageLoader from "../../components/PageLoader";
import { styles } from "../../assets/styles/home.styles";
import { API_URL } from "../../constants/api";

type TaskItem = {
  id: number;
  tasktypeid: number;
  name: string | null;
  amount: number | null; // normalized below
  description: string | null;
  taskcategory: string | null;
  created_at: string; // from DB
  updated_at: string;
};

const TZ = "America/New_York";

export default function Page() {
  const { isLoaded, user } = useUser();
  const [items, setItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // With server mount: app.use("/api/taskItem", taskItemRoutes)
  // and router path: router.get("/today/:userId", ...)
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
        // capture text for easier debugging
        let body: any = "";
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
      console.error("Failed to load today's task items:", e);
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
    <View style={styles.container}>
      <View style={styles.content}>
        <TaskCard />

        <SignedIn>
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
              Completed Today (EST)
            </Text>

            {errorMsg ? (
              <Text style={{ color: "#b00020", marginBottom: 8 }}>
                {errorMsg}
              </Text>
            ) : null}

            {loading ? (
              <ActivityIndicator />
            ) : items.length === 0 ? (
              <Text style={{ opacity: 0.6 }}>No items yet today.</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 320 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                }
              >
                {items.map((it) => (
                  <View
                    key={it.id}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: "#eee",
                    }}
                  >
                    <Text style={{ fontWeight: "600" }}>
                      {it.name ?? "Untitled task"}
                    </Text>

                    <Text style={{ opacity: 0.7 }}>
                      {it.taskcategory ? `${it.taskcategory} • ` : ""}
                      {it.amount !== null && !Number.isNaN(it.amount)
                        ? formatCurrency(it.amount)
                        : "—"}
                    </Text>

                    <Text style={{ opacity: 0.6 }}>
                      {formatInTZ(it.created_at, TZ)}
                    </Text>

                    {it.description ? (
                      <Text style={{ marginTop: 4, opacity: 0.75 }}>
                        {it.description}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </SignedIn>

        <SignedOut>
          <Text style={{ marginTop: 24, opacity: 0.7 }}>
            Sign in to see today’s completed items.
          </Text>
        </SignedOut>
      </View>
    </View>
  );
}

/** Format a DB timestamp in a target timezone (EST/EDT) */
function formatInTZ(ts: string, timeZone: string) {
  // If timestamp is naive (no Z or offset), assume UTC to avoid device-local ambiguity.
  const looksNaive =
    ts &&
    /\d{2}:\d{2}:\d{2}/.test(ts) &&
    !/[zZ]|[+\-]\d{2}:\d{2}$/.test(ts);
  const iso = looksNaive ? `${ts}Z` : ts;

  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}
