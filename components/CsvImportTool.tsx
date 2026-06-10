"use client";

import { useMemo, useState } from "react";
import { importContactsCsv } from "@/app/actions";
import type { CallList } from "@/lib/types";

const fields = [
  ["property_address", "Aadress"],
  ["region", "Piirkond"],
  ["contact_name", "Kontaktisik"],
  ["phone", "Telefon"],
  ["email", "E-post"],
  ["portal", "Portaal"],
  ["property_link", "Portaalilink"],
  ["property_type", "Objekti tüüp"],
  ["deal_type", "Tehingu tüüp"],
  ["price", "Hind"],
  ["area", "Pindala"],
  ["no_brokers_note", "Maakleritel palun mitte tülitada"],
  ["listing_note", "Märkus"],
  ["call_list_name", "Kõnenimekiri"]
] as const;

export function CsvImportTool({
  callLists,
  users,
  existingKeys
}: {
  callLists: CallList[];
  users: { id: string; name: string }[];
  existingKeys: string[];
}) {
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const rows = useMemo(() => parseCsv(csvText), [csvText]);
  const headers = useMemo(() => rows[0] || [], [rows]);
  const dataRows = useMemo(() => rows.slice(1), [rows]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const autoMapping = useMemo(() => autoMap(headers), [headers]);
  const activeMapping = { ...autoMapping, ...mapping };
  const keySet = useMemo(() => new Set(existingKeys.map(normalize)), [existingKeys]);
  const preview = dataRows.slice(0, 8);
  const problems = dataRows.map((row, index) => {
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] || ""]));
    const address = record[activeMapping.property_address || ""] || "";
    const phone = record[activeMapping.phone || ""] || "";
    const link = record[activeMapping.property_link || ""] || "";
    const duplicate = [address, phone, link].filter(Boolean).some((value) => keySet.has(normalize(value)));
    const errors = [!address ? "aadress puudub" : "", duplicate ? "duplikaat" : ""].filter(Boolean);
    return errors.length ? { row: index + 2, errors: errors.join(", ") } : null;
  }).filter(Boolean) as { row: number; errors: string }[];

  return (
    <div className="stack">
      <div className="panel stack">
        <div className="section-title">
          <div>
            <p className="eyebrow">CSV import</p>
            <h2>Impordi kontaktid</h2>
          </div>
        </div>
        <label>CSV fail
          <input type="file" accept=".csv,text/csv" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            setCsvText(await file.text());
            setMapping({});
          }} />
        </label>
        <label>Või kleebi CSV sisu
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="aadress;kontaktisik;telefon;portaalilink" />
        </label>
      </div>

      {headers.length ? (
        <form action={importContactsCsv} className="panel stack">
          <input type="hidden" name="csv_text" value={csvText} />
          <input type="hidden" name="file_name" value={fileName || "kleebitud.csv"} />
          <input type="hidden" name="mapping_json" value={JSON.stringify(activeMapping)} />
          <div className="section-title">
            <div>
              <p className="eyebrow">{dataRows.length} rida</p>
              <h3>Veergude vastendamine</h3>
            </div>
            <button className="primary" type="submit" disabled={!dataRows.length || !activeMapping.property_address}>Impordi kontaktid</button>
          </div>
          <div className="form-grid">
            <label>Vaikimisi kõnenimekiri
              <select name="call_list_id">
                <option value="">CSV veerg või puudub</option>
                {callLists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Vaikimisi vastutaja
              <select name="assigned_to">
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            {fields.map(([key, label]) => (
              <label key={key}>{label}
                <select value={activeMapping[key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}>
                  <option value="">Ei impordi</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>

          {problems.length ? (
            <div className="error-panel panel">
              <strong>Kontroll leidis {problems.length} probleemset rida.</strong>
              <p>{problems.slice(0, 8).map((item) => `Rida ${item.row}: ${item.errors}`).join(" · ")}</p>
            </div>
          ) : <p className="status">Eelkontroll korras</p>}

          <div className="table-wrap">
            <table>
              <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>{preview.map((row, index) => <tr key={index}>{headers.map((header, headerIndex) => <td key={header}>{row[headerIndex]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </form>
      ) : null}
    </div>
  );
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

function autoMap(headers: string[]) {
  const aliases: Record<string, string[]> = {
    property_address: ["aadress", "address", "kus krunt asub"],
    region: ["piirkond", "asukoht", "linn"],
    contact_name: ["nimi", "kontaktisik", "omanik"],
    phone: ["telefon", "phone", "tel"],
    email: ["e-post", "email", "epost"],
    portal: ["portaal"],
    property_link: ["kuulutus", "link", "portaalilink"],
    property_type: ["objekti tüüp", "tyyp", "tüüp"],
    deal_type: ["tehingu tüüp", "tehing"],
    price: ["hind"],
    area: ["pindala"],
    no_brokers_note: ["maakleritel", "mitte tülitada"],
    listing_note: ["märkus", "kokkuvõte kõnest", "miks ma helistasin"],
    call_list_name: ["kõnenimekiri", "nimekiri"]
  };
  const result: Record<string, string> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const found = headers.find((header) => names.some((name) => header.toLowerCase().includes(name)));
    if (found) result[field] = found;
  }
  return result;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
