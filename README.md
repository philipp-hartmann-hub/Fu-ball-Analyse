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

- Intro-Animation beim Seitenaufruf (Spielfeld, Ball, Tabellenblick; überspringbar)
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
  leagues.ts
  api/openliga.ts / dataSource.ts
  hooks/useLeagueData.ts
  lib/table.ts / scenarios.ts
  components/Intro.tsx     # Splash-Animation
  components/…             # UI
  App.tsx
```

---

## Änderungsprotokoll

### 2026-08-01 — Prompt 23

**User:** Grob-Anzeige: Sieg Verein 1, Sieg Verein 2, Unentschieden.

**Aktion:**
- Grob-Buttons mit Vereinsnamen statt Sieg/Niederlage
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 22

**User:** Szenario-Simulator: Grob (Sieg/Unentschieden/Niederlage) und Fein (konkretes Ergebnis); kein 1/X/2.

**Aktion:**
- Modus Grob/Fein im Simulator
- Grob: Sieg · Unentschieden · Niederlage (Heim-Sicht), Defaults 1:0 / 0:0 / 0:1
- Fein: Toreingabe Heim:Auswärts
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 21

**User:** Best-/Worst-Case-Pathways in der Vereinsanalyse; bei Saison ggf. erst nur nächster Spieltag; Pathway nur per Klick.

**Aktion:**
- Nächster Spieltag: exakte Best-/Worst-Pathways (1/X/2 je Spiel), per Klick auf Bestfall/Schlechtfall einblendbar
- Gesamte Saison: weiterhin Spanne ohne Pathway (zu komplex)
- Build-Hash im Footer; Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 20

**User:** Screenshot – Vereinsanalyse zeigt weiter nur eine Spanne (Vercel).

**Aktion:**
- Ursache: URL `…-b6r8knoes-…` ist ein **fixes Preview-Deployment**, aktualisiert sich nicht mit `main`
- Build-Hash im Footer ergänzt zur Versionsprüfung
- Hinweis: Production-URL in Vercel öffnen (nicht alte Preview-URL)

**Status:** erledigt

### 2026-08-01 — Prompt 19

**User:** Beide Varianten getrennt, jederzeit zwei Versionen direkt untereinander in der Vereinsanalyse.

**Aktion:**
- Drei getrennte Panels rechts: Verein · Nächster Spieltag · Gesamte Saison
- Auf `main` für Vercel gepusht

**Status:** erledigt

### 2026-08-01 — Prompt 18

**User:** In der Vereinsanalyse zwei Varianten sichtbar: gesamte Saison und nächster Spieltag.

**Aktion:**
- Umschalter entfernt; beide Spannen gleichzeitig: „Variante A · Nach Spieltag N“ und „Variante B · Gesamte Saison“
- Auf `main` gepusht für Vercel

**Status:** erledigt

### 2026-08-01 — Prompt 17

**User:** Intro erscheint auf Vercel nicht; Seite zeigt sofort die Tabelle. Prüfung nur noch über Vercel.

**Aktion:**
- Intro überspringt `prefers-reduced-motion` nicht mehr (stattdessen kürzere, statische Variante)
- App hinter Intro komplett unsichtbar, bis Intro fertig
- Fix auf `main` gepusht für Vercel-Redeploy

**Status:** erledigt

### 2026-08-01 — Prompt 16

**User:** Intro-Änderungen pushen.

**Aktion:**
- Intro-Animation committed und auf Feature-Branch sowie `main` gepusht (Vercel)

**Status:** erledigt

### 2026-08-01 — Prompt 15

**User:** Beim Aufrufen der Seite eine thematisch passende, spektakuläre Intro-Animation.

**Aktion:**
- `Intro`-Overlay: animiertes Spielfeld, Ballflug, Platzziffern, Marken-Reveal, Mini-Tabelle
- Überspringen per Klick/Button; `prefers-reduced-motion` überspringt komplett
- App blendet danach ein

**Status:** erledigt

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
