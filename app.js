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
  const legend = $('legend'), legendList = $('legend-list'), place = $('place'), placeText = $('place-text'), appEl = $('app');
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
    if (spazaLayer) { map.removeLayer(spazaLayer); spazaLayer = null; legend.hidden = true; info.hidden = true; placeText.textContent = STREET + ' · ' + PLACE; }
    if (districtLayer) { map.removeLayer(districtLayer); districtLayer = null; info.hidden = true; placeText.textContent = STREET + ' · ' + PLACE; }
    if (aroundLayer) { map.removeLayer(aroundLayer); aroundLayer = null; info.hidden = true; placeText.textContent = STREET + ' · ' + PLACE; }
    if (parcelLayer) {
      if (!map.hasLayer(parcelLayer)) { streetLayer.addTo(map); parcelLayer.addTo(map); legend.hidden = !valued; map.fitBounds(streetBounds, { padding: narrow() ? [16, 16] : [80, 80], maxZoom: 17.5, animate: false }); }
      return;
    }
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
    $('legend-title').textContent = 'Estimated property value';
    $('legend-note').textContent = 'Illustrative figures based on each parcel\'s area.';
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

  // ----- Buying at one address: only the erfs around it, each labelled with its value -----
  // 65 Thomas Edison Street is Erf 364, Menlo Park in the City of Tshwane street address layer.
  const ADDRESS = '65 ' + STREET, AROUND_M = 120;
  const subject = DATA.parcels.features.find(f => f.properties.erf === '364' && f.properties.town === 'Menlo Park');
  const centreOf = f => { const r = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]; return [r.reduce((s, c) => s + c[0], 0) / r.length, r.reduce((s, c) => s + c[1], 0) / r.length]; };
  const subjectAt = centreOf(subject);
  const metres = c => Math.hypot((c[0] - subjectAt[0]) * 100200, (c[1] - subjectAt[1]) * 110900);
  const neighbours = DATA.parcels.features.filter(f => f !== subject && metres(centreOf(f)) <= AROUND_M);
  const priced = neighbours.map(f => f.properties.value).filter(v => v != null);
  const rand = v => 'R' + v.toFixed(1) + 'm';
  let aroundLayer = null, subjectLayer = null, subjectValued = false;

  function aroundInfo(layer) {
    const p = layer.feature.properties, own = layer === subjectLayer;
    infoTitle.textContent = own ? ADDRESS : 'Erf ' + p.erf;
    infoLine.textContent = (own ? 'Erf ' + p.erf + ' · ' : '') + p.town + ' · ' + fmt(p.area) + ' m² · ' + p.status;
    infoValue.hidden = own && !subjectValued;
    infoValue.textContent = p.value == null ? 'No estimate for this parcel' : 'About ' + rand(p.value);
    info.hidden = false;
  }
  async function showAround() {
    if (aroundLayer) return;
    if (districtLayer) { map.removeLayer(districtLayer); districtLayer = null; }
    if (spazaLayer) { map.removeLayer(spazaLayer); spazaLayer = null; }
    choosing = false; canChoose = false; picked = null; subjectValued = false;
    tableWrap.hidden = true; stage.classList.remove('table-only'); legend.hidden = true; info.hidden = true;
    if (parcelLayer) { map.removeLayer(parcelLayer); map.removeLayer(streetLayer); }
    else attribution.addAttribution('land parcels © City of Tshwane');
    map.invalidateSize();
    aroundLayer = L.geoJSON({ type: 'FeatureCollection', features: neighbours.concat([subject]) }, {
      style: f => f === subject
        ? { className: 'parcel', color: '#008C32', weight: 3, fillColor: '#20C34A', fillOpacity: .5 }
        : { className: 'parcel', color: '#071D49', weight: 1.4, fillColor: '#FFFFFF', fillOpacity: .55 },
      onEachFeature: (f, layer) => {
        if (f === subject) { subjectLayer = layer; layer.bindTooltip('65', { permanent: true, direction: 'center', className: 'erf-label erf-label-own' }); }
        else if (f.properties.value != null) layer.bindTooltip(rand(f.properties.value), { permanent: true, direction: 'center', className: 'erf-label' });
        layer.on({ mouseover: () => aroundInfo(layer), click: () => aroundInfo(layer) });
      },
    }).addTo(map);
    map.fitBounds(aroundLayer.getBounds(), { padding: narrow() ? [16, 16] : [50, 50], maxZoom: 19, animate: false });
    placeText.textContent = ADDRESS + ' · ' + PLACE;
    place.hidden = false;
    if (appEl.classList.contains('no-map')) {
      await Promise.race([new Promise(r => tiles.once('load', r)), new Promise(r => setTimeout(r, 3000))]);
      appEl.classList.remove('no-map');
      map.invalidateSize();
    }
    await wait(500);
  }
  async function valueSubject() {
    await showAround();
    subjectValued = true;
    subjectLayer.setTooltipContent(rand(subject.properties.value));
    subjectLayer.setStyle({ weight: 4, fillOpacity: .7 });
    aroundInfo(subjectLayer);
  }

  // ----- Use case 2: a voting station in a rural area. The map zooms to the area and draws its voting district. -----
  const VD = window.FINDATION_VD, VD_PLACE = VD.place.name + ', ' + VD.place.region;
  let districtLayer = null;
  async function showDistrict() {
    if (districtLayer) return;
    if (spazaLayer) { map.removeLayer(spazaLayer); spazaLayer = null; }
    choosing = false; canChoose = false; picked = null;
    [aroundLayer, parcelLayer, streetLayer].forEach(l => { if (l) map.removeLayer(l); });
    aroundLayer = null;
    tableWrap.hidden = true; stage.classList.remove('table-only'); legend.hidden = true; info.hidden = true;
    map.invalidateSize();
    attribution.addAttribution('voting district: George Municipality');
    districtLayer = L.geoJSON(VD.district, { style: { className: 'parcel', color: '#071D49', weight: 3, fillColor: '#20C34A', fillOpacity: .18 } }).addTo(map);
    const p = VD.district.properties;
    const showIt = () => {
      infoTitle.textContent = 'Voting district ' + p.vd;
      infoLine.textContent = VD.place.name + ' · Ward ' + p.ward + ' · about ' + p.km2 + ' km²';
      infoValue.hidden = true;
      info.hidden = false;
    };
    districtLayer.getLayers()[0].on({ mouseover: showIt, click: showIt });
    map.fitBounds(districtLayer.getBounds(), { padding: narrow() ? [16, 16] : [50, 50], animate: false });
    placeText.textContent = VD.place.name + ' · ' + VD.place.region;
    place.hidden = false;
    if (appEl.classList.contains('no-map')) {
      await Promise.race([new Promise(r => tiles.once('load', r)), new Promise(r => setTimeout(r, 3000))]);
      appEl.classList.remove('no-map');
      map.invalidateSize();
    }
    showIt();
    await wait(500);
  }
  // Points of interest inside the voting district. They join the district's layer group, so they leave the map with it.
  let poiDots = [];
  async function showPois() {
    await showDistrict();
    if (districtLayer.hasPois) return;
    districtLayer.hasPois = true;
    poiDots = [];
    VD.pois.forEach(p => {
      const dot = L.circleMarker(p.at, { radius: 8, color: '#FFFFFF', weight: 2.5, fillColor: p.station ? '#20C34A' : '#071D49', fillOpacity: 1 });
      dot.poi = p;
      poiDots.push(dot);
      dot.bindTooltip(p.name, { permanent: true, direction: p.side, offset: [0, p.side === 'top' ? -8 : 8], className: 'erf-label' });
      const showIt = () => {
        infoTitle.textContent = p.name;
        infoLine.textContent = p.kind + (p.detail ? ' · ' + p.detail : '') + ' · ' + p.source;
        infoValue.hidden = true;
        info.hidden = false;
      };
      dot.on({ mouseover: showIt, click: showIt });
      districtLayer.addLayer(dot);
    });
    map.fitBounds(L.latLngBounds(VD.pois.map(p => p.at)), { padding: narrow() ? [40, 40] : [140, 140], maxZoom: 14, animate: !reduceMotion });
    await wait(700);
  }
  // Which point is closest to all voters. Voters are stood in for by the buildings in the district;
  // the best point has the shortest average straight-line distance to them.
  const bestPoi = VD.pois.reduce((a, b) => b.avgKm < a.avgKm ? b : a);
  async function showOptimal() {
    await showPois();
    if (districtLayer.hasOptimal) return;
    districtLayer.hasOptimal = true;
    attribution.addAttribution('buildings © Microsoft');
    VD.buildings.forEach(at => districtLayer.addLayer(L.circleMarker(at, { radius: 2.5, stroke: false, fillColor: '#071D49', fillOpacity: .55, interactive: false })));
    const central = L.circleMarker(VD.central.at, { radius: 7, color: '#071D49', weight: 2, fillColor: '#FFB612', fillOpacity: 1 });
    central.bindTooltip('Most central point', { permanent: true, direction: 'right', offset: [9, 0], className: 'erf-label erf-label-pill' });
    const showCentral = () => {
      infoTitle.textContent = 'Most central point';
      infoLine.textContent = 'Average ' + VD.central.avgKm + ' km to a building · furthest ' + VD.central.furthestKm + ' km';
      infoValue.hidden = true;
      info.hidden = false;
    };
    central.on({ mouseover: showCentral, click: showCentral });
    districtLayer.addLayer(central);
    poiDots.forEach(dot => {
      const p = dot.poi, best = p === bestPoi;
      dot.unbindTooltip();
      dot.setStyle(best ? { radius: 11, weight: 4, color: '#071D49', fillColor: '#20C34A' } : { radius: 6 });
      if (best) dot.bindTooltip(p.name + ' · ' + p.avgKm + ' km average', { permanent: true, direction: 'left', offset: [-13, 0], className: 'erf-label erf-label-pill' });
      dot.off('mouseover click');
      const showIt = () => {
        infoTitle.textContent = p.name;
        infoLine.textContent = p.kind + ' · average ' + p.avgKm + ' km to a building · furthest ' + p.furthestKm + ' km';
        infoValue.hidden = !best;
        infoValue.textContent = 'Closest to all voters';
        info.hidden = false;
      };
      dot.on({ mouseover: showIt, click: showIt });
      dot.bringToFront();
      if (best) showIt();
    });
    map.fitBounds(districtLayer.getLayers()[0].getBounds(), { padding: narrow() ? [16, 16] : [50, 50], animate: !reduceMotion });
    await wait(700);
  }

  // ----- Use case 3: our crowdsourced spaza shop data, extracted from the PinDrop spaza demo (synthetic demo data). -----
  const SPAZA = window.FINDATION_SPAZA, SHOPS = SPAZA.places.filter(p => p.category === 'spaza');
  const TIERS = [
    { key: 'verified', label: 'Verified', colour: '#008C32' },
    { key: 'community', label: 'Community', colour: '#FFB612' },
    { key: 'open', label: 'Open', colour: '#8A96A8' },
  ];
  const tierOf = p => TIERS.find(t => t.key === p.tier) || TIERS[1];
  const words = s => String(s || '').split(' ').filter(Boolean).map(w => w.replace(/_/g, ' ')).join(', ');
  // The address the shops are shown around. It is real: OpenStreetMap lists 1 Buffalo Street as Diepsloot Police Station.
  const SPAZA_ADDRESS = { name: '1 Buffalo Street', suburb: 'Diepsloot', city: 'Johannesburg', what: 'Diepsloot Police Station', at: [-25.922304, 28.022067] };
  // Spreadsheet of the shops (address, lat long, trust level) and the delivery route. A static file: regenerate it if the data changes.
  const SPAZA_DOWNLOAD = { href: 'assets/diepsloot-spaza-shops.xlsx', name: 'FINDATION spaza shops - Diepsloot.xlsx', label: 'Download spaza shops (Excel)' };
  const latLong = at => at[0].toFixed(5) + ', ' + at[1].toFixed(5);
  const kmFrom = (a, b) => { const r = x => x * Math.PI / 180, h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.sqrt(h)); };
  SHOPS.forEach(p => { p.km = kmFrom(SPAZA_ADDRESS.at, p.at); });
  SHOPS.sort((a, b) => a.km - b.km);
  let spazaLayer = null;
  async function showShops() {
    if (spazaLayer) return;
    choosing = false; canChoose = false; picked = null;
    [aroundLayer, parcelLayer, streetLayer, districtLayer].forEach(l => { if (l) map.removeLayer(l); });
    aroundLayer = districtLayer = null;
    tableWrap.hidden = true; stage.classList.remove('table-only'); info.hidden = true;
    map.invalidateSize();
    attribution.addAttribution('spaza shops: FINDATION PinDrop demo');
    spazaLayer = L.featureGroup().addTo(map);
    SHOPS.forEach(p => {
      const dot = L.circleMarker(p.at, { radius: 9, color: '#FFFFFF', weight: 2.5, fillColor: tierOf(p).colour, fillOpacity: 1 });
      // Two shops close together get their labels on opposite sides, so the names do not overlap.
      const near = SHOPS.find(o => o !== p && Math.abs(o.at[0] - p.at[0]) < .002 && Math.abs(o.at[1] - p.at[1]) < .004);
      const side = !near ? 'top' : p.at[1] < near.at[1] ? 'left' : 'right';
      dot.bindTooltip(p.title, { permanent: true, direction: side, offset: side === 'top' ? [0, -9] : [side === 'left' ? -11 : 11, 0], className: 'erf-label' });
      const showIt = () => {
        infoTitle.textContent = p.title;
        infoLine.textContent = ['Near ' + p.street, 'Lat long ' + latLong(p.at), p.km.toFixed(1) + ' km from ' + SPAZA_ADDRESS.name, p.area, p.condition === 'unknown' ? 'condition unknown' : p.condition.replace('_', ' '), 'sells ' + words(p.sells), 'open ' + p.hours, p.n + (p.n === 1 ? ' confirmation' : ' confirmations')].join(' · ');
        infoValue.hidden = false;
        infoValue.textContent = tierOf(p).label + ' · ' + Math.round(p.conf * 100) + '% confidence';
        info.hidden = false;
      };
      dot.on({ mouseover: showIt, click: showIt });
      dot.shop = p;
      spazaLayer.addLayer(dot);
    });
    const pin =L.circleMarker(SPAZA_ADDRESS.at, { radius: 10, color: '#FFFFFF', weight: 3, fillColor: '#071D49', fillOpacity: 1 });
    pin.bindTooltip(SPAZA_ADDRESS.name, { permanent: true, direction: 'top', offset: [0, -11], className: 'erf-label erf-label-own' });
    const showPin = () => {
      infoTitle.textContent = SPAZA_ADDRESS.name + ', ' + SPAZA_ADDRESS.suburb;
      infoLine.textContent = 'Lat long ' + latLong(SPAZA_ADDRESS.at) + ' · ' + SPAZA_ADDRESS.what + ' · address from OpenStreetMap';
      infoValue.hidden = true;
      info.hidden = false;
    };
    pin.on({ mouseover: showPin, click: showPin });
    spazaLayer.addLayer(pin);
    showPin();
    map.fitBounds(spazaLayer.getBounds(), { padding: narrow() ? [30, 30] : [90, 90], maxZoom: 17, animate: false });
    $('legend-title').textContent = 'Trust level';
    $('legend-note').textContent = 'Demo data from PinDrop. It is synthetic.';
    legendList.innerHTML = '';
    TIERS.forEach(t => { const li = document.createElement('li'), sw = document.createElement('i'); sw.style.background = t.colour; li.append(sw, t.label + ' (' + SHOPS.filter(p => p.tier === t.key).length + ')'); legendList.appendChild(li); });
    legend.hidden = false;
    placeText.textContent = SPAZA_ADDRESS.name + ' · ' + SPAZA_ADDRESS.suburb + ', ' + SPAZA_ADDRESS.city;
    place.hidden = false;
    if (appEl.classList.contains('no-map')) {
      await Promise.race([new Promise(r => tiles.once('load', r)), new Promise(r => setTimeout(r, 3000))]);
      appEl.classList.remove('no-map');
      map.invalidateSize();
    }
    await wait(500);
  }

  // Delivery route from the address to every shop, on real roads (worked out beforehand, see SPAZA.route).
  const ROUTE = SPAZA.route;
  async function showRoute() {
    await showShops();
    if (spazaLayer.hasRoute) return;
    spazaLayer.hasRoute = true;
    attribution.addAttribution('route: OSRM');
    const casing = L.polyline(ROUTE.line, { color: '#FFFFFF', weight: 9, opacity: .9, lineCap: 'round', lineJoin: 'round', interactive: false });
    const line = L.polyline(ROUTE.line, { color: '#071D49', weight: 5, opacity: .95, lineCap: 'round', lineJoin: 'round', interactive: false });
    spazaLayer.addLayer(casing); spazaLayer.addLayer(line);
    casing.bringToBack();
    // Number each shop in delivery order.
    spazaLayer.eachLayer(dot => {
      if (!dot.shop) return;
      const stop = ROUTE.stops.findIndex(s => s.id === dot.shop.id) + 1;
      const tip = dot.getTooltip();
      dot.setTooltipContent(stop + ' · ' + dot.shop.title);
      if (tip) tip.getElement() && tip.getElement().classList.add('erf-label-pill');
      dot.bringToFront();
    });
    map.fitBounds(L.latLngBounds(ROUTE.line), { padding: narrow() ? [30, 30] : [90, 90], maxZoom: 17, animate: !reduceMotion });
    infoTitle.textContent = 'Delivery route';
    infoLine.textContent = 'From ' + SPAZA_ADDRESS.name + ' · ' + ROUTE.stops.length + ' stops · ' + ROUTE.km + ' km by road';
    infoValue.hidden = false;
    infoValue.textContent = 'About ' + ROUTE.minutes + ' minutes of driving';
    info.hidden = false;
    await wait(700);
  }

  // ----- The set questions, in the order they are suggested. -----
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
    {
      text: 'I want to buy a property at ' + ADDRESS,
      match: t => /buy|purchase/.test(t),
      run: () => showAround(),
      answer: () => ({
        text: 'Here is ' + ADDRESS + ', ' + PLACE + ', in green, with the erfs around it. Each one shows its estimated property value.',
        facts: [neighbours.length + ' erfs within ' + AROUND_M + ' m', rand(Math.min(...priced)) + ' to ' + rand(Math.max(...priced))],
        source: 'Address and land parcels: City of Tshwane. The values are illustrative: they are worked out from each parcel\'s real area, not taken from a valuation roll.',
      }),
    },
    {
      text: 'What would the estimated property value be for ' + ADDRESS + '?',
      match: t => /value|price|worth|cost/.test(t) && /\b65\b|address|this property|that property/.test(t),
      run: () => valueSubject(),
      answer: () => {
        const p = subject.properties, avg = priced.reduce((s, v) => s + v, 0) / priced.length;
        return {
          text: 'The estimated property value for ' + ADDRESS + ' is about ' + rand(p.value) + '.',
          facts: ['Erf ' + p.erf + ', ' + p.town, fmt(p.area) + ' m²', 'Erfs around it average ' + rand(avg)],
          source: 'This value is illustrative: it is worked out from the parcel\'s real area, not taken from a valuation roll.',
          download: { href: 'assets/65-thomas-edison-street-valuation.xlsx', name: 'FINDATION property valuation - ' + ADDRESS + '.xlsx', label: 'Download valuation (Excel)' },
        };
      },
    },
    {
      useCase: 2,
      text: 'We are looking to set up a voting station in ' + VD_PLACE,
      match: t => /voting|vote|polling|station/.test(t),
      run: () => showDistrict(),
      answer: () => ({
        text: 'Here is ' + VD.place.name + ', a rural area in the ' + VD.place.region + '. The outline is the voting station boundary: the voting district that one voting station serves.',
        facts: ['Voting district ' + VD.district.properties.vd, 'Ward ' + VD.district.properties.ward + ', ' + VD.place.municipality, 'About ' + VD.district.properties.km2 + ' km²'],
        source: 'Source: ' + VD.source + ', fetched ' + VD.fetched + '.',
      }),
    },
    {
      useCase: 2,
      text: 'Show me points of interest',
      match: t => /points? of interest|\bpois?\b|interest/.test(t),
      run: () => showPois(),
      answer: () => ({
        text: 'Here are the points of interest inside the ' + VD.place.name + ' voting station boundary. This is a rural area, so there are only ' + VD.pois.length + '. The green one is the existing voting station.',
        facts: VD.pois.map(p => p.name + ': ' + p.kind.toLowerCase()),
        source: 'Source: ' + VD.poiSource + ', fetched ' + VD.fetched + '.',
      }),
    },
    {
      useCase: 2,
      text: 'What point would be the closest and optimal to all voters?',
      match: t => /closest|nearest|optimal|best|voters/.test(t),
      run: () => showOptimal(),
      answer: () => ({
        text: bestPoi.name + ' is the closest to all voters: on average ' + bestPoi.avgKm + ' km from a building in the district. It is ' + bestPoi.fromCentralKm + ' km from the most central point (gold), where the average would be ' + VD.central.avgKm + ' km.',
        facts: VD.pois.slice().sort((a, b) => a.avgKm - b.avgKm).map(p => p.name + ': ' + p.avgKm + ' km'),
        source: 'Voters are represented by the ' + fmt(VD.buildings.length) + ' buildings in the district (small dots), from ' + VD.buildingSource + '. Distances are straight lines, not road distances.',
      }),
    },
    {
      useCase: 3,
      text: 'Show me the spaza shops in ' + SPAZA_ADDRESS.suburb + ' around ' + SPAZA_ADDRESS.name + ', with their lat long values',
      match: t => /spaza|shop|crowd/.test(t),
      run: () => showShops(),
      answer: () => ({
        text: 'Here are the ' + SHOPS.length + ' spaza shops in ' + SPAZA_ADDRESS.suburb + ' from our crowdsource programme, nearest to ' + SPAZA_ADDRESS.name + ' first, each with its lat long value. The address itself is at ' + latLong(SPAZA_ADDRESS.at) + '. The colour shows the trust level.',
        facts: SHOPS.map(p => p.title + ': ' + latLong(p.at) + ' · ' + p.km.toFixed(1) + ' km'),
        source: 'Shops: ' + SPAZA.source + ', extracted ' + SPAZA.fetched + '. This demo data is synthetic. Address: OpenStreetMap.',
        download: SPAZA_DOWNLOAD,
      }),
    },
    {
      useCase: 3,
      text: 'Show me the optimal travel route to deliver from ' + SPAZA_ADDRESS.name,
      match: t => /route|deliver|travel|path|drive/.test(t),
      run: () => showRoute(),
      answer: () => ({
        text: 'Here is the optimal delivery route from ' + SPAZA_ADDRESS.name + ' to all ' + ROUTE.stops.length + ' spaza shops: ' + ROUTE.km + ' km by road, about ' + ROUTE.minutes + ' minutes of driving. The shops are numbered in delivery order and the route ends at the last shop.',
        facts: ROUTE.stops.map((s, i) => (i + 1) + '. ' + s.title + ' · ' + s.legKm + ' km'),
        source: 'Route worked out on OpenStreetMap roads with the OSRM routing engine. It gives the shortest driving time; the time leaves out traffic and stops. The shops are synthetic demo data.',
        download: SPAZA_DOWNLOAD,
      }),
    },
  ];
  // Questions belong to a use case (1 unless stated). app.html?usecase=2 opens use case 2 directly.
  QUESTIONS.forEach(q => { q.useCase = q.useCase || 1; });
  const LAST_USE_CASE = 3;
  let useCase = Math.min(LAST_USE_CASE, Math.max(1, parseInt(new URLSearchParams(location.search).get('usecase'), 10) || 1));
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
    const next = QUESTIONS.find(q => q.useCase === useCase && !asked.has(q));
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'prompt';
    if (next) {
      para(suggestBox, 'Try asking', 'suggest-label');
      b.textContent = next.text;
      b.addEventListener('click', () => ask(next.text));
    } else if (useCase < LAST_USE_CASE && thread.classList.contains('has-messages')) {
      // This use case is finished: offer the next one, which starts from the clean prompt.
      para(suggestBox, 'Next', 'suggest-label');
      b.textContent = 'Go to use case ' + (useCase + 1);
      b.addEventListener('click', () => startUseCase(useCase + 1));
    } else if (thread.classList.contains('has-messages')) {
      // The last use case is finished: offer to run the demo again from the start.
      para(suggestBox, 'Done', 'suggest-label');
      b.textContent = 'Start again at use case 1';
      b.addEventListener('click', () => startUseCase(1));
    } else return;
    suggestBox.appendChild(b);
  }

  // Back to the clean prompt: conversation cleared, map closed and emptied.
  function startUseCase(n) {
    useCase = n;
    // Keep the address bar in step, so a refresh or a copied link stays on this use case.
    try { history.replaceState(null, '', n === 1 ? location.pathname : location.pathname + '?usecase=' + n); } catch (e) {}
    QUESTIONS.filter(q => q.useCase === n).forEach(q => asked.delete(q));
    [aroundLayer, parcelLayer, streetLayer, districtLayer, spazaLayer].forEach(l => { if (l) map.removeLayer(l); });
    aroundLayer = parcelLayer = streetLayer = subjectLayer = districtLayer = spazaLayer = picked = null;
    valued = subjectValued = choosing = canChoose = false;
    layerOf.clear();
    info.hidden = legend.hidden = place.hidden = tableWrap.hidden = true;
    stage.classList.remove('table-only');
    placeText.textContent = STREET + ' · ' + PLACE;
    appEl.classList.add('no-map');
    thread.querySelectorAll('.msg').forEach(m => m.remove());
    thread.classList.remove('has-messages');
    input.value = '';
    suggest();
    if (canHover) input.focus();
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
    // Later questions are more specific, so they are tried first.
    const hit = choice ? null : QUESTIONS.slice().reverse().find(x => x.match(q.toLowerCase()));
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
      if (a.download) {
        const d = document.createElement('a');
        d.className = 'download msg-download'; d.href = a.download.href; d.download = a.download.name;
        d.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>';
        d.append(a.download.label);
        reply.appendChild(d);
      }
      // Asking a later question also covers the earlier ones it builds on.
      QUESTIONS.slice(0, QUESTIONS.indexOf(hit) + 1).filter(x => x.useCase === hit.useCase).forEach(x => asked.add(x));
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
