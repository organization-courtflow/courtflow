import { NextResponse } from "next/server";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "Supabase environment variables are missing."
      },
      { status: 503 }
    );
  }

  const supabase = createServerSupabaseClient();
  const [cases, legalSources] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("legal_sources").select("id", { count: "exact", head: true })
  ]);

  const error = cases.error || legalSources.error;

  return NextResponse.json(
    {
      ok: !error,
      configured: true,
      caseCount: cases.count,
      legalSourceCount: legalSources.count,
      error: error?.message
    },
    { status: error ? 500 : 200 }
  );
}
