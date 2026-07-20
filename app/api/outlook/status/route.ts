// app/api/outlook/status/route.ts — kas kasutaja on Outlooki ühendanud (Bearer auth)
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { outlookConfigured, userIdFromBearer } from "@/lib/outlook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configured = outlookConfigured();
  try {
    const userId = await userIdFromBearer(request);
    if (!userId) return NextResponse.json({ connected: false, configured });
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("email_accounts").select("email,access_token,refresh_token").eq("user_id", userId).maybeSingle();
        const usable = Boolean(data && (data.access_token || data.refresh_token));
    return NextResponse.json({ connected: usable, email: (data && data.email) || null, configured, build: "v2" });
  } catch (e: any) {
    return NextResponse.json({ connected: false, configured, error: String(e?.message || e) });
  }
}
