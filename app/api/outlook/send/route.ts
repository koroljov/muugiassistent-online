// app/api/outlook/send/route.ts — saadab e-kirja kasutaja enda Outlooki kaudu (Graph sendMail).
// Kiri läheb kasutaja aadressilt ja jääb tema Saadetud kausta. Tokenid ei jõua kunagi kliendini.
import { NextResponse } from "next/server";
import { getValidToken, userIdFromBearer, sendMail } from "@/lib/outlook";
import { rateLimit } from "@/lib/rate-limit";
import { reportHealth } from "@/lib/source-health";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const userId = await userIdFromBearer(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Pole sisse logitud." }, { status: 401 });
  if (!rateLimit("mailsend:" + userId, 10, 60000)) {
    return NextResponse.json({ ok: false, error: "Liiga palju kirju korraga. Oota hetk." }, { status: 429 });
  }
  const token = await getValidToken(userId);
  if (!token) return NextResponse.json({ ok: false, connected: false, error: "Outlook pole ühendatud." });

  const body: any = await request.json().catch(() => ({}));
  const to = String(body?.to || "").trim();
  const subject = String(body?.subject || "").trim().slice(0, 200);
  const text = String(body?.text || "").slice(0, 10000);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ ok: false, error: "Vigane saaja aadress." }, { status: 400 });
  if (!subject) return NextResponse.json({ ok: false, error: "Teema puudub." }, { status: 400 });

  const atts = Array.isArray(body?.attachments) ? body.attachments.slice(0, 3) : [];
  let total = 0;
  const attachments: { name: string; contentType: string; contentBytes: string }[] = [];
  for (const a of atts) {
    const cb = String(a?.contentBytes || "");
    total += cb.length;
    if (total > 2800000) return NextResponse.json({ ok: false, error: "Manused liiga suured (kokku max ~2 MB)." }, { status: 400 });
    attachments.push({
      name: String(a?.name || "manus.pdf").slice(0, 100),
      contentType: String(a?.contentType || "application/octet-stream"),
      contentBytes: cb,
    });
  }

  try {
    await sendMail(token, { to, subject, text, attachments });
    await reportHealth("outlook", "ok");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await reportHealth("outlook", "degraded", String(e?.message || e));
    return NextResponse.json({ ok: false, connected: true, error: String(e?.message || e) }, { status: 502 });
  }
}
