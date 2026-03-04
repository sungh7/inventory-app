'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const navItem = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm font-medium ${
        pathname === href ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">재고 관리 시스템</h1>
            <div className="hidden sm:flex items-center gap-2">
              {navItem('/dashboard', '대시보드')}
              {navItem('/dashboard/items/new', '상품 추가')}
              {navItem('/dashboard/staff', '직원 관리')}
              {navItem('/dashboard/ai', 'AI 예측')}
            </div>
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
  );
}
