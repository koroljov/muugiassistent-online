import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { CsvImportTool } from "@/components/CsvImportTool";
import { getSupabaseServer } from "@/lib/supabase-server";
import type { CallList, ImportJob } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: me } = await supabase.from("users").select("name,role").eq("id", auth.user.id).single();
  const { data: users = [] } = await supabase.from("users").select("id,name").order("name");
  const { data: callLists = [] } = await supabase.from("call_lists").select("*").eq("status", "aktiivne").order("name");
  const { data: leads = [] } = await supabase.from("leads").select("phone,property_address,property_link").is("archived_at", null);
  const { data: jobs = [] } = await supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(20);
  const existingKeys = (leads as any[]).flatMap((lead) => [lead.phone, lead.property_address, lead.property_link].filter(Boolean));

  return (
    <Shell active="import" user={{ name: me?.name, role: me?.role }}>
      <div className="stack">
        {params.imported ? (
          <div className="panel status-panel">
            Imporditud: <strong>{params.imported}</strong> · Duplikaate: <strong>{params.duplicates || 0}</strong> · Vigu: <strong>{params.errors || 0}</strong>
          </div>
        ) : null}
        <CsvImportTool callLists={callLists as CallList[]} users={users || []} existingKeys={existingKeys as string[]} />
        <div className="panel table-wrap">
          <h3>Importimise ajalugu</h3>
          <table>
            <thead><tr><th>Aeg</th><th>Fail</th><th>Staatus</th><th>Ridu</th><th>Lisatud</th><th>Duplikaadid</th><th>Vead</th></tr></thead>
            <tbody>
              {(jobs as ImportJob[]).map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.created_at).toLocaleString("et-EE")}</td>
                  <td>{job.file_name || "-"}</td>
                  <td>{job.status}</td>
                  <td>{job.row_count}</td>
                  <td>{job.inserted_count}</td>
                  <td>{job.duplicate_count}</td>
                  <td>{job.error_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
