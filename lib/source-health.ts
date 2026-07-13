// lib/source-health.ts
// Andmeallikate tervis (Seaded → Andmeallikate tervis / tervise-riba).
// Iga API-route raporteerib: ok = allikas vastas, degraded = allikas vastas veaga.
// Reegel: tervise raport EI TOHI KUNAGI katkestada põhivastust (try/catch + throttle).
import { getSupabaseAdmin } from "@/lib/supabase-server";

const GAP_MS = 60000; // sama allika sama staatust ei kirjuta tihedamini kui kord minutis (instantsi kohta)
const last: Record<string, { status: string; at: number }> = {};

export async function reportHealth(source: string, status: "ok" | "degraded", detail?: string | null) {
  try {
    const prev = last[source];
    const now = Date.now();
    if (prev && prev.status === status && now - prev.at < GAP_MS) return;
    last[source] = { status, at: now };
    await getSupabaseAdmin()
      .from("source_health")
      .upsert(
        { source, status, detail: detail ? String(detail).slice(0, 300) : null, checked_at: new Date().toISOString() },
        { onConflict: "source" }
      );
  } catch {
    // teadlikult vaikne — tervise raport on kõrvalprodukt
  }
}
