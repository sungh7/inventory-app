'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface InventoryItem {
  item_id: number;
  item_name: string;
  category: string;
  unit: string;
  quantity: number;
  min_stock: number;
  expiry_date: string | null;
  is_low_stock: boolean;
  is_expiring_soon: boolean;
}

const categoryLabel: Record<string, string> = {
  meat: '육류', vegetable: '채소', sauce: '소스', drink: '음료', other: '기타',
};

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'low' | 'expiring'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/inventory/`, { headers: authHeader() });
      setItems(res.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('재고 데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  const filtered = items.filter(i => {
    if (filter === 'low') return i.is_low_stock;
    if (filter === 'expiring') return i.is_expiring_soon;
    return true;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && <div className="mb-4 rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">재고 현황</h2>
          <div className="flex gap-2">
            {(['all', 'low', 'expiring'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-sm rounded-md ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}>
                {f === 'all' ? '전체' : f === 'low' ? '⚠️ 부족' : '⏰ 만료임박'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">전체 품목</p><p className="text-2xl font-bold">{items.length}</p></div>
          <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">재고 부족</p><p className="text-2xl font-bold text-red-600">{items.filter(i => i.is_low_stock).length}</p></div>
          <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">만료 임박</p><p className="text-2xl font-bold text-orange-600">{items.filter(i => i.is_expiring_soon).length}</p></div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <li className="px-4 py-5 text-center text-gray-500">해당 항목이 없습니다.</li>
            ) : filtered.map(item => (
              <li key={item.item_id} className={`px-4 py-4 sm:px-6 ${item.is_low_stock ? 'bg-red-50' : item.is_expiring_soon ? 'bg-orange-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">{item.item_name}</p>
                    <p className="text-sm text-gray-500">
                      {categoryLabel[item.category] || item.category} · 최소재고: {item.min_stock} {item.unit}
                      {item.expiry_date && ` · 유통기한: ${item.expiry_date}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.is_low_stock && <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">부족</span>}
                    {item.is_expiring_soon && <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">만료임박</span>}
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${item.is_low_stock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {item.quantity} {item.unit}
                    </span>
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
