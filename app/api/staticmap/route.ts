// app/api/staticmap/route.ts
// MOODUL 1B — asukohakaart. Mapbox Static Images API proxy.
// Võti (process.env.MAP_BOX) jääb serverisse — brauser ei näe seda kunagi.
// Avalik endpoint (img src ei saa Authorization-päist saata), aga IP-rate-limit + Eesti-koordinaatide
// piir hoiavad kuritarvituse ja Mapboxi kvoodi raisu eemal.
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  if (!rateLimit("staticmap:" + ip, 60, 60000)) {
    return new Response("Liiga palju päringuid", { status: 429 });
  }

  const token = process.env.MAP_BOX;
  if (!token) return new Response("Kaarditeenuse võti puudub (MAP_BOX)", { status: 500 });

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const zoom = Math.min(18, Math.max(3, parseInt(searchParams.get("zoom") || "14", 10)));

  // Eesti piirides — lihtne kuritarvituse tõke
  if (!isFinite(lat) || !isFinite(lng) || lat < 57 || lat > 60 || lng < 21 || lng > 29) {
    return new Response("Vigased koordinaadid", { status: 400 });
  }

  const w = 640, h = 360;
  const la = lat.toFixed(5), ln = lng.toFixed(5);
  const marker = `pin-l+2aa55e(${ln},${la})`;
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${ln},${la},${zoom}/${w}x${h}@2x` +
    `?access_token=${encodeURIComponent(token)}`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      return new Response("Kaarditeenus ei vastanud (" + r.status + ")", { status: 502 });
    }
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      headers: {
        "content-type": r.headers.get("content-type") || "image/png",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Kaardi laadimine ebaõnnestus", { status: 502 });
  }
}
