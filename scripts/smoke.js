#!/usr/bin/env node
// Deploy-eelne kiirkontroll crm.html-ile. Jooksuta: node scripts/smoke.js
// Eesmärk: püüda kinni "kogemata midagi katki" ENNE commiti — süntaks + võtmefunktsioonide olemasolu.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "public", "crm.html");
const html = fs.readFileSync(file, "utf8");
let errors = [];

// 1) Inline-skripti süntaks
const start = html.indexOf("<script>", 1000);
const bodyStart = html.indexOf(">", start) + 1;
const end = html.lastIndexOf("</script>");
const code = html.slice(bodyStart, end);
try { new Function(code); } catch (e) { errors.push("SÜNTAKSIVIGA inline-skriptis: " + e.message); }

// 2) Võtmefunktsioonid peavad olemas olema (regressiooni-valve)
const mustHaveFns = [
  "openLead", "saveLead", "render", "openNew", "openMell", "openKabi",
  "loadMarketPrice", "renderMarketPrice", "addrSearch", "addrPick", "onTypeChange",
  "freshToken", "aiFetch", "mellLeadContext",
];
mustHaveFns.forEach(fn => {
  if (!new RegExp("function\\s+" + fn + "\\b").test(code) && !new RegExp(fn + "\\s*=\\s*function").test(code)) {
    errors.push("PUUDUB funktsioon: " + fn);
  }
});

// 3) Võtme-DOM-ID-d peavad mainitud olema
const mustHaveIds = ["leadModal", "lAadress", "lTuup", "mpResult", "mellPanel"];
mustHaveIds.forEach(id => {
  if (html.indexOf("'" + id + "'") < 0 && html.indexOf('"' + id + '"') < 0 && html.indexOf('id="' + id + '"') < 0) {
    errors.push("PUUDUB DOM-ID: " + id);
  }
});

// 4) Taksonoomia ja keskne loogika olemas
if (code.indexOf("PROPERTY_TAXONOMY") < 0) errors.push("PUUDUB PROPERTY_TAXONOMY");

// 5) API-route failid olemas
["ai", "market-price"].forEach(r => {
  const p = path.join(__dirname, "..", "app", "api", r, "route.ts");
  if (!fs.existsSync(p)) errors.push("PUUDUB API route: " + r);
});

if (errors.length) {
  console.error("❌ SMOKE FAIL (" + errors.length + "):");
  errors.forEach(e => console.error("  - " + e));
  process.exit(1);
}
console.log("✅ SMOKE OK — crm.html süntaks + " + mustHaveFns.length + " funktsiooni + ID-d + taksonoomia + API-routed korras (" + Math.round(code.length/1024) + " KB skript)");
