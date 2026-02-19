export type ItemCategory = "meat" | "vegetable" | "sauce" | "drink" | "other";
export type TransactionType = "in" | "out" | "dispose";

export interface Item {
  id: number;
  barcode?: string;
  name: string;
  category: ItemCategory;
  unit: string;
  unit_price: number;
  min_stock: number;
  supplier_id?: number;
  current_stock?: number;
}

export interface InventoryItem {
  item_id: number;
  item_name: string;
  category: string;
  unit: string;
  quantity: number;
  min_stock: number;
  expiry_date?: string;
  is_low_stock: boolean;
  is_expiring_soon: boolean;
}

export interface Transaction {
  id: number;
  item_id: number;
  item_name?: string;
  type: TransactionType;
  quantity: number;
  unit_price?: number;
  expiry_date?: string;
  memo?: string;
  created_at?: string;
}

export interface AlertsResponse {
  low_stock: { item_id: number; name: string; quantity: number; unit: string }[];
  expiring_soon: { item_id: number; name: string; expiry_date: string }[];
}

// 메뉴 / 레시피 / 판매 타입
export interface RecipeItemData {
  item_id: number;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  sub_total: number; // quantity * unit_price
}

export interface Menu {
  id: number;
  name: string;
  category: string;
  sell_price: number;
  description?: string;
  is_active: number;
  cost_price: number;   // 계산된 원가
  margin: number;       // sell_price - cost_price
  margin_rate: number;  // margin / sell_price * 100
  recipe_items: RecipeItemData[];
}

export interface Sale {
  id: number;
  menu_id: number;
  menu_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  total_revenue: number;
  memo?: string;
  created_at: string;
}

export interface SaleSummary {
  total_sales_count: number;
  total_revenue: number;
  total_cost: number;
  total_margin: number;
  by_menu: {
    menu_id: number;
    menu_name: string;
    count: number;
    revenue: number;
    cost: number;
    margin: number;
  }[];
}

// 리포트 타입
export interface MenuPerformance {
  menu_id: number;
  name: string;
  sell_price?: number;
  cost_price?: number;
  margin_rate: number;
  sale_count: number;
  total_revenue: number;
  total_cost: number;
  rank?: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  period: string;
  revenue: { total: number; by_week: number[] };
  cost: {
    total_ingredient: number;
    total_purchase: number;
    total_disposal: number;
    by_week: number[];
  };
  margin: { total: number; rate: number; by_week: number[] };
  cost_rate: number;
  disposal_rate: number;
  top_menus: MenuPerformance[];
  disposal_items: {
    item_id: number;
    name: string;
    disposed_qty: number;
    unit: string;
    loss_krw: number;
  }[];
  low_margin_menus: MenuPerformance[];
}

export interface WeeklyData {
  week_label: string;
  start_date: string;
  end_date: string;
  revenue: number;
  ingredient_cost: number;
  disposal_cost: number;
  margin: number;
  margin_rate: number;
  sale_count: number;
}

// 직원 관련 타입
export interface Staff {
  id: number;
  name: string;
  role: "manager" | "staff";
  pin?: string;
  is_active: boolean;
  created_at: string;
}

export interface StaffSummary {
  staff_id: number;
  name: string;
  role: string;
  in_count: number;
  out_count: number;
  dispose_count: number;
  sale_count: number;
  last_activity?: string;
}

export interface StaffHistory {
  staff: Staff;
  transactions: Transaction[];
  sales: Sale[];
  summary: {
    in_count: number;
    out_count: number;
    dispose_count: number;
    sale_count: number;
  };
}

// 공급업체 타입
export interface Supplier {
  id: number;
  name: string;
  contact?: string;
  email?: string;
  memo?: string;
}

// [W-13] 발주 관련 타입
export interface Order {
  id: number;
  supplier_id?: number;
  status: "draft" | "sent" | "received" | "cancelled";
  item_count: number;
  total_amount: number;
  expected_date?: string;
  memo?: string;
  created_at: string;
}

export interface OrderRecommendItem {
  item_id: number;
  name: string;
  unit: string;
  current_stock: number;
  suggested_qty: number;
  estimated_cost: number;
  unit_price: number;
}

export interface OrderRecommendResponse {
  count: number;
  total_estimated_cost: number;
  items: OrderRecommendItem[];
}
