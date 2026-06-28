// AJUTINE EHR-test 3 (Kalma tn 5 → ehr_code 101023426 → buildingData). Eemaldada pärast.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const out: string[] = [];
  const log = (t: string) => out.push(t + "\n" + "=".repeat(60));
  const ehr = "101023426";
  for (const url of [
    "https://livekluster.ehr.ee/api/building/v3/buildingData?ehr_code=" + ehr,
    "https://livekluster.ehr.ee/api/building/v2/buildingData?ehr_code=" + ehr,
  ]) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
      let t = await r.text();
      if (t.length > 8000) t = t.slice(0, 8000) + "…[lõigatud]";
      log("GET " + url + "\nSTATUS " + r.status + "\n" + t);
    } catch (e: any) { log("GET " + url + " VIGA: " + (e?.message || "?")); }
  }
  return new Response("<pre style='white-space:pre-wrap'>" + out.join("\n\n").replace(/</g, "&lt;") + "</pre>", { headers: { "content-type": "text/html; charset=utf-8" } });
}
