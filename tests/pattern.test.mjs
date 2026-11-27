import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load.mjs';

const {SP} = load();
const close = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const piece = (p, id) => p.pieces.find(pc => pc.id === id);
const VARIANTS = [{}, {skirt: 30}, {tube: 22, lining: 8, seam: 12}, {fistWidth: 80, fistAbove: 60, ease: 0}];

test('canopy radius clears the gloved fist by the ease, rounded up', () => {
  const p = SP.pattern();
  assert.equal(p.radius, Math.ceil(Math.hypot(30, 8 + 40) + 10 + 4));
  for (const v of VARIANTS) {
    const q = SP.pattern(v);
    assert.ok(q.clearance.radial >= q.m.ease - 1e-9 && q.clearance.radial < q.m.ease + 1);
  }
});

test('wrap stitch lines match the end-cap stitch curve, shell and lining', () => {
  for (const v of VARIANTS) {
    const p = SP.pattern(v);
    close(piece(p, 'P02').edges.capSeam, piece(p, 'P01').seamLength, 2e-4 * p.seamLength, 'shell');
    close(piece(p, 'P05').edges.capSeam, piece(p, 'P04').seamLength, 2e-4 * p.seamLength, 'lining');
  }
});

test('lining follows the inner parallel curve: π·t shorter and 2t shorter along the rail', () => {
  const p = SP.pattern({lining: 6, skirt: 20});
  close(p.liningSeamLength, p.seamLength - Math.PI * 6, 1e-9);
  assert.equal(piece(p, 'P04').length, p.m.length - 12);
});

test('seam allowance only on sewn edges; open edges are bound with no allowance', () => {
  const p = SP.pattern({skirt: 25, seam: 12});
  const wrap = piece(p, 'P01'), cap = piece(p, 'P02');
  assert.equal(wrap.width, p.seamLength);              // long sides are bound
  assert.equal(wrap.height, p.m.length + 24);          // cap-seam edges carry the allowance
  close(Math.min(...cap.outlineUV.map(q => q[1])), -25, 1e-9); // cap base on the finished line
  for (const [u, v] of cap.outlineUV.filter(q => q[1] > 0 && Math.hypot(...q) > p.notchRadius + 1))
    close(Math.hypot(u, v), p.radius + 12, 1e-9, 'curve offset');
});

test('end caps have a rail notch of tube/2 + clearance', () => {
  const p = SP.pattern({tube: 20});
  assert.equal(p.notchRadius, 10 + SP.CONSTANTS.notchClearance);
  const top = piece(p, 'P02').outlineUV.filter(([u]) => Math.abs(u) < 1e-9).map(q => q[1]);
  assert.ok(top.some(v => Math.abs(v - p.notchRadius) < 1e-9));
});

test('match marks: centre on every cap-seam edge, plus skirt junctions when a skirt is used', () => {
  assert.equal(piece(SP.pattern(), 'P01').marks.length, 2);
  assert.equal(piece(SP.pattern({skirt: 20}), 'P01').marks.length, 6);
  assert.equal(piece(SP.pattern({skirt: 20}), 'P02').marks.length, 3);
});

test('webbing tab = anchor + rail circumference + overlap', () => {
  const p = SP.pattern({tube: 18});
  const {tabAnchor, tabOverlap} = SP.CONSTANTS;
  close(piece(p, 'P03').width, tabAnchor + Math.PI * 18 + tabOverlap, 1e-9);
});

test('measurement validation gives readable errors', () => {
  assert.throws(() => SP.pattern({tube: 0}), /Rail tube diameter/);
  assert.throws(() => SP.pattern({length: NaN}), /length/);
  assert.throws(() => SP.pattern({skirt: -1}), /Skirt/);
  assert.throws(() => SP.pattern({length: 80, webbing: 25}), /too short/);
});

test('materials are finite and cover all pieces', () => {
  const p = SP.pattern({skirt: 30}), m = SP.materials(p);
  for (const v of [m.shell.width, m.shell.height, m.lining.height, m.webbing, m.binding]) assert.ok(Number.isFinite(v) && v > 0);
  close(m.shell.area, (2 * piece(p, 'P01').area + 4 * piece(p, 'P02').area) / 100, 1e-9);
});
