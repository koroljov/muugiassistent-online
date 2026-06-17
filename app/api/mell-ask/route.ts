// app/api/mell-ask/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const BASE_SYSTEM_PROMPT = `Sa oled kogenud kinnisvaramüügi mentor ja strateegiline nõustaja. Töötad koos müügiassistendiga, kes teeb esmakõnesid kinnisvaraomanikele Eestis.

SINU ROLL:
- Oled praktiline, otsekohene, inimlik
- Annad konkreetseid sõnastusi ja lauseid, mida kohe kasutada
- Ei räägi teoreetiliselt — räägid sellest, mis päriselt töötab
- Tead Eesti kinnisvaraturgu (Tallinn, Tartu, Pärnu, maakonnad), hindu, portaale (KV.EE, City24)
- Tead, millal assistent peab leadit edasi andma müügispetsialistile

KRIITILISED REEGLID:
- Põhine AINULT antud kontaktiandmetel. Ära väljamõtle ühtegi fakti kliendi, objekti või olukorra kohta.
- Kui andmeväli on "—" või puudub, ära spekulatseeri selle kohta. Ütle ainult see, mida tegelikult tead.
- Kui kontaktiandmed puuduvad täielikult, anna üldine nõuanne ilma konkreetseid detaile välja mõtlemata.
- Maksimaalselt 3-4 lauset vastuses.
- Kui küsitakse fraasi — anna täpne lause mida öelda.

KLIENTIDE PROFIILID:
1. EESTIKEELNE KLIENT — väärtustab otsekohesust, ei taha müügijuttu, usaldab fakte
2. VENEKEELNE EESTI KODANIK — vajab rohkem sooja suhtlust, usalduse ehitamist
3. VÄLISMAALANE — inglise keel, sageli investor, huvitatud numbritest

KÕIGE LEVINUMAD VASTUVÄITED:
- "Ei taha maaklerit / teen ise" → Küsi: "Kas olete juba näitamisi korraldanud?"
- "Hind on see mis on" → Küsi: "Kas olete juba pakkumisi saanud?"
- "Pole kiire" → Küsi: "Millal oleks teile õige aeg?"
- "Meil on juba maakleril" → Küsi tähtaeg
- "Helistage hiljem" → "Millal täpselt?" — pane kindel kellaaeg kirja

VENE KEELE KASUTUS:
Kui assistent kirjutab vene keeles, vasta vene keeles ja anna venekeelsed fraasid.

MILLAL EDASI ANDA MÜÜGISPETSIALISTILE:
- Klient ütleb "soovib kohtuda" või "rääkige täpsemalt"
- Klient küsib komisjonitasu kohta
- Lead score > 60 ja avatud hoiak`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { question, lead_id, history = [] } = body as {
    question: string;
    lead_id?: string;
    history?: { role: "user" | "assistant"; text: string }[];
  };

  if (!question?.trim()) return NextResponse.json({ answer: "" });

  let leadContext = "";
  if (lead_id) {
    const admin = getSupabaseAdmin();
    const { data: lead } = await admin
      .from("leads")
      .select("property_address,contact_name,phone,status,last_call_result,ai_summary,lead_score,region,price,property_type,deal_type,notes")
      .eq("id", lead_id)
      .single();
    if (lead) {
      const fields = [
        `Aadress: ${lead.property_address || "teadmata"}`,
        `Kontakt: ${lead.contact_name || "teadmata"}`,
        `Telefon: ${lead.phone || "teadmata"}`,
        `Staatus: ${lead.status || "teadmata"}`,
        `Viimane kõnetulemus: ${lead.last_call_result || "ei ole"}`,
        `Lead score: ${lead.lead_score ?? "pole arvutatud"}`,
        `Piirkond: ${lead.region || "teadmata"}`,
        `Hind: ${lead.price ? lead.price + " €" : "teadmata"}`,
        `Objekti tüüp: ${lead.property_type || "teadmata"}`,
        `Tehing: ${lead.deal_type || "teadmata"}`,
        lead.ai_summary ? `AI kokkuvõte: ${lead.ai_summary}` : null,
        lead.notes ? `Märkused: ${lead.notes}` : null,
      ].filter(Boolean);
      leadContext = `\n\nKONTAKTI ANDMED (kasuta ainult neid fakte):\n${fields.join("\n")}`;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ answer: "ANTHROPIC_API_KEY puudub. Lisa see Verceli Environment Variables alla." });
  }

  const client = new Anthropic({ apiKey });

  // Lead context läheb alati süsteempromtisse, mitte kasutaja küsimusesse
  const systemPrompt = leadContext
    ? BASE_SYSTEM_PROMPT + leadContext
    : BASE_SYSTEM_PROMPT;

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    })),
    { role: "user" as const, content: question },
  ];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: systemPrompt,
    messages,
  });

  const answer = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ answer });
}
