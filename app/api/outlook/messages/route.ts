// app/api/outlook/messages/route.ts — kasutaja viimased Outlooki kirjad (Bearer auth; token ei jõua kliendini)
import { NextResponse } from "next/server";
import { getValidToken, fetchMessages, userIdFromBearer } from "@/lib/outlook";
import { reportHealth } from "@/lib/source-health";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request) {
  const userId = await userIdFromBearer(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Pole sisse logitud." }, { status: 401 });
  const token = await getValidToken(userId);
  if (!token) return NextResponse.json({ ok: false, connected: false });
  try {
    const top = Math.min(Number(new URL(request.url).searchParams.get("top")) || 25, 50);
    const messages = await fetchMessages(token, top);
    await reportHealth("outlook", "ok");
    return NextResponse.json({ ok: true, connected: true, messages });
  } catch (e: any) {
    await reportHealth("outlook", "degraded", String(e?.message || e));
    return NextResponse.json({ ok: false, connected: true, error: String(e?.message || e) });
  }
}
