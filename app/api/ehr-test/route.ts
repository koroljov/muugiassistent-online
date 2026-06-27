// AJUTINE EHR-i avastus-proksi (ainult *.ehr.ee). Eemaldada pärast EHR päris-endpointi.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") || "";
  if (!/^https:\/\/[a-z0-9.-]+\.ehr\.ee\//i.test(u)) {
    return new Response("<pre>Anna ?u=https://...ehr.ee/... (ainult ehr.ee lubatud)</pre>", { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  try {
    const r = await fetch(u, { headers: { accept: "application/json, text/html" }, signal: AbortSignal.timeout(12000) });
    const ct = r.headers.get("content-type") || "";
    let body = await r.text();
    if (body.length > 6000) body = body.slice(0, 6000) + "\n…[lõigatud]";
    return new Response("<pre style='white-space:pre-wrap'>STATUS: " + r.status + " | CT: " + ct + "\n\n" + body.replace(/</g, "&lt;") + "</pre>", { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e: any) {
    return new Response("<pre>VIGA: " + (e?.message || "?") + "</pre>", { headers: { "content-type": "text/html; charset=utf-8" } });
  }
}
