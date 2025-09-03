import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { API_URL } from "@/constants/api";

type TaskType = { id: string; name: string };

export default function TaskTypePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (t: TaskType) => void;
}) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TaskType[]>([]);

  useEffect(() => {
    if (!visible || !user?.id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/taskType/user/${encodeURIComponent(user.id)}`);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? ` - ${body}` : ""}`);
        }
        const data = await res.json();
        setItems(
          (Array.isArray(data) ? data : []).map((r: any) => ({
            id: String(r.id),
            name: r.name ?? "Untitled",
          }))
        );
      } catch (e: any) {
        setError(e?.message || "Failed to load task types");
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, user?.id]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            marginTop: "auto",
            backgroundColor: "white",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 16,
            minHeight: 280,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View style={{ width: 40, height: 5, backgroundColor: "#ddd", borderRadius: 999 }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Go to Task Type</Text>

          {loading && <ActivityIndicator />}
          {error && <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text>}

          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => ({
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: pressed ? "#eee" : "#f7f7f7",
                })}
              >
                <Text style={{ fontSize: 16 }}>{item.name}</Text>
              </Pressable>
            )}
            ListEmptyComponent={!loading ? <Text style={{ color: "#666" }}>No task types yet.</Text> : null}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: pressed ? "#ddd" : "#eaeaea",
            })}
          >
            <Text>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
