// app/api/outlook/status/route.ts — kas kasutaja on Outlooki uhendanud (Bearer auth)
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { outlookConfigured, userIdFromBearer, getValidToken } from "@/lib/outlook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configured = outlookConfigured();
  try {
    const userId = await userIdFromBearer(request);
    if (!userId) return NextResponse.json({ connected: false, configured, build: "v3" });
    // Tode = kas saame kehtiva tokeni (sama definitsioon mis /messages kasutab)
    const token = await getValidToken(userId);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("email_accounts").select("email").eq("user_id", userId).maybeSingle();
    return NextResponse.json({
      connected: Boolean(token),
      email: (data && data.email) || null,
      configured,
      build: "v3",
      dbError: error ? String(error.message) : null,
    });
  } catch (e: any) {
    return NextResponse.json({ connected: false, configured, build: "v3", error: String(e && e.message ? e.message : e) });
  }
}
