// Ask FINDATION demo app. It answers a fixed list of questions (QUESTIONS below); each has a
// matcher, an answer and an action on the map. Background: OpenStreetMap. On top of it, from
// assets/demo-menlo-park.js: real City of Tshwane land parcels, with illustrative property values.
(() => {
  const DATA = window.FINDATION_DEMO;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const narrow = () => window.innerWidth <= 900;
  const $ = id => document.getElementById(id);
  const thread = $('thread'), suggestBox = $('suggest'), form = $('ask-form'), input = $('ask-input');
  const info = $('info'), infoTitle = $('info-title'), infoLine = $('info-line'), infoValue = $('info-value');
  const legend = $('legend'), legendList = $('legend-list'), place = $('place'), appEl = $('app');
  const stage = $('stage'), tableWrap = $('table-wrap'), tableBody = $('table-body'), tableNote = $('table-note');
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const STREET = DATA.street.name, PLACE = DATA.street.suburb + ', ' + DATA.street.city;
  // Value bands: the higher the value, the darker the green.
  const BANDS = [
    { max: 2, label: 'Under R2m', colour: '#D9F2DF' },
    { max: 3.5, label: 'R2m to R3.5m', colour: '#A3E0B3' },
    { max: 5, label: 'R3.5m to R5m', colour: '#57C974' },
    { max: 7, label: 'R5m to R7m', colour: '#1E9E43' },
    { max: Infinity, label: 'Over R7m', colour: '#0A5F28' },
  ];
  const NO_VALUE = '#B9C3CF';

  // ----- Map: OpenStreetMap in the background -----
  const map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.5, minZoom: 5, maxZoom: 19 });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const attribution = L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
  const SOUTH_AFRICA = L.latLngBounds([-34.9, 16.4], [-22.1, 32.95]);
  const home = () => map.fitBounds(SOUTH_AFRICA, { padding: narrow() ? [8, 8] : [40, 40], animate: false });

  const streetBounds = L.latLngBounds(DATA.street.lines.flat());
  const centre = streetBounds.getCenter();
  let parcelLayer = null, streetLayer = null, valued = false, picked = null;
  const layerOf = new Map(), rowOf = new Map();

  const baseStyle = p => p.front
    ? { color: '#008C32', weight: 2.5, fillColor: '#20C34A', fillOpacity: .32 }
    : { color: '#071D49', weight: 1.1, fillColor: '#FFFFFF', fillOpacity: .3 };
  const valueStyle = p => ({ color: '#FFFFFF', weight: 1, fillOpacity: p.value == null ? .3 : .55, fillColor: p.value == null ? NO_VALUE : BANDS.find(b => p.value < b.max).colour });
  const styleOf = p => valued ? valueStyle(p) : baseStyle(p);

  function showInfo(layer) {
    const p = layer.feature.properties;
    infoTitle.textContent = 'Erf ' + p.erf;
    infoLine.textContent = p.town + ' · ' + fmt(p.area) + ' m² · ' + p.status;
    infoValue.hidden = !valued;
    if (valued) infoValue.textContent = p.value == null ? 'No estimate for this parcel' : 'About R' + p.value.toFixed(1) + 'm';
    info.hidden = false;
  }
  function pick(layer) {
    if (picked && picked !== layer) picked.setStyle(styleOf(picked.feature.properties));
    picked = layer;
    layer.setStyle({ color: '#071D49', weight: 3 });
    layer.bringToFront();
    showInfo(layer);
    const old = tableBody.querySelector('.is-picked'), row = rowOf.get(layer.feature);
    if (old) old.classList.remove('is-picked');
    if (row) { row.classList.add('is-picked'); if (!row.matches(':hover')) row.scrollIntoView({ block: 'nearest' }); }
  }

  // The map stays closed while the answer is prepared: the street is framed, the land parcels are
  // drawn and the background has loaded. Only then does the map open, already complete.
  async function showParcels() {
    if (parcelLayer) return;
    map.invalidateSize();
    map.fitBounds(streetBounds, { padding: narrow() ? [16, 16] : [80, 80], maxZoom: 17.5, animate: false });
    attribution.addAttribution('land parcels © City of Tshwane');
    streetLayer = L.polyline(DATA.street.lines, { color: '#20C34A', weight: 7, opacity: .85, lineCap: 'round', className: 'street', interactive: false }).addTo(map);
    parcelLayer = L.geoJSON(DATA.parcels, {
      style: f => Object.assign({ className: 'parcel' }, baseStyle(f.properties)),
      onEachFeature: (f, layer) => { layerOf.set(f, layer); layer.on({ mouseover: () => pick(layer), click: () => pick(layer) }); },
    }).addTo(map);
    place.hidden = false;
    await Promise.race([new Promise(r => tiles.once('load', r)), new Promise(r => setTimeout(r, 3000))]);
    appEl.classList.remove('no-map');
    map.invalidateSize();
    await wait(500);
  }

  // Colour every parcel by its value band, sweeping across the map from west to east.
  async function colourByValue() {
    if (valued) return;
    valued = true;
    const b = map.getBounds(), west = b.getWest(), span = b.getEast() - west;
    parcelLayer.eachLayer(layer => {
      const t = clamp01((layer.getBounds().getCenter().lng - west) / span);
      setTimeout(() => { if (layer !== picked) layer.setStyle(valueStyle(layer.feature.properties)); }, reduceMotion ? 0 : t * 1200);
    });
    streetLayer.setStyle({ color: '#071D49', weight: 4, opacity: .9 });
    legendList.innerHTML = '';
    BANDS.concat([{ label: 'No estimate', colour: NO_VALUE }]).forEach(band => {
      const li = document.createElement('li'), swatch = document.createElement('i');
      swatch.style.background = band.colour;
      li.append(swatch, band.label);
      legendList.appendChild(li);
    });
    legend.hidden = false;
    if (picked) showInfo(picked);
    await wait(1500);
  }

  // Table of every parcel with its value, highest first. Clicking a row finds that parcel on the map.
  function showTable() {
    if (!tableBody.children.length) {
      const rows = DATA.parcels.features.slice().sort((a, b) => (b.properties.value == null ? -1 : b.properties.value) - (a.properties.value == null ? -1 : a.properties.value));
      rows.forEach(f => {
        const p = f.properties, tr = document.createElement('tr');
        const cell = (text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; tr.appendChild(td); return td; };
        cell('Erf ' + p.erf); cell(p.town); cell(fmt(p.area) + ' m²', 'num'); cell(p.status);
        const v = cell(p.value == null ? 'No estimate' : 'R' + p.value.toFixed(1) + 'm', 'num ' + (p.value == null ? 'none' : 'val'));
        if (p.value != null) { const sw = document.createElement('i'); sw.style.background = BANDS.find(b => p.value < b.max).colour; v.prepend(sw); }
        tr.addEventListener('click', () => { const layer = layerOf.get(f); if (!layer) return; pick(layer); if (!stage.classList.contains('table-only')) map.panTo(layer.getBounds().getCenter()); });
        rowOf.set(f, tr);
        tableBody.appendChild(tr);
      });
      tableNote.textContent = fmt(rows.length) + ' land parcels · illustrative figures';
    }
    tableWrap.hidden = false;
  }

  // After the property values question the visitor chooses how to see them: map, table or both.
  let choosing = false, canChoose = false;
  const choiceOf = t => /both/.test(t) ? 'both' : /table|list/.test(t) ? 'table' : /map/.test(t) ? 'map' : null;
  async function showValues(choice) {
    const wantMap = choice !== 'table', wantTable = choice !== 'map';
    await colourByValue();
    if (wantTable) showTable(); else tableWrap.hidden = true;
    stage.classList.toggle('table-only', !wantMap);
    legend.hidden = !wantMap;
    if (wantMap) { map.invalidateSize(); map.fitBounds(streetBounds, { padding: narrow() ? [16, 16] : [60, 60], maxZoom: 17.5, animate: !reduceMotion }); }
    const where = choice === 'both' ? 'on the map and in the table' : choice === 'table' ? 'in the table, highest first' : 'on the map';
    return {
      text: 'Here are the estimated property values ' + where + '.' + (wantMap ? ' The darker the green, the higher the value.' : '') + (choice === 'both' ? ' Click a row to find that parcel on the map.' : ''),
      source: 'These values are illustrative: they are worked out from each parcel\'s real area, not taken from a valuation roll.',
    };
  }

  // ----- The set questions, in the order they are suggested. Prompts 2 and 3 are added here. -----
  const count = DATA.parcels.features.length, fronting = DATA.parcels.features.filter(f => f.properties.front).length;
  const QUESTIONS = [
    {
      text: 'Show me the latest cadastre boundaries for ' + STREET + ' in Menlo Park',
      match: t => /cadast|boundar|erf|erven|parcel/.test(t) && !/value|price|worth/.test(t),
      run: () => showParcels(),
      answer: () => ({
        text: 'Here are the cadastre boundaries around ' + STREET + ', ' + PLACE + '. The street is marked in green, and so are the parcels that front it.',
        facts: [fmt(count) + ' land parcels', fronting + ' on ' + STREET],
        source: 'Source: ' + DATA.source + ', fetched ' + DATA.fetched + '.',
      }),
    },
    {
      text: 'Show me estimated property values in the cadastre',
      match: t => /value|price|worth/.test(t),
      run: async () => { await showParcels(); choosing = true; canChoose = true; },
      answer: () => ({ text: 'I have the estimated property values. Would you like to view them on the map, in a table, or both?' }),
    },
  ];
  const asked = new Set();

  // ----- Conversation -----
  function add(kind, build) {
    const m = document.createElement('div');
    m.className = 'msg msg-' + kind;
    build(m);
    thread.classList.add('has-messages');
    thread.appendChild(m);
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
    return m;
  }
  const para = (parent, text, cls) => { const p = document.createElement('p'); if (cls) p.className = cls; p.textContent = text; parent.appendChild(p); return p; };

  function suggest() {
    suggestBox.innerHTML = '';
    if (choosing) {
      para(suggestBox, 'Choose one', 'suggest-label');
      const row = document.createElement('div'); row.className = 'choices';
      ['Map', 'Table', 'Both'].forEach(label => { const b = document.createElement('button'); b.type = 'button'; b.className = 'prompt'; b.textContent = label; b.addEventListener('click', () => ask(label)); row.appendChild(b); });
      suggestBox.appendChild(row);
      return;
    }
    const next = QUESTIONS.find(q => !asked.has(q));
    if (!next) return;
    para(suggestBox, 'Try asking', 'suggest-label');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'prompt'; b.textContent = next.text;
    b.addEventListener('click', () => ask(next.text));
    suggestBox.appendChild(b);
  }

  let busy = false;
  async function ask(text) {
    const q = text.trim();
    if (!q || busy) { input.focus(); return; }
    busy = true;
    input.value = '';
    suggestBox.innerHTML = '';
    add('user', m => para(m, q));
    const reply = add('bot', m => { const d = document.createElement('span'); d.className = 'dots'; d.setAttribute('aria-label', 'Looking it up'); d.innerHTML = '<i></i><i></i><i></i>'; m.appendChild(d); });
    const choice = canChoose ? choiceOf(q.toLowerCase()) : null;
    const hit = choice ? null : QUESTIONS.find(x => x.match(q.toLowerCase()));
    await wait(600);
    let chosen = null;
    if (choice) { chosen = await showValues(choice); choosing = false; }
    if (hit) await hit.run();
    reply.innerHTML = '';
    if (chosen) {
      para(reply, chosen.text);
      para(reply, chosen.source, 'msg-source');
    } else if (hit) {
      const a = hit.answer();
      para(reply, a.text);
      if (a.facts) { const ul = document.createElement('ul'); ul.className = 'facts'; a.facts.forEach(f => { const li = document.createElement('li'); li.textContent = f; ul.appendChild(li); }); reply.appendChild(ul); }
      if (a.source) para(reply, a.source, 'msg-source');
      // Asking a later question also covers the earlier ones it builds on.
      QUESTIONS.slice(0, QUESTIONS.indexOf(hit) + 1).forEach(x => asked.add(x));
    } else {
      para(reply, 'This demo answers a few set questions for now. Try the suggested one below.');
    }
    busy = false;
    suggest();
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  window.addEventListener('resize', () => { if (appEl.classList.contains('no-map')) return; map.invalidateSize(); if (!parcelLayer) home(); });
  map.setView([-28.7, 24.7], 5, { animate: false });
  suggest();
  if (canHover) input.focus();
})();
