import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Play } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import { generateSimulationSessionAction } from "@/app/cases/actions";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type SimulatePageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{
    session?: string;
  }>;
};

function formatRole(role: string) {
  const labels: Record<string, string> = {
    recorder: "기록관",
    counsel: "변호사",
    opponent: "상대방",
    prosecutor: "검사",
    judge: "판사"
  };

  return labels[role] || role;
}

function citationCount(value: Json) {
  return Array.isArray(value) ? value.length : 0;
}

export default async function SimulatePage({ params, searchParams }: SimulatePageProps) {
  const { caseId } = await params;
  const { session: selectedSessionId } = await searchParams;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: caseRecord, error: caseError },
    { data: args, error: argsError },
    { data: sessions, error: sessionsError }
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id,title,case_type,user_position,short_description,status")
      .eq("id", caseId)
      .single(),
    supabase.from("arguments").select("id").eq("case_id", caseId).limit(2),
    supabase
      .from("simulation_sessions")
      .select("id,status,started_at,completed_at,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (argsError) {
    throw new Error(argsError.message);
  }

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const selectedSessionFromList = selectedSessionId ? sessions?.find((item) => item.id === selectedSessionId) : null;
  const { data: selectedSession, error: selectedSessionError } =
    selectedSessionId && !selectedSessionFromList
      ? await supabase
          .from("simulation_sessions")
          .select("id,status,started_at,completed_at,created_at")
          .eq("case_id", caseId)
          .eq("id", selectedSessionId)
          .maybeSingle()
      : { data: selectedSessionFromList, error: null };

  if (selectedSessionError) {
    throw new Error(selectedSessionError.message);
  }

  const activeSession = selectedSession || sessions?.[0];
  const { data: logs, error: logsError } = activeSession
    ? await supabase
        .from("simulation_logs")
        .select("id,role,turn_index,speaker_label,content,legal_citations,model,created_at")
        .eq("session_id", activeSession.id)
        .eq("case_id", caseId)
        .order("turn_index", { ascending: true })
    : { data: [], error: null };

  if (logsError) {
    throw new Error(logsError.message);
  }

  const generateSimulation = generateSimulationSessionAction.bind(null, caseId);
  const canSimulate = Boolean(args && args.length >= 2);

  return (
    <>
      <CaseStepNav caseId={caseId} current="simulate" />
      <PageTitle
        eyebrow="Step 05"
        title="1심 법정 시뮬레이션"
        description="시뮬레이션이 시작되면 사용자는 관찰만 가능하며, 모든 발언은 로그로 저장됩니다."
        action={
          logs && logs.length > 0 ? (
            <Link className="button" href={`/cases/${caseId}/judgment?session=${activeSession?.id}`}>
              판사 판단문으로 이동 <ArrowRight size={18} />
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

        <form className="card form" action={generateSimulation}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Session</p>
              <h2>시뮬레이션 생성</h2>
            </div>
            <span className="tag gold">관찰 모드</span>
          </div>
          {!canSimulate ? (
            <p className="inline-alert">시뮬레이션 전에 strategy 화면에서 양측 주장을 먼저 생성해주세요.</p>
          ) : null}
          <p className="muted">
            기록관, 변호사, {caseRecord.case_type === "criminal" ? "검사" : "상대방"}, 판사 AI가 순서대로 발언하며,
            사용자는 중간에 개입하지 않습니다.
          </p>
          <button className="button" type="submit" disabled={!canSimulate}>
            <Play size={18} /> 1심 시뮬레이션 시작
          </button>
        </form>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Sessions</p>
              <h2>시뮬레이션 세션</h2>
            </div>
            <span className="tag">{sessions?.length || 0}개</span>
          </div>
          {sessions && sessions.length > 0 ? (
            <ul className="case-list">
              {sessions.map((session) => (
                <li className={activeSession?.id === session.id ? "clickable-list-item active" : "clickable-list-item"} key={session.id}>
                  <Link href={`/cases/${caseId}/simulate?session=${session.id}#logs`}>
                    <span>
                      <strong>{activeSession?.id === session.id ? "선택된 세션" : "시뮬레이션 세션"}</strong>
                      <small>{new Date(session.created_at).toLocaleString("ko-KR")}</small>
                    </span>
                    <span className={activeSession?.id === session.id ? "tag gold" : "tag"}>{session.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">아직 생성된 시뮬레이션 세션이 없습니다.</p>
          )}
        </article>

        <aside className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Guardrails</p>
              <h2>시뮬레이션 규칙</h2>
            </div>
          </div>
          <ul className="plain-list">
            <li>중간 개입 불가 <span className="tag">locked</span></li>
            <li>모든 발언 로그 저장 <span className="tag">logs</span></li>
            <li>공식 자료만 인용 <span className="tag gold">source</span></li>
            <li>최종 판결문은 다음 단계 <span className="tag rose">judgment</span></li>
          </ul>
        </aside>
      </section>

      <section className="card" id="logs">
        <div className="section-title">
          <div>
            <p className="eyebrow">Court Logs</p>
            <h2>발언 로그</h2>
          </div>
          <span className="tag">{activeSession ? `${logs?.length || 0}개` : "세션 없음"}</span>
        </div>
        {activeSession ? (
          <p className="inline-alert">
            선택 세션: {new Date(activeSession.created_at).toLocaleString("ko-KR")} · {activeSession.status}
          </p>
        ) : null}
        {logs && logs.length > 0 ? (
          <div className="timeline">
            {logs.map((log) => (
              <article key={log.id}>
                <h3>
                  {log.turn_index}. {log.speaker_label}
                </h3>
                <p className="muted">
                  {formatRole(log.role)} · 인용 {citationCount(log.legal_citations)}건 {log.model ? `· ${log.model}` : ""}
                </p>
                <p>{log.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">시뮬레이션을 생성하면 발언 로그가 여기에 표시됩니다.</p>
        )}
      </section>
    </>
  );
}
