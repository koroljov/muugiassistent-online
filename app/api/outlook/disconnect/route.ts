// app/api/outlook/disconnect/route.ts — eemalda Outlooki ühendus (kustuta tokenid; Bearer auth)
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { userIdFromBearer } from "@/lib/outlook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await userIdFromBearer(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Pole sisse logitud." }, { status: 401 });
  const admin = getSupabaseAdmin();
  await admin.from("email_accounts").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
