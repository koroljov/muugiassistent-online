// AJUTINE EHR-test 4: korter Kalma tn 5-18 (in-ADS + EHR osad). Eemaldada pärast.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const out: string[] = [];
  const log = (t: string) => out.push(t + "\n" + "=".repeat(60));

  // 1) in-ADS korter 5-18
  try {
    const r = await fetch("https://inaadress.maaamet.ee/inaadress/gazetteer?address=" + encodeURIComponent("Kalma tn 5-18, Tallinn") + "&results=5", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    log("IN-ADS Kalma tn 5-18:\n" + JSON.stringify((j.addresses || []).slice(0, 3), null, 1).slice(0, 2500));
  } catch (e: any) { log("IN-ADS VIGA: " + (e?.message || "?")); }

  // 2) EHR hoone osad (kõik) — kas korter 18 olemas?
  try {
    const r = await fetch("https://livekluster.ehr.ee/api/building/v3/buildingData?ehr_code=101023426", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    const j: any = await r.json();
    const osad: any[] = [];
    const kehand = j?.ehitis?.ehitiseKehand?.kehand || [];
    kehand.forEach((k: any) => (k?.ehitiseOsad?.ehitiseOsa || []).forEach((o: any) => osad.push({ ehrKood: o.ehrKood, tahis: o.tahis, liikTxt: o.liikTxt, kaosNimetus: o.kaosNimetus, pind: o?.ehitiseOsaPohiandmed?.pind })));
    log("EHR Kalma 5 OSAD (" + osad.length + "):\n" + JSON.stringify(osad, null, 1).slice(0, 3000));
  } catch (e: any) { log("EHR osad VIGA: " + (e?.message || "?")); }

  return new Response("<pre style='white-space:pre-wrap'>" + out.join("\n\n").replace(/</g, "&lt;") + "</pre>", { headers: { "content-type": "text/html; charset=utf-8" } });
}
