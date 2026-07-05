# Mell — hoolduskaart (välised allikad)

Kaardistatud koodist 05.07.2026. Eesmärk: teada, kus hoolduskulu päriselt on, et hiljem ei peaks jamama.

Põhimõte: **töö-hooldus on madal (Vercel + Supabase hallatud, üks staatiline fail). Kogu päris kulu on välistes allikates.** Need murduvad, kui allikas oma poole muudab.

## Välised allikad — habrasus ja fail-safe

| Allikas | Kasutus | Rada | Habrasus | Fail-safe | Hoiatab sind? |
|---|---|---|---|---|---|
| Maa-amet htraru (turuhind) | €/m² mediaan, tehingud | market-price (Scrapfly kaudu) | **KÕRGE** — scraping, vorm võib muutuda | JAH — timeout + catch | JAH (source_health), aga sa ei näe seda veel |
| Portaalid (kv.ee, city24, kinnisvara24) | Kuulutuse import | fetch-listing / read-listing (Scrapfly) | **KÕRGE** — bot-blokk + HTML muutub | Osaline — catch olemas | EI |
| Scrapfly (scraping-proxy) | Ülal 2 allika alus | market-price + read-listing | **KESKMINE** — tasuline, kvoot/arve | Sõltub kutsujast | EI |
| EHR (livekluster.ehr.ee) | Ehitise faktid | ehr | **KESKMINE-KÕRGE** — API rajad on varem 404 andnud | catch + timeout | EI |
| in-ADS (inaadress.maaamet.ee) | Aadressiotsing | ehr | **KESKMINE** — ametlik API, stabiilsem | catch + timeout | EI |
| Overpass / OSM | Lähedal POI (pood, kool) | nearby | **KESKMINE** — avalik, rate-limit | catch + timeout | EI |
| Mapbox | Staatiline kaart | staticmap | **MADAL** — stabiilne, võtme-põhine | catch, **timeout puudub** | EI |
| Anthropic (Claude) | Mell tekstid, hindamine | ai, mell-ask | **MADAL-KESKMINE** — mudeli-nimi võib aeguda | catch | EI |
| OpenAI | Kõne-tagasiside, järgküsimus | ai-feedback, ai-next-question | **MADAL-KESKMINE** — teine vendor | catch | EI |
| Outlook / MS Graph | Postkast | outlook/* | **KESKMINE** — OAuth token, Azure app, secret | Osaline — status-rajal **catch puudub**, timeout puudub | EI |

Infra (madal hooldus): Vercel (staatiline + serverless), Supabase (hallatud DB), cron tasks/reminders (iga päev 06:00).

## Kus on su suurim risk täna

**1. Süsteem ei hoiata sind.** Ainult Maa-amet htraru kirjutab source_health'i — ja sedagi sa ei näe kuskil UI-s. Kõik ülejäänud allikad kukuvad **vaikselt**. Reegel "süsteem ütleb SULLE, mitte klient" pole veel päriselt teostatud. See on kõige mõjusam parandus.

**2. Scrapfly on ühine kitsaskoht.** Kui Scrapfly võti/kvoot lõppeb, kukuvad KORRAGA turuhind JA portaali-import. Üks arve = kaks katkist funktsiooni.

**3. Kaks AI-vendorit.** Anthropic + OpenAI = topelt hoolduspind (kaks võtit, kaks hinnastust, kaks API-muutust jälgida). Kaalu ühele koondamist.

**4. Ajapiirid puudu.** staticmap, outlook — pikalt rippuv väline kutse võib päringu kinni jätta. Lisa timeout.

**5. outlook/status ilma catch'ita.** Võib visata vea. Mähi try/catch'i.

## Parandusjärjekord (kui hooldus madalaks)

1. **Tervise-riba Meelisele** — üks koht, mis loeb source_health'i ja näitab rohelist/kollast/punast iga allika kohta. Ja iga allikas kirjutab source_health'i (mitte ainult Maa-amet). → teostab reegli "süsteem hoiatab ise".
2. **Timeout + catch puuduolevatele** (staticmap, outlook/status, outlook/messages).
3. **Kaalu AI koondamist** ühele vendorile.
4. **Scrapfly kvoodi-hoiatus** — kui krediit otsakorral, teata enne kui kukub.

Vt ka mälu: andmeallikate-fail-safe, andmeallikad-register, portaalide-bot-blokk, konkurent-voog-roadmap.
