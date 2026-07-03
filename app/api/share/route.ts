// app/api/share/route.ts
// Avalik omaniku-vaade: token → kureeritud objekti andmed (EI lekita telefoni, e-posti, märkmeid, omanikku).
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ error: "token puudub" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: sh } = await admin.from("object_shares").select("lead_id").eq("token", token).maybeSingle();
  if (!sh) return NextResponse.json({ error: "Linki ei leitud." }, { status: 404 });

  const { data: l } = await admin
    .from("leads")
    .select("property_type,property_address,asum,district,county,price,area,plot_area,rooms,floor,build_year,condition,energy_label,listing_text,photos,img_url")
    .eq("id", sh.lead_id)
    .maybeSingle();
  if (!l) return NextResponse.json({ error: "Objekti ei leitud." }, { status: 404 });

  let market: any = null;
  const pt = (l.property_type || "");
  if (/korter/i.test(pt) || pt === "") {
    const cands = [l.asum, l.district].filter(Boolean).map((s: any) => String(s).trim());
    for (const c of cands) {
      for (const suf of [" asum", " linnaosa"]) {
        const { data: mp } = await admin.from("market_prices")
          .select("median_eur_m2,tx_count,district")
          .eq("county", "Harju maakond").eq("municipality", "").eq("district", c + suf)
          .eq("property_type", "T13").gt("tx_count", 4)
          .order("period_end", { ascending: false }).limit(1).maybeSingle();
        if (mp && Number(mp.median_eur_m2) > 0) { market = { median: Math.round(Number(mp.median_eur_m2)), tx: mp.tx_count, area: mp.district }; break; }
      }
      if (market) break;
    }
  }

  return NextResponse.json({
    ok: true,
    object: l,
    market,
    agent: { name: "Meelis Koroljov", phone: "+372 53 441 365", email: "meelis.koroljov@uusmaa.ee", org: "Uus Maa" },
  });
}
