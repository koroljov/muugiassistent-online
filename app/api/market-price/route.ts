// app/api/market-price/route.ts
// Maa-ameti tehinguhindade statistika (õppiv hinnabaas).
// Loogika: vaata DB-st (market_prices) → kui puudu/aegunud, päri Scrapfly kaudu htraru-vormist → salvesta → tagasta.
// Scrapfly võti hoitakse serveris (process.env.SCRAPFLY_KEY), brauser seda ei näe.
// NB: Maa-amet on Cloudflare taga + ASP.NET vorm → otse-fetch ei tööta, vajab päris-brauserit (Scrapfly render_js + js_scenario).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

// Scrapfly render_js + js_scenario võib kesta kümneid sekundeid → pikem funktsiooni-kestus.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Maakonnad: lead.region tekst → htraru DDMaakond kood + ametlik nimi.
const COUNTY_CODES: Record<string, string> = {
  "0037": "Harju maakond", "0039": "Hiiu maakond", "0045": "Ida-Viru maakond",
  "0050": "Jõgeva maakond", "0052": "Järva maakond", "0056": "Lääne maakond",
  "0060": "Lääne-Viru maakond", "0064": "Põlva maakond", "0068": "Pärnu maakond",
  "0071": "Rapla maakond", "0074": "Saare maakond", "0079": "Tartu maakond",
  "0081": "Valga maakond", "0084": "Viljandi maakond", "0087": "Võru maakond",
};
// Märksõnad regiooni tekstist → koodi. Linnad mappitakse oma maakonda.
const REGION_HINTS: Array<[RegExp, string]> = [
  [/tallinn|harju|maardu|saue|keila|saku|viimsi|rae|kiili|jõelähtme|harku|kose|raasiku|anija|loksa|paldiski/i, "0037"],
  [/hiiu|kärdla|emmaste|käina|kõrgessaare/i, "0039"],
  [/ida-?viru|narva|kohtla|jõhvi|sillamäe|kiviõli|püssi|toila|sillamäe/i, "0045"],
  [/jõgeva|põltsamaa|mustvee/i, "0050"],
  [/järva|paide|türi|järva-jaani|koeru/i, "0052"],
  [/lääne maakond|haapsalu|lihula|ridala|vormsi/i, "0056"],
  [/lääne-?viru|rakvere|tapa|kunda|tamsalu|väike-maarja|kadrina/i, "0060"],
  [/põlva|räpina|kanepi/i, "0064"],
  [/pärnu|sindi|kilingi|tori|vändra|audru|paikuse/i, "0068"],
  [/rapla|kohila|märjamaa|kehtna|järvakandi/i, "0071"],
  [/saare|kuressaare|saaremaa|orissaare|muhu/i, "0074"],
  [/tartu|elva|tõravere|nõo|kambja|luunja/i, "0079"],
  [/valga|tõrva|otepää/i, "0081"],
  [/viljandi|võhma|mõisaküla|suure-jaani|karksi/i, "0084"],
  [/võru|antsla|võrumaa/i, "0087"],
];

// Objekti tüüp → htraru LBTrykis aruande kood + inimloetav silt.
function mapPropertyType(t: string): { code: string; label: string } | null {
  const s = (t || "").toLowerCase();
  if (/korter|eluruum|korteriomand/.test(s)) return { code: "T13", label: "Korteriomandid (eluruumid)" };
  if (/maja|eramu|elamu|paaris|ridaelamu|talu|suvila/.test(s)) return { code: "T11", label: "Hoonestatud maa (elamud/majad)" };
  if (/krunt|maa|hoonestamata|põllu|metsa/.test(s)) return { code: "T12", label: "Hoonestamata maa (krundid)" };
  return null; // tundmatu tüüp → ära päri valet segmenti
}

function regionToCounty(region: string): { code: string; name: string } | null {
  const r = (region || "").trim();
  if (!r) return null;
  for (const [re, code] of REGION_HINTS) {
    if (re.test(r)) return { code, name: COUNTY_CODES[code] };
  }
  return null;
}

// "2 794,48" → 2794.48 ; "11 974" → 11974
function parseNum(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s| /g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Leia KOKKU-rida ja eralda lahtrid. Veerud:
// [KOKKU, Arv, KeskmPindala, Kokku€, txMin, txMax, m2Min, m2Max, m2Mediaan, m2Keskmine, Std]
function parseKokku(html: string): {
  tx_count: number | null; total_value: number | null;
  min_eur_m2: number | null; max_eur_m2: number | null;
  median_eur_m2: number | null; avg_eur_m2: number | null;
} | null {
  // Dekodeeri tühikud (tuhandeeraldaja võib olla &nbsp; / &#160; / U+00A0)
  const decoded = html.replace(/&nbsp;/gi, " ").replace(/&#160;/g, " ").replace(/ /g, " ");
  const kIdx = decoded.indexOf("KOKKU");
  if (kIdx < 0) return null;
  // KOKKU-rea piirid: viimane <tr enne KOKKU-d ... esimene </tr> peale selle
  const rowStart = decoded.lastIndexOf("<tr", kIdx);
  const rowEnd = decoded.indexOf("</tr>", kIdx);
  if (rowStart < 0 || rowEnd < 0) return null;
  const row = decoded.slice(rowStart, rowEnd);
  const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  if (cells.length < 10) return null;
  // Veerud: [KOKKU, Arv, KeskmPindala, Kokku€, txMin, txMax, m2Min, m2Max, m2Mediaan, m2Keskmine, Std]
  return {
    tx_count: parseNum(cells[1]),
    total_value: parseNum(cells[3]),
    min_eur_m2: parseNum(cells[6]),
    max_eur_m2: parseNum(cells[7]),
    median_eur_m2: parseNum(cells[8]),
    avg_eur_m2: parseNum(cells[9]),
  };
}

// Ehita Scrapfly js_scenario, mis juhib htraru-vormi nagu päris kasutaja.
function buildScenario(typeCode: string, countyCode: string): string {
  // NB: dropdownid value+change (vallandab AutoPostBack); maakond ja periood vajavad .click()
  // (sündmustega) — .checked=true EI tööta (server ei näe valikut). Submit päris-klõpsuga.
  const steps = [
    { wait_for_selector: { selector: "#DDTrykis", timeout: 15000 } },
    { execute: { script: "var e=document.getElementById('DDTrykis');e.value='G';e.dispatchEvent(new Event('change',{bubbles:true}));" } },
    { wait_for_selector: { selector: "#LBTrykis option[value='T13']", timeout: 15000 } },
    { execute: { script: `var l=document.getElementById('LBTrykis');l.value='${typeCode}';l.dispatchEvent(new Event('change',{bubbles:true}));` } },
    { wait: 2500 },
    { execute: { script: `var c=document.querySelectorAll('.multiselect-container')[0];var t='${countyCode}';var cb=[].slice.call(c.querySelectorAll('input[type=checkbox]')).filter(function(x){return x.value===t;})[0];if(cb){cb.click();}var rb=document.getElementById('RBLAeg_3');if(rb){rb.click();}` } },
    { wait: 800 },
    { click: { selector: "#btnTryki" } },
    { wait_for_selector: { selector: "table", timeout: 15000 } },
    { wait: 1500 },
  ];
  return Buffer.from(JSON.stringify(steps)).toString("base64");
}

async function scrapflyFetch(typeCode: string, countyCode: string): Promise<string> {
  const key = process.env.SCRAPFLY_KEY;
  if (!key) throw new Error("SCRAPFLY_KEY puudub serveris");
  const params = new URLSearchParams({
    key,
    url: "https://www.maaamet.ee/kinnisvara/htraru/",
    render_js: "true",
    asp: "true", // Anti Scraping Protection (Cloudflare bypass)
    country: "ee",
    rendering_wait: "3000",
    js_scenario: buildScenario(typeCode, countyCode),
  });
  const r = await fetch("https://api.scrapfly.io/scrape?" + params.toString(), {
    signal: AbortSignal.timeout(55000),
  });
  const j = await r.json();
  const content = j?.result?.content;
  if (!content) throw new Error("Scrapfly ei tagastanud sisu: " + JSON.stringify(j?.result?.error || j).slice(0, 300));
  return content as string;
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit("market:" + auth.user.id, 20, 60000)) {
    return NextResponse.json({ error: "Liiga palju päringuid korraga. Oota hetk." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const region = (body?.region || "").toString();
  const propertyType = (body?.propertyType || body?.property_type || "").toString();

  const county = regionToCounty(region);
  const ptype = mapPropertyType(propertyType);
  if (!county) return NextResponse.json({ error: "Piirkonda ei tuvastatud", needs: "region" }, { status: 422 });
  if (!ptype) return NextResponse.json({ error: "Objekti tüüpi ei tuvastatud (toetatud: korter, maja, krunt)", needs: "propertyType" }, { status: 422 });

  // Periood: eelmine täisaasta.
  const lastYear = new Date().getFullYear() - 1;
  const period_start = `${lastYear}-01-01`;
  const period_end = `${lastYear}-12-31`;

  // 1) Vaata DB-st (värske = fetched_at < 180 päeva).
  const { data: cached } = await admin
    .from("market_prices")
    .select("*")
    .eq("county", county.name)
    .eq("municipality", "")
    .eq("district", "")
    .eq("property_type", ptype.code)
    .eq("period_end", period_end)
    .maybeSingle();

  const FRESH_MS = 180 * 24 * 3600 * 1000;
  if (cached && cached.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
    return NextResponse.json({ source: "cache", data: cached });
  }

  // 2) Päri Scrapfly kaudu.
  let html: string;
  try {
    html = await scrapflyFetch(ptype.code, county.code);
  } catch (e: any) {
    // Kui värske puudus aga vana on olemas, tagasta vana + hoiatus.
    if (cached) return NextResponse.json({ source: "stale", data: cached, warning: "Värsket päringut ei õnnestunud teha: " + (e?.message || "viga") });
    return NextResponse.json({ error: e?.message || "Maa-ameti päring ebaõnnestus" }, { status: 502 });
  }

  const parsed = parseKokku(html);
  if (!parsed || parsed.tx_count == null) {
    const ki = html.indexOf("KOKKU");
    const debug = {
      len: html.length,
      hasKokku: ki >= 0,
      hasPinnauhik: html.includes("Pinnaühiku"),
      hasErrorPage: html.includes("HtrErrorPage"),
      hasTable: html.includes("<table"),
      hasMultiselect: html.includes("multiselect"),
      kokkuContext: ki >= 0 ? html.slice(ki - 50, ki + 400).replace(/\s+/g, " ") : "",
    };
    return NextResponse.json({ error: "Tulemust ei õnnestunud lugeda (vorm muutus või andmeid napib)", debug }, { status: 502 });
  }

  // 3) Salvesta (upsert segmendi võtmega).
  const row = {
    county: county.name,
    municipality: "",
    district: "",
    property_type: ptype.code,
    property_label: ptype.label,
    period_start,
    period_end,
    median_eur_m2: parsed.median_eur_m2,
    avg_eur_m2: parsed.avg_eur_m2,
    min_eur_m2: parsed.min_eur_m2,
    max_eur_m2: parsed.max_eur_m2,
    tx_count: parsed.tx_count,
    total_value: parsed.total_value,
    raw: parsed as any,
    source: "maaamet_htraru",
    fetched_at: new Date().toISOString(),
  };
  const { data: saved, error: saveErr } = await admin
    .from("market_prices")
    .upsert(row, { onConflict: "county,municipality,district,property_type,period_start,period_end" })
    .select()
    .maybeSingle();
  if (saveErr) return NextResponse.json({ source: "fresh", data: row, warning: "Salvestus ebaõnnestus: " + saveErr.message });

  return NextResponse.json({ source: "fresh", data: saved || row });
}
