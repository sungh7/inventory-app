import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "재고 관리 시스템",
  description: "간편한 재고 관리 웹 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
