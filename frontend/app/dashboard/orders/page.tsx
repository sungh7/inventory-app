'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Order {
  id: number;
  supplier_id: number | null;
  status: string;
  memo: string | null;
  expected_date: string | null;
  total_amount: number;
  item_count: number;
}

interface OrderDetail extends Order {
  items: { item_id: number; name: string; unit: string; quantity: number; unit_price: number; subtotal: number }[];
}

interface RecommendItem {
  item_id: number;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  suggested_qty: number;
  unit_price: number;
  estimated_cost: number;
  supplier_id: number | null;
}

const statusLabel: Record<string, string> = { draft: '초안', sent: '발주완료', received: '입고완료' };
const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [recommend, setRecommend] = useState<{ count: number; total_estimated_cost: number; items: RecommendItem[] } | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchAll = async () => {
    try {
      const [ordersRes, recRes] = await Promise.all([
        axios.get(`${API_URL}/orders/`, { headers: authHeader() }),
        axios.get(`${API_URL}/orders/recommend`, { headers: authHeader() }),
      ]);
      setOrders(ordersRes.data || []);
      setRecommend(recRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('발주 데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  const viewDetail = async (id: number) => {
    try {
      const res = await axios.get(`${API_URL}/orders/${id}`, { headers: authHeader() });
      setDetail(res.data);
    } catch { setError('상세 조회 실패'); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await axios.patch(`${API_URL}/orders/${id}/status?status=${status}`, {}, { headers: authHeader() });
      fetchAll();
      if (detail?.id === id) viewDetail(id);
    } catch (err: any) { setError(err.response?.data?.detail || '상태 변경 실패'); }
  };

  const downloadPdf = (id: number) => {
    const token = localStorage.getItem('token');
    window.open(`${API_URL}/orders/${id}/pdf?token=${token}`, '_blank');
  };

  const createFromRecommend = async () => {
    if (!recommend || recommend.items.length === 0) return;
    try {
      await axios.post(`${API_URL}/orders/`, {
        items: recommend.items.map(r => ({ item_id: r.item_id, quantity: r.suggested_qty, unit_price: r.unit_price })),
        memo: 'AI 추천 발주',
      }, { headers: authHeader() });
      fetchAll();
    } catch (err: any) { setError(err.response?.data?.detail || '발주서 생성 실패'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        {recommend && recommend.items.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-semibold text-yellow-800">⚠️ 발주 추천 ({recommend.count}개 품목)</h3>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-yellow-700">예상 비용: ₩{Number(recommend.total_estimated_cost).toLocaleString()}</span>
                <button onClick={createFromRecommend} className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700">발주서 생성</button>
              </div>
            </div>
            <div className="space-y-1">
              {recommend.items.map(r => (
                <div key={r.item_id} className="flex justify-between text-sm">
                  <span>{r.name} (현재: {r.current_stock} / 최소: {r.min_stock} {r.unit})</span>
                  <span>추천: {r.suggested_qty} {r.unit} · ₩{Number(r.estimated_cost).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold">발주서 목록</h2>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {orders.length === 0 ? (
              <li className="px-4 py-5 text-center text-gray-500">발주서가 없습니다.</li>
            ) : orders.map(o => (
              <li key={o.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => viewDetail(o.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusColor[o.status]}`}>{statusLabel[o.status]}</span>
                      <p className="text-sm font-medium">발주서 #{o.id}</p>
                    </div>
                    <p className="text-sm text-gray-500">{o.item_count}개 품목 · ₩{Number(o.total_amount).toLocaleString()}{o.memo && ` · ${o.memo}`}</p>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {o.status === 'draft' && <button onClick={() => updateStatus(o.id, 'sent')} className="px-3 py-1 text-xs text-white bg-blue-600 rounded-md">발주 완료</button>}
                    {o.status === 'sent' && <button onClick={() => updateStatus(o.id, 'received')} className="px-3 py-1 text-xs text-white bg-green-600 rounded-md">입고 완료</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetail(null)}>
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">발주서 #{detail.id}</h3>
                <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-800">닫기</button>
              </div>
              <div className="space-y-1 text-sm mb-4">
                <p>상태: <span className={`px-2 py-1 text-xs rounded-full ${statusColor[detail.status]}`}>{statusLabel[detail.status]}</span></p>
                <p>총액: ₩{Number(detail.total_amount).toLocaleString()}</p>
                {detail.expected_date && <p>예상 입고일: {detail.expected_date}</p>}
                {detail.memo && <p>메모: {detail.memo}</p>}
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2">품목</p>
                {detail.items.map(i => (
                  <div key={i.item_id} className="flex justify-between text-sm py-1">
                    <span>{i.name} ({i.quantity} {i.unit})</span>
                    <span>₩{Number(i.subtotal).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
