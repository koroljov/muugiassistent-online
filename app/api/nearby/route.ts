// app/api/nearby/route.ts
// MOODUL 1B-2 — lähedalasuvad objektid (POI) OpenStreetMap Overpass'ist (võtmeta, tasuta).
// Kategooriad: kool, lasteaed, pood, peatus, veekogu. Tagastab nimega + kaugusega, kategooria kaupa.
// Avalik + IP-rate-limit + Eesti-koordinaatide piir. Overpass on jagatud ressurss → hoia mahud väiksed.
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OVERPASS = "https://overpass-api.de/api/interpreter";

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function categorize(tags: Record<string, string>): string | null {
  if (!tags) return null;
  if (tags.amenity === "school") return "kool";
  if (tags.amenity === "kindergarten") return "lasteaed";
  if (tags.shop && /supermarket|convenience|grocery|general|mall/.test(tags.shop)) return "pood";
  if (tags.highway === "bus_stop" || tags.public_transport === "platform" || tags.railway === "tram_stop") return "peatus";
  if (tags.natural === "water" || tags.waterway || tags.leisure === "marina") return "veekogu";
  return null;
}

export async function GET(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  if (!rateLimit("nearby:" + ip, 20, 60000)) {
    return Response.json({ error: "Liiga palju päringuid" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const radius = Math.min(2500, Math.max(300, parseInt(searchParams.get("r") || "1200", 10)));
  if (!isFinite(lat) || !isFinite(lng) || lat < 57 || lat > 60 || lng < 21 || lng > 29) {
    return Response.json({ error: "Vigased koordinaadid" }, { status: 400 });
  }

  const q = `[out:json][timeout:25];(
    node["amenity"="school"](around:${radius},${lat},${lng});
    way["amenity"="school"](around:${radius},${lat},${lng});
    node["amenity"="kindergarten"](around:${radius},${lat},${lng});
    way["amenity"="kindergarten"](around:${radius},${lat},${lng});
    node["shop"~"supermarket|convenience|grocery|general|mall"](around:${radius},${lat},${lng});
    node["highway"="bus_stop"](around:${radius},${lat},${lng});
    node["public_transport"="platform"](around:${radius},${lat},${lng});
    node["railway"="tram_stop"](around:${radius},${lat},${lng});
    node["natural"="water"](around:${radius},${lat},${lng});
    way["natural"="water"](around:${radius},${lat},${lng});
    way["waterway"](around:${radius},${lat},${lng});
  );out center tags 200;`;

  try {
    const r = await fetch(OVERPASS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Toovoog-CRM/1.0" },
      body: "data=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return Response.json({ error: "Kaardiandmed ei vastanud (" + r.status + ")" }, { status: 502 });
    const j: any = await r.json();
    const seen = new Set<string>();
    const pois: any[] = [];
    for (const el of j.elements || []) {
      const tags = el.tags || {};
      const cat = categorize(tags);
      if (!cat) continue;
      const plat = el.lat ?? el.center?.lat;
      const plng = el.lon ?? el.center?.lon;
      if (typeof plat !== "number" || typeof plng !== "number") continue;
      const name = tags.name || tags["name:et"] || "";
      // peatus/veekogu ilma nimeta on ok; pood/kool/lasteaed ilma nimeta jäta vahele (vähem müra)
      if (!name && (cat === "kool" || cat === "lasteaed" || cat === "pood")) continue;
      const dist = haversine(lat, lng, plat, plng);
      const key = cat + "|" + (name || Math.round(plat * 1e4) + "," + Math.round(plng * 1e4));
      if (seen.has(key)) continue;
      seen.add(key);
      pois.push({ cat, name: name || null, dist, lat: +plat.toFixed(5), lng: +plng.toFixed(5) });
    }
    // Kategooria kaupa: 3 lähimat
    const byCat: Record<string, any[]> = {};
    pois.sort((a, b) => a.dist - b.dist);
    for (const p of pois) {
      (byCat[p.cat] = byCat[p.cat] || []);
      if (byCat[p.cat].length < 3) byCat[p.cat].push(p);
    }
    const out = Object.values(byCat).flat();
    return Response.json({ pois: out, count: out.length });
  } catch (e: any) {
    return Response.json({ error: "Lähedal-otsing ebaõnnestus (aegus?)" }, { status: 502 });
  }
}
