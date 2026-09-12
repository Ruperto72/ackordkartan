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
2. **`buildChords()`** — staplar terser inom vald skala/tonart för varje skalsteg och lägger till färgade varianter (sus2, add9, 9 …) om alla deras toner ryms i skalan. Producerar listan av ackord som visas som chips. Varje ackord får `deg` (skalstegets index 0–6) och `degRoman` (skalstegets egen romerska siffra, beräknad från den diatoniska treklangens kvalitet) utöver sitt eget `roman` — de skiljer sig åt för kvalitetsneutrala färgvarianter (sus2/sus4/6/7sus4 är alltid `min:false` i `QMAP` oavsett skalsteg), så `deg`/`degRoman` är det stabila att gruppera på, inte `roman`.
3. **`findVoicings(chord, opts)`** — kärnan i appen. Djupet-först-sökning (`dfs`) över de sex strängarna där varje sträng kan vara dämpad, öppen, eller greppad på ett band vars ton finns i ackordet, med beskärning på spännvidd (max 4 band mellan lägsta och högsta greppade band). `evaluate()` filtrerar sedan varje kandidat på spelbarhet (minst fyra klingande strängar, max ett dämpat mellanrum, alla nödvändiga toner (kvinten får utelämnas), max fyra unika band = fyra fingrar, barrégiltighet — ligger två toner på samma band måste strängarna emellan greppas högre) och poängsätter det som blir kvar (premierar öppna strängar och högt läge, straffar spännvidd/barré/fingerantal). `opts` styr filtrering och sortering och matchar `state`-formen (se nedan), men anropas ibland med ett eget litet objekt (se `progVoicings()`) snarare än med hela `state`.
4. **`fingering()`** — mappar greppade band till fingernummer 1–4 (samma band → samma finger, för barré). `voicingFromFrets(frets, tuningName)` gör motsvarande baklänges: bygger ett minimalt voicing-objekt (`frets`+`notes`) från sparade band, för vändningar som är låsta till en specifik stämning.
5. **Rendering** — `diagram()` ritar ett enskilt greppdiagram som SVG-sträng (tar en valfri `tuningName`, annars `state.tuning`); `drawNeck()` ritar hela halsdiagrammet (15 band) med skal- och ackordtoner; `render*()`-funktionerna (`renderRoots`, `renderChords`, `renderFamilies`, `renderBuiltinProgs`, `renderCustomProgs`, `renderVoicings`, `renderAll`, `renderTabs`) synkar DOM mot det globala `state`-objektet. UI:t är uppdelat i tre flikar: "Ackord" (stämning/skala/rot/ackord), "Grepp" (halsdiagram/filter/greppkort) och "Vändningar" (ackordföljder), styrt av `state.tab` och `renderTabs()`. Att välja ett ackordchip sätter `state.tab="grepp"` och byter dit direkt — resultatet (greppen) är annars osynligt tills man byter flik manuellt. Flikraden har rätt WAI-ARIA-mönster för `role="tablist"`: roving tabindex (bara aktiv flik har `tabindex="0"`) plus piltangenter/Home/End i en `keydown`-lyssnare på `#tabs`. `renderChords()` grupperar chipsen per `deg` med en liten `.degree`-rubrik (`degRoman`) mellan grupperna, istället för att visa romersk siffra på varje chip.
6. **Ljud** — `pluck()` syntetiserar en sträng med Karplus-Strong (brusigt ringbuffer-filter) via Web Audio, `strum()` spelar flera toner förskjutna i tid. Inget ljudmaterial laddas.

Allt UI-tillstånd hålls i det globala `state`-objektet (tuning, mode, root, chord, family, onlyOpen, noBarre, minPos, sort, tab, progVoicingIdx, progBuilder). Varje `on*`-hanterare uppdaterar `state` och kallar om nödvändigt `renderChords()`/`drawNeck()`/`renderVoicings()` — det finns ingen reaktivitet, uppdateringarna är manuella och explicita.

### Vändningar

`progRow(items, opts)` är den delade byggstenen för alla tre sorters ackordföljds-rader (inbyggda, under uppbyggnad, sparade): en rad diagram-mini-kort — varje diagram är en egen `<button class="progdiagram">` som spelar just det ackordet vid klick, samma interaktion som greppkorten i Grepp-fliken — valfritt med ‹/›-bläddring (`opts.scrollable`+`opts.onScroll`) och/eller en ✕ per kort (`opts.onRemove`), plus en spela-knapp för hela sekvensen och valfri ta bort-knapp (`opts.onDelete`).

- **Inbyggda** (`renderBuiltinProgs()`) — samma fem skalstegs-sekvenser som tidigare (uttryckta som romerska siffror, flyttbara med rotton), men nu bläddringsbara: `state.progVoicingIdx["<row>-<i>"]` minns vilket grepp (index i `progVoicings(chord)`) som visas för ackord `i` i rad `row`. Nollställs vid byte av rot/skala/stämning.
- **Under uppbyggnad** (`state.progBuilder = {chords:[{chord, idx}]}` medan `#progBuilder` är synlig) — `renderBuilderChips()` listar alla ackord i aktuell tonart (oberoende av familjefiltret) att lägga till; `renderBuilder()` ritar sekvensen med samma bläddring+✕-borttag. `openBuilder()`/`closeBuilder()` växlar synlighet.
- **Sparade** (`renderCustomProgs()`, `localStorage`-nyckel `ackordkartan:progressions`) — låsta till exakta band + den stämning de sparades i (`{id, name, tuning, chords:[{name, frets}]}`), ingen bläddring. Renderas via `voicingFromFrets()` med den sparade `tuning`, oberoende av vilken stämning som är vald just nu. `localStorage`-fel (privat läge, full kvot) sväljs tyst i `loadSavedProgs()`/`saveSavedProgs()` — appen funkar då utan att spara mellan sessioner.

Grepp-fliken har två `<details class="filters">`: "Hur funkar greppen?" (kort förklaring, flyttad hit från en tidigare `<footer>` som togs bort — ingen läste den längst ner) och "Filter". Båda stängda som standard.

Ljust/mörkt läge styrs via CSS custom properties och `prefers-color-scheme`, med `[data-theme]`-attributet på `<html>` som manuell override-krok. `themeMode` ("auto"/"light"/"dark", `localStorage`-nyckel `ackordkartan:theme`) styr detta via `applyTheme()`/`cycleTheme()` — temaknappen i headern cyklar mellan lägena.

## PWA

`manifest.json` + `sw.js` + `icons/` gör appen installerbar via Chrome på Android ("Lägg till på startskärmen"). `sw.js` cache:ar appskalet (stale-while-revalidate: svarar med cachat innehåll direkt, uppdaterar cachen i bakgrunden) — **bumpa `CACHE_NAME` i `sw.js` när statiska filer ändras**, annars fastnar installerade instanser i gammal cache. `index.html` begär Screen Wake Lock vid start och återbegär den vid `visibilitychange`, så skärmen hålls tänd så länge appen är synlig (tyst fallback om API:t saknas/nekas).

Ikonerna följer samma konvention som `music-studio` och `latbok` (systerprojekt): en enda enkel mark — inte en illustration — på en ren botten. Motivet (`icons.js`) är en tvåsträngs-cutaway ur appens eget halsdiagram: en öppen sträng, en greppad med en fylld nagel i brons. `icons.js` + `cdp.js` (kopierad rakt av från `music-studio`, ingen egen kod) renderar `icons/icon.svg`/`icon-maskable.svg` och alla PNG-storlekar (192/512/favicon-32/apple-touch-icon-180/maskable-192/maskable-512) via en headless Edge/Chrome-skärmdump — `node icons.js`, inga npm-beroenden. Dessa två filer är enda undantaget från "no dependencies utöver Node self": de är dev-tid-verktyg som aldrig laddas av webbläsaren. Kör om `node icons.js` om motivet eller paletten ändras — filerna committas, skriptet körs inte i CI.

## Att tänka på vid ändringar

- All logik och rendering hålls i `index.html` — det är en medveten designprincip, inte en tillfällig genväg. Enda tillåtna undantagen: PWA-skalet (manifest/service worker/ikoner, en service worker kan av webbläsarens säkerhetsmodell inte inlinas) och `icons.js`/`cdp.js`, som är dev-tid-verktyg för att generera ikonerna — ingen av dem laddas av appen i webbläsaren.
- `findVoicings` är sensitiv för ordning: beskärningen i `dfs` (SPAN) och filtren i `evaluate` samverkar för att hålla sökrymden liten. Ändra ett villkor i taget och kontrollera att rimliga grepp (t.ex. öppna D-, C-, G-formen) fortfarande dyker upp.
- Ändringar i `QUALITIES`/`buildChords()` måste hålla `qKey`-uppslaget konsekvent (intervall sorterade och normaliserade 0–11 relativt grundton).
