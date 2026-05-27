import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import { hydrateLegalSourceAction, searchLegalSourcesAction } from "@/app/cases/actions";
import { isLegalApiConfigured } from "@/lib/legal-api/national-law";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";

type ResearchPageProps = {
  params: Promise<{
    caseId: string;
  }>;
  searchParams: Promise<{
    query?: string;
    saved?: string;
    hydrated?: string;
  }>;
};

function formatLegalKind(kind: string) {
  const labels: Record<string, string> = {
    law: "법령",
    article: "조문",
    precedent: "판례",
    constitutional_case: "헌재",
    interpretation: "해석례",
    administrative_appeal: "행정심판"
  };

  return labels[kind] || kind;
}

export default async function ResearchPage({ params, searchParams }: ResearchPageProps) {
  const { caseId } = await params;
  const { query, saved, hydrated } = await searchParams;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: caseRecord, error: caseError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("cases")
      .select("id,title,case_type,user_position,short_description,status")
      .eq("id", caseId)
      .single(),
    supabase
      .from("case_legal_links")
      .select("id,legal_source_id,relevance_summary,matched_issues,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
  ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (linksError) {
    throw new Error(linksError.message);
  }

  const sourceIds = links?.map((item) => item.legal_source_id) || [];
  const { data: sources, error: sourcesError } =
    sourceIds.length > 0
      ? await supabase
          .from("legal_sources")
          .select("id,kind,title,case_number,court_name,decision_date,original_url,api_id,retrieved_at,body")
          .in("id", sourceIds)
      : { data: [], error: null };

  if (sourcesError) {
    throw new Error(sourcesError.message);
  }

  const sourceById = new Map((sources || []).map((item) => [item.id, item]));
  const { data: chunks, error: chunksError } =
    sourceIds.length > 0
      ? await supabase.from("legal_source_chunks").select("id,legal_source_id").in("legal_source_id", sourceIds)
      : { data: [], error: null };

  if (chunksError) {
    throw new Error(chunksError.message);
  }

  const chunkCounts = new Map<string, number>();

  for (const chunk of chunks || []) {
    chunkCounts.set(chunk.legal_source_id, (chunkCounts.get(chunk.legal_source_id) || 0) + 1);
  }

  const searchAction = searchLegalSourcesAction.bind(null, caseId);
  const linkedSources = (links || [])
    .map((link) => ({
      link,
      source: sourceById.get(link.legal_source_id)
    }))
    .filter((item) => item.source);

  return (
    <>
      <CaseStepNav caseId={caseId} current="research" />
      <PageTitle
        eyebrow="Step 03"
        title="법령/판례 검색"
        description="국가법령정보 공동활용 Open API에서 가져온 자료만 저장하고, AI 인용은 저장된 공식 자료로 제한합니다."
        action={
          linkedSources.length > 0 ? (
            <Link className="button" href={`/cases/${caseId}/strategy`}>
              주장 준비로 이동 <ArrowRight size={18} />
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

          <form className="card form" action={searchAction}>
            <div className="section-title">
              <div>
                <p className="eyebrow">National Law API</p>
                <h2>공식 자료 검색</h2>
              </div>
              <span className={isLegalApiConfigured() ? "tag" : "tag gold"}>
                {isLegalApiConfigured() ? "OC 설정됨" : "OC 필요"}
              </span>
            </div>
            {!isLegalApiConfigured() ? (
              <p className="inline-alert">LEGAL_API_OC가 설정되어야 국가법령정보 API 검색을 실행할 수 있습니다.</p>
            ) : null}
            {query ? (
              <p className="inline-alert">
                최근 검색어: {query}
                {saved !== undefined ? ` · 저장/연결 ${saved}건` : ""}
              </p>
            ) : null}
            {hydrated ? (
              <p className="inline-alert">
                상세 본문 처리 결과: {hydrated === "exists" ? "이미 청크가 저장되어 있습니다." : `${hydrated}개 청크 저장`}
              </p>
            ) : null}
            <p className="muted">
              검색어를 비워두면 사건 요약, 예상 쟁점, 등록된 증거를 기반으로 자동 검색어를 만듭니다.
            </p>
            <div className="field">
              <label htmlFor="query">검색어</label>
              <input id="query" name="query" placeholder="예: 대여금 반환, 채무불이행, 사기" />
            </div>
            <button className="button" type="submit" disabled={!isLegalApiConfigured()}>
              <Search size={18} /> 법령/판례 검색
            </button>
          </form>
        </div>

        <aside className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Policy</p>
              <h2>인용 제한</h2>
            </div>
          </div>
          <p className="muted">
            AI는 이 화면에서 저장된 공식 자료만 법령/판례 근거로 사용할 수 있습니다. AI 생성 판단문은 실제 판례와
            분리됩니다.
          </p>
        </aside>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Saved Sources</p>
            <h2>사건에 연결된 공식 자료</h2>
          </div>
          <span className="tag">{linkedSources.length}건</span>
        </div>
        {linkedSources.length === 0 ? (
          <p className="muted">아직 연결된 법령/판례가 없습니다. 공식 자료 검색을 실행해 주세요.</p>
        ) : (
          <ul className="case-list">
            {linkedSources.map(({ link, source }) => (
              <li key={link.id}>
                <span>
                  <strong>{source?.title}</strong>
                  <small>
                    {formatLegalKind(source?.kind || "")}
                    {source?.court_name ? ` · ${source.court_name}` : ""}
                    {source?.case_number ? ` · ${source.case_number}` : ""}
                    {source?.decision_date ? ` · ${source.decision_date}` : ""}
                  </small>
                  <small>
                    본문 {source?.body ? "저장됨" : "미저장"} · 청크 {chunkCounts.get(source?.id || "") || 0}개
                  </small>
                  {link.relevance_summary ? <small>{link.relevance_summary}</small> : null}
                </span>
                <span className="source-actions">
                  <form action={hydrateLegalSourceAction.bind(null, caseId, source?.id || "")}>
                    <button className="tag gold source-action-button" type="submit">
                      상세/임베딩
                    </button>
                  </form>
                  {source?.original_url ? (
                    <a className="tag" href={source.original_url} target="_blank" rel="noreferrer">
                      원문
                    </a>
                  ) : (
                    <span className="tag">API</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
