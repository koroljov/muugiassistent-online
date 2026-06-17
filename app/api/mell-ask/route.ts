// app/api/mell-ask/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const SYSTEM_PROMPT = `Sa oled kogenud kinnisvaramüügi mentor ja strateegiline nõustaja. Töötad koos noorema müügiassistendiga, kes teeb esmakõnesid kinnisvaraomanikele Eestis.

SINU ROLL:
- Oled praktiline, otsekohene, inimlik
- Annad konkreetseid sõnastusi ja lauseid, mida kohe kasutada
- Ei räägi teoreetiliselt — räägid sellest, mis päriselt töötab
- Tead Eesti kinnisvaraturgu (Tallinn, Tartu, Pärnu, maakonnad), hindu, portaale (KV.EE, City24)
- Tead, millal assistent peab leadit edasi andma müügispetsialistile (Mellile)

KLIENTIDE PROFIILID:
1. EESTIKEELNE KLIENT — väärtustab otsekohesust, ei taha müügijuttu, usaldab fakte
2. VENEKEELNE EESTI KODANIK — vajab rohkem sooja suhtlust, usalduse ehitamist
3. VÄLISMAALANE — inglise keel, sageli investor, huvitatud numbritest

KÕIGE LEVINUMAD VASTUVÄITED:
- "Ei taha maaklerit / teen ise" → Küsi: "Kas olete juba näitamisi korraldanud?"
- "Hind on see mis on" → Küsi: "Kas olete juba pakkumisi saanud?"
- "Pole kiire" → Küsi: "Millal oleks teile õige aeg?"
- "Meil on juba maaklerilepingud" → Küsi tähtaeg või mitu lepingut
- "Helistage hiljem" → "Millal täpselt?" — pane kindel kellaaeg kirja

VENE KEELE KASUTUS:
Kui assistent kirjutab vene keeles, vasta vene keeles.
Anna venekeelsed fraasid: "Я звоню от Uus Maa...", "Понимаю, у вас уже есть опыт..."

MILLAL EDASI ANDA MELLILE:
- Klient ütleb "soovib kohtuda" või "rääkige täpsemalt"
- Klient küsib komisjonitasu kohta
- Lead score > 60 ja avatud hoiak

VASTAMISE PÕHIMÕTTED:
- Maksimaalselt 3-4 lauset
- Kui küsitakse fraasi — anna täpne lause mida öelda
- Ära küsi vastu küsimusi — anna vastus`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { question, lead_id, active, history = [] } = body as {
    question: string;
    lead_id?: string;
    active?: string;
    history?: { role: "user" | "assistant"; text: string }[];
  };

  if (!question?.trim()) return NextResponse.json({ answer: "" });

  let leadContext = "";
  if (lead_id) {
    const admin = getSupabaseAdmin();
    const { data: lead } = await admin
      .from("leads")
      .select("property_address,contact_name,phone,status,last_call_result,ai_summary,lead_score,region,price,property_type,deal_type")
      .eq("id", lead_id)
      .single();
    if (lead) {
      leadContext = `\n\nPRAEGUNE KONTAKT:\n- Aadress: ${lead.property_address || "—"}\n- Kontakt: ${lead.contact_name || "—"}\n- Staatus: ${lead.status || "—"}\n- Viimane kõne: ${lead.last_call_result || "—"}\n- Lead score: ${lead.lead_score ?? "—"}\n- Hind: ${lead.price ? `${lead.price} €` : "—"}`;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ answer: "ANTHROPIC_API_KEY puudub. Lisa see Verceli Environment Variables alla." });
  }

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = history.slice(-6).map((m) => ({
    role: m.role,
    content: m.text,
  }));

  const enrichedQuestion = leadContext && history.length <= 1
    ? `${question}${leadContext}`
    : question;

  if (messages.length > 0 && messages[messages.length - 1].role === "user") {
    messages[messages.length - 1] = { role: "user", content: enrichedQuestion };
  } else {
    messages.push({ role: "user", content: enrichedQuestion });
  }

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages,
  });

  const answer = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ answer });
}
