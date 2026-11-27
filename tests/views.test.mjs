import test from 'node:test';
import assert from 'node:assert/strict';
import {pattern} from '../src/geometry.mjs';
import {frameModel, placeCanopy} from '../src/frame.mjs';
import {camera, VIEWS} from '../src/project.mjs';
import * as v from '../src/views.mjs';
import {MOUNTS, compareShapes} from '../src/variants.mjs';

const m = frameModel(), hand = {width: 60, above: 45, below: 45};
const shapes = [{}, {drop: 35}, {radius: 80, height: 50, drop: 25, railHeight: 10}];
const valid = s => { assert.match(s, /^<svg [^>]*viewBox="[-\d. ]+"/); assert.doesNotMatch(s, /NaN|undefined|Infinity/); };

test('every view renders valid SVG for several shapes and installations', () => {
  for (const s of shapes) for (const inst of [{position: 150, roll: 0, sides: 'both'}, {position: 250, roll: 22.8, sides: 'left'}]) {
    const p = pattern(s), place = placeCanopy(m, p, {...inst, side: 'left'});
    for (const k of Object.keys(VIEWS)) valid(v.installedView(m, p, inst, camera(VIEWS[k]), {station: 400}));
    for (const w of ['side', 'rear', 'top']) valid(v.orthoView(m, p, inst, w));
    for (const x of [50, 300, 400, 540]) valid(v.frameSectionView(m, p, inst, x, hand));
    valid(v.canopySectionView(p, hand));
    for (const e of [0, 1]) valid(v.explodedView(p, camera({yaw: 35, pitch: 22}), e));
    for (const u of [0, 0.5, 1]) { valid(v.assembledCoordView(p, camera(VIEWS.iso), u)); valid(v.flatCoordView(p, u)); }
    for (const mt of MOUNTS) { valid(v.mountThumb(p, place, mt.id)); assert.ok(mt.parts(p, place).length); }
  }
});

test('coordinated views tag matching seams on both sides', () => {
  const p = pattern();
  const a = v.assembledCoordView(p, camera(VIEWS.iso), 0.3), f = v.flatCoordView(p, 0.3);
  for (const id of ['seamFront', 'seamRear', 'hem']) { assert.match(a, new RegExp(`data-edge="${id}"`)); assert.match(f, new RegExp(`data-edge="${id}"`)); }
  assert.match(f, /data-edge="seamFront seamRear"/);
});

test('shape comparison yields metrics or a readable error per variant', () => {
  const rows = compareShapes(pattern(), hand);
  assert.equal(rows.length, 5);
  for (const r of rows) assert.ok(r.error || Number.isFinite(r.wrapWidth));
});
