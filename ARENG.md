# ARENG — Müügiassistent CRM (süsteemi lugu, loogilises tööjärjekorras)

See fail on **kogu süsteemi areng algusest lõpuni**: mis ehitati, MIKS nii, mis avastati (lõksud) ja kus koodis see elab. Eesmärk: koodi loetavus ei sõltu kellegi mälust. Loe enne suuremat muudatust, et mitte korrata juba lahendatud asju.

Lugemisjuhend: iga ploki all on **Mis · Miks · Avastused/lõksud · Kus koodis**. Trickide täpsem "miks" on koodis kommentaarina kohapeal.

---

## 0. Alus — üks fail, lihtne deploy

**Mis:** Kogu CRM on üks fail `public/crm.html` (~160 KB, sh üks suur inline `<script>`). Ei mingit build-sammu.
**Miks:** Lihtsus + töökindlus. Üks inimene haldab; vähem liikuvaid osi = vähem katki minekut. ATH-sõbralik: kogu loogika ühes kohas.
**Deploy-ahel:** Edit `public/crm.html` → GitHub Desktop (commit + push `main`) → Vercel deployib ise → live `muugiassistent-online.vercel.app/crm.html`.
**Lõks:** Live serveeritakse `public/crm.html`-ist, MITTE juurefailist. Sandbox-git ≠ GitHub Desktop (commit/push AINULT Desktopiga). Vt `START.md`.

## 1. Andmemudel — Supabase

**Mis:** Postgres + RLS. Põhitabelid: `leads`, `calls`, `tasks`, `user_preferences`, `profiles`. Turuandmed: `market_prices`, `source_health`, `ehr_buildings`.
**Miks:** RLS = iga kasutaja näeb oma leade; jagatud on ainult turuandmed (kõigile sama). Mitu kasutajat (Meelis, Raul) sama süsteemi sees turvaliselt.
**Reegel:** migratsioonid AINULT additiivsed (ADD COLUMN IF NOT EXISTS), et vana ei lõhuks.

## 2. Objekti lisamine — import + struktuurne aadress

**Mis:** Lead tekib kolmel viisil: (a) bookmarklet portaalilt, (b) kuulutuse URL → "Loe AI-ga" (AI eraldab väljad), (c) käsitsi.
**Aadress:** in-ADS autocomplete (Maa-ameti aadressiotsing) → `leads.{county, municipality, district, asum, addr_lat, addr_lng}`. See struktuur on ALUS turuhinna täpsusele (linnaosa/asum).
**Avastused/lõksud:**
- **Maakleri nimi:** import luges kuulutuselt "kontaktisiku" nime, mis portaalis on sageli maakler (sina ise) → pani su enda nime kontaktiks. Parandus: kui AI-nimi = sinu enda nimi, jäta tühjaks.
- **asum aadressistringis** segas in-ADS-i → proovi lihtsustatud kujusid.
- **Bookmarklet:** nimega-akna/hash-trikid on haprad; smoke ei püüa neid → vajavad päris brauseritesti.
**Kus koodis:** `importExtractAI`, `addrSearch`/`addrPick`, `addrStructureFromText`.

## 3. EHR (Ehitisregister) — ehitise ametlikud faktid

**Mis:** Aadress → ehitise faktid (ehitusaasta, netopind, korruseid, kasutusotstarve, energiamärgis). Tasuta avalik API `livekluster.ehr.ee/api/building/v3/buildingData?ehr_code=...`.
**Miks:** Hinnastamise täpsuse jaoks ametlik kontroll; EHR EI kirjuta kuulutuse andmeid üle — näitab eraldi "ametliku" võrdlusena + lahknevuse hoiatusena.
**Avastus (kriitiline):** in-ADS korteri `tunnus` = "HOONEKOOD-OSAKOOD" → enne "-" = hoone ehr_code, pärast "-" = osakood korteri TÄPSEKS sobituseks (korteri pind, mitte terve hoone).
**Kus koodis:** `app/api/ehr/route.ts`, `loadEhr`/`renderEhr`.

## 4. Turuhind — Maa-amet (kõige keerukam osa)

**Mis:** Maa-ameti tehinguhindade statistika (õppiv hinnabaas): vaata `market_prices` cache'ist → puudu/aegunud → päri Scrapfly kaudu htraru-vormist → parsi → salvesta → tagasta. Tasemed: **asum → linnaosa → maakond** (kõige täpsemast üldisemani).
**Miks Scrapfly:** Maa-amet on Cloudflare + ASP.NET vorm → otse-fetch EI tööta. Vaja päris-brauserit (render_js + js_scenario, mis juhib vormi nagu kasutaja).

### 4a. NELI Scrapfly-headless õppetundi (igaüks blokeeris eraldi)
1. **Ära oota Bootstrap-multiselecti checkboxit** (`.multiselect-container input`) — see plugin EI re-initsialiseeru headless'is → wait_for kukub → **Scrapfly katkestab kogu stsenaariumi**. Oota tõelist `#DDMaakond` select'i.
2. **County: sea alusvalik `#DDMaakond` OTSE** (`options[].selected`), mitte widgeti checkbox-klõpsuga (ei serialiseeru headless'is → "Sisesta haldusüksus käsitsi").
3. **Ära tee maakonna-tasandil `__doPostBack('DDMaakond')`** pärast county-valikut — postback re-renderdab ja KUSTUTAB valiku. Direct set + submit postitab county otse. (Tallinna rada vajab cascade postbacki DDOmavalitsuse laadimiseks; DDOmavalitsus/DDKyla on tavalised select'id.)
4. **LBTrykis onchange teeb postbacki** → oota ~2.8s enne county valikut; sea **kuupäevad VIIMASENA** (postback tühjendab txtAlgus/txtLopp). Submit järel fikseeritud `wait`, mitte geneeriline `table` (vormi lehel ON tabeleid → lahendub liiga vara).

**Kuidas leidsin:** Scrapfly `result.js_scenario.steps[].success` näitas TÄPSELT, mis samm kukub. → **Õppetund: loe tööriista logi ENNE kui oletad** (vt START.md töömeetod).

### 4b. Libisev 12 kuud (mitte täisaasta)
**Miks:** "viimase 12 kuu tehingud on kõige täpsemad". htraru RBLAeg_0 = "ajavahemik" (vaikimisi valitud), väljad txtAlgus/txtLopp formaadis MM.YYYY. period_end muutub iga kuu → cache-võti muutub → **automaatne kuu-värskendus**.

### 4c. ÜKS Scrapfly-päring / request (timeout-kaitse)
**Lõks:** asum hõre → linnaosa → ... aheldatud pärimine ületas Vercel 60s → "An error occurred". Parandus: MAX üks päring; hõreduse/tõrke korral → stale-varuvariant (võimalikult täpne: asum hõre → näita linnaosa, mitte maakonda). Täpsem tase tuleb hilisemast eraldi päringust; sentinel (tx_count=0) väldib kordust.

### 4d. Leadi-põhine taseme-valija + "kuva kohe"
**Mis:** Rippmenüü näitab leadi enda kohti (asum/linnaosa/maakond), kõige täpsem ees ja vaikimisi. Avades kuvab kohe (cache silmapilkselt; kui täpsem pole baasis, pärib ise).
**Lõks (kriitiline):** cache-võti (asum-rea `district` VEERG) = **asumi nimi**, aga endpoint-päring vajab district=linnaosa + asum=nimi → `buildMpLevels` hoiab `cacheDistrict` ja `reqDistrict`/`reqAsum` eraldi. Vale võti = cache mööda + tühi turuhind. (Seda kaitseb nüüd behavior.js test.)
**Miks oluline:** maakonna number (nt 10 998 tehingut) konkreetse Mustamäe objekti kõrval EKSITAB — kasutaja arvab, et need on Mustamäe tehingud. Asumi tase näitab Mustamäe enda mediaani + enda tehingute arvu.

**Kus koodis:** `app/api/market-price/route.ts` (buildScenario, fetch-loop, fallback), `buildMpLevels`/`loadMarketPriceLevel`/`autoLoadMarketPrice`/`mpPeriod`/`mpLevelShort` (crm.html).

### 4e. Turu TREND (maaruum.ee hinnaindeks) — täiendab taset
**Mis:** htraru annab hinna TASEME (asumi mediaan €/m²). maaruum.ee hinnaindeks annab SUUNA (kvartaalne %, kui palju turg liigub). Tase = "kui palju", trend = "mis suunas". Koos = parem nõu hinna+ajastuse kohta.
**Allikas (töökindlus-valik):** indeks POLE htraru-päringus (htraru DDTrykis = ainult D üldine + G hinnastatistika) ega puhtas API-s (livekluster av/v1 rajad 404). Ametlik allikas = **kvartali-PDF** (maaruum.ee/.../Kinnisvara hinnaindeksite KOKKUVÕTE YYYY N.pdf). `web_fetch` LOEB selle PDF-i puhtalt (tabel parseeritav). Aga PDF-URL muutub kvartalis → **EI auto-fetchi live'is** (hapra URL-i risk). Selle asemel: salvestan väheste trend-numbrid `market_index` tabelisse, **uuendan ~4×/aastas** (loen uue PDF-i, update rida). Aeglane kvartali-näit → salvestatud väärtus on täpne ja töökindel.
**Indeksid:** korteriomandid (17 linna), hoonestatud elamumaa (majad — ei arvutata iga kvartal), hoonestamata maa, üldindeks. Riigi/sektori tase, MITTE asum → trend täiendab, ei asenda meie täpset taset.
**Kus koodis:** `market_index` tabel; `marketIndexLatest`/`marketTrendFor`/`appendMarketTrend` (crm.html); trend lisatud renderMarketPrice + mellMarketLine (AI) + fkFillIntel (Fookus). behavior.js katab `marketTrendFor`.
**Kvartali-uuendus:** loe uus PDF web_fetch'iga → võta viimane rida (kvartalis/aastas % iga indeksi kohta) → upsert market_index (period_end = kvartali lõpp).

## 5. AI — Mell, Kõneabi, tagasiside

**Mis:** "Mell" (lead-abimees), "Kõneabi" (kõne-tugi reaalajas), kuulutuse AI-tagasiside. Kõik saavad SAMA leadi tervikpildi (asukoht, taksonoomia, €/m², kõneajalugu) + Maa-ameti FAKT (sama tase mis Turuhind).
**Avastus/lõks:** AI-tagasiside väitis "fotod/kirjeldus/korrus puuduvad", kui need lihtsalt polnud meie süsteemi imporditud (aga kuulutusel olemas). Parandus: prompt ei väida puuduvaks seda, mida ta lihtsalt ei näe; hindab mida ANDMED näitavad. + lisatud **Korrus** ja **Kirjeldus** väljad (import täidab), et AI saaks päris sisu hinnata.
**Kus koodis:** `mellLeadContext`, `mellMarketLine`, `genImportFeedback`, `kabiGen`, `app/api/ai/route.ts`.

## 6. Müügitoru + statistika

**Mis:** Kaheosaline kanban (Assistendi toru "A" + Minu toru "M"). Arhiveerimisel valid TULEMUSE (müüdud meie/mujal/loobus/aegus) → objekt ei kao statistikast, vaid annab õppesignaali (meie-võiduprotsent).
**Lõks:** legacy "(vana)" etapid — tahvel peidab need, aga leadi-vormi stepper mitte (parandatud: filtreeri välja, v.a kui lead ise on selles etapis).

## 7. Töökindlus — fail-safe + allikate tervis

**Põhimõte:** parem andmeid pole kui VALE number. Kolm kihti:
1. **Kontroll:** blokk/struktuur/mõistlik number → ei näita faktina kui kahtlane.
2. **Nähtav teade:** ütleb otse, kui andmed ebausaldusväärsed.
3. **`source_health`:** maakonna-tase tagastab HTML aga parse=null → STRUKTUURNE muutus (Maa-amet muutis vormi) vs hõredus → märgib 'degraded' + `sourceIssue`. Eristab ajutise võrgutõrke struktuursest.
**Andmekao kaitse:** salvestamata muudatus hoiatab enne akna sulgemist; dubleerimise hoiatus (sama URL/aadress).

## 8. Testid — süntaks + KÄITUMINE

**Mis:** `node scripts/smoke.js` (jookseb enne iga deploy't): süntaks + võtmefunktsioonid + ID-d + taksonoomia. Selle JÄREL `scripts/behavior.js`: kontrollib funktsioonide VÄLJUNDIT võltsandmetega (mpPeriod silt, buildMpLevels cache-võti, leadSegKey, mpLevelShort).
**Miks:** süntaks-kontroll ei püüa käitumis-regressioone ("muutsin ühte → lõhkusin teise"). Tõestatud: "2026"-vea taasisestamine kukutab testi ENNE deploy't.
**Reegel:** uue puhta loogika juurde → lisa üks behavior-kontroll.

## 9. Visuaal

**Mis:** Leadi vorm jagatud puhasteks sektsioonideks: **Kontakt / Objekt / Turg / Tegevus**; eemaldatud rea-jooned. Stiil: puhas ja kompaktne, ATH-sõbralik.
**Pooleli:** sama keel müügitorule + Mellile + Kõneabile (kogu rakendus ühtseks).

---

## Kandvad tööprintsiibid (iga töö juures)
Smart · Clever · Töökindel · Järjepidev · Strong · Koostöö · Aus · Lihtne.
Töökindlus > uus feature. Üks asi korraga, kinnita enne. Loe tööriista logi enne kui oletad. Keerukad vormid testi päris brauseris enne Scrapflysse viimist.

> Seda faili hoia elus: kui ehitad midagi uut või avastad lõksu, lisa siia 2–3 rida õigesse plokki. Nii ei kao teadmine ja keegi ei korda juba lahendatud viga.
