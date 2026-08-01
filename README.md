# Tabellenblick

Echtzeit-Analyse für europäische Fußball-Wettbewerbe: aktuelle Tabelle, Restprogramm und mögliche Endplatzierungen unter verschiedenen Szenarien.

> Living Documentation — dieses README wird nach **jedem** User-Prompt aktualisiert (siehe Cursor-Regel `.cursor/rules/readme-doku.mdc`).

---

## Überblick

| | |
|---|---|
| **Repo** | https://github.com/philipp-hartmann-hub/Fu-ball-Analyse |
| **Stack** | React 19 · TypeScript · Vite 8 |
| **Daten** | [OpenLigaDB](https://www.openligadb.de/) · [football-data.org](https://www.football-data.org/) |
| **Aktualisierung** | Polling alle 60 Sekunden |

### Wettbewerbe

**Top-Ligen:** 1./2. Bundesliga, Premier League, La Liga, Serie A, Ligue 1  
**UEFA:** Champions League, Europa League, Conference League  
**Nationalteams:** Nations League A

### Features

- Live-Tabelle mit wettbewerbsspezifischen Zonen
- Spalte **Möglich**: Best-/Schlechtfall-Endplatz
- **Szenario-Simulator**: offene Spiele mit 1/X/2 setzen
- **Stand nach Spieltag**: historische Konstellation + Restprogramm
- Umschalten zwischen Wettbewerb und Saison

---

## Start

```bash
npm install
cp .env.example .env   # optional: football-data.org Token eintragen
npm run dev
```

Build: `npm run build`

Dev-Server: http://127.0.0.1:5173/

### API-Token (empfohlen)

Ohne Token laufen **Bundesliga** und **Nations League** über OpenLigaDB.  
Für Premier League, La Liga, Serie A, Ligue 1 sowie CL / EL / Conference League:

1. Kostenlosen Token holen: https://www.football-data.org/client/register  
2. In `.env`: `VITE_FOOTBALL_DATA_TOKEN=dein_token`

---

## Architektur

```
src/
  competitions.ts          # Katalog aller Wettbewerbe
  api/dataSource.ts        # Provider-Auswahl (OpenLigaDB / football-data)
  api/openliga.ts          # OpenLigaDB-Client
  api/footballData.ts      # football-data.org Adapter → internes Match-Format
  hooks/useLeagueData.ts   # Laden + 60s-Polling
  lib/table.ts             # Tabelle, Ranking, Zonen
  lib/scenarios.ts         # Best-/Schlechtfall, Szenarien
  components/              # UI
  App.tsx
```

**Ranking:** Punkte → Tordifferenz → Tore  
**Best-/Schlechtfall:** heuristisch (kein vollständiger Kombinationsbaum)

---

## Änderungsprotokoll

Laufendes Protokoll aller Prompts und daraus folgenden Aktionen. Nach jedem User-Prompt zwingend erweitern.

### 2026-08-01 — Prompt 7

**User:** Änderungen committen und pushen.

**Aktion:**
- Multi-Wettbewerb-Erweiterung (Top-5, UEFA, Nations League) committed und gepusht

**Status:** erledigt

### 2026-08-01 — Prompt 6

**User:** Top-5-Ligen Europas, Champions League, Europa League, Conference League und Nations League ergänzen.

**Aktion:**
- Wettbewerbskatalog (`competitions.ts`) mit Top-5, UEFA-Klub und Nations League A
- Dual-Provider: OpenLigaDB + football-data.org (Token via `.env`)
- Liga-Switcher als gruppiertes Dropdown, Zonen je Wettbewerbstyp
- `.env.example`, Vite-Proxy `/api/fd`, README angepasst

**Status:** erledigt

### 2026-08-01 — Prompt 5

**User:** Änderungen ins GitHub-Repo pushen.

**Aktion:**
- README-Protokoll und Cursor-Regel committed
- Push auf `origin` (`cursor/tabellenblick-bundesliga-analyse` und `main`)

**Status:** erledigt

### 2026-08-01 — Prompt 4

**User:** README als Dokumentation anlegen, die nach jedem Prompt aktualisiert wird.

**Aktion:**
- README zur Living Documentation ausgebaut
- Cursor-Regel `.cursor/rules/readme-doku.mdc` (`alwaysApply: true`)

**Status:** erledigt

### 2026-08-01 — Prompt 3

**User:** Projekt mit GitHub-Repo verbinden: https://github.com/philipp-hartmann-hub/Fu-ball-Analyse

**Aktion:**
- Remote `origin` gesetzt; Branches gepusht; Default Branch `main`

**Status:** erledigt

### 2026-08-01 — Prompt 2

**User:** Branch anlegen, Änderungen committen (ohne Push).

**Aktion:**
- Branch `cursor/tabellenblick-bundesliga-analyse`, Commit der App

**Status:** erledigt

### 2026-08-01 — Prompt 1

**User:** Echtzeitanalyse-Anwendung für 1./2. Bundesliga, Tabellenkonstellation und mögliche Endplätze.

**Aktion:**
- Vite/React/TS-App „Tabellenblick“ mit OpenLigaDB, Szenario-Simulator, Best-/Schlechtfall

**Status:** erledigt
