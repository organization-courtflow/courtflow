import "server-only";
import OpenAI from "openai";
import type { CaseType } from "@/lib/supabase/database.types";
import { legalCitationSystemPrompt } from "@/lib/ai/system-prompts";

export type IntakeQuestion = {
  question: string;
  reason: string;
  is_required: boolean;
};

export type IntakeAnalysis = {
  summary: string;
  timeline: Array<{
    date: string;
    event: string;
    certainty: string;
  }>;
  people: Array<{
    name: string;
    role: string;
    description: string;
  }>;
  core_facts: string[];
  favorable_facts: string[];
  unfavorable_facts: string[];
  expected_issues: string[];
  case_type_candidates: Array<{
    type: CaseType;
    confidence: string;
    reason: string;
  }>;
  missing_information: string[];
  questions: IntakeQuestion[];
};

export type GenerateIntakeAnalysisInput = {
  caseRecord: {
    title: string;
    case_type: CaseType;
    user_position: string | null;
    short_description: string | null;
    goal_priorities?: unknown;
  };
  inputs: Array<{
    content: string;
    created_at: string;
  }>;
  existingQuestions: Array<{
    question: string;
    answer: string | null;
    reason: string | null;
  }>;
};

const intakeAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "timeline",
    "people",
    "core_facts",
    "favorable_facts",
    "unfavorable_facts",
    "expected_issues",
    "case_type_candidates",
    "missing_information",
    "questions"
  ],
  properties: {
    summary: { type: "string" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event", "certainty"],
        properties: {
          date: { type: "string" },
          event: { type: "string" },
          certainty: { type: "string" }
        }
      }
    },
    people: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "description"],
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          description: { type: "string" }
        }
      }
    },
    core_facts: {
      type: "array",
      items: { type: "string" }
    },
    favorable_facts: {
      type: "array",
      items: { type: "string" }
    },
    unfavorable_facts: {
      type: "array",
      items: { type: "string" }
    },
    expected_issues: {
      type: "array",
      items: { type: "string" }
    },
    case_type_candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "confidence", "reason"],
        properties: {
          type: { type: "string", enum: ["civil", "criminal", "family", "juvenile"] },
          confidence: { type: "string" },
          reason: { type: "string" }
        }
      }
    },
    missing_information: {
      type: "array",
      items: { type: "string" }
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "reason", "is_required"],
        properties: {
          question: { type: "string" },
          reason: { type: "string" },
          is_required: { type: "boolean" }
        }
      }
    }
  }
} as const;

function asArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function normalizeAnalysis(value: IntakeAnalysis): IntakeAnalysis {
  return {
    summary: value.summary || "입력된 정보를 바탕으로 사건 정리가 필요합니다.",
    timeline: asArray(value.timeline),
    people: asArray(value.people),
    core_facts: asArray(value.core_facts),
    favorable_facts: asArray(value.favorable_facts),
    unfavorable_facts: asArray(value.unfavorable_facts),
    expected_issues: asArray(value.expected_issues),
    case_type_candidates: asArray(value.case_type_candidates),
    missing_information: asArray(value.missing_information),
    questions: asArray(value.questions).filter((item) => item.question.trim().length > 0)
  };
}

export function getIntakeModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateIntakeAnalysis(input: GenerateIntakeAnalysisInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = getIntakeModel();
  const response = await client.responses.create({
    model,
    instructions: [
      legalCitationSystemPrompt,
      "당신은 CourtFlow AI의 사건 정리 AI입니다.",
      "사용자의 자유 입력을 한국어로 구조화하세요.",
      "이번 단계에서는 법령/판례 검색을 하지 않았으므로 구체 조문, 사건번호, 판례명, 선고일을 만들지 마세요.",
      "실제 법률 자문이나 판결 예측처럼 단정하지 말고 상담 준비를 위한 사실관계 정리로 표현하세요.",
      "정보가 부족한 부분은 missing_information과 questions에 담으세요.",
      "질문은 사용자가 바로 답할 수 있는 짧고 구체적인 문장으로 작성하세요."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify(
          {
            case: input.caseRecord,
            user_inputs: input.inputs,
            existing_questions: input.existingQuestions
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "courtflow_intake_analysis",
        strict: true,
        schema: intakeAnalysisSchema
      }
    }
  });

  const text = response.output_text;

  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    model,
    analysis: normalizeAnalysis(JSON.parse(text) as IntakeAnalysis)
  };
}
