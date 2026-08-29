import axios from 'axios';

const api = axios.create({
  // Relative path: in production the frontend is served by the backend on the
  // same origin; in dev, Vite proxies /api to the backend (see vite.config.ts).
  baseURL: '/api',
});

export interface Tire {
  id: number;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockRecord {
  id: number;
  tireId: number;
  type: 'IN' | 'OUT';
  quantity: number;
  stockInTime: string;
  stockOutTime: string;
  unitPrice: number;
  recipient: string;
  remark: string;
  createdAt: string;
  brand?: string;
  model?: string;
  size?: string;
}

export interface InventoryCheckItem {
  tireId: number;
  actualQuantity?: number;
  [key: string]: unknown;
}

export interface InventoryCheck {
  id: number;
  checkDate: string;
  items: InventoryCheckItem[];
  operator: string;
  createdAt: string;
}

export interface TireFilters {
  brand?: string;
  model?: string;
  size?: string;
  keyword?: string;
}

export interface StockRecordFilters {
  tireId?: number;
  type?: StockRecord['type'];
}

export interface Stats {
  totalProducts: number;
  totalQuantity: number;
  totalAmount: number;
  todayIn: number;
  todayOut: number;
  monthlyIn: number;
  monthlyOut: number;
  monthlyInAmount: number;
  monthlyOutAmount: number;
  brandStats: { brand: string; total: number }[];
  productStats: { id: number; brand: string; model: string; size: string; total: number }[];
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return fallback;
}

export const tireApi = {
  list: (params?: TireFilters) => api.get<{ success: boolean; data: Tire[] }>('/tires', { params }),
  get: (id: number) => api.get<{ success: boolean; data: Tire }>(`/tires/${id}`),
  create: (data: Pick<Tire, 'brand' | 'model' | 'size'> & { quantity?: number }) => api.post<{ success: boolean; data: Tire }>('/tires', data),
  update: (id: number, data: Pick<Tire, 'brand' | 'model' | 'size'>) => api.put<{ success: boolean; data: Tire }>(`/tires/${id}`, data),
  delete: (id: number) => api.delete(`/tires/${id}`),
};

export const stockApi = {
  records: (params?: StockRecordFilters) => api.get<{ success: boolean; data: StockRecord[] }>('/stock/records', { params }),
  revokeRecord: (id: number) => api.delete<{ success: boolean; message: string }>(`/stock/records/${id}`),
  updateRecord: (id: number, data: { type: StockRecord['type']; quantity: number; date: string; unitPrice: number; recipient?: string; remark?: string }) =>
    api.put<{ success: boolean; message: string }>(`/stock/records/${id}`, data),
  stockIn: (data: { tireId: number; quantity: number; stockInTime: string; unitPrice: number; remark?: string }) =>
    api.post('/stock/in', data),
  stockOut: (data: { tireId: number; quantity: number; stockOutTime: string; recipient: string; unitPrice: number; remark?: string }) =>
    api.post('/stock/out', data),
  inventoryChecks: () => api.get<{ success: boolean; data: InventoryCheck[] }>('/stock/inventory-checks'),
  createCheck: (data: { checkDate: string; items: InventoryCheckItem[]; operator?: string }) =>
    api.post('/stock/inventory-check', data),
  updateCheckItem: (checkId: number, tireId: number, data: { actualQuantity: number }) =>
    api.put<{ success: boolean; message: string }>(`/stock/inventory-check/${checkId}/item/${tireId}`, data),
  revokeCheckItem: (checkId: number, tireId: number) =>
    api.delete<{ success: boolean; message: string }>(`/stock/inventory-check/${checkId}/item/${tireId}`),
  stats: () => api.get<{ success: boolean; data: Stats }>('/stock/stats'),
};
