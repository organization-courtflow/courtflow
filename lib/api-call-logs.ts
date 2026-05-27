import "server-only";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type ApiCallLog = {
  userId?: string | null;
  caseId?: string | null;
  provider: string;
  operation: string;
  endpoint?: string | null;
  method?: string;
  requestMetadata?: Json;
  responseStatus?: number | null;
  success: boolean;
  durationMs?: number | null;
  errorMessage?: string | null;
};

type LoggedCallOptions = Omit<ApiCallLog, "success" | "durationMs" | "errorMessage" | "responseStatus"> & {
  responseStatus?: number | null;
};

export async function recordApiCallLog(log: ApiCallLog) {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const supabase = createServerSupabaseClient();
    await supabase.from("api_call_logs").insert({
      user_id: log.userId || null,
      case_id: log.caseId || null,
      provider: log.provider,
      operation: log.operation,
      endpoint: log.endpoint || null,
      method: log.method || "POST",
      request_metadata: log.requestMetadata || {},
      response_status: log.responseStatus ?? null,
      success: log.success,
      duration_ms: log.durationMs ?? null,
      error_message: log.errorMessage || null
    });
  } catch (error) {
    console.error("Failed to record API call log", error);
  }
}

export async function withApiCallLog<T>(options: LoggedCallOptions, callback: () => Promise<T>) {
  const startedAt = Date.now();

  try {
    const result = await callback();

    await recordApiCallLog({
      ...options,
      responseStatus: options.responseStatus ?? null,
      success: true,
      durationMs: Date.now() - startedAt
    });

    return result;
  } catch (error) {
    await recordApiCallLog({
      ...options,
      responseStatus: options.responseStatus ?? null,
      success: false,
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : "Unknown external API error"
    });

    throw error;
  }
}
