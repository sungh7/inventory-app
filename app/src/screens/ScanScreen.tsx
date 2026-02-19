import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, Modal, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { itemsApi, transactionsApi, staffApi } from "../api/client";
import { Item, TransactionType, Staff } from "../types";

const TX_LABELS: Record<TransactionType, string> = {
  in: "입고",
  out: "출고",
  dispose: "폐기",
};

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [txType, setTxType] = useState<TransactionType>("in");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [memo, setMemo] = useState("");
  // 직원 선택
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [staffPickerVisible, setStaffPickerVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    staffApi.list().then((r) => setStaffList(r.data)).catch(() => {});
  }, []);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>카메라 권한이 필요합니다</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>권한 허용</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcode = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const res = await itemsApi.getByBarcode(data);
      setItem(res.data);
      setModalVisible(true);
    } catch (e: any) {
      if (e.response?.status === 404) {
        // 미등록 품목 → 신규 등록 화면으로
        Alert.alert(
          "미등록 품목",
          `바코드: ${data}\n새로 등록하시겠습니까?`,
          [
            { text: "취소", onPress: () => setScanned(false) },
            {
              text: "등록",
              onPress: () => router.push({ pathname: "/register", params: { barcode: data } }),
            },
          ]
        );
      } else {
        Alert.alert("오류", "서버에 연결할 수 없습니다");
        setScanned(false);
      }
    }
  };

  const validateExpiry = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));

  const handleSubmit = async () => {
    if (!item || !quantity) return;

    // [C-7] 유통기한 형식 검증
    if (expiryDate && !validateExpiry(expiryDate)) {
      Alert.alert("오류", "유통기한 형식이 잘못되었습니다 (YYYY-MM-DD)");
      return;
    }

    try {
      await transactionsApi.create({
        item_id: item.id,
        type: txType,
        quantity: parseFloat(quantity),
        expiry_date: expiryDate || undefined,
        memo: memo || undefined,
        staff_id: selectedStaffId ?? undefined,
      });
      Alert.alert("완료", `${item.name} ${TX_LABELS[txType]} ${quantity}${item.unit} 처리되었습니다`);
      closeModal();
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "처리 실패");
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setItem(null);
    setQuantity("");
    setExpiryDate("");
    setMemo("");
    setSelectedStaffId(null);
    setScanned(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "qr", "code128"] }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <Text style={styles.hint}>바코드를 네모 안에 맞춰주세요</Text>
      </View>

      {/* 품목 확인 모달 */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{item?.name}</Text>
            <Text style={styles.modalSub}>현재 재고: {item?.current_stock ?? 0} {item?.unit}</Text>

            {/* 입고/출고/폐기 선택 */}
            <View style={styles.typeRow}>
              {(["in", "out", "dispose"] as TransactionType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, txType === t && styles.typeBtnActive]}
                  onPress={() => setTxType(t)}
                >
                  <Text style={[styles.typeBtnText, txType === t && styles.typeBtnTextActive]}>
                    {TX_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder={`수량 (${item?.unit})`}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />

            {txType === "in" && (
              <TextInput
                style={styles.input}
                placeholder="유통기한 (YYYY-MM-DD)"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="메모 (선택)"
              value={memo}
              onChangeText={setMemo}
            />

            {/* 직원 선택 */}
            <TouchableOpacity
              style={styles.staffPickerBtn}
              onPress={() => setStaffPickerVisible(true)}
            >
              <Text style={styles.staffPickerBtnText}>
                👤 {selectedStaffId
                  ? staffList.find((s) => s.id === selectedStaffId)?.name ?? "직원 선택"
                  : "담당자 선택 (선택사항)"}
              </Text>
            </TouchableOpacity>

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={closeModal}>
                <Text style={styles.btnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={handleSubmit}>
                <Text style={styles.btnText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 직원 선택 모달 */}
      <Modal visible={staffPickerVisible} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: "60%" }]}>
            <Text style={styles.modalTitle}>담당자 선택</Text>
            <ScrollView>
              <TouchableOpacity
                style={styles.staffItem}
                onPress={() => { setSelectedStaffId(null); setStaffPickerVisible(false); }}
              >
                <Text style={styles.staffItemText}>선택 안함</Text>
              </TouchableOpacity>
              {staffList.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.staffItem, selectedStaffId === s.id && styles.staffItemActive]}
                  onPress={() => { setSelectedStaffId(s.id); setStaffPickerVisible(false); }}
                >
                  <Text style={[styles.staffItemText, selectedStaffId === s.id && styles.staffItemTextActive]}>
                    {s.name}
                  </Text>
                  <Text style={styles.staffItemRole}>{s.role === "manager" ? "매니저" : "직원"}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn, { marginTop: 12 }]} onPress={() => setStaffPickerVisible(false)}>
              <Text style={styles.btnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  msg: { fontSize: 16, marginBottom: 16, color: "#333" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  scanBox: {
    width: 260, height: 160,
    borderWidth: 2, borderColor: "#4CAF50", borderRadius: 8,
    backgroundColor: "transparent",
  },
  hint: { color: "#fff", marginTop: 16, fontSize: 14 },
  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  modalSub: { fontSize: 14, color: "#666", marginBottom: 16 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ddd", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  typeBtnText: { color: "#333", fontWeight: "600" },
  typeBtnTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  staffPickerBtn: { borderWidth: 1, borderColor: "#4CAF50", borderRadius: 8, padding: 12, marginBottom: 12, alignItems: "center" },
  staffPickerBtnText: { color: "#4CAF50", fontWeight: "600", fontSize: 14 },
  staffItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  staffItemActive: { backgroundColor: "#e8f5e9", borderRadius: 8, paddingHorizontal: 8 },
  staffItemText: { fontSize: 15, color: "#333" },
  staffItemTextActive: { fontWeight: "700", color: "#4CAF50" },
  staffItemRole: { fontSize: 12, color: "#888" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  btn: { flex: 1, backgroundColor: "#4CAF50", padding: 14, borderRadius: 8, alignItems: "center" },
  cancelBtn: { backgroundColor: "#999" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
