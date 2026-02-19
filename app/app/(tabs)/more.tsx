import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import HistoryScreen from "../../src/screens/HistoryScreen";
import StaffScreen from "../../src/screens/StaffScreen";

type Tab = "history" | "staff";

export default function MoreTab() {
  const [tab, setTab] = useState<Tab>("history");
  return (
    <View style={{ flex: 1 }}>
      {/* 세그먼트 컨트롤 */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.segment, tab === "history" && styles.segmentActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.segmentText, tab === "history" && styles.segmentTextActive]}>이력</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === "staff" && styles.segmentActive]}
          onPress={() => setTab("staff")}
        >
          <Text style={[styles.segmentText, tab === "staff" && styles.segmentTextActive]}>직원</Text>
        </TouchableOpacity>
      </View>
      {/* 콘텐츠 */}
      {tab === "history" ? <HistoryScreen /> : <StaffScreen />}
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
