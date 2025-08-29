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
  amount: number | null;
  description: string | null;
  taskcategory: string | null;
  created_at: string;
  updated_at: string;
};

const TZ = "America/New_York";

export default function Page() {
  const { isLoaded, user } = useUser();
  const [items, setItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const url = useMemo(() => {
    if (!user?.id) return null;
    const u = `${API_URL}/taskItem/today/${encodeURIComponent(user.id)}?tz=${encodeURIComponent(TZ)}`;
    console.log("fetch URL:", u);
    return u;
  }, [user?.id]);

  const fetchToday = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let body = "";
        try { body = await res.text(); } catch {}
        throw new Error(`HTTP ${res.status}${body ? ` - ${body}` : ""}`);
      }
      const raw = await res.json();
      console.log("today items raw:", raw);

      const normalized: TaskItem[] = (Array.isArray(raw) ? raw : []).map((r: any) => ({
        ...r,
        amount:
          r.amount === null || r.amount === undefined || r.amount === ""
            ? null
            : Number(r.amount),
      }));
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
    <View style={{ flex: 1, backgroundColor: "white" }}>
      {/* One ScrollView controls the whole page layout */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Card at top */}
        <TaskCard />

        {/* List immediately after the card */}
        <SignedIn>
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
              Completed Today (EST)
            </Text>

            {errorMsg ? (
              <Text style={{ color: "#b00020", marginBottom: 8 }}>{errorMsg}</Text>
            ) : null}

            {loading ? (
              <ActivityIndicator />
            ) : items.length === 0 ? (
              <Text style={{ opacity: 0.6 }}>No items yet today.</Text>
            ) : (
              <View>
                {items.map((it) => (
                  <View
                    key={it.id}
                    style={{
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#eee",
                    }}
                  >
                    {/* One line: Name | Amount | Completed at time */}
                    <Text numberOfLines={1} ellipsizeMode="tail">
                      <Text style={{ fontWeight: "600" }}>{formatName(it.name)}</Text>
                      {" | "}
                      {it.amount !== null && !Number.isNaN(it.amount) ? formatCurrency(it.amount) : "—"}
                      {" | "}
                      {formatInTZ(it.created_at, TZ)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </SignedIn>

        <SignedOut>
          <Text style={{ marginTop: 16, opacity: 0.7 }}>
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

function formatInTZ(ts: string, timeZone: string) {
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
