// Ajutine EHR avastus/test-endpoint on välja lülitatud — päris endpoint on /api/ehr.
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response("Disabled. Use /api/ehr.", { status: 410 });
}
