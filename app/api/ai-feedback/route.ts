import { NextResponse } from "next/server";
import OpenAI from "openai";
import { canAccessLead, getCurrentUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { calculateLeadScore, nextBestAction } from "@/lib/scoring";
import type { Call, Lead } from "@/lib/types";

export async function POST(request: Request) {
  const formData = await request.formData();
  const leadId = String(formData.get("lead_id") || "");
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!(await canAccessLead(leadId, user.id))) return new NextResponse("Forbidden", { status: 403 });

  const admin = getSupabaseAdmin();
  const { data: leadData } = await admin.from("leads").select("*").eq("id", leadId).single();
  const lead = leadData as Lead | null;
  const { data: calls = [] } = await admin.from("calls").select("*").eq("lead_id", leadId).order("call_time", { ascending: false }).limit(3);
  if (!lead) return NextResponse.redirect(new URL("/", request.url));

  const lastCall = (calls as Call[])[0];
  const fallback = makeFallbackSummary(lead, lastCall);
  let summary = fallback;

  if (process.env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Koosta lühike praktiline AI tagasiside Eesti kinnisvara müügispetsialistile. Ära kirjuta pikka jutustust." },
        { role: "user", content: JSON.stringify({ lead, calls, previous_ai_summary: lead.ai_summary }) }
      ],
      temperature: 0.2
    });
    summary = response.choices[0]?.message?.content || fallback;
  }

  const score = calculateLeadScore(lead, lastCall);
  const nextAction = nextBestAction(lead, lastCall);
  await admin.from("leads").update({ ai_summary: summary, ai_summary_at: new Date().toISOString(), lead_score: score, next_best_action: nextAction }).eq("id", leadId);
  await admin.from("summaries").insert({ lead_id: leadId, call_id: lastCall?.id, generated_by: user.id, summary, recommended_next_step: nextAction });

  return NextResponse.redirect(new URL(`/?view=call&lead=${leadId}`, request.url));
}

function makeFallbackSummary(lead: Lead, call?: Call) {
  return `Olukord:
${lead.property_address}. Viimane kõne tulemus: ${call?.call_result || lead.last_call_result || "puudub"}.

Takistus:
${call?.obstacle || "Täpsustamata."}

Hoiak:
${call?.attitude || "Täpsustamata."}

Miks rääkima jäi:
${call?.talk_reason || "Pole veel teada."}

Potentsiaal:
${(lead.lead_score || 20) >= 60 ? "Tasub edasi tegeleda." : "Vajab ettevaatlikku lähenemist."}

Järgmine samm:
${call?.next_step || lead.next_best_action || "Tee lühike nõuandev järelkontakt."}

Soovitatud lähenemine:
Rahulik, nõuandev ja mitte survestav.

Risk:
Ära alusta teenustasust ega klassikalisest maaklerimüügist.

Mida mitte teha:
Ära vaidle ega suru teenust peale.`;
}
