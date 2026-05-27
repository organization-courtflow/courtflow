import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import { generateConsultationReportAction } from "@/app/cases/actions";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type ReportPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{
    report?: string;
    judgment?: string;
  }>;
};

function formatJsonEntry(value: Json | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatJsonEntry).filter(Boolean).join(" · ");
  }

  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${formatJsonEntry(entry)}`)
    .join(" · ");
}

function asTextList(value: Json) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(formatJsonEntry).filter(Boolean);
}

function ReportList({ title, items, emptyText }: { title: string; items: Json; emptyText: string }) {
  const values = asTextList(items);

  return (
    <div>
      <h3>{title}</h3>
      {values.length > 0 ? (
        <ul className="plain-list">
          {values.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </div>
  );
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const { caseId } = await params;
  const { report: selectedReportId, judgment: selectedJudgmentId } = await searchParams;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: caseRecord, error: caseError },
    { data: judgments, error: judgmentsError },
    { data: reports, error: reportsError }
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id,title,case_type,user_position,short_description,status")
      .eq("id", caseId)
      .single(),
    supabase
      .from("simulation_judgments")
      .select("id,conclusion,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("consultation_reports")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (judgmentsError) {
    throw new Error(judgmentsError.message);
  }

  if (reportsError) {
    throw new Error(reportsError.message);
  }

  const activeJudgment = selectedJudgmentId
    ? judgments?.find((item) => item.id === selectedJudgmentId) || judgments?.[0]
    : judgments?.[0];
  const activeReport = selectedReportId
    ? reports?.find((item) => item.id === selectedReportId) || reports?.[0]
    : reports?.[0];
  const generateReport = generateConsultationReportAction.bind(null, caseId, activeJudgment?.id);
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  return (
    <>
      <CaseStepNav caseId={caseId} current="report" />
      <PageTitle
        eyebrow="Final"
        title="상담 준비 리포트"
        description="사건 요약, 핵심 쟁점, 주요 증거, 예상 반박, 변호사에게 물어볼 질문, 가져갈 자료 체크리스트를 정리합니다."
      />

      <section className="grid two">
        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Case</p>
              <h2>{caseRecord.title}</h2>
            </div>
            <span className="tag">{formatCaseStatus(caseRecord.status)}</span>
          </div>
          <p className="muted">
            {formatCaseType(caseRecord.case_type)}
            {caseRecord.user_position ? ` · ${caseRecord.user_position}` : ""}
          </p>
          {caseRecord.short_description ? <p>{caseRecord.short_description}</p> : null}
        </article>

        <form className="card form" action={generateReport}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Report</p>
              <h2>리포트 생성</h2>
            </div>
            <span className={activeJudgment ? "tag" : "tag gold"}>{activeJudgment ? "판단문 있음" : "판단문 필요"}</span>
          </div>
          {!activeJudgment ? <p className="inline-alert">상담 리포트 생성 전에 판사 판단문을 먼저 생성해주세요.</p> : null}
          {!hasOpenAiKey ? <p className="inline-alert">OPENAI_API_KEY가 없어 리포트 생성 버튼을 비활성화했습니다.</p> : null}
          <p className="muted">
            최신 판단문과 지금까지 정리한 자료를 상담용 요약, 질문, 자료 체크리스트로 압축합니다.
          </p>
          <button className="button" type="submit" disabled={!activeJudgment || !hasOpenAiKey}>
            <FileText size={18} /> 상담 리포트 생성
          </button>
        </form>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Reports</p>
              <h2>저장된 리포트</h2>
            </div>
            <span className="tag">{reports?.length || 0}개</span>
          </div>
          {reports && reports.length > 0 ? (
            <ul className="case-list">
              {reports.map((report) => (
                <li key={report.id}>
                  <span>
                    <strong>{report.case_summary || "상담 준비 리포트"}</strong>
                    <small>{new Date(report.created_at).toLocaleString("ko-KR")}</small>
                  </span>
                  <Link className={activeReport?.id === report.id ? "tag gold" : "tag"} href={`/cases/${caseId}/report?report=${report.id}`}>
                    보기
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">아직 저장된 상담 리포트가 없습니다.</p>
          )}
        </article>

        <aside className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Judgment</p>
              <h2>기준 판단문</h2>
            </div>
          </div>
          {activeJudgment ? (
            <>
              <p>{activeJudgment.conclusion}</p>
              <p className="muted">{new Date(activeJudgment.created_at).toLocaleString("ko-KR")}</p>
            </>
          ) : (
            <p className="muted">판사 판단문을 생성하면 리포트 기준 자료로 사용됩니다.</p>
          )}
        </aside>
      </section>

      {activeReport ? (
        <section className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Consultation Brief</p>
              <h2>상담용 정리본</h2>
            </div>
            <span className="tag rose">not legal advice</span>
          </div>
          <p className="inline-alert">본 리포트는 실제 법률 자문이 아니라 변호사 상담 준비를 돕는 정리 자료입니다.</p>
          <div className="stack">
            <div>
              <h3>사건 요약</h3>
              <p>{activeReport.case_summary || "사건 요약이 없습니다."}</p>
            </div>
            <div>
              <h3>시뮬레이션 요약</h3>
              <p>{activeReport.simulation_summary || "시뮬레이션 요약이 없습니다."}</p>
            </div>
            <ReportList title="시간순 경위" items={activeReport.timeline} emptyText="시간순 경위가 없습니다." />
            <ReportList title="관련 인물" items={activeReport.people} emptyText="관련 인물이 없습니다." />
            <ReportList title="사용자 목표" items={activeReport.user_goals} emptyText="사용자 목표가 없습니다." />
            <ReportList title="핵심 증거" items={activeReport.key_evidences} emptyText="핵심 증거가 없습니다." />
            <ReportList title="부족한 증거" items={activeReport.missing_evidences} emptyText="부족한 증거가 없습니다." />
            <ReportList title="핵심 쟁점" items={activeReport.key_issues} emptyText="핵심 쟁점이 없습니다." />
            <ReportList title="사용자 측 주장" items={activeReport.user_arguments} emptyText="사용자 측 주장이 없습니다." />
            <ReportList title="상대 측 주장" items={activeReport.opponent_arguments} emptyText="상대 측 주장이 없습니다." />
            <ReportList title="관련 공식 자료" items={activeReport.related_sources} emptyText="관련 공식 자료가 없습니다." />
            <ReportList title="변호사에게 물어볼 질문" items={activeReport.questions_for_lawyer} emptyText="질문이 없습니다." />
            <ReportList
              title="상담 자료 체크리스트"
              items={activeReport.consultation_material_checklist}
              emptyText="체크리스트가 없습니다."
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
