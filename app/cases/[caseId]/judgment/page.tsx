import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Gavel } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import { generateSimulationJudgmentAction } from "@/app/cases/actions";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type JudgmentPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{
    judgment?: string;
    session?: string;
  }>;
};

function asTextList(value: Json) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (typeof item === "string") {
      return item;
    }

    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.entries(item)
        .map(([key, entry]) => `${key}: ${entry}`)
        .join(" · ");
    }

    return String(item);
  });
}

function JsonList({ title, items, emptyText }: { title: string; items: Json; emptyText: string }) {
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

export default async function JudgmentPage({ params, searchParams }: JudgmentPageProps) {
  const { caseId } = await params;
  const { judgment: selectedJudgmentId, session: selectedSessionId } = await searchParams;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: caseRecord, error: caseError },
    { data: sessions, error: sessionsError },
    { data: judgments, error: judgmentsError }
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id,title,case_type,user_position,short_description,status")
      .eq("id", caseId)
      .single(),
    supabase
      .from("simulation_sessions")
      .select("id,status,created_at,completed_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("simulation_judgments")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  if (judgmentsError) {
    throw new Error(judgmentsError.message);
  }

  const activeSession = selectedSessionId
    ? sessions?.find((item) => item.id === selectedSessionId) || sessions?.[0]
    : sessions?.[0];
  const activeJudgment = selectedJudgmentId
    ? judgments?.find((item) => item.id === selectedJudgmentId) || judgments?.[0]
    : judgments?.[0];
  const generateJudgment = generateSimulationJudgmentAction.bind(null, caseId, activeSession?.id);

  return (
    <>
      <CaseStepNav caseId={caseId} current="judgment" />
      <PageTitle
        eyebrow="Step 06"
        title="판사 판단문"
        description="AI 판단문은 실제 판례와 분리 저장하며, 실제 결과 예측이 아닌 시뮬레이션 결과로 표시합니다."
        action={
          activeJudgment ? (
            <Link className="button" href={`/cases/${caseId}/report`}>
              상담 리포트로 이동 <ArrowRight size={18} />
            </Link>
          ) : null
        }
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

        <form className="card form" action={generateJudgment}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Judge AI</p>
              <h2>판단문 생성</h2>
            </div>
            <span className={activeSession ? "tag" : "tag gold"}>{activeSession ? "세션 있음" : "세션 필요"}</span>
          </div>
          {!activeSession ? <p className="inline-alert">판단문 생성 전에 1심 시뮬레이션을 먼저 실행해주세요.</p> : null}
          <p className="muted">
            최신 시뮬레이션 로그를 바탕으로 인정 사실, 쟁점별 판단, 증거 평가, 불확실한 부분, 상담 체크포인트를
            생성합니다.
          </p>
          <button className="button" type="submit" disabled={!activeSession}>
            <Gavel size={18} /> 판단문 생성
          </button>
        </form>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Judgments</p>
              <h2>저장된 판단문</h2>
            </div>
            <span className="tag">{judgments?.length || 0}개</span>
          </div>
          {judgments && judgments.length > 0 ? (
            <ul className="case-list">
              {judgments.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.model || "AI 판단문"}</strong>
                    <small>{new Date(item.created_at).toLocaleString("ko-KR")}</small>
                  </span>
                  <Link className={activeJudgment?.id === item.id ? "tag gold" : "tag"} href={`/cases/${caseId}/judgment?judgment=${item.id}`}>
                    보기
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">아직 저장된 판단문이 없습니다.</p>
          )}
        </article>

        <aside className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Notice</p>
              <h2>저장 원칙</h2>
            </div>
          </div>
          <p className="muted">
            공식 판례는 legal_sources에, AI 생성 판단문은 simulation_judgments에 저장합니다. 이 판단문은 상담 준비용
            시뮬레이션 결과입니다.
          </p>
        </aside>
      </section>

      {activeJudgment ? (
        <section className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Virtual Judgment</p>
              <h2>판단 요약</h2>
            </div>
            <span className="tag rose">simulation</span>
          </div>
          <p className="inline-alert">{activeJudgment.safety_notice}</p>
          <div className="stack">
            <div>
              <h3>결론</h3>
              <p>{activeJudgment.conclusion}</p>
            </div>
            <JsonList title="인정 사실" items={activeJudgment.recognized_facts} emptyText="인정 사실이 없습니다." />
            <JsonList title="쟁점별 판단" items={activeJudgment.issue_judgments} emptyText="쟁점별 판단이 없습니다." />
            <JsonList title="증거 평가" items={activeJudgment.evidence_assessment} emptyText="증거 평가가 없습니다." />
            <JsonList title="관련 법령" items={activeJudgment.related_laws} emptyText="관련 법령이 없습니다." />
            <JsonList title="관련 판례" items={activeJudgment.related_precedents} emptyText="관련 판례가 없습니다." />
            <JsonList title="불확실한 부분" items={activeJudgment.uncertainties} emptyText="불확실한 부분이 없습니다." />
            <JsonList
              title="상담 체크포인트"
              items={activeJudgment.consultation_checkpoints}
              emptyText="상담 체크포인트가 없습니다."
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
