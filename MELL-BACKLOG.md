# Mell — üks backlog (kõik ootel ühes kohas)

Uuendatud 06.07.2026. Ainus koht — hoia elus, kustuta tehtud read.

## ✅ Tehtud ja live (sh nädala calm/next-gen pass)

Kõneabi · Statistika+konversioon · Ostjad+sobitamine · Postkast (Outlook) · Kuulutuse generaator · Kaaskiri/argumendid · Ostja kulud · Laenu-/üürikalkulaator · Koostööpakkumine (konfig + PDF/PNG/HTML, osad lohistatavad) · Kaart+POI · EHR auto-täida · Turuhind (asum/linnaosa/maakond) + **usaldusvahemik** · Self-error · Onboarding · Uuendused-vaade · Teavitused · Dossier · PWA · Foto-AI · Määrad · Kinnistu vs hoone · Valmista ette (voog) · Turg+Postkast cache · Hõljuv ✦ M · § Juriidiline abi · Tervise-riba (frontend) · Ajaneutraalne tervitus · Fail-safe augud · Keeleülevaatus · AI hääl ("Hei", kaasaegne) · De-personaliseeritud (toode) · Pehmem palett · Apple-liikumiskiht · Skeleton-laadimine · Rahulikud sõnumid · Rahulik Fookus · Grupeeritud tulp · Tagline · Mobiil (off-canvas riba + ülariba mahutatud).

## 🟡 Näidistest kinnitatud — OOTAB ROHELIST TULD

- **Telefon:** iOS tab-riba (Fookus·Toru·＋·Ostjad·✦M) + widget-hero + kiir-capture; külgriba lisamenüüks. (Meelis: "tel ok")
- **Arvuti:** kanban TAGASI veergudeks + kokkuklapitav külgriba — **collapse-nupp elegantseks** (peen nool serval, mitte kohmakas ☰).

## 🧠 KANDEV — Kontekstiteadlik Mell (Meelis 06.07 + vana idee #29 "Mell-pealik / keskne aju")

Mell'i AI EI tohi olla saareke. M teab / juriidika / tehniline peab **teadma jooksvat konteksti**: mis objektil sa oled (faktid, hind, EHR, turg), su toru seis, viimane kõne. Kirjuta "Erik Bambuse oma" → Mell teab, MIS objekt, ei küsi üle. Üks seotud süsteem, Mell teab igal sammul kus mis on.
- **Kuidas:** ask/overlay saab kaasa aktiivse objekti + toru konteksti (nagu Kõneabi juba saab O). Kui objekt avatud → "Küsi selle objekti kohta" eelvalitud. Kontekst voolab kõikjale.
- See on vana MELL-VALMIS #29 "keskne aju + per-assistent" — oli parkitud "vajab su visiooni"; nüüd visioon antud.

## 🆕 Uued soovid (06.07)

- **Personaliseeritavad kiir-nupud** — kasutaja valib tab-riba/kiirklahvi sisu (igaühel oma).
- **Sujuvus läbiv** — "tee kõik sujuvaks ja mugavaks" iga tükis.
- **Tehniline abi** (M teab laiendus): el võimsus (mis on, kust leida), ventilatsioon, küte, vundament → valmis projekt; uued JA vanad majad. ANTIHALLU: ei leiuta spekke — õpetab kust kontrollida (peakaitse elektrikilbis, energiamärgis, EHR, ventseade).

## 👥 Kliendi/omaniku portaal (Meelis 06.07) — personaalne per objekt/klient

Kliendid ootavad infot müügiprotsessi kohta. Anna neile turvaline link (osalt olemas: /vaade.html "Jaga omanikuga"), aga laienda:
- **Protsessi ajajoon** per objekt: mis tehtud (kuulutus üleval, N vaatamist, kõned, pakkumised, hinnamuutus) — aus, päris andmed.
- **Klient küsib Mell'ilt** (scoped tema objektile): "mis seis?", "miks pole müünud?" → Mell vastab objekti päris andmetest + turg, ausalt (AntiHallu, ei leiuta).
- **Automaatne personaalne kokkuvõte** (link/e-kiri): "sel nädalal: 3 vaatamist, 1 pakkumine, turg liikus X" — per klient/objekt. Seob Homebeat + e-kirja saatmisega.
- Next-gen: live-link (nagu Homebeat), klient bookmarkib, näeb alati värsket — null app-installi. Maakler (sina) otsustab, mida klient näeb (privaatsus: ei telefoni/märkmeid).

## 💡 Next-gen ideed (Meelis avatud)

- **Foto → vastus:** pildista elektrikilpi/ventilatsiooni/kütet → Mell tuvastab + selgitab (vision). On-site tugev.
- **Häälega küsi** — vaatamisel käed-vabad.
- **Objekti-teadlik tehniline** — vastus arvestab maja vanust/tüüpi (EHR): 1970 paneelmaja vs uusarendus.
- **Vaatamise tehniline checklist** — mida kontrollida (elekter/vent/niiskus/vundament) maja vanuse järgi.

## 🔧 Loose end'id nädalast (kontrolli/lõpeta)

- Tervise-riba **backend** — ainult Maa-amet raporteerib source_health'i; ülejäänud "seire tulekul".
- **Fotode lohistamine** — mainitud, tegemata.
- **Kõnede ajalugu** — üldine "Kõne"; tulemus + klikitav detail tegemata.
- **Uuendused/CHANGELOG** — ei kajasta nädala muudatusi → Raul ei näe mis muutus.
- **Arvuti kanban** hetkel vertikaalne (regressioon) — go korral tagasi veergudeks.
- Kontrolli: kas **esitlus kaks vaadet** (klient vs kolleeg) sai app.html-i? (mälus idee olemas)
- **Turg täna** paneel Fookuses on veel hooldatav baas (TURG konstant, juuni 2026), mitte live — ühenda Turuhinna mootori/trendiga.
- **Mitme-foto galerii** (#30) — kontrolli et esitlusel/PDF-is töötab (photos-väli olemas).

## 📋 Sinu palutud (A)

- **Kiir-capture** (märge/todo, üks tapp, oma vaade).
- **Dokumendid**: üleandmisakt · müügileping · ülevaatusakt jm → täida/salvesta/PDF/saada.
- **Kõnejärgsed mugavused** mobiilis (logi + järgmine samm ühe tapiga).

## 🧱 Suured eraldi / vajab sind

Suured: Homebeat · turu-trend (maaruum indeks) · äripindade moodul.
Vajab sind: e-kirja saatmine · **digiallkiri** (Smart-ID/DigiDoc leping) · kalender-OAuth · Supabase parool-lüliti · AI-vendori valik · Scrapfly kvoodi-hoiatus.

## Reeglid
Üks muudatus korraga · additiivne · süntaks + live-test · deploy GitHub Desktop · crm.html EI puutu (Raul).
