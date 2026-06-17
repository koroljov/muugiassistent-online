"use client";

import type { Lead } from "@/lib/types";

type PipelineColumn = { id: string; label: string; statuses: string[]; color: string; };

const COLUMNS: PipelineColumn[] = [
  { id: "uus", label: "Uus", statuses: ["uus"], color: "--muted" },
  { id: "helistatud", label: "Helistatud", statuses: ["ei vastanud","vajab järelkõnet","neutraalne","ei soovi abi","ei soovi rääkida","vale number","vestlus toimus"], color: "--orange" },
  { id: "avatud", label: "Avatud", statuses: ["pigem avatud","soovib müügispetsialisti kõnet"], color: "--green" },
  { id: "uleantud", label: "Üle antud", statuses: ["suunatud müügispetsialistile"], color: "--green-dark" },
];

function scoreClass(score: number) {
  if (score >= 75) return "score hot";
  if (score >= 50) return "score warm";
  return "score";
}

function PipelineCard({ lead }: { lead: Lead }) {
  const score = lead.lead_score ?? 20;
  return (
    <article className="pipeline-card">
      <div className="pipeline-card-header">
        <span className={scoreClass(score)} title={`Skoor ${score}`}>{score}</span>
        <span className="status pipeline-card-status">{lead.status}</span>
      </div>
      <strong className="pipeline-card-address">{lead.property_address}</strong>
      {lead.contact_name ? <span className="pipeline-card-contact muted">{lead.contact_name}</span> : null}
      {lead.phone ? (
        <a href={`tel:${lead.phone}`} className="tel-link pipeline-card-phone" aria-label={`Helista ${lead.contact_name || lead.phone}`}>{lead.phone}</a>
      ) : (
        <span className="muted pipeline-card-phone">Telefon puudub</span>
      )}
      <div className="pipeline-card-actions">
        <a className="button primary" href={`/?view=call&lead=${lead.id}`}>Kõne</a>
        <a className="button" href={`/?view=leads&edit=${lead.id}`}>Muuda</a>
      </div>
    </article>
  );
}

function PipelineCol({ column, leads }: { column: PipelineColumn; leads: Lead[]; }) {
  return (
    <div className="pipeline-col">
      <div className="pipeline-col-header" style={{ borderTopColor: `var(${column.color})` }}>
        <span className="pipeline-col-label">{column.label}</span>
        <span className="pipeline-col-count">{leads.length}</span>
      </div>
      <div className="pipeline-col-cards">
        {leads.length === 0 ? <p className="muted pipeline-empty">Kontakte pole.</p> : leads.map((lead) => <PipelineCard key={lead.id} lead={lead} />)}
      </div>
    </div>
  );
}

export function PipelineView({ leads }: { leads: Lead[]; }) {
  const columnLeads: Record<string, Lead[]> = Object.fromEntries(COLUMNS.map((col) => [col.id, []]));
  for (const lead of leads) {
    const matched = COLUMNS.find((col) => col.statuses.includes(lead.status));
    const colId = matched?.id ?? "helistatud";
    columnLeads[colId].push(lead);
  }
  for (const col of COLUMNS) {
    columnLeads[col.id].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
  }
  return (
    <div className="pipeline-grid" aria-label="Müügitoru kanban-vaade">
      {COLUMNS.map((col) => <PipelineCol key={col.id} column={col} leads={columnLeads[col.id]} />)}
    </div>
  );
}
