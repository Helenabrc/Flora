# Flora Microbiome Roster - Research Notes

Companion to `microbiome_roster.json`. Scope: a starter roster of **25 human gut
bacterial species** across the 5 target phyla, organised phylum -> family -> genus
-> species, with design-relevant biology and PubMed-traceable claims.

- **Species:** 25
- **Families:** 12
- **Unique verified PMIDs:** 61 (every PMID confirmed in-session via NCBI
  `esummary`; key abstracts read via `efetch`).
- **Verification:** `verified:true` on a reference means its title, first author,
  year and journal were confirmed against PubMed. Each reference carries a
  `supports` field naming the claim it backs.

---

## 1. Taxonomy tree

```
Bacillota (Firmicutes)
├─ Oscillospiraceae (ex-Ruminococcaceae) — Clostridia / Eubacteriales
│   ├─ Faecalibacterium prausnitzii
│   ├─ Faecalibacterium duncaniae   (ex F. prausnitzii A2-165)
│   └─ Ruminococcus bromii
├─ Lachnospiraceae — Clostridia / Eubacteriales
│   ├─ Roseburia intestinalis
│   ├─ Agathobacter rectalis        (ex Eubacterium rectale)
│   ├─ Anaerostipes hadrus          (ex Eubacterium hadrum)
│   ├─ Anaerobutyricum hallii       (ex Eubacterium hallii)
│   ├─ Coprococcus catus
│   ├─ Blautia wexlerae
│   └─ Mediterraneibacter gnavus    (ex Ruminococcus gnavus)
├─ Christensenellaceae — Clostridia / Christensenellales
│   └─ Christensenella minuta
└─ Lactobacillaceae — Bacilli / Lactobacillales
    └─ Lactiplantibacillus plantarum (ex Lactobacillus plantarum)

Bacteroidota (Bacteroidetes)
├─ Bacteroidaceae — Bacteroidia / Bacteroidales
│   ├─ Bacteroides thetaiotaomicron
│   ├─ Bacteroides ovatus
│   └─ Phocaeicola vulgatus         (ex Bacteroides vulgatus)
└─ Prevotellaceae — Bacteroidia / Bacteroidales
    └─ Segatella copri              (ex Prevotella copri)

Actinomycetota (Actinobacteria)
├─ Bifidobacteriaceae — Actinomycetia / Bifidobacteriales
│   ├─ Bifidobacterium longum
│   ├─ Bifidobacterium adolescentis
│   └─ Bifidobacterium breve
├─ Coriobacteriaceae — Coriobacteriia / Coriobacteriales
│   └─ Collinsella aerofaciens      (ex Eubacterium aerofaciens)
└─ Eggerthellaceae — Coriobacteriia / Eggerthellales
    └─ Eggerthella lenta            (ex Eubacterium lentum)

Pseudomonadota (Proteobacteria)
├─ Enterobacteriaceae — Gammaproteobacteria / Enterobacterales
│   └─ Escherichia coli
└─ Desulfovibrionaceae — (ex-Deltaproteobacteria) / Desulfovibrionales   [see caveat]
    ├─ Bilophila wadsworthia
    └─ Desulfovibrio piger          (ex Desulfomonas pigra)

Verrucomicrobiota (Verrucomicrobia)
└─ Akkermansiaceae — Verrucomicrobiia / Verrucomicrobiales
    └─ Akkermansia muciniphila
```

### Design mapping (as per the brief)
- **Phylum -> colour:** 5 colour families (one per phylum above).
- **Family -> shared visual trait:** each family record carries a
  `sharedVisualTrait` (e.g. Oscillospiraceae = spiky amylosome surface;
  Lachnospiraceae = flagellar tails; Bifidobacteriaceae = forked "Y" body;
  Bacteroidaceae = modular PUL toolbelt; Desulfovibrionaceae = sulfur-gas motif).
- **Species -> body shape:** captured in each species' `shape`/`motility` fields
  (cocci vs rods vs curved/vibrio vs branched-Y vs oval).

---

## 2. Naming changes and controversies (the important bits)

- **Phylum names (Oren & Garrity 2021, PMID 34694987).** Bacillota, Bacteroidota,
  Actinomycetota, Pseudomonadota and Verrucomicrobiota are the *validly published*
  names; the familiar -etes/-eria names are informal synonyms. The JSON uses the
  new names with `formerName` on every phylum.
- **Faecalibacterium split (Sakamoto 2022, PMID 35416766).** The single species
  "F. prausnitzii" was split; three novel species (F. duncaniae, F. hattorii,
  F. gallinarum) were proposed. **Crucially, the model strain A2-165** - the basis
  of most anti-inflammatory / next-generation-probiotic work (Sokol 2008) - is now
  **F. duncaniae**, not F. prausnitzii. Older literature naming "F. prausnitzii
  A2-165" is effectively about F. duncaniae. Both are in the roster.
- **Eubacterium diaspora.** The old catch-all genus *Eubacterium* has been
  dismantled: E. rectale -> **Agathobacter rectalis** (2016, contested - two
  published objections argued the split was premature), E. hadrum -> **Anaerostipes
  hadrus**, E. hallii -> **Anaerobutyricum hallii**, E. aerofaciens -> **Collinsella
  aerofaciens**, E. lentum -> **Eggerthella lenta**.
- **Prevotella split (Hitch 2022, PMID 36067550).** *Prevotella copri* -> **Segatella
  copri**; Blanco-Miguez 2023 (PMID 37883976) further showed "S. copri" is really a
  complex of ~13 species - relevant because health associations are strain/
  species-specific and often contradictory.
- **Bacteroidetes genome reclassification (Garcia-Lopez 2019, PMID 31608019).**
  *Bacteroides vulgatus* -> **Phocaeicola vulgatus** (and B. dorei etc. moved too).
- **Ruminococcus gnavus -> Mediterraneibacter gnavus** (Togo 2018, PMID 29855844);
  still almost universally cited as "R. gnavus".
- **Lactobacillus split (Zheng 2020, PMID 32293557).** The old genus became 25
  genera; L. plantarum -> **Lactiplantibacillus plantarum**.
- **Sulfate reducers - a live taxonomic conflict.** Bilophila and Desulfovibrio were
  historically Deltaproteobacteria *within* Proteobacteria. Under current LPSN/GTDB
  genome-based taxonomy they sit in a **separate phylum (Thermodesulfobacteriota /
  Desulfobacterota)**, *not* Pseudomonadota. We list them under Pseudomonadota to
  match the brief's 5-phylum scheme, but flag this in the JSON
  (`currentPhylumNote` on the family). Worth a design decision: treat them as a
  Pseudomonadota sub-colour or spin out a 6th "sulfur" colour later.

---

## 3. Association vs causation (handling of health claims)

Most human health links in the roster are **observational** (abundance correlates
with a condition) and are labelled "(association)". Claims with stronger evidence
are flagged "(causal in model)" or "(interventional)" and rest on gnotobiotic mice,
defined co-cultures, or human RCTs:
- Causal-in-model / mechanistic: F. prausnitzii/duncaniae anti-inflammation
  (Sokol 2008); R. bromii keystone RS degradation (Ze 2012); Devkota 2012
  Bilophila-colitis; Haiser 2013 Eggerthella-digoxin; Round 2010 B. fragilis-Tregs
  (family-level note); Henke 2019 R. gnavus glucorhamnan.
- Human interventional: Akkermansia trials (Depommier 2019; Mount 2026);
  L. plantarum 299v RCT (Rudzki 2019); fibre/Prevotella glucose (Kovatcheva-Datchary
  2015).

**Balance taxa** deliberately included (linked to less favourable outcomes):
Mediterraneibacter gnavus (IBD), Collinsella aerofaciens (RA/NAFLD), Bilophila
wadsworthia (high-fat-diet colitis), Desulfovibrio piger (excess H2S), Escherichia
coli pathobiont strains (IBD/CRC), and the double-edged Segatella copri and
Phocaeicola vulgatus.

---

## 4. Cross-feeding web (quick reference)

- **Acetate suppliers -> butyrate producers:** Bifidobacterium spp. and Bacteroides
  feed Faecalibacterium, Roseburia, Agathobacter (acetate is *required* by
  Faecalibacterium). (Riviere 2016/2015; Louis 2017.)
- **Lactate recyclers:** Bifidobacterium/Lactiplantibacillus lactate -> Anaerostipes
  hadrus & Anaerobutyricum hallii -> butyrate (Duncan 2004; Louis 2022).
- **Resistant-starch keystone:** Ruminococcus bromii liberates glucose/maltodextrins
  -> Bacteroides thetaiotaomicron, Bifidobacterium adolescentis, R. gnavus
  (Ze 2012; Rangarajan 2022; Crost 2018).
- **Sulfur/hydrogen axis:** Bacteroides sulfatases free sulfate -> Desulfovibrio
  piger; H2 from fermenters/Collinsella -> sulfate reducers & acetogens (Rey 2013).
- **Mucin economy:** Akkermansia grazes host mucin -> sugars + acetate/propionate
  for the community (Derrien 2004).

---

## 5. Gaps and limitations

- **Coprococcus / Blautia** are given at a representative-species level
  (C. catus, B. wexlerae); genus-level behaviour varies and species-specific
  substrate data is thinner than for the headline taxa.
- **Oxygen/Gram/shape** come from taxonomic descriptions and standard references;
  strain-level variation (e.g. motility in Lachnospiraceae, aerotolerance in
  bifidobacteria) exists and is noted qualitatively.
- No **archaea** (e.g. Methanobrevibacter) - out of scope (bacterial roster) but a
  natural future addition given the H2 cross-feeding story.
- Fusobacteriota (Fusobacterium nucleatum, a notable CRC pathobiont) was omitted to
  stay within the 5 target phyla.
- Several Akkermansia/Collinsella/Segatella claims come from 2024-2026 papers;
  these are current but less replicated than seminal work.
- Not every sub-claim has a dedicated abstract read; abstracts were read for the
  load-bearing/contested claims (Faecalibacterium split, R. bromii keystone,
  Bilophila-colitis, Desulfovibrio niche). Reference `supports` fields should be
  spot-checked before any are shown verbatim to end users.

---

## 6. Recommended ~6 starter characters

Chosen for vivid, true-to-biology design hooks, strong evidence, coverage of all
5 phyla, and a clear "good vs complicated" spread:

1. **Faecalibacterium prausnitzii** (Bacillota) - the fan-favourite "good guy":
   super abundant, oxygen-phobic, turns acetate into anti-inflammatory butyrate.
   Great tutorial character; its A2-165/duncaniae twist is a fun lore hook.
2. **Ruminococcus bromii** (Bacillota) - the resistant-starch "can-opener" keystone;
   amylosome spikes give an instantly readable design and a clear gameplay role
   (unlocks food others can't eat).
3. **Bacteroides thetaiotaomicron** (Bacteroidota) - the adaptable "quartermaster"
   with a huge enzyme toolbelt that switches to eating mucus when fibre runs out:
   a perfect generalist/strategist archetype.
4. **Bifidobacterium longum** (Actinomycetota) - the nurturing infant "pioneer" with
   the distinctive forked-Y body; anchors the prebiotic/cross-feeding mechanic.
5. **Akkermansia muciniphila** (Verrucomicrobiota) - the lone, charismatic mucus-layer
   "gardener"; strong human-trial story and a unique niche = a natural rare/legendary.
6. **Bilophila wadsworthia** (Pseudomonadota) - the sulfur-breathing "villain" that
   blooms on fatty diets; gives the roster a genuine antagonist and teaches the
   diet-matters lesson. (Swap-in alternative: Escherichia coli as the oxygen-
   breathing opportunist.)

This set spans every phylum, every major metabolite (butyrate, acetate/propionate,
H2S), both primary degraders and cross-feeders, and both beneficial and
less-favourable roles - a balanced, teachable starter deck.
