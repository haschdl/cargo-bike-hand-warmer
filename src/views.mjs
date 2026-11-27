// Pure SVG view builders. Inputs are pattern(), frameModel() and plain state objects; outputs are SVG strings.
// No DOM access: the browser glue (app.mjs) only inserts these strings and wires events.
// Every fabric outline comes from geometry.mjs; frame shapes come from frame.mjs.
import {profilePoints, profileAt, handClearance, finishedCapOutline} from './geometry.mjs';
import {placeCanopy} from './frame.mjs';
import {camera} from './project.mjs';

const f = n => +(+n).toFixed(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const pathD = (pts, close) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + (close ? 'Z' : '');

export const COLORS = Object.freeze({
  frame: '#2d2d2d', frameLow: '#8a8a8a', shell: '#2f6db5', lining: '#d9822b', seamFront: '#1f77b4', seamRear: '#e07b00',
  hem: '#2a9d4b', notch: '#8e44ad', ugen: '#d62728', ok: '#2a9d4b', bad: '#c0392b', context: '#9aa5b1',
});

/**
 * Render primitives to an SVG string. Each primitive has 2D points (already projected) and an optional depth;
 * primitives are drawn far-to-near, text last. viewBox fits all geometry plus a margin.
 */
function render(prims, {margin = 20, font, title = '', cls = ''} = {}) {
  const xs = [], ys = [];
  for (const p of prims) for (const [x, y] of p.pts || [p.at]) { xs.push(x); ys.push(y); }
  if (!xs.length) { xs.push(0, 1); ys.push(0, 1); }
  const x0 = Math.min(...xs) - margin, y0 = Math.min(...ys) - margin;
  const w = Math.max(...xs) - Math.min(...xs) + 2 * margin, h = Math.max(...ys) - Math.min(...ys) + 2 * margin;
  const fs = font ?? Math.max(w, h) / 48;
  const shapes = prims.filter(p => p.kind !== 'text').sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));
  const out = shapes.map(p => {
    const a = p.attrs ? ' ' + p.attrs : '';
    if (p.kind === 'circle') return `<circle cx="${f(p.at[0])}" cy="${f(p.at[1])}" r="${f(p.r)}"${a}/>`;
    return `<path d="${pathD(p.pts, p.close)}"${a}/>`;
  });
  for (const t of prims.filter(p => p.kind === 'text'))
    out.push(`<text x="${f(t.at[0])}" y="${f(t.at[1])}" font-size="${f(fs * (t.size || 1))}"${t.attrs ? ' ' + t.attrs : ''}>${esc(t.text)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" role="img" aria-label="${esc(title)}">${title ? `<title>${esc(title)}</title>` : ''}${out.join('')}</svg>`;
}

const mean = (arr, i) => arr.reduce((s, p) => s + p[i], 0) / arr.length;

/** Project 3D primitives with a camera. */
function project3(prims3, cam) {
  return prims3.map(p => {
    if (p.kind === 'text' || p.kind === 'circle') {
      const q = cam.project(p.at3);
      return {...p, at: [q[0], q[1]], depth: q[2] + (p.bias || 0)};
    }
    const q = p.pts3.map(cam.project);
    return {...p, pts: q.map(v => [v[0], v[1]]), depth: (p.depthAt ? cam.project(p.depthAt)[2] : mean(q, 2)) + (p.bias || 0)};
  });
}

function tubePrims(model, {lowConfidenceDashed = true} = {}) {
  const prims = [], d = model.cfg.tube;
  for (const t of model.tubes) {
    const dashed = lowConfidenceDashed && t.confidence === 'low';
    for (let i = 1; i < t.pts.length; i++)
      prims.push({kind: 'path', pts3: [t.pts[i - 1], t.pts[i]],
        attrs: `fill="none" stroke="${dashed ? COLORS.frameLow : COLORS.frame}" stroke-width="${d}" stroke-linecap="round"${dashed ? ` stroke-dasharray="${d * 1.5} ${d}"` : ''}`});
  }
  return prims;
}

function cushionPrims(model) {
  const c = model.cushion, hw = c.width / 2, zb = 16, zt = c.top;
  const box = [[c.x0, -hw], [c.x1, -hw], [c.x1, hw], [c.x0, hw]];
  return [{kind: 'path', pts3: box.map(([x, y]) => [x, y, zt]), close: true, bias: 0,
    attrs: `fill="${COLORS.context}" fill-opacity="0.18" stroke="${COLORS.context}" stroke-dasharray="6 4"`},
  {kind: 'path', pts3: box.map(([x, y]) => [x, y, zb]), close: true,
    attrs: `fill="none" stroke="${COLORS.context}" stroke-dasharray="6 4"`}];
}

/** Assembled canopy surfaces (finished stitch geometry) on a placement. */
function canopyPrims(p, place, {fillOpacity = 0.45, edges = false} = {}) {
  const prims = [], L = p.length, prof = profilePoints(p, 0, 36), T = place.toWorld;
  for (let i = 1; i < prof.length; i++) {
    const [u0, v0] = prof[i - 1], [u1, v1] = prof[i];
    prims.push({kind: 'path', close: true, pts3: [T(u0, v0, -L / 2), T(u1, v1, -L / 2), T(u1, v1, L / 2), T(u0, v0, L / 2)],
      attrs: `fill="${COLORS.shell}" fill-opacity="${fillOpacity}" stroke="${COLORS.shell}" stroke-opacity="0.35" stroke-width="0.6"`});
  }
  const cap = finishedCapOutline(p, 0, 36);
  for (const [w, id] of [[L / 2, 'seamFront'], [-L / 2, 'seamRear']]) {
    prims.push({kind: 'path', close: true, pts3: cap.map(([u, v]) => T(u, v, w)),
      attrs: `fill="${COLORS.shell}" fill-opacity="${fillOpacity * 0.8}" stroke="${edges ? COLORS[id] : COLORS.shell}" stroke-width="${edges ? 2.2 : 0.8}" data-edge="${id}"`});
  }
  if (edges) {
    const hemO = [T(prof[0][0], prof[0][1], -L / 2), T(prof[0][0], prof[0][1], L / 2)];
    const e = prof[prof.length - 1], hemI = [T(e[0], e[1], -L / 2), T(e[0], e[1], L / 2)];
    for (const h of [hemO, hemI]) prims.push({kind: 'path', pts3: h, bias: -5, attrs: `fill="none" stroke="${COLORS.hem}" stroke-width="2.2" data-edge="hem"`});
    for (const [w, id] of [[L / 2, 'seamFront'], [-L / 2, 'seamRear']])
      prims.push({kind: 'path', pts3: prof.map(([u, v]) => T(u, v, w)), bias: -5, attrs: `fill="none" stroke="${COLORS[id]}" stroke-width="2.6" data-edge="${id}"`});
  }
  return prims;
}

function railLine(place, p, extra = 40) {
  const L = p.length / 2 + extra, T = place.toWorld;
  return {kind: 'path', pts3: [T(0, p.railHeight, -L), T(0, p.railHeight, L)], attrs: `fill="none" stroke="${COLORS.frame}" stroke-width="${p.tube}" stroke-linecap="round"`};
}

function placements(model, p, inst) {
  const sides = inst.sides === 'left' ? ['left'] : inst.sides === 'right' ? ['right'] : ['left', 'right'];
  return sides.map(side => placeCanopy(model, p, {side, position: inst.position, roll: inst.roll}));
}

/** Installed 3D view: frame, both canopies, optional section plane. */
export function installedView(model, p, inst, cam, {station} = {}) {
  const prims = [...tubePrims(model), ...cushionPrims(model)];
  for (const pl of placements(model, p, inst)) prims.push(...canopyPrims(p, pl));
  if (station != null) {
    const z1 = model.envelope.zMax + 30, y1 = model.cfg.upperWidth / 2 + 90;
    prims.push({kind: 'path', close: true, pts3: [[station, -y1, -10], [station, y1, -10], [station, y1, z1], [station, -y1, z1]], bias: 0,
      attrs: `fill="${COLORS.ugen}" fill-opacity="0.06" stroke="${COLORS.ugen}" stroke-dasharray="8 5"`});
    prims.push({kind: 'text', at3: [station, -y1, z1 + 8], text: `Section x = ${f(station)} mm`, attrs: `fill="${COLORS.ugen}"`});
  }
  prims.push({kind: 'text', at3: [model.envelope.xMax + 30, 0, 0], text: 'front →', attrs: 'fill="#555"'});
  prims.push({kind: 'text', at3: [model.envelope.xMin, model.cfg.upperWidth / 2 + 40, model.envelope.zMax], text: 'left', attrs: 'fill="#555"'});
  return render(project3(prims, cam), {title: 'Installed hand warmers on the Fiido Family Add-on frame', cls: 'v3d'});
}

function dim(a, b, text, off, prims) {
  const [ax, ay] = a, [bx, by] = b, dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l * off, ny = dx / l * off;
  const A = [ax + nx, ay + ny], B = [bx + nx, by + ny];
  prims.push({kind: 'path', pts: [a, A], attrs: 'stroke="#999" stroke-width="0.6" fill="none"'});
  prims.push({kind: 'path', pts: [b, B], attrs: 'stroke="#999" stroke-width="0.6" fill="none"'});
  prims.push({kind: 'path', pts: [A, B], attrs: 'stroke="#444" stroke-width="0.8" fill="none"'});
  prims.push({kind: 'text', at: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 4], text, attrs: 'text-anchor="middle" fill="#222"'});
}

/** Orthographic side / rear / top view with labelled vs modelled dimensions. */
export function orthoView(model, p, inst, which) {
  const cam = camera({side: {yaw: 0, pitch: 0}, rear: {yaw: 90, pitch: 0}, top: {yaw: 0, pitch: 90}}[which]);
  const prims3 = [...tubePrims(model), ...cushionPrims(model)];
  for (const pl of placements(model, p, inst)) prims3.push(...canopyPrims(p, pl, {fillOpacity: 0.35}));
  const prims = project3(prims3, cam);
  const P = v => cam.project(v).slice(0, 2), e = model.envelope, cfg = model.cfg;
  if (which === 'side') {
    dim(P([e.xMin, -400, e.zMin]), P([e.xMax, -400, e.zMin]), `637 labelled · ${f(e.length)} model`, 40, prims);
    dim(P([e.xMin, -400, e.zMax]), P([e.xMin, -400, e.zMin]), `315 · ${f(e.height)}`, 30, prims);
    const r = model.rails.right;
    dim(P(r.start), P(r.end), `straight top rail ${f(r.length)} (est.)`, 30, prims);
  } else if (which === 'rear') {
    const zt = cfg.side.rearTop[1], zb = cfg.side.rearBottom[1];
    dim(P([0, cfg.upperWidth / 2, zt]), P([0, -cfg.upperWidth / 2, zt]), '355 labelled (c/l assumed)', -40, prims);
    dim(P([0, cfg.lowerWidth / 2, zb]), P([0, -cfg.lowerWidth / 2, zb]), '104 labelled (c/l assumed)', 40, prims);
    prims.push({kind: 'text', at: P([0, cfg.upperWidth / 2 + 20, zt / 2]), text: `loops lean ${f(model.inclination * 180 / Math.PI)}°`, attrs: 'text-anchor="end" fill="#444"'});
  } else {
    const [m0, , m2] = model.mounts;
    dim(P(m0), P(m2), '384 mounts', -30, prims);
    dim(P([model.mounts[0][0], cfg.mountLateral / 2, 0]), P([model.mounts[0][0], -cfg.mountLateral / 2, 0]), '48', 20, prims);
  }
  return render(prims, {title: `${which} orthographic view`, cls: 'vortho', margin: 50, font: 20});
}

function crossings(model, x) {
  const hits = [];
  for (const t of model.tubes)
    for (let i = 1; i < t.pts.length; i++) {
      const a = t.pts[i - 1], b = t.pts[i];
      if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
      const k = (x - a[0]) / (b[0] - a[0]);
      hits.push({id: t.id, confidence: t.confidence, y: a[1] + k * (b[1] - a[1]), z: a[2] + k * (b[2] - a[2])});
    }
  for (const t of model.tubes) if (t.pts.length === 2 && t.pts[0][0] === t.pts[1][0] && Math.abs(t.pts[0][0] - x) < model.cfg.tube / 2)
    hits.push({id: t.id, confidence: t.confidence, line: t.pts});
  return hits;
}

/** Frame cross-section at plane x = station, viewed from behind (looking forward). */
export function frameSectionView(model, p, inst, station, hand) {
  const prims = [], S = ([, y, z]) => [-y, -z], d = model.cfg.tube;
  for (const h of crossings(model, station)) {
    if (h.line) prims.push({kind: 'path', pts: h.line.map(S), attrs: `fill="none" stroke="${COLORS.frameLow}" stroke-width="${d}"`});
    else prims.push({kind: 'circle', at: S([0, h.y, h.z]), r: d / 2, attrs: `fill="${h.confidence === 'low' ? COLORS.frameLow : COLORS.frame}"`});
  }
  const c = model.cushion;
  if (station >= c.x0 && station <= c.x1) prims.push({kind: 'path', close: true, pts: [[-c.width / 2, -16], [c.width / 2, -16], [c.width / 2, -c.top], [-c.width / 2, -c.top]].map(([y, z]) => [y, z]), attrs: `fill="${COLORS.context}" fill-opacity="0.25" stroke="${COLORS.context}" stroke-dasharray="5 4"`});
  prims.push({kind: 'path', pts: [[0, 20], [0, -model.envelope.zMax - 60]], attrs: 'stroke="#bbb" stroke-dasharray="4 4" fill="none"'});
  for (const pl of placements(model, p, inst)) {
    const w = station - pl.centre[0], inside = Math.abs(w) <= p.length / 2;
    const T = (u, v) => S(pl.toWorld(u, v, 0));
    const shell = profilePoints(p, 0, 90).map(([u, v]) => T(u, v)), lin = profilePoints(p, -p.lining, 90).map(([u, v]) => T(u, v));
    if (inside) {
      prims.push({kind: 'path', close: true, pts: [...shell, ...lin.reverse()], attrs: `fill="${COLORS.lining}" fill-opacity="0.35" stroke="none"`});
      prims.push({kind: 'path', pts: shell, attrs: `fill="none" stroke="${COLORS.shell}" stroke-width="2.5"`});
      const cl = handClearance(p, hand);
      const env = [[-cl.hw, p.railHeight - hand.below], [cl.hw, p.railHeight - hand.below], [cl.hw, cl.top], [-cl.hw, cl.top]].map(([u, v]) => T(u, v));
      prims.push({kind: 'path', close: true, pts: env, attrs: `fill="none" stroke="${cl.clearance >= 0 ? COLORS.ok : COLORS.bad}" stroke-dasharray="4 3"`});
    } else {
      prims.push({kind: 'path', pts: shell, attrs: `fill="none" stroke="${COLORS.shell}" stroke-opacity="0.35" stroke-dasharray="4 4"`});
    }
    const lab = T(pl.side === 'left' ? p.radius + 10 : -p.radius - 10, p.height + 15);
    prims.push({kind: 'text', at: lab, text: `${pl.side}${inside ? '' : ' (canopy not at this station)'}`, attrs: `text-anchor="${pl.side === 'left' ? 'end' : 'start'}" fill="#444"`});
  }
  prims.push({kind: 'text', at: [0, 40], text: `Section x = ${f(station)} mm, viewed from behind`, attrs: 'text-anchor="middle" fill="#444"'});
  return render(prims, {title: 'Frame cross-section', cls: 'vsec', margin: 30});
}

/** Detailed canopy cross-section in canopy coordinates (u outward, v up), with hand envelope and clearance. */
export function canopySectionView(p, hand) {
  const prims = [], S = ([u, v]) => [u, -v];
  const shell = profilePoints(p, 0, 120), lin = profilePoints(p, -p.lining, 120);
  const cap = finishedCapOutline(p, 0, 120);
  prims.push({kind: 'path', close: true, pts: cap.map(S), attrs: `fill="${COLORS.shell}" fill-opacity="0.07" stroke="${COLORS.shell}" stroke-opacity="0.4" stroke-dasharray="3 3"`});
  prims.push({kind: 'path', close: true, pts: [...shell, ...[...lin].reverse()].map(S), attrs: `fill="${COLORS.lining}" fill-opacity="0.35"`});
  prims.push({kind: 'path', pts: shell.map(S), attrs: `fill="none" stroke="${COLORS.shell}" stroke-width="1.6"`});
  prims.push({kind: 'path', pts: lin.map(S), attrs: `fill="none" stroke="${COLORS.lining}" stroke-width="1"`});
  const a = p.radius, hemV = -p.drop;
  prims.push({kind: 'path', pts: [[-a - 25, -hemV], [a + 25, -hemV]], attrs: `stroke="${COLORS.hem}" stroke-dasharray="2 3" fill="none"`});
  prims.push({kind: 'circle', at: S([0, p.railHeight]), r: p.tube / 2, attrs: `fill="${COLORS.frame}"`});
  const cl = handClearance(p, hand), ok = cl.clearance >= 0;
  const env = [[-cl.hw, p.railHeight - hand.below], [cl.hw, p.railHeight - hand.below], [cl.hw, cl.top], [-cl.hw, cl.top]];
  prims.push({kind: 'path', close: true, pts: env.map(S), attrs: `fill="${ok ? COLORS.ok : COLORS.bad}" fill-opacity="0.08" stroke="${ok ? COLORS.ok : COLORS.bad}" stroke-dasharray="4 3"`});
  if (cl.exposed > 0) prims.push({kind: 'path', close: true, pts: [[-cl.hw, hemV], [cl.hw, hemV], [cl.hw, p.railHeight - hand.below], [-cl.hw, p.railHeight - hand.below]].map(S), attrs: `fill="${COLORS.bad}" fill-opacity="0.10" stroke="none"`});
  const low = Math.min(hemV, p.railHeight - hand.below);
  dim(S([-a, low]), S([a, low]), `${f(2 * a)} wide`, 14, prims);
  dim(S([a, 0]), S([a, p.height]), `${f(p.height)} high`, 18, prims);
  if (p.drop > 0) dim(S([a, hemV]), S([a, 0]), `drop ${f(p.drop)}`, 18, prims);
  const fs = 1;
  prims.push({kind: 'text', at: S([-a - 20, p.height + 26]), size: fs, text: `Clearance to lining: ${Number.isFinite(cl.clearance) ? f(cl.clearance) + ' mm' : 'n/a'} ${ok ? '✓' : '✗ hand envelope hits the lining'}`, attrs: `fill="${ok ? COLORS.ok : COLORS.bad}"`});
  prims.push({kind: 'text', at: S([-a - 20, p.height + 14]), size: fs, text: `Hand exposed below hem: ${f(cl.exposed)} mm`, attrs: `fill="${cl.exposed > 0 ? COLORS.bad : '#444'}"`});
  prims.push({kind: 'text', at: S([a + 22, hemV - 10]), size: 0.85, text: 'outward →', attrs: 'text-anchor="end" fill="#666"'});
  prims.push({kind: 'text', at: S([-a - 20, low - 34]), size: 0.85, text: 'Dashed outline: end cap behind, with rail notch. Shaded band: lining thickness.', attrs: 'fill="#666"'});
  return render(prims, {title: 'Canopy cross-section', cls: 'vsec', margin: 20});
}

/** Canopy-local camera frame for single-canopy views: u → y, w → x, v → z. */
const localT = (u, v, w) => [w, u, v];

function cutWrapPrims(pc, prof, total, {dv = 0, w0 = 0, color, label, strips = 40}) {
  const prims = [], [W, H] = pc.size, h = pc.hem, s = pc.seam, L = pc.length;
  const M = (x, y) => { const [u, v] = profileAt(prof, total, x - h); return localT(u, v + dv, w0 + y - s - L / 2); };
  for (let i = 0; i < strips; i++) {
    const x0 = W * i / strips, x1 = W * (i + 1) / strips;
    prims.push({kind: 'path', close: true, pts3: [M(x0, 0), M(x1, 0), M(x1, H), M(x0, H)], attrs: `fill="${color}" fill-opacity="0.32" stroke="${color}" stroke-opacity="0.25" stroke-width="0.5"`});
  }
  const line = (pts, attrs) => prims.push({kind: 'path', pts3: pts, bias: -3, attrs});
  const xs = Array.from({length: 61}, (_, i) => W * i / 60);
  line(xs.map(x => M(x, 0)), `fill="none" stroke="${color}" stroke-width="1.2"`);
  line(xs.map(x => M(x, H)), `fill="none" stroke="${color}" stroke-width="1.2"`);
  const sx = Array.from({length: 61}, (_, i) => h + (W - 2 * h) * i / 60);
  line(sx.map(x => M(x, s)), `fill="none" stroke="${color}" stroke-dasharray="3 2"`);
  line(sx.map(x => M(x, H - s)), `fill="none" stroke="${color}" stroke-dasharray="3 2"`);
  prims.push({kind: 'text', at3: M(W / 2, H / 2), text: label, attrs: `fill="${color}" text-anchor="middle" font-weight="600"`, bias: -100});
  return prims;
}

function cutCapPrims(pc, w, color, label) {
  const T = ([u, v]) => localT(u, v, w);
  return [
    {kind: 'path', close: true, pts3: pc.outlineUV.map(T), attrs: `fill="${color}" fill-opacity="0.32" stroke="${color}" stroke-width="1.2"`},
    {kind: 'path', pts3: pc.stitchUV.map(T), bias: -2, attrs: `fill="none" stroke="${color}" stroke-dasharray="3 2"`},
    {kind: 'text', at3: T([0, pc.outlineUV[0][1] + 12]), text: label, attrs: `fill="${color}" text-anchor="middle" font-weight="600"`, bias: -100},
  ];
}

/** Exploded construction view of one canopy. All pieces are the exact cut polygons from pattern(). */
export function explodedView(p, cam, e = 0.6) {
  const by = id => p.pieces.find(pc => pc.id === id);
  const shellProf = profilePoints(p, 0, 180), linProf = profilePoints(p, -p.lining, 180);
  const L = p.length, prims = [];
  prims.push({kind: 'path', pts3: [localT(0, p.railHeight, -L / 2 - 160 * e - 60), localT(0, p.railHeight, L / 2 + 160 * e + 60)],
    attrs: `fill="none" stroke="${COLORS.frame}" stroke-width="${p.tube}" stroke-linecap="round" stroke-opacity="0.85"`});
  prims.push(...cutWrapPrims(by('P01'), shellProf, p.arc, {dv: 90 * e, color: COLORS.shell, label: 'P01 shell wrap'}));
  prims.push(...cutWrapPrims(by('P01L'), linProf, p.liningArc, {dv: 0, color: COLORS.lining, label: 'P01L lining wrap'}));
  for (const sg of [1, -1]) {
    prims.push(...cutCapPrims(by('P02'), sg * (L / 2 + 150 * e), COLORS.shell, `P02 shell cap (${sg > 0 ? 'front' : 'rear'})`));
    prims.push(...cutCapPrims(by('P02L'), sg * (L / 2 - p.lining + 75 * e), COLORS.lining, 'P02L lining cap'));
    const tw = sg * (L / 2 - p.strapWidth / 2 - 4), dz = -60 * e, ring = [];
    for (let i = 0; i <= 40; i++) { const t = 2 * Math.PI * i / 40; ring.push([Math.cos(t) * (p.tube / 2 + 1.5), p.railHeight + dz + Math.sin(t) * (p.tube / 2 + 1.5)]); }
    prims.push({kind: 'path', pts3: ring.map(([u, v]) => localT(u, v, tw)), attrs: `fill="none" stroke="#555" stroke-width="${p.strapWidth * 0.5}" stroke-opacity="0.8"`});
    prims.push({kind: 'text', at3: localT(0, p.railHeight + dz - 22, tw), text: 'P03 tab', attrs: 'fill="#444" text-anchor="middle"', bias: -100});
  }
  const span = 2 * (L / 2 + 150 * e) + 2 * p.radius;
  return render(project3(prims, cam), {title: 'Exploded fabric construction', cls: 'v3d', margin: 30, font: span / 55});
}

/** Assembled canopy with colour-coded seams and the generator line at arc length u (canopy-local frame). */
export function assembledCoordView(p, cam, uFrac) {
  const place = {toWorld: (u, v, w) => localT(u, v, w)};
  const prims = [railLine(place, p), ...canopyPrims(p, place, {fillOpacity: 0.28, edges: true})];
  const prof = profilePoints(p, 0, 180), u = uFrac * p.arc, [pu, pv] = profileAt(prof, p.arc, u), L = p.length;
  prims.push({kind: 'path', pts3: [localT(pu, pv, -L / 2), localT(pu, pv, L / 2)], bias: -20, attrs: `fill="none" stroke="${COLORS.ugen}" stroke-width="2.5" data-edge="ugen"`});
  for (const w of [-L / 2, L / 2]) prims.push({kind: 'circle', at3: localT(pu, pv, w), r: 4, bias: -30, attrs: `fill="${COLORS.ugen}"`});
  prims.push({kind: 'text', at3: localT(prof[0][0], prof[0][1] - 14, L / 2), text: 'outer hem (u = 0)', attrs: `fill="${COLORS.hem}" text-anchor="middle"`});
  prims.push({kind: 'text', at3: localT(0, p.height + 18, L / 2), text: 'front cap', attrs: `fill="${COLORS.seamFront}" text-anchor="middle"`});
  prims.push({kind: 'text', at3: localT(0, p.height + 18, -L / 2), text: 'rear cap', attrs: `fill="${COLORS.seamRear}" text-anchor="middle"`});
  return render(project3(prims, cam), {title: 'Assembled canopy, colour-coded seams', cls: 'v3d', margin: 30});
}

/** Flat P01 and P02 pieces with the same colour coding and the matching u position on each. */
export function flatCoordView(p, uFrac) {
  const prims = [], by = id => p.pieces.find(pc => pc.id === id);
  const wrap = by('P01'), cap = by('P02'), u = uFrac * p.arc, gap = 40;
  const ox = 0, cx = wrap.size[0] + gap;
  const tr = (pts, dx) => pts.map(([x, y]) => [x + dx, y]);
  prims.push({kind: 'path', close: true, pts: tr(wrap.outline, ox), attrs: 'fill="#f7f9fc" stroke="#111" stroke-width="0.8"'});
  for (const e of wrap.edges) prims.push({kind: 'path', pts: tr(e.pts, ox), attrs: `fill="none" stroke="${COLORS[e.id]}" stroke-width="2.6" data-edge="${e.id}"`});
  prims.push({kind: 'path', close: true, pts: tr(cap.outline, cx), attrs: 'fill="#f7f9fc" stroke="#111" stroke-width="0.8"'});
  for (const e of cap.edges) prims.push({kind: 'path', pts: tr(e.pts, cx), attrs: `fill="none" stroke="${e.id === 'capSeam' ? COLORS.seamFront : COLORS[e.id]}" stroke-width="2.6" data-edge="${e.id === 'capSeam' ? 'seamFront seamRear' : e.id}"`});
  const x = wrap.hem + u;
  prims.push({kind: 'path', pts: [[x, wrap.seam], [x, wrap.size[1] - wrap.seam]], attrs: `fill="none" stroke="${COLORS.ugen}" stroke-width="2"`});
  const [cu, cv] = profileAt(cap.stitchUV, p.arc, u);
  prims.push({kind: 'circle', at: [cu - cap.origin.u + cx, cap.origin.v - cv], r: 4, attrs: `fill="${COLORS.ugen}"`});
  for (const yy of [wrap.seam, wrap.size[1] - wrap.seam]) prims.push({kind: 'circle', at: [x, yy], r: 4, attrs: `fill="${COLORS.ugen}"`});
  prims.push({kind: 'text', at: [wrap.hem + 2, wrap.size[1] / 2], text: 'outer hem (u = 0)', attrs: `fill="${COLORS.hem}" transform="rotate(-90 ${f(wrap.hem + 2)} ${f(wrap.size[1] / 2)})" text-anchor="middle" dy="-4"`, size: 0.8});
  const [ou, ov] = cap.stitchUV[0];
  prims.push({kind: 'text', at: [ou - cap.origin.u + cx, cap.origin.v - ov + 14], text: 'outer (u = 0)', attrs: `fill="${COLORS.hem}" text-anchor="middle"`, size: 0.8});
  prims.push({kind: 'text', at: [0, -12], text: `P01 shell wrap ${f(wrap.size[0])} × ${f(wrap.size[1])} (cut)`, attrs: 'fill="#222"'});
  prims.push({kind: 'text', at: [cx, -12], text: `P02 shell cap ${f(cap.size[0])} × ${f(cap.size[1])}`, attrs: 'fill="#222"'});
  prims.push({kind: 'text', at: [0, wrap.size[1] + 18], text: `u = ${f(u)} of ${f(p.arc)} mm along both seam lines`, attrs: `fill="${COLORS.ugen}"`});
  prims.push({kind: 'text', at: [0, wrap.size[1] + 34], text: 'Wrap top edge = rear cap seam, bottom edge = front cap seam; both sew to the same cap curve.', attrs: 'fill="#555"', size: 0.85});
  return render(prims, {title: 'Flat pattern with matching seams', cls: 'vflat', margin: 25});
}

/** Small cross-section for shape comparison. */
export function shapeThumb(p, hand) {
  return canopySectionView(p, hand);
}

/** Schematic of a mounting mechanism in the canopy's side plane (w along rail, v up). */
export function mountThumb(p, place, id) {
  const prims = [], L = p.length, rh = p.railHeight, top = p.height, hem = -p.drop, S = ([w, v]) => [w, -v];
  const fg = Math.max(0, place.frontGap), rg = Math.max(0, place.rearGap);
  const ext = id === 'cord' ? [-(L / 2 + Math.min(rg, 140)), L / 2 + Math.min(fg, 140)] : [-L / 2 - 50, L / 2 + 50];
  prims.push({kind: 'path', pts: [[ext[0], rh], [ext[1], rh]].map(S), attrs: `stroke="${COLORS.frame}" stroke-width="${p.tube}" stroke-linecap="round" fill="none"`});
  prims.push({kind: 'path', close: true, pts: [[-L / 2, hem], [-L / 2, top], [L / 2, top], [L / 2, hem]].map(S), attrs: `fill="${COLORS.shell}" fill-opacity="0.2" stroke="${COLORS.shell}"`});
  const c = p.notchRadius;
  for (const sg of [-1, 1]) {
    const w = sg * L / 2;
    if (id === 'tabs') prims.push({kind: 'path', close: true, pts: [[w - sg * (p.strapWidth + 4), rh - c - 3], [w - sg * 4, rh - c - 3], [w - sg * 4, rh + c + 3], [w - sg * (p.strapWidth + 4), rh + c + 3]].map(S), attrs: 'fill="#555" fill-opacity="0.7"'});
    if (id === 'flap') prims.push({kind: 'path', pts: [[w, rh - c - 4], [w, hem - 6]].map(S), attrs: `stroke="${COLORS.notch}" stroke-width="7" fill="none"`});
    if (id === 'clips') prims.push({kind: 'circle', at: S([w - sg * 6, rh]), r: c + 3, attrs: 'fill="none" stroke="#222" stroke-width="3"'});
    if (id === 'cord') {
      const end = sg > 0 ? L / 2 + Math.min(fg, 140) : -(L / 2 + Math.min(rg, 140));
      prims.push({kind: 'path', pts: [[w, rh + 6], [end, rh + 2]].map(S), attrs: `stroke="${COLORS.lining}" stroke-width="3" fill="none"`});
      prims.push({kind: 'circle', at: S([end, rh]), r: 5, attrs: `fill="${COLORS.lining}"`});
    }
  }
  prims.push({kind: 'text', at: S([-L / 2, top + 12]), text: 'rear', attrs: 'fill="#666"'});
  prims.push({kind: 'text', at: S([L / 2, top + 12]), text: 'front', attrs: 'fill="#666" text-anchor="end"'});
  return render(prims, {title: `Mounting: ${id}`, cls: 'vthumb', margin: 15, font: 14});
}
