import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { appUrl, sendSystemEmail } from "@/lib/email";

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET && bearer !== process.env.CRON_SECRET) return new NextResponse("Unauthorized", { status: 401 });
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data } = await admin
    .from("tasks")
    .select("*, leads(property_address,contact_name,phone), users!tasks_assigned_to_fkey(email,name)")
    .eq("status", "tegemata")
    .eq("reminder_email_sent", false)
    .not("due_date", "is", null)
    .lte("due_date", tomorrow)
    .order("due_date", { ascending: true })
    .limit(50);
  const tasks = data ?? [];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of tasks as any[]) {
    const isOverdue = task.due_date < today;
    const result = await sendSystemEmail({
      to: task.users?.email,
      subject: isOverdue ? "Müügiassistent: järeltegevus on üle tähtaja" : "Müügiassistent: järeltegevus ootab",
      text: `Tegevus: ${task.type}
Kontakt: ${task.leads?.property_address || "-"}
Kontaktisik: ${task.leads?.contact_name || "-"}
Telefon: ${task.leads?.phone || "-"}
Tähtaeg: ${task.due_date} ${task.due_time || ""}
Kommentaar: ${task.comment || ""}
Link: ${appUrl(`/?view=call&lead=${task.lead_id}`)}`
    });

    if (result.sent) {
      sent++;
      await admin.from("tasks").update({ reminder_email_sent: true }).eq("id", task.id);
    } else if (result.skipped) {
      skipped++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ checked: tasks.length, sent, skipped, failed });
}
