# Tabellenblick

Echtzeit-Analyse für die **1. und 2. Bundesliga**: aktuelle Tabelle, Restprogramm und mögliche Endplatzierungen unter verschiedenen Szenarien.

## Features

- Live-Daten von [OpenLigaDB](https://www.openligadb.de/) (Aktualisierung alle 60 Sekunden)
- Umschalten zwischen 1. und 2. Liga sowie Saisons
- Spalte **Möglich**: Best-/Schlechtfall-Endplatz je Verein
- **Szenario-Simulator**: Ergebnisse offener Spiele setzen (1/X/2), Tabelle reagiert sofort
- **Stand nach Spieltag**: historische Konstellation wählen und Restprogramm durchspielen

## Start

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Technik

- React + TypeScript + Vite
- Ranking: Punkte → Tordifferenz → Tore
- Best-/Schlechtfall heuristisch (kein vollständiger Kombinationsbaum)
