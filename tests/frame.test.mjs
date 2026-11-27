import test from 'node:test';
import assert from 'node:assert/strict';
import {frameModel, placeCanopy, FIIDO_FRAME} from '../src/frame.mjs';
import {pattern} from '../src/geometry.mjs';

const m = frameModel();
const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('fitted frame reproduces the labelled manufacturer envelope', () => {
  close(m.envelope.length, 637, 2);
  close(m.envelope.height, 315, 1);
  close(m.envelope.xMin, 0, 1);
});

test('rail spacing matches labelled widths (centre-to-centre assumption)', () => {
  close(m.rails.left.start[1] - m.rails.right.start[1], FIIDO_FRAME.upperWidth, 1e-9);
  close(2 * m.halfWidthAt(FIIDO_FRAME.side.rearBottom[1]), FIIDO_FRAME.lowerWidth, 1e-9);
  close(m.mounts[2][0] - m.mounts[0][0], FIIDO_FRAME.mountSpacing, 1e-9);
});

test('top rails are straight, horizontal and long enough for the default canopy', () => {
  for (const r of Object.values(m.rails)) {
    close(r.start[2], r.end[2], 1e-9);
    assert.ok(r.length > 400);
  }
  assert.ok(placeCanopy(m, pattern(), {position: 150}).fits);
  assert.ok(!placeCanopy(m, pattern(), {position: 50}).fits);
});

test('canopy placement puts the rail axis on the frame rail for any roll', () => {
  const p = pattern({railHeight: 12});
  for (const roll of [0, 22.8, -30]) {
    const pl = placeCanopy(m, p, {side: 'right', position: 200, roll});
    const q = pl.toWorld(0, p.railHeight, 40);
    close(q[1], m.rails.right.start[1], 1e-9);
    close(q[2], m.rails.right.start[2], 1e-9);
  }
  // Positive roll tilts the canopy top outward on both sides.
  const l = placeCanopy(m, pattern(), {side: 'left', roll: 20}).toWorld(0, 65, 0);
  const r = placeCanopy(m, pattern(), {side: 'right', roll: 20}).toWorld(0, 65, 0);
  assert.ok(l[1] > m.rails.left.start[1] && r[1] < m.rails.right.start[1]);
});
