# Ackordföljder efter musikstil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lägg till en stilväljare i Ackordföljder-fliken där man väljer en musikstil (Blues, Rock, Punk, Country, Jazz, Bossa nova, Flamenco, Spansk musik, Klassisk musik, Reggae) och får en verklighetstrogen, transponerbar ackordföljd för just den stilen — oberoende av vald skala.

**Architecture:** Ny ackordkonstruktion (`chordFromRootSfx`) bygger ackordobjekt direkt från grundton+kvalitetssuffix, förbi `buildChords()`s skalfilter. En ny datakonstant (`STYLE_PROGS`) beskriver varje stils ackordföljd som gradoffset+kvalitet(+valfri fast bas för slash-ackord). Rendering återanvänder `progRow()` och samma bläddringsmönster som befintliga "Vanliga ackordföljder" (`renderBuiltinProgs()`).

**Tech Stack:** Vanilla JS i `index.html` (IIFE, ingen build), inga nya beroenden. Verifiering sker dels via `node --check`/en liten Node-sträng-harness för den rena logiken (projektet har ingen testrunner), dels manuellt i webbläsaren enligt CLAUDE.md:s "Ändringar verifieras genom att öppna filen i webbläsaren och prova UI:t."

**Spec:** [docs/superpowers/specs/2026-09-13-stilprogressioner-design.md](../specs/2026-09-13-stilprogressioner-design.md)

## Global Constraints

- All logik och rendering hålls i `index.html` — inga nya filer, inget build-steg, inga npm-beroenden (CLAUDE.md).
- Ändra inte `buildChords()` eller de vanliga ackordchipsens kandidatlistor — powerackordskvaliteten ska bara vara uppslagbar för stilprogressioner, inte dyka upp som ett nytt chip i Ackord-fliken (spec §1).
- `state.progStyle` nollställs **aldrig** vid rot- eller stämningsbyte (samma beteende som `state.family`) — bara det ackord/den bas som är kopplad till Grepp-fliken (`state.chord`/`state.slashBass`) nollställs vid såna byten (spec §7).
- Appen stavar alltid med korsförtecken (`nn()`/`SHARP`), aldrig b — se commit "Ta bort automatisk b-stavning". De ackordnamn som faktiskt visas i UI:t använder alltså `♯`, inte `b`, även där specens innehållstabell av läsbarhetsskäl skrev t.ex. "Bb"/"Db" — de exakta strängarna för det i denna plan är omräknade till `♯`-stavning.
- Svenska i all UI-text, samma kodstil som omgivande kod (inga onödiga kommentarer).

---

## Task 1: Ackordkonstruktion oberoende av skala

**Files:**
- Modify: `index.html:337-358` (lägg till en post i `QUALITIES`)
- Modify: `index.html:359-360` (lägg till `SFXMAP` och `chordFromRootSfx` direkt efter `QMAP`)
- Modify: `index.html:567-569` (`progVoicings` får en valfri `bassPc`-parameter)

**Interfaces:**
- Produces: `SFXMAP: Map<string,number[]>` (kvalitetssuffix → intervall-array), `chordFromRootSfx(root:number, sfx:string) → {root, iv, sfx, fam, name}`, `progVoicings(chord, bassPc?:number) → voicing[]` (bakåtkompatibel — `bassPc` är valfri, befintliga anrop utan andra argumentet är oförändrade).
- Consumes: befintliga `QUALITIES`, `qKey`, `QMAP`, `nn`, `findVoicings`, `state.tuning`.

- [ ] **Step 1: Lägg till powerackordskvaliteten**

I `index.html`, lägg till en ny rad sist i `QUALITIES`-arrayen (efter raden med `sfx:"m9"`, före den avslutande `];`):

```js
  {iv:[0,2,3,7,10],  sfx:"m9",      fam:"färg",     min:true},
  {iv:[0,7],         sfx:"5",       fam:"färg",     min:false}
];
```

(Observera: befintlig `m9`-rad ska INTE ändras i övrigt — bara kommatecknet i slutet läggs till och den nya raden kommer efter.)

- [ ] **Step 2: Syntaxkontrollera**

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('_verify.tmp.js', m[1]);
"
node --check _verify.tmp.js && echo OK
```
Förväntat: `OK`, ingen `SyntaxError`.

- [ ] **Step 3: Lägg till `SFXMAP` och `chordFromRootSfx`**

Direkt efter raden `const QMAP=new Map(QUALITIES.map(q=>[qKey(q.iv),q]));` (rad 360), lägg till:

```js
const SFXMAP=new Map(QUALITIES.map(q=>[q.sfx,q.iv]));
function chordFromRootSfx(root,sfx){
  const iv=SFXMAP.get(sfx);
  const q=QMAP.get(qKey(iv));
  return {root,iv,sfx,fam:q.fam,name:nn(root)+sfx};
}
```

- [ ] **Step 4: Syntaxkontrollera** (samma kommando som Step 2)

- [ ] **Step 5: Ge `progVoicings` en valfri bas-parameter**

Ersätt (rad 567-569):

```js
function progVoicings(chord){
  return findVoicings(chord,{onlyOpen:false,noBarre:true,minPos:0,sort:"open",tuning:state.tuning});
}
```

med:

```js
function progVoicings(chord,bassPc){
  return findVoicings(chord,{onlyOpen:false,noBarre:true,minPos:0,sort:"open",tuning:state.tuning,slashBass:bassPc??null});
}
```

- [ ] **Step 6: Syntaxkontrollera** (samma kommando som Step 2)

- [ ] **Step 7: Verifiera logiken med en Node-harness**

Detta projekt har ingen testrunner, men allt fram till `/* ---------- Init ---------- */` är rena funktioner/konstanter utan DOM-anrop vid definition (bara `el(...)`-anrop inuti `render*`-funktioner, som vi inte kallar här). Extrahera den delen och kör påståenden mot den:

Skriptet gör ett topp-nivå-anrop `applyTheme();` (temaväxlaren) som kraschar direkt i Node om `document` inte finns alls — stubba det minimalt:

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('<script>')+'<script>'.length;
const end=html.indexOf('/* ---------- Init ---------- */');
fs.writeFileSync('_logic.tmp.js', html.slice(start,end));
"
cat > _harness.tmp.js <<'HARNESS'
global.document = { documentElement:{ removeAttribute(){}, setAttribute(){} }, getElementById(){ return null; } };
require('./_logic.tmp.js');
HARNESS
cat >> _logic.tmp.js <<'EOF'

// --- Task 1-verifiering ---
console.assert(QMAP.get(qKey([0,7])).sfx==="5", "powerackord saknas i QMAP");
console.assert(JSON.stringify(SFXMAP.get("5"))==="[0,7]", "SFXMAP saknar '5'");
console.assert(JSON.stringify(SFXMAP.get("m7"))==="[0,3,7,10]", "SFXMAP saknar 'm7'");

const c5=chordFromRootSfx(0,"5");
console.assert(c5.name==="C5" && JSON.stringify(c5.iv)==="[0,7]" && c5.fam==="färg", "chordFromRootSfx('5') fel: "+JSON.stringify(c5));

const dm7=chordFromRootSfx(2,"m7");
console.assert(dm7.name==="Dm7" && JSON.stringify(dm7.iv)==="[0,3,7,10]", "chordFromRootSfx('m7') fel: "+JSON.stringify(dm7));

const cmaj=chordFromRootSfx(0,"");
const plain=progVoicings(cmaj);
console.assert(plain.length>0, "progVoicings utan bas gav inga grepp för C-dur");

const slashG=progVoicings(cmaj,7);
console.assert(slashG.length>0, "progVoicings(C,bas=G) gav inga grepp — förväntade minst C/G-formen 3x2010");
console.assert(slashG.every(v=>v.bass===7), "progVoicings(C,bas=G) läckte grepp med fel bas: "+JSON.stringify(slashG.map(v=>v.bass)));

console.log("Task 1: alla påståenden OK");
EOF
node _harness.tmp.js
rm _logic.tmp.js _harness.tmp.js _verify.tmp.js 2>/dev/null
```

Förväntat: `Task 1: alla påståenden OK` utan några `Assertion failed`-rader (Node skriver ut `console.assert`-fel till stderr men kraschar inte processen — läs igenom output och bekräfta att inget "fel"-meddelande syns).

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Lägg till ackordkonstruktion oberoende av skala (för stilprogressioner)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 2: HTML-sektion, state och stilväljare

**Files:**
- Modify: `index.html:288-291` (ny sektion "Stilar" i `#tab-vandningar`, ovanför "Vanliga ackordföljder")
- Modify: `index.html:365-` (`state`-objektet: nytt fält `progStyle`)
- Modify: `index.html` CSS-blocket, nära `.sec-head h2` (rad ~126): ny `.prog-title`-regel
- Modify: `index.html`, nära `renderFamilies()` (rad ~714): ny `renderProgStyles()`

**Interfaces:**
- Consumes: `state` (från Task-ospecifikt, redan finns), CSS-klasserna `.pills`/`.pill`/`.pill.small` (redan finns).
- Produces: `state.progStyle: string|null`, DOM-element `#progStyles` (pill-container) och `#progsStyle` (tomt än så länge — fylls i Task 3), funktionen `renderProgStyles()`.

- [ ] **Step 1: Lägg till CSS för radrubrik**

I `<style>`-blocket, direkt efter regeln `.sec-head span{font-size:12.5px;color:var(--ink-soft)}` (rad 127), lägg till:

```css
.prog-title{font-family:"Instrument Serif",Georgia,serif;font-size:15px;margin:0 0 6px;color:var(--ink)}
```

- [ ] **Step 2: Lägg till HTML-sektionen**

Ersätt (rad 288-291):

```html
<div id="tab-vandningar" class="tabpanel" role="tabpanel" aria-labelledby="tabbtn-vandningar" hidden>
  <div class="sec-head"><h2>Vanliga ackordföljder</h2></div>
  <div id="progsBuiltin"></div>
```

med:

```html
<div id="tab-vandningar" class="tabpanel" role="tabpanel" aria-labelledby="tabbtn-vandningar" hidden>
  <div class="sec-head"><h2>Stilar</h2></div>
  <div class="row"><div class="pills" id="progStyles"></div></div>
  <div id="progsStyle"></div>

  <div class="sec-head"><h2>Vanliga ackordföljder</h2></div>
  <div id="progsBuiltin"></div>
```

- [ ] **Step 3: Lägg till `state.progStyle`**

I `state`-objektet, direkt efter raden `slashBass:null,` lägg till:

```js
  progStyle:null,
```

- [ ] **Step 4: Syntaxkontrollera**

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('_verify.tmp.js', m[1]);
"
node --check _verify.tmp.js && echo OK && rm _verify.tmp.js
```

- [ ] **Step 5: Lägg till `renderProgStyles()`**

Direkt efter `renderFamilies()`s avslutande `}` (rad 723), lägg till en ny funktion. Namnen och etiketterna nedan MÅSTE matcha `key`-fälten i `STYLE_PROGS` som skapas i Task 3 exakt (`blues`, `rock`, `punk`, `country`, `jazz`, `bossa`, `flamenco`, `spansk`, `klassisk`, `reggae`):

```js
function renderProgStyles(){
  const box=el("progStyles"); box.innerHTML="";
  [["blues","Blues"],["rock","Rock"],["punk","Punk"],["country","Country"],["jazz","Jazz"],
   ["bossa","Bossa nova"],["flamenco","Flamenco"],["spansk","Spansk musik"],
   ["klassisk","Klassisk musik"],["reggae","Reggae"]].forEach(([k,lbl])=>{
    const b=document.createElement("button");
    b.className="pill small"; b.textContent=lbl;
    b.setAttribute("aria-pressed",state.progStyle===k);
    b.onclick=()=>{ state.progStyle=state.progStyle===k?null:k; renderProgStyles(); renderStyleProgs(); };
    box.appendChild(b);
  });
}
```

(`renderStyleProgs()` finns inte än — den skrivs i Task 3. Det är därför detta steg ensamt inte går att testa i webbläsaren utan ett fel; se Step 6 för en tillfällig stub som gör Task 2 verifierbart för sig.)

Klick på en redan vald stil avmarkerar den (växlar tillbaka till `null`) — samma "klicka igen för att stänga av"-mönster som inte finns för familjefiltret men är rimligt här eftersom `#progsStyle` annars alltid måste visa något.

- [ ] **Step 6: Lägg till en tillfällig stub för `renderStyleProgs` och koppla in `renderProgStyles`**

Lägg till en tillfällig stub direkt efter `renderProgStyles()` (den ersätts helt i Task 3, Step 5 — sök inte efter denna kod senare, den försvinner):

```js
function renderStyleProgs(){ /* implementeras i Task 3 */ }
```

Lägg till anropet av `renderProgStyles()` i `renderAll()` (rad ~961-963), ersätt:

```js
function renderAll(){
  renderRoots(); renderChords(); renderBuiltinProgs(); renderCustomProgs(); drawNeck(); renderVoicings(); renderTabs();
}
```

med:

```js
function renderAll(){
  renderRoots(); renderChords(); renderBuiltinProgs(); renderCustomProgs(); renderProgStyles(); renderStyleProgs(); drawNeck(); renderVoicings(); renderTabs();
}
```

- [ ] **Step 7: Syntaxkontrollera** (samma kommando som Step 4)

- [ ] **Step 8: Manuell verifiering i webbläsaren**

```bash
python3 -m http.server 8000
```

Öppna `http://localhost:8000`, gå till fliken **Ackordföljder**. Kontrollera:
1. En rad med 10 piller syns överst: Blues, Rock, Punk, Country, Jazz, Bossa nova, Flamenco, Spansk musik, Klassisk musik, Reggae — i den ordningen, ovanför "Vanliga ackordföljder".
2. Klick på "Blues" gör den mörk/markerad (`aria-pressed="true"` i devtools-inspektorn), ingen annan pill blir markerad samtidigt.
3. Klick på "Blues" igen avmarkerar den.
4. Ingen ruta med tomma/döda greppkort syns under piller — `#progsStyle` är tomt oavsett vald stil (stubben gör ännu ingenting).
5. Inga JS-fel i webbläsarkonsolen.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Lägg till stilväljare (piller) i Ackordföljder-fliken

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 3: Stilinnehåll och rendering

**Files:**
- Modify: `index.html`, direkt efter `progVoicings` (rad ~570, efter Task 1): ny konstant `STYLE_PROGS`
- Modify: `index.html`: ersätt stubben `renderStyleProgs()` från Task 2 med den riktiga implementationen
- Modify: `index.html:980` (`ts.onchange`) och `index.html:985` (`ms.onchange`): lägg till `renderStyleProgs()`-anrop

**Interfaces:**
- Consumes: `chordFromRootSfx` och `progVoicings(chord,bassPc)` (Task 1), `state.progStyle`, `#progStyles`/`#progsStyle` (Task 2), `progRow(items,opts)` (befintlig, se `index.html:748`).
- Produces: `STYLE_PROGS: {key,name,seqs:[{label?,seq:[number,string,number?][]}]}[]`, färdig `renderStyleProgs()`.

- [ ] **Step 1: Lägg till `STYLE_PROGS`**

Direkt efter `progVoicings`s avslutande `}` (efter Task 1), lägg till:

```js
const STYLE_PROGS=[
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

- [ ] **Step 2: Syntaxkontrollera**

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('_verify.tmp.js', m[1]);
"
node --check _verify.tmp.js && echo OK && rm _verify.tmp.js
```

- [ ] **Step 3: Ersätt stubben med den riktiga `renderStyleProgs()`**

Ersätt raden `function renderStyleProgs(){ /* implementeras i Task 3 */ }` (från Task 2) med:

```js
function renderStyleProgs(){
  const box=el("progsStyle"); box.innerHTML="";
  if(!state.progStyle) return;
  const style=STYLE_PROGS.find(s=>s.key===state.progStyle);
  if(!style) return;
  style.seqs.forEach((entry,seqIdx)=>{
    const chs=entry.seq.map(([deg,sfx])=>chordFromRootSfx((state.root+deg)%12,sfx));
    const bassPcs=entry.seq.map(([,,bassDeg])=>bassDeg!=null?(state.root+bassDeg)%12:null);
    const items=chs.map((ch,i)=>{
      const list=progVoicings(ch,bassPcs[i]);
      const key="style-"+style.key+"-"+seqIdx+"-"+i;
      let idx=state.progVoicingIdx[key]||0;
      if(idx>=list.length) idx=0;
      const label=ch.name+(bassPcs[i]!=null?"/"+nn(bassPcs[i]):"");
      return {label, voicing:list[idx]};
    });
    if(entry.label){
      const h=document.createElement("div");
      h.className="prog-title"; h.textContent=entry.label;
      box.appendChild(h);
    }
    box.appendChild(progRow(items,{
      scrollable:true,
      onScroll:(i,delta)=>{
        const list=progVoicings(chs[i],bassPcs[i]);
        if(!list.length) return;
        const key="style-"+style.key+"-"+seqIdx+"-"+i;
        const cur=state.progVoicingIdx[key]||0;
        state.progVoicingIdx[key]=(cur+delta+list.length)%list.length;
        renderStyleProgs();
      }
    }));
  });
}
```

- [ ] **Step 4: Koppla in omritning vid stämnings- och lägesbyte**

Ersätt (rad ~980):

```js
  ts.onchange=()=>{ state.tuning=ts.value; state.progVoicingIdx={}; closeBuilder(); drawNeck(); renderVoicings(); renderBuiltinProgs(); };
```

med:

```js
  ts.onchange=()=>{ state.tuning=ts.value; state.progVoicingIdx={}; closeBuilder(); drawNeck(); renderVoicings(); renderBuiltinProgs(); renderStyleProgs(); };
```

Ersätt (rad ~985):

```js
  ms.onchange=()=>{ state.mode=ms.value; state.chord=null; state.slashBass=null; state.progVoicingIdx={}; closeBuilder(); renderChords(); renderBuiltinProgs(); drawNeck(); renderVoicings(); };
```

med:

```js
  ms.onchange=()=>{ state.mode=ms.value; state.chord=null; state.slashBass=null; state.progVoicingIdx={}; closeBuilder(); renderChords(); renderBuiltinProgs(); renderStyleProgs(); drawNeck(); renderVoicings(); };
```

(`renderProgStyles()`+`renderStyleProgs()` kallas redan från `renderAll()`, som i sin tur kallas av rotvals-knapparna — inget extra behövs där.)

- [ ] **Step 5: Syntaxkontrollera** (samma kommando som Step 2)

- [ ] **Step 6: Manuell verifiering i webbläsaren — innehåll per stil**

```bash
python3 -m http.server 8000
```

Öppna `http://localhost:8000`, se till att grundton är **C** (första piller under "Rotton" i Ackord-fliken ska vara markerad som standard), gå till **Ackordföljder**. Appen stavar alltid med korsförtecken (aldrig b), så kontrollera exakt dessa ackordnamn (läs av `.cname`-texten på varje greppkort i tur och ordning):

| Pill | Förväntade kortnamn i ordning |
|---|---|
| Blues | rubrik "12-takters blues": C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 C7 — därefter rubrik "8-takters blues": C C C C F7 F7 C G7 |
| Rock | C, A♯, F |
| Punk | C5, F5, G5 |
| Country | F, D7, G7, C |
| Jazz | Dm7, G7, Cmaj7 |
| Bossa nova | Cmaj7, Am7, Dm7, G7 |
| Flamenco | C♯, C, G♯, D♯/A♯ |
| Spansk musik | Cm, A♯, G♯, G |
| Klassisk musik | C, F, C/G, G, C |
| Reggae | Cm, G♯, Gm, Cm |

För varje pill: kontrollera även att inget kort visar "Inget grepp" (tomt fallback-läge) — om något gör det, notera vilket ackord och gå vidare (inte en blockerande bugg för denna plan, men värt att flagga).

- [ ] **Step 7: Manuell verifiering — transponering, bläddring, val kvarstår**

1. Med "Blues" vald: byt grundton till **G** (Rotton-piller i Ackord-fliken). Gå tillbaka till Ackordföljder. Bekräfta att 12-takters blues nu läser G7 G7 G7 G7 C7 C7 G7 G7 D7 C7 G7 G7 (dvs samma mönster, transponerat) — och att "Blues" fortfarande är markerad (state.progStyle nollställs inte vid rotbyte).
2. Klicka ‹/› på ett av greppkorten i en stilrad. Bekräfta att just det kortets diagram byter grepp utan att de andra korten i raden ändras.
3. Byt stämning (Stämning-väljaren i Ackord-fliken) till t.ex. "Drop D". Bekräfta att stilraderna ritas om utan fel (greppen kan se annorlunda ut, det är förväntat).
4. Klicka på ett greppkort i en stilrad — bekräfta att ackordet spelas upp (samma ljud-interaktion som övriga greppkort).
5. Kontrollera att inga JS-fel syns i webbläsarkonsolen genom hela detta flöde.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Lägg till ackordföljder per musikstil (blues, rock, punk, country, jazz, bossa nova, flamenco, spansk musik, klassisk musik, reggae)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```
