// app/api/ehr/route.ts
// Ehitisregistri (EHR) ehitise faktid hinnastamiseks. TASUTA avaandmete API (ei vaja võtit, ei maksa).
// Aadress → in-ADS annab EHR koodi (tunnus) → EHR buildingData → parsi faktid. Cache ehr_buildings tabelisse.
// Põhimõte: EHR on AMETLIK viide, EI kirjuta üle kuulutuse/kasutaja andmeid (seda teeb klient — siin ainult tagastus).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const EHR_BASE = "https://livekluster.ehr.ee/api/building";
const FRESH_MS = 180 * 24 * 3600 * 1000;

function num(v: any): number | null { if (v == null || v === "") return null; const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; }
function yr(v: any): number | null { if (!v) return null; const m = String(v).match(/(\d{4})/); if (!m) return null; const y = parseInt(m[1], 10); return y >= 1700 && y <= 2100 ? y : null; }

// in-ADS aadress → { ehrCode (hoone tunnus), aptNr, address }
async function resolveEhrCode(addressRaw: string): Promise<{ ehrCode: string; aptNr: string; address: string } | null> {
  async function look(q: string): Promise<any[]> {
    try { const r = await fetch("https://inaadress.maaamet.ee/inaadress/gazetteer?address=" + encodeURIComponent(q) + "&results=5", { signal: AbortSignal.timeout(8000) }); const j = await r.json(); return j.addresses || []; } catch { return []; }
  }
  const list = await look(addressRaw);
  let hit = list[0];
  let aptNr = hit?.kort_nr || "";
  let address = hit?.ipikkaadress || hit?.taisaadress || addressRaw;
  let ehrCode = hit?.tunnus || "";
  // Korteri aadressil on tunnus tühi → küsi hoone (eemalda korterinumber)
  if (!ehrCode) {
    const noApt = addressRaw.replace(/\s*-\s*\d+\w?(?=\s*,|\s*$)/, "");
    const street = (hit?.liikluspind && hit?.aadress_nr) ? (hit.liikluspind + " " + hit.aadress_nr + ", " + (hit.omavalitsus || "")) : noApt;
    const bl = await look(street);
    const b = bl.find((x: any) => x.tunnus) || bl[0];
    if (b?.tunnus) { ehrCode = b.tunnus; if (!address) address = b.ipikkaadress; }
  }
  if (!ehrCode) return null;
  return { ehrCode, aptNr, address };
}

function parseBuilding(j: any): any {
  const e = j?.ehitis || {};
  const p = e.ehitisePohiandmed || {};
  const a = e.ehitiseAndmed || {};
  const energ = e.ehitiseEnergiamargised?.energiamargis || [];
  const kat = e.ehitiseKatastriyksused?.ehitiseKatastriyksus || [];
  const kuju = e.ehitiseKujud?.ruumikuju || [];
  // korterid/osad
  const apts: any[] = [];
  (e.ehitiseKehand?.kehand || []).forEach((k: any) => (k?.ehitiseOsad?.ehitiseOsa || []).forEach((o: any) => apts.push({
    nr: o.tahis || null, kood: o.osa_kood || null, liik: o.liikTxt || null, otstarve: o.kaosNimetus || null, pind: num(o?.ehitiseOsaPohiandmed?.pind),
  })));
  const em = energ[0] || {};
  return {
    ehr_code: a.ehrKood || (kuju[0] && kuju[0].ehrKood) || null,
    address: a.taisaadress || null,
    build_year: yr(p.ehAlustKp) || yr(p.ajehKasutalgKp) || yr(a.esmaneKasutus) || yr(p.kavKasutusKp) || null,
    floors: p.maxKorrusteArv != null ? parseInt(p.maxKorrusteArv, 10) : null,
    net_area: num(p.suletud_netopind),
    footprint_area: num(p.ehitisalunePind),
    volume: num(p.mahtBruto),
    use_purpose: a.kaosIdTxt || (e.ehitiseKasutusotstarbed?.kasutusotstarve?.[0]?.kaosIdTxt) || null,
    energy_class: em.energiaKlass || em.klass || em.margisTxt || null,
    lift: p.lift != null ? (String(p.lift) === "1") : null,
    cadastral: kat[0]?.katastritunnus || null,
    building_type: a.nimetus || a.rajatishoonetxt || null,
    status: a.seisundTxt || null,
    apts,
  };
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit("ehr:" + auth.user.id, 30, 60000)) return NextResponse.json({ error: "Liiga palju päringuid. Oota hetk." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  let ehrCode = (body?.ehrCode || "").toString().trim();
  let aptNr = (body?.aptNr || "").toString().trim();
  const address = (body?.address || "").toString().trim();

  // 1) Lahenda aadress → EHR kood (kui koodi pole)
  if (!ehrCode && address) {
    const res = await resolveEhrCode(address);
    if (!res) return NextResponse.json({ found: false, message: "Aadressile ei leitud Ehitisregistri koodi." });
    ehrCode = res.ehrCode; if (!aptNr) aptNr = res.aptNr;
  }
  if (!ehrCode) return NextResponse.json({ error: "Anna ehrCode või address", needs: "address" }, { status: 422 });

  // 2) Cache
  const { data: cached } = await admin.from("ehr_buildings").select("*").eq("ehr_code", ehrCode).maybeSingle();
  let building: any;
  if (cached && cached.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
    building = cached;
  } else {
    // 3) EHR live (tasuta)
    try {
      const r = await fetch(EHR_BASE + "/v3/buildingData?ehr_code=" + encodeURIComponent(ehrCode), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) {
        if (cached) building = cached; // vana cache parem kui mitte midagi
        else return NextResponse.json({ found: false, message: "Ehitisregister ei vastanud (kood " + ehrCode + ").", status: r.status });
      } else {
        const j = await r.json();
        const parsed = parseBuilding(j);
        const row: any = {
          ehr_code: ehrCode, address: parsed.address, build_year: parsed.build_year, floors: parsed.floors,
          net_area: parsed.net_area, footprint_area: parsed.footprint_area, volume: parsed.volume,
          use_purpose: parsed.use_purpose, energy_class: parsed.energy_class, lift: parsed.lift,
          cadastral: parsed.cadastral, building_type: parsed.building_type, status: parsed.status,
          apts: parsed.apts, raw: null, fetched_at: new Date().toISOString(),
        };
        await admin.from("ehr_buildings").upsert(row, { onConflict: "ehr_code" });
        building = row;
      }
    } catch (e: any) {
      if (cached) building = cached;
      else return NextResponse.json({ found: false, message: "Ehitisregistri päring ebaõnnestus: " + (e?.message || "viga") });
    }
  }

  // 4) Korteri pind (kui eluruumi-osa olemas ja number klapib)
  let apt: any = null;
  const apts: any[] = building.apts || [];
  if (aptNr) {
    const elu = apts.filter((o: any) => /eluruum/i.test(o.liik || ""));
    const match = elu.find((o: any) => String(o.nr) === String(aptNr));
    if (match) apt = { nr: aptNr, pind: match.pind };
    else if (elu.length === 0 && apts.length > 0) apt = { nr: aptNr, pind: null, note: "EHR-is pole eluruumi-osa (hoone tüüp: " + (building.use_purpose || building.building_type || "?") + ")" };
  }

  return NextResponse.json({
    found: true, source: cached && building === cached ? "cache" : "fresh",
    ehrCode, building: {
      address: building.address, build_year: building.build_year, floors: building.floors,
      net_area: building.net_area, footprint_area: building.footprint_area, volume: building.volume,
      use_purpose: building.use_purpose, energy_class: building.energy_class, lift: building.lift,
      cadastral: building.cadastral, building_type: building.building_type, status: building.status,
      apt_count: apts.length,
    }, apt,
  });
}
