# Ackordföljder efter musikstil

**Status:** Godkänd, redo för implementationsplan
**Datum:** 2026-09-13

## Bakgrund

Ackordföljder-fliken visar idag bara "Vanliga ackordföljder" — fem diatoniska skalstegs-sekvenser som beror på vald skala/läge (`state.mode`) och genereras via `buildChords()`s strikta regel att alla ackordtoner måste finnas i den valda skalan.

Riktiga genrekaraktäristiska ackordföljder (blues, rock, flamenco …) bryter ofta mot det: en 12-takters blues i C-dur använder C7/F7/G7 — där både F7 och C7 innehåller toner (Bb respektive Bb) som inte finns i C-dur-skalan. Sådana ackord kan `findVoicings()` hantera precis lika bra som diatoniska (den bryr sig bara om `chord.root`/`chord.iv`), men `buildChords()` skulle aldrig generera dem.

Målet: en ny sektion där man väljer en musikstil och får en verklighetstrogen, transponerbar ackordföljd för just den stilen — oberoende av `state.mode`.

Inspirationskälla: gitarr.org (blues.html + länkade sidor för rock/punk/country/jazz/bossa/flamenco/spansk musik/klassisk musik/reggae). Innehållet därifrån har verifierats/normaliserats mot etablerad musikteori snarare än citerats ordagrant, se innehållstabellen nedan.

## Beslut från brainstorming

- **Klassificering:** Uppgraderad från bounded till architectural mitt i brainstormingen — gick från 4 föreslagna progressioner till 10 namngivna stilar med eget UI-mönster.
- **UI-mönster:** Stilväljare som pill-rad (samma mönster som `renderFamilies()`), inte en lång stapel av alla 10 samtidigt. Vald stil visas i en egen sektion, ovanför "Vanliga ackordföljder" som lämnas orörd.
- **En progression per stil**, utom blues som får två (12-takt och 8-takt, eftersom de är strukturellt olika taktformer, inte bara olika ackordval).
- **Flamenco vs. Spansk musik:** Får medvetet olika innehåll (kort andalusisk kadens för Spansk musik, längre "Llamada"-fras med ett slash-ackord för Flamenco) istället för att duplicera samma fyra ackord under två knappar.
- **Klassisk musik:** Källan gav inga konkreta ackord (bara teknik/stycken). Ersatt med standardkadensen från klassisk harmonilära (kadential 6/4), som råkar vara ett bra andra exempel på slash-ackord i en progression.

## Design

### 1. Ny ackordkvalitet: powerackord

`QUALITIES` (rad ~337) får en ny post:

```js
{iv:[0,7], sfx:"5", fam:"färg", min:false}
```

Detta gör `5`-ackord uppslagbara via `QMAP`/den nya `SFXMAP` (se nedan), men **påverkar inte** de vanliga ackordchipsen i Ackord-fliken — de styrs av `buildChords()`s egna `cand`/`extra`-intervallistor, inte av hela `QUALITIES`-tabellen. `[0,7]` läggs inte till där.

`findVoicings()`s regel "kvinten får utelämnas" (`essential=chord.iv.filter(i=>i!==7)`) gör att ett powerackords essential-lista bara innehåller grundtonen — men eftersom hela kandidatpoolen för ackordet ändå bara innehåller grundton+kvint (`pcs=[0,7]`), blir resultatet ändå naturligt fullständiga powerackord-voicings. Ingen ändring krävs i `evaluate()`.

### 2. Ackordkonstruktion oberoende av skala

Ny konstant, byggd av `QUALITIES`:

```js
const SFXMAP = new Map(QUALITIES.map(q=>[q.sfx, q.iv]));
```

Ny hjälpfunktion:

```js
function chordFromRootSfx(root, sfx){
  const iv = SFXMAP.get(sfx);
  const q = QMAP.get(qKey(iv));
  return {root, iv, sfx, fam:q.fam, name: nn(root)+sfx};
}
```

Returnerar ett ackordobjekt som är kompatibelt med `findVoicings`/`progVoicings`/`progRow` (de behöver bara `root`+`iv` respektive `.name`), men som helt kringgår `buildChords()`s skalfilter.

### 3. Fast bas i en progression (slash-ackord i data, inte via UI)

`progVoicings()` (rad ~564) får en valfri andra parameter:

```js
function progVoicings(chord, bassPc){
  return findVoicings(chord,{onlyOpen:false,noBarre:true,minPos:0,sort:"open",tuning:state.tuning,slashBass:bassPc??null});
}
```

Detta återanvänder samma hårda `slashBass`-filter i `evaluate()` som redan finns för den interaktiva basväljaren i Grepp-fliken (`state.slashBass`) — bara med ett annat ursprung för värdet. Kortnamnet i progressionsraden byggs som `ch.name + (bassPc!=null ? "/"+nn(bassPc) : "")`.

### 4. Datamodell för stilar

```js
const STYLE_PROGS = [
  {key:"blues", name:"Blues", seqs:[
    {label:"12-takters blues", seq:[
      [0,"7"],[0,"7"],[0,"7"],[0,"7"],
      [5,"7"],[5,"7"],[0,"7"],[0,"7"],
      [7,"7"],[5,"7"],[0,"7"],[0,"7"]
    ]},
    {label:"8-takters blues", seq:[
      [0,""],[0,""],[0,""],[0,""],
      [5,"7"],[5,"7"],[0,""],[7,"7"]
    ]}
  ]},
  {key:"rock", name:"Rock", seqs:[{seq:[[0,""],[10,""],[5,""]]}]},
  {key:"punk", name:"Punk", seqs:[{seq:[[0,"5"],[5,"5"],[7,"5"]]}]},
  {key:"country", name:"Country", seqs:[{seq:[[5,""],[2,"7"],[7,"7"],[0,""]]}]},
  {key:"jazz", name:"Jazz", seqs:[{seq:[[2,"m7"],[7,"7"],[0,"maj7"]]}]},
  {key:"bossa", name:"Bossa nova", seqs:[{seq:[[0,"maj7"],[9,"m7"],[2,"m7"],[7,"7"]]}]},
  {key:"flamenco", name:"Flamenco", seqs:[{seq:[[1,""],[0,""],[8,""],[3,"",10]]}]},
  {key:"spansk", name:"Spansk musik", seqs:[{seq:[[0,"m"],[10,""],[8,""],[7,""]]}]},
  {key:"klassisk", name:"Klassisk musik", seqs:[{seq:[[0,""],[5,""],[0,"",7],[7,""],[0,""]]}]},
  {key:"reggae", name:"Reggae", seqs:[{seq:[[0,"m"],[8,""],[7,"m"],[0,"m"]]}]}
];
```

Varje `seq`-post är `[gradoffset, sfx, basgradoffset?]` — gradoffset och basgradoffset är halvtonsavstånd från `state.root`, oavsett `state.mode`. En stil kan ha flera namngivna `seqs` (bara blues, i dagsläget).

### 5. Innehåll per stil (för granskning)

| Stil | Ackordföljd (i C) | Grader | Källa/motivering |
|---|---|---|---|
| Blues (12-takt) | C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 C7 | I7×4 IV7×2 I7×2 V7 IV7 I7×2 | gitarr.org, ordagrant |
| Blues (8-takt) | C C C C F7 F7 C G7 | I×4 IV7×2 I V7 | gitarr.org, förenklad (kromatisk F♯dim7-passerton i takt 6 utelämnad) |
| Rock | C – Bb – F | I – ♭VII – IV | gitarr.org anger just denna romerska sekvens |
| Punk | C5 – F5 – G5 | I5 – IV5 – V5 | gitarr.org: powerackord är genrens signum |
| Country | F – D7 – G7 – C | IV – II7 – V7 – I | Motsvarar gitarr.orgs "C-A7-D7-G" (i G-dur) — sekundärdominant-vändning |
| Jazz | Dm7 – G7 – Cmaj7 | iim7 – V7 – Imaj7 | gitarr.org, explicit |
| Bossa nova | Cmaj7 – Am7 – Dm7 – G7 | Imaj7 – vim7 – iim7 – V7 | Cirkelvändning, källans egna exempel låg för nära ren jazz |
| Flamenco | Db – C – Ab – Eb/Bb | ♭II – I – ♭VI – ♭III/5 | gitarr.orgs "Llamada"-fras (Bb-A-F-C/G, transponerad hit till C) |
| Spansk musik | Cm – Bb – Ab – G | i – ♭VII – ♭VI – V | Andalusisk kadens, gitarr.orgs eget exempel (Am-G-F-E) |
| Klassisk musik | C – F – C/G – G – C | I – IV – I/5 – V – I | Kadential 6/4, standardkadens (källan gav inga konkreta ackord) |
| Reggae | Cm – Ab – Gm – Cm | i – ♭VI – v – i | Ett av gitarr.orgs exempel (Bm-G-F#m-Bm) — valt istället för det andra som var identiskt med vår Pop-följd |

### 6. UI

Ny sektion i `#tab-vandningar`, ovanför "Vanliga ackordföljder":

```html
<div class="sec-head"><h2>Stilar</h2></div>
<div class="row" id="progStyles"></div>
<div id="progsStyle"></div>
```

`renderProgStyles()` ritar pill-knapparna (samma mönster som `renderFamilies()`), en per post i `STYLE_PROGS`, `aria-pressed` mot `state.progStyle`. Klick sätter `state.progStyle=key` och kör `renderStyleProgs()`.

`renderStyleProgs()`:
- Om `state.progStyle` är `null`: tomt `#progsStyle` (ingen stil vald ännu — första gången, eller efter reset).
- Annars: för varje `seqs`-post i vald stil, bygg `chs` via `chordFromRootSfx((state.root+deg)%12, sfx)`, bygg `items` via `progVoicings(ch, bassOffset!=null ? (state.root+bassOffset)%12 : undefined)`, rendera med `progRow(...,{scrollable:true, onScroll:...})` — samma mönster som `renderBuiltinProgs()`. Om posten har ett `label` (bara blues just nu), visas det som en liten rubrik ovanför raden.

`state.progVoicingIdx`-nycklar för stilraderna prefixas t.ex. `"style-"+styleKey+"-"+seqIdx+"-"+i` för att inte krocka med de diatoniska radernas nycklar.

### 7. State och wiring

- Nytt fält `state.progStyle: null`.
- `renderProgStyles()`+`renderStyleProgs()` kallas överallt `renderBuiltinProgs()` redan kallas idag (init, rotbyte, stämningsbyte) — **inte** vid lägesbyte utöver den nollställning av `progVoicingIdx` som redan sker där (stilprogressionerna påverkas inte av `state.mode`, men delar nyckelrymd så en nollställning är ofarlig).
- `state.progStyle` nollställs **inte** vid rot- eller stämningsbyte (till skillnad från `state.chord`/`state.slashBass`) — vald stil är ett medvetet användarval som ska bestå tills man aktivt byter eller stänger av det, precis som `state.family`.

## Att inte göra

- Ingen ny UI för att välja *vilken* av flera progressioner inom en stil (bara blues har fler än en, och de radas bara under varandra).
- Ingen ändring av `buildChords()` eller de vanliga ackordchipsen.
- Ingen persistens av vald stil i `localStorage` — återställs till ingen vald stil vid sidladdning, precis som `state.family` gör idag.
