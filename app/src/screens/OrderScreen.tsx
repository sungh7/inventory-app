import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, RefreshControl, ScrollView, TextInput, Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, suppliersApi, ordersApi as ordersApiClient } from "../api/client";
import { Order, OrderRecommendItem, OrderRecommendResponse, Supplier } from "../types";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "초안",    color: "#9E9E9E" },
  sent:      { label: "발주완료", color: "#2196F3" },
  received:  { label: "입고완료", color: "#4CAF50" },
  cancelled: { label: "취소",    color: "#F44336" },
};

// 로컬 ordersApi (기존 인라인 → named import 로 대체하되, 하위 호환 유지)
const ordersApi = {
  recommend: () => api.get("/orders/recommend"),
  list: () => api.get("/orders/"),
  create: (data: object) => api.post("/orders/", data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/orders/${id}/status`, null, { params: { status } }),
  sendEmail: (id: number) => api.post(`/orders/${id}/send-email`),
  pdfUrl: (id: number) => `${api.defaults.baseURL}/orders/${id}/pdf`,
};

function RecommendSection({ onCreateOrder }: { onCreateOrder: (items: OrderRecommendItem[]) => void }) {
  const { data, isLoading, refetch } = useQuery<OrderRecommendResponse>({
    queryKey: ["order-recommend"],
    queryFn: () => ordersApi.recommend().then(r => r.data),
  });

  if (isLoading) return <Text style={styles.empty}>분석 중...</Text>;
  if (!data?.count) return (
    <View style={styles.okBox}>
      <Text style={styles.okText}>✅ 발주 필요한 품목 없음</Text>
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚠️ 발주 추천 ({data.count}개)</Text>
      <Text style={styles.totalCost}>
        예상 총액: ₩{data.total_estimated_cost.toLocaleString()}
      </Text>
      {data.items.map((item: OrderRecommendItem) => (
        <View key={item.item_id} style={styles.recommendCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recommendName}>{item.name}</Text>
            <Text style={styles.recommendSub}>
              현재 {item.current_stock}{item.unit} → 추천 {item.suggested_qty}{item.unit}
            </Text>
            <Text style={styles.recommendCost}>
              예상 ₩{item.estimated_cost.toLocaleString()}
            </Text>
          </View>
        </View>
      ))}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => onCreateOrder(data.items)}
      >
        <Text style={styles.createBtnText}>발주서 생성</Text>
      </TouchableOpacity>
    </View>
  );
}

interface OrderCardProps {
  order: Order;
  suppliers: Supplier[];
  onUpdateStatus: (id: number, status: string) => void;
  onSendEmail: (id: number) => void;
  onEditSupplierEmail: (supplier: Supplier) => void;
}

function OrderCard({ order, suppliers, onUpdateStatus, onSendEmail, onEditSupplierEmail }: OrderCardProps) {
  const meta = STATUS_META[order.status] ?? { label: order.status, color: "#999" };
  const supplier = suppliers.find(s => s.id === order.supplier_id);

  const handleMarkSent = () => {
    if (supplier?.email) {
      Alert.alert(
        "발주 완료",
        `발주 완료 처리하고 ${supplier.email}로 이메일을 발송합니다.\n계속하시겠습니까?`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "확인",
            onPress: () => onUpdateStatus(order.id, "sent"),
          },
        ],
      );
    } else {
      onUpdateStatus(order.id, "sent");
    }
  };

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>발주서 #{order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
          <Text style={styles.statusText}>{meta.label}</Text>
        </View>
      </View>
      <Text style={styles.orderInfo}>
        {order.item_count}개 품목 · ₩{order.total_amount.toLocaleString()}
      </Text>
      {supplier && (
        <Text style={styles.orderSub}>
          공급업체: {supplier.name}
          {supplier.email ? ` (${supplier.email})` : ""}
        </Text>
      )}
      {order.expected_date && (
        <Text style={styles.orderSub}>입고 예정: {order.expected_date}</Text>
      )}

      {/* 상태 변경 버튼 */}
      <View style={styles.actionRow}>
        {order.status === "draft" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#2196F3" }]}
            onPress={handleMarkSent}
          >
            <Text style={styles.actionBtnText}>발주 완료</Text>
          </TouchableOpacity>
        )}
        {order.status === "sent" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]}
            onPress={() => onUpdateStatus(order.id, "received")}
          >
            <Text style={styles.actionBtnText}>입고 처리</Text>
          </TouchableOpacity>
        )}
        {order.status !== "received" && order.status !== "cancelled" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#F44336" }]}
            onPress={() => onUpdateStatus(order.id, "cancelled")}
          >
            <Text style={styles.actionBtnText}>취소</Text>
          </TouchableOpacity>
        )}
        {/* 이메일 재발송: sent 상태이고 공급업체 이메일 있을 때만 */}
        {order.status === "sent" && supplier?.email && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#9C27B0" }]}
            onPress={() => onSendEmail(order.id)}
          >
            <Text style={styles.actionBtnText}>📧 재발송</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 공급업체 이메일 없을 때 설정 유도 */}
      {order.status === "sent" && supplier && !supplier.email && (
        <TouchableOpacity
          style={styles.emailHint}
          onPress={() => onEditSupplierEmail(supplier)}
        >
          <Text style={styles.emailHintText}>📧 이메일 설정하면 발주서를 자동 발송할 수 있어요</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// 공급업체 이메일 편집 모달
interface SupplierEmailModalProps {
  supplier: Supplier | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: number, email: string) => void;
}

function SupplierEmailModal({ supplier, visible, onClose, onSave }: SupplierEmailModalProps) {
  const [email, setEmail] = useState(supplier?.email ?? "");

  React.useEffect(() => {
    setEmail(supplier?.email ?? "");
  }, [supplier]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBg}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>공급업체 이메일 설정</Text>
          <Text style={styles.modalSub}>{supplier?.name}</Text>
          <TextInput
            style={styles.input}
            placeholder="이메일 주소"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#999" }]}
              onPress={onClose}
            >
              <Text style={styles.btnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                if (supplier) onSave(supplier.id, email);
              }}
            >
              <Text style={styles.btnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function OrderScreen() {
  const qc = useQueryClient();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pendingItems, setPendingItems] = useState<OrderRecommendItem[]>([]);
  const [memo, setMemo] = useState("");
  const [emailModalSupplier, setEmailModalSupplier] = useState<Supplier | null>(null);

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => ordersApi.list().then(r => r.data),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => suppliersApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => ordersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-recommend"] });
      setCreateModalVisible(false);
      setMemo("");
      Alert.alert("완료", "발주서가 생성되었습니다");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      ordersApi.updateStatus(id, status),
    onSuccess: (res, { status }) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (status === "received") {
        qc.invalidateQueries({ queryKey: ["inventory"] });
        Alert.alert("입고 완료", "재고가 자동으로 반영되었습니다 ✅");
      } else if (status === "sent") {
        const emailQueued = res.data?.email_queued;
        Alert.alert(
          "발주 완료",
          emailQueued
            ? "발주 완료 ✅ (이메일 발송됨)"
            : "발주 완료 ✅ (이메일 미설정)",
        );
      }
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: (orderId: number) => ordersApi.sendEmail(orderId),
    onSuccess: (res) => {
      Alert.alert("이메일 발송", res.data?.message ?? "발송 예약 완료");
    },
    onError: () => {
      Alert.alert("오류", "이메일 발송에 실패했습니다");
    },
  });

  const updateSupplierEmailMutation = useMutation({
    mutationFn: ({ id, email }: { id: number; email: string }) =>
      suppliersApi.update(id, { email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEmailModalSupplier(null);
      Alert.alert("저장 완료", "공급업체 이메일이 저장되었습니다");
    },
    onError: () => {
      Alert.alert("오류", "저장에 실패했습니다");
    },
  });

  const handleCreateOrder = (items: OrderRecommendItem[]) => {
    setPendingItems(items);
    setCreateModalVisible(true);
  };

  const submitOrder = () => {
    createMutation.mutate({
      items: pendingItems.map(i => ({
        item_id: i.item_id,
        quantity: i.suggested_qty,
        unit_price: i.unit_price,
      })),
      memo: memo || undefined,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* 발주 추천 */}
        <RecommendSection onCreateOrder={handleCreateOrder} />

        {/* 발주 이력 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 발주 내역</Text>
          {(orders ?? []).length === 0 && (
            <Text style={styles.empty}>발주 내역 없음</Text>
          )}
          {(orders ?? []).map((order: Order) => (
            <OrderCard
              key={order.id}
              order={order}
              suppliers={suppliers}
              onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
              onSendEmail={(id) => sendEmailMutation.mutate(id)}
              onEditSupplierEmail={(supplier) => setEmailModalSupplier(supplier)}
            />
          ))}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 발주서 생성 모달 */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>발주서 생성</Text>
            <Text style={styles.modalSub}>{pendingItems.length}개 품목 · 예상 ₩{
              pendingItems.reduce((s, i) => s + i.estimated_cost, 0).toLocaleString()
            }</Text>

            {pendingItems.map(item => (
              <View key={item.item_id} style={styles.modalItem}>
                <Text style={styles.modalItemName}>{item.name}</Text>
                <Text style={styles.modalItemQty}>{item.suggested_qty}{item.unit}</Text>
              </View>
            ))}

            <TextInput
              style={styles.input}
              placeholder="메모 (선택)"
              value={memo}
              onChangeText={setMemo}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#999" }]}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={styles.btnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn}
                onPress={submitOrder}
                disabled={createMutation.isPending}
              >
                <Text style={styles.btnText}>
                  {createMutation.isPending ? "처리 중..." : "생성"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 공급업체 이메일 편집 모달 */}
      <SupplierEmailModal
        supplier={emailModalSupplier}
        visible={emailModalSupplier !== null}
        onClose={() => setEmailModalSupplier(null)}
        onSave={(id, email) => updateSupplierEmailMutation.mutate({ id, email })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#fff", margin: 16, borderRadius: 12, padding: 16, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#333" },
  totalCost: { fontSize: 14, color: "#FF9800", fontWeight: "700", marginBottom: 12 },
  okBox: { margin: 16, padding: 16, backgroundColor: "#E8F5E9", borderRadius: 12, alignItems: "center" },
  okText: { fontSize: 15, color: "#4CAF50", fontWeight: "600" },
  recommendCard: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  recommendName: { fontSize: 15, fontWeight: "700" },
  recommendSub: { fontSize: 12, color: "#666", marginTop: 2 },
  recommendCost: { fontSize: 12, color: "#FF9800", marginTop: 2 },
  createBtn: { backgroundColor: "#4CAF50", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 16 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  orderCard: { backgroundColor: "#f9f9f9", borderRadius: 10, padding: 14, marginBottom: 10 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  orderId: { fontSize: 15, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  orderInfo: { fontSize: 13, color: "#555" },
  orderSub: { fontSize: 12, color: "#888", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, padding: 8, borderRadius: 6, alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: "#bbb", paddingVertical: 20 },
  emailHint: { marginTop: 8, padding: 8, backgroundColor: "#EDE7F6", borderRadius: 6 },
  emailHintText: { fontSize: 12, color: "#7B1FA2", textAlign: "center" },
  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#FF9800", fontWeight: "600", marginBottom: 16 },
  modalItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  modalItemName: { fontSize: 14, fontWeight: "600" },
  modalItemQty: { fontSize: 14, color: "#555" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, fontSize: 15, marginTop: 16 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  btn: { flex: 1, backgroundColor: "#4CAF50", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
