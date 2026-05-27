"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withApiCallLog } from "@/lib/api-call-logs";
import { createServerSupabaseClient, createSupabaseUserClient } from "@/lib/supabase/server";
import { createEmbeddings, getEmbeddingModel, splitLegalSourceBody, toPgVector } from "@/lib/ai/embeddings";
import { generateCaseArguments } from "@/lib/ai/arguments";
import { generateConsultationReport } from "@/lib/ai/report";
import { generateEvidenceAnalysis } from "@/lib/ai/evidence";
import { generateIntakeAnalysis } from "@/lib/ai/intake";
import { generateSimulationJudgment } from "@/lib/ai/judgment";
import { generateSimulationScript } from "@/lib/ai/simulation";
import { safetyNotice } from "@/lib/ai/roles";
import { fetchNationalLawSourceDetail, searchNationalLawSources } from "@/lib/legal-api/national-law";
import type { CaseType, Json } from "@/lib/supabase/database.types";

function readRequiredText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function jsonToSearchParts(value: Json | null | undefined): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => jsonToSearchParts(item));
  }

  return Object.values(value).flatMap((item) => jsonToSearchParts(item));
}

function buildLegalSearchQuery({
  manualQuery,
  title,
  latestSummary,
  evidences
}: {
  manualQuery: string | null;
  title: string;
  latestSummary: {
    summary: string | null;
    core_facts: Json;
    expected_issues: Json;
    missing_information: Json;
  } | null;
  evidences: Array<{
    name: string;
    proves_fact: string | null;
    related_argument: string | null;
  }>;
}) {
  if (manualQuery) {
    return manualQuery;
  }

  const candidates = [
    ...jsonToSearchParts(latestSummary?.expected_issues),
    ...jsonToSearchParts(latestSummary?.core_facts),
    ...evidences.flatMap((item) => [item.proves_fact, item.related_argument, item.name].filter(Boolean) as string[]),
    latestSummary?.summary,
    title
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return candidates.slice(0, 80) || title;
}

function buildArgumentSearchText({
  title,
  latestSummary,
  evidences
}: {
  title: string;
  latestSummary: {
    summary: string | null;
    core_facts: Json;
    expected_issues: Json;
  } | null;
  evidences: Array<{
    name: string;
    summary: string | null;
    proves_fact: string | null;
    related_argument: string | null;
  }>;
}) {
  return [
    title,
    latestSummary?.summary,
    ...jsonToSearchParts(latestSummary?.expected_issues),
    ...jsonToSearchParts(latestSummary?.core_facts),
    ...evidences.flatMap((item) => [item.name, item.summary, item.proves_fact, item.related_argument].filter(Boolean) as string[])
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 1200);
}

export async function createCaseAction(formData: FormData) {
  const title = readRequiredText(formData, "title");
  const caseType = (formData.get("type") || "civil") as CaseType;
  const userPosition = String(formData.get("position") || "").trim() || null;
  const shortDescription = String(formData.get("description") || "").trim() || null;

  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({
      user_id: user.id,
      title,
      case_type: caseType,
      user_position: userPosition,
      short_description: shortDescription,
      status: shortDescription ? "intake" : "draft"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/cases/${data.id}/intake`);
}

export async function deleteCaseAction(caseId: string, formData: FormData) {
  const currentPath = String(formData.get("currentPath") || "/");
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("cases").delete().eq("id", caseId).eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");

  if (currentPath.includes(`/cases/${caseId}/`)) {
    redirect("/");
  }

  redirect(currentPath);
}

export async function addCaseInputAction(caseId: string, formData: FormData) {
  const content = readRequiredText(formData, "content");
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: inputError } = await supabase.from("case_inputs").insert({
    case_id: caseId,
    user_id: user.id,
    content
  });

  if (inputError) {
    throw new Error(inputError.message);
  }

  const { error: statusError } = await supabase
    .from("cases")
    .update({ status: "clarifying" })
    .eq("id", caseId);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/intake`);
}

export async function generateCaseIntakeAnalysisAction(caseId: string) {
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title,case_type,user_position,short_description,goal_priorities")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const [{ data: inputs, error: inputsError }, { data: existingQuestions, error: questionsError }] = await Promise.all([
    userSupabase
      .from("case_inputs")
      .select("content,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    userSupabase
      .from("case_questions")
      .select("question,answer,reason")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true })
  ]);

  if (inputsError) {
    throw new Error(inputsError.message);
  }

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  if (!caseRecord.short_description && (!inputs || inputs.length === 0)) {
    throw new Error("사건 설명이나 자유 입력을 먼저 저장해주세요.");
  }

  const { model, analysis } = await withApiCallLog(
    {
      provider: "openai",
      operation: "intake_analysis",
      endpoint: "responses.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        case_type: caseRecord.case_type,
        input_count: inputs?.length || 0,
        existing_question_count: existingQuestions?.length || 0
      }
    },
    () =>
      generateIntakeAnalysis({
        caseRecord,
        inputs: inputs || [],
        existingQuestions: existingQuestions || []
      })
  );

  const { error: summaryError } = await serviceSupabase.from("case_summaries").insert({
    case_id: caseId,
    summary: analysis.summary,
    timeline: analysis.timeline,
    people: analysis.people,
    core_facts: analysis.core_facts,
    favorable_facts: analysis.favorable_facts,
    unfavorable_facts: analysis.unfavorable_facts,
    expected_issues: analysis.expected_issues,
    case_type_candidates: analysis.case_type_candidates,
    missing_information: analysis.missing_information,
    model
  });

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  const existingQuestionSet = new Set(
    (existingQuestions || []).map((item) => item.question.trim().replace(/\s+/g, " ").toLowerCase())
  );
  const newQuestions = analysis.questions
    .map((item) => ({
      case_id: caseId,
      question: item.question.trim(),
      reason: item.reason.trim(),
      is_required: item.is_required
    }))
    .filter((item) => {
      const key = item.question.replace(/\s+/g, " ").toLowerCase();

      if (!item.question || existingQuestionSet.has(key)) {
        return false;
      }

      existingQuestionSet.add(key);
      return true;
    });

  if (newQuestions.length > 0) {
    const { error: questionInsertError } = await serviceSupabase.from("case_questions").insert(newQuestions);

    if (questionInsertError) {
      throw new Error(questionInsertError.message);
    }
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "clarifying" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/intake`);
}

export async function answerCaseQuestionAction(caseId: string, questionId: string, formData: FormData) {
  const answer = readRequiredText(formData, "answer");
  const supabase = await createSupabaseUserClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("case_questions")
    .update({
      answer,
      answered_at: new Date().toISOString()
    })
    .eq("id", questionId)
    .eq("case_id", caseId);

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/cases/${caseId}/intake`);
}

export async function addEvidenceAction(caseId: string, formData: FormData) {
  const name = readRequiredText(formData, "name");
  const contentText = readRequiredText(formData, "content_text");
  const evidenceType = String(formData.get("evidence_type") || "").trim() || null;
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title,case_type,user_position,short_description")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const { data: latestSummary, error: summaryError } = await userSupabase
    .from("case_summaries")
    .select("summary,core_facts,expected_issues,missing_information")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  let analyzed = {
    summary: null as string | null,
    proves_fact: null as string | null,
    related_argument: null as string | null,
    strengths: [] as string[],
    weaknesses: [] as string[],
    needed_supplements: [] as string[]
  };

  if (process.env.OPENAI_API_KEY) {
    const { analysis } = await withApiCallLog(
      {
        provider: "openai",
        operation: "evidence_analysis",
        endpoint: "responses.create",
        userId: user.id,
        caseId,
        requestMetadata: {
          case_type: caseRecord.case_type,
          evidence_type: evidenceType,
          evidence_name: name
        }
      },
      () =>
        generateEvidenceAnalysis({
          caseRecord,
          latestSummary,
          evidence: {
            name,
            evidence_type: evidenceType,
            content_text: contentText
          }
        })
    );

    analyzed = analysis;
  }

  const { error: evidenceError } = await serviceSupabase.from("evidences").insert({
    case_id: caseId,
    user_id: user.id,
    name,
    evidence_type: evidenceType,
    content_text: contentText,
    summary: analyzed.summary,
    proves_fact: analyzed.proves_fact,
    related_argument: analyzed.related_argument,
    strengths: analyzed.strengths,
    weaknesses: analyzed.weaknesses,
    needed_supplements: analyzed.needed_supplements
  });

  if (evidenceError) {
    throw new Error(evidenceError.message);
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "evidence_review" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/evidence`);
}

export async function searchLegalSourcesAction(caseId: string, formData: FormData) {
  const manualQuery = String(formData.get("query") || "").trim() || null;
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const [{ data: latestSummary, error: summaryError }, { data: evidences, error: evidenceError }] = await Promise.all([
    userSupabase
      .from("case_summaries")
      .select("summary,core_facts,expected_issues,missing_information")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    userSupabase
      .from("evidences")
      .select("name,proves_fact,related_argument")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  if (evidenceError) {
    throw new Error(evidenceError.message);
  }

  const query = buildLegalSearchQuery({
    manualQuery,
    title: caseRecord.title,
    latestSummary,
    evidences: evidences || []
  });

  const [lawResults, precedentResults] = await Promise.all([
    searchNationalLawSources({ query, target: "law", display: 5, logContext: { userId: user.id, caseId } }),
    searchNationalLawSources({ query, target: "prec", display: 5, logContext: { userId: user.id, caseId } })
  ]);
  const results = [...lawResults, ...precedentResults];

  if (results.length === 0) {
    redirect(`/cases/${caseId}/research?query=${encodeURIComponent(query)}&saved=0`);
  }

  const apiIds = results.map((item) => item.apiId);
  const { data: existingSources, error: existingError } = await serviceSupabase
    .from("legal_sources")
    .select("id,api_id")
    .in("api_id", apiIds);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingByApiId = new Map((existingSources || []).map((item) => [item.api_id, item.id]));
  const newSources = results.filter((item) => !existingByApiId.has(item.apiId));

  if (newSources.length > 0) {
    const { data: insertedSources, error: insertError } = await serviceSupabase
      .from("legal_sources")
      .insert(
        newSources.map((item) => ({
          kind: item.kind,
          title: item.title,
          case_number: item.caseNumber,
          court_name: item.courtName,
          decision_date: item.decisionDate,
          original_url: item.originalUrl,
          api_id: item.apiId,
          body: item.body,
          metadata: item.metadata as Json
        }))
      )
      .select("id,api_id");

    if (insertError) {
      throw new Error(insertError.message);
    }

    for (const item of insertedSources || []) {
      existingByApiId.set(item.api_id, item.id);
    }
  }

  const links = results
    .map((item) => {
      const legalSourceId = existingByApiId.get(item.apiId);

      return legalSourceId
        ? {
            case_id: caseId,
            legal_source_id: legalSourceId,
            relevance_summary: `검색어 "${query}"로 연결된 공식 자료입니다.`,
            matched_issues: [query]
          }
        : null;
    })
    .filter(Boolean) as Array<{
    case_id: string;
    legal_source_id: string;
    relevance_summary: string;
    matched_issues: string[];
  }>;

  if (links.length > 0) {
    const { error: linkError } = await serviceSupabase
      .from("case_legal_links")
      .upsert(links, { onConflict: "case_id,legal_source_id", ignoreDuplicates: true });

    if (linkError) {
      throw new Error(linkError.message);
    }
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "strategy_review" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/research?query=${encodeURIComponent(query)}&saved=${links.length}`);
}

export async function hydrateLegalSourceAction(caseId: string, legalSourceId: string) {
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: link, error: linkError } = await userSupabase
    .from("case_legal_links")
    .select("id")
    .eq("case_id", caseId)
    .eq("legal_source_id", legalSourceId)
    .single();

  if (linkError || !link) {
    throw new Error(linkError?.message || "이 사건에 연결된 공식 자료가 아닙니다.");
  }

  const { data: source, error: sourceError } = await userSupabase
    .from("legal_sources")
    .select("id,kind,title,api_id,body,metadata")
    .eq("id", legalSourceId)
    .single();

  if (sourceError || !source) {
    throw new Error(sourceError?.message || "공식 자료를 찾을 수 없습니다.");
  }

  const detail = source.body
    ? {
        body: source.body,
        metadata: {}
      }
    : await fetchNationalLawSourceDetail({
        apiId: source.api_id,
        kind: source.kind,
        logContext: { userId: user.id, caseId }
      });

  if (!source.body) {
    const { error: updateError } = await serviceSupabase
      .from("legal_sources")
      .update({
        body: detail.body,
        metadata: {
          ...(source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata) ? source.metadata : {}),
          ...detail.metadata
        } as Json
      })
      .eq("id", legalSourceId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  const { data: existingChunks, error: chunksError } = await serviceSupabase
    .from("legal_source_chunks")
    .select("id")
    .eq("legal_source_id", legalSourceId)
    .limit(1);

  if (chunksError) {
    throw new Error(chunksError.message);
  }

  if (existingChunks && existingChunks.length > 0) {
    redirect(`/cases/${caseId}/research?hydrated=exists`);
  }

  const chunks = splitLegalSourceBody(detail.body);

  if (chunks.length === 0) {
    throw new Error("저장할 본문 청크가 없습니다.");
  }

  const embeddings = await withApiCallLog(
    {
      provider: "openai",
      operation: "legal_source_embeddings",
      endpoint: "embeddings.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        legal_source_id: legalSourceId,
        chunk_count: chunks.length,
        embedding_model: getEmbeddingModel()
      }
    },
    () => createEmbeddings(chunks.map((chunk) => chunk.content))
  );
  const embeddingModel = getEmbeddingModel();
  const { error: insertError } = await serviceSupabase.from("legal_source_chunks").insert(
    chunks.map((chunk, index) => ({
      legal_source_id: legalSourceId,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      token_count: chunk.token_count,
      embedding: toPgVector(embeddings[index]),
      metadata: {
        source_title: source.title,
        embedding_model: embeddingModel
      }
    }))
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  redirect(`/cases/${caseId}/research?hydrated=${chunks.length}`);
}

export async function generateCaseArgumentsAction(caseId: string) {
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title,case_type,user_position,short_description")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const [
    { data: latestSummary, error: summaryError },
    { data: questions, error: questionsError },
    { data: evidences, error: evidencesError }
  ] = await Promise.all([
    userSupabase
      .from("case_summaries")
      .select("summary,core_facts,favorable_facts,unfavorable_facts,expected_issues,missing_information")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    userSupabase
      .from("case_questions")
      .select("question,answer,reason,is_required")
      .eq("case_id", caseId)
      .not("answer", "is", null)
      .order("created_at", { ascending: true }),
    userSupabase
      .from("evidences")
      .select("id,name,evidence_type,summary,proves_fact,related_argument,strengths,weaknesses,needed_supplements")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
  ]);

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  if (evidencesError) {
    throw new Error(evidencesError.message);
  }

  const searchText = buildArgumentSearchText({
    title: caseRecord.title,
    latestSummary,
    evidences: evidences || []
  });
  const [queryEmbedding] = await withApiCallLog(
    {
      provider: "openai",
      operation: "argument_search_embedding",
      endpoint: "embeddings.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        text_length: searchText.length,
        embedding_model: getEmbeddingModel()
      }
    },
    () => createEmbeddings([searchText])
  );
  let matchedChunks: Array<{
    id: string;
    legal_source_id: string;
    content: string;
    similarity?: number;
  }> = [];

  const { data: rpcChunks, error: rpcError } = await serviceSupabase.rpc("match_case_legal_source_chunks", {
    target_case_id: caseId,
    query_embedding: toPgVector(queryEmbedding),
    match_count: 8
  });

  if (!rpcError && rpcChunks) {
    matchedChunks = rpcChunks;
  } else {
    const { data: links, error: linksError } = await serviceSupabase
      .from("case_legal_links")
      .select("legal_source_id")
      .eq("case_id", caseId)
      .limit(8);

    if (linksError) {
      throw new Error(linksError.message);
    }

    const sourceIds = links?.map((item) => item.legal_source_id) || [];

    if (sourceIds.length > 0) {
      const { data: fallbackChunks, error: fallbackError } = await serviceSupabase
        .from("legal_source_chunks")
        .select("id,legal_source_id,content")
        .in("legal_source_id", sourceIds)
        .limit(8);

      if (fallbackError) {
        throw new Error(fallbackError.message);
      }

      matchedChunks = fallbackChunks || [];
    }
  }

  const sourceIds = Array.from(new Set(matchedChunks.map((item) => item.legal_source_id)));
  const { data: sources, error: sourcesError } =
    sourceIds.length > 0
      ? await serviceSupabase
          .from("legal_sources")
          .select("id,kind,title,case_number,court_name,decision_date")
          .in("id", sourceIds)
      : { data: [], error: null };

  if (sourcesError) {
    throw new Error(sourcesError.message);
  }

  const sourceById = new Map((sources || []).map((item) => [item.id, item]));
  const legalChunks = matchedChunks.map((chunk) => {
    const source = sourceById.get(chunk.legal_source_id);

    return {
      id: chunk.id,
      legal_source_id: chunk.legal_source_id,
      source_title: source?.title || "공식 자료",
      source_kind: source?.kind || "official",
      case_number: source?.case_number || null,
      court_name: source?.court_name || null,
      decision_date: source?.decision_date || null,
      content: chunk.content.slice(0, 1800),
      similarity: chunk.similarity
    };
  });

  const { model, analysis } = await withApiCallLog(
    {
      provider: "openai",
      operation: "case_arguments",
      endpoint: "responses.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        case_type: caseRecord.case_type,
        evidence_count: evidences?.length || 0,
        legal_chunk_count: legalChunks.length
      }
    },
    () =>
      generateCaseArguments({
        caseRecord,
        latestSummary,
        questions: questions || [],
        evidences: evidences || [],
        legalChunks
      })
  );
  const opposingSide = caseRecord.case_type === "criminal" ? "prosecutor" : "opponent";

  const { error: deleteError } = await serviceSupabase
    .from("arguments")
    .delete()
    .eq("case_id", caseId)
    .in("side", ["user", opposingSide]);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: insertError } = await serviceSupabase.from("arguments").insert([
    {
      case_id: caseId,
      side: "user",
      title: analysis.user_argument.title,
      content: analysis.user_argument.content,
      evidence_links: analysis.user_argument.evidence_links,
      legal_links: analysis.user_argument.legal_links,
      expected_rebuttals: analysis.user_argument.expected_rebuttals,
      needed_materials: analysis.user_argument.needed_materials,
      model
    },
    {
      case_id: caseId,
      side: opposingSide,
      title: analysis.opposing_argument.title,
      content: analysis.opposing_argument.content,
      evidence_links: analysis.opposing_argument.evidence_links,
      legal_links: analysis.opposing_argument.legal_links,
      expected_rebuttals: analysis.opposing_argument.expected_rebuttals,
      needed_materials: analysis.opposing_argument.needed_materials,
      model
    }
  ]);

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "ready_for_simulation" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/strategy?generated=1`);
}

export async function generateSimulationSessionAction(caseId: string) {
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title,case_type,user_position,short_description")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const [
    { data: latestSummary, error: summaryError },
    { data: evidences, error: evidencesError },
    { data: args, error: argsError }
  ] = await Promise.all([
    userSupabase
      .from("case_summaries")
      .select("summary,core_facts,favorable_facts,unfavorable_facts,expected_issues,missing_information")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    userSupabase
      .from("evidences")
      .select("name,evidence_type,summary,proves_fact,related_argument,strengths,weaknesses,needed_supplements")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    userSupabase
      .from("arguments")
      .select("side,title,content,evidence_links,legal_links,expected_rebuttals,needed_materials")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
  ]);

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  if (evidencesError) {
    throw new Error(evidencesError.message);
  }

  if (argsError) {
    throw new Error(argsError.message);
  }

  if (!args || args.length < 2) {
    throw new Error("시뮬레이션 전에 양측 주장을 먼저 생성해주세요.");
  }

  const { data: session, error: sessionError } = await serviceSupabase
    .from("simulation_sessions")
    .insert({
      case_id: caseId,
      status: "running",
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message || "시뮬레이션 세션을 생성하지 못했습니다.");
  }

  const { model, turns } = await withApiCallLog(
    {
      provider: "openai",
      operation: "simulation_script",
      endpoint: "responses.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        case_type: caseRecord.case_type,
        evidence_count: evidences?.length || 0,
        argument_count: args.length,
        session_id: session.id
      }
    },
    () =>
      generateSimulationScript({
        caseRecord,
        latestSummary,
        evidences: evidences || [],
        arguments: args
      })
  );

  const { error: logsError } = await serviceSupabase.from("simulation_logs").insert(
    turns.map((turn, index) => ({
      session_id: session.id,
      case_id: caseId,
      role: turn.role,
      turn_index: index + 1,
      speaker_label: turn.speaker_label,
      content: turn.content,
      legal_citations: turn.legal_citations,
      model
    }))
  );

  if (logsError) {
    throw new Error(logsError.message);
  }

  const { error: sessionUpdateError } = await serviceSupabase
    .from("simulation_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", session.id);

  if (sessionUpdateError) {
    throw new Error(sessionUpdateError.message);
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "simulating" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/simulate?session=${session.id}`);
}

export async function generateSimulationJudgmentAction(caseId: string, sessionId?: string) {
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title,case_type,user_position,short_description")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const sessionQuery = userSupabase
    .from("simulation_sessions")
    .select("id,status,started_at,completed_at,created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: sessionData, error: sessionError } = sessionId
    ? await userSupabase
        .from("simulation_sessions")
        .select("id,status,started_at,completed_at,created_at")
        .eq("case_id", caseId)
        .eq("id", sessionId)
        .single()
    : await sessionQuery.maybeSingle();

  if (sessionError || !sessionData) {
    throw new Error(sessionError?.message || "판단문을 생성할 시뮬레이션 세션이 없습니다.");
  }

  const [{ data: logs, error: logsError }, { data: args, error: argsError }] = await Promise.all([
    userSupabase
      .from("simulation_logs")
      .select("role,turn_index,speaker_label,content,legal_citations")
      .eq("session_id", sessionData.id)
      .order("turn_index", { ascending: true }),
    userSupabase
      .from("arguments")
      .select("side,title,content,evidence_links,legal_links,expected_rebuttals,needed_materials")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
  ]);

  if (logsError) {
    throw new Error(logsError.message);
  }

  if (argsError) {
    throw new Error(argsError.message);
  }

  if (!logs || logs.length === 0) {
    throw new Error("시뮬레이션 로그가 없어 판단문을 생성할 수 없습니다.");
  }

  const { model, judgment } = await withApiCallLog(
    {
      provider: "openai",
      operation: "simulation_judgment",
      endpoint: "responses.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        case_type: caseRecord.case_type,
        session_id: sessionData.id,
        log_count: logs.length,
        argument_count: args?.length || 0
      }
    },
    () =>
      generateSimulationJudgment({
        caseRecord,
        session: sessionData,
        logs,
        arguments: args || []
      })
  );

  const { data: savedJudgment, error: judgmentError } = await serviceSupabase
    .from("simulation_judgments")
    .insert({
      session_id: sessionData.id,
      case_id: caseId,
      recognized_facts: judgment.recognized_facts,
      issue_judgments: judgment.issue_judgments,
      evidence_assessment: judgment.evidence_assessment,
      related_laws: judgment.related_laws,
      related_precedents: judgment.related_precedents,
      conclusion: judgment.conclusion,
      uncertainties: judgment.uncertainties,
      consultation_checkpoints: judgment.consultation_checkpoints,
      safety_notice: safetyNotice,
      model
    })
    .select("id")
    .single();

  if (judgmentError || !savedJudgment) {
    throw new Error(judgmentError?.message || "판단문 저장에 실패했습니다.");
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "judged" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/judgment?judgment=${savedJudgment.id}`);
}

export async function generateConsultationReportAction(caseId: string, judgmentId?: string) {
  const userSupabase = await createSupabaseUserClient();
  const serviceSupabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await userSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: caseRecord, error: caseError } = await userSupabase
    .from("cases")
    .select("id,title,case_type,user_position,short_description,goal_priorities")
    .eq("id", caseId)
    .single();

  if (caseError || !caseRecord) {
    throw new Error(caseError?.message || "Case not found.");
  }

  const judgmentQuery = userSupabase
    .from("simulation_judgments")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: judgment, error: judgmentError } = judgmentId
    ? await userSupabase.from("simulation_judgments").select("*").eq("case_id", caseId).eq("id", judgmentId).single()
    : await judgmentQuery.maybeSingle();

  if (judgmentError || !judgment) {
    throw new Error(judgmentError?.message || "상담 리포트를 생성할 판단문이 없습니다.");
  }

  const [
    { data: latestSummary, error: summaryError },
    { data: answeredQuestions, error: questionsError },
    { data: evidences, error: evidencesError },
    { data: args, error: argsError },
    { data: sourceLinks, error: linksError }
  ] = await Promise.all([
    userSupabase
      .from("case_summaries")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    userSupabase
      .from("case_questions")
      .select("question,answer,reason,is_required")
      .eq("case_id", caseId)
      .not("answer", "is", null)
      .order("created_at", { ascending: true }),
    userSupabase
      .from("evidences")
      .select("name,evidence_type,summary,proves_fact,related_argument,strengths,weaknesses,needed_supplements")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    userSupabase
      .from("arguments")
      .select("side,title,content,evidence_links,legal_links,expected_rebuttals,needed_materials")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    userSupabase
      .from("case_legal_links")
      .select("legal_source_id,relevance_summary,matched_issues")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  if (summaryError) {
    throw new Error(summaryError.message);
  }

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  if (evidencesError) {
    throw new Error(evidencesError.message);
  }

  if (argsError) {
    throw new Error(argsError.message);
  }

  if (linksError) {
    throw new Error(linksError.message);
  }

  const sourceIds = (sourceLinks || []).map((item) => item.legal_source_id);
  const { data: legalSources, error: sourcesError } =
    sourceIds.length > 0
      ? await userSupabase
          .from("legal_sources")
          .select("id,kind,title,case_number,court_name,decision_date")
          .in("id", sourceIds)
      : { data: [], error: null };

  if (sourcesError) {
    throw new Error(sourcesError.message);
  }

  const sourceById = new Map((legalSources || []).map((source) => [source.id, source]));
  const relatedSources = (sourceLinks || []).map((link) => ({
    ...link,
    source: sourceById.get(link.legal_source_id) || null
  }));

  const { report } = await withApiCallLog(
    {
      provider: "openai",
      operation: "consultation_report",
      endpoint: "responses.create",
      userId: user.id,
      caseId,
      requestMetadata: {
        case_type: caseRecord.case_type,
        judgment_id: judgment.id,
        evidence_count: evidences?.length || 0,
        argument_count: args?.length || 0,
        related_source_count: relatedSources.length
      }
    },
    () =>
      generateConsultationReport({
        caseRecord,
        latestSummary,
        answeredQuestions: answeredQuestions || [],
        evidences: evidences || [],
        arguments: args || [],
        relatedSources,
        judgment
      })
  );

  const { data: savedReport, error: reportError } = await serviceSupabase
    .from("consultation_reports")
    .insert({
      case_id: caseId,
      simulation_judgment_id: judgment.id,
      case_summary: report.case_summary,
      timeline: report.timeline,
      people: report.people,
      user_goals: report.user_goals,
      key_evidences: report.key_evidences,
      missing_evidences: report.missing_evidences,
      key_issues: report.key_issues,
      user_arguments: report.user_arguments,
      opponent_arguments: report.opponent_arguments,
      related_sources: report.related_sources,
      simulation_summary: report.simulation_summary,
      questions_for_lawyer: report.questions_for_lawyer,
      consultation_material_checklist: report.consultation_material_checklist
    })
    .select("id")
    .single();

  if (reportError || !savedReport) {
    throw new Error(reportError?.message || "상담 리포트 저장에 실패했습니다.");
  }

  const { error: statusError } = await serviceSupabase
    .from("cases")
    .update({ status: "report_ready" })
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (statusError) {
    throw new Error(statusError.message);
  }

  redirect(`/cases/${caseId}/report?report=${savedReport.id}`);
}
