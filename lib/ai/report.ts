import "server-only";
import OpenAI from "openai";
import { safetyNotice } from "@/lib/ai/roles";
import type { CaseType } from "@/lib/supabase/database.types";

export type ConsultationReport = {
  case_summary: string;
  timeline: string[];
  people: string[];
  user_goals: string[];
  key_evidences: string[];
  missing_evidences: string[];
  key_issues: string[];
  user_arguments: string[];
  opponent_arguments: string[];
  related_sources: Array<{
    title: string;
    kind: string;
    relevance: string;
  }>;
  simulation_summary: string;
  questions_for_lawyer: string[];
  consultation_material_checklist: string[];
};

export type GenerateConsultationReportInput = {
  caseRecord: {
    title: string;
    case_type: CaseType;
    user_position: string | null;
    short_description: string | null;
    goal_priorities: unknown;
  };
  latestSummary: unknown;
  answeredQuestions: unknown[];
  evidences: unknown[];
  arguments: unknown[];
  relatedSources: unknown[];
  judgment: unknown;
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "case_summary",
    "timeline",
    "people",
    "user_goals",
    "key_evidences",
    "missing_evidences",
    "key_issues",
    "user_arguments",
    "opponent_arguments",
    "related_sources",
    "simulation_summary",
    "questions_for_lawyer",
    "consultation_material_checklist"
  ],
  properties: {
    case_summary: { type: "string" },
    timeline: {
      type: "array",
      items: { type: "string" }
    },
    people: {
      type: "array",
      items: { type: "string" }
    },
    user_goals: {
      type: "array",
      items: { type: "string" }
    },
    key_evidences: {
      type: "array",
      items: { type: "string" }
    },
    missing_evidences: {
      type: "array",
      items: { type: "string" }
    },
    key_issues: {
      type: "array",
      items: { type: "string" }
    },
    user_arguments: {
      type: "array",
      items: { type: "string" }
    },
    opponent_arguments: {
      type: "array",
      items: { type: "string" }
    },
    related_sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "relevance"],
        properties: {
          title: { type: "string" },
          kind: { type: "string" },
          relevance: { type: "string" }
        }
      }
    },
    simulation_summary: { type: "string" },
    questions_for_lawyer: {
      type: "array",
      items: { type: "string" }
    },
    consultation_material_checklist: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

function getReportModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function normalizeReport(value: ConsultationReport): ConsultationReport {
  return {
    case_summary: value.case_summary || "입력된 자료를 바탕으로 사건 요약을 생성하지 못했습니다.",
    timeline: Array.isArray(value.timeline) ? value.timeline : [],
    people: Array.isArray(value.people) ? value.people : [],
    user_goals: Array.isArray(value.user_goals) ? value.user_goals : [],
    key_evidences: Array.isArray(value.key_evidences) ? value.key_evidences : [],
    missing_evidences: Array.isArray(value.missing_evidences) ? value.missing_evidences : [],
    key_issues: Array.isArray(value.key_issues) ? value.key_issues : [],
    user_arguments: Array.isArray(value.user_arguments) ? value.user_arguments : [],
    opponent_arguments: Array.isArray(value.opponent_arguments) ? value.opponent_arguments : [],
    related_sources: Array.isArray(value.related_sources) ? value.related_sources : [],
    simulation_summary: value.simulation_summary || "시뮬레이션 판단 요약을 생성하지 못했습니다.",
    questions_for_lawyer: Array.isArray(value.questions_for_lawyer) ? value.questions_for_lawyer : [],
    consultation_material_checklist: Array.isArray(value.consultation_material_checklist)
      ? value.consultation_material_checklist
      : []
  };
}

export async function generateConsultationReport(input: GenerateConsultationReportInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = getReportModel();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model,
    instructions: [
      "당신은 CourtFlow AI의 상담 준비 리포트 작성 AI입니다.",
      "목표는 사용자가 변호사 상담 전에 사건 흐름, 증거, 주장, 확인할 질문을 빠르게 정리하도록 돕는 것입니다.",
      "한국어로 간결하고 상담자가 읽기 쉬운 문장으로 작성하세요.",
      "실제 법률 자문, 승소 가능성 단정, 실제 판결 예측처럼 표현하지 마세요.",
      "입력된 자료에 없는 법령, 판례, 사건번호, 조문을 만들지 마세요.",
      "부족한 정보는 missing_evidences 또는 questions_for_lawyer에 넣으세요.",
      "questions_for_lawyer는 실제 상담에서 물어볼 구체적인 질문으로 작성하세요.",
      "consultation_material_checklist는 사용자가 상담 전에 준비하거나 가져갈 자료 중심으로 작성하세요.",
      `리포트 하단 안전 문구로 참고할 내용: ${safetyNotice}`
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify(
          {
            case: input.caseRecord,
            latest_summary: input.latestSummary,
            answered_questions: input.answeredQuestions,
            evidences: input.evidences,
            arguments: input.arguments,
            related_sources: input.relatedSources,
            simulation_judgment: input.judgment
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "courtflow_consultation_report",
        strict: true,
        schema: reportSchema
      }
    }
  });

  if (!response.output_text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    model,
    report: normalizeReport(JSON.parse(response.output_text) as ConsultationReport)
  };
}
