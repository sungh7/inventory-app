import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../api/client";
import { Staff, StaffSummary, StaffHistory } from "../types";

const GREEN = "#4CAF50";

// ─── 역할 뱃지 ────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isManager = role === "manager";
  return (
    <View style={[styles.badge, isManager ? styles.badgeManager : styles.badgeStaff]}>
      <Text style={styles.badgeText}>{isManager ? "매니저" : "직원"}</Text>
    </View>
  );
}

// ─── 직원 카드 ────────────────────────────────────────────────────
function StaffCard({
  summary,
  onPress,
}: {
  summary: StaffSummary;
  onPress: () => void;
}) {
  const total = summary.in_count + summary.out_count + summary.dispose_count + summary.sale_count;
  const lastDate = summary.last_activity
    ? new Date(summary.last_activity).toLocaleDateString("ko-KR")
    : "활동 없음";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{summary.name}</Text>
          <RoleBadge role={summary.role} />
        </View>
        <Text style={styles.cardLastActivity}>최근: {lastDate}</Text>
      </View>
      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.in_count}</Text>
          <Text style={styles.statLabel}>입고</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.out_count}</Text>
          <Text style={styles.statLabel}>출고</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.dispose_count}</Text>
          <Text style={styles.statLabel}>폐기</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: GREEN }]}>{summary.sale_count}</Text>
          <Text style={styles.statLabel}>판매</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>합계</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── 직원 상세 모달 ───────────────────────────────────────────────
function StaffDetailModal({
  staffId,
  visible,
  onClose,
}: {
  staffId: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<StaffHistory>({
    queryKey: ["staff-history", staffId],
    queryFn: () => staffApi.history(staffId!, 30).then((r) => r.data),
    enabled: visible && staffId !== null,
  });

  if (!visible || staffId === null) return null;

  // 최근 이력 10건 (트랜잭션 + 판매 합쳐서 날짜 내림차순)
  const txItems = (data?.transactions ?? []).slice(0, 10).map((t) => ({
    key: `tx-${t.id}`,
    date: t.created_at ? new Date(t.created_at).toLocaleDateString("ko-KR") : "-",
    type: t.type === "in" ? "입고" : t.type === "out" ? "출고" : "폐기",
    typeColor: t.type === "in" ? GREEN : t.type === "out" ? "#2196F3" : "#F44336",
    name: t.item_name ?? `품목#${t.item_id}`,
    quantity: `${t.quantity}`,
  }));

  const saleItems = (data?.sales ?? []).slice(0, 10).map((s) => ({
    key: `sale-${s.id}`,
    date: s.created_at ? new Date(s.created_at).toLocaleDateString("ko-KR") : "-",
    type: "판매",
    typeColor: "#FF9800",
    name: s.menu_name ?? `메뉴#${s.menu_id}`,
    quantity: `${s.quantity}인분`,
  }));

  // 날짜 내림차순으로 합쳐서 10건
  const allItems = [...txItems, ...saleItems]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { maxHeight: "85%" }]}>
          {isLoading ? (
            <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 40 }} />
          ) : isError ? (
            <>
              <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.detailHeader}>
                <Text style={styles.modalTitle}>{data?.staff.name}</Text>
                <RoleBadge role={data?.staff.role ?? "staff"} />
              </View>

              {/* 30일 활동 요약 */}
              <Text style={styles.sectionLabel}>📊 최근 30일 활동</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{data?.summary.in_count ?? 0}</Text>
                  <Text style={styles.summaryLabel}>입고</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{data?.summary.out_count ?? 0}</Text>
                  <Text style={styles.summaryLabel}>출고</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{data?.summary.dispose_count ?? 0}</Text>
                  <Text style={styles.summaryLabel}>폐기</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: GREEN }]}>{data?.summary.sale_count ?? 0}</Text>
                  <Text style={styles.summaryLabel}>판매</Text>
                </View>
              </View>

              {/* 최근 이력 */}
              <Text style={styles.sectionLabel}>📋 최근 이력</Text>
              {allItems.length === 0 ? (
                <Text style={styles.emptyText}>이력이 없습니다</Text>
              ) : (
                <ScrollView style={styles.historyList}>
                  {allItems.map((item) => (
                    <View key={item.key} style={styles.historyRow}>
                      <Text style={styles.historyDate}>{item.date}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: item.typeColor }]}>
                        <Text style={styles.typeBadgeText}>{item.type}</Text>
                      </View>
                      <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.historyQty}>{item.quantity}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── 직원 등록 모달 ───────────────────────────────────────────────
function RegisterStaffModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [pin, setPin] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      staffApi.create({ name, role, pin: pin || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
      Alert.alert("완료", `${name} 직원이 등록되었습니다`);
      reset();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert("오류", err?.response?.data?.detail ?? "등록 실패");
    },
  });

  function reset() {
    setName("");
    setRole("staff");
    setPin("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>👤 직원 등록</Text>

          <Text style={styles.fieldLabel}>이름 *</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 홍길동"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.fieldLabel}>역할</Text>
          <View style={styles.roleRow}>
            {(["staff", "manager"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r === "manager" ? "매니저" : "직원"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>PIN (선택, 4~6자리)</Text>
          <TextInput
            style={styles.input}
            placeholder="숫자 4~6자리"
            value={pin}
            onChangeText={setPin}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
          />

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { reset(); onClose(); }}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!name || mutation.isPending) && { opacity: 0.6 }]}
              onPress={() => mutation.mutate()}
              disabled={!name || mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>등록</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── 메인 스크린 ──────────────────────────────────────────────────
export default function StaffScreen() {
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);

  const { data: summaries = [], isLoading, isError, refetch } = useQuery<StaffSummary[]>({
    queryKey: ["staff-summary"],
    queryFn: () => staffApi.summary(30).then((r) => r.data),
  });

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>데이터를 불러올 수 없습니다</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={summaries}
        keyExtractor={(item) => String(item.staff_id)}
        renderItem={({ item }) => (
          <StaffCard
            summary={item}
            onPress={() => {
              setSelectedStaffId(item.staff_id);
              setDetailVisible(true);
            }}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>
              {isLoading ? "로딩 중..." : "등록된 직원이 없습니다"}
            </Text>
            {!isLoading && (
              <Text style={styles.emptySubText}>+ 버튼을 눌러 직원을 등록하세요</Text>
            )}
          </View>
        }
      />

      {/* 직원 추가 FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setRegisterVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 직원 상세 모달 */}
      <StaffDetailModal
        staffId={selectedStaffId}
        visible={detailVisible}
        onClose={() => { setDetailVisible(false); setSelectedStaffId(null); }}
      />

      {/* 직원 등록 모달 */}
      <RegisterStaffModal
        visible={registerVisible}
        onClose={() => setRegisterVisible(false)}
      />
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // 카드
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardName: { fontSize: 17, fontWeight: "700", color: "#222" },
  cardLastActivity: { fontSize: 12, color: "#999" },
  cardStats: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700", color: "#333" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },

  // 뱃지
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeManager: { backgroundColor: "#FFF3E0" },
  badgeStaff: { backgroundColor: "#E8F5E9" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#555" },

  // 모달 공통
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },

  // 상세 모달
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8, marginTop: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#f9f9f9", borderRadius: 8, padding: 12, marginBottom: 16 },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "700", color: "#333" },
  summaryLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  historyList: { maxHeight: 280, marginBottom: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", gap: 6 },
  historyDate: { fontSize: 11, color: "#888", width: 60 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  historyName: { flex: 1, fontSize: 13, color: "#333" },
  historyQty: { fontSize: 12, color: "#555", width: 50, textAlign: "right" },

  // 등록 모달
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 8,
    padding: 10, fontSize: 14, color: "#333",
  },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  roleBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  roleBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  roleBtnText: { color: "#555", fontWeight: "600" },
  roleBtnTextActive: { color: "#fff" },

  // 버튼
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center",
  },
  cancelBtnText: { color: "#555", fontWeight: "600" },
  confirmBtn: {
    flex: 1, padding: 12, borderRadius: 8,
    backgroundColor: GREEN, alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "700" },
  closeBtn: {
    padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: "#ddd", alignItems: "center", marginTop: 8,
  },
  closeBtnText: { color: "#555", fontWeight: "600" },

  // FAB
  fab: {
    position: "absolute", right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: GREEN, justifyContent: "center", alignItems: "center",
    elevation: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: "#fff", lineHeight: 34 },

  // 빈 상태
  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#999", marginBottom: 8 },
  emptySubText: { fontSize: 13, color: "#bbb" },

  // 에러
  errorText: { color: "#999", marginBottom: 12 },
  retryBtn: { padding: 12, backgroundColor: GREEN, borderRadius: 8 },
  retryBtnText: { color: "#fff" },
});
