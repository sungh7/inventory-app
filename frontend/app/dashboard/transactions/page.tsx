'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Transaction {
  id: number;
  item_id: number;
  item_name: string | null;
  type: string;
  quantity: number;
  unit_price: number | null;
  expiry_date: string | null;
  memo: string | null;
  created_at: string | null;
  staff_id: number | null;
  staff_name: string | null;
}

interface Item {
  id: number;
  name: string;
  unit: string;
}

const typeLabel: Record<string, string> = { in: '입고', out: '출고', dispose: '폐기', IN: '입고', OUT: '출고', DISPOSE: '폐기' };
const typeColor: Record<string, string> = {
  in: 'bg-green-100 text-green-800', out: 'bg-blue-100 text-blue-800', dispose: 'bg-red-100 text-red-800',
  IN: 'bg-green-100 text-green-800', OUT: 'bg-blue-100 text-blue-800', DISPOSE: 'bg-red-100 text-red-800',
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ item_id: '', type: 'in', quantity: '', unit_price: '', expiry_date: '', memo: '', staff_id: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchAll = async () => {
    try {
      const [txRes, itemRes, staffRes] = await Promise.all([
        axios.get(`${API_URL}/transactions/`, { headers: authHeader() }),
        axios.get(`${API_URL}/items/`, { headers: authHeader() }),
        axios.get(`${API_URL}/staff/`, { headers: authHeader() }),
      ]);
      setTransactions(txRes.data || []);
      setItems(itemRes.data || []);
      setStaffList(staffRes.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await axios.post(`${API_URL}/transactions/`, {
        item_id: Number(form.item_id),
        type: form.type,
        quantity: Number(form.quantity),
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        expiry_date: form.expiry_date || null,
        memo: form.memo || null,
        staff_id: form.staff_id ? Number(form.staff_id) : null,
      }, { headers: authHeader() });
      setForm({ item_id: '', type: 'IN', quantity: '', unit_price: '', expiry_date: '', memo: '', staff_id: '' });
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || '처리 실패');
    }
  };

  const filtered = filter ? transactions.filter(t => t.type === filter) : transactions;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && <div className="mb-4 rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">입출고 기록</h2>
          <div className="flex gap-2">
            {['', 'in', 'out', 'dispose'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-sm rounded-md ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}>
                {f === '' ? '전체' : typeLabel[f]}
              </button>
            ))}
            <button onClick={() => setShowForm(!showForm)}
              className="px-4 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
              + 새 거래
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-md font-semibold mb-4">새 입출고 등록</h3>
            {formError && <div className="mb-3 rounded-md bg-red-50 p-3"><p className="text-sm text-red-800">{formError}</p></div>}
            <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <select name="item_id" value={form.item_id} onChange={onChange} required className="border rounded-md px-3 py-2">
                <option value="">품목 선택</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select name="type" value={form.type} onChange={onChange} className="border rounded-md px-3 py-2">
                <option value="in">입고</option>
                <option value="out">출고</option>
                <option value="dispose">폐기</option>
              </select>
              <input name="quantity" type="number" step="0.01" value={form.quantity} onChange={onChange} placeholder="수량" required className="border rounded-md px-3 py-2" />
              <input name="unit_price" type="number" value={form.unit_price} onChange={onChange} placeholder="단가 (선택)" className="border rounded-md px-3 py-2" />
              <input name="expiry_date" type="date" value={form.expiry_date} onChange={onChange} className="border rounded-md px-3 py-2" />
              <select name="staff_id" value={form.staff_id} onChange={onChange} className="border rounded-md px-3 py-2">
                <option value="">담당자 (선택)</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input name="memo" value={form.memo} onChange={onChange} placeholder="메모 (선택)" className="border rounded-md px-3 py-2 sm:col-span-2" />
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">등록</button>
            </form>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <li className="px-4 py-5 text-center text-gray-500">거래 내역이 없습니다.</li>
            ) : filtered.map(tx => (
              <li key={tx.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${typeColor[tx.type]}`}>{typeLabel[tx.type]}</span>
                      <p className="text-sm font-medium text-indigo-600">{tx.item_name}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      수량: {tx.quantity}
                      {tx.unit_price != null && ` · 단가: ₩${Number(tx.unit_price).toLocaleString()}`}
                      {tx.staff_name && ` · 담당: ${tx.staff_name}`}
                      {tx.memo && ` · ${tx.memo}`}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {tx.created_at && new Date(tx.created_at).toLocaleString('ko-KR')}
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
