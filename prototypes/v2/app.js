/* hiflora app shell: screens, logbook persistence and the species flashcard. See CONTRACT.md. */
(() => {
  const R = window.FLORA_ROSTER || { species: {}, families: {}, phyla: {} };
  const KEY = 'hiflora.entries.v1';
  const stages = { chat: document.getElementById('stage-chat'), world: document.getElementById('stage-world') };
  const modules = { chat: window.FloraChat, world: window.FloraWorld };
  let current = null;

  const tokens = {
    sage: '#5A7A66', sageDeep: '#3D5A48', sageSoft: '#DCE5DD', cream: '#F3EEE6', paper: '#FBF8F3',
    ink: '#24302A', muted: '#6B7A70', serif: '"Instrument Serif", Georgia, serif', sans: '"Figtree", system-ui, sans-serif',
  };

  function safe(fn, label) { try { return fn(); } catch (e) { console.warn('[hiflora] ' + label, e); } }

  function show(name, payload) {
    if (!stages[name]) return;
    if (current === name && !payload) return;
    const prev = current;
    current = name;
    Object.entries(stages).forEach(([k, el]) => el.classList.toggle('on', k === name));
    if (prev && prev !== name && modules[prev]) safe(() => modules[prev].onHide(), prev + '.onHide');
    if (modules[name]) safe(() => modules[name].onShow(), name + '.onShow');
    if (name === 'world' && payload && payload.entry && modules.world) {
      setTimeout(() => safe(() => modules.world.applyMeal(payload.entry), 'world.applyMeal'), 650);
    }
  }

  function entries() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function saveEntry(entry) {
    const list = entries();
    list.push(entry);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable: keep going */ }
    return entry;
  }

  /* ---------- Species flashcard ---------- */
  let card = null, raf = 0;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function phylumInfo(key) {
    const cast = window.FloraCast && FloraCast.PHYLA && FloraCast.PHYLA[key];
    const ros = R.phyla[key] || {};
    return { name: ros.name || (cast && cast.name) || key, old: ros.formerName || (cast && cast.old) || '', chip: (cast && cast.chip) || '#5A7A66' };
  }

  function section(body, title, node) { body.append(el('h3', null, title), node); }
  function tagList(items, extra) { const d = el('div', 'tags' + (extra ? ' ' + extra : '')); (items || []).forEach(t => d.append(el('span', null, cap(t)))); return d; }

  function openProfile(id, inst) {
    const sp = R.species[id];
    if (!sp) return console.warn('[hiflora] unknown species', id);
    closeProfile();
    const meta = (window.FloraCast && FloraCast.SPECIES && FloraCast.SPECIES[id]) || {};
    const ph = phylumInfo(sp.phylumKey);
    const fam = R.families[sp.family] || {};

    const scrim = el('div', 'pf-scrim');
    const pf = el('article', 'pf');
    pf.setAttribute('role', 'dialog'); pf.setAttribute('aria-modal', 'true'); pf.setAttribute('aria-labelledby', 'pf-name');
    pf.style.setProperty('--pc', ph.chip);

    const hero = el('div', 'pf-hero');
    const cv = el('canvas'); hero.append(cv);
    const close = el('button', 'pf-close', '×'); close.setAttribute('aria-label', 'Close'); close.addEventListener('click', closeProfile);
    hero.append(close);

    const body = el('div', 'pf-body');
    const chip = el('span', 'pf-chip'); chip.append(el('i'), document.createTextNode(ph.name + (ph.old ? ' · formerly ' + ph.old : '')));
    const h2 = el('h2', null, meta.nick || sp.species); h2.id = 'pf-name';
    body.append(chip, h2, el('p', 'sci', sp.species), el('p', 'fam', 'Family ' + sp.family + (fam.formerName ? ' (formerly ' + fam.formerName + ')' : '')));
    if (sp.personality) body.append(el('p', 'persona', sp.personality));

    section(body, 'Favourite foods', tagList(sp.substrates));
    if (sp.degraderRole) body.lastChild.after(el('p', 'small', sp.degraderRole));
    section(body, 'What it makes', tagList(sp.metabolites, 'mk'));
    if (sp.crossFeeding && sp.crossFeeding.length) { const ul = el('ul'); sp.crossFeeding.forEach(t => ul.append(el('li', null, t))); section(body, 'Teams up with', ul); }
    if (sp.health && sp.health.length) { const ul = el('ul'); sp.health.forEach(t => ul.append(el('li', null, t))); section(body, 'What the research says', ul); }

    const dl = el('dl');
    [['Shape', sp.shape], ['Moves', sp.motility], ['Oxygen', sp.oxygen], ['Gram stain', sp.gram]].forEach(([k, v]) => {
      if (!v) return; const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); dl.append(d);
    });
    section(body, 'Cell facts', dl);
    if (fam.sharedVisualTrait) body.append(el('p', 'note', 'Family look: ' + fam.sharedVisualTrait));

    const refs = el('ul', 'refs');
    (sp.references || []).forEach(r => {
      const li = el('li');
      const a = el('a', null, `${r.firstAuthor} · ${r.year} · ${r.journal || 'PubMed'}`);
      a.href = 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(r.pmid) + '/';
      a.target = '_blank'; a.rel = 'noopener';
      li.append(a, el('span', 'rt', r.title));
      if (r.supports) li.append(el('span', 'rs', r.supports));
      refs.append(li);
    });
    section(body, 'Sources (PubMed)', refs);
    body.append(el('p', 'note', 'Every source above was checked against PubMed. Health links are mostly associations seen in studies, not proof that this bacterium causes them.'));

    pf.append(hero, body);
    scrim.append(pf);
    scrim.addEventListener('click', e => { if (e.target === scrim) closeProfile(); });
    document.body.append(scrim);
    card = { scrim, prevFocus: document.activeElement };
    close.focus({ preventScroll: true });

    const g = cv.getContext('2d');
    const t0 = performance.now();
    const draw = now => {
      const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
      g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
      if (window.FloraCast && FloraCast.drawPortrait) safe(() => FloraCast.drawPortrait(g, id, w / 2, h * 0.56, h * 0.78, (now - t0) / 1000), 'drawPortrait');
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }
  function closeProfile() {
    if (!card) return;
    cancelAnimationFrame(raf);
    card.scrim.remove();
    if (card.prevFocus && card.prevFocus.focus) card.prevFocus.focus({ preventScroll: true });
    card = null;
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') closeProfile(); });

  window.FloraApp = { show, openProfile, closeProfile, saveEntry, entries, tokens };

  /* ---------- Boot ---------- */
  if (modules.world) safe(() => modules.world.mount(stages.world), 'world.mount');
  if (modules.chat) safe(() => modules.chat.mount(stages.chat), 'chat.mount');
  show(location.hash === '#world' ? 'world' : 'chat');
})();
