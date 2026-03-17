'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

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

  useEffect(() => {
    if (!isScanning) return;
    setScanError('');

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const start = async () => {
      if (!videoRef.current) return;
      try {
        const deviceId: string | undefined = undefined;
        await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if (result) {
            const code = result.getText();
            setIsScanning(false);
            (reader as any)?.reset?.();
            router.push(`/dashboard/items/new?barcode=${encodeURIComponent(code)}`);
          }
        });
      } catch (err: any) {
        setScanError('카메라 접근 실패. 브라우저 권한을 확인해주세요.');
      }
    };

    start();

    return () => {
      (reader as any)?.reset?.();
    };
  }, [isScanning, router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">재고 관리 시스템</h1>
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {navItem('/dashboard', '대시보드')}
                {navItem('/dashboard/inventory', '재고')}
                {navItem('/dashboard/transactions', '입출고')}
                {navItem('/dashboard/menus', '메뉴')}
                {navItem('/dashboard/sales', '판매')}
                {navItem('/dashboard/orders', '발주')}
                {navItem('/dashboard/suppliers', '공급업체')}
                {navItem('/dashboard/stats', '통계')}
                {navItem('/dashboard/reports', '리포트')}
                {navItem('/dashboard/staff', '직원')}
                {navItem('/dashboard/ai', 'AI')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsScanning(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
              >
                📷 바코드 스캔
              </button>
              <button
                onClick={handleLogout}
                className="ml-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">바코드 스캔</h3>
              <button
                onClick={() => {
                  setIsScanning(false);
                  (readerRef.current as any)?.reset?.();
                }}
                className="text-gray-500 hover:text-gray-800"
              >
                닫기
              </button>
            </div>
            <div className="aspect-video bg-black rounded-md overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" />
            </div>
            {scanError && <p className="text-sm text-red-600 mt-2">{scanError}</p>}
            <p className="text-xs text-gray-500 mt-2">카메라 권한을 허용하면 자동으로 인식됩니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
