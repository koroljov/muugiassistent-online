// Ajutine EHR avastus-proksi on välja lülitatud (turvalisus). EHR päris-endpoint ehitatakse,
// kui swaggeri spec (swaggerui.ehr.ee, JS-renderdatud) on loetav — vajab JS-brauserit. Kuni siis: 410.
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response("EHR discovery endpoint disabled.", { status: 410 });
}
