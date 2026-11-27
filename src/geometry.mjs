// Pure geometry and printable SVG for the passenger hand-warmer canopy. No DOM access.
//
// Cross-section / end-cap coordinates: u lateral (mm, +u = outward from the bike centreline),
// v up (mm), origin at the profile centre. The shell stitch profile is a half-ellipse with
// semi-axes `radius` (u) and `height` (v), plus optional straight skirts of length `drop`
// below the centre line. radius = height and drop = 0 reproduce the original semicircle.
// The rail axis runs along the canopy at (0, railHeight).

const LIMIT = 1000;
const SAMPLES = 180;

export const DEFAULTS = Object.freeze({
  length: 180, radius: 65, height: 65, drop: 0, railHeight: 0,
  seam: 10, hem: 10, tube: 16, clearance: 2, overlap: 35, strapWidth: 25, lining: 4,
});

/** Length of half an ellipse with semi-axes a, b (one side of the major or minor axis). */
export function halfEllipseLength(a, b) {
  if (a === b) return Math.PI * a;
  // The integrand has period π, so the trapezoidal rule over one period converges geometrically.
  const n = 512;
  let sum = 0;
  for (let k = 0; k < n; k++) {
    const t = Math.PI * k / n;
    sum += Math.hypot(a * Math.sin(t), b * Math.cos(t));
  }
  return sum * Math.PI / n;
}

/**
 * Sampled profile from the outer hem (+u) over the top to the inner hem (-u), offset along the
 * outward normal by `offset` (negative = inward). Offsets of the half-ellipse are exact parallel
 * curves evaluated at the samples; they are valid while |offset| is below the minimum curvature radius.
 */
export function profilePoints(p, offset = 0, n = SAMPLES) {
  const {radius: a, height: b, drop} = p;
  const pts = [];
  if (drop > 0) pts.push([a + offset, -drop]);
  for (let i = 0; i <= n; i++) {
    const t = Math.PI * i / n, c = Math.cos(t), s = Math.sin(t);
    const nx = b * c, ny = a * s, nl = Math.hypot(nx, ny);
    pts.push([a * c + offset * nx / nl, b * s + offset * ny / nl]);
  }
  if (drop > 0) pts.push([-a - offset, -drop]);
  return pts;
}

export function polylineLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function pointSegmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function distanceToPolyline(pt, pts) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, pointSegmentDistance(pt, pts[i - 1], pts[i]));
  return d;
}

export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point at arc length `u` along a profile polyline, scaled so the polyline total equals `total`.
 *  Beyond either end the profile continues straight down (the hem allowance hangs vertically). */
export function profileAt(pts, total, u) {
  const raw = polylineLength(pts), k = raw / total;
  if (u <= 0) return [pts[0][0], pts[0][1] + u];
  if (u >= total) { const e = pts[pts.length - 1]; return [e[0], e[1] - (u - total)]; }
  let target = u * k;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg) {
      const f = seg ? target / seg : 0;
      return [pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

function wrapPiece(id, name, cut, width, length, h, s) {
  const W = width + 2 * h, H = length + 2 * s;
  return {
    id, name, cut, kind: 'wrap', size: [W, H], width, length, hem: h, seam: s,
    outline: [[0, 0], [W, 0], [W, H], [0, H]],
    stitch: [[[h, s], [h + width, s], [h + width, s + length], [h, s + length], [h, s]]],
    edges: [
      {id: 'seamRear', label: 'Rear cap seam', pts: [[h, s], [h + width, s]], length: width},
      {id: 'seamFront', label: 'Front cap seam', pts: [[h, s + length], [h + width, s + length]], length: width},
      {id: 'hem', label: 'Outer hem (open lower edge)', pts: [[h, s], [h, s + length]], length},
      {id: 'hem', label: 'Inner hem (open lower edge)', pts: [[h + width, s], [h + width, s + length]], length},
    ],
    marks: [[[W / 2, 0], [W / 2, 3]], [[W / 2, H], [W / 2, H - 3]]],
    notes: [
      {at: [h + 3, s + length / 2], text: 'Hem edges (along rail): open bottom, bind or turn'},
      {at: [h + 3, s + 8], text: 'Cap seam edges: join end caps'},
    ],
  };
}

function capPiece(id, name, cut, p, o, c) {
  const {seam: s, hem: h, drop, railHeight: rh} = p;
  const stitchUV = profilePoints(p, o);
  const outerUV = profilePoints(p, o + s);
  const base = -drop - h, xo = p.radius + o + s, xi = p.radius + o;
  const notchArc = [];
  for (let i = 0; i <= 36; i++) {
    const t = Math.PI * (1 - i / 36);
    notchArc.push([c * Math.cos(t), rh + c * Math.sin(t)]);
  }
  const notchUV = [[-c, base], ...notchArc, [c, base]];
  const cutUV = [[xo, base], ...outerUV, [-xo, base], ...notchUV];
  const top = p.height + o + s;
  // Flat sheet coordinates: x = u + xo, y = top - v (y down).
  const toFlat = ([u, v]) => [u + xo, top - v];
  const hemL = [[-xi, -drop], [-c, -drop]], hemR = [[c, -drop], [xi, -drop]];
  return {
    id, name, cut, kind: 'cap', size: [2 * xo, top - base], origin: {u: -xo, v: top}, offset: o,
    outline: cutUV.map(toFlat),
    outlineUV: cutUV,
    stitchUV,
    stitch: [stitchUV.map(toFlat), hemL.map(toFlat), hemR.map(toFlat)],
    edges: [
      {id: 'capSeam', label: 'Cap seam (joins wrap front or rear edge)', pts: stitchUV.map(toFlat), length: polylineLength(stitchUV)},
      {id: 'hem', label: 'Hem fold line', pts: hemL.map(toFlat)},
      {id: 'hem', label: 'Hem fold line', pts: hemR.map(toFlat)},
      {id: 'notch', label: 'Rail notch: bound edge, cut on line', pts: notchUV.map(toFlat)},
    ],
    marks: [[toFlat([0, top]), toFlat([0, top - 3])]],
    notes: [{at: toFlat([-c - 2, base + 3]), text: 'Bind notch', anchor: 'end'}],
  };
}

function rectPiece(id, name, cut, W, H) {
  return {id, name, cut, kind: 'strap', size: [W, H], outline: [[0, 0], [W, 0], [W, H], [0, H]], stitch: [], edges: [], marks: [], notes: []};
}

export function pattern(input = {}) {
  const q = {...DEFAULTS, height: undefined, hem: undefined, ...input};
  q.height ??= q.radius;
  q.hem ??= q.seam;
  for (const k of ['length', 'radius', 'height', 'seam', 'hem', 'tube', 'overlap', 'strapWidth'])
    if (!Number.isFinite(q[k]) || q[k] <= 0 || q[k] > LIMIT) throw new Error(`${k} must be between 0 and ${LIMIT} mm`);
  for (const k of ['lining', 'drop', 'clearance'])
    if (!Number.isFinite(q[k]) || q[k] < 0 || q[k] > LIMIT) throw new Error(`${k} must be between 0 and ${LIMIT} mm`);
  if (!Number.isFinite(q.railHeight) || Math.abs(q.railHeight) > LIMIT) throw new Error('railHeight must be a finite distance in mm');
  const {length: L, radius: a, height: b, seam: s, hem: h, tube: d, lining: t, drop, railHeight: rh, clearance} = q;
  if (s >= a || t >= Math.min(a, b) || q.strapWidth * 2 >= L || 2 * t >= L) throw new Error('Invalid clearance or seam geometry');
  const minCurvatureRadius = Math.min(a * a / b, b * b / a);
  if (t >= minCurvatureRadius) throw new Error(`lining must be below the minimum profile curvature radius (${minCurvatureRadius.toFixed(1)} mm)`);
  if (rh < -drop) throw new Error('railHeight must not be below the open hem');
  const c = d / 2 + clearance;
  const liningWall = profilePoints(q, -t);
  if (distanceToPolyline([0, rh], liningWall) <= c) throw new Error('Rail notch does not fit inside the lining');

  const arc = halfEllipseLength(a, b) + 2 * drop;
  // Inner parallel curve at distance t: length shrinks by t × total tangent turning (π).
  const liningArc = arc - Math.PI * t;
  const liningLength = L - 2 * t;
  const strapLength = Math.PI * d + q.overlap;
  const pieces = [
    wrapPiece('P01', 'Shell wrap', {shell: 2}, arc, L, h, s),
    capPiece('P02', 'Shell end cap', {shell: 4}, q, 0, c),
    wrapPiece('P01L', 'Lining wrap', {lining: 2}, liningArc, liningLength, h, s),
    capPiece('P02L', 'Lining end cap', {lining: 4}, q, -t, c),
    rectPiece('P03', 'Webbing tab blank', {webbing: 4}, strapLength, q.strapWidth),
  ];
  for (const pc of pieces) pc.area = polygonArea(pc.outline);
  return {
    ...q, arc, R: a + s, strapLength, wrapWidth: arc + 2 * h, wrapLength: L + 2 * s,
    internalRadius: a - t, notchRadius: c, liningArc, liningLength,
    liningWrapWidth: liningArc + 2 * h, liningWrapLength: liningLength + 2 * s,
    minCurvatureRadius, pieces,
  };
}

/**
 * Clearance between a gloved-hand envelope and the lining wall in the cross-section.
 * The envelope is a rectangle centred laterally on the rail: `width` across, `above` and `below`
 * the rail centre. Only the part above the open hem can touch fabric; the rest is reported as exposed.
 */
export function handClearance(p, {width, above, below}) {
  const rh = p.railHeight, hem = -p.drop, hw = width / 2;
  const wall = profilePoints(p, -p.lining, 720);
  const top = rh + above, bottom = Math.max(rh - below, hem);
  const exposed = Math.max(0, hem - (rh - below));
  if (top <= hem) return {clearance: Infinity, exposed, top, bottom, hw};
  const rectDist = ([x, y]) => Math.hypot(Math.max(-hw - x, 0, x - hw), Math.max(bottom - y, 0, y - top));
  const eps = 1e-6;
  const corners = [[-hw, bottom + eps], [hw, bottom + eps], [hw, top], [-hw, top]];
  const inside = corners.every(pt => pointInPolygon(pt, wall));
  if (inside) return {clearance: Math.min(...wall.map(rectDist)), exposed, top, bottom, hw};
  let pen = 0.1;
  for (const [x, y] of wall) if (rectDist([x, y]) === 0) pen = Math.max(pen, Math.min(x + hw, hw - x, y - bottom, top - y));
  return {clearance: -pen, exposed, top, bottom, hw};
}

/** Finished (stitch-line) end-cap outline in (u, v), including the rail notch, for a wall offset `o`. */
export function finishedCapOutline(p, o = 0, n = SAMPLES) {
  const c = p.notchRadius ?? p.tube / 2 + p.clearance, rh = p.railHeight, drop = p.drop;
  const arc = [];
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI * (1 - i / 24);
    arc.push([c * Math.cos(t), rh + c * Math.sin(t)]);
  }
  return [...profilePoints(p, o, n), [-c, -drop], ...arc, [c, -drop]];
}

const f = n => +n.toFixed(2);
const pathOf = (pts, close) => 'M ' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ') + (close ? ' Z' : '');

/** Printable full-size SVG. Every outline is the exact polygon from `pattern()`; units are mm. */
export function svg(p) {
  const blocks = [];
  let y = 12;
  const width = Math.max(100, ...p.pieces.map(pc => pc.size[0] + 20));
  for (const pc of p.pieces) {
    const cut = Object.entries(pc.cut).map(([m, n]) => `${n} ${m}`).join(' + ');
    blocks.push(`<text x="10" y="${f(y)}">${pc.id} ${pc.name} — cut ${cut}</text>`);
    y += 5;
    blocks.push(`<g transform="translate(10 ${f(y)})"><path class="cut" d="${pathOf(pc.outline, true)}"/>` +
      pc.stitch.map(s => `<path class="stitch" d="${pathOf(s)}"/>`).join('') +
      pc.marks.map(m => `<path class="cut" d="${pathOf(m)}"/>`).join('') +
      pc.notes.map(n => `<text x="${f(n.at[0])}" y="${f(n.at[1])}"${n.anchor ? ` text-anchor="${n.anchor}"` : ''}>${n.text}</text>`).join('') + '</g>');
    y += pc.size[1] + 14;
  }
  blocks.push(`<rect class="cut" x="10" y="${f(y)}" width="50" height="50"/><text x="12" y="${f(y + 7)}">50 × 50 mm</text>`);
  const H = y + 70;
  blocks.push(`<text x="10" y="${f(H - 5)}">Prototype only — print at 100%. Seam ${p.seam} mm, hem ${p.hem} mm; notch edges bound, no allowance.</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}mm" height="${f(H)}mm" viewBox="0 0 ${f(width)} ${f(H)}">
 <style>text{font:4px sans-serif;fill:#222} .cut{fill:none;stroke:#111;stroke-width:.35}.stitch{fill:none;stroke:#555;stroke-width:.3;stroke-dasharray:2 1}</style>
 ${blocks.join('\n ')}</svg>`;
}
