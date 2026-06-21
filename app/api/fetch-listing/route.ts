// app/api/fetch-listing/route.ts — tõmbab kuulutuse lehe serveripoolselt (ei CORS-i, usaldusväärsem kui brauseri proksi).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const url = (body?.url || "").trim();
  const ogImageOnly = !!body?.ogImageOnly;
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Vigane URL" }, { status: 400 });

  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await r.text();
    if (ogImageOnly) {
      const m = html.match(/property="og:image"[^>]+content="([^"]+)"/) || html.match(/content="([^"]+)"[^>]+property="og:image"/);
      return NextResponse.json({ ogImage: (m && m[1]) || "" });
    }
    return NextResponse.json({ html: html.slice(0, 800000) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lehe tõmbamine ebaõnnestus" }, { status: 500 });
  }
}
