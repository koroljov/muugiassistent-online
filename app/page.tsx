import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { InlineAiCoach } from "@/components/InlineAiCoach";
import { PrintButton } from "@/components/PrintButton";
import { completeTask, deleteLead, postponeTask, saveCall, saveLead, updateTaskSchedule } from "./actions";
import { getSupabaseServer } from "@/lib/supabase-server";
import { callResults, selectOptions } from "@/lib/options";
import type { Call, CallList, Lead, Task } from "@/lib/types";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const view = params.view || "dashboard";
  const selectedLeadId = params.lead;
  const editLeadId = params.edit;
  const isNewLead = params.new === "1";
  const errorMessage = params.error;
  const supabase = getSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: me } = await supabase.from("users").select("*").eq("id", auth.user.id).single();
  const { data: users = [] } = await supabase.from("users").select("id,name,role,email").order("name");
  const { data: callLists = [] } = await supabase.from("call_lists").select("*").eq("status", "aktiivne").order("name");
  const { data: leads = [] } = await supabase.from("leads").select("*, call_lists(id,name)").is("archived_at", null).order("created_at", { ascending: false });
  const leadRows = (leads || []) as Lead[];
  const filteredLeads = filterAndSortLeads(leadRows, params);
  const lead = leadRows.find((item) => item.id === selectedLeadId) || filteredLeads[0] || leadRows[0];
  const { data: calls = [] } = await supabase.from("calls").select("*").order("call_time", { ascending: false });
  const { data: tasks = [] } = await supabase.from("tasks").select("*, leads(property_address,contact_name,phone)").order("due_date", { ascending: true });
  const { data: notifications = [] } = await supabase.from("notifications").select("*").eq("is_read", false).order("created_at", { ascending: false });
  const callRows = (calls || []) as Call[];
  const taskRows = (tasks || []) as Task[];
  const editLead = leadRows.find((item) => item.id === editLeadId) || null;

  return (
    <Shell active={view === "calendar" ? "calendar" : view === "stats" ? "stats" : view === "settings" ? "settings" : view === "call" ? "call" : view === "leads" ? "leads" : "dashboard"} currentLeadId={lead?.id} user={{ name: me?.name, role: me?.role }}>
      {view === "dashboard" ? <DashboardView leads={leadRows} calls={callRows} tasks={taskRows} /> : null}
      {view === "call" && lead ? <CallView lead={lead} calls={callRows} users={users || []} /> : null}
      {view === "call" && !lead ? <EmptyState title="Kontakt puudub" text="Lisa esmalt kontakt, siis saab kõnevaate avada." /> : null}
      {view === "stats" ? <StatsView leads={leadRows} calls={callRows} tasks={taskRows} /> : null}
      {view === "settings" ? <SettingsView notifications={notifications || []} role={me?.role || "assistant"} activeTab={params.setting || "general"} /> : null}
      {view === "leads" ? <LeadsView leads={filteredLeads} users={users || []} callLists={callLists as CallList[]} role={me?.role || "assistant"} tasks={taskRows} editLead={editLead} isNewLead={isNewLead} tableMode={params.mode === "table"} params={params} errorMessage={errorMessage} /> : null}
    </Shell>
  );
}

function DashboardView({ leads, calls, tasks }: { leads: Lead[]; calls: Call[]; tasks: Task[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter((task) => task.status !== "tehtud");
  const todayTasks = openTasks.filter((task) => task.due_date === today);
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date < today);
  const hotLeads = leads.filter((lead) => (lead.lead_score || 0) >= 60).slice(0, 6);
  const handoffLeads = leads.filter((lead) => lead.status === "suunatud müügispetsialistile" || lead.last_call_result === "soovib müügispetsialisti kõnet").slice(0, 6);
  const todayCalls = calls.filter((call) => call.call_time?.slice(0, 10) === today);
  const answeredCalls = todayCalls.filter((call) => call.call_result && call.call_result !== "ei vastanud");
  const talkedToday = todayCalls.filter((call) => (call.call_result || "").startsWith("rääkis"));
  const openContacts = leads.filter((lead) => ["pigem avatud", "soovib müügispetsialisti kõnet"].includes(lead.status));
  const priorities = [...leads]
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
    .filter((lead) => lead.next_best_action || (lead.lead_score || 0) >= 50)
    .slice(0, 5);

  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <p className="eyebrow">Tänane fookus</p>
          <h2>Töölaud</h2>
        </div>
        <a className="button primary" href="/?view=leads&new=1">Lisa uus kontakt</a>
      </div>
      <div className="kpi-grid">
        <Kpi label="Kõnesid täna" value={todayCalls.length} />
        <Kpi label="Vastatud kõnesid" value={answeredCalls.length} />
        <Kpi label="Rääkinud kontakte" value={talkedToday.length} />
        <Kpi label="Avatud kontakte" value={openContacts.length} />
        <Kpi label="Üle antud kontakte" value={handoffLeads.length} />
        <Kpi label="Järeltegevusi täna" value={todayTasks.length} />
        <Kpi label="Üle tähtaja" value={overdueTasks.length} />
        <Kpi label="AI prioriteete" value={priorities.length} />
      </div>
      <div className="dashboard-grid">
        <DashboardPanel title="Tänased järeltegevused"><TaskList tasks={todayTasks} /></DashboardPanel>
        <DashboardPanel title="Üle tähtaja järeltegevused"><TaskList tasks={overdueTasks} /></DashboardPanel>
        <DashboardPanel title="Tänaseks planeeritud kõned"><TaskList tasks={todayTasks.filter((task) => task.type.includes("helista"))} /></DashboardPanel>
        <DashboardPanel title="Kõrge prioriteediga kontaktid"><LeadMiniList leads={hotLeads} /></DashboardPanel>
        <DashboardPanel title="Üle antud müügispetsialistile"><LeadMiniList leads={handoffLeads} /></DashboardPanel>
        <DashboardPanel title="Viimased kõned"><CallMiniList calls={calls.slice(0, 6)} leads={leads} /></DashboardPanel>
        <DashboardPanel title="AI soovitatud järgmised kontaktid"><LeadMiniList leads={priorities} showAction /></DashboardPanel>
        <DashboardPanel title="Tänane aktiivsus"><p>Kõnesid täna: <strong>{todayCalls.length}</strong></p><p>Rääkinud kontakte: <strong>{talkedToday.length}</strong></p><p>Järeltegevusi täna: <strong>{todayTasks.length}</strong></p></DashboardPanel>
      </div>
    </div>
  );
}

function LeadsView({ leads, users, callLists, role, tasks, editLead, isNewLead, tableMode, params, errorMessage }: { leads: Lead[]; users: any[]; callLists: CallList[]; role: string; tasks: Task[]; editLead: Lead | null; isNewLead: boolean; tableMode: boolean; params: Record<string, string | undefined>; errorMessage?: string }) {
  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <p className="eyebrow">Kontakt → kõne → AI tagasiside → järeltegevus</p>
          <h2>Kontaktid</h2>
        </div>
        <div className="row">
          <a className="button" href="/api/export?type=contacts">Laadi kontaktid alla</a>
          <a className="button" href="/api/export?type=high-priority">Kõrge prioriteet CSV</a>
          <a className="button" href="/?view=leads&mode=table">Tabelivaade</a>
          <a className="button primary" href="/?view=leads&new=1">Lisa uus kontakt</a>
        </div>
      </div>
      {errorMessage ? <div className="panel error-panel"><strong>Salvestamine ei õnnestunud.</strong><br />{errorMessage}</div> : null}
      <ContactFilters users={users} callLists={callLists} params={params} />
      {(editLead || isNewLead || leads.length === 0) ? <LeadForm users={users} callLists={callLists} lead={editLead} /> : null}
      {!editLead && !isNewLead && leads.length > 0 ? <LeadCards leads={leads} role={role} /> : null}
      {tableMode ? <div className="panel table-wrap">
        <table>
          <thead><tr><th>Aadress</th><th>Kontakt</th><th>Kõnenimekiri</th><th>Portaal</th><th>Staatus</th><th>Prioriteet</th><th>Järgmine tegevus</th><th>AI</th><th></th></tr></thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td><strong>{lead.property_address}</strong><br /><span className="muted">{lead.region}</span></td>
                <td>{lead.contact_name}<br /><span className="muted">{lead.phone}</span></td>
                <td>{lead.call_lists?.name || "-"}</td>
                <td>{lead.portal}</td>
                <td><span className="status">{lead.status}</span></td>
                <td><span className={scoreClass(lead.lead_score || 20)}>{lead.lead_score || 20}</span></td>
                <td>{lead.next_best_action || "Ava kõne ja kaardista olukord."}</td>
                <td>{lead.ai_summary ? <span className="status">olemas</span> : <span className="muted">puudub</span>}</td>
                <td className="row">
                  <a className="button primary" href={`/?view=call&lead=${lead.id}`}>Kõne</a>
                  <a className="button" href={`/?view=leads&edit=${lead.id}`}>Muuda</a>
                  {role === "admin" ? <form action={deleteLead}><input type="hidden" name="id" value={lead.id} /><button type="submit">Arhiveeri</button></form> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}
      <CalendarBlock tasks={tasks} />
    </div>
  );
}

function ContactFilters({ users, callLists, params }: { users: any[]; callLists: CallList[]; params: Record<string, string | undefined> }) {
  return (
    <form className="panel filter-grid" action="/" method="get">
      <input type="hidden" name="view" value="leads" />
      <label>Otsing <input name="q" placeholder="Aadress, kontaktisik, telefon, e-post või link" defaultValue={params.q || ""} /></label>
      <label>Kõnenimekiri <select name="call_list" defaultValue={params.call_list || ""}><option value="">Kõik</option>{callLists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Staatus <select name="status" defaultValue={params.status || ""}><option value="">Kõik</option>{["uus", "vajab järelkõnet", "pigem avatud", "neutraalne", "suunatud müügispetsialistile", "suletud"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Portaal <select name="portal" defaultValue={params.portal || ""}><option value="">Kõik</option>{selectOptions.portals.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Objekti tüüp <select name="property_type" defaultValue={params.property_type || ""}><option value="">Kõik</option>{selectOptions.propertyTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Tehing <select name="deal_type" defaultValue={params.deal_type || ""}><option value="">Kõik</option><option>Müük</option><option>Üür</option></select></label>
      <label>Vastutaja <select name="assigned_to" defaultValue={params.assigned_to || ""}><option value="">Kõik</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label>Prioriteet <select name="priority" defaultValue={params.priority || ""}><option value="">Kõik</option><option value="high">Kõrge</option><option value="medium">Keskmine</option><option value="low">Madal</option></select></label>
      <label>Järgmine tegevus <select name="next_action" defaultValue={params.next_action || ""}><option value="">Kõik</option>{selectOptions.nextActions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Mitte tülitada <select name="no_brokers_note" defaultValue={params.no_brokers_note || ""}><option value="">Kõik</option><option value="jah">Jah</option><option value="ei">Ei</option></select></label>
      <label>Sorteeri <select name="sort" defaultValue={params.sort || "created_at"}><option value="priority">Prioriteet</option><option value="created_at">Lisamise aeg</option><option value="last_contact_at">Viimane kontakt</option><option value="next_action_at">Järgmine tegevus</option><option value="price">Hind</option><option value="area">Pindala</option></select></label>
      <div className="filter-actions"><button className="primary" type="submit">Filtreeri</button><a className="button" href="/?view=leads">Tühjenda</a></div>
    </form>
  );
}

function LeadCards({ leads, role }: { leads: Lead[]; role: string }) {
  return (
    <div className="lead-card-grid">
      {leads.map((lead) => (
        <article className="lead-card" key={lead.id}>
          <ObjectPreview lead={lead} compact />
          <div className="stack">
            <div>
              <strong>{lead.property_address}</strong>
              <p className="muted">{lead.call_lists?.name || "Kõnenimekiri puudub"} · {lead.portal || "portaal puudub"} · {lead.status}</p>
            </div>
            <p>{lead.contact_name || "Kontakt puudub"}<br /><span className="muted">{lead.phone || lead.email || "-"}</span></p>
            <div className="row"><span className={scoreClass(lead.lead_score || 20)}>Prioriteet {lead.lead_score || 20}</span><span className="status">{lead.client_type || "eraklient"}</span></div>
            <p><strong>Järgmine:</strong><br />{lead.next_best_action || "Ava kõne ja täpsusta olukorda."}</p>
            <div className="row">
              <a className="button primary" href={`/?view=call&lead=${lead.id}`}>Kõne</a>
              <a className="button" href={`/?view=leads&edit=${lead.id}`}>Muuda</a>
              {role === "admin" ? <form action={deleteLead}><input type="hidden" name="id" value={lead.id} /><button type="submit">Arhiveeri</button></form> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LeadForm({ users, callLists, lead }: { users: any[]; callLists: CallList[]; lead: Lead | null }) {
  return (
    <form action={saveLead} className="panel stack">
      <input type="hidden" name="id" value={lead?.id || ""} />
      <input type="hidden" name="existing_image_url" value={lead?.image_url || ""} />
      <div className="section-title"><h3>{lead ? "Muuda kontakti" : "Lisa kontakt"}</h3><button className="primary" type="submit">Salvesta kontakt</button></div>
      <div className="form-grid">
        <label>Kõnenimekiri <select name="call_list_id" defaultValue={lead?.call_list_id || ""}><option value="">Vali kõnenimekiri</option>{callLists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Aadress <input name="property_address" required defaultValue={lead?.property_address || ""} /></label>
        <label>Piirkond <input name="region" defaultValue={lead?.region || ""} /></label>
        <label>Portaal <select name="portal" defaultValue={lead?.portal || ""}><option value="">Vali portaal</option>{selectOptions.portals.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Link <input name="property_link" type="url" defaultValue={lead?.property_link || ""} /></label>
        <label>Objekti tüüp <select name="property_type" defaultValue={lead?.property_type || ""}><option value="">Vali tüüp</option>{selectOptions.propertyTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Müük või üür <select name="deal_type" defaultValue={lead?.deal_type || "Müük"}><option>Müük</option><option>Üür</option></select></label>
        <label>Hind <input name="price" type="number" defaultValue={lead?.price || ""} /></label>
        <label>Pindala <input name="area" type="number" step="0.1" defaultValue={lead?.area || ""} /></label>
        <label>Klienditüüp <select name="client_type" defaultValue={lead?.client_type || "eraklient"}>{selectOptions.clientTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Kontaktisik <input name="contact_name" defaultValue={lead?.contact_name || ""} /></label>
        <label>Telefon <input name="phone" defaultValue={lead?.phone || ""} /></label>
        <label>E-post <input name="email" type="email" defaultValue={lead?.email || ""} /></label>
        <label>Pildi URL <input name="image_url" type="url" defaultValue={lead?.image_url || ""} /></label>
        <label>Laadi pilt <input name="image_file" type="file" accept="image/*" /></label>
        <label>Kuvamise viis <select name="object_display_mode" defaultValue={lead?.object_display_mode || "automaatne"}>{selectOptions.displayModes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Näita pilti <select name="show_image" defaultValue={lead?.show_image || "jah"}><option>jah</option><option>ei</option></select></label>
        <label>Mitte tülitada <select name="no_brokers_note" defaultValue={lead?.no_brokers_note || "ei"}><option>ei</option><option>jah</option></select></label>
        <label>Vastutaja <select name="assigned_to" defaultValue={lead?.assigned_to || users[0]?.id || ""}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label>Staatus <input name="status" defaultValue={lead?.status || "uus"} /></label>
      </div>
      <details className="business-fields">
        <summary>Ärikliendi lisaväljad</summary>
        <div className="form-grid">
          <label>Ettevõte <input name="company_name" defaultValue={lead?.company_name || ""} /></label>
          <label>Registrikood <input name="registry_code" defaultValue={lead?.registry_code || ""} /></label>
          <label>KMKR nr <input name="vat_number" defaultValue={lead?.vat_number || ""} /></label>
          <label>Otsustaja <input name="decision_maker" defaultValue={lead?.decision_maker || ""} /></label>
          <label>Vajalik pindala <input name="required_area" type="number" step="0.1" defaultValue={lead?.required_area || ""} /></label>
          <label>Eelarve <input name="budget" type="number" defaultValue={lead?.budget || ""} /></label>
        </div>
        <label>Ärivajadus <textarea name="business_need" defaultValue={lead?.business_need || ""} /></label>
        <label>Tehnilised nõuded <textarea name="technical_requirements" defaultValue={lead?.technical_requirements || ""} /></label>
      </details>
      <label>Märkus <textarea name="listing_note" defaultValue={lead?.listing_note || ""} /></label>
    </form>
  );
}

function CallView({ lead, calls, users }: { lead: Lead; calls: Call[]; users: any[] }) {
  const lastCall = calls.find((call) => call.lead_id === lead.id);
  return (
    <div className="call-grid">
      <aside className="panel object-panel stack">
        <h3>Objekt ja kontakt</h3>
        <ObjectPreview lead={lead} />
        <p><strong>{lead.property_address}</strong></p>
        <p className="muted">{lead.portal} · {lead.price ? `${lead.price} €` : "hind puudub"} · {lead.area || "-"} m²</p>
        <p>{lead.contact_name}<br />{lead.phone}<br />{lead.email}</p>
        <p><span className="status">Prioriteet {lead.lead_score || 20}</span></p>
        <p><strong>Järgmine:</strong><br />{lead.next_best_action || "Ava vestlus ja täpsusta olukorda."}</p>
      </aside>
      <section className="panel script-panel script stack">
        <h3>Kõneskript</h3>
        <details open><summary>Kõne algus</summary><pre>Tere! Minu nimi on Raul ja olen müügiassistent Uus Maa Arenas.

Nägin teie kinnisvarakuulutust ja teen praegu kaardistust omanike seas, et aru saada, kuidas müük turul päriselt liigub ja mis on täna takistuseks.

Kas teil on 1–2 minutit aega?</pre></details>
        <details><summary>Kui kuulutuses on “maakleritel palun mitte tülitada”</summary><pre>Nägin, et kuulutuses oli märge „maakleritel palun mitte tülitada”.

Kas selle põhjus on pigem varasem halb kogemus, liiga palju kõnesid, teenustasu või soov müük ise teha?</pre></details>
        <details><summary>Põhiküsimused</summary><pre>1. Kas objekt on veel müügis?
2. Kui kaua on see müügis olnud?
3. Mitu huvilist või vaatamist on olnud?
4. Kas hinnapakkumisi on tehtud?
5. Kas olete hinda muutnud?
6. Mis praegu müüki kõige rohkem takistab?
7. Kas ostjatelt on korduvat tagasisidet?
8. Kas müügiga on kiire?
9. Kas oleksite avatud teisele spetsialisti vaatele?</pre></details>
      </section>
      <aside className="panel form-panel stack">
        <form id="callForm" action={saveCall} className="stack">
          <input type="hidden" name="lead_id" value={lead.id} />
          <div className="call-note-grid">
            <label>Kõne aeg <input name="call_time" type="datetime-local" /></label>
            <label>Järeltegevuse kuupäev <input name="next_action_at" type="date" /></label>
            <label>Järeltegevuse kellaaeg <input name="next_action_time" type="time" /></label>
          </div>
          <ChoiceGroup legend="1. Kõne tulemus" name="call_result" options={callResults} important={["ei vastanud", "vale number", "katkestas kõne", "objekt müüdud", "objekt pausil", "ei soovi rääkida", "rääkis, aga ei soovi abi", "rääkis ja on pigem avatud", "vajab järelkõnet", "soovib müügispetsialisti kõnet"]} />
          <ChoiceGroup legend="2. Kliendi hoiak" name="attitude" options={selectOptions.attitudes} important={["avatud", "pigem avatud", "neutraalne"]} />
          <ChoiceGroup legend="3. Peamine takistus" name="obstacle" options={selectOptions.obstacles} important={["hind", "pildid", "kuulutuse tekst", "nõrk esitlus", "vähene nõudlus"]} multiple />
          <ChoiceGroup legend="4. Lubas spetsialistil ühendust võtta" name="specialist_contact" options={selectOptions.specialistContact} important={["jah", "hiljem", "vajab järelkõnet", "soovib enne infot e-postile"]} />
          <ChoiceGroup legend="5. Järgmine tegevus" name="next_action" options={selectOptions.nextActions} important={["helista uuesti", "saada SMS", "saada e-kiri", "suuna müügispetsialistile", "sulge kontakt", "tee hinnasoovitus"]} multiple />
          <details className="call-extra">
            <summary>Lisapõhjused</summary>
            <ChoiceGroup legend="Miks ei soovi abi" name="no_help_reason" options={selectOptions.noHelpReasons} compact multiple />
            <ChoiceGroup legend="Miks rääkima jäi" name="talk_reason" options={selectOptions.talkReasons} compact multiple />
          </details>
          <label>Kommentaar kõnest <textarea name="call_comment" placeholder="Kirjuta 1-2 lauset: mida klient ütles, mis teda päriselt takistab." /></label>
          <label>Järgmine samm <textarea name="next_step" placeholder="Näiteks: saata SMS, müügispetsialist helistab, teha hinnavaatlus." /></label>
          <div className="button-grid">
            <button className="primary" name="mode" value="normal" type="submit">Salvesta kõne</button>
            <button name="mode" value="followup" type="submit">Salvesta ja järelkõne</button>
            <button name="mode" value="handoff" type="submit">Salvesta ja anna müügispetsialistile üle</button>
            <button name="mode" value="close" type="submit">Salvesta ja sulge kontakt</button>
          </div>
        </form>
        <div className="ai-card">
          <h3>AI kokkuvõte kontaktist</h3>
          {lead.ai_summary ? <pre>{lead.ai_summary}</pre> : <p className="muted">AI kokkuvõtet pole veel. Kõne ajal kasuta ülal olevat live kõneabi.</p>}
          <form action="/api/ai-feedback" method="post"><input type="hidden" name="lead_id" value={lead.id} /><button type="submit">Tee AI kokkuvõte</button></form>
        </div>
      </aside>
      <aside className="coach-rail">
        <InlineAiCoach leadId={lead.id} formId="callForm" />
      </aside>
    </div>
  );
}

function ChoiceGroup({
  legend,
  name,
  options,
  important = [],
  compact = false,
  multiple = false
}: {
  legend: string;
  name: string;
  options: string[];
  important?: string[];
  compact?: boolean;
  multiple?: boolean;
}) {
  const primary = important.length ? important : options.slice(0, compact ? 6 : 4);
  const secondary = options.filter((option) => !primary.includes(option));
  return (
    <fieldset className={compact ? "choice-group compact" : "choice-group"}>
      <legend>{legend}</legend>
      <div className="choice-grid">
        {primary.map((option) => <ChoiceCard key={option} name={name} option={option} multiple={multiple} />)}
      </div>
      {secondary.length ? (
        <details className="more-choices">
          <summary>Rohkem valikuid</summary>
          <div className="choice-grid">
            {secondary.map((option) => <ChoiceCard key={option} name={name} option={option} multiple={multiple} />)}
          </div>
        </details>
      ) : null}
    </fieldset>
  );
}

function ChoiceCard({ name, option, multiple }: { name: string; option: string; multiple: boolean }) {
  return (
    <label className="choice-card">
      <input type={multiple ? "checkbox" : "radio"} name={name} value={option} />
      <span>{option}</span>
    </label>
  );
}

function ObjectPreview({ lead, compact = false }: { lead: Lead; compact?: boolean }) {
  const mode = lead.object_display_mode || "automaatne";
  // eslint-disable-next-line @next/next/no-img-element
  if ((mode === "pilt" || mode === "automaatne") && lead.image_url && lead.show_image !== "ei") return <img className={compact ? "property-image compact" : "property-image"} src={lead.image_url} alt="Objekt" />;
  if ((mode === "portaalikaart" || mode === "automaatne") && lead.property_link && !compact) return <div className="portal-card"><div><strong>{lead.portal}</strong><p>{lead.property_address}</p><a className="button" href={lead.property_link} target="_blank">Ava kuulutus</a></div></div>;
  return <div className={compact ? "image-placeholder compact" : "image-placeholder"}>{lead.property_type || "Objekti pilt puudub"}</div>;
}

function StatsView({ leads, calls, tasks }: { leads: Lead[]; calls: Call[]; tasks: Task[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const talked = calls.filter((call) => (call.call_result || "").startsWith("rääkis")).length;
  const handoffs = leads.filter((lead) => lead.status === "suunatud müügispetsialistile").length;
  const hot = leads.filter((lead) => (lead.lead_score || 0) >= 75).length;
  const overdue = tasks.filter((task) => task.status !== "tehtud" && task.due_date && task.due_date < today).length;
  const dailyCalls = countBy(
    calls.slice(0, 300),
    (call) => call.call_time?.slice(0, 10) || "kuupäev puudub"
  ).slice(0, 14).reverse();
  const resultRows = countBy(calls, (call) => call.call_result || "tulemus puudub").slice(0, 10);
  const statusRows = countBy(leads, (lead) => lead.status || "staatus puudub").slice(0, 10);
  const pipelineRows = [
    { label: "Kontaktid", value: leads.length },
    { label: "Helistatud", value: new Set(calls.map((call) => call.lead_id)).size },
    { label: "Rääkis", value: talked },
    { label: "Avatud", value: leads.filter((lead) => ["pigem avatud", "soovib müügispetsialisti kõnet"].includes(lead.status)).length },
    { label: "Üle antud", value: handoffs },
    { label: "Kuumad", value: hot }
  ];
  const reasonRows = countBy(calls, (call) => call.no_broker_reason || call.no_help_reason || "põhjus puudub").filter((row) => row.label !== "põhjus puudub").slice(0, 8);
  const obstacleRows = countBy(calls, (call) => call.obstacle || "takistus puudub").filter((row) => row.label !== "takistus puudub").slice(0, 8);
  const callListRows = countBy(leads, (lead) => lead.call_lists?.name || "nimekiri puudub").slice(0, 10);
  return (
    <div className="stack">
      <div className="section-title">
        <h2>Statistika</h2>
        <PrintButton label="Prindi raport" />
      </div>
      <div className="kpi-grid">
        <Kpi label="Kõnesid" value={calls.length} />
        <Kpi label="Jäi rääkima" value={talked} />
        <Kpi label="Üle antud" value={handoffs} />
        <Kpi label="Kõrge prioriteediga kontaktid" value={hot} />
        <Kpi label="Mitte tülitada" value={leads.filter((lead) => lead.no_brokers_note === "jah").length} />
        <Kpi label="AI kokkuvõtted" value={leads.filter((lead) => lead.ai_summary).length} />
        <Kpi label="Üle tähtaja järeltegevused" value={overdue} />
      </div>
      <div className="chart-grid">
        <BarChart title="Kõned päevade kaupa" rows={dailyCalls} />
        <BarChart title="Kõne tulemused" rows={resultRows} />
        <BarChart title="Müügitoru" rows={pipelineRows} />
        <BarChart title="Kontaktide staatused" rows={statusRows} />
        <BarChart title="Mitte tülitada põhjused" rows={reasonRows} emptyText="Põhjuseid pole veel märgitud." />
        <BarChart title="Peamised takistused" rows={obstacleRows} emptyText="Takistusi pole veel märgitud." />
        <BarChart title="Kõnenimekirjade võrdlus" rows={callListRows} />
      </div>
      <div className="panel table-wrap">
        <h3>Portaalide võrdlus</h3>
        <table><thead><tr><th>Portaal</th><th>Kontakte</th><th>Keskmine prioriteet</th></tr></thead><tbody>{selectOptions.portals.map((portal) => {
          const rows = leads.filter((lead) => lead.portal === portal);
          if (!rows.length) return null;
          return <tr key={portal}><td>{portal}</td><td>{rows.length}</td><td>{Math.round(rows.reduce((sum, lead) => sum + (lead.lead_score || 20), 0) / rows.length)}</td></tr>;
        })}</tbody></table>
      </div>
    </div>
  );
}

function SettingsView({ notifications, role, activeTab }: { notifications: any[]; role: string; activeTab: string }) {
  const tabs = [
    { id: "general", label: "Üldine", text: "Rakenduse töörežiim ja põhiseis." },
    { id: "ai", label: "AI", text: "Kõneabi, kokkuvõtted ja järgmised küsimused." },
    { id: "notifications", label: "Märguanded", text: "Üleandmised ja järeltegevuste teavitused." },
    { id: "calendar", label: "Kalender", text: "Sisemine kalender ja .ics eksport." },
    { id: "data", label: "Andmed", text: "Import, eksport ja varukoopiad." },
    { id: "security", label: "Turvalisus", text: "Ligipääsud, rollid ja andmekaitse." },
    { id: "users", label: "Kasutajad", text: "Müügijuht ja müügiassistendid." }
  ];
  const selected = tabs.some((tab) => tab.id === activeTab) ? activeTab : "general";
  const appUrl = process.env.APP_URL || "";
  const aiReady = Boolean(process.env.OPENAI_API_KEY);
  const emailReady = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const cronReady = Boolean(process.env.CRON_SECRET);

  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <p className="eyebrow">Rakenduse juhtimine</p>
          <h2>Seaded</h2>
        </div>
        <PrintButton />
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar panel">
          {tabs.map((tab) => (
            <a key={tab.id} className={selected === tab.id ? "active" : ""} href={`/?view=settings&setting=${tab.id}`}>
              <strong>{tab.label}</strong>
              <span>{tab.text}</span>
            </a>
          ))}
        </aside>

        <section className="settings-content panel stack">
          {selected === "general" ? (
            <>
              <div>
                <p className="eyebrow">Ülevaade</p>
                <h3>Rakenduse seis</h3>
              </div>
              <div className="settings-card-grid">
                <SettingStatus title="Supabase ühendus" ok text="Andmebaasi võtmed on olemas ja app saab sisselogimist kasutada." />
                <SettingStatus title="Live aadress" ok={Boolean(appUrl)} text={appUrl || "APP_URL tuleb Vercelis määrata pärast esimese aadressi saamist."} />
                <SettingStatus title="Kasutaja roll" ok text={role === "admin" ? "Oled müügijuhi rollis." : "Oled müügiassistendi rollis."} />
                <SettingStatus title="Ekspordid" ok text="CSV ja ZIP eksport on rakenduses olemas." />
              </div>
            </>
          ) : null}

          {selected === "ai" ? (
            <>
              <div>
                <p className="eyebrow">Kõneabi</p>
                <h3>AI seadistus</h3>
              </div>
              <div className="settings-card-grid">
                <SettingStatus title="OpenAI võti" ok={aiReady} text={aiReady ? "AI päringud saavad kasutada päris mudelit." : "OPENAI_API_KEY on veel puudu, seega AI töötab piiratud varuloogikaga."} />
                <SettingStatus title="Live coach" ok text="Kõne ajal valikute põhjal järgmise küsimuse soovitus on rakenduses olemas." />
                <SettingStatus title="AI kokkuvõte" ok text="Kõne järel saab salvestada kokkuvõtte, riski ja järgmise tegevuse." />
              </div>
              <div className="settings-note">
                <strong>Soovitus:</strong> enne päris kasutust lisa Vercelis `OPENAI_API_KEY`, muidu jäävad AI vastused liiga üldiseks.
              </div>
            </>
          ) : null}

          {selected === "notifications" ? (
            <>
              <div>
                <p className="eyebrow">Teavitused</p>
                <h3>Märguanded</h3>
              </div>
              <div className="settings-card-grid">
                <SettingStatus title="Sisemised märguanded" ok text="Assistendilt müügispetsialistile suunamised tekivad rakendusse märguandena." />
                <SettingStatus title="E-maili saatmine" ok={emailReady} text={emailReady ? "Resend on seadistatud." : "RESEND_API_KEY ja RESEND_FROM on veel puudu."} />
                <SettingStatus title="Automaatne meeldetuletus" ok={cronReady} text={cronReady ? "CRON_SECRET on olemas." : "CRON_SECRET on veel puudu; lisame selle Vercelis hiljem."} />
              </div>
              <div className="notification-list">
                {notifications.length ? notifications.map((item) => <article key={item.id}><strong>{item.title}</strong><span>{item.message}</span></article>) : <p className="muted">Uusi märguandeid pole.</p>}
              </div>
            </>
          ) : null}

          {selected === "calendar" ? (
            <>
              <div>
                <p className="eyebrow">Järeltegevused</p>
                <h3>Kalender</h3>
              </div>
              <div className="settings-card-grid">
                <SettingStatus title="Sisemine kalender" ok text="Järeltegevused on rakenduses kalendrivaates." />
                <SettingStatus title=".ics eksport" ok text="Taski saab kalendrisse eksportida." />
                <SettingStatus title="Google/Outlook sync" ok={false} text="Otse-sünkroon on järgmine arendusetapp, praegu töötab .ics." />
              </div>
            </>
          ) : null}

          {selected === "data" ? (
            <>
              <div>
                <p className="eyebrow">Varukoopiad</p>
                <h3>Andmed</h3>
              </div>
              {role === "admin" ? (
                <>
                  <p className="muted">Admin saab alla laadida kontaktid, kõned, järeltegevused, märguanded ja importimise ajaloo.</p>
                  <div className="settings-actions">
                    <a className="button primary" href="/api/export/all">Laadi kogu andmestik ZIP failina alla</a>
                    <a className="button" href="/api/export?type=contacts">Kontaktid CSV</a>
                    <a className="button" href="/api/export?type=calls">Kõned CSV</a>
                    <a className="button" href="/api/export?type=tasks">Järeltegevused CSV</a>
                  </div>
                </>
              ) : <p className="muted">Andmete eksport on ainult müügijuhile.</p>}
            </>
          ) : null}

          {selected === "security" ? (
            <>
              <div>
                <p className="eyebrow">Ligipääs</p>
                <h3>Turvalisus</h3>
              </div>
              <div className="settings-card-grid">
                <SettingStatus title="Sisselogimine" ok text="Rakendus nõuab Supabase kasutajat." />
                <SettingStatus title="Rollipõhine vaade" ok text="Müügijuht näeb rohkem toiminguid kui assistent." />
                <SettingStatus title="Salajased võtmed" ok text=".env.local ei lähe GitHubi üles." />
              </div>
            </>
          ) : null}

          {selected === "users" ? (
            <>
              <div>
                <p className="eyebrow">Tiim</p>
                <h3>Kasutajad</h3>
              </div>
              <div className="settings-card-grid">
                <SettingStatus title="Müügijuht" ok text="Saab hallata kontakte, eksporti ja admini toiminguid." />
                <SettingStatus title="Müügiassistent" ok text="Saab teha kõnesid, märkida tulemusi ja suunata edasi." />
                <SettingStatus title="Uue kasutaja lisamine" ok={false} text="Lisamine käib praegu Supabase Auth ja public.users tabeli kaudu." />
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function SettingStatus({ title, ok, text }: { title: string; ok: boolean; text: string }) {
  return (
    <article className="setting-status">
      <div>
        <span className={ok ? "status-dot ok" : "status-dot warn"} />
        <strong>{title}</strong>
      </div>
      <p>{text}</p>
    </article>
  );
}

function BarChart({ title, rows, emptyText = "Andmeid pole veel." }: { title: string; rows: { label: string; value: number }[]; emptyText?: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="panel chart-panel">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="bar-list">
          {rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <div className="bar-label"><span>{row.label}</span><strong>{row.value}</strong></div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(4, Math.round((row.value / max) * 100))}%` }} /></div>
            </div>
          ))}
        </div>
      ) : <p className="muted">{emptyText}</p>}
    </section>
  );
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item).trim() || "puudub";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "et"));
}

function CalendarBlock({ tasks }: { tasks: Task[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="panel table-wrap">
      <h3>Kalender ja järeltegevused</h3>
      <table><thead><tr><th>Aeg</th><th>Järeltegevus</th><th>Kontakt</th><th>Kontaktisik</th><th>Staatus</th><th></th></tr></thead><tbody>
        {tasks.map((task) => (
          <tr key={task.id} className={task.due_date && task.due_date < today && task.status !== "tehtud" ? "bad" : ""}>
            <td>{task.due_date || "-"} {task.due_time || ""}</td>
            <td>{task.type}</td>
            <td>{task.leads?.property_address}</td>
            <td>{task.leads?.contact_name}<br />{task.leads?.phone}</td>
            <td>{task.status}</td>
            <td><TaskActions task={task} /></td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

function DashboardPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel stack"><h3>{title}</h3>{children}</section>;
}

function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <p className="muted">Kirjeid pole.</p>;
  return (
    <div className="mini-list">
      {tasks.map((task) => (
        <article key={task.id}>
          <strong>{task.type}</strong>
          <span>{task.due_date || "-"} {task.due_time || ""}</span>
          <span>{task.leads?.property_address || "Kontakt puudub"}</span>
          <TaskActions task={task} compact />
        </article>
      ))}
    </div>
  );
}

function TaskActions({ task, compact = false }: { task: Task; compact?: boolean }) {
  return (
    <div className={compact ? "task-actions compact" : "task-actions"}>
      <form action={completeTask}><input type="hidden" name="id" value={task.id} /><button type="submit">Tehtud</button></form>
      <form action={postponeTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="due_date" value={task.due_date || ""} /><button type="submit">Lükka edasi</button></form>
      <form action={updateTaskSchedule} className="task-schedule">
        <input type="hidden" name="id" value={task.id} />
        <input name="due_date" type="date" defaultValue={task.due_date || ""} />
        <input name="due_time" type="time" defaultValue={task.due_time || ""} />
        <button type="submit">Muuda</button>
      </form>
      {!compact ? <a className="button" href={`/api/tasks/ics?id=${task.id}`}>.ics</a> : null}
    </div>
  );
}

function LeadMiniList({ leads, showAction = false }: { leads: Lead[]; showAction?: boolean }) {
  if (!leads.length) return <p className="muted">Kirjeid pole.</p>;
  return (
    <div className="mini-list">
      {leads.map((lead) => (
        <article key={lead.id}>
          <strong>{lead.property_address}</strong>
          <span>{lead.contact_name || "-"} · prioriteet {lead.lead_score || 20}</span>
          {showAction ? <span>{lead.next_best_action || "Täpsusta järgmine samm."}</span> : null}
          <a className="button" href={`/?view=call&lead=${lead.id}`}>Kõne</a>
        </article>
      ))}
    </div>
  );
}

function CallMiniList({ calls, leads }: { calls: Call[]; leads: Lead[] }) {
  if (!calls.length) return <p className="muted">Kõnesid pole.</p>;
  return (
    <div className="mini-list">
      {calls.map((call) => {
        const lead = leads.find((item) => item.id === call.lead_id);
        return (
          <article key={call.id}>
            <strong>{call.call_result || "Kõne"}</strong>
            <span>{lead?.property_address || "Kontakt puudub"}</span>
            <span>{new Date(call.call_time).toLocaleString("et-EE")}</span>
          </article>
        );
      })}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return <article className="kpi"><span>{label}</span><strong>{value}</strong></article>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="panel stack"><h2>{title}</h2><p className="muted">{text}</p><a className="button primary" href="/?view=leads">Ava kontaktid</a></div>;
}

function scoreClass(score: number) {
  if (score >= 75) return "score hot";
  if (score >= 50) return "score warm";
  return "score";
}

function filterAndSortLeads(leads: Lead[], params: Record<string, string | undefined>) {
  const query = (params.q || "").trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const filtered = leads.filter((lead) => {
    const text = [lead.property_address, lead.contact_name, lead.phone, lead.email, lead.property_link].filter(Boolean).join(" ").toLowerCase();
    const score = lead.lead_score || 20;
    if (query && !text.includes(query)) return false;
    if (params.call_list && lead.call_list_id !== params.call_list) return false;
    if (params.status && lead.status !== params.status) return false;
    if (params.portal && lead.portal !== params.portal) return false;
    if (params.property_type && lead.property_type !== params.property_type) return false;
    if (params.deal_type && lead.deal_type !== params.deal_type) return false;
    if (params.assigned_to && lead.assigned_to !== params.assigned_to) return false;
    if (params.no_brokers_note && lead.no_brokers_note !== params.no_brokers_note) return false;
    if (params.next_action && !(lead.next_best_action || "").toLowerCase().includes(params.next_action.toLowerCase())) return false;
    if (params.priority === "high" && score < 60) return false;
    if (params.priority === "medium" && (score < 40 || score >= 60)) return false;
    if (params.priority === "low" && score >= 40) return false;
    if (params.overdue === "1" && (!lead.next_action_at || lead.next_action_at >= today)) return false;
    return true;
  });

  const sort = params.sort || "created_at";
  return filtered.sort((a, b) => {
    if (sort === "priority") return (b.lead_score || 0) - (a.lead_score || 0);
    if (sort === "last_contact_at") return dateValue(b.last_contact_at) - dateValue(a.last_contact_at);
    if (sort === "next_action_at") return dateValue(a.next_action_at) - dateValue(b.next_action_at);
    if (sort === "price") return Number(b.price || 0) - Number(a.price || 0);
    if (sort === "area") return Number(b.area || 0) - Number(a.area || 0);
    return dateValue(b.created_at) - dateValue(a.created_at);
  });
}

function dateValue(value: string | null) {
  if (!value) return 0;
  return new Date(value).getTime() || 0;
}
