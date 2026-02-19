import axios from "axios";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// --- Auth token handling ---
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

api.interceptors.request.use((config) => {
  // 웹에서 페이지 새로고침 시 in-memory 토큰이 리셋되므로 localStorage fallback
  const token =
    authToken ??
    (typeof window !== "undefined"
      ? window.localStorage.getItem("access_token")
      : null);
  if (token) {
    config.headers = {
      ...(config.headers as any),
      Authorization: `Bearer ${token}`,
    } as any;
    // in-memory 동기화
    if (!authToken) authToken = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// 인증
export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post("/auth/login", data),
  register: (data: { username: string; password: string; role?: string }) =>
    api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
};

// 품목
export const itemsApi = {
  list: (category?: string) =>
    api.get("/items/", { params: category ? { category } : {} }),
  getByBarcode: (barcode: string) => api.get(`/items/barcode/${barcode}`),
  getById: (id: number) => api.get(`/items/${id}`),
  create: (data: object) => api.post("/items/", data),
  update: (id: number, data: object) => api.patch(`/items/${id}`, data),
  delete: (id: number) => api.delete(`/items/${id}`),
};

// 재고
export const inventoryApi = {
  list: () => api.get("/inventory/"),
  alerts: () => api.get("/inventory/alerts"),
};

// 트랜잭션
export const transactionsApi = {
  list: (params?: object) => api.get("/transactions/", { params }),
  create: (data: object) => api.post("/transactions/", data),
};

// 공급업체
export const suppliersApi = {
  list: () => api.get("/suppliers/"),
  create: (data: object) => api.post("/suppliers/", data),
  update: (id: number, data: object) => api.patch(`/suppliers/${id}`, data),
  delete: (id: number) => api.delete(`/suppliers/${id}`),
};

// 통계
export const statsApi = {
  summary: () => api.get("/stats/summary"),
  consumption: (days = 7) => api.get("/stats/consumption", { params: { days } }),
  disposal: (days = 30) => api.get("/stats/disposal", { params: { days } }),
  categoryStock: () => api.get("/stats/category-stock"),
};

// 푸시
export const pushApi = {
  registerToken: (token: string) => api.post("/push/register", { token }),
};

// 메뉴
export const menusApi = {
  list: () => api.get("/menus/"),
  get: (id: number) => api.get(`/menus/${id}`),
  create: (data: object) => api.post("/menus/", data),
  update: (id: number, data: object) => api.patch(`/menus/${id}`, data),
  delete: (id: number) => api.delete(`/menus/${id}`),
  setRecipe: (id: number, items: { item_id: number; quantity: number }[]) =>
    api.post(`/menus/${id}/recipe`, { items }),
};

// 판매
export const salesApi = {
  create: (data: object) => api.post("/sales/", data),
  list: (days?: number) => api.get("/sales/", { params: days ? { days } : {} }),
  summary: (days?: number) =>
    api.get("/sales/summary", { params: days ? { days } : {} }),
  cancel: (id: number) => api.delete(`/sales/${id}`),
};

// 리포트
export const reportsApi = {
  monthly: (year: number, month: number) =>
    api.get("/reports/monthly", { params: { year, month } }),
  weekly: (weeks = 8) =>
    api.get("/reports/weekly", { params: { weeks } }),
  menuPerformance: (days = 30) =>
    api.get("/reports/menu-performance", { params: { days } }),
};

// 직원
export const staffApi = {
  list: () => api.get("/staff/"),
  create: (data: object) => api.post("/staff/", data),
  update: (id: number, data: object) => api.patch(`/staff/${id}`, data),
  deactivate: (id: number) => api.delete(`/staff/${id}`),
  history: (id: number, days = 30) => api.get(`/staff/${id}/history`, { params: { days } }),
  summary: (days = 30) => api.get("/staff/summary", { params: { days } }),
};

// 발주 orders (추가 엔드포인트)
export const ordersApi = {
  recommend: () => api.get("/orders/recommend"),
  list: () => api.get("/orders/"),
  create: (data: object) => api.post("/orders/", data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/orders/${id}/status`, null, { params: { status } }),
  sendEmail: (id: number) => api.post(`/orders/${id}/send-email`),
  pdfUrl: (id: number) => `${api.defaults.baseURL}/orders/${id}/pdf`,
};

// AI 예측
export const aiApi = {
  forecastAll: (days = 14) => api.get("/ai/forecast", { params: { days } }),
  forecastItem: (itemId: number, days = 14) =>
    api.get(`/ai/forecast/${itemId}`, { params: { days } }),
  smartOrder: () => api.get("/ai/smart-order"),
};
