'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Item {
  id: number;
  name: string;
  barcode: string | null;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  category: string | null;
  location: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchItems();
  }, [router]);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/items/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const itemsData = response.data.items || [];
      setItems(itemsData);
      
      // 통계 계산
      setStats({
        total: itemsData.length,
        lowStock: itemsData.filter((item: Item) => item.quantity <= item.low_stock_threshold).length,
      });
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
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
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">재고 관리 시스템</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">전체 상품</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-3xl font-bold text-red-600">{stats.lowStock}</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">재고 부족</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 상품 목록 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h2 className="text-lg leading-6 font-medium text-gray-900">상품 목록</h2>
            <button
              onClick={() => router.push('/dashboard/items/new')}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              + 상품 추가
            </button>
          </div>
          <ul className="divide-y divide-gray-200">
            {items.length === 0 ? (
              <li className="px-4 py-5 sm:px-6 text-center text-gray-500">
                등록된 상품이 없습니다.
              </li>
            ) : (
              items.map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-indigo-600">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.barcode && `바코드: ${item.barcode} | `}
                        카테고리: {item.category || '미분류'} | 위치: {item.location || '미지정'}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                        item.quantity <= item.low_stock_threshold
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.quantity} {item.unit}
                      </span>
                    </div>
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
