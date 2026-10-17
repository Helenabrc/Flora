# hiflora v2 prototype: module contract

This is a browser-only prototype: plain HTML, CSS and JS, with no build step and no imports.
Everything is attached to `window`. The scripts load in this order:

```
roster.js  → window.FLORA_ROSTER   (generated, read-only; PubMed-verified facts)
cast.js    → window.FloraCast      (character art + Flora)          [agent: cast]
world.js   → window.FloraWorld     (pannable gut world, niches)     [agent: world]
chat.js    → window.FloraChat      (Flora conversation + logbook)   [agent: chat]
app.js     → window.FloraApp       (shell, screens, profile card)   [lead]
```

Only `index.html` and `app.js` are owned by the lead. Each agent writes only its own file. To test, an agent may also write
`dev-<module>.html` and stub files named `stub-*.js`. The final module must not depend on those stubs.

## Brand (from the hiflora logo)
- Wordmark: lowercase italic serif "hiflora". Use Google Font **Instrument Serif** (italic) for display.
  Use **Figtree** for body/UI. Load both via Google Fonts in index.html; modules just use the CSS vars / font names.
- Tokens (CSS custom properties set on :root by index.html, also mirrored in `FloraApp.tokens`):
  `--sage:#5A7A66; --sage-deep:#3D5A48; --sage-soft:#DCE5DD; --cream:#F3EEE6; --paper:#FBF8F3; --ink:#24302A; --muted:#6B7A70; --line:rgba(36,48,42,.12)`
- Feel: high-end, calm, modern. Lots of space and soft shadows. No emoji in UI copy.

## Phylum colours (6 phyla)
| phylumKey | name | base HSL (h,s,l) |
|---|---|---|
| bacillota | Bacillota (Firmicutes) | 18, 80, 66 (coral/peach) |
| bacteroidota | Bacteroidota (Bacteroidetes) | 168, 50, 60 (teal) |
| actinomycetota | Actinomycetota (Actinobacteria) | 268, 58, 74 (lilac) |
| pseudomonadota | Pseudomonadota (Proteobacteria) | 205, 70, 66 (sky blue) |
| verrucomicrobiota | Verrucomicrobiota | 336, 72, 77 (pink) |
| desulfobacterota | Desulfobacterota (sulfur reducers) | 68, 62, 58 (sulfur chartreuse) |

Species within a phylum may shift hue by about ±15 and lightness by about ±8.

## Species ids (25). Facts are in `FLORA_ROSTER.species[id]`
a-hadrus, a-hallii, a-muciniphila, a-rectalis, b-adolescentis, b-breve, b-longum, b-ovatus,
b-thetaiotaomicron, b-wadsworthia, b-wexlerae, c-aerofaciens, c-catus, c-minuta, d-piger, e-coli,
e-lenta, f-duncaniae, f-prausnitzii, l-plantarum, m-gnavus, p-vulgatus, r-bromii, r-intestinalis, s-copri

Each roster species has: species, genus, family, phylumKey, shape, motility, oxygen, gram, substrates[], degraderRole,
metabolites[], health[], crossFeeding[], personality, references[{pmid, firstAuthor, year, title, journal, verified, supports}].
`FLORA_ROSTER.families[name].sharedVisualTrait` and `FLORA_ROSTER.phyla[key]` also exist.

## Niches (world zones), left to right
| nicheId | label | residents (species ids) | fed by fibreTypes |
|---|---|---|---|
| mucus | Mucus Meadow | a-muciniphila, m-gnavus, b-thetaiotaomicron | (mucin from the host; Bacteroides forage here when hungry) |
| quarry | Starch Quarry | r-bromii, b-adolescentis, a-rectalis | resistant-starch |
| bakery | Butyrate Bakery | f-prausnitzii, f-duncaniae, r-intestinalis, a-hadrus, a-hallii, c-catus | (cross-feeding: acetate/lactate from others) + inulin-fos, pectin |
| fields | Fibre Fields | s-copri, b-ovatus, p-vulgatus, b-wexlerae, l-plantarum | arabinoxylan, beta-glucan, pectin, cellulose |
| orchard | Inulin Orchard | b-longum, b-breve | inulin-fos, gos |
| lab | Alchemy Lab | c-aerofaciens, e-lenta, c-minuta | polyphenols |
| springs | Sulfur Springs | b-wadsworthia, d-piger, e-coli | high-fat (grows), sugar (e-coli); shrinks when fibre is high |

## Character instance object (owned by world.js, read by cast.js)
```js
{
  id: 'inst-12', species: 'r-bromii',
  x, y,                 // world coords of the ground contact point (world.js converts to screen)
  t: 0,                 // seconds alive; world increments it
  phase: 0..2π,         // random per instance, for de-syncing idle motion
  activity: 'idle'|'walk'|'run'|'work'|'carry'|'eat'|'sleep'|'celebrate'|'wave'|'divide',
  activityT: 0,         // seconds since this activity started
  dirX: -1..1,          // facing/movement direction
  mood: 0..1,           // 1 = very happy, 0.5 = content (DEFAULT), < 0.25 = hungry. Default faces must look HAPPY/content.
  hungry: false,        // true only when its niche is underfed: then cast shows a hungry face
  carrying: null|'butyrate'|'lactate'|'acetate'|'starch'|'mucus'|'sulfide'|'leaf'|'flask',
  lift: 0,              // px (in character units) vertical hop, set by world
  sqx: 1, sqy: 1,       // squash and stretch, set by world (cast may add idle breathing on top)
  selected: false
}
```

## FloraCast API (cast.js)
```js
FloraCast.PHYLA        // { key: {name, old, h, s, l, chip:'#hex'} } for all 6
FloraCast.SPECIES      // { id: { nick:'Rumi', phylumKey, niche, workStyle, scaleHint } } for all 25. scaleHint ≈ 0.8..1.3 relative size
FloraCast.build(unit, dpr)          // (re)pre-render all sprites; unit = px height of an average character at scale 1
FloraCast.tick(inst, dt)            // optional per-frame internal anim state (blinks etc.), stored on inst._c
FloraCast.draw(g, inst, sx, sy, scale)  // draw instance standing at SCREEN point (sx, sy) with scale; g is already DPR-transformed
FloraCast.bounds(inst, scale)       // {w, h} on screen, for hit testing (box above the ground point, centered on x)
FloraCast.drawPortrait(g, speciesId, cx, cy, size, t)  // centered bust/full-body for cards (no shadow)
FloraCast.drawFlora(g, cx, cy, size, state)  // Flora, the host character. state={t, talking:bool, mood:'happy'|'curious'|'thinking'|'excited', lookX, lookY}
```
`workStyle` tells cast which pose and prop to draw when `activity==='work'`. Examples: 'mine' (R. bromii pickaxe on starch),
'rake' (Akkermansia gardening mucus), 'bake' (butyrate makers), 'tinker' (Bacteroides toolbelt), 'farm',
'brew' (lab), 'puff' (sulfur), 'nurse' (bifido). World passes no extra information. Cast decides the look per species from `inst.activity` + `activityT`.

## FloraWorld API (world.js)
```js
FloraWorld.mount(rootEl)        // create its canvas + DOM inside rootEl (position:absolute; inset:0)
FloraWorld.onShow() / onHide()  // start/stop the animation loop
FloraWorld.setCommunity(comp)   // comp = { 'r-bromii': 6, ... } instance counts; default typical community if never called
FloraWorld.applyMeal(entry)     // animate the effects of a logged meal (see Entry); pan camera to the most affected niche; show a summary toast
FloraWorld.focusNiche(nicheId)
```
World calls `FloraApp.openProfile(speciesId, inst)` when a character is tapped, and `FloraApp.show('chat')` from its "Talk to Flora" button.

## FloraChat API (chat.js)
```js
FloraChat.mount(rootEl); FloraChat.onShow(); FloraChat.onHide();
```
When a log is saved, chat calls `FloraApp.saveEntry(entry)` and then offers a button that calls `FloraApp.show('world', {entry})`.

## Entry (a logbook item)
```js
{ id, time: ISOString,
  foods: [{ name:'Porridge oats', serving:'40 g dry', fibreG: 4.0, fibreTypes:['beta-glucan','arabinoxylan'], flags:[] }],
  totalFibreG: 4.0,
  feelings: { tags:['bloated'|'gassy'|'great'|'normal'|'low-energy'|'cramps'|'constipated'|'loose'], note:'' } }
```
fibreTypes vocabulary: 'beta-glucan','resistant-starch','inulin-fos','gos','pectin','arabinoxylan','cellulose','polyphenols'.
flags vocabulary: 'high-fat','sugar','fermented'.

## FloraApp API (app.js, lead)
```js
FloraApp.show('chat'|'world', payload?)   // cross-fades screens, calls onHide/onShow; world gets applyMeal(payload.entry)
FloraApp.openProfile(speciesId, inst?)    // shows the species flashcard (roster facts + PubMed links)
FloraApp.saveEntry(entry); FloraApp.entries()   // logbook persistence (localStorage, try/catch)
FloraApp.tokens                            // brand tokens
```
