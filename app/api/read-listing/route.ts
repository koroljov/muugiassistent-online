// app/api/read-listing/route.ts
// Loeb kinnisvaraportaali kuulutuse serveripoolselt Scrapfly kaudu (render_js + asp = bot-blokist üle).
// Tagastab eraldatud väljad → klient annab need samale import-AI-le (importExtractAI) mis järjehoidja.
// Kasutus: kui kasutaja EI kasuta järjehoidjat, vaid kleebib URL-i ja vajutab "Loe AI-ga".
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { reportHealth } from "@/lib/source-health";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function meta(html: string, prop: string): string {
  const i = html.indexOf('property="' + prop + '"');
  if (i < 0) return "";
  const chunk = html.slice(i, i + 400);
  const m = chunk.match(/content=["']([^"'<]{1,300})["']/) || html.slice(Math.max(0, i - 400), i).match(/content=["']([^"'<]{1,300})["'][^>]*$/);
  return m ? m[1].trim() : "";
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit("readlisting:" + auth.user.id, 15, 60000)) {
    return NextResponse.json({ error: "Liiga palju päringuid korraga. Oota hetk." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  let url = (body?.url || "").toString().trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return NextResponse.json({ error: "Vigane URL" }, { status: 400 }); }
  const ALLOWED = ["kv.ee", "kinnisvara24.ee", "city24.ee"];
  if (!ALLOWED.some((d) => host === d || host.endsWith("." + d))) {
    return NextResponse.json({ error: "Lubatud ainult kinnisvaraportaalid (kv.ee, kinnisvara24, city24)" }, { status: 400 });
  }

  const key = process.env.SCRAPFLY_KEY;
  if (!key) return NextResponse.json({ error: "SCRAPFLY_KEY puudub serveris" }, { status: 500 });

  let html = "";
  try {
    const _reveal = "try{var e=document.querySelectorAll('a,button');for(var i=0;i<e.length;i++){var t=(e[i].textContent||'').trim().toLowerCase();if(t.length<40&&t.indexOf('näita')>-1){e[i].click();}}}catch(x){}";
    const _scenario = Buffer.from(JSON.stringify([ { execute: { script: _reveal, timeout: 2500 } } ])).toString("base64url");
    const params = new URLSearchParams({ key, url, render_js: "true", asp: "true", country: "ee", rendering_wait: "2500", js_scenario: _scenario });
    const r = await fetch("https://api.scrapfly.io/scrape?" + params.toString(), { signal: AbortSignal.timeout(55000) });
    const j = await r.json();
    html = j?.result?.content || "";
    if (!html) await reportHealth("portaalid", "degraded", "Scrapfly ei tagastanud sisu");
    if (!html) return NextResponse.json({ error: "Scrapfly ei tagastanud sisu: " + JSON.stringify(j?.result?.error || {}).slice(0, 200) }, { status: 502 });
  } catch (e: any) {
    await reportHealth("portaalid", "degraded", e?.message || "Scrapfly viga");
    return NextResponse.json({ error: e?.message || "Kuulutuse lugemine ebaõnnestus" }, { status: 502 });
  }

  // Eralda väljad (klient annab need importExtractAI-le)
  const ogTitle = meta(html, "og:title");
  const ogDesc = meta(html, "og:description");
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 7000);
  const _telHref = html.match(/tel:\+?(?:372)?([0-9][0-9\s-]{5,9})/i);
  const telM = _telHref ? [ _telHref[1].replace(/[\s-]/g, "") ] : text.match(/(\+372[\s-]?)?[5][0-9][0-9\s-]{5,8}/);
  const emailM = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);

  await reportHealth("portaalid", "ok");
  return NextResponse.json({
    ogTitle, ogDesc, text,
    tel: telM ? telM[0].trim() : "",
    email: emailM ? emailM[0].trim() : "",
  });
}
