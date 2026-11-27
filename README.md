# Fiido T2 passenger hand warmer

A removable insulated open-bottom canopy for each upper side rail of the Fiido T2 Family Add-on. This is an experimental sewing project, not a certified passenger safety accessory.

## Use

Open `index.html` in a browser by double-clicking it. There is no installation, server or dependency.

1. Enter the measurements (calipers, tape and the passenger's gloved hand).
2. Check the cross-section.
3. Click **Print A4 pattern** and print at 100 % / "Actual size".
4. Check the 50 × 50 mm square on page 1. Trim and tape the pages as described there.
5. Follow the material list and numbered sewing steps on the page.

There is one design: a semicircular insulated canopy over each upper side rail. It is open underneath, with an optional wind skirt, a bound rail notch in each end cap, lining pieces cut to sit inside without bunching, and webbing tabs with hook-and-loop. All defaults are **unverified**; see `docs/design.md`.

## Development

- `src/pattern.js`: pure pattern geometry, validation and materials
- `src/drawing.js`: pure SVG builders for the illustrations, pattern sheet, A4 tiles and full-size export
- `index.html`: the page and a small amount of glue code (classic scripts, so it works from `file://`)
- Tests: `node --test tests/*.test.mjs`
- `docs/design.md`: design, geometry corrections, printing and assumptions; `docs/prototype.md`: measurement checklist

Do not use on a moving bicycle until fit, unobstructed grip and withdrawal, attachment stability and wheel clearance have been assessed. No wrist closures or restraints. Do not treat the canopy as a substitute for gloves or approved passenger equipment.
