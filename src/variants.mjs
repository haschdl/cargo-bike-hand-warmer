// Pure data and metrics for comparing canopy shapes and mounting mechanisms. No DOM access.
import {pattern, handClearance, finishedCapOutline, polygonArea} from './geometry.mjs';

/** Shape presets, expressed relative to the current base radius so comparisons follow the user's input. */
export const SHAPES = [
  {id: 'semicircle', name: 'Semicircle (original)', make: b => ({radius: b.radius, height: b.radius, drop: 0}),
    intent: 'Smallest pattern; everything below the rail centre is open.'},
  {id: 'skirted', name: 'Skirted U', make: b => ({radius: b.radius, height: b.radius, drop: 35}),
    intent: 'Straight side skirts shield the fingers below the rail; bottom still open.'},
  {id: 'wideLow', name: 'Wide-low ellipse', make: b => ({radius: b.radius + 15, height: b.radius - 15, drop: 25}),
    intent: 'Lower profile above the rail, more lateral room for the knuckles.'},
  {id: 'narrowTall', name: 'Narrow-tall ellipse', make: b => ({radius: b.radius - 10, height: b.radius + 15, drop: 20}),
    intent: 'Less lateral protrusion toward the passenger’s legs and the outside.'},
];

/** Cut fabric per canopy in cm²: 1 wrap + 2 caps for shell and for lining. */
function fabricPerCanopy(p) {
  const by = id => p.pieces.find(pc => pc.id === id).area;
  return {shell: (by('P01') + 2 * by('P02')) / 100, lining: (by('P01L') + 2 * by('P02L')) / 100};
}

export function shapeMetrics(params, hand) {
  const p = pattern(params);
  const cl = handClearance(p, hand);
  return {
    p, clearance: cl.clearance, exposed: cl.exposed,
    wrapWidth: p.arc, frontalArea: polygonArea(finishedCapOutline(p)) / 100,
    lateralHalfWidth: p.radius, topAboveRail: p.height - p.railHeight,
    fabric: fabricPerCanopy(p),
  };
}

export function compareShapes(base, hand) {
  return [{id: 'current', name: 'Current input', intent: 'Values from the controls.', params: base}, ...SHAPES.map(s => ({...s, params: {...base, ...s.make(base)}}))]
    .map(s => {
      try { return {...s, ...shapeMetrics(s.params, hand)}; } catch (e) { return {...s, error: e.message}; }
    });
}

const r1 = n => n.toFixed(0);

/**
 * Mounting mechanisms. `parts` is computed from the pattern and placement; the qualitative ratings are
 * design judgement only and have not been tested.
 */
export const MOUNTS = [
  {id: 'tabs', name: 'Webbing tabs at end caps (P03)',
    parts: p => [`4 × webbing blank ${r1(p.strapLength)} × ${p.strapWidth} mm (π·${p.tube} + ${p.overlap} overlap)`, 'Hook-and-loop or snap closure per tab'],
    slide: 'Friction only', rotation: 'Good: two wraps', removal: 'Fast', hard: 'None', risk: 'Tab tail flaps if the closure opens',
    note: 'Baseline. Tabs anchor beside the cap notch, so they never cross the hand space.'},
  {id: 'flap', name: 'Notch closing flap',
    parts: p => [`4 × flap ${r1(2 * p.notchRadius + p.overlap)} × ${p.strapWidth} mm (notch width ${r1(2 * p.notchRadius)} + overlap)`, 'Hook-and-loop on flap and cap face'],
    slide: 'Friction only', rotation: 'Fair: closes the notch under the rail', removal: 'Fast', hard: 'None', risk: 'Fewest loose parts; flap sits at the cap, outside the hand',
    note: 'Integrates the closure into the end cap. Needs a reinforced cap face.'},
  {id: 'cord', name: 'Shock cord to the loop bends',
    parts: (p, place) => [`Front cord ≈ ${r1(Math.max(0, place.frontGap))} mm, rear cord ≈ ${r1(Math.max(0, place.rearGap))} mm (cap to bend start, before tensioning)`, 'Cord lock per end'],
    slide: 'Good: tensioned both ways', rotation: 'Poor unless combined with tabs', removal: 'Medium', hard: 'Cord locks', risk: 'Cord near the passenger; must stay captive and clear of the wheel',
    note: 'Cord lengths follow the canopy position on the straight rail.'},
  {id: 'clips', name: 'Snap-on tube clips',
    parts: p => [`4 × snap clip for ${p.tube} mm tube (verify the real diameter)`, 'Riveted or sewn to a stiffened cap patch'],
    slide: 'Good', rotation: 'Good', removal: 'Fast', hard: 'Rigid clips near the hands', risk: 'Hard edges at grip height; clip size depends on the unverified tube diameter',
    note: 'Most positive location, but adds rigid parts next to the passenger’s hands.'},
];
