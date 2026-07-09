// app/api/share-ask/route.ts
// Omaniku-vaate küsimused: token -> kureeritud objekti andmed + turg -> AI vastus.
// EI kasuta telefoni, e-posti, kontaktinime, märkmeid ega muud sisemist. AntiHallu.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const OWNER_SYSTEM = `Sa oled Uus Maa kinnisvaramaakleri abiline, kes vastab kinnisvara OMANIKULE tema enda objekti kohta. Toon: rahulik, aus, selge, professionaalne - nagu maakler ise selgitaks.
REEGLID:
- Pohine AINULT antud objekti andmetel ja piirkonna turustatistikal. ARA leiuta fakte, numbreid ega sundmusi (vaatamiste arv, pakkumised), mida pole antud.
- Kui midagi pole andmetes, utle ausalt, et tapsemat infot annab maakler. Ara spekuleeri.
- Selgita turupositsiooni ausalt: kui hind on ule piirkonna mediaani, utle seda rahulikult ja mida see tahendab muugikiirusele.
- Ara anna siduvat juriidilist ega maksunou; suuna maakleri poole.
- Luhike: 2-4 lauset. Eesti keeles (voi vene/inglise, kui kusitakse).
- Ara maini sisemisi markmeid, telefoni, teisi kliente ega muugitaktikat.`;

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  const token = String(body.token || "").trim();
  const question = String(body.question || "").trim().slice(0, 500);
  if (!token) return NextResponse.json({ error: "token puudub" }, { status: 400 });
  if (!question) return NextResponse.json({ answer: "" });

  const admin = getSupabaseAdmin();
  const { data: sh } = await admin.from("object_shares").select("lead_id").eq("token", token).maybeSingle();
  if (!sh) return NextResponse.json({ error: "Linki ei leitud." }, { status: 404 });

  const { data: l } = await admin
    .from("leads")
    .select("property_type,property_address,asum,district,county,price,area,plot_area,rooms,floor,build_year,condition,energy_label,deal_type")
    .eq("id", sh.lead_id)
    .maybeSingle();
  if (!l) return NextResponse.json({ error: "Objekti ei leitud." }, { status: 404 });

  let market: any = null;
  const pt = l.property_type || "";
  if (/korter/i.test(pt) || pt === "") {
    const cands = [l.asum, l.district].filter(Boolean).map((s: any) => String(s).trim());
    for (const c of cands) {
      for (const suf of [" asum", " linnaosa"]) {
        const { data: mp } = await admin.from("market_prices")
          .select("median_eur_m2,tx_count")
          .eq("county", "Harju maakond").eq("municipality", "").eq("district", c + suf)
          .eq("property_type", "T13").gt("tx_count", 4)
          .order("period_end", { ascending: false }).limit(1).maybeSingle();
        if (mp && Number(mp.median_eur_m2) > 0) { market = { median: Math.round(Number(mp.median_eur_m2)), tx: mp.tx_count }; break; }
      }
      if (market) break;
    }
  }

  const facts = [
    `Tuup: ${l.property_type || "?"}`,
    `Aadress: ${l.property_address || "?"}`,
    `Tehing: ${l.deal_type === "uur" ? "uur" : "muuk"}`,
    `Hind: ${l.price != null ? l.price + " EUR" : "?"}`,
    `Uldpind: ${l.area != null ? l.area + " m2" : "?"}`,
    `Tube: ${l.rooms ?? "?"}`,
    `Korrus: ${l.floor || "?"}`,
    `Ehitusaasta: ${l.build_year || "?"}`,
    `Seisukord: ${l.condition || "?"}`,
    `Energiaklass: ${l.energy_label || "?"}`,
    (l.price && l.area) ? `Objekti EUR/m2: ${Math.round(l.price / l.area)}` : null,
    market ? `Piirkonna mediaan: ${market.median} EUR/m2 (${market.tx} tehingut, Maa-amet)` : null,
  ].filter(Boolean).join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ answer: "Vabandust, teenus pole hetkel saadaval - votke uhendust maakleriga." });

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system: OWNER_SYSTEM + "\n\nOBJEKTI ANDMED (ainult need):\n" + facts,
      messages: [{ role: "user", content: question }],
    });
    const answer = resp.content[0].type === "text" ? resp.content[0].text : "";
    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json({ answer: "Vabandust, ei saanud praegu vastata - proovige hiljem voi kusige maaklerilt." });
  }
}
