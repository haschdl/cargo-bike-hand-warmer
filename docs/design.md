# Design notes

Status: one prototype, to be sewn and tested on the bike before any further software work. This is not a certified passenger accessory.

## Scope

A single-page sewing pattern generator. It has a schematic side view, a dimensioned cross-section, a short measurement form, dimensioned pattern pieces, tiled A4 printing, a material list and sewing steps. There is one design: a semicircular canopy with an optional skirt. Alternatives wait until the prototype has been evaluated.

## Design

- The canopy is a semicircle of radius r around the rail, with optional straight skirts below the rail centre. The lower edge stays open, so the hand can always be withdrawn. No straps go around the hand or wrist.
- **r** = distance from the rail centre to the gloved-fist corner (half the fist thickness across, and tube radius plus knuckle height above), plus extra room, plus lining thickness. It is rounded up to a whole mm.
- Each canopy is 1 shell wrap, 2 shell end caps, 1 lining wrap and 2 lining end caps. The pair also needs 4 webbing tabs.
- **Construction:** caps are sewn to the wrap on the stitch line. The lining sits inside the shell, wrong sides together. All open edges, the rail notches included, are bound in one pass. Each tab is box-stitched to the outside of an end cap beside the notch and closes on itself with hook-and-loop.

## Geometry corrections carried over from the first PR #1 iteration

| Correction | Rule in the code | Test |
|---|---|---|
| End caps were solid, so the rail could not pass through | Bound rail notch, radius `tube/2 + 2 mm`, from the cap base up over the rail | `end caps have a rail notch…` |
| Matching seams | Wrap stitch line = cap stitch curve = `π·r + 2·skirt` (lining `π·(r − t) + 2·skirt`); centre and skirt-junction match marks on both | `wrap stitch lines match…`, `match marks…` |
| Same-size lining bunches (π·t too long) | Separate lining pieces on the inner parallel curve: radius `r − t`, length `L − 2t` | `lining follows the inner parallel curve…` |
| Seam allowances | Allowance only on sewn edges (cap seams, cap curve). Bound edges are cut on the finished line. The earlier version added allowance to bound edges and narrowed the cap's side allowance at the corner. | `seam allowance only on sewn edges…` |
| Wrap edge labels were inverted | Edges are named by function: "sew to end caps" and "open lower edge, bind" | — |
| Webbing tab could cross the hand space | Tab = 20 mm anchor + `π·tube` + 35 mm overlap, anchored beside the notch | `webbing tab = …` |

## Printing

- **Page size:** A4 portrait with a 12 mm margin, so each page has a 186 × 273 mm pattern window. The layout tries 1–4 columns and uses the one that needs the fewest pages.
- **Page 1:** 50 × 50 mm square, print settings, page map, trimming steps and the piece list. Every page also has a 50 mm check bar.
- **Joining:** half diamonds sit on every internal page join and complete when the pages are joined. Trim the right and bottom margins on the border line, overlap onto the neighbour's border line, and tape.
- **Verified:** Chrome's print-to-PDF gives 7 pages at 210 × 297 mm for the defaults, with the square measuring 50.00 × 50.00 mm.
- **Also available:** a full-size single-sheet SVG for copy shops or vector editors.

## Assumptions and unverified measurements

| Value | Default | Status |
|---|---|---|
| Rail tube diameter | 16 mm | **Estimate** from the manufacturer side drawing. Measure with calipers. |
| Hand-warmer length | 180 mm | Must fit the straight part of the upper rail. The straight length is not measured. |
| Gloved fist thickness / knuckle height | 60 / 40 mm | Placeholders. Measure the passenger in winter gloves. |
| Lining thickness | 4 mm | Depends on the fleece or batting chosen. |
| Extra room | 10 mm | Comfort guess. |
| Notch clearance, tab anchor, tab overlap | 2 / 20 / 35 mm | Fixed construction constants. Adjust after the test fit. |
| Frame drawing | — | Schematic only. Manufacturer labels: 637 mm overall, 315 mm high. No frame geometry is reconstructed. |

Not covered: thermal performance, wind sealing at the open edge, durability, and any safety certification.
