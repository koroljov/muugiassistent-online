// app/api/admin/invite/route.ts
// Meeskonna omanik (org owner) saab lisada uue liikme. Loob auth-kasutaja (service key) + profiili org_id-ga.
// Turvakontroll: kutsuja peab olema oma organisatsiooni omanik. Tagastab ajutise parooli (omanik jagab liikmele).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = auth.user.id;

  // Kutsuja peab olema org omanik
  const { data: prof } = await admin.from("profiles").select("org_id").eq("id", me).maybeSingle();
  const orgId = prof?.org_id;
  if (!orgId) return NextResponse.json({ error: "Sul pole organisatsiooni." }, { status: 403 });
  const { data: org } = await admin.from("orgs").select("owner_id, name").eq("id", orgId).maybeSingle();
  if (!org || org.owner_id !== me) return NextResponse.json({ error: "Ainult meeskonna omanik saab liikmeid lisada." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = (body?.email || "").toString().trim().toLowerCase();
  const name = (body?.name || "").toString().trim();
  if (!email || !/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Sisesta korrektne e-post." }, { status: 400 });

  // Ajutine parool
  const pw = "Mell-" + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password: pw, email_confirm: true,
  });
  if (cErr || !created?.user) {
    return NextResponse.json({ error: cErr?.message || "Kasutaja loomine ebaõnnestus (kas e-post juba kasutusel?)." }, { status: 400 });
  }
  const uid = created.user.id;

  await admin.from("profiles").upsert(
    { id: uid, email, name: name || email.split("@")[0], role: "member", org_id: orgId },
    { onConflict: "id" }
  );

  return NextResponse.json({ ok: true, email, password: pw, org: org.name });
}
