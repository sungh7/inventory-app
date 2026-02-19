import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { transactionsApi } from "../api/client";
import { Transaction, TransactionType } from "../types";
import dayjs from "dayjs";

const TYPE_META: Record<TransactionType, { label: string; color: string }> = {
  in:      { label: "입고", color: "#4CAF50" },
  out:     { label: "출고", color: "#2196F3" },
  dispose: { label: "폐기", color: "#F44336" },
};

const FILTERS: { label: string; value?: TransactionType }[] = [
  { label: "전체" },
  { label: "입고", value: "in" },
  { label: "출고", value: "out" },
  { label: "폐기", value: "dispose" },
];

function TxCard({ tx }: { tx: Transaction }) {
  const meta = TYPE_META[tx.type];
  return (
    <View style={styles.card}>
      <View style={[styles.typeBadge, { backgroundColor: meta.color }]}>
        <Text style={styles.typeBadgeText}>{meta.label}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{tx.item_name ?? `품목 #${tx.item_id}`}</Text>
        <Text style={styles.qty}>
          {tx.type === "in" ? "+" : "-"}{tx.quantity}
          {tx.expiry_date ? `  •  유통기한 ${tx.expiry_date}` : ""}
        </Text>
        {tx.memo ? <Text style={styles.memo}>{tx.memo}</Text> : null}
        {/* [M-1] 날짜/시간 표시 */}
        {tx.created_at ? (
          <Text style={styles.date}>{dayjs(tx.created_at).format("MM/DD HH:mm")}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [filter, setFilter] = useState<TransactionType | undefined>(undefined);
  // [W-17] 더보기 방식 페이지 로딩
  const [limit, setLimit] = useState(50);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", filter, limit],
    queryFn: () =>
      transactionsApi
        .list(filter ? { type: filter, limit } : { limit })
        .then((r) => r.data as Transaction[]),
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
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
            onPress={() => {
              setFilter(f.value);
              setLimit(50); // 필터 변경 시 limit 초기화
            }}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(tx) => String(tx.id)}
        renderItem={({ item }) => <TxCard tx={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "로딩 중..." : "이력이 없습니다"}</Text>
        }
        ListFooterComponent={
          (data?.length ?? 0) >= limit ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => setLimit((prev) => prev + 50)}
            >
              <Text style={styles.loadMoreText}>더보기</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff", elevation: 2 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: "#eee" },
  filterBtnActive: { backgroundColor: "#4CAF50" },
  filterText: { fontSize: 13, color: "#555", fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", elevation: 1 },
  typeBadge: { width: 52, justifyContent: "center", alignItems: "center" },
  typeBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  cardContent: { flex: 1, padding: 12 },
  itemName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  qty: { fontSize: 13, color: "#555" },
  memo: { fontSize: 12, color: "#999", marginTop: 4 },
  date: { fontSize: 11, color: "#bbb", marginTop: 4 },
  empty: { textAlign: "center", color: "#999", marginTop: 60, fontSize: 15 },
  loadMoreBtn: {
    margin: 16, padding: 12, backgroundColor: "#4CAF50",
    borderRadius: 8, alignItems: "center",
  },
  loadMoreText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
