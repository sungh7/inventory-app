'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  email: string | null;
  memo: string | null;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', contact: '', email: '', memo: '' });
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, [router]);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/suppliers/`, { headers: authHeader() });
      setSuppliers(res.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); }
      else setError('공급업체 데이터를 불러오는데 실패했습니다.');
    } finally { setLoading(false); }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { name: form.name, contact: form.contact || null, email: form.email || null, memo: form.memo || null };
      if (editId) {
        await axios.patch(`${API_URL}/suppliers/${editId}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API_URL}/suppliers/`, payload, { headers: authHeader() });
      }
      setForm({ name: '', contact: '', email: '', memo: '' });
      setEditId(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || '처리 실패');
    }
  };

  const onEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({ name: s.name, contact: s.contact || '', email: s.email || '', memo: s.memo || '' });
  };

  const onDelete = async (id: number) => {
    if (!confirm('공급업체를 삭제할까요?')) return;
    try {
      await axios.delete(`${API_URL}/suppliers/${id}`, { headers: authHeader() });
      fetchData();
    } catch (err: any) { setError(err.response?.data?.detail || '삭제 실패'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && <div className="rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">{editId ? '공급업체 수정' : '공급업체 등록'}</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input name="name" value={form.name} onChange={onChange} placeholder="업체명" required className="border rounded-md px-3 py-2" />
            <input name="contact" value={form.contact} onChange={onChange} placeholder="연락처" className="border rounded-md px-3 py-2" />
            <input name="email" value={form.email} onChange={onChange} placeholder="이메일" type="email" className="border rounded-md px-3 py-2" />
            <input name="memo" value={form.memo} onChange={onChange} placeholder="메모" className="border rounded-md px-3 py-2" />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                {editId ? '수정' : '등록'}
              </button>
              {editId && <button type="button" onClick={() => { setEditId(null); setForm({ name: '', contact: '', email: '', memo: '' }); }} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md">취소</button>}
            </div>
          </form>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6"><h2 className="text-lg font-medium text-gray-900">공급업체 목록</h2></div>
          <ul className="divide-y divide-gray-200">
            {suppliers.length === 0 ? (
              <li className="px-4 py-5 text-center text-gray-500">등록된 공급업체가 없습니다.</li>
            ) : suppliers.map(s => (
              <li key={s.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">{s.name}</p>
                    <p className="text-sm text-gray-500">
                      {s.contact && `📞 ${s.contact}`}{s.email && ` · ✉️ ${s.email}`}{s.memo && ` · ${s.memo}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(s)} className="px-3 py-1 text-sm text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50">수정</button>
                    <button onClick={() => onDelete(s.id)} className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">삭제</button>
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
