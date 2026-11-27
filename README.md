# Fiido T2 passenger hand warmer

A removable insulated open-bottom canopy for each upper side rail of the Fiido T2 Family Add-on. This is an experimental sewing project, not a certified passenger safety accessory.

## Design interface (milestone 2)

Start the dev server: `node scripts/dev-server.mjs`. Then open http://localhost:8000/. Pages reload automatically when a file changes. Any static server also works, e.g. `python3 -m http.server 8000`. There are no dependencies.

Tabs:

- **Installed**: 3D frame model with both canopies. Drag to rotate. Side, rear and top views compare labelled and modelled dimensions.
- **Cross-section**: a frame section at any station along the rail, plus a canopy section with lining, rail notch, gloved-hand envelope and computed clearance.
- **Exploded**: every cut piece (exact outline, allowances unfolded) formed onto the canopy.
- **Assembled ↔ flat**: colour-coded seams. Hover an edge to see its partner; the slider shows the same arc length u on the wrap, the cap and the 3D canopy.
- **Compare**: canopy shapes with computed metrics, and mounting mechanisms with computed part sizes.
- **Printable pattern**: full-size SVG. Print at 100% and verify the 50 mm square. The sheet is not tiled.

The canopy is an inverted U over each upper side rail. The profile is a half-ellipse (semicircle by default) with optional straight skirts, and the lower edge stays open. Both end caps have a bound notch for the rail. Lining pieces follow the inner parallel curve. Webbing tabs anchor beside the cap notch.

Manufacturer reference dimensions: overall length 637 mm, height 315 mm, upper width 355 mm; mounting dimensions 384, 48 and 104 mm. The frame model, tube diameter (16 mm est.) and all generator defaults are **unverified estimates**. See `docs/design.md` for sources, assumptions, the milestone-1 geometry review and design decisions.

## Development

- `src/geometry.mjs`: pure pattern geometry and printable SVG
- `src/frame.mjs`: pure Fiido frame model and canopy placement
- `src/variants.mjs`: shape presets, mounting mechanisms, comparison metrics
- `src/project.mjs`, `src/views.mjs`: pure projection and SVG view builders (no DOM)
- `src/app.mjs`, `index.html`: browser glue and layout
- `scripts/dev-server.mjs`: zero-dependency static server with live reload
- Tests: `node --test tests/*.test.mjs`
- `docs/prototype.md`: measurement and assembly checklist; `docs/design.md`: design record

Do not use on a moving bicycle until fit, unobstructed grip and withdrawal, attachment stability and wheel clearance have been assessed. No wrist closures or restraints. Do not treat the canopy as a substitute for gloves or approved passenger equipment.
