import test from 'node:test';import assert from 'node:assert/strict';import {pattern,svg} from '../src/geometry.mjs';
test('matching stitch lengths and cut allowances',()=>{for(const radius of [40,65,90]){const p=pattern({radius});assert.equal(p.arc,Math.PI*radius);assert.equal(p.wrapWidth-2*p.seam,p.arc);assert.equal(p.wrapLength-2*p.seam,p.length)}});
test('strap circumference and overlap',()=>{const p=pattern();assert.equal(p.strapLength,Math.PI*p.tube+p.overlap)});
test('reject invalid dimensions',()=>{assert.throws(()=>pattern({radius:0}));assert.throws(()=>pattern({seam:80}));assert.throws(()=>pattern({length:NaN}))});
test('physical SVG units and calibration',()=>{const out=svg(pattern());assert.match(out,/width="[\d.]+mm"/);assert.match(out,/width="50" height="50"/)});
