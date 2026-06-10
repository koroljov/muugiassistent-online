import { NextResponse } from "next/server";
import { canAccessTask, getCurrentUser } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { taskToIcs } from "@/lib/ics";
import type { Task } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!(await canAccessTask(id, user.id))) return new NextResponse("Forbidden", { status: 403 });

  const admin = getSupabaseAdmin();
  const { data: taskData } = await admin.from("tasks").select("*, leads(property_address,contact_name,phone)").eq("id", id).single();
  const task = taskData as Task | null;
  if (!task) return new NextResponse("Task not found", { status: 404 });
  return new NextResponse(taskToIcs(task, process.env.APP_URL || url.origin), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="muugiassistent-${task.id}.ics"`
    }
  });
}
