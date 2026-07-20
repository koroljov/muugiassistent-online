// app/api/outlook/messages/route.ts — kasutaja viimased Outlooki kirjad (Bearer auth; token ei jõua kliendini)
import { NextResponse } from "next/server";
import { getValidToken, fetchMessages, deleteMessage, userIdFromBearer } from "@/lib/outlook";
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

// DELETE /api/outlook/messages?id=... — liigutab kirja Kustutatud kausta
export async function DELETE(request: Request) {
  const userId = await userIdFromBearer(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Pole sisse logitud." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Kirja id puudub." }, { status: 400 });
  const token = await getValidToken(userId);
  if (!token) return NextResponse.json({ ok: false, connected: false }, { status: 400 });
  try {
    await deleteMessage(token, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
