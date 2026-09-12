# Flikbaserat menysystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dela upp Ackordkartans enda långa sida i två flikar ("Ackord" och "Grepp") och göra greppfiltren ihopfällbara, utan att röra musikteori- eller greppsökningslogiken.

**Architecture:** Ren DOM-omstrukturering i det befintliga enda-filen-scriptet. Två `<div class="tabpanel">` grupperar redan existerande sektioner om; ett nytt `state.tab`-fält + `renderTabs()` styr vilken som visas. Greppfiltren flyttas in i ett natievt `<details>`-element. Ingen ny fil, inget nytt beroende, ingen ändring i `findVoicings`/`buildChords`/`fingering`/`diagram`/`drawNeck`/`pluck`/`strum`.

**Tech Stack:** Vanilla HTML/CSS/JS i [index.html](../../../index.html). Inget build-steg, inget testramverk.

**Spec:** [docs/superpowers/specs/2026-09-12-menysystem-design.md](../specs/2026-09-12-menysystem-design.md)

## Global Constraints

- Ingen ändring av greppsöknings- eller poängsättningslogik (`findVoicings`, `buildChords`, `fingering`).
- Allt stannar i `index.html` — ingen ny fil, inget nytt beroende, ingen build-kedja.
- Ingen persistens av `state.tab` mellan sidladdningar — återgår till "Ackord" vid reload.
- Repot har inget testramverk. Verifiering sker manuellt i browser (`python3 -m http.server 8000`).
- Behåll nuvarande palett/typografi (ink/brass/paper, Instrument Serif + Instrument Sans) — förfina, byt inte ut.
- Alla nya klickbara element (`.tab`, `summary`) måste ha **explicit** `color:var(--ink)` — knappar och `<summary>` ärver inte textfärg från `body`, se buggen fixad i commit `5b5aefb`.

---

### Task 1: Flikstruktur — CSS, markup, state och navigation

**Files:**
- Modify: `index.html` (CSS-block, ca rad 131 och 145–147; body-markup rad 155–204; `state`-objekt rad 267–277; `init()` rad 645–663)

**Interfaces:**
- Producerar: `state.tab` (`"ackord" | "grepp"`), `renderTabs()` (ingen parameter, ingen retur — läser/skriver DOM utifrån `state.tab`). Task 2 och 3 bygger vidare på dessa utan att ändra dem.

- [ ] **Step 1: Lägg till CSS för flikarna**

Sök upp `:focus-visible`-regeln och lägg till `.tab` samt `summary` i selektorlistan, och lägg till de nya reglerna direkt efter `.toggle`-blocket:

```css
.card:focus-visible,.pill:focus-visible,.chip:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{
  outline:2px solid var(--brass);outline-offset:2px;
}
```

```css
.tabs{display:flex;gap:6px;margin-bottom:14px}
.tab{
  flex:1;
  font:inherit;font-size:14px;font-weight:500;
  background:var(--panel);
  color:var(--ink);
  border:1px solid var(--line-strong);
  border-radius:8px;
  padding:9px 12px;
  cursor:pointer;
  text-align:center;
}
.tab[aria-selected="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.tabpanel[hidden]{display:none}
```

- [ ] **Step 2: Lägg till markup för flikraden och de två panelerna**

Ersätt hela blocket från `<h1>Ackordkartan</h1>` till och med `<div id="noRes"></div>` (dvs. allt innanför `.wrap` utom `<footer>`) med:

```html
<h1>Ackordkartan</h1>
<p class="tagline">Välj tonart och ackord. Appen söker igenom hela halsen efter grepp som klingar med öppna strängar – inte bara barrégrepp i första läget.</p>

<div class="tabs" role="tablist">
  <button class="tab" role="tab" id="tabbtn-ackord" aria-selected="true" data-tab="ackord">Ackord</button>
  <button class="tab" role="tab" id="tabbtn-grepp" aria-selected="false" data-tab="grepp">Grepp</button>
</div>

<div id="tab-ackord" class="tabpanel" role="tabpanel" aria-labelledby="tabbtn-ackord">
  <div class="panel">
    <div class="row">
      <label class="field">Stämning
        <select id="tuning"></select>
      </label>
      <label class="field">Skala
        <select id="mode"></select>
      </label>
    </div>
    <div class="row" style="margin-top:12px">
      <div class="pills" id="roots"></div>
    </div>
  </div>

  <div class="panel">
    <div class="row">
      <div class="pills" id="families"></div>
    </div>
  </div>

  <div class="sec-head"><h2>Ackord i tonarten</h2><span id="scaleNotes"></span></div>
  <div class="chordbar" id="chords"></div>

  <div class="sec-head" style="margin-bottom:6px"><h2>Vanliga vändningar</h2></div>
  <div class="prog" id="progs"></div>
</div>

<div id="tab-grepp" class="tabpanel" role="tabpanel" aria-labelledby="tabbtn-grepp" hidden>
  <div class="panel">
    <div class="neck-scroll"><svg id="neck" role="img" aria-label="Halsdiagram med ackordets toner"></svg></div>
    <p class="hint" id="neckHint"></p>
  </div>

  <div class="row">
    <label class="toggle"><input type="checkbox" id="fOpen" checked> Minst en öppen sträng</label>
    <label class="toggle"><input type="checkbox" id="fBarre" checked> Undvik barré</label>
  </div>
  <div class="row">
    <label class="field">Lägsta läge: <b id="posLabel" style="color:var(--ink)">band 0</b>
      <input type="range" id="fPos" min="0" max="9" value="0">
    </label>
    <label class="field">Sortering
      <select id="sort">
        <option value="open">Öppenhet, högt läge först</option>
        <option value="pos">Läge, lågt till högt</option>
        <option value="easy">Enklast att greppa</option>
      </select>
    </label>
  </div>

  <div class="sec-head"><h2 id="voicingTitle">Grepp</h2><span id="voicingCount"></span></div>
  <div class="grid" id="voicings"></div>
  <div id="noRes"></div>
</div>
```

Not: greppfiltren ligger här fortfarande som vanliga `.row`-block utan egen panelbakgrund — de får sin styling när de wrappas i `.filters` i Task 2. Det är ett normalt, fungerande mellansteg.

- [ ] **Step 3: Lägg till `state.tab` och `renderTabs()`**

I `state`-objektet, lägg till fältet:

```js
const state={
  tuning:Object.keys(TUNINGS)[0],
  mode:"Dur (jonisk)",
  root:0,
  chord:null,
  family:"alla",
  onlyOpen:true,
  noBarre:true,
  minPos:0,
  sort:"open",
  tab:"ackord"
};
```

Lägg till funktionen direkt efter `renderAll()`:

```js
function renderTabs(){
  document.querySelectorAll(".tab").forEach(b=>{
    b.setAttribute("aria-selected", b.dataset.tab===state.tab);
  });
  el("tab-ackord").hidden = state.tab!=="ackord";
  el("tab-grepp").hidden = state.tab!=="grepp";
}
```

- [ ] **Step 4: Wira klickhanterare och första render**

I `init()`, lägg till (t.ex. direkt efter `el("sort").onchange=...`-raden):

```js
document.querySelectorAll(".tab").forEach(b=>{
  b.onclick=()=>{ state.tab=b.dataset.tab; renderTabs(); };
});
```

Lägg till ett anrop till `renderTabs()` sist i `renderAll()`-funktionen (efter `renderVoicings()`), så att fliktillståndet alltid är korrekt synkat när hela UI:t byggs om:

```js
function renderAll(){
  renderRoots(); renderChords(); renderProgs(); drawNeck(); renderVoicings(); renderTabs();
}
```

- [ ] **Step 5: Verifiera manuellt i browser**

Kör:
```bash
python3 -m http.server 8000
```
Öppna `http://localhost:8000` och kontrollera:
- Sidan laddas med fliken "Ackord" aktiv (mörk bakgrund på flikknappen) och synlig; "Grepp"-panelen är dold.
- Klick på "Grepp" visar halsdiagram, filter och greppkort; "Ackord"-panelen döljs.
- Klick tillbaka på "Ackord" visar rotval/ackordlista/vändningar igen, ackordfamilj-filtret finns kvar där.
- Byt rot eller ackord i Ackord-fliken, byt sedan till Grepp-fliken — rätt ackord/grepp visas (dvs. inget state gick förlorat).
- Tabbtangent + Enter/Space växlar flik (tangentbordsnavigering).
- Växla ljust/mörkt läge i OS-inställningarna (eller devtools "Rendering → Emulate CSS prefers-color-scheme") — flikknapparnas text är läsbar i båda lägena.
- Förminska fönstret till ~375px bredd — flikraden fyller bredden och är lätt att trycka på.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Lägg till flikbaserat menysystem (Ackord/Grepp)"
```

---

### Task 2: Ihopfällbart greppfilter

**Files:**
- Modify: `index.html` (CSS-block efter `.tab`-reglerna från Task 1; markup i `#tab-grepp` från Task 1, Step 2)

**Interfaces:**
- Konsumerar: `#tab-grepp`-panelen och filterelementen (`#fOpen`, `#fBarre`, `#fPos`, `#sort`) från Task 1. Inga nya id:n eller funktioner — samma `onchange`/`oninput`-handlers i `init()` fortsätter fungera oförändrade eftersom id:na inte ändras.

- [ ] **Step 1: Lägg till CSS för `<details class="filters">`**

Lägg till direkt efter `.tabpanel[hidden]{display:none}`:

```css
.filters{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:10px 14px;
  margin-bottom:14px;
  box-shadow:var(--shadow);
}
.filters summary{
  font-size:14px;
  font-weight:500;
  color:var(--ink);
  cursor:pointer;
}
.filters[open] summary{margin-bottom:8px}
```

- [ ] **Step 2: Wrappa greppfiltren i `<details>`**

I `#tab-grepp` (från Task 1, Step 2), ersätt de två `.row`-blocken för filtren:

```html
  <div class="row">
    <label class="toggle"><input type="checkbox" id="fOpen" checked> Minst en öppen sträng</label>
    <label class="toggle"><input type="checkbox" id="fBarre" checked> Undvik barré</label>
  </div>
  <div class="row">
    <label class="field">Lägsta läge: <b id="posLabel" style="color:var(--ink)">band 0</b>
      <input type="range" id="fPos" min="0" max="9" value="0">
    </label>
    <label class="field">Sortering
      <select id="sort">
        <option value="open">Öppenhet, högt läge först</option>
        <option value="pos">Läge, lågt till högt</option>
        <option value="easy">Enklast att greppa</option>
      </select>
    </label>
  </div>
```

med:

```html
  <details class="filters">
    <summary>Filter</summary>
    <div class="row" style="margin-top:10px">
      <label class="toggle"><input type="checkbox" id="fOpen" checked> Minst en öppen sträng</label>
      <label class="toggle"><input type="checkbox" id="fBarre" checked> Undvik barré</label>
    </div>
    <div class="row">
      <label class="field">Lägsta läge: <b id="posLabel" style="color:var(--ink)">band 0</b>
        <input type="range" id="fPos" min="0" max="9" value="0">
      </label>
      <label class="field">Sortering
        <select id="sort">
          <option value="open">Öppenhet, högt läge först</option>
          <option value="pos">Läge, lågt till högt</option>
          <option value="easy">Enklast att greppa</option>
        </select>
      </label>
    </div>
  </details>
```

- [ ] **Step 3: Verifiera manuellt i browser**

Med servern fortsatt igång (`python3 -m http.server 8000`):
- Öppna Grepp-fliken — filtret ("Filter") är stängt som standard, greppkorten visas direkt under med dagens förvalda filtrering (minst en öppen sträng, undvik barré, band 0, sortering "Öppenhet, högt läge först").
- Klicka på "Filter" — panelen fälls ut och visar samma kontroller som tidigare, alla fortfarande med rätt förvalt värde (kryssrutorna ikryssade, slidern på 0).
- Ändra ett filterval (t.ex. dra slidern till band 3) — greppkorten uppdateras precis som innan omstruktureringen.
- Tabba till "Filter" med tangentbordet och tryck Enter/Space — fäller ut/in på samma sätt som med musen.
- Kontrollera ljust och mörkt läge — "Filter"-texten är läsbar i båda.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Gör greppfiltren ihopfällbara med details/summary"
```

---

### Task 3: Dokumentation och slutgiltig verifiering

**Files:**
- Modify: `CLAUDE.md` (avsnittet "Arkitektur")

**Interfaces:**
- Konsumerar: inget nytt — sammanfattar det som Task 1–2 redan byggt.

- [ ] **Step 1: Uppdatera arkitekturavsnittet i CLAUDE.md**

Lägg till en mening om flikstrukturen i punkt 5 (Rendering) i `CLAUDE.md`. Ändra:

```markdown
5. **Rendering** — `diagram()` ritar ett enskilt greppdiagram som SVG-sträng; `drawNeck()` ritar hela halsdiagrammet (15 band) med skal- och ackordtoner; `render*()`-funktionerna (`renderRoots`, `renderChords`, `renderFamilies`, `renderProgs`, `renderVoicings`, `renderAll`) synkar DOM mot det globala `state`-objektet.
```

till:

```markdown
5. **Rendering** — `diagram()` ritar ett enskilt greppdiagram som SVG-sträng; `drawNeck()` ritar hela halsdiagrammet (15 band) med skal- och ackordtoner; `render*()`-funktionerna (`renderRoots`, `renderChords`, `renderFamilies`, `renderProgs`, `renderVoicings`, `renderAll`, `renderTabs`) synkar DOM mot det globala `state`-objektet. UI:t är uppdelat i två flikar ("Ackord" för val av stämning/skala/rot/ackord, "Grepp" för halsdiagram/filter/greppkort), styrt av `state.tab` och `renderTabs()`.
```

- [ ] **Step 2: Full verifieringsgenomgång**

Med servern igång, gå igenom hela flödet från början till slut en gång till:
- Byt stämning och skala i Ackord-fliken, välj en rot, välj ett färgat ackord (t.ex. en `add9`- eller `sus2`-variant).
- Byt till Grepp-fliken, öppna filtret, sätt lägsta läge till band 5, stäng filtret.
- Kontrollera att greppkorten fortfarande matchar villkoren (minst en öppen sträng framgår av `.tag.open` på korten, ingen med `barré`-tagg).
- Klicka ett greppkort och kontrollera att ljudet spelas (Web Audio, kräver användarinteraktion vilket klicket ger).
- Byt tillbaka till Ackord-fliken, byt ackord, byt till Grepp-fliken igen — filterinställningen från band 5 ska fortfarande gälla (inget state ska nollställas av fliktbytet).
- Ladda om sidan (F5) — appen ska återgå till Ackord-fliken som standard (ingen persistens, enligt spec).
- Kör igenom samma flöde i devtools mobil-emulering (~375px bredd) och i vanlig desktopbredd.
- Kör igenom samma flöde i både ljust och mörkt färgläge.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Uppdatera CLAUDE.md med flikstruktur"
git push
```
