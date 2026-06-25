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

// Objekti tüüp (+otstarve) → htraru aruande kood, mõõdik ja tabeli rida.
// Korter: T13, €/m² (KOKKU rida). Maja/maa/äripind: T11/T12, mediaan TEHINGUHIND (sihtotstarbe rida).
type PType = { code: string; label: string; metric: "eur_m2" | "price"; segment: string };
function mapPropertyType(t: string, usePurpose?: string): PType | null {
  const s = (t || "").toLowerCase();
  if (/korter|eluruum|korteriomand/.test(s)) return { code: "T13", label: "Korteriomandid (eluruumid)", metric: "eur_m2", segment: "KOKKU" };
  if (/maja|majaosa|eramu|elamu|paaris|ridaelamu|talu|suvila/.test(s)) return { code: "T11", label: "Elamumaa (majad)", metric: "price", segment: "elamumaa" };
  if (/äri|büroo|kaubandus|ladu|tootmine|toitlustus|teenindus|majutus|garaa/.test(s)) return { code: "T11", label: "Ärimaa (äripind)", metric: "price", segment: "ärimaa" };
  if (/krunt|maa|hoonestamata|põllu|metsa/.test(s)) {
    const p = (usePurpose || "").toLowerCase();
    const seg = /äri/.test(p) ? "ärimaa" : /tootmis/.test(p) ? "tootmismaa" : /maatulundus|põllu/.test(p) ? "maatulundusmaa" : "elamumaa";
    return { code: "T12", label: "Hoonestamata maa (" + seg + ")", metric: "price", segment: seg };
  }
  return null; // tundmatu tüüp (nt garaaž) → Maa-amet ei anna
}

// Eralda sihtotstarbe-rida (maja/maa/äripind, T11/T12). Veerud:
// [otstarve, Arv, KeskmPindala, Kokku€, Min, Max, Mediaan€, Keskmine€, Std]
function parsePriceRow(html: string, segment: string): { tx_count: number | null; total_value: number | null; median_price: number | null; avg_price: number | null } | null {
  const decoded = html.replace(/&nbsp;/gi, " ").replace(/&#160;/g, " ").replace(/ /g, " ");
  // Otsi rida, mille esimene lahter on täpselt sihtotstarve (nt "elamumaa")
  const re = new RegExp("<tr[^>]*>\\s*<t[dh][^>]*>\\s*" + segment + "\\s*<\\/t[dh]>([\\s\\S]*?)<\\/tr>", "i");
  const m = decoded.match(re);
  if (!m) return null;
  const cells = [...("<td>" + segment + "</td>" + m[1]).matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((c) => c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  if (cells.length < 8) return null;
  return {
    tx_count: parseNum(cells[1]),
    total_value: parseNum(cells[3]),
    median_price: parseNum(cells[6]),
    avg_price: parseNum(cells[7]),
  };
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
  const usePurpose = (body?.usePurpose || body?.use_purpose || "").toString();

  const county = regionToCounty(region);
  const ptype = mapPropertyType(propertyType, usePurpose);
  if (!county) return NextResponse.json({ error: "Piirkonda ei tuvastatud", needs: "region" }, { status: 422 });
  if (!ptype) return NextResponse.json({ unsupported: true, message: "Selle objekti tüübi (nt garaaž) kohta Maa-amet hinnastatistikat ei anna." });

  // Segmendi võti: korter='T13', maja='T11:elamumaa', äripind='T11:ärimaa', maa='T12:<otstarve>'.
  const segKey = ptype.metric === "price" ? ptype.code + ":" + ptype.segment : ptype.code;

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
    .eq("property_type", segKey)
    .eq("period_end", period_end)
    .maybeSingle();

  const FRESH_MS = 180 * 24 * 3600 * 1000;
  if (cached && cached.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
    return NextResponse.json({ source: "cache", data: cached });
  }

  // 2) Päri Scrapfly kaudu (sama stsenaarium, ainult aruande kood erineb).
  let html: string;
  try {
    html = await scrapflyFetch(ptype.code, county.code);
  } catch (e: any) {
    if (cached) return NextResponse.json({ source: "stale", data: cached, warning: "Värsket päringut ei õnnestunud teha: " + (e?.message || "viga") });
    return NextResponse.json({ error: e?.message || "Maa-ameti päring ebaõnnestus" }, { status: 502 });
  }

  // 3) Parsi õige mõõdiku järgi.
  let row: any;
  if (ptype.metric === "eur_m2") {
    const p = parseKokku(html);
    if (!p || !(Number(p.median_eur_m2) > 0) || !(Number(p.tx_count) > 0)) {
      return NextResponse.json({ error: "Tulemust ei õnnestunud lugeda (vorm muutus või andmeid napib)", debug: { len: html.length, hasKokku: html.includes("KOKKU"), hasTable: html.includes("<table"), hasErrorPage: html.includes("HtrErrorPage") } }, { status: 502 });
    }
    row = { median_eur_m2: p.median_eur_m2, avg_eur_m2: p.avg_eur_m2, min_eur_m2: p.min_eur_m2, max_eur_m2: p.max_eur_m2, tx_count: p.tx_count, total_value: p.total_value };
  } else {
    const p = parsePriceRow(html, ptype.segment);
    if (!p || !(Number(p.median_price) > 0) || !(Number(p.tx_count) > 0)) {
      return NextResponse.json({ error: "Selles segmendis ('" + ptype.segment + "') ei õnnestunud usaldusväärset tehinguhinda lugeda (andmeid napib või vorm muutus).", debug: { len: html.length, hasSegment: html.toLowerCase().includes(ptype.segment), hasTable: html.includes("<table"), hasErrorPage: html.includes("HtrErrorPage") } }, { status: 502 });
    }
    row = { median_price: p.median_price, avg_price: p.avg_price, tx_count: p.tx_count, total_value: p.total_value };
  }

  // 4) Salvesta.
  const full = {
    county: county.name,
    municipality: "",
    district: "",
    property_type: segKey,
    property_label: ptype.label,
    metric: ptype.metric,
    segment: ptype.segment,
    period_start,
    period_end,
    source: "maaamet_htraru",
    fetched_at: new Date().toISOString(),
    ...row,
  };
  const { data: saved, error: saveErr } = await admin
    .from("market_prices")
    .upsert(full, { onConflict: "county,municipality,district,property_type,period_start,period_end" })
    .select()
    .maybeSingle();
  if (saveErr) return NextResponse.json({ source: "fresh", data: full, warning: "Salvestus ebaõnnestus: " + saveErr.message });

  return NextResponse.json({ source: "fresh", data: saved || full });
}
