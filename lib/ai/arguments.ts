import "server-only";
import OpenAI from "openai";
import type { CaseType } from "@/lib/supabase/database.types";
import { legalCitationSystemPrompt } from "@/lib/ai/system-prompts";

export type ArgumentDraft = {
  title: string;
  content: string;
  evidence_links: Array<{
    evidence_name: string;
    usage_reason: string;
  }>;
  legal_links: Array<{
    source_title: string;
    chunk_id: string;
    usage_reason: string;
  }>;
  expected_rebuttals: string[];
  needed_materials: string[];
};

export type ArgumentAnalysis = {
  user_argument: ArgumentDraft;
  opposing_argument: ArgumentDraft;
};

export type GenerateArgumentsInput = {
  caseRecord: {
    title: string;
    case_type: CaseType;
    user_position: string | null;
    short_description: string | null;
  };
  latestSummary: unknown;
  questions: unknown[];
  evidences: unknown[];
  legalChunks: Array<{
    id: string;
    legal_source_id: string;
    source_title: string;
    source_kind: string;
    case_number: string | null;
    court_name: string | null;
    decision_date: string | null;
    content: string;
    similarity?: number;
  }>;
};

const argumentDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content", "evidence_links", "legal_links", "expected_rebuttals", "needed_materials"],
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    evidence_links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["evidence_name", "usage_reason"],
        properties: {
          evidence_name: { type: "string" },
          usage_reason: { type: "string" }
        }
      }
    },
    legal_links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_title", "chunk_id", "usage_reason"],
        properties: {
          source_title: { type: "string" },
          chunk_id: { type: "string" },
          usage_reason: { type: "string" }
        }
      }
    },
    expected_rebuttals: {
      type: "array",
      items: { type: "string" }
    },
    needed_materials: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

const argumentAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_argument", "opposing_argument"],
  properties: {
    user_argument: argumentDraftSchema,
    opposing_argument: argumentDraftSchema
  }
} as const;

function getArgumentModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function normalizeDraft(value: ArgumentDraft, fallbackTitle: string): ArgumentDraft {
  return {
    title: value.title || fallbackTitle,
    content: value.content || "입력된 정보가 부족하여 주장을 구성하기 어렵습니다.",
    evidence_links: Array.isArray(value.evidence_links) ? value.evidence_links : [],
    legal_links: Array.isArray(value.legal_links) ? value.legal_links : [],
    expected_rebuttals: Array.isArray(value.expected_rebuttals) ? value.expected_rebuttals : [],
    needed_materials: Array.isArray(value.needed_materials) ? value.needed_materials : []
  };
}

export async function generateCaseArguments(input: GenerateArgumentsInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = getArgumentModel();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const opposingRole = input.caseRecord.case_type === "criminal" ? "검사" : "상대방";
  const response = await client.responses.create({
    model,
    instructions: [
      legalCitationSystemPrompt,
      "당신은 CourtFlow AI의 양측 주장 준비 AI입니다.",
      "사용자 측 주장과 반대 측 주장을 모두 한국어로 작성하세요.",
      `반대 측 역할은 ${opposingRole}입니다.`,
      "법령/판례는 입력으로 제공된 legalChunks 안의 자료만 사용하세요.",
      "legal_links에는 반드시 제공된 chunk_id만 적으세요. 없는 사건번호, 조문, 판례를 만들지 마세요.",
      "실제 법률 자문이나 승패 예측이 아니라 상담 준비용 주장 초안으로 표현하세요.",
      "증거의 진정성, 증거능력, 법률 효과는 단정하지 말고 확인 필요 사항을 needed_materials에 넣으세요."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify(
          {
            case: input.caseRecord,
            latest_summary: input.latestSummary,
            answered_questions: input.questions,
            evidences: input.evidences,
            legal_chunks: input.legalChunks
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "courtflow_case_arguments",
        strict: true,
        schema: argumentAnalysisSchema
      }
    }
  });

  if (!response.output_text) {
    throw new Error("OpenAI response did not include output text.");
  }

  const parsed = JSON.parse(response.output_text) as ArgumentAnalysis;

  return {
    model,
    analysis: {
      user_argument: normalizeDraft(parsed.user_argument, "사용자 측 주장"),
      opposing_argument: normalizeDraft(parsed.opposing_argument, `${opposingRole} 측 주장`)
    }
  };
}
