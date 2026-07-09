# Mell — üks backlog (kõik ootel ühes kohas)

Uuendatud 08.07.2026. Ainus koht — hoia elus, kustuta tehtud read. Tagasiulatuv: kajastab kogu tehtut, ka viimase seansi tööd.

## ✅ Tehtud ja live

Baas: Kõneabi · Statistika+konversioon · Ostjad+sobitamine · Postkast (Outlook) · Kuulutuse generaator · Kaaskiri/argumendid · Ostja kulud · Laenu-/üürikalkulaator · Koostööpakkumine (konfig + PDF/PNG/HTML, osad lohistatavad) · Kaart+POI · EHR auto-täida · Turuhind (asum/linnaosa/maakond) + usaldusvahemik · Self-error · Teavitused · Dossier · PWA · Foto-AI (kuulutus) · Määrad · Kinnistu vs hoone · Valmista ette (voog) · Turg+Postkast cache · Hõljuv ✦ M · Tervise-riba (frontend) · Ajaneutraalne tervitus · Fail-safe augud · Keeleülevaatus · AI hääl · Pehmem palett · Apple-liikumiskiht · Skeleton-laadimine · Rahulikud sõnumid · Rahulik Fookus · Grupeeritud tulp · Tagline.

Seanss 06.–08.07 (üleandmis-pass): Mobiil (off-canvas riba, iOS tab-riba, ülariba mahutatud) · Kanban veergudeks + ←/→ liigutus + arvuti külgriba kokkuklapp · Kontekstiteadlik ✦ Mell (teab avatud objekti) · AI-chat jätkatav vestlus (mullid, sisendkast, auto-veniv, "Lisa objektile") · Foto→vastus chatis (vision) · Tehniline abi (elekter/vent/küte/vundament) · **§ Juriidiline abi laiendus** (kohtud, rollid, institutsioonid, kontrollikohad, AntiHallu) · De-personaliseeritud (nimi e-postist, mitte "Meelis") · **Interaktiivne esmakasutus** (tervitus nimega, edenemisriba, personaalne setup, kohe-proovi, alati ✕ + naase Seadetest) · **Kaasavad Uuendused** (UUS-märgistus, nav-badge, proovi kohe) · CHANGELOG 8.07 kirje.

Kaasas (eraldi projekt): Mell Juriidika vundament — juriidika-kaart.md, projektijuhised, CLAUDE.md (kaustas .../Claude/Mell Juriidika).

## 🟡 Osaliselt tehtud — jääk

- **Telefon:** iOS tab-riba ✅, külgriba lisamenüüks ✅. JÄÄK: widget-hero avaekraanil, kiir-capture (＋).
- **Arvuti:** kanban veergudeks ✅, kokkuklapp burgeriga ✅.

---

# 🔴 TEGEMATA — täielik seis (08.07, tagasiulatuv)

Ainus tõeallikas tegemata tööle. Avalik Uuendused näitab ainult TEHTUT — siin on see, mis veel POLE tehtud. Hoia elus. NB: vana (crm.html) ja uus (app.html) jagavad SAMA andmebaasi — objekte ei migreerita.

## 0. Et app.html asendaks vana täielikult — ✅ TEHTUD (08.–09.07)

1. ✅ **Sisse/välja logimine** — oma login-ekraan (signInWithPassword) + logout külgribas + sessioonikadu. LIVE.
2. ✅ **Kuulutuse import** — uus.html: portaali link → "✦ Loe kuulutus" → AI täidab väljad (kv.ee/kinnisvara24/city24, vajab SCRAPFLY_KEY). LIVE. TESTI päris lingiga.
3. ⚠️ **Piltide tõmbamine** — read-listing endpoint EI tagasta og-pilti; pilt käsitsi lingina või failina (üleslaadimine olemas). Kui vaja auto: lisa endpointi og:image.
4. ✅ **Arhiveeri / kustuta objekt** — objekti Muuda-sektsioonis, kinnitusega. LIVE.
5. Kontroll (sinu): "Uus objekt" (/uus.html) + import + logout→login päris kasutuses.

## A. Järgmisena (väike, saan ise teha)

1. ✅ **Kiir-capture** — Kiirmärkmed vaade (quick_notes + RLS, sünkroonis). LIVE.
2. ✅ **Üleandmisakti Word-mall** — täidetav .docx tehtud.
3. **Tervise-riba backend** — ainult Maa-amet kirjutab source_health'i; ehr / nearby / portaalid / outlook veel ei raporteeri (näitavad "seire tulekul").
4. **Personaliseeritavad kiir-nupud** — kasutaja valib tab-riba / kiirklahvi sisu (igaühel oma).
5. ⏸️ **Telefon widget-hero** — VAHELE JÄETUD: Fookuse päis katab juba (tervitus + "täna N asja" + statistika). Mobiili eraldi hero on visuaalne ümberkujundus → vajab Meelise ülevaatust enne (mitte pime muudatus live'is).
6. ✅ **Turg täna → live** — tx-kaalutud Maa-ameti mediaan MKTMAP-ist (fallback konstant). LIVE.
7. **Kõnejärgsed mugavused mobiilis** — logi + järgmine samm ühe tapiga.
8. **Kontrollid:** kas esitlus kaks vaadet (klient vs kolleeg) on app.html-is? · mitme-foto galerii esitlusel/PDF-is? · fotode päris drag-reorder (praegu ⭐ pea-pildiks + ✕, mis katab põhivajaduse).

## B. Dokumendid → app.html (OTSUS TEHTUD: app.html, üks süsteem)

- ✅ **Üleandmis-vastuvõtuakt + Ülevaatusakt** — objekti Dokumendid-tab, auto-täidetud objektist, prindi/PDF. LIVE (testitud).
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

## Reeglid
Üks muudatus korraga · additiivne · süntaks + live-test · **deploy taustal: `git push bg main` (GitHub Desktopi enam vaja pole, ei võta Meelise arvutit üle)** · crm.html EI puutu (Raul) · miski pole lukus (välju/naase/muuda tagasiulatuvalt) · lahendus mitte takistus.
