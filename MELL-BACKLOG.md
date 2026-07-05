# Mell — üks backlog (kõik ootel ühes kohas)

Koondatud 05.07.2026 mälu-märkmetest + ARENG.md-st. Eesmärk: lõpetada hajumine. See on ainus koht — hoia elus, kustuta tehtud read.

Oluline: enamik vana "ootel" nimekirjast on juba **tehtud app.html-is** (autonoomsed voorud 03–05.07). Tunne "palju ootel" oli osalt vananenud märkmete pärast.

## ✅ Tehtud ja live (tundus ootel — pole enam)

Kõneabi · Statistika + konversioon · Ostjad + sobitamine · Postkast (Outlook) · Kuulutuse generaator · Kaaskiri/argumendid · Ostja kulud (klapib ametlikuga) · Laenukalkulaator · Üüritootlus · Koostööpakkumine (konfigureeritav + PDF/PNG/HTML) · Kaart + POI · EHR auto-täida · Turuhind asum/linnaosa/maakond · Self-error (mellChecks) · Onboarding · Uuendused-vaade · Teavitused (kell) · Dossier · PWA · Foto-AI · Määrad keskne · Kinnistu vs hoone · RLS turve (buyers/orgs) · Valmista ette (voog) · Turg+Postkast cache · Hõljuv M · Tervise-riba · Ajaneutraalne tervitus · Fail-safe augud (timeout/catch) · Keeleülevaatus · AI hääl (rikas stiil + "Hei" + kaasaegne, robootlik välja).

## ⏳ Päriselt ootel — ohutu, saan ise teha

1. Tervise-riba backend: ühenda ülejäänud allikad source_health'i raporteerima.
2. **Meeldiv laadimine kõikjale** — Fookuse laadimine tundub meeldivam kui teised vaated (Meelis 06.07). Vii sama tunne teistele: skeleton/õrn animatsioon "Laen…" asemel (Statistika, Postkast, Meeskond, Ostjad).
3. Visuaalne ühtsuse pass — kogu app üks disainikeel, ATH-rahulik. Fookuse etalon-eelvaade tehtud (mell-fookus-etalon.html) → vii rütm teistele vaadetele. Pehmem palett tehtud 06.07 (silmamugavus).
4. **Liikumine ja üleminekud kõikjal** (Meelis 06.07) — kõik vaated silmale ja meeltele mugavad: pehmed üleminekud vaadete ja olekute vahel, mugav tempo (kiire aga sujuv, mitte järsk), õrn liikumine õigetes kohtades. Osa visuaalsest ühtsusest.
4. Homebeat — auto väärtus-uuendus omanikule (konkurent-idee).
5. Hinnang usaldusvahemikuga (±%, N tehingut) (konkurent-idee).
6. Kõneabi: e-posti küsimise punkt küsimustikku (vajan sult variandid).
7. AI kahe vendori (Anthropic + OpenAI) koondamine ühele.
8. Scrapfly kvoodi-hoiatus enne kukkumist.
9. Turu-trend (maaruum.ee indeks) app.html-i + kvartali-uuenduse rutiin.
10. Äripindade moodul (koos, hiljem).

## 🔒 Blokeeritud — vajab sind (konto / leping / dashboard)

- Kõneabi kokkuvõtte SAATMINE kliendi e-postile — vajab e-kirja saatmise taristut.
- Digiallkiri (Smart-ID / DigiDoc leping + konto).
- Kalendri süvaintegratsioon (OAuth) — kui vaja rohkem kui praegu.
- Supabase → Auth → "leaked password protection" sisse (ainult sinu dashboardis).
- Väiksed turva-WARN-id (storage enumeratsioon, current_role) — madal prio.

## Reeglid (et jääks korras)
Üks muudatus korraga · additiivne · süntaks + live-test · deploy GitHub Desktop · crm.html EI puutu (Raul). Tehtud rida → kustuta siit.
