import type { Call, Lead } from "./types";

export function calculateLeadScore(lead: Lead, call?: Partial<Call> | null) {
  let score = 20;
  if (lead.no_brokers_note === "jah") score -= 5;
  if (lead.status === "suunatud müügispetsialistile") score += 35;
  if (lead.status === "soovib müügispetsialisti kõnet") score += 35;
  if (lead.status === "pigem avatud") score += 25;
  if (lead.status === "vajab järelkõnet") score += 18;
  if (!call) return clamp(score);
  if (call.specialist_contact === "jah") score += 30;
  if (call.specialist_contact === "hiljem" || call.specialist_contact === "vajab järelkõnet") score += 15;
  if (call.attitude === "avatud") score += 25;
  if (call.attitude === "pigem avatud") score += 18;
  if (call.attitude === "neutraalne") score += 8;
  if (call.attitude === "ei soovi" || call.attitude === "ärritunud / tõrjuv") score -= 20;
  if (call.time_on_market === "3–6 kuud" || call.time_on_market === "üle 6 kuu") score += 10;
  if (call.obstacle === "hind" || call.obstacle === "nõrk esitlus" || call.obstacle === "kuulutuse tekst") score += 6;
  return clamp(score);
}

export function nextBestAction(lead: Lead, call?: Partial<Call> | null) {
  if (!call) return "Ava kõne ja kaardista müügiolukord.";
  if (lead.status === "suunatud müügispetsialistile" || call.specialist_contact === "jah") return "Müügispetsialist võiks helistada nõuandva avanguga.";
  if (call.call_result === "ei vastanud") return "Tee järelkõne või saada lühike SMS.";
  if (lead.status === "vajab järelkõnet" || call.specialist_contact === "hiljem") return "Tee kokkulepitud ajal järelkõne ja viita eelmisele vestlusele.";
  if (["hind", "kuulutuse tekst", "nõrk esitlus", "pildid"].includes(call.obstacle || "")) return "Paku kuulutuse, hinna ja esitluse neutraalset ülevaatust.";
  if (call.attitude === "pigem avatud" || call.attitude === "neutraalne") return "Küsi luba saata müügispetsialisti teine vaade.";
  return "Lisa täpne järgmine samm pärast kõnet.";
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 100);
}
