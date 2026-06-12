"use client";

import { useMemo, useState } from "react";

export function MellAgent({
  active,
  currentLeadId,
  role,
  position
}: {
  active: string;
  currentLeadId?: string;
  role?: string | null;
  position?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const context = useMemo(() => contextFor(active, role, currentLeadId), [active, role, currentLeadId]);

  return (
    <aside className={`mell-agent mell-${position || "right"} ${open ? "open" : ""}`}>
      {open ? (
        <div className="mell-card" role="dialog" aria-label="Mell">
          <div className="mell-head">
            <div>
              <span>Mell</span>
              <strong>{context.title}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Sulge Mell">×</button>
          </div>
          <p>{context.text}</p>
          <div className="mell-actions">
            {context.actions.map((action) => (
              <a key={action.href + action.label} className={action.primary ? "button primary" : "button"} href={action.href}>{action.label}</a>
            ))}
          </div>
        </div>
      ) : null}
      <button type="button" className="mell-toggle" onClick={() => setOpen((value) => !value)} aria-label="Ava Mell">
        Mell
      </button>
    </aside>
  );
}

function contextFor(active: string, role?: string | null, currentLeadId?: string) {
  if (active === "call") {
    return {
      title: "Kõne kõrval",
      text: "Aitab hoida fookust: vaata viimast kontakti, salvesta kõne tulemus ja pane järgmine tegevus kohe kirja.",
      actions: [
        { label: "Ava kõne", href: currentLeadId ? `/?view=call&lead=${currentLeadId}` : "/?view=call", primary: true },
        { label: "Kontaktid", href: "/?view=leads" }
      ]
    };
  }
  if (active === "leads") {
    return {
      title: "Kontaktide töö",
      text: "Siin on mõistlik filtreerida kõrge prioriteediga kontaktid või lisada uus objekt kohe õigesse nimekirja.",
      actions: [
        { label: "Lisa kontakt", href: "/?view=leads&new=1", primary: true },
        { label: "Kõrge prioriteet", href: "/?view=leads&minScore=60" }
      ]
    };
  }
  if (active === "calendar") {
    return {
      title: "Järeltegevused",
      text: "Vaata üle tähtaja kõned ja nihuta vajadusel tegevuse kellaaega kontaktikaardilt.",
      actions: [
        { label: "Ava töölaud", href: "/", primary: true },
        { label: "Kontaktid", href: "/?view=leads" }
      ]
    };
  }
  if (active === "settings") {
    return {
      title: "Seadistamine",
      text: role === "admin" ? "Adminina saad hallata kasutajaid, eksporti, välimust ja töövoogu." : "Assistendina saad muuta oma töövaadet, Melli asukohta ja töölaua paigutust.",
      actions: [
        { label: "Välimus", href: "/?view=settings&setting=appearance", primary: true },
        { label: role === "admin" ? "Kasutajad" : "Minu andmed", href: role === "admin" ? "/?view=settings&setting=users" : "/?view=settings&setting=data" }
      ]
    };
  }
  if (active === "stats") {
    return {
      title: "Tulemused",
      text: "Vaata, millised kõned, staatused ja prioriteedid vajavad müügijuhi tähelepanu.",
      actions: [
        { label: "Kõrge prioriteet", href: "/?view=leads&minScore=60", primary: true },
        { label: "Eksport", href: "/?view=settings&setting=data" }
      ]
    };
  }
  return {
    title: "Tänane fookus",
    text: "Alusta üle tähtaja järeltegevustest, siis kõrge prioriteediga kontaktidest. Paneelide järjekorda saad muuta kohe töölaual.",
    actions: [
      { label: "Lisa kontakt", href: "/?view=leads&new=1", primary: true },
      { label: "Ava kalender", href: "/calendar" }
    ]
  };
}
