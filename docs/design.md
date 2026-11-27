# Design notes: frame model, geometry review and visualisation

Status: experimental. Nothing here is a certified passenger accessory. Every frame value is an estimate until it has been measured on the bike.

## 1. Sources

Three manufacturer marketing images of the Fiido T2 Family Add-on. They are **not committed** to this repository (copyright). They are:

| Image | Content | Used for |
|---|---|---|
| Side drawing | One side loop with labels **637 mm** long and **315 mm** high | Loop shape, tube diameter, cushion length and height |
| Perspective drawing | Labels **355 mm** (upper width), **104 mm** (lower width), **384 mm** and **48 mm** (mounts) | Lateral layout, cross members |
| Product photo (near-plan view) | Frame, cushion with straps, side bag | Cross-member positions, a consistency check on 104 vs 355 |

None of the images says whether a dimension is measured to the outer edge or to the tube centreline.

## 2. Frame model (`src/frame.mjs`)

Axes: x forward, y left, z up. Origin: the rearmost outer point of the loops, the lowest outer point of the bottom rails, and the bike centreline.

| Quantity | Value | Basis | Confidence |
|---|---|---|---|
| Overall length | 637 mm, model 637.4 | Labelled; corners fitted to the side drawing | Labelled value high; fit ±3 mm |
| Height | 315 mm, model 315.0 | Labelled | High |
| Tube diameter | **16 mm** | 18 px tube width at 0.895 mm/px in the side drawing | **Low**: anti-aliasing, rendering, ±3 mm |
| Bend radius (centreline) | 25 mm | Visual fit | Low |
| Loop corners (side projection, centreline) | rear-bottom (113, 8), front-bottom (635.5, 8), front-top (567, 307), rear-top (−4, 307) | Leg slopes measured from pixel scans | Medium |
| Top-rail spacing | 355 mm, centre to centre | Labelled; c/l assumed | Medium |
| Bottom-rail spacing | 104 mm, centre to centre | Labelled; read as a lateral width (drawn like the 355 dimension) | Medium |
| Loop lean | 22.8° outward | Follows from 355 vs 104 | Medium: the plan photo is consistent (81 px vs 356 px, matching perspective shrink) |
| Straight top rail | 514.5 mm | Between bend tangent points | Depends on the bend radius |
| Rear upper cross member | z ≈ 194 mm between the rear legs | Plan photo position agrees with the lean model | Medium |
| Front upper and front lower cross members | — | Suggested by the photos; not measurable | **Low** (dashed in the UI) |
| Mount tabs | 384 mm longitudinal, 48 mm lateral, centred on the bottom rail | Labelled; longitudinal centring assumed | Medium |
| Seat cushion | x 119–609, top 39 mm, **width 160 mm assumed** | Side drawing; width invented for context | Context only |

The rear rack and the bike itself are not modelled.

**Measure before cutting:** tube diameter, top-rail straight length and height above the deck, rail spacing, cross-member heights, grip location, and passenger gloved-hand size.

## 3. Review of the milestone-1 geometry

| # | Finding | Severity | Change |
|---|---|---|---|
| 1 | The end caps were solid semicircles, but the rail runs through both caps, so the canopy could not be fitted. | **Bug** | Added a rail notch to every cap: a slot from the hem up to the rail, with a semicircular top of radius `tube/2 + clearance`. The notch edge is bound, so it is cut on the line. Validation rejects notches that would cut into the lining. |
| 2 | Shell and lining used the same nominal pattern. A lining of thickness t sits on the inner parallel curve, which is π·t shorter (12.6 mm for the default 4 mm), so a same-size lining bunches and eats hand clearance. | Correctness | Lining pieces (P01L, P02L) are now the exact inner parallel curve: wrap width `arc − π·t`, wrap length `L − 2t`. Setting `lining = 0` reproduces the old identical pieces. |
| 3 | The cap cut line continued the cut circle below the diameter into the hem allowance, narrowing the side allowance at the corner (74.33 instead of 75 mm for the defaults). It no longer matched the wrap's square corner. | Minor | The cut line now continues straight down (tangent extension), parallel to the wrap's hem allowance. |
| 4 | Wrap labels said "long edges" for the hems and "short edges" for the cap seams. With the defaults the hem edges (200 mm) are shorter than the cap-seam edges (224 mm). | Clarity | Renamed to "hem edges (along rail)" and "cap seam edges". |
| 5 | Default tube was 25 mm. The side drawing suggests about 16 mm. | Assumption | Default changed to 16 mm (est.); tab blank 113.5 → 85.3 mm. |
| 6 | The webbing tab formula (π·d + overlap) assumes the tab starts at the rail surface. Anchored at the canopy top, it would cross the hand space. | Design | Tabs are specified as anchored beside the cap notch, where the fabric meets the rail. |
| 7 | The hem allowance was implicitly the seam allowance. | Clarity | Separate `hem` parameter; it defaults to `seam`, so the output is unchanged. |

Unchanged and verified: the cap seam length πr equals the wrap's cap-seam edge; midpoint notches; the webbing blank; physical mm units; the calibration square. The four original tests keep their assertions and still pass.

### Design findings surfaced by the new views

- **Semicircle with the rail on the hem line:** everything below the rail centre is open. With the default envelope, the whole 45 mm of hand below the rail is exposed and lining clearance is only 6.9 mm.
- **Skirted U (35 mm drop):** cuts the exposure to 10 mm, for about 36% more fabric (shell plus lining).
- **Wide-low ellipse (80 × 50):** collides with the default hand envelope (−2.2 mm). Hand size is decisive; measure it.

## 4. Geometry engine extensions (`src/geometry.mjs`)

- **Profile family:** a half-ellipse with semi-axes `radius` × `height`, plus straight skirts of length `drop`. `radius = height` and `drop = 0` is the original semicircle, bit-for-bit (`arc === π·r`).
- **Half-ellipse length:** trapezoidal rule over one period of the π-periodic integrand, which converges geometrically. Tested against Ramanujan II to 1e-6.
- **Offsets:** seam allowances and the lining are exact parallel curves (normal offsets of the ellipse), evaluated at samples. Validation requires the lining thickness to be below the minimum curvature radius `min(a²/b, b²/a)`; past that the inner curve develops cusps.
- **Pieces:** returned as plain polygons with typed edges (`seamFront`, `seamRear`, `capSeam`, `hem`, `notch`). The printable SVG and every visualisation draw these same polygons. Curved outlines are 180-segment polylines of the exact curve.
- **`handClearance`:** a rectangular gloved-hand envelope around the rail, tested against the lining wall. Reports clearance, or penetration as a negative value, and the depth exposed below the hem.

## 5. Visualisation architecture

```
geometry.mjs  frame.mjs  variants.mjs   pure: numbers → data (tested in Node)
        \          |          /
         project.mjs  views.mjs         pure: data → SVG strings (tested in Node)
                    |
                 app.mjs                DOM only: controls, tabs, drag-rotate, hover
```

- **No dependencies, no build step.** ES modules served as-is. `scripts/dev-server.mjs` adds live reload for development.
- **Orthographic projection** with painter's sorting. This is enough for tubes and translucent fabric, and keeps the SVG inspectable.
- **Installed:** frame plus both canopies. Position along the rail and roll are adjustable; "align with loop" sets the roll to the loop lean. Side, rear and top orthographic views show labelled vs modelled dimensions.
- **Cross-section:** a frame section at any station (viewed from behind), next to a canopy-axis detail with lining band, rail, notch and hand envelope.
- **Exploded:** each piece is its exact cut polygon (allowances unfolded) formed onto the canopy surface by the arc-length mapping `profileAt`.
- **Assembled ↔ flat:** colour-coded seams and hems. Hovering an edge highlights its partner. The red generator line at arc length u is the same u on the flat wrap, the 3D surface and the cap curve.
- **Compare:** shape presets relative to the current radius, with computed metrics. Mounting mechanisms show computed part sizes; their ratings are judgement only.

## 6. Decisions

- The rail is placed at the profile centre by default (`railHeight = 0`). This keeps the milestone-1 shape; raise it or add `drop` to cover more of the hand.
- The roll defaults to 0°, so the open side faces straight down for drainage and hand withdrawal. Loop-aligned roll (22.8°) is offered for comparison and does not change the pattern.
- Mechanisms that restrain the hand or wrist are excluded.
- The manufacturer images stay out of the repository; this document records the derived values and how they were measured.
