// behavior.js — KÄITUMIS-testid (mitte ainult süntaks nagu smoke.js).
// Eraldab crm.html-ist puhtad funktsioonid ja kontrollib nende VÄLJUNDIT võltsandmetega.
// Eesmärk: püüda kinni regressioonid ("muutsin ühte kohta → lõhkusin teise") ENNE deploy't.
// Jooksuta: node scripts/behavior.js   (koos smoke.js-ga enne iga commiti)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'crm.html'), 'utf8');

// Eralda nimega funktsiooni täiskeha (sulgude tasakaalu järgi).
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('Funktsiooni ei leitud: ' + name);
  let i = src.indexOf('{', m.index);
  if (i < 0) throw new Error('Keha algust ei leitud: ' + name);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(m.index, j + 1); }
  }
  throw new Error('Keha lõppu ei leitud: ' + name);
}

const NAMES = ['tallinnLabel', 'leadDistrictLabel', 'buildMpLevels', 'mpPeriod', 'mpLevelShort', 'leadSegKey', 'marketTrendFor'];
let code = 'var guessCounty = function(){ return ""; };\n';            // leaf-sõltuvus, stub (ainult fallback-rajal)
for (const n of NAMES) code += extractFn(html, n) + '\n';
code += '\nthis.__exports = { ' + NAMES.join(', ') + ' };';

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const F = sandbox.__exports;

const DASH = '–'; // en dash, mida mpPeriod kasutab
const fails = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) fails.push(name + ': sai ' + g + ', ootasin ' + w);
}

// mpPeriod — libisev 12 kuud vs täisaasta (siit tuli "2026" eksitav silt)
check('mpPeriod libisev', F.mpPeriod({ period_start: '2025-06-01', period_end: '2026-05-31' }), 'viimased 12 kuud (06.2025' + DASH + '05.2026)');
check('mpPeriod täisaasta', F.mpPeriod({ period_start: '2025-01-01', period_end: '2025-12-31' }), '2025 (täisaasta)');

// mpLevelShort — taseme-silt (ei tohi olla "asum (asum)")
check('mpLevelShort maakond', F.mpLevelShort(''), 'maakond');
check('mpLevelShort linnaosa', F.mpLevelShort('Mustamäe linnaosa'), 'Mustamäe linnaosa');
check('mpLevelShort asum', F.mpLevelShort('Mustamäe asum'), 'Mustamäe asum');

// leadSegKey — tüüp → Maa-ameti segment/mõõdik
check('leadSegKey korter', F.leadSegKey('Korter', ''), { segKey: 'T13', metric: 'eur_m2' });
check('leadSegKey maja', F.leadSegKey('Maja', ''), { segKey: 'T11:elamumaa', metric: 'price' });
check('leadSegKey äripind', F.leadSegKey('Äripind', ''), { segKey: 'T11:ärimaa', metric: 'price' });

// buildMpLevels — KRIITILINE: cache-võti (asum-rea district VEERG) = asumi nimi, MITTE linnaosa.
// Vale võti = cache mööda + tühi turuhind. Päringu-väljad eraldi (district=linnaosa + asum=nimi).
const lv = F.buildMpLevels({ county: 'Harju maakond', district: 'Mustamäe linnaosa', asum: 'Mustamäe asum' });
check('buildMpLevels pikkus', lv.length, 3);
check('buildMpLevels[0] label', lv[0].label, 'Mustamäe asum');
check('buildMpLevels[0] cacheDistrict', lv[0].cacheDistrict, 'Mustamäe asum');
check('buildMpLevels[0] reqDistrict', lv[0].reqDistrict, 'Mustamäe linnaosa');
check('buildMpLevels[0] reqAsum', lv[0].reqAsum, 'Mustamäe asum');
check('buildMpLevels[1] label', lv[1].label, 'Mustamäe linnaosa');
check('buildMpLevels[1] cacheDistrict', lv[1].cacheDistrict, 'Mustamäe linnaosa');
check('buildMpLevels[2] label', lv[2].label, 'Harju maakond');
check('buildMpLevels[2] cacheDistrict', lv[2].cacheDistrict, '');

// marketTrendFor — turu-trend õigesse sektorisse (maaruum hinnaindeks)
const IDX = { korter_yoy: 5.0, maa_yoy: -0.4, maja_yoy: null, kokku_yoy: 3.1 };
check('trend korter label', F.marketTrendFor('T13', IDX).label, 'korterid');
check('trend korter yoy', F.marketTrendFor('T13', IDX).yoy, 5.0);
check('trend maa', F.marketTrendFor('T12:elamumaa', IDX).label, 'hoonestamata maa');
check('trend maja fallback (maja null → üldine)', F.marketTrendFor('T11:elamumaa', IDX).label, 'turg üldiselt');
check('trend maja fallback yoy', F.marketTrendFor('T11:elamumaa', IDX).yoy, 3.1);
check('trend null idx', F.marketTrendFor('T13', null), null);

if (fails.length) {
  console.error('❌ BEHAVIOR FAIL (' + fails.length + '):');
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('✅ BEHAVIOR OK — ' + NAMES.length + ' funktsiooni, kõik kontrollid läbisid (mpPeriod, mpLevelShort, leadSegKey, buildMpLevels cache-võti)');
