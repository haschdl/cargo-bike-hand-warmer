import test from 'node:test';
import assert from 'node:assert/strict';
import {pattern, svg, halfEllipseLength, profilePoints, polylineLength, distanceToPolyline, handClearance, finishedCapOutline, profileAt} from '../src/geometry.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const piece = (p, id) => p.pieces.find(pc => pc.id === id);

// Original milestone-1 tests (unchanged behaviour for the semicircle).
test('matching stitch lengths and cut allowances', () => {
  for (const radius of [40, 65, 90]) {
    const p = pattern({radius});
    assert.equal(p.arc, Math.PI * radius);
    assert.equal(p.wrapWidth - 2 * p.seam, p.arc);
    assert.equal(p.wrapLength - 2 * p.seam, p.length);
  }
});
test('strap circumference and overlap', () => { const p = pattern(); assert.equal(p.strapLength, Math.PI * p.tube + p.overlap); });
test('reject invalid dimensions', () => {
  assert.throws(() => pattern({radius: 0}));
  assert.throws(() => pattern({seam: 80}));
  assert.throws(() => pattern({length: NaN}));
});
test('physical SVG units and calibration', () => {
  const out = svg(pattern());
  assert.match(out, /width="[\d.]+mm"/);
  assert.match(out, /width="50" height="50"/);
});

// Extended geometry.
test('half-ellipse length matches Ramanujan II and the circle limit', () => {
  assert.equal(halfEllipseLength(65, 65), Math.PI * 65);
  for (const [a, b] of [[80, 55], [50, 90], [65, 64.9]]) {
    const hh = ((a - b) / (a + b)) ** 2;
    const ram = Math.PI * (a + b) * (1 + 3 * hh / (10 + Math.sqrt(4 - 3 * hh))) / 2;
    close(halfEllipseLength(a, b), ram, 1e-6 * ram, 'ellipse');
  }
});

test('wrap cap-seam edges equal the cap stitch curve for every shape', () => {
  for (const s of [{}, {drop: 35}, {radius: 80, height: 50, drop: 25}, {radius: 55, height: 80, drop: 20}]) {
    const p = pattern(s);
    const wrap = piece(p, 'P01'), cap = piece(p, 'P02');
    assert.equal(wrap.edges.find(e => e.id === 'seamFront').length, p.arc);
    close(cap.edges.find(e => e.id === 'capSeam').length, p.arc, 2e-4 * p.arc, 'shell cap');
    close(piece(p, 'P02L').edges.find(e => e.id === 'capSeam').length, p.liningArc, 2e-4 * p.arc, 'lining cap');
  }
});

test('lining is the inner parallel curve: length shrinks by π·t', () => {
  const p = pattern({radius: 80, height: 50, drop: 10, lining: 6});
  assert.equal(p.liningArc, p.arc - Math.PI * 6);
  close(polylineLength(profilePoints(p, -6, 2000)), p.liningArc, 0.01, 'sampled lining');
  assert.equal(piece(p, 'P01L').size[1], p.length - 12 + 2 * p.seam);
  const same = pattern({lining: 0});
  assert.deepEqual(piece(same, 'P01L').size, piece(same, 'P01').size);
});

test('cap cut line sits one seam allowance outside the stitch curve', () => {
  const p = pattern({radius: 80, height: 50, drop: 20, seam: 12});
  const cap = piece(p, 'P02'), dense = profilePoints(p, 0, 4000);
  for (const pt of profilePoints(p, 12, 90)) close(distanceToPolyline(pt, dense), 12, 0.02, 'offset');
  // Hem allowance below the open edge.
  assert.equal(Math.min(...cap.outlineUV.map(q => q[1])), -20 - p.hem);
});

test('semicircle cap keeps the original cut radius R and the hem allowance', () => {
  const p = pattern();
  const cap = piece(p, 'P02');
  assert.equal(p.R, p.radius + p.seam);
  close(cap.size[0], 2 * p.R, 1e-9);
  close(cap.size[1], p.R + p.hem, 1e-9);
});

test('rail notch passes the tube with clearance and is validated', () => {
  const p = pattern({tube: 20, clearance: 3});
  assert.equal(p.notchRadius, 13);
  const notch = piece(p, 'P02').edges.find(e => e.id === 'notch');
  assert.ok(notch.pts.length > 10);
  assert.throws(() => pattern({tube: 120}), /notch/);
  assert.throws(() => pattern({railHeight: -5}), /hem/);
  assert.throws(() => pattern({radius: 90, height: 20, lining: 10}), /curvature/);
});

test('finished cap outline contains the rail notch and is closed', () => {
  const p = pattern({drop: 30, railHeight: 10});
  const o = finishedCapOutline(p);
  assert.ok(o.some(([u, v]) => Math.abs(u) < 1e-9 && Math.abs(v - (10 + p.notchRadius)) < 1e-9));
});

test('profileAt maps arc length to the profile and hangs straight beyond the ends', () => {
  const p = pattern(), prof = profilePoints(p, 0, 720);
  const top = profileAt(prof, p.arc, p.arc / 2);
  close(top[0], 0, 0.05); close(top[1], p.height, 0.05);
  assert.deepEqual(profileAt(prof, p.arc, -5), [p.radius, -5]);
});

test('hand clearance: positive when the envelope fits, negative when it hits the lining', () => {
  const p = pattern();
  const ok = handClearance(p, {width: 60, above: 45, below: 45});
  close(ok.clearance, p.radius - p.lining - Math.hypot(30, 45), 0.05, 'corner distance');
  assert.equal(ok.exposed, 45);
  assert.ok(handClearance(p, {width: 60, above: 70, below: 10}).clearance < 0);
  assert.equal(handClearance(pattern({drop: 50}), {width: 60, above: 45, below: 45}).exposed, 0);
});

test('printable SVG contains every piece outline with no invalid numbers', () => {
  const out = svg(pattern({radius: 80, height: 50, drop: 25}));
  for (const id of ['P01', 'P02', 'P01L', 'P02L', 'P03']) assert.match(out, new RegExp(`${id} `));
  assert.doesNotMatch(out, /NaN|undefined|Infinity/);
});
