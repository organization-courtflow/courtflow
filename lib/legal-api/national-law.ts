import "server-only";
import { recordApiCallLog } from "@/lib/api-call-logs";
import type { LegalSourceKind } from "@/lib/legal-api/sources";

export type NationalLawTarget = "law" | "prec";

export type NationalLawSearchResult = {
  kind: LegalSourceKind;
  title: string;
  apiId: string;
  caseNumber: string | null;
  courtName: string | null;
  decisionDate: string | null;
  originalUrl: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
};

export type NationalLawDetailResult = {
  body: string;
  metadata: Record<string, unknown>;
};

type ApiLogContext = {
  userId?: string | null;
  caseId?: string | null;
};

const searchTargetToKind = {
  law: "law",
  prec: "precedent"
} as const satisfies Record<NationalLawTarget, LegalSourceKind>;

const searchTargetToListKey = {
  law: "law",
  prec: "prec"
} as const satisfies Record<NationalLawTarget, string>;

function getRequiredOc() {
  const oc = process.env.LEGAL_API_OC;

  if (!oc) {
    throw new Error("LEGAL_API_OC is missing.");
  }

  return oc;
}

export function isLegalApiConfigured() {
  return Boolean(process.env.LEGAL_API_OC);
}

function normalizeDetailUrl(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const decoded = value.replaceAll("&amp;", "&").trim();

  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }

  return `https://www.law.go.kr${decoded.startsWith("/") ? "" : "/"}${decoded}`;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.replaceAll(".", "").replaceAll("-", "").trim();

  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }

  return null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readNestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item) => Object.keys(item).length > 0);
  }

  const record = asRecord(value);
  return Object.keys(record).length > 0 ? [record] : [];
}

function readSearchContainer(payload: unknown, target: NationalLawTarget) {
  const root = asRecord(payload);
  const knownContainer = target === "law" ? asRecord(root.LawSearch) : asRecord(root.PrecSearch);

  if (Object.keys(knownContainer).length > 0) {
    return knownContainer;
  }

  return root;
}

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }

  const record = asRecord(value);
  return Object.values(record).flatMap(collectText);
}

function stripHtml(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}

function appendSection(parts: string[], title: string, value: unknown) {
  const texts = collectText(value)
    .map(stripHtml)
    .filter(Boolean) as string[];

  if (texts.length > 0) {
    parts.push(`[${title}]\n${texts.join("\n")}`);
  }
}

function extractLawBody(payload: unknown) {
  const law = asRecord(asRecord(payload).법령);
  const basicInfo = asRecord(law.기본정보);
  const title = readString(basicInfo, ["법령명_한글", "법령명약칭", "법령명_한자"]);
  const parts: string[] = [];

  if (title) {
    parts.push(`[법령명]\n${title}`);
  }

  const articles = asArray(readNestedRecord(asRecord(law.조문), ["조문단위"]).조문단위 || readNestedRecord(asRecord(law.조문), ["조문단위"]));

  if (articles.length > 0) {
    const articleTexts = articles
      .map((article) => {
        const articleNo = readString(article, ["조문번호", "조문가지번호"]);
        const articleTitle = readString(article, ["조문제목"]);
        const articleContent = collectText(article)
          .map(stripHtml)
          .filter(Boolean)
          .join(" ");

        return [`제${articleNo || "?"}조${articleTitle ? `(${articleTitle})` : ""}`, articleContent].filter(Boolean).join("\n");
      })
      .filter(Boolean);

    parts.push(`[조문]\n${articleTexts.join("\n\n")}`);
  } else {
    appendSection(parts, "조문", law.조문);
  }

  appendSection(parts, "부칙", law.부칙);
  appendSection(parts, "제개정이유", law.제개정이유);

  return parts.join("\n\n").trim();
}

function extractPrecedentBody(payload: unknown) {
  const precedent = asRecord(asRecord(payload).PrecService);
  const parts: string[] = [];

  for (const [title, key] of [
    ["사건명", "사건명"],
    ["사건번호", "사건번호"],
    ["법원", "법원명"],
    ["선고일자", "선고일자"],
    ["판시사항", "판시사항"],
    ["판결요지", "판결요지"],
    ["참조조문", "참조조문"],
    ["참조판례", "참조판례"],
    ["판례내용", "판례내용"]
  ] as const) {
    const text = stripHtml(precedent[key]);

    if (text) {
      parts.push(`[${title}]\n${text}`);
    }
  }

  return parts.join("\n\n").trim();
}

function mapSearchRecord(target: NationalLawTarget, record: Record<string, unknown>): NationalLawSearchResult {
  const kind = searchTargetToKind[target];
  const rawId =
    readString(record, ["법령ID", "법령일련번호", "판례일련번호", "ID", "MST"]) ||
    `${target}:${readString(record, ["법령명한글", "사건명", "title"]) || "unknown"}`;

  if (target === "law") {
    const title = readString(record, ["법령명한글", "법령약칭명", "법령명"]) || "제목 없는 법령";
    const promulgationDate = readString(record, ["공포일자"]);
    const enforcementDate = readString(record, ["시행일자"]);

    return {
      kind,
      title,
      apiId: `${target}:${rawId}`,
      caseNumber: null,
      courtName: null,
      decisionDate: null,
      originalUrl: normalizeDetailUrl(readString(record, ["법령상세링크", "상세링크"])),
      body: null,
      metadata: {
        target,
        raw: record,
        promulgation_date: normalizeDate(promulgationDate),
        enforcement_date: normalizeDate(enforcementDate),
        ministry: readString(record, ["소관부처명"]),
        revision_type: readString(record, ["제개정구분명"])
      }
    };
  }

  return {
    kind,
    title: readString(record, ["사건명", "판례명", "title"]) || "제목 없는 판례",
    apiId: `${target}:${rawId}`,
    caseNumber: readString(record, ["사건번호"]),
    courtName: readString(record, ["법원명"]),
    decisionDate: normalizeDate(readString(record, ["선고일자", "선고일"])),
    originalUrl: normalizeDetailUrl(readString(record, ["판례상세링크", "상세링크"])),
    body: null,
    metadata: {
      target,
      raw: record,
      case_type: readString(record, ["사건종류명"]),
      judgment_type: readString(record, ["판결유형", "선고"])
    }
  };
}

export async function searchNationalLawSources({
  query,
  target,
  display = 5,
  logContext
}: {
  query: string;
  target: NationalLawTarget;
  display?: number;
  logContext?: ApiLogContext;
}) {
  const url = new URL("https://www.law.go.kr/DRF/lawSearch.do");
  url.searchParams.set("OC", getRequiredOc());
  url.searchParams.set("target", target);
  url.searchParams.set("type", "JSON");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));

  const startedAt = Date.now();
  let responseStatus: number | null = null;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    responseStatus = response.status;

    if (!response.ok) {
      throw new Error(`국가법령정보 API 요청 실패: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const root = asRecord(payload);

    if (typeof root.result === "string" && root.result !== "success") {
      throw new Error(typeof root.msg === "string" ? root.msg : root.result);
    }

    const container = readSearchContainer(payload, target);
    const listKey = searchTargetToListKey[target];
    const records = asArray(container[listKey]);

    await recordApiCallLog({
      provider: "national-law",
      operation: "search",
      endpoint: "https://www.law.go.kr/DRF/lawSearch.do",
      method: "GET",
      userId: logContext?.userId,
      caseId: logContext?.caseId,
      requestMetadata: { target, query, display },
      responseStatus,
      success: true,
      durationMs: Date.now() - startedAt
    });

    return records.map((record) => mapSearchRecord(target, record));
  } catch (error) {
    await recordApiCallLog({
      provider: "national-law",
      operation: "search",
      endpoint: "https://www.law.go.kr/DRF/lawSearch.do",
      method: "GET",
      userId: logContext?.userId,
      caseId: logContext?.caseId,
      requestMetadata: { target, query, display },
      responseStatus,
      success: false,
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : "Unknown National Law API error"
    });

    throw error;
  }
}

export async function fetchNationalLawSourceDetail({
  apiId,
  kind,
  logContext
}: {
  apiId: string | null;
  kind: string;
  logContext?: ApiLogContext;
}): Promise<NationalLawDetailResult> {
  if (!apiId) {
    throw new Error("상세 조회에 필요한 API ID가 없습니다.");
  }

  const [target, rawId] = apiId.split(":");

  if ((target !== "law" && target !== "prec") || !rawId) {
    throw new Error(`지원하지 않는 공식 자료 식별자입니다: ${apiId}`);
  }

  const url = new URL("https://www.law.go.kr/DRF/lawService.do");
  url.searchParams.set("OC", getRequiredOc());
  url.searchParams.set("target", target);
  url.searchParams.set("type", "JSON");

  if (target === "law") {
    url.searchParams.set("MST", rawId);
  } else {
    url.searchParams.set("ID", rawId);
  }

  const startedAt = Date.now();
  let responseStatus: number | null = null;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    responseStatus = response.status;

    if (!response.ok) {
      throw new Error(`국가법령정보 상세 API 요청 실패: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const root = asRecord(payload);

    if (typeof root.result === "string" && root.result !== "success") {
      throw new Error(typeof root.msg === "string" ? root.msg : root.result);
    }

    const body = (target === "law" ? extractLawBody(payload) : extractPrecedentBody(payload)) || collectText(payload).join("\n");
    const trimmedBody = body.slice(0, 60000);

    if (!trimmedBody) {
      throw new Error("상세 본문을 추출하지 못했습니다.");
    }

    await recordApiCallLog({
      provider: "national-law",
      operation: "detail",
      endpoint: "https://www.law.go.kr/DRF/lawService.do",
      method: "GET",
      userId: logContext?.userId,
      caseId: logContext?.caseId,
      requestMetadata: { target, apiId, kind },
      responseStatus,
      success: true,
      durationMs: Date.now() - startedAt
    });

    return {
      body: trimmedBody,
      metadata: {
        detail_target: target,
        detail_kind: kind,
        detail_retrieved_at: new Date().toISOString(),
        detail_raw: payload
      }
    };
  } catch (error) {
    await recordApiCallLog({
      provider: "national-law",
      operation: "detail",
      endpoint: "https://www.law.go.kr/DRF/lawService.do",
      method: "GET",
      userId: logContext?.userId,
      caseId: logContext?.caseId,
      requestMetadata: { target, apiId, kind },
      responseStatus,
      success: false,
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : "Unknown National Law API error"
    });

    throw error;
  }
}
