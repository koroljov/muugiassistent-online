// AJUTINE EHR-i avastus-endpoint. Server kutsub EHR avaandmete API-t ja tagastab vastuse LOETAVALT (HTML <pre>),
// et Claude saaks web_fetch'iga näha tegelikku JSON-kuju (web_fetch ei tagasta toore JSON-i keha).
// EEMALDADA pärast EHR-i päris-endpointi ehitamist.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CANDIDATES = [
  "https://livekluster.ehr.ee/api/av/v1/params/ad/1",
  "https://livekluster.ehr.ee/api/avaandmed/v1/ehitis",
  "https://livekluster.ehr.ee/api/av/v1/ehitis",
  "https://livekluster.ehr.ee/api/av/v1/openapi.json",
  "https://livekluster.ehr.ee/api/av/v1",
  "https://livekluster.ehr.ee/api/av/v1/ehitis_kehtiv?aadress=Kungla%20tn%205a%2C%20Tallinn",
];

export async function GET() {
  const out: string[] = [];
  for (const url of CANDIDATES) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      const ct = r.headers.get("content-type") || "";
      let body = await r.text();
      if (body.length > 1500) body = body.slice(0, 1500) + "…[lõigatud]";
      out.push("URL: " + url + "\nSTATUS: " + r.status + " | CT: " + ct + "\nBODY:\n" + body + "\n" + "=".repeat(60));
    } catch (e: any) {
      out.push("URL: " + url + "\nVIGA: " + (e?.message || "tundmatu") + "\n" + "=".repeat(60));
    }
  }
  return new Response("<pre style='font:12px monospace;white-space:pre-wrap'>" + out.join("\n\n").replace(/</g, "&lt;") + "</pre>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
