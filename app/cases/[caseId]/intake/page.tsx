import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import {
  addCaseInputAction,
  answerCaseQuestionAction,
  generateCaseIntakeAnalysisAction
} from "@/app/cases/actions";
import { isOpenAiConfigured } from "@/lib/ai/intake";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type IntakePageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

function asArray(value: Json) {
  return Array.isArray(value) ? value : [];
}

function stringifyValue(value: Json | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).filter(Boolean).join(", ");
  }

  return Object.values(value).map((item) => stringifyValue(item)).filter(Boolean).join(" · ");
}

function JsonList({ items, emptyText }: { items: Json; emptyText: string }) {
  const values = asArray(items);

  if (values.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <ul className="plain-list">
      {values.map((item, index) => (
        <li key={index}>
          <span>{stringifyValue(item)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function IntakePage({ params }: IntakePageProps) {
  const { caseId } = await params;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: caseRecord, error: caseError },
    { data: inputs, error: inputError },
    { data: latestSummary, error: summaryError },
    { data: questions, error: questionError }
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id,title,case_type,user_position,short_description,status,updated_at")
      .eq("id", caseId)
      .single(),
    supabase
      .from("case_inputs")
      .select("id,content,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("case_summaries")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("case_questions")
      .select("id,question,answer,reason,is_required,answered_at,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true })
  ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (inputError || summaryError || questionError) {
    throw new Error(inputError?.message || summaryError?.message || questionError?.message);
  }

  const addInput = addCaseInputAction.bind(null, caseId);
  const generateAnalysis = generateCaseIntakeAnalysisAction.bind(null, caseId);
  const canGenerate = isOpenAiConfigured() && Boolean(caseRecord.short_description || inputs?.length);

  return (
    <>
      <CaseStepNav caseId={caseId} current="intake" />
      <PageTitle
        eyebrow="Step 01"
        title="자유 입력 기반 사건 정리"
        description="사용자의 말로 입력한 사건 내용을 요약, 시간순 경위, 관련 인물, 유리한 사실, 불리한 사실, 부족한 정보로 구조화합니다."
        action={
          latestSummary ? (
            <Link className="button" href={`/cases/${caseId}/evidence`}>
              증거 정리로 이동 <ArrowRight size={18} />
            </Link>
          ) : null
        }
      />

      <section className="grid two">
        <div className="stack">
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

          <form className="card form" action={addInput}>
            <div className="section-title">
              <div>
                <p className="eyebrow">Input</p>
                <h2>자유 입력 추가</h2>
              </div>
            </div>
            <div className="field">
              <label htmlFor="case-text">사건 내용</label>
              <textarea
                id="case-text"
                name="content"
                placeholder="현재 문제, 원하는 결과, 가지고 있는 증거, 걱정되는 점을 자유롭게 적어주세요."
                required
              />
            </div>
            <button className="button" type="submit">
              사건 내용 저장
            </button>
          </form>

          <article className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">History</p>
                <h2>저장된 자유 입력</h2>
              </div>
              <span className="tag">{inputs?.length || 0}개</span>
            </div>
            {inputs && inputs.length > 0 ? (
              <div className="timeline">
                {inputs.map((item) => (
                  <article key={item.id}>
                    <h3>{new Date(item.created_at).toLocaleString("ko-KR")}</h3>
                    <p className="muted">{item.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">아직 저장된 자유 입력이 없습니다.</p>
            )}
          </article>
        </div>

        <div className="stack">
          <form className="card form" action={generateAnalysis}>
            <div className="section-title">
              <div>
                <p className="eyebrow">AI Intake</p>
                <h2>AI 사건 정리</h2>
              </div>
              <span className={isOpenAiConfigured() ? "tag" : "tag gold"}>
                {isOpenAiConfigured() ? "사용 가능" : "설정 필요"}
              </span>
            </div>
            {!isOpenAiConfigured() ? (
              <p className="inline-alert">OPENAI_API_KEY가 설정되어야 AI 사건 정리를 실행할 수 있습니다.</p>
            ) : null}
            {isOpenAiConfigured() && !canGenerate ? (
              <p className="inline-alert">사건 설명이나 자유 입력을 먼저 저장해주세요.</p>
            ) : null}
            <p className="muted">
              법령/판례 검색 전 단계이므로 AI는 구체 조문이나 판례를 만들지 않고, 사실관계와 부족한 정보만 정리합니다.
            </p>
            <button className="button" type="submit" disabled={!canGenerate}>
              <Sparkles size={18} /> AI로 사건 정리하기
            </button>
          </form>

          <article className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Summary</p>
                <h2>최신 정리 결과</h2>
              </div>
              {latestSummary?.model ? <span className="tag">{latestSummary.model}</span> : null}
            </div>
            {latestSummary ? (
              <div className="stack">
                <p>{latestSummary.summary}</p>
                <div>
                  <h3>시간순 경위</h3>
                  <JsonList items={latestSummary.timeline} emptyText="시간순 경위가 아직 없습니다." />
                </div>
                <div>
                  <h3>관련 인물</h3>
                  <JsonList items={latestSummary.people} emptyText="관련 인물이 아직 정리되지 않았습니다." />
                </div>
                <div>
                  <h3>핵심 사실</h3>
                  <JsonList items={latestSummary.core_facts} emptyText="핵심 사실이 아직 정리되지 않았습니다." />
                </div>
                <div>
                  <h3>예상 쟁점</h3>
                  <JsonList items={latestSummary.expected_issues} emptyText="예상 쟁점이 아직 없습니다." />
                </div>
                <div>
                  <h3>부족한 정보</h3>
                  <JsonList items={latestSummary.missing_information} emptyText="부족한 정보가 아직 없습니다." />
                </div>
              </div>
            ) : (
              <p className="muted">AI 사건 정리를 실행하면 요약, 경위, 쟁점, 부족한 정보가 여기에 표시됩니다.</p>
            )}
          </article>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Questions</p>
            <h2>추가 질문</h2>
          </div>
          <span className="tag">{questions?.length || 0}개</span>
        </div>
        {questions && questions.length > 0 ? (
          <div className="stack">
            {questions.map((item) => {
              const answerQuestion = answerCaseQuestionAction.bind(null, caseId, item.id);

              return (
                <article className="card compact" key={item.id}>
                  <div className="section-title">
                    <div>
                      <h3>{item.question}</h3>
                      {item.reason ? <p className="muted">{item.reason}</p> : null}
                    </div>
                    <span className={item.is_required ? "tag gold" : "tag"}>{item.is_required ? "필수" : "선택"}</span>
                  </div>
                  {item.answer ? (
                    <p>{item.answer}</p>
                  ) : (
                    <form className="form" action={answerQuestion}>
                      <div className="field">
                        <label htmlFor={`answer-${item.id}`}>답변</label>
                        <textarea id={`answer-${item.id}`} name="answer" placeholder="알고 있는 내용을 입력해주세요." required />
                      </div>
                      <button className="button secondary" type="submit">
                        답변 저장
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">AI 사건 정리를 실행하면 보완 질문이 여기에 생성됩니다.</p>
        )}
      </section>
    </>
  );
}
