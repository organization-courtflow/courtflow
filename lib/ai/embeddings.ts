import "server-only";
import OpenAI from "openai";

export type LegalSourceChunk = {
  chunk_index: number;
  content: string;
  token_count: number;
};

export function getEmbeddingModel() {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}

export function splitLegalSourceBody(body: string, maxChars = 1800, overlapChars = 180): LegalSourceChunk[] {
  const normalized = body.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: LegalSourceChunk[] = [];

  if (!normalized) {
    return chunks;
  }

  let start = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + maxChars, normalized.length);
    const paragraphBreak = normalized.lastIndexOf("\n\n", hardEnd);
    const sentenceBreak = normalized.lastIndexOf(". ", hardEnd);
    const softEnd = Math.max(paragraphBreak, sentenceBreak);
    const end = softEnd > start + Math.floor(maxChars * 0.55) ? softEnd + 1 : hardEnd;
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        chunk_index: chunks.length,
        content,
        token_count: Math.ceil(content.length / 3)
      });
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks.slice(0, 80);
}

export async function createEmbeddings(texts: string[]) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (texts.length === 0) {
    return [];
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: getEmbeddingModel(),
    input: texts
  });

  return response.data.map((item) => item.embedding);
}

export function toPgVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
