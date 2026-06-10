import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseAdmin } from "./supabase-server";
import type { Role } from "./types";

export async function getCurrentUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getUserRole(userId: string): Promise<Role | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("users").select("role").eq("id", userId).single();
  return (data?.role as Role | undefined) ?? null;
}

export async function canAccessLead(leadId: string, userId: string) {
  if (!leadId || !userId) return false;
  const admin = getSupabaseAdmin();
  const role = await getUserRole(userId);
  if (role === "admin") return true;
  const { data } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .maybeSingle();
  return Boolean(data);
}

export async function canAccessTask(taskId: string, userId: string) {
  if (!taskId || !userId) return false;
  const admin = getSupabaseAdmin();
  const role = await getUserRole(userId);
  if (role === "admin") return true;
  const { data } = await admin
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("assigned_to", userId)
    .maybeSingle();
  return Boolean(data);
}
