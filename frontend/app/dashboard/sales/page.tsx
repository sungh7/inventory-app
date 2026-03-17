'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Sale {
  id: number;
  menu_id: number;
  menu_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  total_revenue: number;
  memo: string | null;
  created_at: string | null;
}

interface SaleSummary {
  total_sales_count: number;
  total_revenue: number;
  total_cost: number;
  total_margin: number;
  by_menu: { menu_id: number; menu_name: string; count: number; revenue: number; cost: number; margin: number }[];
}

interface MenuOption {
  id: number;
  name: string;
  sell_price: number;
}

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ menu_id: '', quantity: '1', memo: '', staff_id: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchAll = async () => {
    try {
      const [salesRes, summaryRes, menuRes, staffRes] = await Promise.all([
        axios.get(`${API_URL}/sales/`, { headers: authHeader() }),
        axios.get(`${API_URL}/sales/summary`, { headers: authHeader() }),
        axios.get(`${API_URL}/menus/`, { headers: authHeader() }),
        axios.get(`${API_URL}/staff/`, { headers: authHeader() }),
      ]);
      setSales(salesRes.data || []);
      setSummary(summaryRes.data);
      setMenus(menuRes.data || []);
      setStaffList(staffRes.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await axios.post(`${API_URL}/sales/`, {
        menu_id: Number(form.menu_id),
        quantity: Number(form.quantity),
        memo: form.memo || null,
        staff_id: form.staff_id ? Number(form.staff_id) : null,
      }, { headers: authHeader() });
      setForm({ menu_id: '', quantity: '1', memo: '', staff_id: '' });
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || '판매 등록 실패');
    }
  };

  const onCancel = async (id: number) => {
    if (!confirm('판매를 취소하시겠습니까? 재고가 복구됩니다.')) return;
    try {
      await axios.delete(`${API_URL}/sales/${id}`, { headers: authHeader() });
      fetchAll();
    } catch (err: any) { setError(err.response?.data?.detail || '취소 실패'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">총 판매</p><p className="text-xl font-bold">{summary.total_sales_count}건</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">매출</p><p className="text-xl font-bold">₩{Number(summary.total_revenue).toLocaleString()}</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">원가</p><p className="text-xl font-bold text-red-600">₩{Number(summary.total_cost).toLocaleString()}</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">마진</p><p className="text-xl font-bold text-green-600">₩{Number(summary.total_margin).toLocaleString()}</p></div>
          </div>
        )}

        {summary && summary.by_menu.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-md font-semibold mb-3">메뉴별 매출</h3>
            <div className="space-y-2">
              {summary.by_menu.map(m => (
                <div key={m.menu_id} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{m.menu_name} ({m.count}건)</span>
                  <span>₩{Number(m.revenue).toLocaleString()} <span className="text-gray-500">마진 ₩{Number(m.margin).toLocaleString()}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">판매 기록</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">+ 판매 등록</button>
        </div>

        {showForm && (
          <div className="bg-white shadow rounded-lg p-6">
            {formError && <div className="mb-3 rounded-md bg-red-50 p-3"><p className="text-sm text-red-800">{formError}</p></div>}
            <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select name="menu_id" value={form.menu_id} onChange={onChange} required className="border rounded-md px-3 py-2">
                <option value="">메뉴 선택</option>
                {menus.map(m => <option key={m.id} value={m.id}>{m.name} (₩{Number(m.sell_price).toLocaleString()})</option>)}
              </select>
              <input name="quantity" type="number" min="1" value={form.quantity} onChange={onChange} placeholder="수량" required className="border rounded-md px-3 py-2" />
              <select name="staff_id" value={form.staff_id} onChange={onChange} className="border rounded-md px-3 py-2">
                <option value="">담당자 (선택)</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input name="memo" value={form.memo} onChange={onChange} placeholder="메모 (선택)" className="border rounded-md px-3 py-2" />
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">판매 등록</button>
            </form>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {sales.length === 0 ? (
              <li className="px-4 py-5 text-center text-gray-500">판매 기록이 없습니다.</li>
            ) : sales.map(s => (
              <li key={s.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">{s.menu_name} × {s.quantity}</p>
                    <p className="text-sm text-gray-500">
                      매출: ₩{Number(s.total_revenue).toLocaleString()} · 원가: ₩{Number(s.total_cost).toLocaleString()}
                      {s.memo && ` · ${s.memo}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{s.created_at && new Date(s.created_at).toLocaleString('ko-KR')}</span>
                    <button onClick={() => onCancel(s.id)} className="px-2 py-1 text-xs text-red-600 border border-red-600 rounded-md hover:bg-red-50">취소</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
