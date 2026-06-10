import { NextResponse } from "next/server";
import { getCurrentUser, getUserRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "contacts";
  const admin = getSupabaseAdmin();
  const role = await getUserRole(user.id);
  const leadAccess = role === "admin" ? "" : `assigned_to.eq.${user.id},created_by.eq.${user.id}`;

  if (type === "tasks") {
    let query = admin.from("tasks").select("*, leads(property_address,contact_name,phone)");
    if (role !== "admin") query = query.eq("assigned_to", user.id);
    const { data } = await query.order("due_date", { ascending: true });
    const rows = data ?? [];
    return csvResponse("järeltegevused.csv", rows.map((task: any) => ({
      kuupaev: task.due_date,
      kell: task.due_time,
      jareltegevus: task.type,
      kontakt: task.leads?.property_address,
      kontaktisik: task.leads?.contact_name,
      telefon: task.leads?.phone,
      staatus: task.status,
      kommentaar: task.comment
    })));
  }

  if (type === "calls") {
    let query = admin.from("calls").select("*, leads!inner(property_address,contact_name,phone,assigned_to,created_by)");
    if (role !== "admin") query = query.or(leadAccess, { foreignTable: "leads" });
    const { data } = await query.order("call_time", { ascending: false });
    const rows = data ?? [];
    return csvResponse("konede-ajalugu.csv", rows.map((call: any) => ({
      aeg: call.call_time,
      kontakt: call.leads?.property_address,
      kontaktisik: call.leads?.contact_name,
      telefon: call.leads?.phone,
      kone_tulemus: call.call_result,
      hoiak: call.attitude,
      takistus: call.obstacle,
      jargmine_tegevus: call.next_action,
      kommentaar: call.call_comment
    })));
  }

  let query = admin.from("leads").select("*, call_lists(name)").is("archived_at", null);
  if (role !== "admin") query = query.or(leadAccess);
  if (type === "high-priority") query = query.gte("lead_score", 60);
  if (type === "handoffs") query = query.eq("status", "suunatud müügispetsialistile");
  if (type === "closed") query = query.eq("status", "suletud");
  const { data } = await query.order("created_at", { ascending: false });
  const rows = data ?? [];

  const filename = type === "high-priority"
    ? "korge-prioriteediga-kontaktid.csv"
    : type === "handoffs"
      ? "uleantud-kontaktid.csv"
      : type === "closed"
        ? "suletud-kontaktid.csv"
        : "kontaktid.csv";

  return csvResponse(filename, rows.map((lead: any) => ({
    aadress: lead.property_address,
    piirkond: lead.region,
    kontaktisik: lead.contact_name,
    telefon: lead.phone,
    epost: lead.email,
    portaal: lead.portal,
    portaalilink: lead.property_link,
    objekti_tyyp: lead.property_type,
    tehingu_tyyp: lead.deal_type,
    hind: lead.price,
    pindala: lead.area,
    mitte_tylitada: lead.no_brokers_note,
    konenimekiri: lead.call_lists?.name,
    staatus: lead.status,
    prioriteet: lead.lead_score,
    jargmine_tegevus: lead.next_best_action
  })));
}

function csvResponse(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : ["teade"];
  const data = rows.length ? rows : [{ teade: "Andmeid pole" }];
  const csv = "\uFEFF" + [
    headers.join(";"),
    ...data.map((row) => headers.map((header) => escapeCsv(row[header])).join(";"))
  ].join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}
