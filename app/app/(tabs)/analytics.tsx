import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import StatsScreen from "../../src/screens/StatsScreen";
import AIForecastScreen from "../../src/screens/AIForecastScreen";
import ReportScreen from "../../src/screens/ReportScreen";

type Tab = "stats" | "ai" | "report";

export default function AnalyticsTab() {
  const [tab, setTab] = useState<Tab>("stats");
  return (
    <View style={{ flex: 1 }}>
      {/* 세그먼트 컨트롤 */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.segment, tab === "stats" && styles.segmentActive]}
          onPress={() => setTab("stats")}
        >
          <Text style={[styles.segmentText, tab === "stats" && styles.segmentTextActive]}>통계</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === "ai" && styles.segmentActive]}
          onPress={() => setTab("ai")}
        >
          <Text style={[styles.segmentText, tab === "ai" && styles.segmentTextActive]}>AI예측</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === "report" && styles.segmentActive]}
          onPress={() => setTab("report")}
        >
          <Text style={[styles.segmentText, tab === "report" && styles.segmentTextActive]}>리포트</Text>
        </TouchableOpacity>
      </View>
      {/* 콘텐츠 */}
      {tab === "stats" && <StatsScreen />}
      {tab === "ai" && <AIForecastScreen />}
      {tab === "report" && <ReportScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  segmentActive: {
    borderBottomColor: "#4CAF50",
  },
  segmentText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#4CAF50",
  },
});
