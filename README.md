# Tabellenblick

Echtzeit-Analyse für die **1. und 2. Bundesliga**: Tabelle, Restprogramm und mögliche Endplätze unter Szenarien.

> Living Documentation — nach **jedem** User-Prompt aktualisieren (`.cursor/rules/readme-doku.mdc`).

---

## Überblick

| | |
|---|---|
| **Repo** | https://github.com/philipp-hartmann-hub/Fu-ball-Analyse |
| **Stack** | React 19 · TypeScript · Vite 8 |
| **Daten** | [OpenLigaDB](https://www.openligadb.de/) (`bl1` / `bl2`) – ohne API-Token |
| **Scope** | Nur 1. und 2. Bundesliga (andere Wettbewerbe bewusst zurückgestellt) |

### Features

- Live-Tabelle mit Zonen (BL1: CL/EL/Abstieg · BL2: Aufstieg/Abstieg)
- Spalte **Möglich**: Best-/Schlechtfall bis Saisonende
- Vereinsanalyse: **nach nächstem Spieltag** (exakt) und **Saisonende** (heuristisch)
- Spalte **Δ**: Platzveränderung durch gesetzte Szenarien
- **Szenario-Simulator**: 1/X/2, optional nur Fokusverein
- **Stand nach Spieltag**: Slider für historische Konstellation

---

## Start

```bash
npm install
npm run dev
```

Build: `npm run build`

---

## Architektur

```
src/
  leagues.ts               # bl1 / bl2
  api/openliga.ts          # OpenLigaDB
  api/dataSource.ts        # Liga-Laden
  hooks/useLeagueData.ts   # 60s-Polling
  lib/table.ts             # Tabelle, Ranking, Zonen
  lib/scenarios.ts         # Saison-Heuristik + exakter nächster Spieltag
  components/              # UI
  App.tsx
```

---

## Änderungsprotokoll

### 2026-08-01 — Prompt 14

**User:** Screenshot der Vereinsanalyse – Spieltag-Spanne fehlt weiterhin.

**Aktion:**
- Ursache: Vercel zeigte veraltetes `main` (ohne Feature); aktueller Stand auf `main` gepusht für Redeploy
- Lokal/Feature-Branch hatte die UI bereits

**Status:** erledigt

### 2026-08-01 — Prompt 13

**User:** Änderungen committen und pushen.

**Aktion:**
- Vereinsanalyse-Spieltag-Umschalter und Auto-Cutoff committed und gepusht

**Status:** erledigt

### 2026-08-01 — Prompt 12

**User:** Spieltag-Best-/Schlechtfall in der Vereinsanalyse nicht sichtbar.

**Aktion:**
- Umschalter „Nächster Spieltag“ / „Saisonende“ (Standard: nächster Spieltag)
- Bei abgeschlossener Saison automatisch „Stand nach Spieltag“ vor dem letzten Spieltag
- Leerer Zustand mit Button zum Setzen des Spieltag-Stands
- Sticky Vereinsanalyse-Spalte

**Status:** erledigt

### 2026-08-01 — Prompt 11

**User:** Änderungen committen und pushen.

**Aktion:**
- BL1/BL2-Fokus, UI-Politur und Spieltag-Outlook committed und gepusht

**Status:** erledigt

### 2026-08-01 — Prompt 10

**User:** Best-/Schlechtfall gilt für die gesamte Spielzeit – Zusatz: mögliche Plätze nach dem nächsten Spieltag.

**Aktion:**
- Vereinsanalyse zeigt zwei Spannen: „Nach Spieltag N“ (exakte Enumeration aller 1/X/2) und „Saisonende“ (Heuristik Restprogramm)
- Gegner / Hinweis wenn der Verein an dem Spieltag spielfrei ist

**Status:** erledigt

### 2026-08-01 — Prompt 9

**User:** Erstmal nur 1./2. Bundesliga; kein Commit; Bestehendes perfektionieren.

**Aktion:** Scope BL1/BL2, Zonenlegende, Δ, Slider, Fokus-Filter (lokal, nicht committed)

**Status:** erledigt

### 2026-08-01 — Prompt 8–1

Frühere Multi-Liga-/Doku-Schritte: siehe Git-History.
