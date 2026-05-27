import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Scale } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import { generateCaseArgumentsAction } from "@/app/cases/actions";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type StrategyPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{
    generated?: string;
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
      return Object.values(item).filter(Boolean).join(" · ");
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

export default async function StrategyPage({ params, searchParams }: StrategyPageProps) {
  const { caseId } = await params;
  const { generated } = await searchParams;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: caseRecord, error: caseError }, { data: args, error: argsError }, { data: chunks, error: chunksError }] =
    await Promise.all([
      supabase
        .from("cases")
        .select("id,title,case_type,user_position,short_description,status")
        .eq("id", caseId)
        .single(),
      supabase
        .from("arguments")
        .select("id,side,title,content,evidence_links,legal_links,expected_rebuttals,needed_materials,model,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false }),
      supabase
        .from("case_legal_links")
        .select("legal_source_id")
        .eq("case_id", caseId)
    ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (argsError) {
    throw new Error(argsError.message);
  }

  if (chunksError) {
    throw new Error(chunksError.message);
  }

  const sourceIds = chunks?.map((item) => item.legal_source_id) || [];
  const { count: chunkCount, error: chunkCountError } =
    sourceIds.length > 0
      ? await supabase
          .from("legal_source_chunks")
          .select("id", { count: "exact", head: true })
          .in("legal_source_id", sourceIds)
      : { count: 0, error: null };

  if (chunkCountError) {
    throw new Error(chunkCountError.message);
  }

  const generateArguments = generateCaseArgumentsAction.bind(null, caseId);
  const userArgument = args?.find((item) => item.side === "user");
  const opposingArgument = args?.find((item) => item.side === "opponent" || item.side === "prosecutor");

  return (
    <>
      <CaseStepNav caseId={caseId} current="strategy" />
      <PageTitle
        eyebrow="Step 04"
        title="양측 주장 준비"
        description="변호사 AI는 사용자 측 주장을, 상대방/검사 AI는 반대 논리와 예상 반박을 준비합니다."
        action={
          userArgument && opposingArgument ? (
            <Link className="button" href={`/cases/${caseId}/simulate`}>
              1심 시뮬레이션으로 이동 <ArrowRight size={18} />
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

        <form className="card form" action={generateArguments}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Argument AI</p>
              <h2>양측 주장 생성</h2>
            </div>
            <span className={chunkCount ? "tag" : "tag gold"}>청크 {chunkCount || 0}개</span>
          </div>
          {generated ? <p className="inline-alert">양측 주장을 새로 생성했습니다.</p> : null}
          {!chunkCount ? (
            <p className="inline-alert">
              공식 자료 청크가 없으면 법령/판례 근거가 약해집니다. research 화면에서 상세/임베딩을 먼저 실행하는 것을 권장합니다.
            </p>
          ) : null}
          <p className="muted">
            사건 정리, 답변된 추가 질문, 증거, 공식 자료 청크를 바탕으로 사용자 측과 반대 측 주장을 함께 생성합니다.
          </p>
          <button className="button" type="submit">
            <Scale size={18} /> 양측 주장 생성
          </button>
        </form>
      </section>

      <section className="grid two">
        {[userArgument, opposingArgument].map((argument, index) => (
          <article className="card" key={argument?.id || index}>
            <div className="section-title">
              <div>
                <p className="eyebrow">{index === 0 ? "User Side" : caseRecord.case_type === "criminal" ? "Prosecutor Side" : "Opponent Side"}</p>
                <h2>{argument?.title || (index === 0 ? "사용자 측 주장" : "반대 측 주장")}</h2>
              </div>
              <span className={index === 0 ? "tag" : "tag rose"}>{argument?.model || "대기"}</span>
            </div>
            {argument ? (
              <div className="stack">
                <p>{argument.content}</p>
                <JsonList title="증거 연결" items={argument.evidence_links} emptyText="연결된 증거가 없습니다." />
                <JsonList title="공식 자료 연결" items={argument.legal_links} emptyText="연결된 공식 자료가 없습니다." />
                <JsonList title="예상 반박" items={argument.expected_rebuttals} emptyText="예상 반박이 없습니다." />
                <JsonList title="보완 필요 자료" items={argument.needed_materials} emptyText="보완 필요 자료가 없습니다." />
              </div>
            ) : (
              <p className="muted">아직 생성된 주장이 없습니다.</p>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
