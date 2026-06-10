import { NextResponse } from "next/server";
import { getCurrentUser, getUserRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ZipFile = {
  name: string;
  content: Buffer;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sisselogimine puudub." }, { status: 401 });

  const role = await getUserRole(user.id);
  if (role !== "admin") return NextResponse.json({ error: "Ainult müügijuht saab kogu andmestiku alla laadida." }, { status: 403 });

  const admin = getSupabaseAdmin();
  const [
    leadsResult,
    callsResult,
    tasksResult,
    callListsResult,
    notificationsResult,
    importsResult
  ] = await Promise.all([
    admin.from("leads").select("*, call_lists(name)").order("created_at", { ascending: false }),
    admin.from("calls").select("*, leads(property_address,contact_name,phone)").order("call_time", { ascending: false }),
    admin.from("tasks").select("*, leads(property_address,contact_name,phone)").order("due_date", { ascending: true }),
    admin.from("call_lists").select("*").order("created_at", { ascending: false }),
    admin.from("notifications").select("*").order("created_at", { ascending: false }),
    admin.from("import_jobs").select("*").order("created_at", { ascending: false })
  ]);

  const leads = leadsResult.data ?? [];
  const calls = callsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const callLists = callListsResult.data ?? [];
  const notifications = notificationsResult.data ?? [];
  const imports = importsResult.data ?? [];

  const files: ZipFile[] = [
    file("kontaktid.csv", rowsToCsv(leads.map((lead: any) => ({
      id: lead.id,
      aadress: lead.property_address,
      piirkond: lead.region,
      kontaktisik: lead.contact_name,
      telefon: lead.phone,
      epost: lead.email,
      portaal: lead.portal,
      portaalilink: lead.property_link,
      konenimekiri: lead.call_lists?.name,
      staatus: lead.status,
      prioriteet: lead.lead_score,
      jargmine_tegevus: lead.next_best_action,
      ai_kokkuvote: lead.ai_summary,
      arhiveeritud: lead.archived_at
    })))),
    file("koned.csv", rowsToCsv(calls.map((call: any) => ({
      id: call.id,
      aeg: call.call_time,
      kontakt: call.leads?.property_address,
      kontaktisik: call.leads?.contact_name,
      telefon: call.leads?.phone,
      tulemus: call.call_result,
      hoiak: call.attitude,
      takistus: call.obstacle,
      jargmine_tegevus: call.next_action,
      jargmise_tegevuse_kuupaev: call.next_action_at,
      jargmise_tegevuse_kell: call.next_action_time,
      kommentaar: call.call_comment,
      ai_tagasiside: call.ai_feedback
    })))),
    file("jareltegevused.csv", rowsToCsv(tasks.map((task: any) => ({
      id: task.id,
      kontakt: task.leads?.property_address,
      kontaktisik: task.leads?.contact_name,
      telefon: task.leads?.phone,
      tyyp: task.type,
      kuupaev: task.due_date,
      kell: task.due_time,
      staatus: task.status,
      kommentaar: task.comment
    })))),
    file("konenimekirjad.csv", rowsToCsv(callLists.map((item: any) => ({
      id: item.id,
      nimi: item.name,
      kirjeldus: item.description,
      allikas: item.source,
      staatus: item.status,
      loodud: item.created_at
    })))),
    file("marguanded.csv", rowsToCsv(notifications.map((item: any) => ({
      id: item.id,
      tyyp: item.type,
      pealkiri: item.title,
      sisu: item.message,
      loetud: item.is_read,
      loodud: item.created_at
    })))),
    file("importimise-ajalugu.csv", rowsToCsv(imports.map((item: any) => ({
      id: item.id,
      fail: item.file_name,
      allikas: item.source,
      staatus: item.status,
      ridu: item.row_count,
      lisatud: item.inserted_count,
      duplikaate: item.duplicate_count,
      vigu: item.error_count,
      loodud: item.created_at
    })))),
    file("kokkuvote.csv", rowsToCsv([{
      kontakte: leads.length,
      konekirjeid: calls.length,
      jareltegevusi: tasks.length,
      aktiivseid_jareltegevusi: tasks.filter((task: any) => task.status !== "tehtud").length,
      ule_antud: leads.filter((lead: any) => lead.status === "suunatud müügispetsialistile").length,
      loodud: new Date().toISOString()
    }]))
  ];

  return new NextResponse(makeZip(files), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="muugiassistent-andmed.zip"'
    }
  });
}

function file(name: string, content: string): ZipFile {
  return { name, content: Buffer.from(content, "utf8") };
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  const data = rows.length ? rows : [{ teade: "Andmeid pole" }];
  const headers = Object.keys(data[0]);
  return "\uFEFF" + [
    headers.join(";"),
    ...data.map((row) => headers.map((header) => escapeCsv(row[header])).join(";"))
  ].join("\n");
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function makeZip(files: ZipFile[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const item of files) {
    const name = Buffer.from(item.name, "utf8");
    const crc = crc32(item.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(item.content.length, 18);
    local.writeUInt32LE(item.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, item.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(item.content.length, 20);
    central.writeUInt32LE(item.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + item.content.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, ...centrals, end]);
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
