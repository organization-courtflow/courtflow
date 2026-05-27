import "server-only";
import { createSupabaseUserClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CaseStatus, CaseType } from "@/lib/supabase/database.types";

export type SidebarCase = {
  id: string;
  title: string;
  caseType: CaseType;
  status: CaseStatus;
  description: string;
};

export async function getSidebarCases(): Promise<SidebarCase[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = await createSupabaseUserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from("cases")
      .select("id,title,case_type,status,short_description,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      caseType: item.case_type,
      status: item.status,
      description: item.short_description || "사건 설명이 아직 없습니다."
    }));
  } catch {
    return [];
  }
}
