// Pure 3D model of the Fiido T2 Family Add-on passenger frame and canopy placement. No DOM access.
//
// World axes (mm): x forward (toward the rider), y left, z up. Origin: x = rearmost outer point of the
// side loops, z = lowest outer point of the bottom rails, y = bike centreline.
//
// Every value below is an ESTIMATE from manufacturer marketing images (see docs/design.md). Only the
// labelled envelope dimensions (637, 315, 355, 104, 384, 48 mm) appear in the images; how they are
// measured (outer edge vs tube centreline) is not stated. Measure the real frame before cutting.

export const FIIDO_FRAME = Object.freeze({
  tube: 16,          // est.: 18 px tube width in the side drawing at 0.895 mm/px
  bendRadius: 25,    // est.: centreline bend radius of the loop corners
  upperWidth: 355,   // labelled; assumed top-rail centre-to-centre
  lowerWidth: 104,   // labelled; read as bottom-rail centre-to-centre (side loops lean outward)
  mountSpacing: 384, // labelled; longitudinal spacing of mounting tabs
  mountLateral: 48,  // labelled; lateral spacing of tab holes
  // Side-projection tube-centreline corner intersections (before bending), fitted to the 637 × 315 mm drawing.
  side: {rearBottom: [113, 8], frontBottom: [635.5, 8], frontTop: [567, 307], rearTop: [-4, 307]},
  cross: [
    {id: 'rearUpper', leg: 'rear', z: 194, confidence: 'medium', note: 'visible in plan photo and perspective drawing'},
    {id: 'frontUpper', leg: 'front', z: 194, confidence: 'low', note: 'suggested by perspective drawing; height not measurable'},
    {id: 'frontLower', leg: 'bottomFront', confidence: 'low', note: 'suggested by plan photo'},
  ],
  cushion: {x0: 119, x1: 609, top: 39, width: 160, note: 'length and height from side drawing; width assumed'},
});

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map(v => v * k);
const len = a => Math.hypot(...a);
const unit = a => mul(a, 1 / len(a));

/** Rounded closed loop through 2D corners with centreline bend radius r. Returns points and tangent points per corner. */
export function filletLoop(corners, r, steps = 12) {
  const pts = [], tangents = [];
  for (let i = 0; i < corners.length; i++) {
    const P = corners[i], A = corners[(i + corners.length - 1) % corners.length], B = corners[(i + 1) % corners.length];
    const u1 = unit(sub(A, P)), u2 = unit(sub(B, P));
    const half = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) / 2;
    const t = r / Math.tan(half);
    const T1 = add(P, mul(u1, t)), T2 = add(P, mul(u2, t));
    const C = add(P, mul(unit(add(u1, u2)), r / Math.sin(half)));
    let a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]), a2 = Math.atan2(T2[1] - C[1], T2[0] - C[0]);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= steps; k++) pts.push([C[0] + r * Math.cos(a1 + da * k / steps), C[1] + r * Math.sin(a1 + da * k / steps)]);
    tangents.push({T1, T2});
  }
  return {pts, tangents};
}

export function frameModel(cfg = FIIDO_FRAME) {
  const {rearBottom, frontBottom, frontTop, rearTop} = cfg.side;
  const zb = rearBottom[1], zt = rearTop[1];
  const halfWidthAt = z => cfg.lowerWidth / 2 + (cfg.upperWidth - cfg.lowerWidth) / 2 * (z - zb) / (zt - zb);
  const to3 = ([x, z], sgn) => [x, sgn * halfWidthAt(z), z];
  const loop = filletLoop([rearBottom, frontBottom, frontTop, rearTop], cfg.bendRadius);
  const [, , fT, rT] = loop.tangents;
  const tubes = [], rails = {};
  for (const [side, sgn] of [['left', 1], ['right', -1]]) {
    tubes.push({id: `${side}Loop`, pts: [...loop.pts, loop.pts[0]].map(p => to3(p, sgn)), confidence: 'medium'});
    const start = to3(fT.T2, sgn), end = to3(rT.T1, sgn);
    rails[side] = {start, end, length: len(sub(end, start)), dir: unit(sub(end, start)), sgn};
  }
  const legAt = (bottom, top, z) => bottom[0] + (top[0] - bottom[0]) * (z - bottom[1]) / (top[1] - bottom[1]);
  for (const c of cfg.cross) {
    let a, b;
    if (c.leg === 'rear' || c.leg === 'front') {
      const x = c.leg === 'rear' ? legAt(rearBottom, rearTop, c.z) : legAt(frontBottom, frontTop, c.z);
      a = to3([x, c.z], 1); b = to3([x, c.z], -1);
    } else {
      const x = loop.tangents[1].T1[0];
      a = to3([x, zb], 1); b = to3([x, zb], -1);
    }
    tubes.push({id: c.id, pts: [a, b], confidence: c.confidence});
  }
  const xs = loop.pts.map(p => p[0]), zs = loop.pts.map(p => p[1]);
  const r = cfg.tube / 2;
  const envelope = {
    length: Math.max(...xs) - Math.min(...xs) + 2 * r,
    height: Math.max(...zs) - Math.min(...zs) + 2 * r,
    xMin: Math.min(...xs) - r, xMax: Math.max(...xs) + r, zMin: Math.min(...zs) - r, zMax: Math.max(...zs) + r,
  };
  const inclination = Math.atan2((cfg.upperWidth - cfg.lowerWidth) / 2, zt - zb);
  const mid = (loop.tangents[0].T2[0] + loop.tangents[1].T1[0]) / 2;
  const mounts = [];
  for (const dx of [-cfg.mountSpacing / 2, cfg.mountSpacing / 2])
    for (const sgn of [1, -1]) mounts.push([mid + dx, sgn * cfg.mountLateral / 2, zb]);
  return {cfg, tubes, rails, envelope, inclination, halfWidthAt, mounts, sideLoop: loop.pts, cushion: cfg.cushion};
}

/**
 * Pose of one canopy on a top rail. `position` = distance from the front end of the straight rail to the
 * canopy centre; `roll` (degrees) tilts the canopy's up axis outward about the rail.
 * Returns a mapping from canopy-local (u, v, w) to world, with u outward, v up (from the profile centre)
 * and w forward along the rail (w = 0 at the canopy centre).
 */
export function placeCanopy(model, p, {side = 'left', position = 150, roll = 0} = {}) {
  const rail = model.rails[side];
  const fwd = mul(rail.dir, -1); // rail runs front → rear
  const centre = add(rail.start, mul(rail.dir, position));
  const th = roll * Math.PI / 180;
  const out = [0, rail.sgn, 0], upW = [0, 0, 1];
  const up = add(mul(upW, Math.cos(th)), mul(out, Math.sin(th)));
  const outR = sub(mul(out, Math.cos(th)), mul(upW, Math.sin(th)));
  const toWorld = (u, v, w) => add(add(add(centre, mul(fwd, w)), mul(outR, u)), mul(up, v - p.railHeight));
  const frontGap = position - p.length / 2, rearGap = rail.length - position - p.length / 2;
  return {side, centre, toWorld, fits: frontGap >= 0 && rearGap >= 0, frontGap, rearGap, rail};
}
