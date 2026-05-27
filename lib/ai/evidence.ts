import "server-only";
import OpenAI from "openai";
import { legalCitationSystemPrompt } from "@/lib/ai/system-prompts";

export type EvidenceAnalysis = {
  summary: string;
  proves_fact: string;
  related_argument: string;
  strengths: string[];
  weaknesses: string[];
  needed_supplements: string[];
};

export type GenerateEvidenceAnalysisInput = {
  caseRecord: {
    title: string;
    case_type: string;
    user_position: string | null;
    short_description: string | null;
  };
  latestSummary: {
    summary: string | null;
    core_facts: unknown;
    expected_issues: unknown;
    missing_information: unknown;
  } | null;
  evidence: {
    name: string;
    evidence_type: string | null;
    content_text: string;
  };
};

const evidenceAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "proves_fact", "related_argument", "strengths", "weaknesses", "needed_supplements"],
  properties: {
    summary: { type: "string" },
    proves_fact: { type: "string" },
    related_argument: { type: "string" },
    strengths: {
      type: "array",
      items: { type: "string" }
    },
    weaknesses: {
      type: "array",
      items: { type: "string" }
    },
    needed_supplements: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

function asArray(value: string[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function normalizeEvidenceAnalysis(value: EvidenceAnalysis): EvidenceAnalysis {
  return {
    summary: value.summary || "증거 내용을 요약할 수 있는 정보가 부족합니다.",
    proves_fact: value.proves_fact || "이 증거가 입증하려는 사실을 추가 확인해야 합니다.",
    related_argument: value.related_argument || "아직 특정 주장과 명확히 연결되지 않았습니다.",
    strengths: asArray(value.strengths),
    weaknesses: asArray(value.weaknesses),
    needed_supplements: asArray(value.needed_supplements)
  };
}

export function getEvidenceModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export async function generateEvidenceAnalysis(input: GenerateEvidenceAnalysisInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = getEvidenceModel();
  const response = await client.responses.create({
    model,
    instructions: [
      legalCitationSystemPrompt,
      "당신은 CourtFlow AI의 증거 정리 AI입니다.",
      "사용자가 입력한 증거를 상담 준비 관점에서 한국어로 정리하세요.",
      "이번 단계에서는 법령/판례 검색을 하지 않았으므로 구체 조문, 사건번호, 판례명, 선고일을 만들지 마세요.",
      "이 증거가 어떤 사실을 입증하는지, 어떤 주장과 연결되는지, 강점과 약점, 보완 자료를 구분하세요.",
      "증거의 진정성이나 법적 증거능력을 단정하지 말고 추가 확인이 필요한 부분을 명확히 적으세요."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify(
          {
            case: input.caseRecord,
            latest_summary: input.latestSummary,
            evidence: input.evidence
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "courtflow_evidence_analysis",
        strict: true,
        schema: evidenceAnalysisSchema
      }
    }
  });

  const text = response.output_text;

  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    model,
    analysis: normalizeEvidenceAnalysis(JSON.parse(text) as EvidenceAnalysis)
  };
}
