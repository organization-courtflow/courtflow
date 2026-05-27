"use server";

import { redirect } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase/server";

function readAuthField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

export async function signInAction(formData: FormData) {
  const email = readAuthField(formData, "email");
  const password = readAuthField(formData, "password");
  const supabase = await createSupabaseUserClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signUpAction(formData: FormData) {
  const email = readAuthField(formData, "email");
  const password = readAuthField(formData, "password");
  const supabase = await createSupabaseUserClient();

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    redirect(`/signin?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}
