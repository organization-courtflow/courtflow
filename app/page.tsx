import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, FileCheck2, KeyRound, Plus, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/PageTitle";
import { getDashboardState } from "@/lib/cases/dashboard";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";

export const dynamic = "force-dynamic";

function statusTagClass(status: string) {
  if (status === "draft" || status === "judged") {
    return "tag rose";
  }

  if (status.includes("evidence") || status.includes("simulation")) {
    return "tag gold";
  }

  return "tag";
}

export default async function HomePage() {
  const dashboard = await getDashboardState();
  const sourceCount = dashboard.legalSourceCount ?? 0;
  const caseCount = dashboard.caseCount ?? 0;

  return (
    <>
      <PageTitle
        eyebrow="작업 공간"
        title="상담 전 사건을 정리하고 1심 흐름으로 점검합니다."
        description="사건 입력, 증거 정리, 공식 자료 기반 검색, 양측 주장 준비, 판사 판단, 상담 리포트까지 한 흐름으로 진행합니다."
        action={
          <Link className="button" href="/cases/new" aria-label="새 사건 생성">
            <Plus size={18} /> 새 사건
          </Link>
        }
      />

      <section className="metrics-grid" aria-label="프로젝트 상태">
        <article className="metric-card">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span>
            <strong>{dashboard.userEmail ? "로그인됨" : "확인 필요"}</strong>
            <small>{dashboard.userEmail || "로그인 필요"}</small>
          </span>
        </article>
        <article className="metric-card">
          <FileCheck2 size={20} aria-hidden="true" />
          <span>
            <strong>{caseCount}건</strong>
            <small>내 사건 수</small>
          </span>
        </article>
        <article className="metric-card">
          <KeyRound size={20} aria-hidden="true" />
          <span>
            <strong>{sourceCount}건</strong>
            <small>공식 자료</small>
          </span>
        </article>
        <article className="metric-card">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            <strong>계정별 관리</strong>
            <small>내 사건만 표시</small>
          </span>
        </article>
      </section>

      <section className="grid two">
        <div className="stack">
          <div className="brand-panel">
            <Image src="/logo-lockup.svg" alt="CourtFlow AI 로고" width={1200} height={420} priority />
          </div>
          <div className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">사건</p>
                <h2>진행 중인 사건</h2>
              </div>
              <span className={dashboard.connected ? "tag" : "tag gold"}>
                {dashboard.connected ? "연결됨" : "예시"}
              </span>
            </div>
            {dashboard.error ? <p className="inline-alert">{dashboard.error}</p> : null}
            <ul className="case-list">
              {dashboard.cases.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {formatCaseType(item.caseType)} · {item.description}
                    </small>
                  </span>
                  <span className={statusTagClass(item.status)}>{formatCaseStatus(item.status)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="stack">
          <div className="card compact">
            <h2>공식 자료 사용 원칙</h2>
            <p className="muted">
              AI는 국가법령정보 Open API의 JSON 응답 또는 저장된 공식 자료만 법령/판례 근거로 사용할 수 있습니다.
            </p>
          </div>
          <div className="card compact">
            <h2>단계 분리</h2>
            <p className="muted">
              새 사건 생성 후 사건 정리, 증거 정리, 법령 검색, 주장 준비, 시뮬레이션, 판단문, 리포트가 각각 별도 화면에서 진행됩니다.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
