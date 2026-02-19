import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { itemsApi } from "../api/client";
import { ItemCategory } from "../types";

const CATEGORIES: { label: string; value: ItemCategory }[] = [
  { label: "🥩 육류",  value: "meat" },
  { label: "🥬 채소",  value: "vegetable" },
  { label: "🫙 소스",  value: "sauce" },
  { label: "🥤 음료",  value: "drink" },
  { label: "📦 기타",  value: "other" },
];

const UNITS = ["kg", "g", "개", "봉", "팩", "병", "캔", "L"];

export default function RegisterScreen() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ItemCategory>("meat");
  const [unit, setUnit] = useState("kg");
  const [unitPrice, setUnitPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("오류", "품목명을 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      await itemsApi.create({
        barcode: barcode || undefined,
        name: name.trim(),
        category,
        unit,
        unit_price: parseFloat(unitPrice) || 0,
        min_stock: parseFloat(minStock) || 0,
      });
      Alert.alert("등록 완료", `${name} 이(가) 등록되었습니다`, [
        { text: "확인", onPress: () => router.replace("/(tabs)/scan") },
      ]);
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "등록 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>신규 품목 등록</Text>

        {barcode && (
          <View style={styles.barcodeBox}>
            <Text style={styles.barcodeLabel}>바코드</Text>
            <Text style={styles.barcodeValue}>{barcode}</Text>
          </View>
        )}

        <Text style={styles.label}>품목명 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 삼겹살, 상추, 쌈장..."
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>카테고리</Text>
        <View style={styles.pickerBox}>
          <Picker selectedValue={category} onValueChange={setCategory}>
            {CATEGORIES.map((c) => (
              <Picker.Item key={c.value} label={c.label} value={c.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>단위</Text>
        <View style={styles.unitRow}>
          {UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
              onPress={() => setUnit(u)}
            >
              <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>단가 (원)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={unitPrice}
          onChangeText={setUnitPrice}
        />

        <Text style={styles.label}>최소 재고 (알림 기준)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={minStock}
          onChangeText={setMinStock}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? "등록 중..." : "등록하기"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 24, color: "#222" },
  barcodeBox: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#f0f0f0", padding: 12, borderRadius: 8, marginBottom: 20,
  },
  barcodeLabel: { fontSize: 13, color: "#666" },
  barcodeValue: { fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, fontSize: 16 },
  pickerBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, overflow: "hidden" },
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  unitBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#ddd" },
  unitBtnActive: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  unitText: { fontSize: 14, color: "#444" },
  unitTextActive: { color: "#fff", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#4CAF50", padding: 16, borderRadius: 10,
    alignItems: "center", marginTop: 32,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
