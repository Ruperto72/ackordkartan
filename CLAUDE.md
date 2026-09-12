# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vad det här är

Ackordkartan är i grunden en enfilsapp (all musikteori, greppsökning och UI-logik i [index.html](index.html)) som genererar gitarrgrepp i en vald tonart, med fokus på öppna klanger högt upp på halsen — inte bara barrégrepp i första läget. Ingen byggkedja, inga beroenden, inget ackordbibliotek. Utöver `index.html` finns ett minimalt PWA-skal (`manifest.json`, `sw.js`, `icons/`) som gör appen installerbar på Android/Chrome — se "PWA" nedan.

Repot är (ännu) inte initierat som git — `setup.sh` gör `git init` och skapar GitHub-repot i ett steg.

## Köra och deploya

```bash
python3 -m http.server 8000   # öppna http://localhost:8000
```
Eller öppna `index.html` direkt i webbläsaren — ingen server krävs.

Inga tester, ingen linter, inget build-steg. Ändringar verifieras genom att öppna filen i webbläsaren och prova UI:t.

Deploy sker via GitHub Pages direkt från `index.html` i repo-roten (Settings → Pages → Deploy from a branch → main / (root)).

`setup.sh` initierar git, skapar GitHub-repot via `gh` och slår på topics — körs bara en gång vid nyskapande, inte för vanliga ändringar.

## Arkitektur

Allt ligger i [index.html](index.html): en `<style>`-block, markup, och ett enda `<script>` som kör i IIFE-stil utan moduler. Flödet är teori → sökning → rendering, i den ordningen filen är skriven:

1. **Teoritabeller** — `TUNINGS` (stämning som MIDI-tonhöjd per sträng), `MODES` (skaltoner som halvtonsavstånd), `QUALITIES` (ackordkvaliteter som intervallmängder, uppslagna via `QMAP`/`qKey`).
2. **`buildChords()`** — staplar terser inom vald skala/tonart för varje skalsteg och lägger till färgade varianter (sus2, add9, 9 …) om alla deras toner ryms i skalan. Producerar listan av ackord som visas som chips.
3. **`findVoicings(chord, opts)`** — kärnan i appen. Djupet-först-sökning (`dfs`) över de sex strängarna där varje sträng kan vara dämpad, öppen, eller greppad på ett band vars ton finns i ackordet, med beskärning på spännvidd (max 4 band mellan lägsta och högsta greppade band). `evaluate()` filtrerar sedan varje kandidat på spelbarhet (minst fyra klingande strängar, max ett dämpat mellanrum, alla nödvändiga toner (kvinten får utelämnas), max fyra unika band = fyra fingrar, barrégiltighet — ligger två toner på samma band måste strängarna emellan greppas högre) och poängsätter det som blir kvar (premierar öppna strängar och högt läge, straffar spännvidd/barré/fingerantal). `opts` styr filtrering och sortering och matchar `state`-formen (se nedan), men anropas ibland med ett eget litet objekt (se `renderProgs()`) snarare än med hela `state`.
4. **`fingering()`** — mappar greppade band till fingernummer 1–4 (samma band → samma finger, för barré).
5. **Rendering** — `diagram()` ritar ett enskilt greppdiagram som SVG-sträng; `drawNeck()` ritar hela halsdiagrammet (15 band) med skal- och ackordtoner; `render*()`-funktionerna (`renderRoots`, `renderChords`, `renderFamilies`, `renderProgs`, `renderVoicings`, `renderAll`, `renderTabs`) synkar DOM mot det globala `state`-objektet. UI:t är uppdelat i två flikar ("Ackord" för val av stämning/skala/rot/ackord, "Grepp" för halsdiagram/filter/greppkort), styrt av `state.tab` och `renderTabs()`.
6. **Ljud** — `pluck()` syntetiserar en sträng med Karplus-Strong (brusigt ringbuffer-filter) via Web Audio, `strum()` spelar flera toner förskjutna i tid. Inget ljudmaterial laddas.

Allt UI-tillstånd hålls i det globala `state`-objektet (tuning, mode, root, chord, family, onlyOpen, noBarre, minPos, sort, tab). Varje `on*`-hanterare uppdaterar `state` och kallar om nödvändigt `renderChords()`/`drawNeck()`/`renderVoicings()` — det finns ingen reaktivitet, uppdateringarna är manuella och explicita.

Ljust/mörkt läge styrs enbart via CSS custom properties och `prefers-color-scheme` (ingen JS-togglelogik), med `[data-theme]`-attribut som manuell override-krok (används inte av appen själv idag).

## PWA

`manifest.json` + `sw.js` + `icons/icon-192.png`/`icon-512.png` gör appen installerbar via Chrome på Android ("Lägg till på startskärmen"). `sw.js` cache:ar appskalet (stale-while-revalidate: svarar med cachat innehåll direkt, uppdaterar cachen i bakgrunden) — **bumpa `CACHE_NAME` i `sw.js` när statiska filer ändras**, annars fastnar installerade instanser i gammal cache. `index.html` begär Screen Wake Lock vid start och återbegär den vid `visibilitychange`, så skärmen hålls tänd så länge appen är synlig (tyst fallback om API:t saknas/nekas).

## Att tänka på vid ändringar

- All logik och rendering hålls i `index.html` — det är en medveten designprincip, inte en tillfällig genväg. PWA-skalet (manifest/service worker/ikoner) är de enda tillåtna undantagen, eftersom en service worker av webbläsarens säkerhetsmodell inte kan inlinas.
- `findVoicings` är sensitiv för ordning: beskärningen i `dfs` (SPAN) och filtren i `evaluate` samverkar för att hålla sökrymden liten. Ändra ett villkor i taget och kontrollera att rimliga grepp (t.ex. öppna D-, C-, G-formen) fortfarande dyker upp.
- Ändringar i `QUALITIES`/`buildChords()` måste hålla `qKey`-uppslaget konsekvent (intervall sorterade och normaliserade 0–11 relativt grundton).
