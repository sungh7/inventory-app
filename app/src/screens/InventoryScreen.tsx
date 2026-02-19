import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "../api/client";
import { InventoryItem } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  meat: "🥩 육류", vegetable: "🥬 채소",
  sauce: "🫙 소스", drink: "🥤 음료", other: "📦 기타",
};

function StockCard({ item }: { item: InventoryItem }) {
  const urgent = item.is_low_stock || item.is_expiring_soon;
  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.item_name}</Text>
        <Text style={styles.cardCategory}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.quantity}>
          {item.quantity} <Text style={styles.unit}>{item.unit}</Text>
        </Text>
        {item.is_low_stock && <Text style={styles.badge}>⚠️ 재고 부족</Text>}
        {item.is_expiring_soon && (
          <Text style={styles.badgeExp}>🕐 {item.expiry_date} 만료임박</Text>
        )}
      </View>
    </View>
  );
}

export default function InventoryScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inventoryApi.list().then((r) => r.data as InventoryItem[]),
  });

  // [W-9] 에러 상태 처리
  if (isError) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#999", marginBottom: 12 }}>데이터를 불러올 수 없습니다</Text>
      <TouchableOpacity onPress={() => refetch()} style={{ padding: 12, backgroundColor: "#4CAF50", borderRadius: 8 }}>
        <Text style={{ color: "#fff" }}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item) => String(item.item_id)}
      renderItem={({ item }) => <StockCard item={item} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      ListEmptyComponent={
        <Text style={styles.empty}>{isLoading ? "로딩 중..." : "재고 데이터가 없습니다"}</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, elevation: 2 },
  cardUrgent: { borderLeftWidth: 4, borderLeftColor: "#FF5722" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardCategory: { fontSize: 12, color: "#666" },
  cardBody: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  quantity: { fontSize: 24, fontWeight: "800", color: "#333" },
  unit: { fontSize: 14, fontWeight: "400", color: "#666" },
  badge: { fontSize: 12, color: "#FF5722", fontWeight: "600" },
  badgeExp: { fontSize: 12, color: "#FF9800", fontWeight: "600" },
  empty: { textAlign: "center", color: "#999", marginTop: 60, fontSize: 15 },
});
