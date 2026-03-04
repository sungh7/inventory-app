'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ForecastItem {
  item_id: number;
  item_name: string;
  unit: string;
  current_stock: number;
  daily_avg: number;
  forecast_total: number;
  trend?: string;
  confidence?: string;
}

interface SmartOrderItem {
  item_id: number;
  item_name: string;
  unit: string;
  current_stock: number;
  reorder_point: number;
  suggested_qty: number;
  estimated_cost: number;
  reason: string;
}

export default function AiPage() {
  const router = useRouter();
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [smartOrder, setSmartOrder] = useState<SmartOrderItem[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchAll();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchAll = async () => {
    setError('');
    setLoading(true);
    try {
      const [forecastRes, smartRes] = await Promise.all([
        axios.get(`${API_URL}/ai/forecast`, { headers: authHeader() }),
        axios.get(`${API_URL}/ai/smart-order`, { headers: authHeader() }),
      ]);
      setForecast(forecastRes.data || []);
      setSmartOrder(smartRes.data?.items || []);
      setTotalCost(smartRes.data?.total_estimated_cost || 0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError('AI 예측 데이터를 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">AI 소비량 예측</h2>
          <button
            onClick={fetchAll}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            새로고침
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {forecast.length === 0 ? (
              <li className="px-4 py-5 sm:px-6 text-center text-gray-500">예측 데이터가 없습니다.</li>
            ) : (
              forecast.map((f) => (
                <li key={f.item_id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{f.item_name}</p>
                      <p className="text-sm text-gray-500">
                        재고 {f.current_stock} {f.unit} · 일평균 {f.daily_avg} · 14일 예측 {f.forecast_total}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {f.trend && <span className="mr-2">추세: {f.trend}</span>}
                      {f.confidence && <span>신뢰도: {f.confidence}</span>}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white shadow sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg leading-6 font-medium text-gray-900">AI 발주 추천</h2>
            <span className="text-sm text-gray-600">예상 비용 합계: ₩{Number(totalCost).toLocaleString()}</span>
          </div>
          <ul className="divide-y divide-gray-200">
            {smartOrder.length === 0 ? (
              <li className="px-4 py-5 sm:px-6 text-center text-gray-500">추천 발주 품목이 없습니다.</li>
            ) : (
              smartOrder.map((s) => (
                <li key={s.item_id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{s.item_name}</p>
                      <p className="text-sm text-gray-500">
                        현재 {s.current_stock} {s.unit} · 기준 {s.reorder_point} · 추천 {s.suggested_qty}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                    </div>
                    <div className="text-sm font-semibold">₩{Number(s.estimated_cost).toLocaleString()}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
