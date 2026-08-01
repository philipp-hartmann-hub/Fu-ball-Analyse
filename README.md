# Tabellenblick

Echtzeit-Analyse für die **1. und 2. Bundesliga**: aktuelle Tabelle, Restprogramm und mögliche Endplatzierungen unter verschiedenen Szenarien.

> Living Documentation — dieses README wird nach **jedem** User-Prompt aktualisiert (siehe Cursor-Regel `.cursor/rules/readme-doku.mdc`).

---

## Überblick

| | |
|---|---|
| **Repo** | https://github.com/philipp-hartmann-hub/Fu-ball-Analyse |
| **Stack** | React 19 · TypeScript · Vite 8 |
| **Daten** | [OpenLigaDB](https://www.openligadb.de/) (`bl1` / `bl2`) |
| **Aktualisierung** | Polling alle 60 Sekunden |

### Features

- Live-Tabelle mit Zonen (Meister, CL, EL, Abstieg)
- Spalte **Möglich**: Best-/Schlechtfall-Endplatz je Verein
- **Szenario-Simulator**: offene Spiele mit 1/X/2 setzen → Tabelle reagiert sofort
- **Stand nach Spieltag**: historische Konstellation wählen und Restprogramm durchspielen
- Umschalten zwischen 1./2. Liga und Saisons

---

## Start

```bash
npm install
npm run dev
```

Build: `npm run build`

Dev-Server: http://127.0.0.1:5173/ (OpenLigaDB läuft im Dev über Vite-Proxy `/api/openliga`)

---

## Architektur

```
src/
  api/openliga.ts          # OpenLigaDB-Client + Saison-Default
  hooks/useLeagueData.ts   # Laden + 60s-Polling
  lib/table.ts             # Tabelle aus Spielen, Ranking, Zonen
  lib/scenarios.ts         # Best-/Schlechtfall, Szenario-Ergebnisse
  components/              # UI: Liga-Switcher, Tabelle, Insight, Simulator
  types.ts                 # Domänen-Typen
  App.tsx                  # Orchestrierung
```

**Ranking:** Punkte → Tordifferenz → Tore  
**Best-/Schlechtfall:** heuristisch (kein vollständiger Kombinationsbaum über alle Restspiele)

---

## Änderungsprotokoll

Laufendes Protokoll aller Prompts und daraus folgenden Aktionen. Nach jedem User-Prompt zwingend erweitern.

### 2026-08-01 — Prompt 5

**User:** Änderungen ins GitHub-Repo pushen.

**Aktion:**
- README-Protokoll und Cursor-Regel committed
- Push auf `origin` (`cursor/tabellenblick-bundesliga-analyse` und `main`)

**Status:** erledigt

### 2026-08-01 — Prompt 1

**User:** Echtzeitanalyse-Anwendung für 1./2. Bundesliga, insbesondere Tabellenkonstellation und mögliche Endplätze unter Szenarien.

**Aktion:**
- Projekt in `~/Fußball-Analyse` als Vite/React/TS-App „Tabellenblick“ aufgesetzt
- OpenLigaDB-Anbindung (1./2. Liga), Tabelle, Szenario-Simulator, Best-/Schlechtfall-Spanne
- Live-Polling, Spieltag-Cutoff, UI

**Status:** erledigt

### 2026-08-01 — Prompt 2

**User:** Branch anlegen, Änderungen committen (ohne Push).

**Aktion:**
- Branch `cursor/tabellenblick-bundesliga-analyse`
- Commit `eddb3ae` — Add Tabellenblick app for Bundesliga table scenario analysis.

**Status:** erledigt

### 2026-08-01 — Prompt 3

**User:** Projekt mit GitHub-Repo verbinden: https://github.com/philipp-hartmann-hub/Fu-ball-Analyse

**Aktion:**
- Remote `origin` gesetzt
- Branches `main` und `cursor/tabellenblick-bundesliga-analyse` gepusht
- Default Branch auf `main` gesetzt

**Status:** erledigt

### 2026-08-01 — Prompt 4

**User:** README als Dokumentation anlegen, die nach jedem Prompt aktualisiert wird.

**Aktion:**
- README zur Living Documentation ausgebaut (Überblick, Architektur, Änderungsprotokoll)
- Cursor-Regel `.cursor/rules/readme-doku.mdc` (`alwaysApply: true`)

**Status:** erledigt
