import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/client";
import { MonthlyReport, MenuPerformance } from "../types";

const GREEN = "#4CAF50";
const ORANGE = "#FF9800";
const RED = "#F44336";
const YELLOW = "#FFC107";
const BG = "#F5F5F5";
const CARD_BG = "#FFFFFF";

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function marginColor(rate: number): string {
  if (rate >= 60) return GREEN;
  if (rate >= 40) return YELLOW;
  return RED;
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

/** 요약 카드 1개 */
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

/** 간단한 바차트 (react-native-gifted-charts 없이 View로 구현) */
function SimpleBarChart({
  revenueData,
  costData,
  labels,
}: {
  revenueData: number[];
  costData: number[];
  labels: string[];
}) {
  const maxVal = Math.max(...revenueData, ...costData, 1);

  return (
    <View style={styles.chartContainer}>
      {revenueData.map((rev, i) => {
        const revH = (rev / maxVal) * 100;
        const costH = ((costData[i] ?? 0) / maxVal) * 100;
        return (
          <View key={i} style={styles.barGroup}>
            <View style={styles.bars}>
              <View style={[styles.bar, { height: revH, backgroundColor: GREEN }]} />
              <View style={[styles.bar, { height: costH, backgroundColor: ORANGE }]} />
            </View>
            <Text style={styles.barLabel}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** 게이지 바 */
function GaugeBar({
  label,
  value,
  target,
  targetLabel,
  goodBelow = true,
}: {
  label: string;
  value: number;
  target: number;
  targetLabel: string;
  goodBelow?: boolean;
}) {
  const clamped = Math.min(value, 100);
  const isGood = goodBelow ? value <= target : value >= target;
  const barColor = isGood ? GREEN : RED;

  return (
    <View style={styles.gaugeRow}>
      <View style={styles.gaugeLabelRow}>
        <Text style={styles.gaugeLabel}>{label}</Text>
        <Text style={[styles.gaugeValue, { color: barColor }]}>{value.toFixed(1)}%</Text>
      </View>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${clamped}%`, backgroundColor: barColor }]} />
        {/* 목표치 마커 */}
        <View style={[styles.gaugeTarget, { left: `${target}%` as any }]} />
      </View>
      <Text style={styles.gaugeTargetLabel}>{targetLabel}</Text>
    </View>
  );
}

/** 메뉴 성과 행 */
function MenuRow({ item, index }: { item: MenuPerformance; index: number }) {
  const mc = marginColor(item.margin_rate);
  return (
    <View style={styles.menuRow}>
      <Text style={styles.menuRank}>{index + 1}</Text>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.menuSub}>
          {item.sale_count}건 · {formatKRW(item.total_revenue)}
        </Text>
      </View>
      <View style={[styles.marginBadge, { backgroundColor: mc }]}>
        <Text style={styles.marginBadgeText}>{item.margin_rate.toFixed(1)}%</Text>
      </View>
    </View>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────
export default function ReportScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const {
    data: report,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<MonthlyReport>({
    queryKey: ["monthly-report", year, month],
    queryFn: async () => {
      const res = await reportsApi.monthly(year, month);
      return res.data as MonthlyReport;
    },
    retry: 1,
  });

  // ── 주차 레이블 ──
  const weekLabels =
    report?.revenue.by_week.map((_, i) => `${i + 1}주`) ?? [];

  // ── 판매 0건 체크 ──
  const isEmpty = report && report.revenue.total === 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={GREEN}
        />
      }
    >
      {/* ── 월 선택기 ── */}
      <View style={styles.monthPicker}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {year}년 {month}월
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── 로딩 ── */}
      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      )}

      {/* ── 에러 ── */}
      {isError && !isLoading && (
        <View style={styles.center}>
          <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── 빈 데이터 ── */}
      {isEmpty && !isLoading && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>이 월의 판매 데이터가 없습니다</Text>
        </View>
      )}

      {/* ── 데이터 있음 ── */}
      {report && !isLoading && !isEmpty && (
        <>
          {/* 섹션 1: 월간 요약 카드 2×2 */}
          <Text style={styles.sectionTitle}>월간 요약</Text>
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="총 매출"
              value={formatKRW(report.revenue.total)}
            />
            <SummaryCard
              label="재료비"
              value={formatKRW(report.cost.total_ingredient)}
              color={ORANGE}
            />
            <SummaryCard
              label="마진"
              value={formatKRW(report.margin.total)}
              color={GREEN}
            />
            <SummaryCard
              label="마진율"
              value={`${report.margin.rate.toFixed(1)}%`}
              color={marginColor(report.margin.rate)}
            />
          </View>

          {/* 섹션 2: 주차별 바차트 */}
          <Text style={styles.sectionTitle}>주차별 매출 / 원가</Text>
          <View style={styles.card}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
              <Text style={styles.legendText}>매출</Text>
              <View
                style={[styles.legendDot, { backgroundColor: ORANGE, marginLeft: 12 }]}
              />
              <Text style={styles.legendText}>원가</Text>
            </View>
            <SimpleBarChart
              revenueData={report.revenue.by_week}
              costData={report.cost.by_week}
              labels={weekLabels}
            />
          </View>

          {/* 섹션 3: 원가율 / 폐기율 */}
          <Text style={styles.sectionTitle}>원가율 / 폐기율</Text>
          <View style={styles.card}>
            <GaugeBar
              label="원가율"
              value={report.cost_rate}
              target={35}
              targetLabel="목표 35% 이하"
              goodBelow
            />
            <View style={{ height: 16 }} />
            <GaugeBar
              label="폐기율"
              value={report.disposal_rate}
              target={3}
              targetLabel="목표 3% 이하"
              goodBelow
            />
          </View>

          {/* 섹션 4: 메뉴 TOP 5 */}
          <Text style={styles.sectionTitle}>메뉴별 성과 TOP 5</Text>
          <View style={styles.card}>
            {report.top_menus.length === 0 ? (
              <Text style={styles.emptyText}>판매 데이터 없음</Text>
            ) : (
              report.top_menus.slice(0, 5).map((item, idx) => (
                <MenuRow key={item.menu_id} item={item} index={idx} />
              ))
            )}
          </View>

          {/* 섹션 5: 폐기 손실 */}
          <Text style={styles.sectionTitle}>폐기 손실</Text>
          <View style={styles.card}>
            {report.disposal_items.length === 0 ? (
              <Text style={styles.emptyText}>폐기 기록 없음</Text>
            ) : (
              report.disposal_items.map((item) => (
                <View key={item.item_id} style={styles.disposalRow}>
                  <View>
                    <Text style={styles.disposalName}>{item.name}</Text>
                    <Text style={styles.disposalSub}>
                      {item.disposed_qty}
                      {item.unit}
                    </Text>
                  </View>
                  <Text style={styles.disposalLoss}>
                    -{formatKRW(item.loss_krw)}
                  </Text>
                </View>
              ))
            )}
            {report.disposal_items.length > 0 && (
              <View style={styles.disposalTotal}>
                <Text style={styles.disposalTotalLabel}>합계</Text>
                <Text style={styles.disposalTotalValue}>
                  -{formatKRW(report.cost.total_disposal)}
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 32 }} />
        </>
      )}
    </ScrollView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // 월 선택기
  monthPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
  },
  arrowBtn: { padding: 12 },
  arrowText: { fontSize: 28, color: GREEN, fontWeight: "bold" },
  monthLabel: { fontSize: 20, fontWeight: "700", marginHorizontal: 20 },

  // 공통
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: { color: "#999", fontSize: 14, textAlign: "center" },
  errorText: { color: RED, fontSize: 15, marginBottom: 12 },
  retryBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  // 요약 카드
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 8,
    gap: 8,
  },
  summaryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    width: "47%",
    marginHorizontal: 4,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: { fontSize: 12, color: "#888", marginBottom: 6 },
  summaryValue: { fontSize: 17, fontWeight: "700", color: "#222" },

  // 바차트
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    justifyContent: "space-around",
    paddingTop: 8,
  },
  barGroup: { alignItems: "center", flex: 1 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 14, borderRadius: 3, minHeight: 4 },
  barLabel: { fontSize: 10, color: "#666", marginTop: 4 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#555", marginLeft: 4 },

  // 게이지
  gaugeRow: { marginBottom: 4 },
  gaugeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  gaugeLabel: { fontSize: 14, color: "#444", fontWeight: "600" },
  gaugeValue: { fontSize: 14, fontWeight: "700" },
  gaugeTrack: {
    height: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  gaugeFill: { height: "100%", borderRadius: 6 },
  gaugeTarget: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#555",
  },
  gaugeTargetLabel: { fontSize: 11, color: "#888", marginTop: 4 },

  // 메뉴 행
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#F0F0F0",
  },
  menuRank: {
    fontSize: 16,
    fontWeight: "700",
    color: GREEN,
    width: 28,
    textAlign: "center",
  },
  menuInfo: { flex: 1, marginLeft: 8 },
  menuName: { fontSize: 14, fontWeight: "600", color: "#222" },
  menuSub: { fontSize: 12, color: "#888", marginTop: 2 },
  marginBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  marginBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // 폐기
  disposalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#F0F0F0",
  },
  disposalName: { fontSize: 14, color: "#333", fontWeight: "600" },
  disposalSub: { fontSize: 12, color: "#888", marginTop: 2 },
  disposalLoss: { fontSize: 14, color: RED, fontWeight: "700" },
  disposalTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  disposalTotalLabel: { fontSize: 14, color: "#555", fontWeight: "700" },
  disposalTotalValue: { fontSize: 14, color: RED, fontWeight: "700" },
});
