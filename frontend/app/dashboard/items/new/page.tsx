'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import TopNav from '../../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function BarcodeLoader({ onBarcode }: { onBarcode: (barcode: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const barcode = searchParams?.get('barcode');
    if (barcode) {
      onBarcode(barcode);
    }
  }, [searchParams, onBarcode]);

  return null;
}

function NewItemForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    category: 'OTHER',
    unit: '',
    unit_price: 0,
    min_stock: 0,
    supplier_id: '' as string | number,
  });

  const handleBarcodeFromUrl = (barcode: string) => {
    setForm((prev) => ({ ...prev, barcode }));
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const payload = {
        name: form.name,
        barcode: form.barcode || null,
        category: form.category,
        unit: form.unit,
        unit_price: Number(form.unit_price) || 0,
        min_stock: Number(form.min_stock) || 0,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      };

      await axios.post(`${API_URL}/items/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      router.push('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError(err.response?.data?.detail || '상품 생성에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <Suspense fallback={null}>
        <BarcodeLoader onBarcode={handleBarcodeFromUrl} />
      </Suspense>
      <div className="max-w-3xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6">상품 추가</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">상품명</label>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">바코드</label>
            <input
              name="barcode"
              value={form.barcode}
              onChange={onChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">카테고리</label>
            <select
              name="category"
              value={form.category}
              onChange={onChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="MEAT">육류</option>
              <option value="VEGETABLE">채소</option>
              <option value="SAUCE">소스</option>
              <option value="DRINK">음료</option>
              <option value="OTHER">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">단위</label>
            <input
              name="unit"
              value={form.unit}
              onChange={onChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">단가</label>
            <input
              name="unit_price"
              type="number"
              value={form.unit_price}
              onChange={onChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">최소재고</label>
            <input
              name="min_stock"
              type="number"
              value={form.min_stock}
              onChange={onChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">공급사 ID (선택)</label>
            <input
              name="supplier_id"
              type="number"
              value={form.supplier_id}
              onChange={onChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center">로딩 중...</div>}>
      <NewItemForm />
    </Suspense>
  );
}
