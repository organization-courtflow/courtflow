import "server-only";
import { createServerSupabaseClient, createSupabaseUserClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CaseStatus, CaseType } from "@/lib/supabase/database.types";

export type DashboardCase = {
  id: string;
  title: string;
  caseType: CaseType;
  status: CaseStatus;
  description: string;
  updatedAt: string;
};

export type SupabaseDashboardState = {
  configured: boolean;
  connected: boolean;
  cases: DashboardCase[];
  caseCount: number | null;
  legalSourceCount: number | null;
  userEmail: string | null;
  error?: string;
};

const fallbackCases: DashboardCase[] = [
  {
    id: "demo-clarifying",
    title: "대여금 반환 상담 준비",
    caseType: "civil",
    status: "clarifying",
    description: "추가 질문 4개, 증거 3개 등록 예정",
    updatedAt: new Date().toISOString()
  },
  {
    id: "demo-evidence",
    title: "계약 해지 손해배상 검토",
    caseType: "civil",
    status: "evidence_review",
    description: "증거 정리 단계, 판례 검색 대기",
    updatedAt: new Date().toISOString()
  },
  {
    id: "demo-draft",
    title: "형사 고소 전 사실관계 정리",
    caseType: "criminal",
    status: "draft",
    description: "사건 생성 후 기본 설명만 입력됨",
    updatedAt: new Date().toISOString()
  }
];

export async function getDashboardState(): Promise<SupabaseDashboardState> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      cases: fallbackCases,
      caseCount: null,
      legalSourceCount: null,
      userEmail: null,
      error: "서비스 연결 정보가 아직 설정되지 않았습니다."
    };
  }

  try {
    const userSupabase = await createSupabaseUserClient();
    const serviceSupabase = createServerSupabaseClient();
    const {
      data: { user }
    } = await userSupabase.auth.getUser();

    const casesQuery = user
      ? userSupabase
        .from("cases")
        .select("id,title,case_type,status,short_description,updated_at")
        .order("updated_at", { ascending: false })
        .limit(5)
      : null;

    const caseCountQuery = user
      ? userSupabase.from("cases").select("id", { count: "exact", head: true })
      : null;

    const [casesResult, caseCountResult, legalSourceCountResult] = await Promise.all([
      casesQuery,
      caseCountQuery,
      serviceSupabase.from("legal_sources").select("id", { count: "exact", head: true })
    ]);

    if (casesResult?.error) {
      throw casesResult.error;
    }

    const cases =
      casesResult?.data?.map((item) => ({
        id: item.id,
        title: item.title,
        caseType: item.case_type,
        status: item.status,
        description: item.short_description || "사건 설명이 아직 입력되지 않았습니다.",
        updatedAt: item.updated_at
      })) ?? [];

    return {
      configured: true,
      connected: true,
      cases: cases.length > 0 ? cases : fallbackCases,
      caseCount: caseCountResult?.count ?? 0,
      legalSourceCount: legalSourceCountResult.count,
      userEmail: user?.email ?? null,
      error: caseCountResult?.error?.message || legalSourceCountResult.error?.message
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      cases: fallbackCases,
      caseCount: null,
      legalSourceCount: null,
      userEmail: null,
      error: error instanceof Error ? error.message : "서비스 연결 상태를 확인할 수 없습니다."
    };
  }
}
