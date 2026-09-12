# Menysystem och användarvänligt utseende

**Status:** Godkänd, redo för implementationsplan
**Datum:** 2026-09-12

## Bakgrund

Ackordkartan ([index.html](../../../index.html)) lägger idag alla sektioner (stämning/skala, rotval, halsdiagram, ackordlista, vanliga vändningar, greppfilter, greppkort) staplade vertikalt i en enda lång sida. Det gör att allt är synligt samtidigt oavsett vad användaren just då vill göra, vilket upplevs som otympligt: svårt att hitta rätt, ser hemmagjort ut, och skalar dåligt till mobil trots att layouten redan är delvis responsiv.

Målet är ett mer användarvänligt utseende och ett lämpligt menysystem, utan att röra musikteori- eller greppsökningslogiken.

## Beslut från brainstorming

- **Form-faktor:** Mobil och desktop väger lika tungt — ingen får försummas.
- **Navigationsstil:** Flikar (inte guidad stegvis, inte bara ihopfällbara paneler).
- **Visuell riktning:** Behåll och förfina nuvarande palett/typografi (ink/brass/paper, Instrument Serif + Instrument Sans). Problemet är struktur/hierarki/kontrast, inte färgvalen — se t.ex. den tidigare buggen där `.card` saknade explicit `color` och därför ärvde webbläsarens svarta standardfärg för knappar istället för temats `--ink`.
- **Flikuppdelning:** Två flikar, inte tre. Tre flikar (bryta ut stämning/skala separat) gav fler klick för lite vinst.

## Design

### 1. Struktur

Rubrik och tagline (`<h1>`, `.tagline`) ligger kvar överst, oförändrade. Direkt under dem läggs en flikrad:

```html
<div class="tabs" role="tablist">
  <button class="tab" role="tab" aria-selected="true" data-tab="ackord">Ackord</button>
  <button class="tab" role="tab" aria-selected="false" data-tab="grepp">Grepp</button>
</div>
<div id="tab-ackord" class="tabpanel" role="tabpanel"></div>
<div id="tab-grepp" class="tabpanel" role="tabpanel" hidden></div>
```

Ett nytt fält `state.tab` (`"ackord" | "grepp"`) styr vilken panel som är synlig. En `renderTabs()`-funktion sätter `aria-selected` på knapparna och `hidden` på panelerna. Ingen routing, inget URL-state — rent DOM-tillstånd, samma mönster som resten av appens `state`-hantering.

### 2. Flik "Ackord"

Innehåller, i ordning:
1. Stämning + skala (dagens `<select>`-par, oförändrad logik)
2. Rotval (`#roots`-pills, oförändrad)
3. Ackordfamilj-filter (`#families`-pills) — **flyttas hit** från nuvarande andra panel, eftersom det avgör vilket ackord som visas, inte hur greppet filtreras
4. Ackordlista (`#chords`-chips, oförändrad)
5. Vanliga vändningar (`#progs`, oförändrad)

Detta är allt som rör *val av ackord* — sådant man ställer in en gång eller sällan ändrar.

### 3. Flik "Grepp"

Innehåller, i ordning:
1. Halsdiagram (`#neck` + `#neckHint`, oförändrad rendering via `drawNeck()`)
2. Greppfilter i en ihopfälld `<details>`/`<summary>`:
   ```html
   <details class="filters">
     <summary>Filter</summary>
     <!-- #fOpen, #fBarre, #fPos, #sort -->
   </details>
   ```
   Stängd som standard. Dagens förvalda värden (`onlyOpen:true, noBarre:true, minPos:0, sort:"open"`) gäller ändå utan att panelen behöver öppnas.
3. Greppkort (`#voicings`-grid + `#noRes`, oförändrad)

Detta är allt som rör *utforskning av grepp* för det redan valda ackordet.

### 4. Visuell konsekvens

- `.tab` och `summary.filters-summary` (om `<summary>` stylas som knapp) måste ha **explicit** `color:var(--ink)` — samma lärdom som `.card`-buggen: knappar ärver inte textfärg från `body`, webbläsarens standardvärde vinner annars.
- Aktiv flik: samma visuella språk som `.pill[aria-pressed="true"]` — mörk bakgrund (`var(--ink)`), ljus text (`var(--paper)`).
- `:focus-visible`-outline (`var(--brass)`) läggs på `.tab` och `summary`, i linje med befintlig regel på rad ~131 i `index.html`.
- Ingen ny färg, inget nytt typsnitt.

### 5. Mobil och desktop

Flikraden är en fullbredd segmented control (`display:flex`, varje `.tab{flex:1}`), vilket ger stora tryckytor på mobil och en kompakt kontroll på desktop utan separata layouter. `<details>` är nativt tillgänglig och kräver ingen extra JS för tangentbord/skärmläsare.

### 6. Kodändring (omfattning)

Berör endast `index.html`:
- Nytt: `state.tab`, `renderTabs()`, CSS för `.tabs`/`.tab`/`.tabpanel`/`.filters`
- Flyttat: DOM-ordning för `#families` (till Ackord-fliken) och greppfiltren (in i `<details>` i Grepp-fliken)
- Oförändrat: `buildChords()`, `findVoicings()`, `fingering()`, `diagram()`, `drawNeck()`, `pluck()`/`strum()`, samt alla existerande `state`-fält förutom tillägget av `tab`

Ingen ny fil, inget nytt beroende, ingen ändring av `TUNINGS`/`MODES`/`QUALITIES`.

### 7. Verifiering

Manuell testning i browser (repot har inget testramverk eller build-steg):
- Ljust och mörkt läge (`prefers-color-scheme`)
- Mobilbredd i devtools (t.ex. 375px) och vanlig desktopbredd
- Tangentbordsnavigering mellan flikar och in i `<details>`
- Att filterval i Grepp-fliken inte nollställs vid byte till Ackord-fliken och tillbaka (rent `state`-baserat, ska hålla per definition)
- Att `.card`-kontrastfixen (redan pushad i `5b5aefb`) inte regredierar

## Utanför scope

- Ingen ändring av greppsöknings- eller poängsättningslogik
- Ingen persistens av `state.tab` mellan sidladdningar (återgår till "Ackord" vid reload)
- Ingen ny build-kedja eller uppdelning i flera filer
