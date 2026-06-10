"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAction, getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase-server";
import { appUrl, sendSystemEmail } from "@/lib/email";
import { calculateLeadScore, nextBestAction } from "@/lib/scoring";
import type { Call, Lead } from "@/lib/types";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const supabase = getSupabaseAction();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function signOut() {
  const supabase = getSupabaseAction();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function saveLead(formData: FormData) {
  const supabase = getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const id = String(formData.get("id") || "");
  if (!auth.user) redirect("/login");
  const uploadedImageUrl = await uploadLeadImage(formData, auth.user.id);
  const payload = {
    property_address: String(formData.get("property_address") || ""),
    region: String(formData.get("region") || ""),
    portal: String(formData.get("portal") || ""),
    property_link: String(formData.get("property_link") || ""),
    property_type: String(formData.get("property_type") || ""),
    deal_type: String(formData.get("deal_type") || "Müük"),
    price: Number(formData.get("price") || 0),
    area: Number(formData.get("area") || 0),
    contact_name: String(formData.get("contact_name") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    no_brokers_note: String(formData.get("no_brokers_note") || "ei"),
    listing_note: String(formData.get("listing_note") || ""),
    image_url: uploadedImageUrl || String(formData.get("image_url") || formData.get("existing_image_url") || ""),
    show_image: String(formData.get("show_image") || "jah"),
    object_display_mode: String(formData.get("object_display_mode") || "automaatne"),
    client_type: String(formData.get("client_type") || "eraklient"),
    company_name: String(formData.get("company_name") || ""),
    registry_code: String(formData.get("registry_code") || ""),
    vat_number: String(formData.get("vat_number") || ""),
    decision_maker: String(formData.get("decision_maker") || ""),
    business_need: String(formData.get("business_need") || ""),
    required_area: nullableNumber(formData.get("required_area")),
    budget: nullableNumber(formData.get("budget")),
    technical_requirements: String(formData.get("technical_requirements") || ""),
    assigned_to: String(formData.get("assigned_to") || auth.user?.id || ""),
    call_list_id: String(formData.get("call_list_id") || "") || null,
    status: String(formData.get("status") || "uus"),
    next_action_at: String(formData.get("next_action_at") || "") || null
  };

  const fallbackPayload = stripNewLeadColumns(payload);
  if (id) {
    const { error } = await supabase.from("leads").update(payload).eq("id", id);
    if (error) {
      const retry = isMissingColumnError(error) ? await supabase.from("leads").update(fallbackPayload).eq("id", id) : { error };
      if (retry.error) redirect(`/?view=leads&edit=${id}&error=${encodeURIComponent(retry.error.message)}`);
    }
  } else {
    const { error } = await supabase.from("leads").insert({ ...payload, created_by: auth.user?.id });
    if (error) {
      const retry = isMissingColumnError(error) ? await supabase.from("leads").insert({ ...fallbackPayload, created_by: auth.user?.id }) : { error };
      if (retry.error) redirect(`/?view=leads&new=1&error=${encodeURIComponent(retry.error.message)}`);
    }
  }
  revalidatePath("/");
  redirect("/?view=leads");
}

export async function deleteLead(formData: FormData) {
  const supabase = getSupabaseServer();
  await supabase.from("leads").update({ archived_at: new Date().toISOString(), status: "arhiveeritud" }).eq("id", String(formData.get("id")));
  revalidatePath("/");
}

export async function saveCall(formData: FormData) {
  const supabase = getSupabaseServer();
  const admin = getSupabaseAdmin();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const mode = String(formData.get("mode") || "normal");
  const leadId = String(formData.get("lead_id"));
  const callPayload = formDataToRecord(formData);
  delete callPayload.mode;
  delete callPayload.lead_id;

  const { data: callData } = await supabase
    .from("calls")
    .insert({ ...callPayload, lead_id: leadId, caller_id: auth.user?.id, call_time: callPayload.call_time || new Date().toISOString() })
    .select("*")
    .single();

  const call = callData as Call | null;
  const { data: leadData } = await supabase.from("leads").select("*").eq("id", leadId).single();
  const lead = leadData as Lead | null;
  if (!lead || !call) return;

  const status = mode === "followup"
    ? "vajab järelkõnet"
    : mode === "handoff"
      ? "suunatud müügispetsialistile"
      : mode === "close"
        ? "suletud"
        : statusForCall(call.call_result || "");
  const lead_score = calculateLeadScore({ ...lead, status }, call);
  const next_best_action = nextBestAction({ ...lead, status }, call);

  await supabase.from("leads").update({
    status,
    last_call_result: call.call_result,
    last_contact_at: call.call_time,
    next_action_at: call.next_action_at,
    lead_score,
    next_best_action
  }).eq("id", leadId);

  const handoffUserId = mode === "handoff" ? await firstAdminId(admin) : null;
  if (mode === "followup" || mode === "handoff" || call.next_action || call.next_action_at) {
    await supabase.from("tasks").insert({
      lead_id: leadId,
      assigned_to: mode === "handoff" ? handoffUserId : lead.assigned_to,
      type: mode === "handoff" ? "üleandmine müügispetsialistile" : call.next_action || "helista uuesti",
      due_date: call.next_action_at,
      due_time: call.next_action_time,
      status: "tegemata",
      comment: call.next_step || call.call_comment
    });
  }

  if (mode === "handoff") {
    await createHandoffNotification(lead, call, handoffUserId);
  }

  revalidatePath("/");
  redirect(`/?view=call&lead=${leadId}`);
}

export async function completeTask(formData: FormData) {
  const supabase = getSupabaseServer();
  await supabase.from("tasks").update({ status: "tehtud" }).eq("id", String(formData.get("id") || ""));
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function postponeTask(formData: FormData) {
  const supabase = getSupabaseServer();
  const current = String(formData.get("due_date") || new Date().toISOString().slice(0, 10));
  const nextDate = new Date(`${current}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  await supabase.from("tasks").update({ due_date: nextDate.toISOString().slice(0, 10), status: "tegemata" }).eq("id", String(formData.get("id") || ""));
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function updateTaskSchedule(formData: FormData) {
  const supabase = getSupabaseServer();
  await supabase.from("tasks").update({
    due_date: String(formData.get("due_date") || "") || null,
    due_time: String(formData.get("due_time") || "") || null,
    status: "tegemata"
  }).eq("id", String(formData.get("id") || ""));
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function importContactsCsv(formData: FormData) {
  const supabase = getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const csvText = String(formData.get("csv_text") || "");
  const fileName = String(formData.get("file_name") || "kontaktid.csv");
  const mapping = JSON.parse(String(formData.get("mapping_json") || "{}")) as Record<string, string>;
  const fallbackCallListId = String(formData.get("call_list_id") || "") || null;
  const fallbackAssignedTo = String(formData.get("assigned_to") || auth.user.id);
  const rows = parseCsv(csvText);
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);
  const admin = getSupabaseAdmin();
  const { data: callLists = [] } = await admin.from("call_lists").select("id,name");
  const { data: existing = [] } = await admin.from("leads").select("phone,property_address,property_link");

  const duplicateKeys = new Set(
    (existing as any[]).flatMap((lead) => [lead.phone, lead.property_address, lead.property_link].filter(Boolean).map(normalizeKey))
  );

  let insertedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const row of dataRows) {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    const payload = mappedLeadPayload(record, mapping);
    const duplicate = [payload.phone, payload.property_address, payload.property_link].filter(Boolean).map(normalizeKey).some((key) => duplicateKeys.has(key));

    if (!payload.property_address || duplicate) {
      duplicate ? duplicateCount++ : errorCount++;
      continue;
    }

    const callListName = String(record[mapping.call_list_name || ""] || "").trim();
    const callListId = callListName ? (callLists as any[]).find((item) => item.name.toLowerCase() === callListName.toLowerCase())?.id || fallbackCallListId : fallbackCallListId;
    const { error } = await supabase.from("leads").insert({
      ...payload,
      call_list_id: callListId,
      assigned_to: fallbackAssignedTo,
      created_by: auth.user.id,
      status: "uus",
      lead_score: payload.no_brokers_note === "jah" ? 35 : 25
    });

    if (error) {
      errorCount++;
    } else {
      insertedCount++;
      [payload.phone, payload.property_address, payload.property_link].filter(Boolean).forEach((value) => duplicateKeys.add(normalizeKey(value)));
    }
  }

  await supabase.from("import_jobs").insert({
    file_name: fileName,
    source: "CSV",
    status: errorCount ? "valmis vigadega" : "valmis",
    row_count: dataRows.length,
    inserted_count: insertedCount,
    duplicate_count: duplicateCount,
    error_count: errorCount,
    created_by: auth.user.id
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?imported=${insertedCount}&duplicates=${duplicateCount}&errors=${errorCount}`);
}

async function createHandoffNotification(lead: Lead, call: Call, targetUserId?: string | null) {
  const admin = getSupabaseAdmin();
  const adminId = targetUserId || await firstAdminId(admin);
  if (!adminId) return;
  const title = "Uus kontakt üle antud müügispetsialistile";
  const message = [
    "Assistent andis sulle uue kontakti üle.",
    `Aadress: ${lead.property_address}`,
    `Kontaktisik: ${lead.contact_name || "-"}`,
    `Telefon: ${lead.phone || "-"}`,
    `Kõne tulemus: ${call.call_result || "-"}`,
    `Hoiak: ${call.attitude || "-"}`,
    `Takistus: ${call.obstacle || "-"}`,
    `Järgmine samm: ${call.next_step || lead.next_best_action || "-"}`,
    `Ava kontakt: ${appUrl(`/?view=call&lead=${lead.id}`)}`
  ].join("\n");
  await admin.from("notifications").insert({ user_id: adminId, lead_id: lead.id, type: "handoff", title, message });
  const { data: adminUser } = await admin.from("users").select("email").eq("id", adminId).single();
  await sendSystemEmail({ to: adminUser?.email, subject: title, text: message });
}

async function firstAdminId(admin: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await admin.from("users").select("id").eq("role", "admin").limit(1).single();
  return data?.id || null;
}

function statusForCall(result: string) {
  const map: Record<string, string> = {
    "ei vastanud": "ei vastanud",
    "vale number": "vale number",
    "katkestas kõne": "ei soovi rääkida",
    "objekt müüdud": "objekt müüdud",
    "ei soovi rääkida": "ei soovi rääkida",
    "rääkis, aga ei soovi abi": "ei soovi abi",
    "rääkis ja on neutraalne": "neutraalne",
    "rääkis ja on pigem avatud": "pigem avatud",
    "soovib müügispetsialisti kõnet": "soovib müügispetsialisti kõnet",
    "vajab järelkõnet": "vajab järelkõnet"
  };
  return map[result] || "vestlus toimus";
}

function formDataToRecord(formData: FormData) {
  const record: Record<string, string> = {};
  for (const key of Array.from(new Set(Array.from(formData.keys())))) {
    const values = formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
    record[key] = values.join(", ");
  }
  return record;
}

async function uploadLeadImage(formData: FormData, userId: string) {
  const file = formData.get("image_file");
  if (!(file instanceof File) || file.size === 0) return "";
  const supabase = getSupabaseServer();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("lead-images").upload(path, file, { upsert: true });
  if (error) return "";
  const { data } = supabase.storage.from("lead-images").getPublicUrl(path);
  return data.publicUrl;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const text = String(value || "");
  return text ? Number(text) : null;
}

function isMissingColumnError(error: { code?: string; message?: string }) {
  const message = error.message || "";
  return error.code === "42703" || error.code === "PGRST204" || message.includes("schema cache") || message.includes("column");
}

function stripNewLeadColumns(payload: Record<string, unknown>) {
  const {
    call_list_id,
    client_type,
    company_name,
    registry_code,
    vat_number,
    decision_maker,
    business_need,
    required_area,
    budget,
    technical_requirements,
    ...legacyPayload
  } = payload;
  return legacyPayload;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index++;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if ((char === ";" || char === ",") && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function mappedLeadPayload(record: Record<string, string>, mapping: Record<string, string>) {
  const value = (field: string) => String(record[mapping[field] || ""] || "").trim();
  return {
    property_address: value("property_address"),
    region: value("region"),
    contact_name: value("contact_name"),
    phone: value("phone"),
    email: value("email"),
    portal: value("portal"),
    property_link: value("property_link"),
    property_type: value("property_type"),
    deal_type: value("deal_type") || "Müük",
    price: value("price") ? Number(value("price").replace(",", ".")) : 0,
    area: value("area") ? Number(value("area").replace(",", ".")) : 0,
    no_brokers_note: yesNo(value("no_brokers_note")),
    listing_note: value("listing_note")
  };
}

function yesNo(value: string) {
  const text = value.toLowerCase();
  return ["jah", "j", "yes", "true", "1", "x"].includes(text) ? "jah" : "ei";
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
