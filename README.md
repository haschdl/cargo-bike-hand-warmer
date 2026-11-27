# Fiido T2 passenger hand warmer

A removable insulated open-bottom canopy for each upper side rail of the Fiido T2 Family Add-on. This is an experimental sewing project, not a certified passenger safety accessory.

## Milestone 1: printable SVG pattern

Open `index.html` locally in a modern browser. No installation or dependencies. Adjust the provisional dimensions, download the SVG, and print at actual size using a vector editor. Verify the 50 mm calibration square before cutting. The SVG is a full-size sheet, not tiled A4.

The first prototype uses a rectangular wrap panel forming an inverted U and two semicircular end panels. The lower edge remains open; the end panels shield longitudinal wind. The shell and lining use the same nominal stitch geometry; test turn-of-cloth with scrap material. Attachment tabs are separate and their positions must be determined on the actual rail.

Manufacturer reference dimensions: overall length 637 mm, height 315 mm, upper width 355 mm; mounting dimensions 384, 48 and 104 mm. These do not establish tube diameter or usable grip position. All generator defaults are unverified.

## Development

- `src/geometry.mjs`: pure geometry and SVG generation
- `index.html`: local browser interface (serve with `python3 -m http.server 8000`, then open http://localhost:8000)
- `tests/geometry.test.mjs`: run with `node --test tests/geometry.test.mjs`
- `docs/prototype.md`: measurement and assembly checklist

Do not use on a moving bicycle until fit, unobstructed grip and withdrawal, attachment stability and wheel clearance have been assessed. No wrist closures or restraints. Do not treat the canopy as a substitute for gloves or approved passenger equipment.
