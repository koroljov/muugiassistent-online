import { NextResponse } from "next/server";
import OpenAI from "openai";
import { canAccessLead, getCurrentUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { Call, Lead } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const leadId = String(body.lead_id || "");
  const draft = body.draft || {};
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessLead(leadId, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getSupabaseAdmin();
  const { data: leadData } = await admin.from("leads").select("*").eq("id", leadId).single();
  const lead = leadData as Lead | null;
  const { data: calls = [] } = await admin.from("calls").select("*").eq("lead_id", leadId).order("call_time", { ascending: false }).limit(2);
  if (!lead) return NextResponse.json(fallbackCoach(draft));

  let coach = fallbackCoach(draft, lead, (calls as Call[])[0]);

  if (process.env.OPENAI_API_KEY && !hasDirectLiveSignal(draft, lead)) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Sa oled müügiassistendi kõne coach. Vasta ainult JSON kujul võtmetega next_question, suggested_response, risk. Ole väga lühike, praktiline, rahulik ja mitte survestav."
        },
        {
          role: "user",
          content: JSON.stringify({
            lead,
            latest_calls: calls,
            current_draft_answers: draft,
            goal: "Soovita üks järgmine küsimus ja üks rahulik reageerimisviis."
          })
        }
      ]
    });
    try {
      coach = JSON.parse(response.choices[0]?.message?.content || "{}");
    } catch {
      coach = fallbackCoach(draft, lead, (calls as Call[])[0]);
    }
  }

  return NextResponse.json({
    assessment: coach.assessment || "Praeguse info järgi tasub liikuda ühe rahuliku täpsustava küsimusega edasi.",
    next_question: coach.next_question || "Mis oleks teie jaoks kõige kasulikum järgmine samm?",
    suggested_response: coach.suggested_response || "Saan aru. Ma ei paku kohe teenust, vaid püüan aru saada, mis müüki takistab.",
    risk: coach.risk || "Ära suru teenust peale.",
    signal_summary: coach.signal_summary || selectedSignals(draft)
  });
}

function fallbackCoach(draft: Record<string, string>, lead?: Lead, call?: Call) {
  const signal_summary = selectedSignals(draft);
  const lastName = draft._last_changed_name || "";
  const lastValue = draft._last_changed_value || "";

  if (lastName === "obstacle" && ["pildid", "kuulutuse tekst", "nõrk esitlus"].includes(lastValue)) {
    return {
      signal_summary,
      assessment: "Viimane märge viitab esitluse probleemile. Seda on lihtne käsitleda madala survega, sest sa ei pea kohe teenust pakkuma.",
      next_question: "Kas oleksite avatud sellele, et keegi vaatab kuulutuse pildid ja teksti korraks neutraalselt üle?",
      suggested_response: "Mõnikord piisab väikestest esitluse muudatustest, et huvi paremini tööle saada.",
      risk: "Ära tee kuulutust maha, räägi neutraalsest teisest vaatest."
    };
  }
  if (lastName === "obstacle" && lastValue === "hind") {
    return {
      signal_summary,
      assessment: "Viimane märge on hind. Hoia toon neutraalne ja küsi ostjate tagasisidet, mitte ära anna hinnangut.",
      next_question: "Kas ostjatelt on tulnud tagasisidet, et hind on liiga kõrge, või on huvi lihtsalt vähe?",
      suggested_response: "Võime seda käsitleda neutraalse turuülevaatena, mitte hinnasurvena.",
      risk: "Ära ütle otse, et hind on vale."
    };
  }
  if (lastName === "no_help_reason" && lastValue === "teenustasu") {
    return {
      signal_summary,
      assessment: "Viimane märge on teenustasu. Selgita enne väärtuse hirm, ära kaitse hinda.",
      next_question: "Kas peamine mure on teenustasu suurus või hirm, et sellest ei teki lisaväärtust?",
      suggested_response: "Mõistan. Esmalt võiks vaadata, kas hind, kuulutus või esitlus üldse vajab muutmist.",
      risk: "Ära hakka teenustasu kaitsma enne, kui vajadus on selge."
    };
  }
  if (lastName === "specialist_contact" && lastValue === "jah") {
    return {
      signal_summary,
      assessment: "Viimane vastus on tugev nõusolek. Nüüd lukusta aeg või kanal.",
      next_question: "Milline aeg sobiks teile müügispetsialisti lühikeseks kõneks kõige paremini?",
      suggested_response: "Panen ainult sobiva aja kirja, spetsialist annab esmalt teise vaate ilma kohustuseta.",
      risk: "Ära jäta seda üldiseks lubaduseks, küsi aeg või kanal kohe üle."
    };
  }
  if (lastName === "attitude" && ["avatud", "pigem avatud"].includes(lastValue)) {
    return {
      signal_summary,
      assessment: "Viimane hoiak on soe. Küsi luba järgmiseks sammuks, mitte ära tee veel suurt pakkumist.",
      next_question: "Kas teile sobiks, kui müügispetsialist annaks esmalt ainult teise vaate kuulutusele ja hinnale?",
      suggested_response: "See ei tähenda kohustust teenust tellida.",
      risk: "Ära muuda vestlust liiga kiiresti müügipakkumiseks."
    };
  }
  if (hasValue(draft.call_result, "ei vastanud")) {
    return {
      signal_summary,
      assessment: "Kontakti ei saadud, seega ära tõlgenda seda vastuseisuna. Fookus on järgmisel katsel.",
      next_question: "Lisa järeltegevus: millal proovida uuesti helistada?",
      suggested_response: "Saada hiljem lühike SMS, et kõne eesmärk on müügiolukorra kaardistamine.",
      risk: "Ära tee liiga palju korduskõnesid samal päeval."
    };
  }
  if (hasValue(draft.specialist_contact, "jah")) {
    return {
      signal_summary,
      assessment: "See on tugev ostukoht: klient lubas kontakti, nüüd tuleb järgmine samm väga konkreetselt lukku panna.",
      next_question: "Milline aeg sobiks teile müügispetsialisti lühikeseks kõneks kõige paremini?",
      suggested_response: "Panen ainult sobiva aja kirja, spetsialist annab esmalt teise vaate ilma kohustuseta.",
      risk: "Ära jäta seda üldiseks lubaduseks, küsi aeg või kanal kohe üle."
    };
  }
  if (hasValue(draft.no_help_reason, "teenustasu")) {
    return {
      signal_summary,
      assessment: "Klient ei vaidle tingimata abi vastu, vaid kardab väärtuse ja kulu suhet.",
      next_question: "Kas peamine mure on teenustasu suurus või hirm, et sellest ei teki lisaväärtust?",
      suggested_response: "Mõistan. Esmalt võiks vaadata, kas hind, kuulutus või esitlus üldse vajab muutmist.",
      risk: "Ära hakka teenustasu kaitsma enne, kui vajadus on selge."
    };
  }
  if (hasValue(draft.obstacle, "hind")) {
    return {
      signal_summary,
      assessment: "Hind on tundlik teema. Parim tee on küsida ostjate tagasisidet, mitte öelda, et hind on vale.",
      next_question: "Kas ostjatelt on tulnud tagasisidet, et hind on liiga kõrge, või on huvi lihtsalt vähe?",
      suggested_response: "Võime seda käsitleda neutraalse turuülevaatena, mitte hinnasurvena.",
      risk: "Ära ütle otse, et hind on vale."
    };
  }
  if (hasValue(draft.obstacle, "pildid") || hasValue(draft.obstacle, "kuulutuse tekst") || hasValue(draft.obstacle, "nõrk esitlus")) {
    return {
      signal_summary,
      assessment: "See on hea võimalus pakkuda madala survega abi, sest probleem võib olla kuulutuse esitluses, mitte kliendi tahtes.",
      next_question: "Kas oleksite avatud sellele, et keegi vaatab kuulutuse pildid ja teksti korraks neutraalselt üle?",
      suggested_response: "Mõnikord piisab väikestest esitluse muudatustest, et huvi paremini tööle saada.",
      risk: "Ära tee kuulutust maha, räägi neutraalsest teisest vaatest."
    };
  }
  if (hasValue(draft.attitude, "avatud") || hasValue(draft.attitude, "pigem avatud")) {
    return {
      signal_summary,
      assessment: "Hoiak on piisavalt soe, et küsida luba järgmiseks sammuks, aga mitte veel müügipakkumiseks.",
      next_question: "Kas teile sobiks, kui müügispetsialist annaks esmalt ainult teise vaate kuulutusele ja hinnale?",
      suggested_response: "See ei tähenda kohustust teenust tellida.",
      risk: "Ära muuda vestlust liiga kiiresti müügipakkumiseks."
    };
  }
  if (lead?.no_brokers_note === "jah") {
    return {
      signal_summary,
      assessment: "Kuulutuse märge viitab kaitsehoiakule. Esmalt tuleb mõista põhjust, mitte müüa teenust.",
      next_question: "Kas “maakleritel palun mitte tülitada” tuli pigem varasemast kogemusest, kõnede rohkusest või soovist ise müüa?",
      suggested_response: "Küsin seda ainult selleks, et mõista, mitte vaielda.",
      risk: "Ole eriti rahulik ja ära kasuta sõna maaklerteenus liiga vara."
    };
  }
  return {
    signal_summary,
    assessment: "Info on veel üldine. Järgmine küsimus peaks avama ühe konkreetse takistuse.",
    next_question: call?.obstacle ? "Kas see takistus on teie hinnangul lahendatav hinna, esitluse või müügiloogika muutmisega?" : "Mis on teie hinnangul praegu müügi kõige suurem takistus?",
    suggested_response: "Saan aru. Panen selle kirja, et hiljem oleks võimalik olukorda täpsemalt hinnata.",
    risk: "Ära vaidle kliendi hinnanguga."
  };
}

function hasDirectLiveSignal(draft: Record<string, string>, lead?: Lead) {
  return Boolean(
    hasValue(draft.call_result, "ei vastanud") ||
    hasValue(draft.no_help_reason, "teenustasu") ||
    hasValue(draft.obstacle, "hind") ||
    hasValue(draft.obstacle, "pildid") ||
    hasValue(draft.obstacle, "kuulutuse tekst") ||
    hasValue(draft.obstacle, "nõrk esitlus") ||
    hasValue(draft.attitude, "avatud") ||
    hasValue(draft.attitude, "pigem avatud") ||
    hasValue(draft.specialist_contact, "jah") ||
    lead?.no_brokers_note === "jah"
  );
}

function hasValue(value: string | undefined, option: string) {
  return String(value || "").split(",").map((item) => item.trim()).includes(option);
}

function selectedSignals(draft: Record<string, string>) {
  const labels: Record<string, string> = {
    call_result: "Tulemus",
    attitude: "Hoiak",
    obstacle: "Takistus",
    no_help_reason: "Ei soovi abi",
    talk_reason: "Rääkima jäi",
    specialist_contact: "Spetsialist",
    next_action: "Järgmine"
  };
  return Object.entries(labels)
    .map(([key, label]) => draft[key] ? `${label}: ${draft[key]}` : "")
    .filter(Boolean)
    .join(" · ");
}
