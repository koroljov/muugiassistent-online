# Mell — üks backlog (kõik ootel ühes kohas)

Uuendatud 08.08.2026. Ainus koht — hoia elus, kustuta tehtud read. Tagasiulatuv: kajastab kogu tehtut, ka viimase seansi tööd.

## Seanss 08.08.2026 (uus.html asukoha-parandus + auto-käivitus)

Leitud ja parandatud: Maa-amet aadressiotsing (in-ADS gazetteer) ei parsi rohkem kui 2-osalist AI-genereeritud aadressi (nt "Sõle 11-29, Pelgulinn, Põhja-Tallinn, Tallinn, Harjumaa") — autoNew() proovib nüüd fallback'ina tänav+viimane osa, kui täisstring 0 vastet annab. buildPatch() ei salvestanud district/county lahtreid üldse (ainult municipality+asum) — lisatud, koos kahe peidetud väljaga vormis. autoNew() (Maa-amet+EHR) käivitub nüüd AUTOMAATSELT pärast "Loe kuulutus" (nii URL- kui bookmarklet-vooshema) — enam pole vaja eraldi nuppu vajutada, väiksem oht unustada. Kõik kolm live-testitud (Sõle 11-29 täisvoog + Uusmaa tee 4 regressioonitest, konsool puhas).

Andmeparandus: üks Meelise päris objekt (Sõle 11-29, id b0c2fff6) oli salvestatud tühjade asukoha-väljadega, mistõttu Turu-kaart võrdles kogu Harju maakonnaga (9951 tehingut) — parandatud otse DB-s, nüüd võrdleb Pelgulinna asumiga (223 tehingut).

Vajab pilku (leitud tervisepaneelist Postkast → allikate-ikoon, EI ole täna tekkinud ega puudutatud):
- Maa-amet turuhind, maakond-tase T13 — päring ebaõnnestus 5.08 13:29
- EHR ehitise faktid — vastas 400, 5.08 14:20 (täna live-testitud, töötas korrektselt — võib olla ühekordne)
- Naabruskond POI (Overpass) — vastas 504, 5.08 13:19
- Seaded → AI hääl: kontol praegu valitud "Mari"; vana mälumärkme järgi peaks vaikeväärtus olema "Tambet" (meeshääl) — kontrolli, kas teadlik valik või vana jääk.

## ✅ Tehtud ja live

Baas: Kõneabi · Statistika+konversioon · Ostjad+sobitamine · Postkast (Outlook) · Kuulutuse generaator · Kaaskiri/argumendid · Ostja kulud · Laenu-/üürikalkulaator · Koostööpakkumine (konfig + PDF/PNG/HTML, osad lohistatavad) · Kaart+POI · EHR auto-täida · Turuhind (asum/linnaosa/maakond) + usaldusvahemik · Self-error · Teavitused · Dossier · PWA · Foto-AI (kuulutus) · Määrad · Kinnistu vs hoone · Valmista ette (voog) · Turg+Postkast cache · Hõljuv ✦ M · Tervise-riba (frontend) · Ajaneutraalne tervitus · Fail-safe augud · Keeleülevaatus · AI hääl · Pehmem palett · Apple-liikumiskiht · Skeleton-laadimine · Rahulikud sõnumid · Rahulik Fookus · Grupeeritud tulp · Tagline.

Seanss 06.–08.07 (üleandmis-pass): Mobiil (off-canvas riba, iOS tab-riba, ülariba mahutatud) · Kanban veergudeks + ←/→ liigutus + arvuti külgriba kokkuklapp · Kontekstiteadlik ✦ Mell (teab avatud objekti) · AI-chat jätkatav vestlus (mullid, sisendkast, auto-veniv, "Lisa objektile") · Foto→vastus chatis (vision) · Tehniline abi (elekter/vent/küte/vundament) · **§ Juriidiline abi laiendus** (kohtud, rollid, institutsioonid, kontrollikohad, AntiHallu) · De-personaliseeritud (nimi e-postist, mitte "Meelis") · **Interaktiivne esmakasutus** (tervitus nimega, edenemisriba, personaalne setup, kohe-proovi, alati ✕ + naase Seadetest) · **Kaasavad Uuendused** (UUS-märgistus, nav-badge, proovi kohe) · CHANGELOG 8.07 kirje.

Seanss 13.07 (tööjaama-pass): **Töövoog = 10 päris etappi** (Uus → Kontakt → Kohtumine/hindamine → Leping → Ettevalmistus → Müük/Näitamised → Ostja/pakkumine → Tehingu ettevalmistus → Tehing/notar → Üleandmine); "Kontakt" koondab vanad vahestaatused (k_kontakt, vestlus toimus, vajab järelkõnet, prospect) — DB migratsioonita · **Etapiriba + üks etapp korraga** (Meelise valik A; "Ei soovi" riba lõpus kiibina; valik jääb meelde) · **Menüü 11→8**: Juriidiline abi + Dokumendid Tööriistades, Meeskond + "Mis on uut" Seadetes · Nimed: Müügitoru→**Töövoog**, brändiks "Mell · tööjaam", vana crm.html→"Vana versioon" + link uude · **Uus M-logo** (elavam gradient + glow; roheline = Meelise bränd, UM ainult signatuuris) · **Seaded → Välimus: 5 värviteemat** (Roheline, Öösinine, Burgundia, Grafiit, Hele) + tihedus; kliendile minevad dokumendid jäävad alati Melli rohelisse · PROB-tõenäosused ausaks uute staatustega · CHANGELOG 13.07 kirje.

Kaasas (eraldi projekt): Mell Juriidika vundament — juriidika-kaart.md, projektijuhised, CLAUDE.md (kaustas .../Claude/Mell Juriidika).

## 🟡 Osaliselt tehtud — jääk

- **Telefon:** iOS tab-riba ✅, külgriba lisamenüüks ✅. JÄÄK: kiir-capture (＋) mobiilis kiiremaks.
- **Arvuti:** kanban veergudeks ✅ → 13.07 asendatud etapiribaga ✅.

---

# 🔴 TEGEMATA — täielik seis (13.07, tagasiulatuv)

Ainus tõeallikas tegemata tööle. Avalik Uuendused näitab ainult TEHTUT — siin on see, mis veel POLE tehtud. Hoia elus. NB: vana (crm.html) ja uus (app.html) jagavad SAMA andmebaasi — objekte ei migreerita. NB2 (13.07): uued staatuse-võtmed 'kohtumine', 'myygis', 'yleandmine' EI paista vanas crm.html-is (teadlik otsus; Rauli voog ei katke, tema staatused töötavad edasi).

## 0. Et app.html asendaks vana täielikult — ✅ TEHTUD (08.–09.07)

1. ✅ **Sisse/välja logimine** — oma login-ekraan (signInWithPassword) + logout külgribas + sessioonikadu. LIVE.
2. ✅ **Kuulutuse import** — uus.html: portaali link → "✦ Loe kuulutus" → AI täidab väljad (kv.ee/kinnisvara24/city24, vajab SCRAPFLY_KEY). LIVE. TESTI päris lingiga.
3. ⚠️ **Piltide tõmbamine** — read-listing endpoint EI tagasta og-pilti; pilt käsitsi lingina või failina (üleslaadimine olemas). Kui vaja auto: lisa endpointi og:image.
4. ✅ **Arhiveeri / kustuta objekt** — objekti Muuda-sektsioonis, kinnitusega. LIVE.
5. Kontroll (sinu): "Uus objekt" (/uus.html) + import + logout→login päris kasutuses.

## A. Järgmisena (väike, saan ise teha)

1. 🔜 **Tervise-riba backend** — ainult Maa-amet kirjutab source_health'i; ehr / nearby / portaalid / outlook veel ei raporteeri (näitavad "seire tulekul"). JÄRGMINE TÖÖS (13.07).
2. 🔜 **Seadete lisasektsioonid** — import, teavitused, eksport (Seaded sai 13.07 Välimuse + Meeskonna + Uuendused; andmehalduse osa veel puudu). JÄRJEKORRAS (13.07).
3. **Personaliseeritavad kiir-nupud** — kasutaja valib tab-riba / kiirklahvi sisu (igaühel oma).
4. ⏸️ **Telefon widget-hero** — VAHELE JÄETUD: Fookuse päis katab juba (tervitus + "täna N asja" + statistika). Mobiili eraldi hero on visuaalne ümberkujundus → vajab Meelise ülevaatust enne (mitte pime muudatus live'is).
5. **Kõnejärgsed mugavused mobiilis** — logi + järgmine samm ühe tapiga. NB: kõne-nupud kirjutavad vanu staatuse-võtmeid → maanduvad Töövoo "Kontakti" (teadlik, töötab).
6. **Kontrollid:** kas esitlus kaks vaadet (klient vs kolleeg) on app.html-is? · mitme-foto galerii esitlusel/PDF-is? · fotode päris drag-reorder (praegu ⭐ pea-pildiks + ✕, mis katab põhivajaduse).

## B. Dokumendid → app.html (OTSUS TEHTUD: app.html, üks süsteem)

- ✅ **Üleandmis-vastuvõtuakt + Ülevaatusakt** — objekti Dokumendid-tab, auto-täidetud objektist, prindi/PDF. LIVE (testitud). 13.07: kiire ligipääs ka Tööriistad → Dokumendid (vali objekt → avab õige tabi).
- **Müügileping · notarimemo · broneerimisleping** — vajavad juristi kontrollitud malli (AntiHallu: siduvat lepingut AI ei genereeri). Kui annad malli, lisan täitmise + PDF.
- **Väljasaatmine e-postiga** — seob e-kirja infraga (D).

## C. Suured / strateegilised

- **Kliendi/omaniku portaal** (per objekt/klient). Turvaline link (osalt olemas /vaade.html "Jaga omanikuga"), laienda: protsessi ajajoon (kuulutus üleval, N vaatamist, kõned, pakkumised, hinnamuutus — päris andmed); klient küsib Mellilt scoped ("mis seis?", "miks pole müünud?") → vastab objekti andmetest + turg, AntiHallu; automaatne personaalne kokkuvõte (link/e-kiri: "sel nädalal 3 vaatamist, 1 pakkumine"). Next-gen: live-link, klient bookmarkib, maakler otsustab mida näeb. Seob Homebeat + e-kirja.
- **Kopeerimatuse müür** (läbiv). Eesti andmete süvaintegratsioon (Maa-amet, EHR, kinnistusraamat, in-ADS, portaalid) — laienda pidevalt. Liituv proprietaarne andmestik: market_prices + stage_events + kõne-tulemused kasvavad iga kasutusega → ennustusvõime (data network effect). Kontekstiteadlik üks-süsteem: kopeerimiseks tuleb kogu tervik üle ehitada. Usaldus/AntiHallu bränd. Kliendiportaal → switching cost. Töö: tugevda õppe-ringi, hoia + laienda andmepipeline'i.
- **Next-gen tehniline:** häälega küsi (käed-vabad vaatamisel) · objekti-teadlik tehniline vastus (EHR vanus/tüüp: 1970 paneel vs uusarendus) · ✅ vaatamise tehniline checklist maja vanuse järgi (Ülevaatus-tabis, LIVE).
- **Suured moodulid:** Homebeat · turu-trend (maaruum indeks) · äripindade moodul.
- **Mell Juriidika** (eraldi projekt) — vundament valmis (.../Claude/Mell Juriidika); järgmine: päris tööriist (juhtumid, dokumendipõhjad, tähtajad).

## D. Vajab sind (blokeeritud — üks otsus/tegevus, MITTE takistus)

- ✅ **Kalender (ICS)** — "📅 Lisa kalendrisse" järelkontaktil → .ics fail, töötab Outlookis + igal seadmel (Windows kaasa), ilma OAuthita. LIVE. (Otsus: Outlook.) UPGRADE valikuline: päris kahesuunaline Graph-sünkroon (auto-sündmused Outlookis) — vajab kasutaja uut nõusolekut + Azure Calendars.ReadWrite; Outlook OAuth (Mail.Read) juba olemas, laiendatav.
- **E-kirja saatmine** — saatmis-infra/konto kinnitus (Outlook Graph Mail.Send scope või SMTP).
- **Digiallkiri** — Smart-ID / DigiDoc leping.
- **Supabase parool-lüliti** — dashboard toggle (leaked password protection).
- **AI-vendori valik** · **Scrapfly kvoodi-hoiatus**.
- Tervisepaneeli 3 kollast (vt 08.08 seanss ülal) — Maa-amet maakond-tase, EHR 400, Overpass 504.

## Reeglid
Üks muudatus korraga · additiivne · süntaks + live-test · **deploy: GitHub veebiredaktor (github.com → edit → commit) → Vercel auto (~70s); ei võta Meelise arvutit üle** · crm.html EI puutu (Raul) · miski pole lukus (välju/naase/muuda tagasiulatuvalt) · lahendus mitte takistus.
