import React, { useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import OrderScreen from "../../src/screens/OrderScreen";
import MenuScreen from "../../src/screens/MenuScreen";

type Tab = "orders" | "menu";

export default function OperationsTab() {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <View style={{ flex: 1 }}>
      {/* 세그먼트 컨트롤 */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.segment, tab === "orders" && styles.segmentActive]}
          onPress={() => setTab("orders")}
        >
          <Text style={[styles.segmentText, tab === "orders" && styles.segmentTextActive]}>발주</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === "menu" && styles.segmentActive]}
          onPress={() => setTab("menu")}
        >
          <Text style={[styles.segmentText, tab === "menu" && styles.segmentTextActive]}>메뉴</Text>
        </TouchableOpacity>
      </View>
      {/* 콘텐츠 */}
      {tab === "orders" ? <OrderScreen /> : <MenuScreen />}
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
