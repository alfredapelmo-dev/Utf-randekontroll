# Utförandekontroll – Demo (helt offline)

En **helt offline** PWA som demonstrerar och validerar kärn‑UX:t för brand­besiktning
och utförandekontroll – utan backend, inloggning eller molnberoende. Byggd enligt
`Prompt_Demo.txt` och `Datamodell.txt`.

Demon är **Steg 1** i trappan: **Demo → Beta → Produktion**. Den är medvetet byggd så
att Beta kan koppla på Azure AD, SharePoint/Graph och synk genom att **byta
repository‑implementation – utan att skriva om UI:t**.

---

## Snabbstart

Inget bygg­steg, ingen `npm install`. Bara en statisk server (för att service worker
och `fetch` av seed‑data ska fungera – `file://` räcker inte).

```bash
# från mappen som innehåller Demo/
python Demo/tools/serve.py
# öppna http://localhost:8000
```

Eller valfri statisk server, t.ex. `cd Demo && python -m http.server 8000`.

### Testa på iPhone/iPad (Safari)

1. Kör `python Demo/tools/serve.py` på datorn (skriver ut din IP‑adress).
2. Öppna `http://<datorns-ip>:8000` i Safari på samma wifi.
3. Appen fungerar direkt. Prova att slå på **flygplansläge** – allt utom första
   inläsningen fungerar lokalt (IndexedDB).
4. **Äkta PWA‑offline / “Lägg till på hemskärmen”** kräver säker kontext (HTTPS
   eller `localhost`). Service workern registreras därför bara där. Över LAN med
   vanlig HTTP körs appen ändå fullt ut, men registrerar ingen offline‑cache. För
   en fullständig PWA‑demo på iPhone: kör bakom HTTPS (t.ex. en lokal tunnel) eller
   testa offline‑cachen på desktop via `localhost`.

> Kärnan i demon – ingen inloggning, ingen molntrafik, all data lokalt – är alltså
> demonstrerbar oavsett, och service workern lägger till äkta flygplansläges‑start
> i säker kontext.

---

## Arkitektur och designval

### Varför “build‑less” React i stället för Vite/CRA?

Prompten anger React (*“motivera om du föreslår annat”*). Vi använder **React** –
samma komponentmodell och samma hooks som slutprodukten – men laddat som lokalt
vendrade UMD‑bibliotek tillsammans med [htm](https://github.com/developit/htm) för
JSX‑liknande mallar. Motiv:

- **Inget byggsteg och ingen toolchain** behövs för att köra demon offline – öppna
  via en statisk server och kör. Det matchar promptens mål: *“gå att köra på en
  iPhone/iPad i Safari och på desktop utan internet”* och *“flygplansläge från
  första start”*.
- **Forward‑kompatibelt där det räknas:** kravet *“UI‑koden ska INTE behöva ändras”*
  gäller bytet `LocalRepository → GraphRepository`. Det beror enbart på
  repository‑interfacet (se nedan), inte på byggverktyget. Komponenterna kan flyttas
  rakt in i ett Vite/JSX‑projekt i Beta; `html\`...\`` ↔ JSX är en mekanisk ändring.

Alla bibliotek ligger lokalt i `vendor/` (React, ReactDOM, htm, idb, jsPDF). Inget
hämtas från internet vid körning.

### Lagerindelning (matchar Beta/Produktion)

```
UI (React-komponenter)
        │  pratar ENBART med ↓
Repository-interface  (src/repository.js)
        │  Demo-implementation ↓        Beta byter till GraphRepository här
LocalRepository  →  IndexedDB (idb)  +  syncQueue  (src/db.js)
```

- **`Repository`** definierar kontraktet (projekt, avvikelser, foton, ritningar,
  synk‑kö). UI:t känner aldrig till IndexedDB.
- **`LocalRepository`** läser/skriver IndexedDB via `idb`, sätter synk‑metafält
  (`_spId`, `_etag`, `_dirty`) och lägger pending‑operationer i en **syncQueue** –
  exakt det en `GraphRepository` behöver för offline‑first‑synk i Beta.
- **Datamodell** (`src/models.js`, `src/seed.js`) speglar de tänkta SharePoint‑
  listorna (Projekt, Avvikelser) inkl. klientgenererat **GUID** per post och
  **relativa koordinater (0–1)** på ritningen. Object stores enligt avsnittet
  “LOKAL LAGRING” i `Datamodell.txt`.
- **Statusmodell och färger** är identiska genom hela trappan:
  Röd = Öppen, Gul = Åtgärdad, Grön = Verifierad.

### Filöversikt

| Fil | Ansvar |
|---|---|
| `index.html` | App‑skal, laddar vendrade UMD‑globaler + `src/main.js` |
| `src/db.js` | IndexedDB‑schema (object stores + index) via `idb` |
| `src/repository.js` | `Repository`‑interface + `LocalRepository` + syncQueue |
| `src/models.js` | Domänkonstanter, GUID, statusfärger, rollbehörigheter |
| `src/seed.js` | Seedar mockprojekt, ritning och avvikelser vid första start |
| `src/pdf.js` | Klientsidig PDF (jsPDF): ritningsutsnitt, foton, signatur |
| `src/iso7010.js` | ISO 7010‑symboler som SVG‑lager |
| `src/components/*` | Projektvy, Ritningsvy, Avvikelseformulär, Protokoll, Roll |
| `service-worker.js` | Förcachar app‑skalet → flygplansläges‑start |
| `tools/serve.py` | Lokal statisk server (rätt MIME, LAN‑åtkomst) |
| `tools/generate_assets.py` | Genererar ritning, exempelfoton och PWA‑ikoner |

---

## Roller (endast UI)

Dropdown **“Visa som”** styr vilka funktioner som visas – ingen riktig behörighet,
mappas senare mot Azure AD‑roller:

| Roll | Skapa | Redigera fält | Ändra status | Verifiera | Foto | PDF |
|---|---|---|---|---|---|---|
| **Besiktningsman** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Entreprenör** | – | beskrivning | → Åtgärdad | – | ✓ | ✓ |
| **Läsare** | – | – | – | – | – | ✓ |

---

## Leveransordning – Definition of Done

| Steg | Innehåll | Var |
|---|---|---|
| **D0** Skelett + datalager | React, IndexedDB via idb, repository‑interface + LocalRepository, GUID, seed | `db.js`, `repository.js`, `seed.js`, `main.js` |
| **D1** Projektvy | Lista mockprojekt, öppna projekt, tomt‑läge | `components/ProjectList.js` |
| **D2** Ritningsvy | Pan/zoom (touch+mus), tap → koordinat (relativ), färgkodade markörer | `components/DrawingView.js` |
| **D3** Avvikelse | Skapa/redigera alla fält + GUID, kvarstår offline, statusfärg på ritning | `components/DeviationForm.js` |
| **D4** Foto | Kamera/bibliotek → Blob i IndexedDB, visas, överlever omladdning | `DeviationForm.js`, `repository.addPhoto` |
| **D5** PDF‑protokoll | Genereras offline: projektinfo, ritningsutsnitt, foton, statuslista, signatur | `components/Protocol.js`, `pdf.js` |
| **D6** Rollväljare | Dropdown byter synliga funktioner per roll | `components/RoleSelector.js`, `models.js` |

### Så verifierar du varje steg

- **D0/D1:** Ladda sidan offline → tre mockprojekt listas. Öppna ett. (DevTools →
  Application → IndexedDB → `utfk-demo` visar object stores och poster.)
- **D2:** Nyp‑zooma och dra på iPhone. Tryck på tom yta → nytt avvikelse‑formulär med
  ifylld koordinat (X/Y i 0–1). Befintliga markörer är röda/gula/gröna.
- **D3:** Skapa/ändra en avvikelse, ladda om sidan (även i flygplansläge) → kvarstår;
  markörens färg följer status.
- **D4:** Lägg till foto i en avvikelse → syns som miniatyr, kvarstår efter omladdning.
- **D5:** “Protokoll” → signera → “Generera PDF” → en PDF laddas ner/öppnas.
- **D6:** Byt roll i “Visa som” → knappar/funktioner ändras (t.ex. Läsare kan inte
  skapa eller redigera).

---

## Ingår inte (kommer i Beta)

Azure AD/MSAL, SharePoint/Graph, molnsynk, säkerhetshärdning (CSP, PIN‑lås,
inaktivitets‑timeout, Sites.Selected) och Word‑export. Datalagret är dock redan
förberett för synk via `syncQueue` och synk‑metafälten. Se `Prompt_Beta.txt`.

---

## Nollställa demon

DevTools → Application → IndexedDB → ta bort `utfk-demo` (och avregistrera service
workern under Application → Service Workers), ladda om → seedas på nytt.
