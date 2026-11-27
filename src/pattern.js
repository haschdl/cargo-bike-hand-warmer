// Sewing-pattern geometry for the passenger hand warmer. Pure functions, no DOM.
// Classic script (no modules) so index.html works when opened directly from disk.
// Exposes globalThis.SewingPattern.
//
// Cross-section coordinates: u lateral (mm), v up (mm), origin at the rail centre.
// The canopy wall is a semicircle of radius r around the rail, with optional straight
// skirts of depth `drop` below the rail. All lower edges are open and bound (no allowance).
(function () {
  'use strict';

  /** Measurement form defaults. Every value is a placeholder until measured on the bike. */
  const DEFAULTS = Object.freeze({
    tube: 16,        // rail tube diameter (estimated from manufacturer images)
    length: 180,     // hand-warmer length along the rail
    fistWidth: 60,   // gloved fist thickness across the rail
    fistAbove: 40,   // gloved knuckles above the top of the tube
    lining: 4,       // lining thickness, lightly pressed
    skirt: 0,        // skirt depth below the rail centre (0 = none)
    seam: 10,        // seam allowance on sewn edges
    ease: 10,        // extra room around the hand
    webbing: 25,     // webbing and hook-and-loop width
  });

  /** Fixed construction constants (not user settings). */
  const CONSTANTS = Object.freeze({
    notchClearance: 2, // rail notch radius = tube / 2 + this
    tabAnchor: 20,     // webbing sewn to the end cap
    tabOverlap: 35,    // hook-and-loop overlap
  });

  const RANGES = {
    tube: [8, 60, 'Rail tube diameter'], length: [80, 500, 'Hand-warmer length'],
    fistWidth: [30, 150, 'Gloved fist thickness'], fistAbove: [10, 120, 'Knuckle height above tube'],
    lining: [0, 20, 'Lining thickness'], skirt: [0, 100, 'Skirt depth'], seam: [5, 20, 'Seam allowance'],
    ease: [0, 40, 'Extra room'], webbing: [10, 50, 'Webbing width'],
  };

  function validateMeasurements(m) {
    for (const [k, [lo, hi, label]] of Object.entries(RANGES)) {
      const v = m[k];
      if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(`${label} must be between ${lo} and ${hi} mm.`);
    }
  }

  /** Canopy radius: the gloved-fist corner plus ease plus lining, rounded up to a whole millimetre. */
  function radiusFor(m) {
    return Math.ceil(Math.hypot(m.fistWidth / 2, m.tube / 2 + m.fistAbove) + m.ease + m.lining);
  }

  /** Semicircle (radius r + o) with optional skirts, from the outer hem (+u) over the top to the inner hem. */
  function profilePoints(r, drop, o = 0, n = 180) {
    const R = r + o, pts = [];
    if (drop > 0) pts.push([R, -drop]);
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * i / n;
      pts.push([R * Math.cos(t), R * Math.sin(t)]);
    }
    if (drop > 0) pts.push([-R, -drop]);
    return pts;
  }

  function polylineLength(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return l;
  }

  function polygonArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }

  function wrapPiece(id, name, cut, seamLength, length, s, drop) {
    const W = seamLength, H = length + 2 * s;
    const marks = [W / 2];
    if (drop > 0) marks.push(drop, W - drop);
    return {
      id, name, cut, kind: 'wrap', width: W, height: H, seamLength, length,
      outline: [[0, 0], [W, 0], [W, H], [0, H]],
      stitch: [[[0, s], [W, s]], [[0, H - s], [W, H - s]]],
      // Matching marks (small notches into the seam allowance) on both cap-seam edges.
      marks: marks.flatMap(x => [[[x, 0], [x, Math.min(4, s / 2)]], [[x, H], [x, H - Math.min(4, s / 2)]]]),
      grain: [[W * 0.25, s + 12], [W * 0.25, H - s - 12]],
      edges: {capSeam: seamLength, bound: 2 * length},
    };
  }

  function capPiece(id, name, cut, r, drop, s, c) {
    const R = r + s;
    const notch = [];
    for (let i = 0; i <= 36; i++) {
      const t = Math.PI * (1 - i / 36);
      notch.push([c * Math.cos(t), c * Math.sin(t)]);
    }
    const uv = [];
    const push = q => { const l = uv[uv.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-9) uv.push(q); };
    push([R, -drop]);
    for (const q of profilePoints(r, 0, s)) push(q);
    push([-R, -drop]);
    push([-c, -drop]);
    for (const q of notch) push(q);
    push([c, -drop]);
    const toFlat = ([u, v]) => [u + R, R - v];
    const stitch = profilePoints(r, drop, 0);
    const marks = [[toFlat([0, R]), toFlat([0, R - Math.min(4, s / 2)])]];
    if (drop > 0) for (const sg of [1, -1]) marks.push([toFlat([sg * R, 0]), toFlat([sg * (R - Math.min(4, s / 2)), 0])]);
    return {
      id, name, cut, kind: 'cap', width: 2 * R, height: R + drop, radius: r, notchRadius: c,
      outline: uv.map(toFlat), outlineUV: uv, stitchUV: stitch,
      stitch: [stitch.map(toFlat)],
      marks, grain: [toFlat([-R * 0.45, R * 0.75]), toFlat([-R * 0.45, R * 0.15])],
      edges: {capSeam: polylineLength(stitch), bound: 2 * (R - c) + 2 * drop + Math.PI * c},
      toFlat,
    };
  }

  function tabPiece(tube, webbing) {
    const {tabAnchor: a, tabOverlap: o} = CONSTANTS;
    const L = a + Math.PI * tube + o;
    return {
      id: 'P03', name: 'Webbing tab', cut: {webbing: 4}, kind: 'tab', width: L, height: webbing, anchor: a, overlap: o,
      outline: [[0, 0], [L, 0], [L, webbing], [0, webbing]],
      stitch: [[[a, 0], [a, webbing]], [[L - o, 0], [L - o, webbing]]], marks: [], grain: null,
      edges: {},
    };
  }

  /** Build all pattern pieces from plain measurements. Throws an Error with a readable message. */
  function pattern(input = {}) {
    const m = {...DEFAULTS, ...input};
    validateMeasurements(m);
    const r = radiusFor(m), t = m.lining, s = m.seam, drop = m.skirt, L = m.length;
    const c = m.tube / 2 + CONSTANTS.notchClearance;
    if (L < 2 * m.webbing + 40) throw new Error('The hand warmer is too short for two webbing tabs.');
    const seamLength = Math.PI * r + 2 * drop;
    const liningSeamLength = Math.PI * (r - t) + 2 * drop; // inner parallel curve: π·t shorter
    const pieces = [
      wrapPiece('P01', 'Shell wrap', {shell: 2}, seamLength, L, s, drop),
      capPiece('P02', 'Shell end cap', {shell: 4}, r, drop, s, c),
      wrapPiece('P04', 'Lining wrap', {lining: 2}, liningSeamLength, L - 2 * t, s, drop),
      capPiece('P05', 'Lining end cap', {lining: 4}, r - t, drop, s, c),
      tabPiece(m.tube, m.webbing),
    ];
    for (const pc of pieces) pc.area = polygonArea(pc.outline);
    return {m, radius: r, liningRadius: r - t, notchRadius: c, seamLength, liningSeamLength, pieces,
      clearance: clearance(m, r)};
  }

  /** Radial clearance between the gloved-fist corner and the lining, and side clearance. */
  function clearance(m, r) {
    const inner = r - m.lining;
    return {radial: inner - Math.hypot(m.fistWidth / 2, m.tube / 2 + m.fistAbove), side: inner - m.fistWidth / 2};
  }

  /** Shelf packing of rectangles {w, h} into a strip of the given width. Returns positions and height. */
  function shelfPack(items, width, gap = 10) {
    let x = 0, y = 0, rowH = 0;
    const pos = items.map(it => {
      if (x > 0 && x + it.w > width) { x = 0; y += rowH + gap; rowH = 0; }
      const p = {x, y};
      x += it.w + gap;
      rowH = Math.max(rowH, it.h);
      return p;
    });
    return {pos, height: y + rowH};
  }

  /** Material list for one pair of hand warmers. Lengths in mm, areas in cm². */
  function materials(p) {
    const by = id => p.pieces.find(pc => pc.id === id);
    const fabricFor = (wrap, cap) => {
      const items = [wrap, wrap, cap, cap, cap, cap].map(pc => ({w: pc.width, h: pc.height}));
      const width = Math.max(500, wrap.width);
      return {width, height: shelfPack(items, width).height, area: (2 * wrap.area + 4 * cap.area) / 100};
    };
    const tab = by('P03');
    const bindingPerCanopy = by('P01').edges.bound + 2 * by('P02').edges.bound;
    return {
      shell: fabricFor(by('P01'), by('P02')),
      lining: fabricFor(by('P04'), by('P05')),
      webbing: 4 * tab.width,
      hookAndLoop: 4 * CONSTANTS.tabOverlap,
      binding: Math.ceil(2 * bindingPerCanopy * 1.15 / 100) * 100,
      webbingWidth: p.m.webbing,
    };
  }

  globalThis.SewingPattern = Object.freeze({DEFAULTS, CONSTANTS, RANGES, pattern, profilePoints, polylineLength, polygonArea, shelfPack, materials, radiusFor});
})();
