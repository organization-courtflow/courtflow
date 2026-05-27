import "server-only";
import OpenAI from "openai";
import { legalCitationSystemPrompt } from "@/lib/ai/system-prompts";
import { safetyNotice } from "@/lib/ai/roles";
import type { CaseType } from "@/lib/supabase/database.types";

export type JudgmentAnalysis = {
  recognized_facts: string[];
  issue_judgments: Array<{
    issue: string;
    analysis: string;
    tentative_view: string;
  }>;
  evidence_assessment: Array<{
    evidence_name: string;
    assessment: string;
  }>;
  related_laws: Array<{
    source_title: string;
    chunk_id: string;
    relevance: string;
  }>;
  related_precedents: Array<{
    source_title: string;
    chunk_id: string;
    relevance: string;
  }>;
  conclusion: string;
  uncertainties: string[];
  consultation_checkpoints: string[];
};

export type GenerateJudgmentInput = {
  caseRecord: {
    title: string;
    case_type: CaseType;
    user_position: string | null;
    short_description: string | null;
  };
  session: unknown;
  logs: unknown[];
  arguments: unknown[];
};

const judgmentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "recognized_facts",
    "issue_judgments",
    "evidence_assessment",
    "related_laws",
    "related_precedents",
    "conclusion",
    "uncertainties",
    "consultation_checkpoints"
  ],
  properties: {
    recognized_facts: {
      type: "array",
      items: { type: "string" }
    },
    issue_judgments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "analysis", "tentative_view"],
        properties: {
          issue: { type: "string" },
          analysis: { type: "string" },
          tentative_view: { type: "string" }
        }
      }
    },
    evidence_assessment: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["evidence_name", "assessment"],
        properties: {
          evidence_name: { type: "string" },
          assessment: { type: "string" }
        }
      }
    },
    related_laws: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_title", "chunk_id", "relevance"],
        properties: {
          source_title: { type: "string" },
          chunk_id: { type: "string" },
          relevance: { type: "string" }
        }
      }
    },
    related_precedents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_title", "chunk_id", "relevance"],
        properties: {
          source_title: { type: "string" },
          chunk_id: { type: "string" },
          relevance: { type: "string" }
        }
      }
    },
    conclusion: { type: "string" },
    uncertainties: {
      type: "array",
      items: { type: "string" }
    },
    consultation_checkpoints: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

function getJudgmentModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function normalizeJudgment(value: JudgmentAnalysis): JudgmentAnalysis {
  return {
    recognized_facts: Array.isArray(value.recognized_facts) ? value.recognized_facts : [],
    issue_judgments: Array.isArray(value.issue_judgments) ? value.issue_judgments : [],
    evidence_assessment: Array.isArray(value.evidence_assessment) ? value.evidence_assessment : [],
    related_laws: Array.isArray(value.related_laws) ? value.related_laws : [],
    related_precedents: Array.isArray(value.related_precedents) ? value.related_precedents : [],
    conclusion: value.conclusion || "입력된 정보와 시뮬레이션 로그를 바탕으로 한 잠정 판단을 구성하기 어렵습니다.",
    uncertainties: Array.isArray(value.uncertainties) ? value.uncertainties : [],
    consultation_checkpoints: Array.isArray(value.consultation_checkpoints) ? value.consultation_checkpoints : []
  };
}

export async function generateSimulationJudgment(input: GenerateJudgmentInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = getJudgmentModel();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model,
    instructions: [
      legalCitationSystemPrompt,
      "당신은 CourtFlow AI의 판사 AI입니다.",
      "시뮬레이션 로그를 바탕으로 1심 판단문 형태의 상담 준비용 가상 판단을 작성하세요.",
      "실제 판결 예측이나 법률 자문으로 단정하지 마세요.",
      "관련 법령/판례는 입력된 logs.legal_citations 또는 arguments.legal_links 안의 chunk_id만 사용하세요.",
      "없는 법령, 없는 판례, 없는 사건번호, 없는 조문을 만들지 마세요.",
      "정보가 부족하거나 실제 상담에서 확인해야 할 부분은 uncertainties와 consultation_checkpoints에 명시하세요.",
      `사용자에게 보여줄 안전 문구는 다음과 같습니다: ${safetyNotice}`
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify(
          {
            case: input.caseRecord,
            simulation_session: input.session,
            simulation_logs: input.logs,
            arguments: input.arguments
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "courtflow_simulation_judgment",
        strict: true,
        schema: judgmentSchema
      }
    }
  });

  if (!response.output_text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    model,
    judgment: normalizeJudgment(JSON.parse(response.output_text) as JudgmentAnalysis)
  };
}
