import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { CaseStepNav } from "@/components/CaseStepNav";
import { PageTitle } from "@/components/PageTitle";
import { addEvidenceAction } from "@/app/cases/actions";
import { isOpenAiConfigured } from "@/lib/ai/intake";
import { formatCaseStatus, formatCaseType } from "@/lib/cases/labels";
import { createSupabaseUserClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type EvidencePageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

function asTextArray(value: Json) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function TextList({ items, emptyText }: { items: Json; emptyText: string }) {
  const values = asTextArray(items);

  if (values.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <ul className="plain-list">
      {values.map((item, index) => (
        <li key={`${item}-${index}`}>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function EvidencePage({ params }: EvidencePageProps) {
  const { caseId } = await params;
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: caseRecord, error: caseError }, { data: evidences, error: evidenceError }] = await Promise.all([
    supabase
      .from("cases")
      .select("id,title,case_type,user_position,short_description,status")
      .eq("id", caseId)
      .single(),
    supabase
      .from("evidences")
      .select(
        "id,name,evidence_type,content_text,summary,proves_fact,related_argument,strengths,weaknesses,needed_supplements,created_at"
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
  ]);

  if (caseError || !caseRecord) {
    notFound();
  }

  if (evidenceError) {
    throw new Error(evidenceError.message);
  }

  const addEvidence = addEvidenceAction.bind(null, caseId);
  const hasEvidence = Boolean(evidences?.length);

  return (
    <>
      <CaseStepNav caseId={caseId} current="evidence" />
      <PageTitle
        eyebrow="Step 02"
        title="증거 정리"
        description="계약서, 메시지, 송금 내역, 사진, 녹취록 등 증거를 주장과 연결하고 보완 필요 자료를 표시합니다."
        action={
          hasEvidence ? (
            <Link className="button" href={`/cases/${caseId}/research`}>
              법령/판례 검색으로 이동 <ArrowRight size={18} />
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

          <form className="card form" action={addEvidence}>
            <div className="section-title">
              <div>
                <p className="eyebrow">Evidence</p>
                <h2>증거 등록</h2>
              </div>
              <span className={isOpenAiConfigured() ? "tag" : "tag gold"}>
                {isOpenAiConfigured() ? "AI 정리" : "원문 저장"}
              </span>
            </div>
            {!isOpenAiConfigured() ? (
              <p className="inline-alert">OPENAI_API_KEY가 없어서 AI 정리 없이 증거 원문만 저장합니다.</p>
            ) : null}
            <div className="field">
              <label htmlFor="name">증거 이름</label>
              <input id="name" name="name" placeholder="예: 2026년 1월 3일 송금 내역" required />
            </div>
            <div className="field">
              <label htmlFor="evidence_type">증거 유형</label>
              <select id="evidence_type" name="evidence_type" defaultValue="message">
                <option value="message">메시지/대화</option>
                <option value="transfer">송금/거래 내역</option>
                <option value="contract">계약서/차용증</option>
                <option value="recording">녹취/진술</option>
                <option value="photo">사진/영상 설명</option>
                <option value="medical">진단서/영수증</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="content_text">증거 내용</label>
              <textarea
                id="content_text"
                name="content_text"
                placeholder="증거의 핵심 내용을 텍스트로 입력해주세요. 예: 카카오톡 대화 내용, 송금 날짜와 금액, 계약서 주요 문구"
                required
              />
            </div>
            <button className="button" type="submit">
              <FileText size={18} /> 증거 저장
            </button>
          </form>
        </div>

        <div className="stack">
          <article className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Review</p>
                <h2>등록된 증거</h2>
              </div>
              <span className="tag">{evidences?.length || 0}개</span>
            </div>
            {!hasEvidence ? <p className="muted">아직 등록된 증거가 없습니다.</p> : null}
            <div className="stack">
              {evidences?.map((item) => (
                <article className="card compact" key={item.id}>
                  <div className="section-title">
                    <div>
                      <p className="eyebrow">{item.evidence_type || "evidence"}</p>
                      <h2>{item.name}</h2>
                    </div>
                    <span className={item.needed_supplements && asTextArray(item.needed_supplements).length > 0 ? "tag gold" : "tag"}>
                      {item.summary ? "정리됨" : "원문"}
                    </span>
                  </div>
                  {item.summary ? <p>{item.summary}</p> : <p className="muted">{item.content_text}</p>}
                  <div className="grid two">
                    <div>
                      <h3>입증하려는 사실</h3>
                      <p className="muted">{item.proves_fact || "아직 정리되지 않았습니다."}</p>
                    </div>
                    <div>
                      <h3>관련 주장</h3>
                      <p className="muted">{item.related_argument || "아직 연결되지 않았습니다."}</p>
                    </div>
                  </div>
                  <div className="grid three">
                    <div>
                      <h3>강점</h3>
                      <TextList items={item.strengths} emptyText="강점이 아직 없습니다." />
                    </div>
                    <div>
                      <h3>약점</h3>
                      <TextList items={item.weaknesses} emptyText="약점이 아직 없습니다." />
                    </div>
                    <div>
                      <h3>보완 자료</h3>
                      <TextList items={item.needed_supplements} emptyText="보완 자료가 아직 없습니다." />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
