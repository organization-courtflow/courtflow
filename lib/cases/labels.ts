import type { CaseStatus, CaseType } from "@/lib/supabase/database.types";

export function formatCaseStatus(status: CaseStatus | string) {
  const labels: Record<string, string> = {
    draft: "작성 전",
    intake: "사건 입력",
    clarifying: "정보 보완",
    evidence_review: "증거 검토",
    strategy_review: "주장 검토",
    ready_for_simulation: "시뮬레이션 준비",
    simulating: "시뮬레이션 중",
    judged: "판단 완료",
    report_ready: "리포트 준비"
  };

  return labels[status] || status;
}

export function formatCaseType(caseType: CaseType | string) {
  const labels: Record<string, string> = {
    civil: "민사",
    criminal: "형사",
    family: "가정",
    juvenile: "소년"
  };

  return labels[caseType] || caseType;
}
