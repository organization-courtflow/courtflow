import "server-only";
import OpenAI from "openai";
import type { CaseType } from "@/lib/supabase/database.types";
import { legalCitationSystemPrompt } from "@/lib/ai/system-prompts";

export type SimulationTurn = {
  role: "recorder" | "counsel" | "opponent" | "prosecutor" | "judge";
  speaker_label: string;
  content: string;
  legal_citations: Array<{
    source_title: string;
    chunk_id: string;
    usage_reason: string;
  }>;
};

export type SimulationScript = {
  turns: SimulationTurn[];
};

export type GenerateSimulationInput = {
  caseRecord: {
    title: string;
    case_type: CaseType;
    user_position: string | null;
    short_description: string | null;
  };
  latestSummary: unknown;
  evidences: unknown[];
  arguments: unknown[];
};

const simulationTurnSchema = {
  type: "object",
  additionalProperties: false,
  required: ["role", "speaker_label", "content", "legal_citations"],
  properties: {
    role: { type: "string", enum: ["recorder", "counsel", "opponent", "prosecutor", "judge"] },
    speaker_label: { type: "string" },
    content: { type: "string" },
    legal_citations: {
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
    }
  }
} as const;

const simulationScriptSchema = {
  type: "object",
  additionalProperties: false,
  required: ["turns"],
  properties: {
    turns: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: simulationTurnSchema
    }
  }
} as const;

function getSimulationModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function normalizeTurn(value: SimulationTurn, index: number, caseType: CaseType): SimulationTurn {
  const fallbackRoles: SimulationTurn["role"][] = [
    "recorder",
    "counsel",
    caseType === "criminal" ? "prosecutor" : "opponent",
    "counsel",
    caseType === "criminal" ? "prosecutor" : "opponent",
    "judge"
  ];
  const role = fallbackRoles[index] || value.role || "recorder";
  const labels: Record<SimulationTurn["role"], string> = {
    recorder: "기록관 AI",
    counsel: "변호사 AI",
    opponent: "상대방 AI",
    prosecutor: "검사 AI",
    judge: "판사 AI"
  };

  return {
    role,
    speaker_label: value.speaker_label || labels[role],
    content: value.content || "입력된 정보가 부족하여 발언을 구성하지 못했습니다.",
    legal_citations: Array.isArray(value.legal_citations) ? value.legal_citations : []
  };
}

export async function generateSimulationScript(input: GenerateSimulationInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const model = getSimulationModel();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const opposingRole = input.caseRecord.case_type === "criminal" ? "검사" : "상대방";
  const response = await client.responses.create({
    model,
    instructions: [
      legalCitationSystemPrompt,
      "당신은 CourtFlow AI의 1심 법정 시뮬레이션 기록 생성 AI입니다.",
      "사용자는 시뮬레이션 중 개입할 수 없고 관찰만 합니다.",
      "정확히 6개의 발언 로그를 생성하세요.",
      "순서는 기록관 AI, 변호사 AI, 반대 측 AI, 변호사 AI 반박, 반대 측 AI 재반박, 판사 AI 쟁점 정리입니다.",
      `반대 측 역할은 ${opposingRole}입니다.`,
      "판사 AI는 최종 판결문을 쓰지 말고, 쟁점 정리와 판단 전 검토까지만 작성하세요.",
      "법령/판례 인용은 입력된 arguments.legal_links 안의 chunk_id만 사용하세요. 없는 자료를 만들지 마세요.",
      "모든 발언은 실제 법률 자문이나 판결 예측이 아니라 상담 준비용 시뮬레이션으로 표현하세요."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify(
          {
            case: input.caseRecord,
            latest_summary: input.latestSummary,
            evidences: input.evidences,
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
        name: "courtflow_simulation_script",
        strict: true,
        schema: simulationScriptSchema
      }
    }
  });

  if (!response.output_text) {
    throw new Error("OpenAI response did not include output text.");
  }

  const parsed = JSON.parse(response.output_text) as SimulationScript;
  const turns = Array.isArray(parsed.turns) ? parsed.turns : [];

  return {
    model,
    turns: turns.slice(0, 6).map((turn, index) => normalizeTurn(turn, index, input.caseRecord.case_type))
  };
}
