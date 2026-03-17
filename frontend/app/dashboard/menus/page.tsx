'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RecipeItem {
  item_id: number;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  sub_total: number;
}

interface Menu {
  id: number;
  name: string;
  category: string;
  sell_price: number;
  description: string | null;
  is_active: number;
  cost_price: number;
  margin: number;
  margin_rate: number;
  recipe_items: RecipeItem[];
}

export default function MenusPage() {
  const router = useRouter();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'main', sell_price: '', description: '' });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/menus/`, { headers: authHeader() });
      setMenus(res.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('메뉴 데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(`${API_URL}/menus/`, {
        name: form.name,
        category: form.category,
        sell_price: Number(form.sell_price) || 0,
        description: form.description || null,
      }, { headers: authHeader() });
      setForm({ name: '', category: 'main', sell_price: '', description: '' });
      setShowForm(false);
      fetchData();
    } catch (err: any) { setError(err.response?.data?.detail || '메뉴 등록 실패'); }
  };

  const onDelete = async (id: number) => {
    if (!confirm('메뉴를 삭제할까요?')) return;
    try {
      await axios.delete(`${API_URL}/menus/${id}`, { headers: authHeader() });
      fetchData();
    } catch (err: any) { setError(err.response?.data?.detail || '삭제 실패'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">메뉴 관리</h2>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            + 메뉴 등록
          </button>
        </div>

        {showForm && (
          <div className="bg-white shadow rounded-lg p-6">
            <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input name="name" value={form.name} onChange={onChange} placeholder="메뉴명" required className="border rounded-md px-3 py-2" />
              <select name="category" value={form.category} onChange={onChange} className="border rounded-md px-3 py-2">
                <option value="main">메인</option>
                <option value="side">사이드</option>
                <option value="drink">음료</option>
                <option value="set">세트</option>
              </select>
              <input name="sell_price" type="number" value={form.sell_price} onChange={onChange} placeholder="판매가 (원)" className="border rounded-md px-3 py-2" />
              <input name="description" value={form.description} onChange={onChange} placeholder="설명 (선택)" className="border rounded-md px-3 py-2" />
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">등록</button>
            </form>
          </div>
        )}

        <div className="space-y-3">
          {menus.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">등록된 메뉴가 없습니다.</div>
          ) : menus.map(menu => (
            <div key={menu.id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === menu.id ? null : menu.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">{menu.name}</p>
                    <p className="text-sm text-gray-500">
                      판매가: ₩{Number(menu.sell_price).toLocaleString()} · 원가: ₩{Math.round(menu.cost_price).toLocaleString()} · 마진: {menu.margin_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${menu.margin_rate >= 40 ? 'bg-green-100 text-green-800' : menu.margin_rate >= 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      마진 {menu.margin_rate.toFixed(0)}%
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(menu.id); }} className="px-2 py-1 text-xs text-white bg-red-600 rounded-md">삭제</button>
                  </div>
                </div>
              </div>
              {expandedId === menu.id && menu.recipe_items.length > 0 && (
                <div className="border-t px-4 py-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 mb-2">레시피</p>
                  {menu.recipe_items.map(ri => (
                    <div key={ri.item_id} className="flex justify-between text-sm text-gray-700 py-1">
                      <span>{ri.item_name} ({ri.quantity} {ri.unit})</span>
                      <span>₩{Math.round(ri.sub_total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
