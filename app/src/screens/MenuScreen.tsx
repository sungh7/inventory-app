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
import { menusApi, salesApi, itemsApi, staffApi } from "../api/client";
import { Menu, RecipeItemData, Item, Staff } from "../types";

// ─── 마진율 색상 ─────────────────────────────────────────────────
function marginColor(rate: number) {
  if (rate >= 60) return "#4CAF50";
  if (rate >= 40) return "#FFC107";
  return "#F44336";
}

function marginEmoji(rate: number) {
  if (rate >= 60) return "🟢";
  if (rate >= 40) return "🟡";
  return "🔴";
}

// ─── 메뉴 카드 ───────────────────────────────────────────────────
function MenuCard({
  menu,
  onPress,
}: {
  menu: Menu;
  onPress: () => void;
}) {
  const color = marginColor(menu.margin_rate);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{menu.name}</Text>
        <Text style={styles.cardCategory}>{menu.category}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>판매가</Text>
          <Text style={styles.priceValue}>{menu.sell_price.toLocaleString()}원</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>원가</Text>
          <Text style={styles.priceValue}>{Math.round(menu.cost_price).toLocaleString()}원</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>마진율</Text>
          <Text style={[styles.marginValue, { color }]}>
            {marginEmoji(menu.margin_rate)} {menu.margin_rate.toFixed(1)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── 판매 입력 모달 ──────────────────────────────────────────────
function SaleModal({
  menu,
  visible,
  onClose,
  onSuccess,
}: {
  menu: Menu;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [memo, setMemo] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [staffPickerVisible, setStaffPickerVisible] = useState(false);
  const queryClient = useQueryClient();

  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ["staff"],
    queryFn: () => staffApi.list().then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: () =>
      salesApi.create({ menu_id: menu.id, quantity: qty, memo: memo || undefined, staff_id: selectedStaffId ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      Alert.alert("판매 완료", `${menu.name} ${qty}인분 판매 처리되었습니다`);
      setQty(1);
      setMemo("");
      setSelectedStaffId(null);
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "판매 처리 중 오류가 발생했습니다";
      Alert.alert("오류", msg);
    },
  });

  const estimatedCost = menu.cost_price * qty;
  const estimatedRevenue = menu.sell_price * qty;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>📋 판매 입력</Text>
          <Text style={styles.modalSubtitle}>{menu.name}</Text>

          {/* 수량 조절 */}
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{qty}인분</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQty((q) => q + 1)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 예상 원가/수익 */}
          <View style={styles.estimateBox}>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>예상 원가</Text>
              <Text style={styles.estimateCost}>
                {Math.round(estimatedCost).toLocaleString()}원
              </Text>
            </View>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>예상 수익</Text>
              <Text style={styles.estimateRevenue}>
                {Math.round(estimatedRevenue).toLocaleString()}원
              </Text>
            </View>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>예상 마진</Text>
              <Text style={[styles.estimateRevenue, { color: marginColor(menu.margin_rate) }]}>
                {Math.round(estimatedRevenue - estimatedCost).toLocaleString()}원
              </Text>
            </View>
          </View>

          {/* 메모 */}
          <TextInput
            style={styles.input}
            placeholder="메모 (선택)"
            value={memo}
            onChangeText={setMemo}
          />

          {/* 담당자 선택 */}
          <TouchableOpacity
            style={styles.staffPickerBtn}
            onPress={() => setStaffPickerVisible(true)}
          >
            <Text style={styles.staffPickerBtnText}>
              👤 {selectedStaffId
                ? staffList.find((s) => s.id === selectedStaffId)?.name ?? "담당자 선택"
                : "담당자 선택 (선택사항)"}
            </Text>
          </TouchableOpacity>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, mutation.isPending && { opacity: 0.6 }]}
              onPress={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>판매 확인</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 직원 선택 모달 */}
      <Modal visible={staffPickerVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: "60%" }]}>
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
                  <Text style={[styles.staffItemText, selectedStaffId === s.id && { fontWeight: "700", color: GREEN }]}>
                    {s.name}
                  </Text>
                  <Text style={styles.staffItemRole}>{s.role === "manager" ? "매니저" : "직원"}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 8 }]} onPress={() => setStaffPickerVisible(false)}>
              <Text style={styles.cancelBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── 상세 모달 ───────────────────────────────────────────────────
function DetailModal({
  menu,
  visible,
  onClose,
}: {
  menu: Menu | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [saleModalVisible, setSaleModalVisible] = useState(false);

  if (!menu) return null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>{menu.name}</Text>
            <Text style={styles.modalSubtitle}>
              판매가 {menu.sell_price.toLocaleString()}원 / 원가{" "}
              {Math.round(menu.cost_price).toLocaleString()}원
            </Text>

            {/* 레시피 목록 */}
            <Text style={styles.sectionLabel}>📦 레시피 재료</Text>
            {menu.recipe_items.length === 0 ? (
              <Text style={styles.emptyText}>등록된 레시피가 없습니다</Text>
            ) : (
              <ScrollView style={{ maxHeight: 240 }}>
                {menu.recipe_items.map((ri, i) => (
                  <View key={i} style={styles.recipeRow}>
                    <Text style={styles.recipeName}>{ri.item_name}</Text>
                    <Text style={styles.recipeQty}>
                      {ri.quantity}
                      {ri.unit}
                    </Text>
                    <Text style={styles.recipeSubTotal}>
                      {Math.round(ri.sub_total).toLocaleString()}원
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* 원가 합계 */}
            <View style={styles.costSummaryRow}>
              <Text style={styles.costSummaryLabel}>원가 합계</Text>
              <Text style={styles.costSummaryValue}>
                {Math.round(menu.cost_price).toLocaleString()}원
              </Text>
            </View>
            <View style={styles.costSummaryRow}>
              <Text style={styles.costSummaryLabel}>마진율</Text>
              <Text
                style={[styles.costSummaryValue, { color: marginColor(menu.margin_rate) }]}
              >
                {marginEmoji(menu.margin_rate)} {menu.margin_rate.toFixed(1)}%
              </Text>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>닫기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => setSaleModalVisible(true)}
              >
                <Text style={styles.confirmBtnText}>판매 입력</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {saleModalVisible && (
        <SaleModal
          menu={menu}
          visible={saleModalVisible}
          onClose={() => setSaleModalVisible(false)}
          onSuccess={() => {
            setSaleModalVisible(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ─── 메뉴 등록 모달 ──────────────────────────────────────────────
interface RecipeEntry {
  item_id: number;
  item_name: string;
  unit: string;
  quantity: string;
}

function RegisterModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("main");
  const [sellPrice, setSellPrice] = useState("");
  const [description, setDescription] = useState("");
  const [recipeEntries, setRecipeEntries] = useState<RecipeEntry[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const queryClient = useQueryClient();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => itemsApi.list().then((r) => r.data),
  });

  const createMenu = useMutation({
    mutationFn: async () => {
      // 1. 메뉴 생성
      const res = await menusApi.create({
        name,
        category,
        sell_price: parseFloat(sellPrice) || 0,
        description: description || undefined,
      });
      const menuId = res.data.id;

      // 2. 레시피 등록
      if (recipeEntries.length > 0) {
        await menusApi.setRecipe(
          menuId,
          recipeEntries.map((e) => ({
            item_id: e.item_id,
            quantity: parseFloat(e.quantity) || 0,
          }))
        );
      }
      return menuId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      Alert.alert("완료", "메뉴가 등록되었습니다");
      resetForm();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "오류가 발생했습니다";
      Alert.alert("오류", msg);
    },
  });

  function resetForm() {
    setName("");
    setCategory("main");
    setSellPrice("");
    setDescription("");
    setRecipeEntries([]);
  }

  function addItem(item: Item) {
    if (recipeEntries.find((e) => e.item_id === item.id)) {
      setShowItemPicker(false);
      return;
    }
    setRecipeEntries((prev) => [
      ...prev,
      { item_id: item.id, item_name: item.name, unit: item.unit, quantity: "0" },
    ]);
    setShowItemPicker(false);
  }

  function removeEntry(idx: number) {
    setRecipeEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateQty(idx: number, val: string) {
    setRecipeEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, quantity: val } : e))
    );
  }

  const CATEGORIES = ["main", "side", "drink"];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { maxHeight: "90%" }]}>
          <Text style={styles.modalTitle}>🍽️ 메뉴 등록</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 메뉴명 */}
            <Text style={styles.fieldLabel}>메뉴명 *</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 삼겹살 1인분"
              value={name}
              onChangeText={setName}
            />

            {/* 카테고리 */}
            <Text style={styles.fieldLabel}>카테고리</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catBtn, category === c && styles.catBtnActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.catBtnText, category === c && styles.catBtnTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 판매가 */}
            <Text style={styles.fieldLabel}>판매가 (원)</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 15000"
              value={sellPrice}
              onChangeText={setSellPrice}
              keyboardType="numeric"
            />

            {/* 설명 */}
            <Text style={styles.fieldLabel}>설명 (선택)</Text>
            <TextInput
              style={styles.input}
              placeholder="메뉴 설명"
              value={description}
              onChangeText={setDescription}
            />

            {/* 레시피 */}
            <View style={styles.recipeTitleRow}>
              <Text style={styles.fieldLabel}>레시피 재료</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setShowItemPicker(true)}
              >
                <Text style={styles.addItemBtnText}>+ 재료 추가</Text>
              </TouchableOpacity>
            </View>

            {recipeEntries.map((entry, idx) => (
              <View key={idx} style={styles.recipeEntryRow}>
                <Text style={styles.recipeEntryName}>{entry.item_name}</Text>
                <TextInput
                  style={styles.qtyInput}
                  value={entry.quantity}
                  onChangeText={(v) => updateQty(idx, v)}
                  keyboardType="numeric"
                  placeholder="소요량"
                />
                <Text style={styles.recipeEntryUnit}>{entry.unit}</Text>
                <TouchableOpacity onPress={() => removeEntry(idx)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                resetForm();
                onClose();
              }}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!name || createMenu.isPending) && { opacity: 0.6 }]}
              onPress={() => createMenu.mutate()}
              disabled={!name || createMenu.isPending}
            >
              {createMenu.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 재료 선택 피커 */}
      <Modal visible={showItemPicker} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: "70%" }]}>
            <Text style={styles.modalTitle}>재료 선택</Text>
            <ScrollView>
              {(items ?? []).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemPickerRow}
                  onPress={() => addItem(item)}
                >
                  <Text style={styles.itemPickerName}>{item.name}</Text>
                  <Text style={styles.itemPickerUnit}>
                    {item.unit} / {item.unit_price.toLocaleString()}원
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 8 }]}
              onPress={() => setShowItemPicker(false)}
            >
              <Text style={styles.cancelBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── 메인 스크린 ──────────────────────────────────────────────────
export default function MenuScreen() {
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Menu[]>({
    queryKey: ["menus"],
    queryFn: () => menusApi.list().then((r) => r.data),
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
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MenuCard
            menu={item}
            onPress={() => {
              setSelectedMenu(item);
              setDetailVisible(true);
            }}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isLoading ? "로딩 중..." : "등록된 메뉴가 없습니다"}
          </Text>
        }
      />

      {/* 메뉴 추가 버튼 */}
      <TouchableOpacity style={styles.fab} onPress={() => setRegisterVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 상세 모달 */}
      <DetailModal
        menu={selectedMenu}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
      />

      {/* 메뉴 등록 모달 */}
      <RegisterModal
        visible={registerVisible}
        onClose={() => setRegisterVisible(false)}
      />
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────
const GREEN = "#4CAF50";

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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardCategory: { fontSize: 12, color: "#888", textTransform: "uppercase" },
  cardBody: { flexDirection: "row", justifyContent: "space-between" },
  priceCol: { alignItems: "center", flex: 1 },
  priceLabel: { fontSize: 11, color: "#999", marginBottom: 2 },
  priceValue: { fontSize: 14, fontWeight: "600", color: "#333" },
  marginValue: { fontSize: 14, fontWeight: "700" },

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
  modalSubtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#333" },
  emptyText: { textAlign: "center", color: "#999", marginTop: 40, fontSize: 14 },

  // 레시피 행
  recipeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  recipeName: { flex: 1, fontSize: 13, color: "#333" },
  recipeQty: { fontSize: 13, color: "#555", width: 60, textAlign: "right" },
  recipeSubTotal: { fontSize: 13, color: "#555", width: 70, textAlign: "right" },

  // 원가 요약
  costSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
  },
  costSummaryLabel: { fontSize: 14, color: "#666" },
  costSummaryValue: { fontSize: 14, fontWeight: "700", color: "#333" },

  // 판매 수량
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginVertical: 16,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnText: { fontSize: 22, color: "#fff", lineHeight: 26 },
  qtyValue: { fontSize: 22, fontWeight: "700", minWidth: 60, textAlign: "center" },

  // 예상 수익
  estimateBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  estimateRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  estimateLabel: { fontSize: 13, color: "#666" },
  estimateCost: { fontSize: 13, fontWeight: "600", color: "#F44336" },
  estimateRevenue: { fontSize: 13, fontWeight: "600", color: GREEN },

  // 버튼
  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelBtnText: { color: "#555", fontWeight: "600" },
  confirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: "#fff", lineHeight: 34 },

  // 등록 폼
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#555", marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#333",
  },
  categoryRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  catBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  catBtnText: { fontSize: 13, color: "#555" },
  catBtnTextActive: { color: "#fff", fontWeight: "700" },

  recipeTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  addItemBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: GREEN,
    borderRadius: 16,
  },
  addItemBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  recipeEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
  },
  recipeEntryName: { flex: 1, fontSize: 13, color: "#333" },
  qtyInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 6,
    width: 60,
    textAlign: "center",
    fontSize: 13,
    backgroundColor: "#fff",
  },
  recipeEntryUnit: { fontSize: 12, color: "#888", width: 28 },
  removeBtn: { fontSize: 16, color: "#F44336", paddingHorizontal: 4 },

  // 재료 피커
  itemPickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemPickerName: { fontSize: 14, color: "#333" },
  itemPickerUnit: { fontSize: 12, color: "#888" },

  // 에러
  errorText: { color: "#999", marginBottom: 12 },
  retryBtn: { padding: 12, backgroundColor: GREEN, borderRadius: 8 },
  retryBtnText: { color: "#fff" },

  // 직원 선택
  staffPickerBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 8, padding: 10, marginBottom: 12, alignItems: "center" },
  staffPickerBtnText: { color: GREEN, fontWeight: "600", fontSize: 13 },
  staffItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  staffItemActive: { backgroundColor: "#e8f5e9", borderRadius: 8, paddingHorizontal: 8 },
  staffItemText: { fontSize: 14, color: "#333" },
  staffItemRole: { fontSize: 12, color: "#888" },
});
