# hiflora

A gamified gut-health and dietary-fibre tracker. The user talks to **Flora**, a cute bacterium who represents their gut
community, to log what they ate and how they felt. They then visit an animated **gut world** where their bacteria
live, work and react to the food. The app should feel like a personal dietitian specialised in fibre and gut health.

The owner has no coding background. Explain choices in plain language, show rather than describe (publish previews),
and ask before big direction changes.

## Product rules
- **Scientific accuracy first.** Facts about bacteria must trace to PubMed. Never invent PMIDs; verify them through
  NCBI E-utilities (eutils.ncbi.nlm.nih.gov is allowed). Label health links as association vs causal.
  Source data: `research/microbiome_roster.json` (25 species, 61 verified references).
- **Taxonomy drives the look:** phylum = colour (6 phyla, incl. Desulfobacterota as its own "sulfur" colour),
  family = a shared trait, species = body shape from real cell morphology plus a signature item.
- **Bacteria are happy by default.** They only look hungry or worried when their niche is underfed.
- **A real community:** many instances per species, weighted by abundance, each with a niche and daily activities.
- **Flora is a high-end generated artwork** (art/flora.png, made with Figma AI). The world and the other bacteria are code-drawn.
- Two user types: people with a microbiome test (community built from their readout) and people without (start
  from a typical community, inferred from a questionnaire and logs). The recommendation/inference engine is a separate
  module to plug in later; the owner will specify how recommendations are made.

## Brand
- Lowercase italic serif wordmark "hiflora": Instrument Serif (italic) for display, Figtree for UI.
- Sage `#5A7A66`, deep sage `#3D5A48`, cream `#F3EEE6`, paper `#FBF8F3`, ink `#24302A`.
- Calm, premium, modern; no emoji in UI copy.

## Code layout (current prototype)
- `prototypes/v2/`: browser-only prototype, no build step. Read `CONTRACT.md` for the module APIs.
  `roster.js` (generated data), `cast.js` (characters), `world.js` (pannable world), `chat.js` (Flora chat + logbook),
  `app.js` (shell + species flashcards), `index.html`.
- `prototypes/flora-world-preview.html`: the first visual test (v1).
- Flora's conversation runs on a scripted `FloraBrain` built to be swapped for a Claude-backed endpoint later.
- Test with Playwright using `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
