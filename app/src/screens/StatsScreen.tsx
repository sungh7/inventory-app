import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { statsApi } from "../api/client";

const PERIOD_OPTIONS = [
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
];

const CATEGORY_COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#E91E63", "#9C27B0"];

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.summaryCard, { borderTopColor: color }]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const [period, setPeriod] = useState(7);

  const { data: summary, refetch: refetchSummary, isLoading: loadingSummary, isError } =
    useQuery({ queryKey: ["stats-summary"], queryFn: () => statsApi.summary().then(r => r.data) });

  const { data: consumption, refetch: refetchConsumption } =
    useQuery({ queryKey: ["stats-consumption", period], queryFn: () => statsApi.consumption(period).then(r => r.data) });

  // [W-10] refetch 함수 추가
  const { data: disposal, refetch: refetchDisposal } =
    useQuery({ queryKey: ["stats-disposal"], queryFn: () => statsApi.disposal(30).then(r => r.data) });

  const { data: categoryStock, refetch: refetchCategory } =
    useQuery({ queryKey: ["stats-category"], queryFn: () => statsApi.categoryStock().then(r => r.data) });

  const refetchAll = () => {
    refetchSummary();
    refetchConsumption();
    refetchDisposal();
    refetchCategory();
  };

  // 바 차트 데이터
  const barData = (consumption ?? []).slice(0, 6).map((item: any, i: number) => ({
    value: item.total,
    label: item.name.length > 4 ? item.name.slice(0, 4) + "…" : item.name,
    frontColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  // 파이 차트 데이터
  const pieData = (categoryStock ?? []).map((c: any, i: number) => ({
    value: c.total_qty,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    text: c.label,
  }));

  // [W-9] 에러 상태 처리
  if (isError) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#999", marginBottom: 12 }}>데이터를 불러올 수 없습니다</Text>
      <TouchableOpacity onPress={refetchAll} style={{ padding: 12, backgroundColor: "#4CAF50", borderRadius: 8 }}>
        <Text style={{ color: "#fff" }}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loadingSummary} onRefresh={refetchAll} />}
    >
      {/* 요약 카드 */}
      <Text style={styles.sectionTitle}>📊 오늘 요약</Text>
      <View style={styles.summaryRow}>
        <SummaryCard label="전체 품목" value={summary?.total_items ?? "-"} color="#2196F3" />
        <SummaryCard label="재고 부족" value={summary?.low_stock_count ?? "-"} color="#F44336" />
        <SummaryCard label="만료 임박" value={summary?.expiring_soon_count ?? "-"} color="#FF9800" />
      </View>
      <View style={styles.summaryRow}>
        <SummaryCard label="오늘 입고" value={`${summary?.today_in ?? 0}`} color="#4CAF50" />
        <SummaryCard label="오늘 출고" value={`${summary?.today_out ?? 0}`} color="#9C27B0" />
      </View>

      {/* 소비량 바 차트 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 소비량 TOP 6</Text>
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
                onPress={() => setPeriod(p.value)}
              >
                <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {barData.length > 0 ? (
          <BarChart
            data={barData}
            barWidth={36}
            spacing={12}
            roundedTop
            hideRules
            xAxisThickness={1}
            yAxisThickness={0}
            noOfSections={4}
            maxValue={Math.max(...barData.map((d: any) => d.value)) * 1.2}
            labelWidth={50}
            xAxisLabelTextStyle={{ fontSize: 10, color: "#666" }}
          />
        ) : (
          <Text style={styles.empty}>데이터 없음</Text>
        )}
      </View>

      {/* 카테고리별 재고 파이 차트 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗂️ 카테고리별 재고</Text>
        {pieData.length > 0 ? (
          <>
            <PieChart
              data={pieData}
              donut
              showText
              textColor="#333"
              radius={100}
              innerRadius={55}
              centerLabelComponent={() => (
                <Text style={{ fontSize: 12, color: "#666" }}>재고 비율</Text>
              )}
            />
            <View style={styles.legend}>
              {pieData.map((item: any, i: number) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.empty}>데이터 없음</Text>
        )}
      </View>

      {/* 폐기 손실 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗑️ 폐기 손실 (30일)</Text>
        <View style={styles.lossBox}>
          <Text style={styles.lossAmount}>
            ₩{(disposal?.total_loss_krw ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.lossLabel}>총 원가 손실</Text>
        </View>
        {(disposal?.items ?? []).map((item: any) => (
          <View key={item.item_id} style={styles.lossRow}>
            <Text style={styles.lossItemName}>{item.name}</Text>
            <Text style={styles.lossItemDetail}>
              {item.disposed_qty}{" "}폐기 · ₩{item.loss_krw.toLocaleString()} 손실
            </Text>
          </View>
        ))}
        {(disposal?.items ?? []).length === 0 && (
          <Text style={styles.empty}>폐기 내역 없음 ✅</Text>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  summaryCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10,
    padding: 14, alignItems: "center", borderTopWidth: 3, elevation: 1,
  },
  summaryValue: { fontSize: 24, fontWeight: "800", color: "#222" },
  summaryLabel: { fontSize: 11, color: "#888", marginTop: 4 },
  section: { backgroundColor: "#fff", margin: 16, borderRadius: 12, padding: 16, elevation: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  periodRow: { flexDirection: "row", gap: 6 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#eee" },
  periodBtnActive: { backgroundColor: "#4CAF50" },
  periodText: { fontSize: 12, color: "#555" },
  periodTextActive: { color: "#fff", fontWeight: "700" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#555" },
  lossBox: { alignItems: "center", paddingVertical: 16, marginBottom: 12 },
  lossAmount: { fontSize: 32, fontWeight: "800", color: "#F44336" },
  lossLabel: { fontSize: 13, color: "#888", marginTop: 4 },
  lossRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  lossItemName: { fontSize: 14, fontWeight: "600" },
  lossItemDetail: { fontSize: 12, color: "#666" },
  empty: { textAlign: "center", color: "#bbb", paddingVertical: 20, fontSize: 14 },
});
