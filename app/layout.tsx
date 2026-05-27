import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";
import { SidebarCaseList } from "@/components/SidebarCaseList";
import { getSidebarCases } from "@/lib/cases/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourtFlow AI",
  description: "상담 전 사건 정리와 쟁점 파악을 돕는 1심 법정 시뮬레이션 도구",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") || "";
  const isAuthPage = pathname === "/login" || pathname === "/signin";
  const sidebarCases = isAuthPage ? [] : await getSidebarCases();

  return (
    <html lang="ko">
      <body>
        {isAuthPage ? (
          <main className="auth-page">{children}</main>
        ) : (
          <div className="app-shell">
            <aside className="sidebar">
              <Link href="/" className="brand" aria-label="CourtFlow AI 홈">
                <Image src="/logo.svg" alt="" width={42} height={42} priority />
                <span>
                  <strong>CourtFlow AI</strong>
                  <small>Simulation</small>
                </span>
              </Link>
              <nav className="nav-list" aria-label="주요 메뉴">
                <Link href="/">
                  <LayoutDashboard size={17} /> 사건 대시보드
                </Link>
                <Link href="/cases/new" className="new-case-link">
                  <Plus size={17} /> 새 사건 생성
                </Link>
              </nav>
              <section className="sidebar-cases" aria-label="사건 목록">
                <div className="sidebar-section-title">
                  <span>사건 목록</span>
                  <small>{sidebarCases.length}건</small>
                </div>
                <SidebarCaseList cases={sidebarCases} />
              </section>
              <p className="notice">
                실제 판결 예측이나 법률 자문이 아닌 상담 준비용
                시뮬레이션입니다.
              </p>
            </aside>
            <main className="main-panel">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
