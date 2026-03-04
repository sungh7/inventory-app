'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import TopNav from '../_components/TopNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Staff {
  id: number;
  name: string;
  role: string;
  pin?: string | null;
  is_active: boolean;
}

interface StaffSummary {
  staff_id: number;
  name: string;
  role: string;
  in_count: number;
  out_count: number;
  dispose_count: number;
  sale_count: number;
  last_activity?: string | null;
}

export default function StaffPage() {
  const router = useRouter();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [summary, setSummary] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', role: 'staff', pin: '' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchAll();
  }, [router]);

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const fetchAll = async () => {
    try {
      const [staffRes, summaryRes] = await Promise.all([
        axios.get(`${API_URL}/staff/`, { headers: authHeader() }),
        axios.get(`${API_URL}/staff/summary`, { headers: authHeader() }),
      ]);
      setStaffs(staffRes.data || []);
      setSummary(summaryRes.data || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        router.push('/login');
      } else {
        setError('직원 데이터를 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(
        `${API_URL}/staff/`,
        { name: form.name, role: form.role, pin: form.pin || null },
        { headers: authHeader() }
      );
      setForm({ name: '', role: 'staff', pin: '' });
      fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.detail || '직원 등록 실패');
    }
  };

  const onDeactivate = async (id: number) => {
    if (!confirm('직원을 비활성화할까요?')) return;
    try {
      await axios.delete(`${API_URL}/staff/${id}`, { headers: authHeader() });
      fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.detail || '직원 비활성화 실패');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const summaryMap = new Map(summary.map((s) => [s.staff_id, s]));

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">직원 등록</h2>
          <form onSubmit={onCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              placeholder="이름"
              required
              className="border rounded-md px-3 py-2"
            />
            <select name="role" value={form.role} onChange={onChange} className="border rounded-md px-3 py-2">
              <option value="staff">staff</option>
              <option value="manager">manager</option>
              <option value="owner">owner</option>
            </select>
            <input
              name="pin"
              value={form.pin}
              onChange={onChange}
              placeholder="PIN (선택)"
              className="border rounded-md px-3 py-2"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              등록
            </button>
          </form>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">직원 목록</h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {staffs.length === 0 ? (
              <li className="px-4 py-5 sm:px-6 text-center text-gray-500">등록된 직원이 없습니다.</li>
            ) : (
              staffs.map((s) => {
                const sum = summaryMap.get(s.id);
                return (
                  <li key={s.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-600">{s.name}</p>
                        <p className="text-sm text-gray-500">역할: {s.role}</p>
                        {sum && (
                          <p className="text-xs text-gray-500 mt-1">
                            입고 {sum.in_count} / 출고 {sum.out_count} / 폐기 {sum.dispose_count} / 판매 {sum.sale_count}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {sum?.last_activity && (
                          <span className="text-xs text-gray-500">최근 활동: {new Date(sum.last_activity).toLocaleDateString()}</span>
                        )}
                        <button
                          onClick={() => onDeactivate(s.id)}
                          className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700"
                        >
                          비활성화
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
