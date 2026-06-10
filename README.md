# Müügiassistent Online

Müügiassistent on lihtne online töövahend kinnisvaraomanike kõnede jaoks. Põhivoog jääb:

```text
Lead → Kõne → Vastused → AI tagasiside → Järeltegevus → Statistika
```

See versioon liigub staatilisest `localStorage` prototüübist Next.js + Supabase online-rakenduseks.

## Tehniline Suund

- Next.js
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage objekti piltidele
- Serveripoolne AI endpoint
- Serveripoolne e-posti saatmine Resendiga
- .ics eksport kalendrisse lisamiseks
- Vercel deployment

## Käivitamine Lokaalselt

```bash
npm install
npm run dev
```

Ava `http://localhost:3000`.

## Supabase Setup

1. Loo Supabase projekt.
2. Ava SQL editor.
3. Käivita fail [supabase/schema.sql](./supabase/schema.sql).
4. Loo Auth kasutajad.
5. Lisa iga Auth kasutaja kohta rida `public.users` tabelisse:

```sql
insert into public.users (id, email, name, role)
values ('AUTH_USER_UUID', 'email@example.com', 'Nimi', 'admin');
```

Rollid:

- `admin`: näeb kõiki leade, saab kustutada, muuta seadeid ja saab handoff märguandeid.
- `assistant`: näeb talle määratud leade, saab lisada/muuta leade, salvestada kõnesid ja suunata müügispetsialistile.

## Environment Variables

Lisa `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
OPENAI_API_KEY=
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
APP_URL=http://localhost:3000
CRON_SECRET=
```

Oluline:

- `OPENAI_API_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, OAuth secretid ja `CRON_SECRET` peavad olema ainult serveris.
- Neid ei tohi panna brauseri JavaScripti.
- Frontendis võivad olla ainult `NEXT_PUBLIC_SUPABASE_URL` ja `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Online Deployment Vercelisse

1. Lükka projekt GitHubi.
2. Loo Vercelis uus projekt.
3. Vali see GitHub repo.
4. Lisa kõik environment variable’id Vercel Project Settings → Environment Variables alla.
5. Deploy.
6. Pane `APP_URL` väärtuseks Verceli live URL.
7. Testi login.
8. Testi leadi lisamine.
9. Testi kõne salvestamine.
10. Testi AI tagasiside.
11. Testi .ics faili eksport.
12. Testi e-posti meeldetuletus.

## AI Tagasiside

Kõnevaates on AI tagasiside nähtav kõne ajal. Nupp `Tee AI tagasiside` kutsub serveripoolset endpointi:

```text
POST /api/ai-feedback
```

AI kasutab:

- leadi infot;
- viimaseid kõnesid;
- eelmist AI kokkuvõtet;
- kõne vastuseid, kui need on salvestatud.

Kui `OPENAI_API_KEY` puudub, loob süsteem reeglipõhise fallback kokkuvõtte.

## Kohene AI Kõne Coach

Kõne vormis on lisaks kaart `AI soovitab järgmiseks`.

Kui assistent valib kõne tulemuse, hoiaku, takistuse või muu valikvastuse, saadab brauser draft-vastused serverisse:

```text
POST /api/ai-next-question
```

Server tagastab:

- mida järgmiseks küsida;
- kuidas rahulikult reageerida;
- mida vältida.

Kui `OPENAI_API_KEY` puudub, töötab reeglipõhine fallback. API võti jääb serverisse ega liigu brauserisse.

## Kalender

Süsteemis on sisemine kalender vaates `Kalender`.

Kalender näitab:

- tänased järeltegevused;
- üle tähtaja tegevused;
- selle nädala tegevused;
- tegevuse tüübi;
- seotud leadi;
- kontaktisiku;
- telefoni;
- staatuse.

Iga järeltegevuse juures on `.ics` eksport:

```text
GET /api/tasks/ics?id=TASK_ID
```

.ics faili saab lisada Google Calendarisse, Apple Calendarisse, Outlooki ja paljudesse teistesse kalendritesse.

## Kalendri Sünkroon

Esimene online-versioon toetab:

- süsteemisisest kalendrit;
- .ics faili eksporti.

Järgmine samm:

- Google Calendar OAuth;
- Microsoft Outlook / Microsoft 365 OAuth Microsoft Graph API kaudu.

iOS sünkroon toimub Apple Calendar kaudu, kui kasutaja lisab .ics faili või kasutab Google/Outlook kontot. Android sünkroon toimub Google Calendar kaudu. Windows sünkroon toimub Outlook / Microsoft 365 kaudu.

Täielikku kahepoolset sünkrooni ei tohi lubada ilma OAuth tokenite ja backendita.

## E-posti Meeldetuletused

Endpoint:

```text
GET /api/tasks/reminders
```

See otsib tegemata järeltegevusi, mille tähtaeg on üle tähtaja, täna või homme, ja saadab vastutajale e-kirja Resendi kaudu.
Tegevus märgitakse saadetuks ainult siis, kui e-kiri päriselt välja läks.

Vercelis lisa Cron Job:

```json
{
  "path": "/api/tasks/reminders",
  "schedule": "0 6 * * *"
}
```

E-kiri sisaldab:

- tegevuse tüüpi;
- aadressi;
- kontaktisikut;
- telefoni;
- tähtaega;
- kommentaari;
- linki rakendusse.

## Müügispetsialistile Märguanne

Kui assistent vajutab `Salvesta ja suuna müügispetsialistile`, siis:

1. lead staatus muutub `suunatud müügispetsialistile`;
2. tekib task müügispetsialistile;
3. tekib `notifications` kirje;
4. saadetakse e-kiri admin kasutajale, kui `RESEND_API_KEY` on olemas;
5. handoff tekst sisaldab kõne tulemust, hoiakut, takistust, järgmist sammu ja otseviidet kontaktile.

## Objekti Kuvamine

Leadi juures saab valida:

- `pilt`;
- `portaalikaart`;
- `kompaktne info`;
- `automaatne`.

Portaalikaart ei kasuta iframe’i. See näitab turvalist kaarti ja linki `Ava kuulutus`.

## Mida Järgmisena Teha

Kõige praktilisem live’i mineku järjekord:

1. Supabase projekt ja SQL skeem.
2. Auth kasutajad ja rollid.
3. Vercel deploy.
4. Resend API võti.
5. OpenAI API võti.
6. Cron meeldetuletused.
7. Google Calendar OAuth.
8. Microsoft Calendar OAuth.
