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
// Tallinna ametlikud linnaosad → htraru DDOmavalitsus kood (linnaosa-täpne €/m²).
const TALLINN_LINNAOSA: Record<string, { code: string; label: string }> = {
  "haabersti": { code: "176", label: "Haabersti linnaosa" },
  "kesklinn": { code: "298", label: "Kesklinna linnaosa" },
  "kristiine": { code: "339", label: "Kristiine linnaosa" },
  "lasnamäe": { code: "387", label: "Lasnamäe linnaosa" },
  "mustamäe": { code: "482", label: "Mustamäe linnaosa" },
  "nõmme": { code: "524", label: "Nõmme linnaosa" },
  "pirita": { code: "596", label: "Pirita linnaosa" },
  "põhja-tallinn": { code: "614", label: "Põhja-Tallinna linnaosa" },
};
function tallinnDistrictCode(district: string): { code: string; label: string } | null {
  const d = (district || "").toLowerCase();
  for (const key of Object.keys(TALLINN_LINNAOSA)) {
    if (d.indexOf(key) >= 0) return TALLINN_LINNAOSA[key];
  }
  return null;
}

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
// omavCode (valikuline) = Tallinna linnaosa kood (DDOmavalitsus), nt 298 Kesklinn → linnaosa-täpne päring.
function buildScenario(typeCode: string, countyCode: string, omavCode?: string, asumName?: string, algMY?: string, loppMY?: string): string {
  // NB: dropdownid value+change (vallandab AutoPostBack); maakond ja periood vajavad .click()
  // (sündmustega) — .checked=true EI tööta. Omavalitsuse cascade: __doPostBack('DDMaakond',''). Submit päris-klõpsuga.
  const steps: any[] = [
    { wait_for_selector: { selector: "#DDTrykis", timeout: 15000 } },
    { execute: { script: "var e=document.getElementById('DDTrykis');e.value='G';e.dispatchEvent(new Event('change',{bubbles:true}));" } },
    { wait_for_selector: { selector: "#LBTrykis option[value='T13']", timeout: 15000 } },
    { execute: { script: `var l=document.getElementById('LBTrykis');l.value='${typeCode}';l.dispatchEvent(new Event('change',{bubbles:true}));` } },
    { wait_for_selector: { selector: `.multiselect-container input[value='${countyCode}']`, timeout: 15000 } },
    // NB: multiselect on lehel ALATI olemas → wait_for lahendub KOHE ega oota LBTrykis postbacki.
    // LBTrykis onchange teeb __doPostBack (setTimeout 0) → vorm laeb uuesti. Oota see LÄBI enne county valikut,
    // muidu klõps tabab vahetuvat DOM-i ja valik kaob (browseris tõestatud sõltuvus).
    { wait: 2800 },
    // County: sea alusvalik DDMaakond OTSE (Bootstrap-multiselecti checkbox-klõps EI uuenda alusvalikut Scrapfly
    // headless'is → "Sisesta haldusüksus käsitsi"). Otse-seadmine on headless-kindel ja postitub vormiga.
    // Klõpsa ka widgetit (UI sünk), aga määrav on DDMaakond.options.selected.
    { execute: { script: `var t='${countyCode}';var sel=document.getElementById('DDMaakond');if(sel){[].forEach.call(sel.options,function(o){o.selected=(o.value===t);});sel.dispatchEvent(new Event('change',{bubbles:true}));}var c=document.querySelectorAll('.multiselect-container')[0];if(c){var cb=[].slice.call(c.querySelectorAll('input[type=checkbox]')).filter(function(x){return x.value===t;})[0];if(cb&&!cb.checked){cb.click();}}` } },
  ];
  if (omavCode) {
    // Tallinna linnaosa: käivita omavalitsuse cascade ja vali linnaosa
    steps.push({ execute: { script: "try{__doPostBack('DDMaakond','');}catch(e){}" } });
    steps.push({ wait_for_selector: { selector: `#DDOmavalitsus option[value='${omavCode}']`, timeout: 15000 } });
    steps.push({ execute: { script: `var o=document.getElementById('DDOmavalitsus');if(o){o.value='${omavCode}';}` } });
    steps.push({ wait: 600 });
    if (asumName) {
      // Asumi tase: käivita 3. cascade ja vali asum NIME järgi (DDKyla koodid on dünaamilised)
      const aN = asumName.replace(/'/g, "");
      steps.push({ execute: { script: "try{__doPostBack('DDOmavalitsus','');}catch(e){}" } });
      steps.push({ wait: 2500 });
      steps.push({ execute: { script: `var k=document.getElementById('DDKyla');if(k){var o=[].slice.call(k.options).filter(function(x){return x.text.toLowerCase().indexOf('${aN.toLowerCase()}')>=0;})[0];if(o){k.value=o.value;}}` } });
      steps.push({ wait: 500 });
    }
  }
  // Periood: LIBISEV viimased 12 kuud (täpsem kui eelmine täisaasta). Browseris kontrollitud sammud:
  // RBLAeg_0 ("ajavahemik") klõps ERALDI → oota → siis txtAlgus/txtLopp (MM.YYYY) → oota → submit.
  if (algMY && loppMY) {
    // RBLAeg_0 ("ajavahemik") on vormil JUBA vaikimisi valitud ega oma AutoPostBacki.
    // ÄRA klõpsa seda — klõps võib raadio hoopis MAHA võtta (browseris tõestatud: rb0=false).
    // KRIITILINE: LBTrykis (ja Tallinna cascade) käivitavad AutoPostBacki, mis vormi uuesti laeb ja
    // txtAlgus/txtLopp TÜHJENDAB. Seetõttu: oota postback läbi → sea kuupäevad VIIMASENA → siis esita.
    steps.push({ wait: 2500 });
    steps.push({ execute: { script: "function S(id,v){var e=document.getElementById(id);if(e){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}}S('txtAlgus','" + algMY + "');S('txtLopp','" + loppMY + "');" } });
    steps.push({ wait: 1000 });
  } else {
    steps.push({ execute: { script: "var rb=document.getElementById('RBLAeg_3');if(rb){rb.click();}" } });
    steps.push({ wait: 1000 });
  }
  steps.push({ click: { selector: "#btnTryki" } });
  // Submit navigeerib Result.aspx-le. ÄRA oota geneerilist 'table' (vormi lehel ON tabeleid → lahendub liiga vara).
  steps.push({ wait: 9000 });
  return Buffer.from(JSON.stringify(steps)).toString("base64");
}

async function scrapflyFetch(typeCode: string, countyCode: string, omavCode?: string, asumName?: string, algMY?: string, loppMY?: string): Promise<string> {
  const key = process.env.SCRAPFLY_KEY;
  if (!key) throw new Error("SCRAPFLY_KEY puudub serveris");
  const params = new URLSearchParams({
    key,
    url: "https://www.maaamet.ee/kinnisvara/htraru/",
    render_js: "true",
    asp: "true", // Anti Scraping Protection (Cloudflare bypass)
    country: "ee",
    rendering_wait: "3000",
    js_scenario: buildScenario(typeCode, countyCode, omavCode, asumName, algMY, loppMY),
  });
  const r = await fetch("https://api.scrapfly.io/scrape?" + params.toString(), {
    signal: AbortSignal.timeout(55000),
  });
  const j = await r.json();
  const content = j?.result?.content;
  lastScrapflyUrl = j?.result?.url || ""; // DEBUG: lõplik URL (kas navigeeris Result.aspx-le)
  if (!content) throw new Error("Scrapfly ei tagastanud sisu: " + JSON.stringify(j?.result?.error || j).slice(0, 300));
  return content as string;
}
let lastScrapflyUrl = ""; // DEBUG ajutine

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
  const district = (body?.district || "").toString();

  const county = regionToCounty(region);
  const ptype = mapPropertyType(propertyType, usePurpose);
  if (!county) return NextResponse.json({ error: "Piirkonda ei tuvastatud", needs: "region" }, { status: 422 });
  if (!ptype) return NextResponse.json({ unsupported: true, message: "Selle objekti tüübi (nt garaaž) kohta Maa-amet hinnastatistikat ei anna." });

  const asum = (body?.asum || "").toString().trim();

  // AJUTINE DEBUG: body.debug=true → tagasta toores HTML-i diagnostika (maakond, libisev periood).
  if (body?.debug === true) {
    const _now2 = new Date();
    const _endD2 = new Date(_now2.getFullYear(), _now2.getMonth(), 0);
    const _startD2 = new Date(_endD2.getFullYear(), _endD2.getMonth() - 11, 1);
    const _pad2 = (n: number) => String(n).padStart(2, "0");
    const algD = _pad2(_startD2.getMonth() + 1) + "." + _startD2.getFullYear();
    const loppD = _pad2(_endD2.getMonth() + 1) + "." + _endD2.getFullYear();
    try {
      const h = await scrapflyFetch(ptype.code, county.code, undefined, undefined, algD, loppD);
      const dec = h.replace(/&nbsp;/gi, " ").replace(/&#160;/g, " ").replace(/ /g, " ");
      const kIdx = dec.indexOf("KOKKU");
      const algInput = dec.match(/id="txtAlgus"[^>]*?value="([^"]*)"/i) || dec.match(/value="([^"]*)"[^>]*?id="txtAlgus"/i);
      const loppInput = dec.match(/id="txtLopp"[^>]*?value="([^"]*)"/i) || dec.match(/value="([^"]*)"[^>]*?id="txtLopp"/i);
      const rb0m = dec.match(/id="RBLAeg_0"[^>]*?>/i);
      const rb0checked = rb0m ? /checked/i.test(rb0m[0]) : null;
      const harjuM = dec.match(/value="0037"[^>]*?>/i);
      const harjuChecked = harjuM ? /checked/i.test(harjuM[0]) : null;
      const valMsg = (dec.match(/(viga|sisesta|vale|kohustuslik|täida)[^<]{0,60}/i) || [])[0] || null;
      return NextResponse.json({
        debug: true, alg: algD, lopp: loppD, len: h.length, finalUrl: lastScrapflyUrl,
        hasKOKKU: kIdx >= 0, parsed: parseKokku(h),
        formAlg: algInput ? algInput[1] : "NO_FIELD", formLopp: loppInput ? loppInput[1] : "NO_FIELD",
        rb0checked, harjuChecked, valMsg,
      });
    } catch (e: any) {
      return NextResponse.json({ debug: true, err: String(e?.message || e) });
    }
  }

  // Tallinna täpsus (ainult Harju). Tasemed kõige täpsemast → üldisemani:
  //   asum (nt Kalamaja) → linnaosa (nt Põhja-Tallinn) → maakond (Harju).
  // Kui täpsemas tasemes on liiga vähe tehinguid (Maa-amet peidab <5), langeme automaatselt järgmisele.
  const lo = county.code === "0037" ? tallinnDistrictCode(district) : null;
  type Level = { kind: "asum" | "linnaosa" | "maakond"; district: string; omavCode?: string; asumName?: string };
  const levels: Level[] = [];
  if (lo && asum) levels.push({ kind: "asum", district: asum, omavCode: lo.code, asumName: asum });
  if (lo) levels.push({ kind: "linnaosa", district: lo.label, omavCode: lo.code });
  levels.push({ kind: "maakond", district: "" });

  // Segmendi võti: korter='T13', maja='T11:elamumaa', äripind='T11:ärimaa', maa='T12:<otstarve>'.
  const segKey = ptype.metric === "price" ? ptype.code + ":" + ptype.segment : ptype.code;

  // Periood: LIBISEV viimased 12 täiskuud (browseris kontrollitud, et htraru kohandatud vahemik töötab). Lõpp = eelmine täis kuu.
  const _now = new Date();
  const _endD = new Date(_now.getFullYear(), _now.getMonth(), 0);            // eelmise kuu viimane päev
  const _startD = new Date(_endD.getFullYear(), _endD.getMonth() - 11, 1);   // 12 kuu akna esimene päev
  const _pad = (n: number) => String(n).padStart(2, "0");
  const algMY: string | undefined = _pad(_startD.getMonth() + 1) + "." + _startD.getFullYear();
  const loppMY: string | undefined = _pad(_endD.getMonth() + 1) + "." + _endD.getFullYear();
  const period_start = `${_startD.getFullYear()}-${_pad(_startD.getMonth() + 1)}-01`;
  const period_end = `${_endD.getFullYear()}-${_pad(_endD.getMonth() + 1)}-${_pad(_endD.getDate())}`; // cache-võti muutub iga kuu → automaatne värskendus
  const FRESH_MS = 180 * 24 * 3600 * 1000;

  // Parsib HTML-i õige mõõdiku järgi. Tagastab rea VÕI null (andmeid napib / vorm muutus).
  function parseRow(html: string): any | null {
    if (ptype!.metric === "eur_m2") {
      const p = parseKokku(html);
      if (!p || !(Number(p.median_eur_m2) > 0) || !(Number(p.tx_count) > 0)) return null;
      return { median_eur_m2: p.median_eur_m2, avg_eur_m2: p.avg_eur_m2, min_eur_m2: p.min_eur_m2, max_eur_m2: p.max_eur_m2, tx_count: p.tx_count, total_value: p.total_value };
    }
    const p = parsePriceRow(html, ptype!.segment);
    if (!p || !(Number(p.median_price) > 0) || !(Number(p.tx_count) > 0)) return null;
    return { median_price: p.median_price, avg_price: p.avg_price, tx_count: p.tx_count, total_value: p.total_value };
  }

  // 1) Vaata DB-st (värske = fetched_at < 180 päeva). Kontrolli kõige täpsemast tasemest.
  //    tx_count=0 = "sentinel" (varem kontrollitud, andmeid napib) → liigu üldisemale tasemele, ÄRA päri uuesti.
  //    Kui tase pole üldse cache'is → katkesta ja päri (alates kõige täpsemast).
  let mustFetch = false;
  let staleFallback: { data: any; level: string } | null = null; // viimane teadaolev väärtus (ka aegunud) — varuks, kui värske päring kukub
  for (const lv of levels) {
    const { data: cached } = await admin
      .from("market_prices")
      .select("*")
      .eq("county", county.name)
      .eq("municipality", "")
      .eq("district", lv.district)
      .eq("property_type", segKey)
      .eq("period_end", period_end)
      .maybeSingle();
    if (cached && Number(cached.tx_count) > 0 && !staleFallback) staleFallback = { data: cached, level: lv.kind };
    if (cached && cached.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
      if (Number(cached.tx_count) > 0) return NextResponse.json({ source: "cache", data: cached, level: lv.kind });
      continue; // sentinel: see tase on teadaolevalt hõre → proovi üldisemat
    }
    mustFetch = true; // see tase pole värske cache'is → vaja Scrapflyt
    break;
  }
  // Varuks: kui täpsemalt tasemelt ei leitud, võta maakonna-tase (district='') kui kunagi salvestatud — peaaegu alati olemas.
  if (mustFetch && !staleFallback) {
    const { data: cf } = await admin.from("market_prices").select("*")
      .eq("county", county.name).eq("municipality", "").eq("district", "")
      .eq("property_type", segKey).eq("period_end", period_end).maybeSingle();
    if (cf && Number(cf.tx_count) > 0) staleFallback = { data: cf, level: "maakond" };
  }

  // 2) Päri Scrapfly kaudu, kõige täpsemast tasemest. Kui napib → salvesta sentinel ja lange järgmisele.
  let lastErr = "";
  let structural = false; // true = Maa-amet muutis vormi/struktuuri (mitte ajutine viga ega hõredus)
  for (let i = 0; mustFetch && i < levels.length; i++) {
    const lv = levels[i];
    let html: string;
    try {
      html = await scrapflyFetch(ptype.code, county.code, lv.omavCode, lv.asumName, algMY, loppMY);
    } catch (e: any) {
      lastErr = e?.message || "päring ebaõnnestus";
      continue; // proovi üldisemat taset
    }
    // NB: ainult ÜKS Scrapfly-päring tasemel — kordus ületaks Vercel 60s limiidi (eriti libiseva perioodiga). Tõrke korral → stale-varuvariant.
    const row = parseRow(html);
    if (!row) {
      lastErr = "andmeid napib tasemel '" + lv.kind + "'";
      // Maakonna tasemel on ALATI tuhandeid tehinguid → parse null seal = Maa-amet muutis vormi/struktuuri
      // (mitte hõredus). Märgi allikas 'degraded' (teavitus) ja eralda see ausast "andmeid napib" juhust.
      if (lv.kind === "maakond" && html && html.length > 500) {
        structural = true;
        try { await admin.from("source_health").upsert({ source: "maaamet_htraru", status: "degraded", detail: "Maakonna-tase: tulemust ei loetud (vorm võis muutuda). seg=" + segKey, checked_at: new Date().toISOString() }, { onConflict: "source" }); } catch (e) {}
      }
      // Salvesta sentinel (tx_count=0), et seda hõredat taset uuesti ei päriks.
      if (lv.kind !== "maakond") {
        await admin.from("market_prices").upsert({
          county: county.name, municipality: "", district: lv.district, property_type: segKey,
          property_label: ptype.label + " — " + lv.district + " (andmeid napib)",
          metric: ptype.metric, segment: ptype.segment, period_start, period_end,
          source: "maaamet_htraru", fetched_at: new Date().toISOString(), tx_count: 0,
        }, { onConflict: "county,municipality,district,property_type,period_start,period_end" });
      }
      continue; // <5 tehingut vms → langeme üldisemale tasemele
    }

    // 3) Salvesta selle taseme tulemus.
    const full: any = {
      county: county.name,
      municipality: "",
      district: lv.district,
      property_type: segKey,
      property_label: ptype.label + (lv.district ? " — " + lv.district : ""),
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
    // Õnnestus → märgi allikas terveks (kustutab varasema 'degraded' staatuse).
    try { await admin.from("source_health").upsert({ source: "maaamet_htraru", status: "ok", detail: null, checked_at: new Date().toISOString() }, { onConflict: "source" }); } catch (e) {}
    const fellBack = i > 0 ? levels[0].kind : null; // küsiti täpsemat, anti üldisem
    if (saveErr) return NextResponse.json({ source: "fresh", data: full, level: lv.kind, fellBackFrom: fellBack, warning: "Salvestus ebaõnnestus: " + saveErr.message });
    return NextResponse.json({ source: "fresh", data: saved || full, level: lv.kind, fellBackFrom: fellBack });
  }

  // 4) Kõik tasemed ebaõnnestusid. EELISTA viimast teadaolevat väärtust (töökindlus) — alarm ainult kui fallbackit pole.
  if (staleFallback) return NextResponse.json({ source: "stale", data: staleFallback.data, level: staleFallback.level, warning: "Värsket Maa-ameti päringut ei õnnestunud teha — näitan viimast teadaolevat väärtust (ei pruugi olla värske)." });
  // Struktuurne tõrge JA fallbackit pole → eristatud aus teade.
  if (structural) return NextResponse.json({ error: "Maa-ameti andmestruktuur võis muutuda — automaatne lugemine ebaõnnestus. Probleem on märgitud; kontrolli vajadusel Maa-ameti lehel käsitsi.", sourceIssue: true }, { status: 502 });
  return NextResponse.json({ error: "Maa-ameti päring ebaõnnestus (" + lastErr + ")" }, { status: 502 });
}
