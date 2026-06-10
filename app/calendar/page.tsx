import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { completeTask, postponeTask, updateTaskSchedule } from "@/app/actions";
import { getSupabaseServer } from "@/lib/supabase-server";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: me } = await supabase.from("users").select("name,role").eq("id", auth.user.id).single();
  const { data } = await supabase
    .from("tasks")
    .select("*, leads(property_address,contact_name,phone)")
    .order("due_date", { ascending: true });
  const tasks = data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const rows = tasks as Task[];

  return (
    <Shell active="calendar" user={{ name: me?.name, role: me?.role }}>
      <div className="stack">
        <div className="section-title">
          <div>
            <p className="eyebrow">Järeltegevuste kalender</p>
            <h2>Kalender</h2>
          </div>
        </div>
        <div className="kpi-grid">
          <Kpi label="Täna" value={rows.filter((task) => task.due_date === today).length} />
          <Kpi label="Üle tähtaja" value={rows.filter((task) => task.due_date && task.due_date < today && task.status === "tegemata").length} />
          <Kpi label="Sel nädalal" value={rows.filter((task) => task.due_date && task.due_date >= today && task.due_date <= weekEnd).length} />
          <Kpi label="Tegemata" value={rows.filter((task) => task.status === "tegemata").length} />
        </div>
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Kuupäev</th><th>Kell</th><th>Järeltegevus</th><th>Kontakt</th><th>Kontaktisik</th><th>Staatus</th><th>Haldus</th></tr></thead>
            <tbody>
              {rows.map((task) => (
                <tr key={task.id} className={task.due_date && task.due_date < today && task.status === "tegemata" ? "bad" : ""}>
                  <td>{task.due_date || "-"}</td>
                  <td>{task.due_time || "-"}</td>
                  <td>{task.type}</td>
                  <td>{task.leads?.property_address}</td>
                  <td>{task.leads?.contact_name}<br />{task.leads?.phone}</td>
                  <td>{task.status}</td>
                  <td><TaskActions task={task} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <article className="kpi"><span>{label}</span><strong>{value}</strong></article>;
}

function TaskActions({ task }: { task: Task }) {
  return (
    <div className="task-actions">
      <form action={completeTask}><input type="hidden" name="id" value={task.id} /><button type="submit">Tehtud</button></form>
      <form action={postponeTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="due_date" value={task.due_date || ""} /><button type="submit">Lükka edasi</button></form>
      <form action={updateTaskSchedule} className="task-schedule">
        <input type="hidden" name="id" value={task.id} />
        <input name="due_date" type="date" defaultValue={task.due_date || ""} />
        <input name="due_time" type="time" defaultValue={task.due_time || ""} />
        <button type="submit">Muuda</button>
      </form>
      <a className="button" href={`/api/tasks/ics?id=${task.id}`}>.ics</a>
    </div>
  );
}
