// Browser glue: reads controls, calls the pure geometry / frame / view modules, inserts SVG, wires events.
import {pattern, svg, DEFAULTS} from './geometry.mjs';
import {frameModel, placeCanopy, FIIDO_FRAME} from './frame.mjs';
import {camera, VIEWS} from './project.mjs';
import {installedView, orthoView, frameSectionView, canopySectionView, explodedView, assembledCoordView, flatCoordView, shapeThumb, mountThumb} from './views.mjs';
import {SHAPES, MOUNTS, compareShapes} from './variants.mjs';

const model = frameModel();
const STORE = 'fiido-canopy-state-v1';

const CONTROLS = [
  {group: 'Canopy shape', fields: [
    ['length', 'Length along rail', DEFAULTS.length], ['radius', 'Half-width (radius)', DEFAULTS.radius],
    ['height', 'Height above centre', DEFAULTS.height], ['drop', 'Skirt drop below centre', DEFAULTS.drop],
    ['railHeight', 'Rail above centre', DEFAULTS.railHeight, {min: -200}]]},
  {group: 'Construction', fields: [
    ['seam', 'Seam allowance', DEFAULTS.seam], ['hem', 'Hem allowance', DEFAULTS.hem], ['lining', 'Lining thickness', DEFAULTS.lining, {min: 0}],
    ['tube', 'Tube diameter (est.)', DEFAULTS.tube], ['clearance', 'Notch clearance', DEFAULTS.clearance, {min: 0}],
    ['overlap', 'Tab overlap', DEFAULTS.overlap], ['strapWidth', 'Webbing width', DEFAULTS.strapWidth]]},
  {group: 'Installation', fields: [
    ['position', 'Centre from front of straight rail', 150], ['roll', 'Roll outward (°)', 0, {min: -60, max: 60}]]},
  {group: 'Gloved hand envelope (measure)', fields: [
    ['handWidth', 'Width across hand', 60], ['handAbove', 'Above rail centre', 45], ['handBelow', 'Below rail centre', 45]]},
];
const PATTERN_KEYS = ['length', 'radius', 'height', 'drop', 'railHeight', 'seam', 'hem', 'lining', 'tube', 'clearance', 'overlap', 'strapWidth'];

const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })();
const state = {
  tab: 'installed', sides: 'both', cam: {...VIEWS.iso}, exCam: {yaw: 35, pitch: 22}, coCam: {yaw: 35, pitch: 22},
  station: null, explode: 0.6, uFrac: 0.3, values: {}, ...saved,
};
const TABS = ['installed', 'section', 'exploded', 'coord', 'compare', 'pattern'];
if (TABS.includes(location.hash.slice(1))) state.tab = location.hash.slice(1);
if (!TABS.includes(state.tab)) state.tab = 'installed';

const $ = s => document.querySelector(s);
const form = $('#controls');
for (const {group, fields} of CONTROLS) {
  const fs = document.createElement('fieldset');
  fs.innerHTML = `<legend>${group}</legend>`;
  for (const [k, label, def, o = {}] of fields) {
    const row = document.createElement('label');
    row.innerHTML = `<span>${label}</span><input type="number" name="${k}" step="any" min="${o.min ?? 0}" max="${o.max ?? 1000}" value="${state.values[k] ?? def}"><small>mm</small>`;
    if (k === 'roll') row.querySelector('small').textContent = '°';
    fs.append(row);
  }
  if (group === 'Canopy shape') {
    const sel = document.createElement('label');
    sel.innerHTML = `<span>Preset</span><select id="preset"><option value="">custom</option>${SHAPES.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>`;
    fs.prepend(sel);
  }
  if (group === 'Installation') {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<select id="sides"><option value="both">both rails</option><option value="left">left only</option><option value="right">right only</option></select>
      <button type="button" id="alignRoll" title="Tilt the canopy to lie in the side-loop plane">align with loop (${(model.inclination * 180 / Math.PI).toFixed(1)}°)</button>`;
    fs.append(row);
  }
  form.append(fs);
}
$('#sides').value = state.sides;

function read() {
  const v = Object.fromEntries([...new FormData(form)].map(([k, x]) => [k, Number(x)]));
  state.values = v;
  const p = pattern(Object.fromEntries(PATTERN_KEYS.map(k => [k, v[k]])));
  const inst = {position: v.position, roll: v.roll, sides: state.sides};
  const hand = {width: v.handWidth, above: v.handAbove, below: v.handBelow};
  return {p, inst, hand};
}

function stationRange(p, inst) {
  const r = model.rails.left;
  return [r.end[0], r.start[0], placeCanopy(model, p, {...inst, side: 'left'}).centre[0]];
}

const fmt = n => (Math.round(n * 10) / 10).toString();

/** Sliders live in #viewControls and are rebuilt only when their key changes, so dragging is not interrupted. */
function setControls(key, html) {
  const c = $('#viewControls');
  if (c.dataset.key !== key) { c.innerHTML = html; c.dataset.key = key; }
}

function renderTab({p, inst, hand}) {
  const out = $('#viewBody');
  const place = placeCanopy(model, p, {...inst, side: 'left'});
  const warn = place.fits ? '' : `<p class="warn">⚠ Canopy overruns the straight rail by ${fmt(-Math.min(place.frontGap, place.rearGap))} mm; it would sit on the bend.</p>`;
  if (!['section', 'exploded', 'coord'].includes(state.tab)) setControls('none', '');
  if (state.tab === 'installed') {
    out.innerHTML = `${warn}<div class="toolbar">${Object.entries(VIEWS).map(([k, c]) => `<button type="button" data-cam="${k}">${c.label}</button>`).join('')}<span class="hint">Drag the 3D view to rotate.</span></div>
      <div class="drag" data-cam-target="cam">${installedView(model, p, inst, camera(state.cam), {station: state.station})}</div>
      <div class="grid3"><figure>${orthoView(model, p, inst, 'side')}<figcaption>Side (from the right)</figcaption></figure>
      <figure>${orthoView(model, p, inst, 'rear')}<figcaption>Rear, looking forward</figcaption></figure>
      <figure>${orthoView(model, p, inst, 'top')}<figcaption>Top</figcaption></figure></div>
      <p class="note">Dark tubes: shape fitted to the manufacturer side drawing and labelled widths. Grey dashed tubes: cross members inferred from photos, low confidence. Grey box: seat cushion, width assumed.</p>`;
  } else if (state.tab === 'section') {
    const [lo, hi, mid] = stationRange(p, inst);
    if (state.station == null || state.station < lo || state.station > hi) state.station = mid;
    setControls(`section:${fmt(lo)}:${fmt(hi)}`, `<label class="slider">Section station x <input type="range" id="station" min="${fmt(lo)}" max="${fmt(hi)}" step="1" value="${state.station}"><output></output></label>`);
    $('#viewControls output').textContent = `${fmt(state.station)} mm`;
    out.innerHTML = `${warn}<div class="grid2"><figure>${frameSectionView(model, p, inst, state.station, hand)}<figcaption>Through the frame at the station, viewed from behind</figcaption></figure>
      <figure>${canopySectionView(p, hand)}<figcaption>Canopy section (canopy axes; roll ${fmt(inst.roll)}° not applied)</figcaption></figure></div>
      <figure class="mini">${installedView(model, p, inst, camera(VIEWS.iso), {station: state.station})}<figcaption>Station on the frame</figcaption></figure>`;
  } else if (state.tab === 'exploded') {
    setControls('exploded', `<label class="slider">Explode <input type="range" id="explode" min="0" max="1" step="0.01" value="${state.explode}"><output></output></label>`);
    $('#viewControls output').textContent = `${Math.round(state.explode * 100)}%`;
    out.innerHTML = `<div class="drag" data-cam-target="exCam">${explodedView(p, camera(state.exCam), state.explode)}</div>
      <p class="note">Each piece is drawn as its exact cut outline from the pattern engine, formed onto the canopy surface. Seam and hem allowances are shown unfolded; dashed lines are stitch lines. Drag to rotate.</p>`;
  } else if (state.tab === 'coord') {
    setControls('coord', `<label class="slider">Position along seam (u) <input type="range" id="ufrac" min="0" max="1" step="0.005" value="${state.uFrac}"><output></output></label>`);
    $('#viewControls output').textContent = `${fmt(state.uFrac * p.arc)} mm`;
    out.innerHTML = `<div class="grid2 coord"><div class="drag" data-cam-target="coCam">${assembledCoordView(p, camera(state.coCam), state.uFrac)}</div><div>${flatCoordView(p, state.uFrac)}</div></div>
      <p class="legend"><b style="color:#1f77b4">front cap seam</b> · <b style="color:#e07b00">rear cap seam</b> · <b style="color:#2a9d4b">hems</b> · <b style="color:#8e44ad">notch (bound)</b> · <b style="color:#d62728">matching point u</b> — hover an edge to highlight its partner.</p>`;
  } else if (state.tab === 'compare') {
    const rows = compareShapes(Object.fromEntries(PATTERN_KEYS.map(k => [k, state.values[k]])), hand);
    const cell = (r, fn) => r.error ? '—' : fn(r);
    out.innerHTML = `<h2>Canopy shapes</h2><div class="cards">${rows.map(r => `<figure>${r.error ? `<p class="warn">✗ ${r.error}</p>` : shapeThumb(r.p, hand)}<figcaption><b>${r.name}</b><br>${r.intent}</figcaption></figure>`).join('')}</div>
      <table><thead><tr><th>Shape</th><th>a × b + drop</th><th>Wrap width</th><th>Hand clearance</th><th>Exposed below hem</th><th>Cap (wind) area</th><th>Fabric / canopy shell + lining</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.name}</td><td>${cell(r, x => `${fmt(x.p.radius)} × ${fmt(x.p.height)} + ${fmt(x.p.drop)}`)}</td><td>${cell(r, x => fmt(x.wrapWidth) + ' mm')}</td>
      <td class="${!r.error && r.clearance < 0 ? 'bad' : ''}">${cell(r, x => Number.isFinite(x.clearance) ? fmt(x.clearance) + ' mm ' + (x.clearance >= 0 ? '✓' : '✗') : 'n/a')}</td>
      <td>${cell(r, x => fmt(x.exposed) + ' mm')}</td><td>${cell(r, x => fmt(x.frontalArea) + ' cm²')}</td><td>${cell(r, x => `${fmt(x.fabric.shell)} + ${fmt(x.fabric.lining)} cm²`)}</td></tr>`).join('')}
      </tbody></table>
      <h2>Mounting mechanisms</h2><p class="note">Part sizes are computed from the current pattern and placement. Ratings are design judgement, not test results.</p>
      <div class="cards">${MOUNTS.map(m => `<figure>${mountThumb(p, place, m.id)}<figcaption><b>${m.name}</b><br>${m.note}</figcaption></figure>`).join('')}</div>
      <table><thead><tr><th>Mechanism</th><th>Parts</th><th>Slide</th><th>Rotation</th><th>Removal</th><th>Hard parts</th><th>Risk</th></tr></thead><tbody>
      ${MOUNTS.map(m => `<tr><td>${m.name}</td><td>${m.parts(p, place).join('<br>')}</td><td>${m.slide}</td><td>${m.rotation}</td><td>${m.removal}</td><td>${m.hard}</td><td>${m.risk}</td></tr>`).join('')}</tbody></table>`;
  } else {
    const s = svg(p);
    out.innerHTML = `<p>Matching curved seam: ${fmt(p.arc)} mm · lining seam: ${fmt(p.liningArc)} mm · notch radius: ${fmt(p.notchRadius)} mm · tab blank: ${fmt(p.strapLength)} mm.</p>
      <button type="button" id="save">Download full-size SVG</button> <span class="hint">Print at 100% and check the 50 mm square. No A4 tiling yet.</span>
      <div class="sheet">${s}</div>`;
    $('#save').onclick = () => {
      const url = URL.createObjectURL(new Blob([s], {type: 'image/svg+xml'}));
      const a = document.createElement('a');
      a.href = url; a.download = 'fiido-canopy.svg'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
}

let frame = 0;
function update() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    try {
      const ctx = read();
      $('#error').textContent = '';
      renderTab(ctx);
      $('#stats').textContent = `Seam ${fmt(ctx.p.arc)} mm · lining ${fmt(ctx.p.liningArc)} mm · notch ⌀${fmt(2 * ctx.p.notchRadius)} mm`;
    } catch (e) {
      $('#error').textContent = '✗ ' + e.message;
    }
    for (const b of document.querySelectorAll('nav button')) b.setAttribute('aria-selected', b.dataset.tab === state.tab);
    localStorage.setItem(STORE, JSON.stringify({tab: state.tab, sides: state.sides, cam: state.cam, exCam: state.exCam, coCam: state.coCam, station: state.station, explode: state.explode, uFrac: state.uFrac, values: state.values}));
  });
}

form.addEventListener('input', e => { if (e.target.id !== 'preset') $('#preset').value = ''; update(); });
form.addEventListener('submit', e => e.preventDefault());
$('#preset').addEventListener('change', e => {
  const s = SHAPES.find(x => x.id === e.target.value);
  if (!s) return;
  const vals = s.make({radius: Number(form.radius.value)});
  for (const [k, v] of Object.entries(vals)) form[k].value = v;
  update();
});
$('#sides').addEventListener('change', e => { state.sides = e.target.value; update(); });
$('#alignRoll').addEventListener('click', () => { form.roll.value = (model.inclination * 180 / Math.PI).toFixed(1); update(); });
$('#reset').addEventListener('click', () => { localStorage.removeItem(STORE); location.reload(); });
document.querySelector('nav').addEventListener('click', e => { const t = e.target.closest('button[data-tab]'); if (t) { state.tab = t.dataset.tab; history.replaceState(null, '', '#' + state.tab); update(); } });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.includes(h)) { state.tab = h; update(); } });

const view = $('#view');
view.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'station') state.station = Number(t.value);
  if (t.id === 'explode') state.explode = Number(t.value);
  if (t.id === 'ufrac') state.uFrac = Number(t.value);
  update();
});
view.addEventListener('click', e => { const b = e.target.closest('button[data-cam]'); if (b) { state.cam = {...VIEWS[b.dataset.cam]}; update(); } });

let drag = null;
view.addEventListener('pointerdown', e => {
  const d = e.target.closest('.drag');
  if (!d) return;
  drag = {key: d.dataset.camTarget, x: e.clientX, y: e.clientY, start: {...state[d.dataset.camTarget]}};
  d.setPointerCapture?.(e.pointerId);
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const c = state[drag.key];
  c.yaw = drag.start.yaw - (e.clientX - drag.x) * 0.4;
  c.pitch = Math.max(-89, Math.min(89, drag.start.pitch + (e.clientY - drag.y) * 0.4));
  update();
});
window.addEventListener('pointerup', () => { drag = null; });

view.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-edge]');
  for (const x of view.querySelectorAll('.hl')) x.classList.remove('hl');
  if (!el) return;
  const tokens = el.dataset.edge.split(' ');
  for (const x of view.querySelectorAll('[data-edge]')) if (x.dataset.edge.split(' ').some(t => tokens.includes(t))) x.classList.add('hl');
});

$('#frameSource').textContent = `Frame model: tube ⌀${FIIDO_FRAME.tube} mm (est.), loops lean ${(model.inclination * 180 / Math.PI).toFixed(1)}°, straight top rail ${model.rails.left.length.toFixed(0)} mm (est.).`;
update();
