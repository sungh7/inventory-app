import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { BarChart } from "react-native-gifted-charts";
import { aiApi } from "../api/client";

const PERIOD_OPTIONS = [
  { label: "7일", value: 7 },
  { label: "14일", value: 14 },
  { label: "30일", value: 30 },
];

const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <Text style={[styles.trend, { color: "#E53935" }]}>↗</Text>;
  if (trend === "down") return <Text style={[styles.trend, { color: "#1E88E5" }]}>↘</Text>;
  return <Text style={[styles.trend, { color: "#6D6D6D" }]}>→</Text>;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "high") return <Text style={[styles.badge, styles.badgeHigh]}>🟢 높음</Text>;
  if (confidence === "medium") return <Text style={[styles.badge, styles.badgeMedium]}>🟡 중간</Text>;
  return <Text style={[styles.badge, styles.badgeLow]}>🔴 낮음</Text>;
}

export default function AIForecastScreen() {
  const [period, setPeriod] = useState(14);
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ai-forecast", period],
    queryFn: () => aiApi.forecastAll(period).then((r) => r.data),
  });

  const listData = useMemo(() => data ?? [], [data]);

  // [W-9] 에러 상태 처리
  if (isError) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#999", marginBottom: 12 }}>데이터를 불러올 수 없습니다</Text>
      <TouchableOpacity onPress={() => refetch()} style={{ padding: 12, backgroundColor: "#4CAF50", borderRadius: 8 }}>
        <Text style={{ color: "#fff" }}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const barData = (item.weekday_pattern ?? []).map((v: number, idx: number) => ({
      value: v,
      label: WEEK_LABELS[idx],
      frontColor: "#4CAF50",
    }));

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <Text style={styles.itemUnit}>단위: {item.unit}</Text>
          </View>
          <View style={styles.rightCol}>
            <TrendIcon trend={item.trend} />
            <ConfidenceBadge confidence={item.confidence} />
          </View>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.forecast_total}</Text>
            <Text style={styles.statLabel}>예측 총소비</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.daily_avg}</Text>
            <Text style={styles.statLabel}>일평균</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.data_points}</Text>
            <Text style={styles.statLabel}>데이터일수</Text>
          </View>
        </View>

        {barData.length > 0 ? (
          <BarChart
            data={barData}
            barWidth={12}
            spacing={6}
            roundedTop
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            noOfSections={3}
            maxValue={Math.max(...barData.map((d: any) => d.value)) * 1.2}
            labelWidth={22}
            xAxisLabelTextStyle={{ fontSize: 9, color: "#666" }}
          />
        ) : (
          <Text style={styles.empty}>데이터 없음</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AI 소비 예측</Text>
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

      <FlatList
        data={listData}
        keyExtractor={(item) => String(item.item_id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={<Text style={styles.empty}>예측 데이터 없음</Text>}
      />

      {/* 상세 모달 */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View style={styles.modalContent}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>{selected.item_name} 상세</Text>
                <Text style={styles.modalSub}>예측 {period}일 · 단위 {selected.unit}</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>예측 총소비</Text>
                  <Text style={styles.modalValue}>{selected.forecast_total}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>일평균</Text>
                  <Text style={styles.modalValue}>{selected.daily_avg}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>트렌드</Text>
                  <Text style={styles.modalValue}>{selected.trend}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>신뢰도</Text>
                  <Text style={styles.modalValue}>{selected.confidence}</Text>
                </View>

                <Text style={styles.modalChartTitle}>요일 패턴</Text>
                <BarChart
                  data={(selected.weekday_pattern ?? []).map((v: number, idx: number) => ({
                    value: v,
                    label: WEEK_LABELS[idx],
                    frontColor: "#4CAF50",
                  }))}
                  barWidth={20}
                  spacing={12}
                  roundedTop
                  hideRules
                  xAxisThickness={0}
                  yAxisThickness={0}
                  noOfSections={4}
                  maxValue={Math.max(...(selected.weekday_pattern ?? [1])) * 1.2}
                  labelWidth={30}
                  xAxisLabelTextStyle={{ fontSize: 10, color: "#666" }}
                />

                <View style={styles.orderHint}>
                  <Text style={styles.orderHintTitle}>발주 필요 여부</Text>
                  <Text style={styles.orderHintText}>
                    현재 재고와 예측 소비량을 비교해 발주가 필요하면 🚨 로 표시됩니다.
                  </Text>
                </View>

                <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeText}>닫기</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#2E7D32", marginBottom: 10 },
  periodRow: { flexDirection: "row", gap: 6 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "#eee" },
  periodBtnActive: { backgroundColor: "#4CAF50" },
  periodText: { fontSize: 12, color: "#555" },
  periodTextActive: { color: "#fff", fontWeight: "700" },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: "700", color: "#222" },
  itemUnit: { fontSize: 12, color: "#777", marginTop: 2 },
  rightCol: { alignItems: "flex-end", gap: 6 },
  trend: { fontSize: 18, fontWeight: "800" },

  badge: { fontSize: 11, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, overflow: "hidden" },
  badgeHigh: { backgroundColor: "#E8F5E9", color: "#2E7D32" },
  badgeMedium: { backgroundColor: "#FFFDE7", color: "#F9A825" },
  badgeLow: { backgroundColor: "#FFEBEE", color: "#C62828" },

  cardStats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statBox: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 16, fontWeight: "700", color: "#333" },
  statLabel: { fontSize: 11, color: "#777", marginTop: 2 },

  empty: { textAlign: "center", color: "#bbb", paddingVertical: 20, fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    minHeight: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#2E7D32" },
  modalSub: { fontSize: 12, color: "#666", marginBottom: 12 },
  modalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  modalLabel: { fontSize: 12, color: "#666" },
  modalValue: { fontSize: 14, fontWeight: "700", color: "#333" },
  modalChartTitle: { marginTop: 12, marginBottom: 8, fontSize: 13, fontWeight: "700", color: "#333" },

  orderHint: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: "#F1F8E9" },
  orderHintTitle: { fontSize: 13, fontWeight: "700", color: "#2E7D32" },
  orderHintText: { fontSize: 12, color: "#666", marginTop: 6 },

  closeBtn: { marginTop: 16, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, backgroundColor: "#4CAF50" },
  closeText: { color: "#fff", fontWeight: "700" },
});
