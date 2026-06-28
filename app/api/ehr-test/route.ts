// AJUTINE EHR-test (Kalma tn 5-18). Eemaldada pärast EHR päris-endpointi. Tagastab loetava teksti (web_fetch sõbralik).
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function around(hay: string, needle: string, pad = 700): string {
  const i = hay.indexOf(needle);
  if (i < 0) return "(' " + needle + " ' ei leitud)";
  return hay.slice(Math.max(0, i - 100), i + pad);
}

export async function GET() {
  const out: string[] = [];
  const log = (t: string) => out.push(t + "\n" + "=".repeat(60));

  // 1) in-ADS aadress
  try {
    const r = await fetch("https://inaadress.maaamet.ee/inaadress/gazetteer?address=" + encodeURIComponent("Kalma tn 5, Tallinn") + "&results=5&ihist=1", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    log("IN-ADS Kalma tn 5:\n" + JSON.stringify((j.addresses || []).slice(0, 5), null, 1).slice(0, 1800));
  } catch (e: any) { log("IN-ADS VIGA: " + (e?.message || "?")); }

  // 2) EHR OpenAPI spec — buildingSearch body + buildingData
  for (const base of ["https://livekluster.ehr.ee/api/building/v3/api-docs", "https://livekluster.ehr.ee/api/building/v2/api-docs", "https://livekluster.ehr.ee/api/building/openapi.json"]) {
    try {
      const r = await fetch(base, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      const t = await r.text();
      log("SPEC " + base + " STATUS " + r.status + " len=" + t.length + "\nbuildingSearch:\n" + around(t, "buildingSearch", 900) + "\n\nbSearchPostRequest:\n" + around(t, "bSearchPostRequest", 1400));
      if (r.status === 200 && t.length > 200) break;
    } catch (e: any) { log("SPEC " + base + " VIGA: " + (e?.message || "?")); }
  }

  // 3) buildingSearch POST proov (mitu keha-kuju)
  const bodies: any[] = [
    { taisAadress: "Kalma tn 5, Tallinn" },
    { aadress: "Kalma tn 5" },
    { vald: "Tallinn", tanav: "Kalma", maja: "5" },
  ];
  for (const b of bodies) {
    try {
      const r = await fetch("https://livekluster.ehr.ee/api/building/v2/buildingSearch", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(b), signal: AbortSignal.timeout(8000),
      });
      let t = await r.text(); if (t.length > 1500) t = t.slice(0, 1500) + "…";
      log("buildingSearch body=" + JSON.stringify(b) + " STATUS " + r.status + "\n" + t);
    } catch (e: any) { log("buildingSearch " + JSON.stringify(b) + " VIGA: " + (e?.message || "?")); }
  }

  return new Response("<pre style='white-space:pre-wrap'>" + out.join("\n\n").replace(/</g, "&lt;") + "</pre>", { headers: { "content-type": "text/html; charset=utf-8" } });
}
