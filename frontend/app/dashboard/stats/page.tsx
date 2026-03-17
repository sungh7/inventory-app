'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Summary {
  total_items: number;
  low_stock_count: number;
  expiring_soon_count: number;
  today_in: number;
  today_out: number;
}

interface ConsumptionItem { item_id: number; name: string; unit: string; total: number; }
interface DisposalItem { item_id: number; name: string; unit: string; disposed_qty: number; loss_krw: number; }
interface CategoryStock { category: string; label: string; item_count: number; total_qty: number; }

export default function StatsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionItem[]>([]);
  const [disposal, setDisposal] = useState<{ period_days: number; total_loss_krw: number; items: DisposalItem[] } | null>(null);
  const [categoryStock, setCategoryStock] = useState<CategoryStock[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll();
  }, [router, days]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sumRes, conRes, disRes, catRes] = await Promise.all([
        axios.get(`${API_URL}/stats/summary`, { headers: authHeader() }),
        axios.get(`${API_URL}/stats/consumption?days=${days}`, { headers: authHeader() }),
        axios.get(`${API_URL}/stats/disposal?days=${days}`, { headers: authHeader() }),
        axios.get(`${API_URL}/stats/category-stock`, { headers: authHeader() }),
      ]);
      setSummary(sumRes.data);
      setConsumption(conRes.data || []);
      setDisposal(disRes.data);
      setCategoryStock(catRes.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('통계 데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">전체 품목</p><p className="text-2xl font-bold">{summary.total_items}</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">재고 부족</p><p className="text-2xl font-bold text-red-600">{summary.low_stock_count}</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">만료 임박</p><p className="text-2xl font-bold text-orange-600">{summary.expiring_soon_count}</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">오늘 입고</p><p className="text-2xl font-bold text-green-600">{summary.today_in}</p></div>
            <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">오늘 출고</p><p className="text-2xl font-bold text-blue-600">{summary.today_out}</p></div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">소비량 TOP</h2>
          <div className="flex gap-2">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 text-sm rounded-md ${days === d ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}>
                {d}일
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {consumption.length === 0 ? (
              <li className="px-4 py-5 text-center text-gray-500">소비 데이터가 없습니다.</li>
            ) : consumption.map((c, i) => (
              <li key={c.item_id} className="px-4 py-3 sm:px-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 w-8">#{i + 1}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                </div>
                <span className="text-sm font-semibold">{c.total} {c.unit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-md font-semibold mb-3">카테고리별 재고</h3>
            {categoryStock.length === 0 ? (
              <p className="text-sm text-gray-500">데이터 없음</p>
            ) : categoryStock.map(c => (
              <div key={c.category} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm">{c.label} ({c.item_count}개)</span>
                <span className="text-sm font-semibold">{c.total_qty}</span>
              </div>
            ))}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-md font-semibold mb-3">
              폐기 손실 ({days}일)
              {disposal && <span className="text-red-600 ml-2">₩{Number(disposal.total_loss_krw).toLocaleString()}</span>}
            </h3>
            {!disposal || disposal.items.length === 0 ? (
              <p className="text-sm text-gray-500">폐기 내역 없음 ✅</p>
            ) : disposal.items.map(d => (
              <div key={d.item_id} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm">{d.name} ({d.disposed_qty} {d.unit})</span>
                <span className="text-sm font-semibold text-red-600">₩{Number(d.loss_krw).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
