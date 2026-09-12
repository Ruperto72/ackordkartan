# Ackordkartan

En enfilsapp som genererar gitarrgrepp i en vald tonart — med fokus på **öppna klanger högt upp på halsen**, inte bara barrégrepp i första läget.

Ingen byggkedja, inga beroenden, inget ackordbibliotek. All teori och all greppsökning körs i webbläsaren.

## Så fungerar greppsökningen

1. Varje sträng får kandidatvärdena `mute`, `0` (öppen) eller vilket band 1–15 vars tonklass ingår i ackordet.
2. Djupet-först-sökning över de sex strängarna, med beskärning på spännvidd (max 5 band).
3. Filter på det som faktiskt går att spela:
   - alla nödvändiga toner måste finnas (kvinten får utelämnas)
   - minst fyra klingande strängar, max ett dämpat mellanrum
   - max fyra unika band = fyra fingrar
   - barrégiltighet: ligger två toner på samma band måste strängarna emellan greppas högre
4. Poängsättning som premierar öppna strängar och högt läge, och straffar spännvidd, barré och antal fingrar.

Steg 4 är hela poängen: filtrera på "minst en öppen sträng" + lägsta läge band 5 så återstår bara saker som Dsus2-formen flyttad upp, Cadd9 kring band 7, m7-grepp med öppen h- och e-sträng.

## Funktioner

- Sju skalor: dur, moll, dorisk, mixolydisk, lydisk, frygisk, harmonisk moll
- Treklanger, septimackord och färgade ackord (sus2, sus4, 6, add9, 9, m9 …) filtrerade till det som håller sig i tonarten
- Alternativa stämningar: standard, drop D, DADGAD, öppen G, öppen D, nedstämt ett halvt/helt steg
- Halsdiagram som visar ackordstonerna mot skalan över 15 band
- Uppspelning med Karplus-Strong-syntes via Web Audio, inget ljudmaterial att ladda
- Följer systemets ljusa/mörka läge

## Köra lokalt

```bash
python3 -m http.server 8000
# öppna http://localhost:8000
```

Eller öppna `index.html` direkt i webbläsaren — den behöver ingen server.

## GitHub Pages

`index.html` ligger i roten, så det räcker att slå på Pages under **Settings → Pages → Deploy from a branch → main / (root)**.

## Kod

Allt ligger i `index.html`:

| Del | Vad den gör |
| --- | --- |
| `TUNINGS`, `MODES`, `QUALITIES` | teoritabeller, ackordkvaliteter slås upp på intervallmängd |
| `buildChords()` | staplar terser inom skalan och lägger till färgade varianter som ryms |
| `findVoicings()` | sökningen och poängsättningen ovan |
| `fingering()` | tilldelar finger 1–4 efter bandordning, samma band = samma finger |
| `diagram()`, `drawNeck()` | SVG-rendering |
| `pluck()`, `strum()` | Karplus-Strong |

## Licens

MIT
