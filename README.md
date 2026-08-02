# Tabellenblick

Echtzeit-Analyse für die **1. und 2. Bundesliga**: Tabelle, Restprogramm und mögliche Endplätze unter Szenarien.

> Living Documentation — nach **jedem** User-Prompt aktualisieren (`.cursor/rules/readme-doku.mdc`).

---

## Überblick

| | |
|---|---|
| **Repo** | https://github.com/philipp-hartmann-hub/Fu-ball-Analyse |
| **Stack** | React 19 · TypeScript · Vite 8 · Vitest |
| **Daten** | [OpenLigaDB](https://www.openligadb.de/) (`bl1` / `bl2`) – ohne API-Token |
| **Scope** | Nur 1. und 2. Bundesliga (andere Wettbewerbe bewusst zurückgestellt) |
| **Tests** | `npm run test` · Watch: `npm run test:watch` |

### Features

- Live-Tabelle mit Zonen (BL1: CL/EL/Abstieg · BL2: Aufstieg/Abstieg)
- **Live-Spiele**: laufende Partien über der Tabelle; Polling 20s während Live, sonst 60s; optional Zwischenstände einrechnen
- Spalte **Möglich**: Best-/Schlechtfall bis Saisonende (**Spanne**) oder Monte-Carlo-**Prognose** (umschaltbar)
- Optionale Spalte **Härte**: Restprogramm-Härte 0–100 (Toggle „Restprogramm“; auf Mobile ausgeblendet)
- Vereinsanalyse: **nach nächstem Spieltag** (exakt) und **Saisonende** (heuristisch), inkl. Restprogramm-Härte
- **Vereinsvergleich**: zwei Teams nebeneinander (Tabelle, Restprogramm, Härte; Direktspiele hervorgehoben)
- Spalte **Δ**: Platzveränderung durch gesetzte Szenarien
- **Szenario-Simulator**: Grob/Fein je Spieltag (Default: nächster); teilbar via `?s=`
- **Stand nach Spieltag**: Slider für historischen Stand
- Toolbar: **Link teilen** (Zwischenablage) und **Zurücksetzen** (Szenarien + `?s=`)

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
  lib/table.ts / scenarios.ts / schedule.ts / simulation.ts / thresholds.ts
  components/…             # UI
  App.tsx
```

---

## Änderungsprotokoll

### 2026-08-02 — Prompt 44

**User:** Live-Darstellung laufender Spiele + schnelleres Polling + Toggle Live-Stände.

**Aktion:**
- `lib/live.ts` + Tests; `useLeagueData` mit 20s/60s Intervall (Abort nur bei load-Wechsel)
- `LiveMatchesBar` mit Score-Flash
- Toggle „Live-Stände einrechnen“ → Zwischenstände als Szenarien in `buildStandings`

**Status:** erledigt

### 2026-08-02 — Prompt 43

**User:** Überall bei Modellrechnungen Erklär-Pop-ups; auch für künftige Prompts.

**Aktion:**
- Zentrale Topics in `modelExplanations.tsx` (Prognose, Spanne, Schwellen, Härte)
- `ExplainModal` + `ExplainLink`; Einbindung in Tabelle, Analyse, Vergleich
- Projektregel `.cursor/rules/model-explain-popups.mdc` (`alwaysApply`)

**Status:** erledigt

### 2026-08-02 — Prompt 42

**User:** Vergleichsansicht für zwei Vereine (Dropdown, Restprogramm, Härte, Direktspiel).

**Aktion:**
- Neue Komponente `TeamCompare.tsx`
- Side-Tab „Analyse | Vergleich“ in `App.tsx`
- Responsive: Mobile untereinander; H2H-Spiele hervorgehoben

**Status:** erledigt

### 2026-08-02 — Prompt 41

**User:** Restprogramm-Härte bei Saisonstart bedeutungslos (leicht / Rang 10/18).

**Aktion:**
- `scaleHardnessIndex`: Epsilon `(max−min) < 1e-9` → Index 50 (kein Rauschen-Ranking)
- `reliable`-Flag ab Median ≥ `MIN_GAMES_FOR_HARDNESS` (5)
- UI: bei `reliable:false` „noch keine Aussage (zu wenige Spiele)“, kein Tone/Rang

**Status:** erledigt

### 2026-08-02 — Prompt 40

**User:** Fehlerhafte Punktschwellen bei Saisonstart beheben (`deriveThresholdLines`).

**Aktion:**
- Saison (`exact: false`): nur qualitative Extremfall-Aussagen, keine „ab X Pkt.“; offen (Ziel∧Abstieg) → []
- Spieltag: `reachableMax` (Pkt.+0/3), Regime-Guard, Labels „Nach Spieltag: …“
- Tests für Saisonstart, Klassenerhalt-Schwelle, CL weg, reachableMax-Cap

**Status:** erledigt

### 2026-08-02 — Prompt 39

**User:** Restprogramm-Härte pro Verein; Spalte (Toggle) + Vereinsanalyse; Modul `schedule.ts`.

**Aktion:**
- `src/lib/schedule.ts`: `remainingStrength` / `computeScheduleHardness` (PPG-Gegner, Heim/Auswärts-Gewichte, Index 0–100 + Liga-Rang)
- Unit-Tests gegen Mini-Liga-Fixture
- Tabellen-Toggle „Restprogramm“, farbcodierte Spalte `col-hardness` (Mobile ausgeblendet)
- Anzeige in `TeamInsight`

**Status:** erledigt

### 2026-08-02 — Prompt 38

**User:** Codebase-Exploration als Kontext für „Restprogramm-Härte“ (remaining schedule strength).

**Aktion:**
- Recherche: `remainingMatches`, `StandingRow`/`Match`, `StandingsTable` (Spalten/`col-form`, View-Toggle Spanne/Prognose), Datenfluss in `App.tsx` → Tabelle/`TeamInsight`, Fixtures `miniLeague.ts`, schedule-nahe Hilfen in `scenarios.ts`/`simulation.ts`, mobile CSS für optionale Spalten
- Keine Feature-Implementierung

**Status:** erledigt

### 2026-08-02 — Prompt 37

**User:** Vereinsanalyse: Schwellen Klassenerhalt/CL/Aufstieg + benötigte Punkte.

**Aktion:**
- `thresholds.ts` + Enumeration/Extreme aus `scenarios.ts`
- Anzeige in TeamInsight (Spieltag exakt, Saison als Schätzung)
- 52 Tests grün

**Status:** erledigt

### 2026-08-02 — Prompt 36

**User:** DFL-Reihenfolge bei Punktgleichheit (Direktvergleich) statt Alphabet.

**Aktion:**
- `resolveMatchScores` + H2H-Mini-Liga in `rankStandings`
- Szenarien/Simulation/Outlook nutzen dieselben Scores
- Unit-Tests 2er/3er-H2H inkl. Umkehr vs. Gesamt-Auswärtstore

**Status:** erledigt

### 2026-08-02 — Prompt 35

**User:** Popup, das die Modellrechnung erklärt.

**Aktion:**
- `ModelInfoModal` + Link „Modell erklären“ in der Prognose-Zeile
- Push auf Feature-Branch und `main`

**Status:** erledigt

### 2026-08-02 — Prompt 34

**User:** Wahrscheinlichkeitsbasierte Saisonprognose (Poisson-MC) als Alternative zur Spanne.

**Aktion:**
- `simulation.ts`: Stärken, Poisson, seedbarer RNG, Zone-Probabilitäten via `zoneForRank`
- `applyScore` aus `table.ts` exportiert; Worker `simulate.ts` + Hook
- UI: Umschalter Spanne/Prognose in der Tabelle
- Tests: 41 grün

**Status:** erledigt

### 2026-08-02 — Prompt 33

**User:** Szenarien über URL teilen (`?s=`), Link-teilen-Button, Zurücksetzen.

**Aktion:**
- `src/lib/shareState.ts` (base64url JSON: Liga, Saison, Cutoff, Szenarien)
- Sync per `history.replaceState`; Boot aus `?s=`; robustes Decode
- Toolbar: „Link teilen“ + „Zurücksetzen“
- Unit-Tests Round-Trip (`shareState.test.ts`)

**Status:** erledigt

### 2026-08-02 — Prompt 32

**User:** Vitest einrichten + Unit-Tests für analytische Kernlogik (Regressionsschutz).

**Aktion:**
- `vitest` + `@vitest/coverage-v8`, Scripts `test` / `test:watch`
- Fixtures `src/lib/__fixtures__/miniLeague.ts` (4 Teams)
- Tests: `table.test.ts`, `scenarios.test.ts` (21 grün)

**Status:** erledigt

### 2026-08-01 — Prompt 31

**User:** Intro entfernen; Pathways und Konstellationen entfernen (verwirren).

**Aktion:**
- Intro komplett entfernt
- Pathways/Konstellations-Zähler entfernt; Best-/Schlechtfall nur noch als Platzangabe
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 30

**User:** Intro nur langes Grün, keine sichtbare Animation bis zur Karte.

**Aktion:**
- Intro neu: klarer Stadionflug (Tribünen + Trapez-Rasen + Tor), Ball-Zoom, früher Tabellen-Bloom (~2.1s)
- Gesamtdauer kürzer (~4s)
- Push auf `main`

**Status:** erledigt (später entfernt in Prompt 31)

### 2026-08-01 — Prompt 29

**User:** Pathway unterkomplex – Anzahl Bestfall-Konstellationen + Gesamtzahl anzeigen.

**Aktion:**
- Exakte Zählung bei ≤12 Spielen: ways zum Best-/Schlechtfall + totalConstellations
- UI: „X von Y“ und Gesamtzeile
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 28

**User:** Szenario: Spieltag wählbar (Default nächster), nicht alle durchscrollen.

**Aktion:**
- Spieltag-Picker (‹ Select ›), Default erster offener Spieltag
- Nur Spiele des gewählten Spieltags anzeigen
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 27

**User:** Intro neu: Kamerflug ins Stadion zum Tor, Zoom auf Ball, Tabelle öffnet.

**Aktion:**
- Intro als 3D-Kamerflug (Stadion → Tor → Ball-Zoom → Tabellen-Bloom)
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 26

**User:** Zonen-Linien in der Tabelle verrutscht.

**Aktion:**
- `border-left` von `<tr>` auf erste Zelle (Safari/`border-collapse`-Bug)
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 25

**User:** Smartphone-Darstellung optimieren, Desktop nicht verschlechtern.

**Aktion:**
- Responsive CSS: engere Abstände, Toolbar stapeln, Tabelle ohne Sp/S/U/N auf Mobile
- Szenario-Grob: Vollbreiten-Grid (2+1), tippfreundlichere Score-Felder
- Desktop-Layout unverändert (Regeln nur in Media Queries)
- Push auf `main`

**Status:** erledigt

### 2026-08-01 — Prompt 24

**User:** Feinmodus: Ergebnis tippen, keine Pfeileingabe.

**Aktion:**
- Number-Spinner durch Textfelder (`inputMode=numeric`) ersetzt
- Push auf `main`

**Status:** erledigt

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
