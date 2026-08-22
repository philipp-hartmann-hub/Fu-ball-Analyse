# Tabellenblick

Echtzeit-Analyse für die **1., 2. und 3. Liga**: Tabelle, Restprogramm und mögliche Endplätze unter Szenarien.

> Living Documentation — nach **jedem** User-Prompt aktualisieren (`.cursor/rules/readme-doku.mdc`).

---

## Überblick

| | |
|---|---|
| **Repo** | https://github.com/philipp-hartmann-hub/Fu-ball-Analyse |
| **Stack** | React 19 · TypeScript · Vite 8 · Vitest · Zod |

| **Daten** | [OpenLigaDB](https://www.openligadb.de/) (`bl1` / `bl2` / `bl3`) – ohne API-Token |
| **Scope** | 1. Bundesliga, 2. Bundesliga und 3. Liga |
| **Tests** | `npm run test` · Watch: `npm run test:watch` |

### Features

- Live-Tabelle mit Zonen (BL1: CL/EL/Abstieg · BL2/3. Liga: Aufstieg/Abstieg); **Cache**: zuletzt geladene Daten sofort aus localStorage, Refresh im Hintergrund
- **Ergebnisse**: Spieltag wählbar; Wappen; Live-Updates (laufende Spiele hervorgehoben als Zwischenstand); Tippen zeigt Torschützen und bei offenen/laufenden Spielen die Spielschätzung 1/X/2; Live-Zwischenstände standardmäßig in der Tabelle; 2 Tage nach letztem Spiel → nächster Spieltag als Default
- Spalte **Möglich**: rechnerisch noch mögliche Plätze – **exakt** bei ≤12 relevanten Restspielen je Verein (nach Punkte-Pruning), sonst **harte Außengrenze** aus Punktemaxima (Badge pro Zeile); alternativ Monte-Carlo-**Prognose** (umschaltbar; unter `MIN_GAMES` Spielen ohne Prozentanzeige)
- Spalte **Restprog.**: fünfstufige Einschätzung aus Vereinssicht (sehr leicht → sehr schwer, Poisson; immer in der Tabelle; auf schmalen Breiten ausgeblendet)
- Seitenleiste: **Verein** (Kern sofort inkl. Saison-Prognose; Restprogramm klappbar mit Favoriten-Ausgang je Gegner; **Entscheidungen** mit Status, Spieltag- und Saison-Auslösern inkl. EL/ECL; Wunschplatz/Härte hinter Klappen) · **Ergebnisse** · **Entscheidungen** (Radar für alle Vereine; Saison-Zonen inkl. EL/ECL in der BL1) · **Szenario** · **Vergleich** (Restprogramm: Gegner-Kürzel + S/U/N)
- **Szenario-Simulator**: Partien mit Wappen; Grob (Sieg/Unentschieden) oder Fein-Tore
- **Stand nach Spieltag**: Auswahl (Dropdown) für historischen Stand
- Toolbar: **Zurücksetzen** (Szenarien + `?s=`)

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
  api/openliga.ts / matchSchema.ts / dataSource.ts
  hooks/useLeagueData.ts
  lib/table.ts / scenarios.ts / schedule.ts / reliability.ts / simulation.ts / thresholds.ts / decisions.ts / live.ts
  components/…             # UI
  App.tsx
```

---

## Änderungsprotokoll

### 2026-08-22 — Prompt 132

**User:** Ja bitte (committen und mergen).

**Aktion:**
- Branch `cursor/entscheidungen-status-einmal`, Commit `5771a3b`, Fast-Forward-Merge nach `main`, Push auf `origin/main`

**Status:** erledigt

### 2026-08-22 — Prompt 131

**User:** Wieso erscheint das Label doppelt?

**Aktion:**
- Ursache: `DecisionTeamDetail` im Radar zweimal mit Status-Pills (Header + Detail)
- Fix: `showStatus`-Prop — Status nur in der kompakten Kopfzeile, Auslöser darunter

**Status:** erledigt

### 2026-08-22 — Prompt 130

**User:** Comitten und mergen.

**Aktion:**
- Branch `cursor/entscheidungen-ohne-spanne`, Commit `cda4456`, Fast-Forward-Merge nach `main`, Push auf `origin/main`

**Status:** erledigt

### 2026-08-22 — Prompt 129

**User:** Die Spanne bei den Entscheidungen rausnehmen.

**Aktion:**
- `DecisionTeamDetail.tsx`: Anzeige „Möglich: 5.–12.“ / kompakte Platz-Spanne entfernt; nur noch Status-Pills und Auslöser
- `DecisionRadarPanel.tsx`: Hinweistext ohne „harte Spanne“

**Status:** erledigt

### 2026-08-22 — Prompt 128

**User:** Comitten und mergen.

**Aktion:**
- Branch `cursor/entscheidungen-el-ecl-vereinsansicht`, Commit `cb0ae3a`, Fast-Forward-Merge nach `main`, Push auf `origin/main`

**Status:** erledigt

### 2026-08-22 — Prompt 127

**User:** Bundesliga: Europa League und Conference League in Entscheidungen berücksichtigen; Entscheidungs-Werte auch in der Vereinsansicht anzeigen.

**Aktion:**
- `decisions.ts`: Saison-Zonen (`deriveSeasonZoneLines`) für EL/ECL neben CL; `seasonOutcomesForTeam` in `scenarios.ts`
- `DecisionTeamDetail.tsx`: gemeinsame Anzeige für Radar und Vereinsansicht
- `TeamInsight.tsx` / `App.tsx`: Entscheidungs-Block in der Vereinsansicht; Radar immer berechnet
- `explainBodies.tsx`: Erklärung Saison-Zonen inkl. EL/ECL
- Tests + README

**Status:** erledigt

### 2026-08-20 — Prompt 126

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge (Restprogramm 5 Stufen absolut, ohne Zahlen, Loss-Konsistenz)

**Status:** erledigt

### 2026-08-20 — Prompt 125

**User:** Restprogramm fünfstufig absolut (sehr leicht…sehr schwer), keine Zahlen; Konsistenz mit Niederlage-wahrscheinlich.

**Aktion:**
- `schedule.ts`: absolute `expectedPerGame`-Schwellen; Clamp bei Loss-Mehrheit; UI nur Stufe
- Tests: Köln-Regression, starke Favoriten, identisches Restprogramm, Konsistenz, Verteilung

**Status:** erledigt

### 2026-08-20 — Prompt 124

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge (Restprogramm Poisson/Vereinssicht + Lean ohne Prozent / matchLean-Popup)

**Status:** erledigt

### 2026-08-20 — Prompt 123

**User:** Bei Sieg möglich/wahrscheinlich die Prozentzahl weglassen; Einschätzung im Popup erklären.

**Aktion:**
- `MatchLeanChip`: keine %-Anzeige mehr (nur Label bzw. S/U/N)
- Neues Explain-Topic `matchLean` + Popup-Text; Links in Verein- und Vergleich-Restprogramm

**Status:** erledigt

### 2026-08-20 — Prompt 122

**User:** Restprogramm-Härte aus Vereinssicht über Poisson (erwartete Restpunkte), nicht relativ zur Liga.

**Aktion:**
- `schedule.ts`: `computeScheduleHardness` über `predictMatch` (P(S)·3+P(U)); Einstufung vs. eigenem PPG; `hasEnoughData`
- UI Tabelle/Verein/Vergleich: „Erwartete Restpunkte: ~X“ + leicht/durchschnittlich/schwer für den Verein; Erklärtext + Tests

**Status:** erledigt

### 2026-08-20 — Prompt 121

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge (Vergleich-Restprogramm: Gegner-Kürzel + S/U/N)

**Status:** erledigt

### 2026-08-20 — Prompt 120

**User:** Vergleich-Restprogramm: Gegner-Kürzel sichtbar halten; nur S/U/N statt möglich/wahrscheinlich.

**Aktion:**
- `MatchLeanChip` Variante `letter` (S/U/N) im `TeamCompare`-Restprogramm; „Direkt“ wieder vor dem Buchstaben; Tooltip behält Details

**Status:** erledigt

### 2026-08-20 — Prompt 119

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge (Restprogramm-Favoriten je Gegner, Schwelle ≥50 %)

**Status:** erledigt

### 2026-08-20 — Prompt 118

**User:** „Wahrscheinlich“ ab 50 %, sonst „möglich“ (Addon zum Restprogramm-Favoriten).

**Aktion:**
- `MATCH_LEAN_LIKELY_THRESHOLD` von 0,75 auf 0,5 (≥); Erklärtext und Tests angepasst

**Status:** erledigt

### 2026-08-20 — Prompt 117

**User:** Im Restprogramm (Verein + Vergleich) je Gegner den wahrscheinlichsten Ausgang zeigen — gestaffelt wahrscheinlich/möglich mit Prozent.

**Aktion:**
- `deriveMatchLean` + `MatchLeanChip`: Favoriten-Ausgang aus Poisson-1X2 (Vereinssicht)
- Anzeige in `TeamInsight`- und `TeamCompare`-Restprogrammlisten; Erklärung über Topic `forecast`

**Status:** erledigt

### 2026-08-20 — Prompt 116

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge (Spieltags-Zonen inkl. „bleibt … möglich“, Exakt-Badge weg; Saison-Prognose in Vereinsübersicht immer sichtbar)

**Status:** erledigt

### 2026-08-20 — Prompt 115

**User:** Vereinsübersicht: Saisonprognose über Restprogramm, nicht klappbar, immer anzeigen. (Zuvor: CL/Relegation in Spieltag + Exakt-Label weg.)

**Aktion:**
- `TeamInsight`: `ForecastZoneBreakdown` immer sichtbar, oberhalb der Restprogramm-Klappe
- Spieltags-Zonen (CL/EL/Relegation …), „bleibt … möglich“, ohne Exakt-Badge (Prompt 114)

**Status:** erledigt

### 2026-08-20 — Prompt 114

**User:** Spieltag: auch Relegation/CL/EL usw.; wer schon auf so einem Platz steht, mit auflisten; Exakt-Label entfernen.

**Aktion:**
- `deriveMatchdayPositionLines` über alle Zonen der Liga-Legende (CL, EL, ECL, Relegation Aufstieg/Abstieg, …) inkl. „bleibt … möglich“
- Badge „exakt“ und Hinweis „exakte Enumeration“ aus dem Spieltags-Block entfernt (Näherung bleibt bei Bedarf)

**Status:** erledigt

### 2026-08-20 — Prompt 113

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge der relevanten Spieltags-Platzierungen (Prompt 112)

**Status:** erledigt

### 2026-08-20 — Prompt 112

**User:** Spieltags-Ebene: keine generischen Platzierungen — nur Tabellenführer und vergleichbare relevante Plätze; Vereine ohne Chance weglassen; alle Spieltags-Konstellationen nutzen.

**Aktion:**
- `deriveMatchdayPositionLines` auf Tabellenführer / Aufstiegs-CL-Platz / Abstiegsplatz (inkl. Wechsel) beschränkt; Spannen und „Platz X fallen/bleiben“ entfernt
- Leere Trigger → Verein erscheint nicht im Spieltags-Block (Panel filtert wie bisher)
- Grundlage bleibt die Enumeration aller Partien des Spieltags
- Tests und Erklärtexte angepasst

**Status:** erledigt

### 2026-08-20 — Prompt 111

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge der getrennten Spieltag-/Saison-Ebenen im Entscheidungs-Radar (Prompt 110)

**Status:** erledigt

### 2026-08-20 — Prompt 110

**User:** Entscheidungs-Radar: Saison- und Spieltags-Auslöser sauber trennen — Spieltag mit eigener Positions-Sprache, nicht verschwinden.

**Aktion:**
- `deriveMatchdayPositionLines`: Spieltags-Ebene (Platz/Aufstiegsplatz/Zwischenstand), ohne Saison-Clinch
- Saison-Clinch (gegatet an Hartspanne + Tip) bleibt in `seasonTriggers`; `filterSeasonTriggersByHard` gegen Möglich-Spanne
- Panel: Abschnitte „Spieltag“ und „Saison“; Spieltags-Block auch mit Leer-Hinweis; `showMatchdayHorizon` bei offenem Spieltag
- Tests: ST2 Saison leer / Spieltag gefüllt; Live-Zwischenstand; vorletzter ST beide Ebenen

**Status:** erledigt

### 2026-08-20 — Prompt 109

**User:** Änderungen committen und nach `main` mergen.

**Aktion:**
- Feature-Branch, PR und Merge des Saison-Gatings für Spieltags-Auslöser (Prompt 108)

**Status:** erledigt

### 2026-08-20 — Prompt 108

**User:** Absurde „Diesen Spieltag“-Clinch-Auslöser am Saisonanfang (Aufstieg/Klassenerhalt nach 1–2 Spielen) beheben — Gating an harter Saison-Spanne wie Möglich.

**Aktion:**
- `filterMatchdayTriggersBySeasonHard` + Tip-Checks (`matchdayCanSecureTarget` etc.) in `decisions.ts`: Spieltags-Zeilen nur wenn Zone an Hartgrenzen offen und dieser Spieltag sie kippen kann
- `deriveThresholdLines` unverändert; Radar wendet die Schicht nach dem Ableiten an
- Tests: Saisonanfang ohne Clinch-Zeilen; vorletzter ST mit sicherbarer Aufstiegszone; Filter gegen offene Spanne
- Panel-/Erklärtexte an Saison-Kipp-Logik angepasst

**Status:** erledigt

### 2026-08-15 — Prompt 107

**User:** Hinweis zum abgebrochenen Vite-Dev-Server (Port 5174).

**Aktion:**
- Kurz informiert: Server gestoppt; Grün-Theme unverändert

**Status:** erledigt

### 2026-08-14 — Prompt 106

**User:** Charcoal-Theme sieht nicht gut aus — bei Grün bleiben.

**Aktion:**
- `index.css`, `App.css`, Favicon und `index.html` auf das bisherige Grün-Schema zurückgesetzt (nicht committed gewesen)

**Status:** erledigt

### 2026-08-14 — Prompt 105

**User:** Wo kann ich das neue Farbschema sehen?

**Aktion:**
- Hinweis: nur lokal, nicht Production/Preview; Dev-Server gestartet

**Status:** erledigt

### 2026-08-14 — Prompt 104

**User:** Variante 1 umsetzen: Charcoal-Raum, Grün nur als Signal.

**Aktion:**
- Tokens in `index.css`: warmer Nacht-Charcoal, Cream-Accent, `--good` Grün, `--on-accent`
- UI-Chrome (Tabs, Buttons, Auswahl) auf Cream; „gut“/Meister/Tor-Flash/Puls auf Grün
- Favicon und `theme-color` angepasst; Zonenfarben CL/EL/Abstieg unverändert

**Status:** erledigt

### 2026-08-14 — Prompt 103

**User:** Leitfarbe ist Grün — würde eine andere Farbe besser passen? (Denk-Modus, keine Umsetzung)

**Aktion:**
- Einschätzung: Grün als Raumfarbe ist fußballtypisch, kollidiert aber mit Zonenfarben und dem editorialen Satzbild; Empfehlung eher Hierarchie ändern (Grün als Signal, nicht als ganze Fläche) statt auf Blau/Rot zu wechseln

**Status:** erledigt

### 2026-08-14 — Prompt 102

**User:** Änderungen committen und nach `main` mergen (Production).

**Aktion:**
- Feature-Branch, PR und Merge der Spieltags-Formulierung (Prompt 101)

**Status:** erledigt

### 2026-08-14 — Prompt 101

**User:** Spieltags-Block darf nicht leer werden; Spieltag und Saison bleiben, nur die falsche Saison-Sprache war das Problem.

**Aktion:**
- `seasonFateStillOpen`-Filter für Spieltags-Auslöser rückgängig — Block „Diesen Spieltag“ wieder befüllt
- Spieltags-Zeilen umformuliert auf Tabellenplatz („kein Aufstiegsplatz“, „Aufstiegsplatz ab X“), nicht „Aufstieg nicht mehr erreichbar“
- Block „Diesen Spieltag“ bleibt sichtbar, auch wenn nach dem Spieltag Ziel- und Abstiegsplatz für alle noch offen sind

**Status:** erledigt

### 2026-08-14 — Prompt 100

**User:** Screenshot Entscheidungs-Radar bei Spieltag 2: „Aufstieg nicht mehr erreichbar“ / „Klassenerhalt sicher“ trotz Tabelle 1.–18.

**Aktion:**
- Ursache: Spieltags-Schwellen beschreiben den Platz nach 90 Minuten, klingen aber wie Saison-Urteile
- Radar zeigt Spieltags-Auslöser nur noch, wenn die Saison-Härtespanne für den Verein nicht mehr Ziel *und* Abstieg umfasst (`seasonFateStillOpen`)

**Status:** erledigt

### 2026-08-14 — Prompt 99

**User:** „Link teilen“ aus der Toolbar entfernen.

**Aktion:**
- Button und Clipboard-Kopie in `App.tsx` entfernt; Zurücksetzen und `?s=`-Persistenz bleiben

**Status:** erledigt

### 2026-08-14 — Prompt 98

**User:** Lange Ladezeit durch Entscheidungs-Radar beheben: nur rechnen wenn der Reiter sichtbar ist; Spieltag einmal enumerieren statt 18×.

**Aktion:**
- `App.tsx`: `buildDecisionRadar` nur bei `sideTab === 'decisions'` (nicht mehr beim Start/Poll auf Verein)
- `enumerateMatchdayOutcomesByTeam`: ein 3ⁿ-Durchlauf, dieselben Outcomes wie die Einzel-Enumeration; Radar nutzt das
- Kein Worker — nach 1)+2) nicht nötig für den Standard-Reiter

**Status:** erledigt

### 2026-08-14 — Prompt 97

**User:** Vereinsanalyse entzerren: Kern sofort sichtbar, seltenere Blöcke hinter nativen Klappen (progressive disclosure).

**Aktion:**
- `TeamInsight`: Wunschplatz, Restprogramm-Liste, Härte-Erklärung und Saison-Prognose standardmäßig eingeklappt (`<details>`/`<summary>`, `aria-expanded`)
- Sofort sichtbar bleiben Kopf (inkl. Tordiff.), Best-/Schlechtfall-Spanne und Spielschätzung; Bedingungen an der Spanne unverändert
- Keine Änderung an den Rechnungen

**Status:** erledigt

### 2026-08-14 — Prompt 96

**User:** Doppelte „ist mein Verein durch?“-Anzeige konsolidieren: Punktschwellen nur noch im Entscheidungs-Radar, in der Vereinsanalyse nur ein Verweis.

**Aktion:**
- `TeamInsight`: Punktschwellen-Block entfernt; dezenten Link „Wann ist der Verein rechnerisch durch? → Entscheidungen“ (wechselt zum Radar und hebt den Verein hervor)
- Radar: alle Auslöser-Zeilen (nicht nur 2); Schwellen, die der Status nicht schon sagt; `priorScores` wie zuvor in der Vereinsanalyse; gewählter Verein wird gescrollt/markiert
- `deriveThresholdLines` bleibt (Radar nutzt sie weiter)

**Status:** erledigt

### 2026-08-13 — Prompt 95

**User:** Entscheidungs-Radar: Saison-Status vs. Spieltags-Auslöser klar trennen und beschriften; Live-Delta als Saison-Folge formulieren.

**Aktion:**
- Status-Labels mit „(Saison steht fest)“; Live-Delta-Texte mit Zwischenstand als Auslöser / Saison als Konsequenz
- Auslöser getrennt: `matchdayTriggers` (diesen Spieltag) vs. `seasonTriggers` (Saison/Näherung); Spieltags-UI nur bei Live oder anstehendem Spieltag

**Status:** erledigt

### 2026-08-13 — Prompt 94

**User:** Entscheidungs-Radar umsetzen: Live bestätigter vs. Zwischenstand, Status aus harten Grenzen, Auslöser-Hinweise, Reiter ohne Push/Alerts.

**Aktion:**
- `src/lib/decisions.ts` + Tests: Status (Meister/gerettet/abgestiegen/CL|Aufstieg …), Live-Delta, Schwellen via `deriveThresholdLines`
- Reiter **Entscheidungen** (`DecisionRadarPanel`), Erklärpopup `decisions`
- Parallelstände: bestätigt (`scenarios: []`) vs. Live (`liveScenarios` / `openMatches`)

**Status:** erledigt

### 2026-08-13 — Prompt 93

**User:** Codebase für Feature „Entscheidungs-Radar“ explorieren (Zonen, Hard-Bounds, Thresholds, Live-Pfad, Side-Tabs, CaseConditions, CSS).

**Aktion:**
- Recherche: `src/lib/table.ts` (`zoneForRank`, `LeagueZoneId`), `src/lib/thresholds.ts`, `src/lib/scenarios.ts` (Hard-/Position-Ranges, CaseConditions), `src/lib/live.ts` + `App.tsx` (Live→Szenarien), Side-Tabs, UI-Helfer in `TeamInsight.tsx`, Panel-CSS in `App.css`
- Keine Feature-Implementierung in diesem Prompt

**Status:** erledigt

### 2026-08-07 — Prompt 92

**User:** Spielschätzung (wie in der Vereinsübersicht) auch in die Ergebnis-Übersicht.

**Aktion:**
- `LiveMatchesBar`: bei offenen und laufenden Spielen `MatchPredictionCard` (1/X/2) im aufgeklappten Detail; alle Partien tippbar
- Gleiches Modell wie Verein (`predictFixture` + Erklärungslink `forecast`)

**Status:** erledigt

### 2026-08-07 — Prompt 91

**User:** Laufende Spiele deutlicher als nicht final hervorheben; Zwischenstände trotzdem in die Tabelle übernehmen.

**Aktion:**
- Live-Zeilen in Ergebnissen optisch hervorgehoben (Rand, Badge „LIVE · Zwischenstand“, Hinweis im Detail)
- `includeLiveInTable` standardmäßig an; Toolbar-Hinweis „Tabelle mit Zwischenständen“

**Status:** erledigt

### 2026-08-07 — Prompt 90

**User:** Bei Ergebnissen Torschützen aus der DB zeigen (Spiel anklickbar); auch live, wenn Performance ok.

**Aktion:**
- `goals` im Match-Schema typisiert (schon im Saison-Bulk von OpenLigaDB; kein Extra-Request)
- Ergebnisse: Tippen auf laufende/beendete Spiele klappt Torschützen + Halbzeit auf; live über bestehendes Polling
- Hinweis: Aufstellung/Karten liefert OpenLigaDB nicht

**Status:** erledigt

### 2026-08-07 — Prompt 89

**User:** Restprogramm-Spalte dauerhaft in der Tabelle; Toggle entfernen (tippen zeigte nichts mehr).

**Aktion:**
- Toggle „Restprogramm“ aus Toolbar entfernt; Spalte `Restprog.` immer sichtbar (weiterhin per Container-Query auf schmalen Breiten ausgeblendet)
- Disclaimer zur Härte immer über der Tabelle

**Status:** erledigt

### 2026-08-07 — Prompt 88

**User:** Harte (mathematische) Spanne als Standard-Basis der MÖGLICH-Spalte; innere Näherung ersetzen; Exact am Saisonende behalten; pro Verein kennzeichnen. Erklärtexte verständlicher formulieren.

**Aktion:**
- `computePositionRanges` / `computeSeasonOutlook`: Exact wenn relevante Spiele ≤ `EXACT_LIMIT`, sonst harte Bounds (`mode: 'exact' | 'hard'`); Heuristik `simulateExtremeFinish` nicht mehr für Möglich
- UI: Badge „exakt“ / „rechnerisch“ pro Zeile; globaler Hinweis; Erklärtexte (`explainBodies`) und Kurz-Hinweise in Alltagssprache
- Vereinsanalyse Best/Worst denselben Pfad; Tests zu Konsistenz Exact⊆Hart, gemischten Modi, Saisonende

**Status:** erledigt

### 2026-08-07 — Prompt 87

**User:** Tabellen-Layout für Handy und Tablet überarbeiten — mehr Spalten sichtbar, keine verrutschten Header, Breiten nach Container staffeln (430px / 780px).

**Aktion:**
- `App.css`: Container-Queries auf **&lt;430px** (#, Kurzname, TORE, DIFF, PKT, MÖGLICH), **430–780px** (+ Δ), **&gt;780px** (alle inkl. Sp/S/U/N + Härte)
- Header-Ausrichtung: Zahlenspalten rechts, Δ/Härte/Möglich zentriert, Verein links; `table-layout: auto` beibehalten
- Kein Horizontal-Scroll (`overflow-x: hidden`); Teamnamen nur an Leerzeichen umbrechen

**Status:** erledigt

### 2026-08-07 — Prompt 86

**User:** Tabellen-Layout einmal sauber für Desktop und Mobile (kein H-Scroll, kein Zeichen-Umbruch, gestaffelte Spalten).

**Aktion:**
- `table-layout: auto`; kein `overflow-wrap: anywhere` / `word-break` in der Tabelle
- Spalten-Staffelung per **Container-Query** (&lt;560 / ≤820 / breit) auf `.table-wrap`
- Verein: Kurzname nur schmal; Crest/Fallback gleiche Größe; vertikale Mitte beibehalten

**Status:** erledigt

### 2026-08-07 — Prompt 85

**User:** Kaputte Spaltenproportionen (Regression `table-layout: fixed` ohne Breiten).

**Aktion:**
- `table-layout: fixed` entfernt (wieder auto); Wrap/kleine min-widths aus Prompt 83 bleiben
- `.team` und `.range`/`.forecast-cell` min-width ~9rem; `.num` mit `width: 1%` + nowrap schmal

**Status:** erledigt

### 2026-08-07 — Prompt 84

**User:** Vorhersage-Balken im Vergleich zu kurz / laufen in die Spaltenlücke.

**Aktion:**
- `.match-prediction-row`: 2-Spalten-Grid (Label | %) + Balken volle Breite darunter (`grid-column: 1 / -1`)
- Balkenhöhe 6px; Karte `overflow: hidden` / `min-width: 0`

**Status:** erledigt

### 2026-08-07 — Prompt 83

**User:** Kein horizontales Scrollen der Tabelle; bei Platzmangel umbrechen statt Scrollleiste.

**Aktion:**
- `.team` min-width ~6.5rem + Name-Umbruch; `.forecast-cell`/`.range` schmaler (~5rem), Inhalt schrumpfbar
- Weniger Zell-Padding; `table-layout: fixed`; feste Zeilenhöhe → `min-height` (höhere Zeilen bei Wrap)
- `overflow-x: auto` nur als Reserve; col-form nicht ausgeblendet

**Status:** erledigt

### 2026-08-07 — Prompt 82

**User:** Vertikaler Versatz in der Tabelle (Vereinsname höher als Zahlen), besonders Prognose-Ansicht.

**Aktion:**
- Vereins-Zelle: Flex auf inneren `.team-inner`-Wrapper; `td.team` wieder normale Zelle (`vertical-align: middle`)
- Prognose-/Möglich-Spalte feste Breite (~8.5rem); `forecast-pending` kompakt als „n/a“ + Tooltip
- Einheitliche Zeilenhöhe `.standings td { height: 2.6rem }`

**Status:** erledigt

### 2026-08-07 — Prompt 81

**User:** Ergebnisschätzung (wahrscheinlichstes Ergebnis / erwartete Tore) aus Spieltagsprognose und Vergleich entfernen.

**Aktion:**
- `MatchPredictionCard`: nur noch 1/X/2-Balken + Disclaimer; Score-/λ-Zeile entfernt
- Modellwerte `likelyScore`/`expHome`/`expAway` bleiben intern, werden in der UI nicht mehr gezeigt

**Status:** erledigt

### 2026-08-07 — Prompt 80

**User:** Spieltag-Matchup zeigte Fokusverein fälschlich als Heim; Ergebnisprognose soll Spielordnung Heim:Auswärts folgen. Im Vergleich wirkten Duell und „nächstes Spiel“ wie widersprüchliche Tipps.

**Aktion:**
- Matchup immer links Heim / rechts Auswärts; Heim-Badge fest links
- Ergebniszeile immer Heim:Auswärts mit Vereinsnamen (`Köln 2:1 Heidenheim`)
- Vergleich: Titel nennt konkrete Partie + ST; Balken als „Sieg TeamA / Unentschieden / Sieg TeamB“ (Heim:Auswärts-Ordnung)

**Status:** erledigt

### 2026-08-07 — Prompt 79

**User:** Einzelspiel-Vorhersage (1/X/2 + wahrscheinlichstes Ergebnis) aus dem Poisson-Modell; Vereinsanalyse + Vergleich.

**Aktion:**
- `predictMatch` / `predictFixture` in `simulation.ts` (geschlossene Form, `deriveTeamStrengths`/`expectedGoals` wiederverwendet)
- `MatchPredictionCard`; Vereinsanalyse beim eigenen Spieltag-Match; Vergleich: H2H + nächstes Spiel
- Szenario-Override („von dir gesetzt“); `reliable` via `hasEnoughData`; Tests + Erklärtext

**Status:** erledigt

### 2026-08-07 — Prompt 78

**User:** Mathematisch mögliche Spanne wieder in die Vereinsanalyse als Zusatzangabe.

**Aktion:**
- `computeHardBounds` / `computeHardRanges` wiederhergestellt (Punktemaxima, sound)
- `hardRange` an `SeasonOutlook` und `NextMatchdayOutlook` — nur Vereinsanalyse
- UI: Zeile „Mathematisch möglich: X.–Y.“ über Best-/Schlechtfall; Tabellen-Spalte „Möglich“ unverändert (Exact/Heuristik)
- Tests + Erklärtext

**Status:** erledigt

### 2026-08-06 — Prompt 77

**User:** Perf (Poll-Signatur, Worker, Ranges), Rivalen-TD-Heuristik, Reliability, Fehler-UX, TD-Hinweise.

**Aktion:**
- `matchesContentSignature` / Poll early-exit; `matchesDataVersion` für Standings-Memos
- Spieltag-Outlooks im Worker (`useMatchdayOutlooks`) + Delta-Masken-Ranking
- `computePositionRanges`: Exact pro Komponente, Heuristik nur bei großen Bändern
- `simulateExtremeFinish`: Rivalen mit Margin + Catch-up statt ±10 Punkte
- Freundliche Lade-/Fehler-/Cache-Zustände + „Erneut versuchen“
- Bedingungen: „ausreichende Tordifferenz“ / Banner wenn minGoalDiff > 1
- Reliability bereits zentral; gemeinsamer Härte/Prognose-Schwellwert-Test

**Status:** erledigt

### 2026-08-04 — Prompt 76

**User:** Saison ohne Pathways/Wunschplatz; Spieltag-Bedingungen stärken; notwendige Tordifferenzen. (Plan: Heidenheim Fokus-TD)

**Aktion:**
- Saison: keine `bestConditions`/`worstConditions`, kein Wunschplatz-UI
- `FOCUS_EXTREME_MARGIN=8` für Fokus-Siege/-Niederlagen (Spieltag-Enum, Saison-Fokus-Exact, Heuristik)
- Fremd weiter 1:0/1:1/0:1; `minGoalDiff` + engere Masken → mehr Muss/Darf-nicht
- Regressionstest Heidenheim-Fall (Bestfall überholt Punkterivalen per TD)
- Erklärungstext Spanne/Bedingungen

**Status:** erledigt

### 2026-08-04 — Prompt 75

**User:** Restprogramm in der Tabelle als abgestufte Einschätzung statt Punktzahl.

**Aktion:**
- `hardnessGrade` / `hardnessGradeLabel`: fünf Stufen (sehr leicht … sehr schwer)
- Tabellenspalte zeigt Label statt Index; Tooltip behält Index/Rang
- Vereinsanalyse/Vergleich an Stufen angepasst

**Status:** erledigt

### 2026-08-04 — Prompt 74

**User:** Spieltag in der Tabelle auswählbar, nicht per Regler/Slider.

**Aktion:**
- Cutoff-UI: Range-Slider → Dropdown + Vor/Zurück (wie Szenarien/Live)
- Optionen „Vor dem 1. Spieltag“ … „Nach n. Spieltag“

**Status:** erledigt

### 2026-08-04 — Prompt 73

**User:** Unter Vereine alle Prognose-Szenarien mit Wahrscheinlichkeiten (nicht nur Headline in der Tabelle).

**Aktion:**
- `forecastZoneBreakdown` + `forecastZoneLabel` / `zoneLegendFor`
- Vereinsanalyse: Block „Saison-Prognose“ mit allen Zonen-% (sortiert), Median/erwartete Punkte
- Tabelle unverändert (nur wahrscheinlichste Zone)
- Erklärungstext Prognose angepasst

**Status:** erledigt

### 2026-08-04 — Prompt 72

**User:** Keine mathematische Variante — nur Heuristik; entsprechenden Stand wiederherstellen.

**Aktion:**
- Hard-Bounds-Feature (Prompt 71) entfernt; Stand wie nach Prompt 70
- Möglich = Exact (≤12 relevante Spiele) sonst Heuristik „mind.“

**Status:** erledigt

### 2026-08-04 — Prompt 71

**User:** Harte, garantierte Platzspanne (mathematisch).

**Aktion:** `computeHardBounds` als Möglich-Primärquelle — **zurückgenommen** in Prompt 72.

**Status:** zurückgenommen

### 2026-08-04 — Prompt 70

**User:** Widersprüchliche Möglich-Ranges — Exact mit Relevanz-Pruning (nicht nur raw Restspiel-Anzahl).

**Aktion:**
- `selectRelevantTeamIds` / `selectRelevantMatches` / `teamPointBounds` / `EXACT_LIMIT=12`
- `computeExactPositionRanges`: enumeriert nur relevante Spiele (`applyScore` + `rankStandings`), ein Durchlauf
- `computePositionRanges` / Saison-Outlook / Extreme nutzen denselben Pfad; UI „mind.“ bei Heuristik
- Tests: Köln/Bremen, Brute-Force, Gegenprobe r→r+1, Pruning-Fixture (>12 Restspiele, Exact trotzdem)

**Status:** erledigt

### 2026-08-04 — Prompt 69

**User:** Prognose bei Saisonstart kein Prozent-Rauschen — gemeinsamer Reliability-Helfer.

**Aktion:**
- Neu: `src/lib/reliability.ts` (`MIN_GAMES`, `hasEnoughData`, `NOT_ENOUGH_DATA_LABEL`)
- Härte (`computeScheduleHardness`) und Prognose-UI speisen daraus
- Bei `hasEnoughData===false`: keine Zonen-Prozente/Headline, Text „noch keine Aussage (zu wenige Spiele)“; Simulation läuft weiter
- Test: 0 Spiele → keine Prozentanzeige

**Status:** erledigt

### 2026-08-04 — Prompt 68

**User:** `deriveExactCaseConditions` korrigieren (K3-Klassifikation + UI + Heuristik-Hinweis; Test-Invariante K4).

**Aktion:**
- Fremdspiel-Klassifikation: `|S|==1` required, `|S|==2` partiallyConstrained inkl. `forbiddenOutcome`, `|S|==3` flexible
- UI: drei Blöcke (Muss / Darf nicht / Wirklich egal) + Hinweis zu offenen Kombinationen
- Saison-Heuristik: Banner „grobe Richtung, nicht exakt“ (kein Muss-/Exakt-Wording)
- Tests: K3-Masken-Fixtures; K4-Invariante nutzt `forbiddenOutcome`

**Status:** erledigt

### 2026-08-04 — Prompt 67

**User:** Falsche Möglich-Spalte am Saisonende (widersprüchliche Ranges) — exakte Enumeration statt Heuristik.

**Aktion:**
- `computeExactPositionRanges` / `EXACT_SEASON_LIMIT=12`: ein 3ⁿ-Durchlauf für alle Teams
- `computePositionRanges` + `computeSeasonOutlook` + `seasonExtremeOutcomes` nutzen den exakten Pfad im Limit
- UI: Disclaimer + „mind.“ bei Heuristik; Erklär-Text aktualisiert
- Tests: Köln/Bremen-Fixture, Brute-Force-Konsistenz, Gegenprobe r→r+1

**Status:** erledigt

### 2026-08-03 — Prompt 66

**User:** `assertConditionsConsistent` entschärfen — keine universelle Kombinierbarkeit offener Spiele.

**Aktion:**
- Vier Checks: Existenz, required-, forbidden-, marginale Korrektheit
- Neuer Fixture mit korrelierten Rivalen-Spielen; alte ∀-Invariante dort bewusst rot, neue Checks grün

**Status:** erledigt

### 2026-08-03 — Prompt 65

**User:** Wunschplatzierungs-Funktion in der Vereinsanalyse (Spieltag exakt + Saison Sim/Heuristik).

**Aktion:**
- `computeTargetMatchdayOutlook` / `computeTargetSeasonOutlook` in `scenarios.ts`; Enumeration über `enumerateMatchdayRanksByMask` geteilt
- `deriveExactCaseConditions` um mode `target`, `partiallyConstrained`, `ownOptions` (Remis vor Sieg)
- Monte-Carlo: `pointsByRank` / `collectTargetPointsSamples` für Median-Punkte im Ziel
- TeamInsight: Wunschplatz getrennt für Spieltag und Saison (genau/oder besser); Tests + README

**Status:** erledigt

### 2026-08-03 — Prompt 64

**User:** Top-5 wieder raus – zurück zum Commit davor.

**Aktion:**
- Revert des Top-5-/fixturedownload-Commits; wieder nur OpenLigaDB (`bl1`/`bl2`/`bl3`)

**Status:** erledigt

### 2026-08-03 — Prompt 61

**User:** 3. Liga unterstützen.

**Aktion:**
- Liga `bl3` (OpenLigaDB, 20 Teams) in `leagues.ts` + Share-State
- Zonen: Direktaufstieg 1–2, Relegation Aufstieg Platz 3, Abstieg 17–20
- Forecast/Thresholds/ZoneLegend/Vorsprung-Kennzahl angepasst

**Status:** erledigt

### 2026-08-03 — Prompt 60

**User:** Szenario wieder mit 1/X/2 — bitte normale Sieg-Beschriftungen.

**Aktion:**
- Grob-Tipps wieder „Sieg …“ / „Unentschieden“; Wappen bleiben

**Status:** erledigt

### 2026-08-03 — Prompt 59

**User:** Beim Szenario mit Wappen arbeiten (nicht Vereinsvergleich).

**Aktion:**
- Szenario-Partien mit Wappen; Grob-Tipps als 1/X/2
- Fehlinterpretation „Vergleich“ rückgängig: kein TeamCompare unter Szenario

**Status:** erledigt

### 2026-08-02 — Prompt 58

**User:** Tabelle mit durchgehenden Linien.

**Aktion:**
- Standings: `border-collapse: collapse`, klarere durchgehende Zeilenlinien (auch unter letzter Zeile)

**Status:** erledigt

### 2026-08-02 — Prompt 57

**User:** Status-Label Termin/Offen bei Ergebnissen entfernen.

**Aktion:**
- `live-status-tag` entfernt; Live weiter als Text rechts, sonst Anstoßzeit/Ergebnisname

**Status:** erledigt

### 2026-08-02 — Prompt 56

**User:** Bei Ergebnissen Spieltage durchklicken können; „Termin“ unverständlich.

**Aktion:**
- Ergebnis-Panel: Spieltag-Picker (‹ / Select / ›), Default = aktueller Ergebnis-Spieltag
- Status-Label „Termin“ → „Offen“

**Status:** erledigt

### 2026-08-02 — Prompt 55

**User:** Bei Ergebnissen steht immer „Termin“ – unverständlich.

**Aktion:**
- Status-Label für ausstehende Partien: „Termin“ → „Offen“

**Status:** erledigt

### 2026-08-02 — Prompt 54

**User:** Spieltag-Ergebnisse als extra Reiter „Ergebnisse“.

**Aktion:**
- `LiveMatchesBar` als Panel im Reiter Ergebnisse (mit Wappen); unter der Tabelle entfernt
- Tabs: Verein · Ergebnisse · Szenario · Vergleich

**Status:** erledigt

### 2026-08-02 — Prompt 53

**User:** Verein, Spieltag und Saison wieder zu einem Reiter „Verein“ mergen.

**Aktion:**
- Tabs: Verein · Szenario · Vergleich; unter Verein wieder Überblick + Spieltag (mit Logos) + Saison gestapelt

**Status:** erledigt

### 2026-08-02 — Prompt 52

**User:** Spieltag-Reiter mit Logos und ansprechender Aufbereitung.

**Aktion:**
- Icon-URLs in `CaseConditions` / `NextMatchdayOutlook`; Matchup-Header mit Wappen
- Bedingungen als Crest-Zeilen (1/X/2-Chip); CTA hervorgehoben

**Status:** erledigt

### 2026-08-02 — Prompt 51

**User:** Analyse-/Vergleich-Reiter durch einzelne Abschnitte ersetzen (auswählbar).

**Aktion:**
- Seitenleisten-Tabs: Verein · Spieltag · Saison · Szenario · Vergleich
- `TeamInsight` rendert nur den gewählten Abschnitt (`section`-Prop)
- „Als Szenario übernehmen“ wechselt automatisch zum Reiter Szenario

**Status:** erledigt

### 2026-08-02 — Prompt 50

**User:** Bedingungs-Analyse Best-/Schlechtfall (notwendig vs. egal), kein Konstellations-Zähler; Saison heuristisch; UI + Tests.

**Aktion:**
- `CaseConditions` in `types.ts`; `deriveExactCaseConditions` / `deriveHeuristicSeasonConditions` / `scenariosFromConditions` in `scenarios.ts`
- Outlook um `bestConditions`/`worstConditions`; TeamInsight-Panel (Vorgabe / Muss / Egal) + „Als Szenario übernehmen“
- Explain-Topic `conditions`; Konsistenz-Tests in `scenarios.test.ts`

**Status:** erledigt

### 2026-08-02 — Prompt 49

**User:** Sofort Cache-Tabelle zeigen, Hintergrund-Refresh.

**Aktion:**
- `leagueCache.ts` (localStorage, 24h TTL, try/catch, Zod-Revalidierung)
- `useLeagueData`: Cache hydratisieren → `load(true)`; ohne Cache wie bisher
- Statuszeile „Aktualisiere…“ während Refresh

**Status:** erledigt

### 2026-08-02 — Prompt 48

**User:** Ungenutzten Code aufräumen; oxlint-Findings beheben.

**Aktion:**
- `ApiTableRow` entfernt (ungenutzt); `computePositionRanges` behalten (App-Tabelle), `@deprecated` entfernt
- oxlint: LiveMatchesBar-Cleanup, Explain-Bodies ausgelagert, Test `0 * AWAY_WEIGHT` gefixt

**Status:** erledigt

### 2026-08-02 — Prompt 47

**User:** Runtime-Validierung OpenLigaDB mit zod; Typen aus Schema ableiten.

**Aktion:**
- Dependency `zod`; `api/matchSchema.ts` + `parseMatchesResponse` in `openliga.ts`
- Match-Typen via `z.infer` in `types.ts` re-exportiert
- Test: fehlendes `group.groupOrderID` → klare Fehlermeldung, kein Crash

**Status:** erledigt

### 2026-08-02 — Prompt 46

**User:** Live-Ergebnisübersicht unter die Tabelle (aufklappbar); Spieltag 2 Tage nach letztem Spiel → neuer Spieltag.

**Aktion:**
- `resolveResultsMatchday` / `listMatchdayFixtures` in `live.ts`
- `LiveMatchesBar` unter Tabelle, collapsible, ganzer Spieltag (Ende/Live/Termin)

**Status:** erledigt

### 2026-08-02 — Prompt 45

**User:** Pop-ups besser platzieren – immer voll lesbar im Bildschirm.

**Aktion:**
- `ExplainModal` per `createPortal` auf `document.body`
- Modal-CSS: Viewport-zentriert, `dvh`, Safe-Area, scrollbarer Body; kein transform-Clipping

**Status:** erledigt

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
