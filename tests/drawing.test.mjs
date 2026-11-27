import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load.mjs';

const {SP, PD} = load();
const clean = s => assert.doesNotMatch(s, /NaN|undefined|Infinity/);

test('A4 pages: cover + tiles at true size, calibration square and scale bars', () => {
  for (const v of [{}, {skirt: 40, length: 300}]) {
    const p = SP.pattern(v), {pages, cols, rows} = PD.a4Pages(p);
    assert.equal(pages.length, 1 + cols * rows);
    for (const s of pages) { assert.match(s, /width="210mm" height="297mm" viewBox="0 0 210 297"/); assert.match(s, /50 mm check/); clean(s); }
    assert.match(pages[0], /<rect class="cut" x="0" y="0" width="50" height="50"\/>/);
  }
});

test('tiles cover the whole sheet and carry match marks on every join', () => {
  const p = SP.pattern({skirt: 40, length: 300}), sh = PD.bestSheet(p);
  assert.ok(sh.cols * PD.CW >= sh.width && sh.rows * PD.CH >= sh.height);
  const joins = (sh.cols - 1) * sh.rows + (sh.rows - 1) * sh.cols;
  const tile = PD.a4Pages(p).pages[1];
  assert.equal((tile.match(/fill="#fff" stroke="#111" stroke-width=".4"/g) || []).length, joins);
});

test('every piece and the calibration square appear on the sheet', () => {
  const s = PD.fullSizeSvg(SP.pattern());
  for (const id of ['P01', 'P02', 'P03', 'P04', 'P05']) assert.match(s, new RegExp(`${id} `));
  assert.match(s, /width="[\d.]+mm" height="[\d.]+mm"/);
  assert.match(s, /width="50" height="50"/);
  clean(s);
});

test('illustrations render without invalid numbers', () => {
  for (const v of [{}, {skirt: 40}, {tube: 30, lining: 10}]) {
    const p = SP.pattern(v);
    for (const s of [PD.sideView(p), PD.crossSection(p), PD.sheetPreview(p)]) { assert.match(s, /^<svg /); clean(s); }
  }
});
