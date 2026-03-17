'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MonthlyReport {
  year: number;
  month: number;
  period: string;
  revenue: { total: number; by_week: number[] };
  cost: { total_ingredient: number; total_purchase: number; total_disposal: number; by_week: number[] };
  margin: { total: number; rate: number; by_week: number[] };
  cost_rate: number;
  disposal_rate: number;
  top_menus: { menu_id: number; name: string; count: number; revenue: number; cost: number; margin_rate: number }[];
  disposal_items: { item_id: number; name: string; disposed_qty: number; unit: string; loss_krw: number }[];
  low_margin_menus: { menu_id: number; name: string; margin_rate: number }[];
}

interface WeeklyData {
  week_label: string;
  revenue: number;
  ingredient_cost: number;
  disposal_cost: number;
  margin: number;
  margin_rate: number;
  sale_count: number;
}

interface MenuPerf {
  menu_id: number;
  name: string;
  sell_price: number;
  cost_price: number;
  margin_rate: number;
  sale_count: number;
  total_revenue: number;
  rank: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData[]>([]);
  const [menuPerf, setMenuPerf] = useState<MenuPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'monthly' | 'weekly' | 'menu'>('monthly');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchAll = async () => {
    try {
      const [monthlyRes, weeklyRes, menuRes] = await Promise.all([
        axios.get(`${API_URL}/reports/monthly`, { headers: authHeader() }),
        axios.get(`${API_URL}/reports/weekly`, { headers: authHeader() }),
        axios.get(`${API_URL}/reports/menu-performance`, { headers: authHeader() }),
      ]);
      setMonthly(monthlyRes.data);
      setWeekly(weeklyRes.data?.data || []);
      setMenuPerf(menuRes.data?.menus || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('리포트 데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        <div className="flex gap-2">
          {(['monthly', 'weekly', 'menu'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-md ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}>
              {t === 'monthly' ? '📊 월간' : t === 'weekly' ? '📈 주간 추세' : '🍖 메뉴 성과'}
            </button>
          ))}
        </div>

        {tab === 'monthly' && monthly && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">{monthly.period} 월간 리포트</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">매출</p><p className="text-xl font-bold">₩{Number(monthly.revenue.total).toLocaleString()}</p></div>
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">재료비</p><p className="text-xl font-bold text-red-600">₩{Number(monthly.cost.total_ingredient).toLocaleString()}</p></div>
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">마진</p><p className="text-xl font-bold text-green-600">₩{Number(monthly.margin.total).toLocaleString()}</p></div>
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">마진율</p><p className="text-xl font-bold">{monthly.margin.rate}%</p></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">구매비</p><p className="text-lg font-bold">₩{Number(monthly.cost.total_purchase).toLocaleString()}</p></div>
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">폐기 손실</p><p className="text-lg font-bold text-red-600">₩{Number(monthly.cost.total_disposal).toLocaleString()}</p></div>
              <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-gray-500">원가율</p><p className="text-lg font-bold">{monthly.cost_rate}%</p></div>
            </div>

            {monthly.revenue.by_week.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-md font-semibold mb-3">주차별 추이</h3>
                {monthly.revenue.by_week.map((rev, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                    <span>{i + 1}주차</span>
                    <span>매출 ₩{Number(rev).toLocaleString()} · 원가 ₩{Number(monthly.cost.by_week[i]).toLocaleString()} · 마진 ₩{Number(monthly.margin.by_week[i]).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {monthly.top_menus.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-md font-semibold mb-3">메뉴 TOP</h3>
                {monthly.top_menus.map((m, i) => (
                  <div key={m.menu_id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                    <span>#{i + 1} {m.name} ({m.count}건)</span>
                    <span>₩{Number(m.revenue).toLocaleString()} · 마진 {m.margin_rate}%</span>
                  </div>
                ))}
              </div>
            )}

            {monthly.low_margin_menus.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-md font-semibold text-red-800 mb-2">⚠️ 저마진 메뉴 (40% 미만)</h3>
                {monthly.low_margin_menus.map(m => (
                  <p key={m.menu_id} className="text-sm text-red-700">{m.name}: 마진율 {m.margin_rate}%</p>
                ))}
              </div>
            )}

            {monthly.disposal_items.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-md font-semibold mb-3">폐기 상세</h3>
                {monthly.disposal_items.map(d => (
                  <div key={d.item_id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                    <span>{d.name} ({d.disposed_qty} {d.unit})</span>
                    <span className="text-red-600">₩{Number(d.loss_krw).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'weekly' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">주간 추세 (최근 8주)</h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {weekly.length === 0 ? (
                  <li className="px-4 py-5 text-center text-gray-500">데이터 없음</li>
                ) : weekly.map(w => (
                  <li key={w.week_label} className="px-4 py-3 sm:px-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{w.week_label}</p>
                        <p className="text-xs text-gray-500">{w.sale_count}건 판매</p>
                      </div>
                      <div className="text-sm text-right">
                        <p>매출 ₩{Number(w.revenue).toLocaleString()}</p>
                        <p className="text-gray-500">마진 ₩{Number(w.margin).toLocaleString()} ({w.margin_rate}%)</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'menu' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">메뉴 성과 분석 (30일)</h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {menuPerf.length === 0 ? (
                  <li className="px-4 py-5 text-center text-gray-500">데이터 없음</li>
                ) : menuPerf.map(m => (
                  <li key={m.menu_id} className="px-4 py-3 sm:px-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">#{m.rank} {m.name}</p>
                        <p className="text-xs text-gray-500">판매가 ₩{Number(m.sell_price).toLocaleString()} · 원가 ₩{Number(m.cost_price).toLocaleString()}</p>
                      </div>
                      <div className="text-sm text-right">
                        <p>{m.sale_count}건 · ₩{Number(m.total_revenue).toLocaleString()}</p>
                        <p className={`${m.margin_rate >= 40 ? 'text-green-600' : 'text-red-600'}`}>마진 {m.margin_rate}%</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
