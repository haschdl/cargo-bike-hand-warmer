// SVG drawings: pattern sheet, A4 tiling, full-size export and the two explanatory illustrations.
// Pure string builders, no DOM. Classic script; requires src/pattern.js. Exposes globalThis.PatternDrawing.
(function () {
  'use strict';
  const SP = globalThis.SewingPattern;

  const A4 = Object.freeze({w: 210, h: 297, margin: 12});
  const CW = A4.w - 2 * A4.margin, CH = A4.h - 2 * A4.margin; // printable window per page: 186 × 273 mm
  const f = n => +(+n).toFixed(2);
  const d = (pts, close) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + (close ? 'Z' : '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const text = (x, y, s, size = 3.5, extra = '') => `<text x="${f(x)}" y="${f(y)}" font-size="${size}"${extra}>${esc(s)}</text>`;
  const mm = n => `${Math.round(n)} mm`;
  const STYLE = `<style>text{font-family:Helvetica,Arial,sans-serif;fill:#111}.cut{fill:none;stroke:#111;stroke-width:.5}.st{fill:none;stroke:#111;stroke-width:.3;stroke-dasharray:2.5 1.5}.dim{fill:none;stroke:#555;stroke-width:.25}.thin{fill:none;stroke:#111;stroke-width:.3}</style>`;

  /** Horizontal or vertical dimension line with arrows and a centred label. */
  function dim(x1, y1, x2, y2, label, size = 3.2) {
    const horiz = Math.abs(y2 - y1) < 1e-9, a = 1.6;
    const arrows = horiz
      ? `M${f(x1 + a)} ${f(y1 - a / 2)}L${f(x1)} ${f(y1)}L${f(x1 + a)} ${f(y1 + a / 2)}M${f(x2 - a)} ${f(y2 - a / 2)}L${f(x2)} ${f(y2)}L${f(x2 - a)} ${f(y2 + a / 2)}`
      : `M${f(x1 - a / 2)} ${f(y1 + a)}L${f(x1)} ${f(y1)}L${f(x1 + a / 2)} ${f(y1 + a)}M${f(x2 - a / 2)} ${f(y2 - a)}L${f(x2)} ${f(y2)}L${f(x2 + a / 2)} ${f(y2 - a)}`;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const lab = horiz ? text(mx, my - 1.2, label, size, ' text-anchor="middle"')
      : text(mx - 1.2, my, label, size, ` text-anchor="middle" transform="rotate(-90 ${f(mx - 1.2)} ${f(my)})"`);
    return `<path class="dim" d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}${arrows}"/>${lab}`;
  }

  function grainline(g) {
    if (!g) return '';
    const [[x1, y1], [x2, y2]] = g;
    return `<path class="thin" d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}M${f(x1 - 1.5)} ${f(y1 + 3)}L${f(x1)} ${f(y1)}L${f(x1 + 1.5)} ${f(y1 + 3)}M${f(x2 - 1.5)} ${f(y2 - 3)}L${f(x2)} ${f(y2)}L${f(x2 + 1.5)} ${f(y2 - 3)}"/>` +
      text(x1 + 2, (y1 + y2) / 2, 'grain', 2.8, ` transform="rotate(-90 ${f(x1 + 2)} ${f((y1 + y2) / 2)})" text-anchor="middle" dy="2.5"`);
  }

  const cutText = cut => Object.entries(cut).map(([k, n]) => `Cut ${n} × ${k === 'shell' ? 'shell fabric' : k === 'lining' ? 'lining' : 'webbing'}`).join(', ');

  /** One pattern piece with title, cutting note, stitch lines, marks, grainline and overall dimensions. */
  function pieceSvg(pc, p) {
    const W = pc.width, H = pc.height, s = p.m.seam;
    let out = `<path class="cut" d="${d(pc.outline, true)}"/>`;
    out += pc.stitch.map(l => `<path class="st" d="${d(l)}"/>`).join('');
    out += pc.marks.map(l => `<path class="cut" d="${d(l)}"/>`).join('');
    out += grainline(pc.grain);
    out += text(0, -7, `${pc.id}  ${pc.name}`, 5, ' font-weight="bold"') + text(0, -2, cutText(pc.cut), 3.5);
    out += dim(0, H + 7, W, H + 7, mm(W));
    out += dim(-7, 0, -7, H, mm(H));
    if (pc.kind === 'wrap') {
      out += text(W / 2, H / 2 - 4, `Stitch lines: ${f(pc.seamLength).toFixed(1)} mm`, 3.2, ' text-anchor="middle"');
      out += text(W / 2, H / 2 + 1, 'Sew these edges to the end caps', 3.2, ' text-anchor="middle"');
      out += text(W / 2, H / 2 + 6, `Long sides: open lower edge, bind (no allowance)`, 3, ' text-anchor="middle"');
      out += text(W / 2, s + 4.5, 'match marks ▾', 2.8, ' text-anchor="middle"');
    } else if (pc.kind === 'cap') {
      out += text(W / 2, H * 0.52, `Curved stitch line ${f(pc.edges.capSeam).toFixed(1)} mm`, 3.2, ' text-anchor="middle"');
      out += text(W / 2, H * 0.52 + 5, 'Straight edge and rail notch: bind', 3, ' text-anchor="middle"');
    } else {
      out += text(pc.anchor / 2, H / 2 + 1.2, 'sew to cap', 2.6, ' text-anchor="middle"');
      out += text(pc.width - pc.overlap / 2, H / 2 + 1.2, 'hook + loop', 2.6, ' text-anchor="middle"');
    }
    return out;
  }

  const LABEL = {top: 14, left: 11, right: 2, bottom: 12};

  function calibrationBlock() {
    return `<rect class="cut" x="0" y="0" width="50" height="50"/>` + text(25, 23, '50 × 50 mm', 4, ' text-anchor="middle" font-weight="bold"') +
      text(25, 29, 'Measure before cutting', 3, ' text-anchor="middle"');
  }

  /** Lay pieces out on a sheet `cols` pages wide. Returns markup and size in mm. */
  function sheet(p, cols) {
    const blocks = p.pieces.map(pc => ({w: pc.width + LABEL.left + LABEL.right, h: pc.height + LABEL.top + LABEL.bottom, pc}));
    blocks.push({w: 52, h: 52 + LABEL.top, calib: true});
    const width = cols * CW;
    const {pos, height} = SP.shelfPack(blocks, width - 4, 6);
    const body = blocks.map((b, i) => {
      const x = pos[i].x + 2, y = pos[i].y + 2;
      return b.calib ? `<g transform="translate(${f(x + 1)} ${f(y + LABEL.top)})">${calibrationBlock()}</g>`
        : `<g transform="translate(${f(x + LABEL.left)} ${f(y + LABEL.top)})">${pieceSvg(b.pc, p)}</g>`;
    }).join('');
    return {width, height: height + 4, body, fits: blocks.every(b => b.w <= width - 4)};
  }

  /** Choose the column count that needs the fewest A4 pages. */
  function bestSheet(p) {
    let best = null;
    for (let cols = 1; cols <= 4; cols++) {
      const sh = sheet(p, cols);
      if (!sh.fits) continue;
      const rows = Math.ceil(sh.height / CH), pages = rows * cols;
      if (!best || pages < best.pages) best = {...sh, cols, rows, pages};
    }
    if (!best) throw new Error('A pattern piece is wider than four A4 pages.');
    return best;
  }

  const pageId = (r, c) => String.fromCharCode(65 + r) + (c + 1);

  /** Half diamonds on internal tile boundaries; each page shows its half, which must line up with the neighbour. */
  function matchMarks(sh) {
    let out = '';
    const dm = (x, y) => `<path d="M${f(x)} ${f(y - 5)}L${f(x + 5)} ${f(y)}L${f(x)} ${f(y + 5)}L${f(x - 5)} ${f(y)}Z" fill="#fff" stroke="#111" stroke-width=".4"/>`;
    for (let c = 1; c < sh.cols; c++) for (let r = 0; r < sh.rows; r++) out += dm(c * CW, r * CH + CH / 2);
    for (let r = 1; r < sh.rows; r++) for (let c = 0; c < sh.cols; c++) out += dm(c * CW + CW / 2, r * CH);
    return out;
  }

  function pageFrame(inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">${STYLE}${inner}</svg>`;
  }

  function scaleBar(x, y) {
    return `<path class="thin" d="M${x} ${y}h50M${x} ${y - 2}v4M${x + 10} ${y - 1}v2M${x + 20} ${y - 1}v2M${x + 30} ${y - 1}v2M${x + 40} ${y - 1}v2M${x + 50} ${y - 2}v4"/>` +
      text(x + 52, y + 1.2, '50 mm check', 2.8);
  }

  function coverPage(p, sh) {
    const M = A4.margin;
    let o = text(M, M + 8, 'Fiido T2 passenger hand warmer — sewing pattern', 7, ' font-weight="bold"');
    o += text(M, M + 15, `Hand warmer ${mm(p.m.length)} long, canopy radius ${mm(p.radius)}, tube ${mm(p.m.tube)}, skirt ${mm(p.m.skirt)}.`, 3.8);
    o += text(M, M + 21, 'Prototype only. Not a certified passenger accessory.', 3.5);
    o += `<g transform="translate(${M} ${M + 30})">${calibrationBlock()}</g>`;
    const lines = ['1. Print at 100 % / "Actual size". Turn off "Fit to page". A4 portrait.',
      '2. Measure the square: it must be exactly 50 × 50 mm. If not, fix the print settings.',
      '3. On every page except the last column, cut off the right margin along the border line.',
      '4. On every page except the last row, cut off the bottom margin along the border line.',
      '5. Lay the pages out as in the map. Slide each trimmed edge onto the next page’s',
      '    border line so the half diamonds join into whole diamonds. Tape on the front.',
      '6. Cut out each piece on the solid line. Dashed lines are stitch lines.',
      '7. Transfer the small match marks to the fabric with a 3 mm snip or chalk.'];
    lines.forEach((l, i) => { o += text(M + 60, M + 36 + i * 6, l, 3.4); });
    const mapY = M + 98, cell = Math.min(30, 170 / sh.cols);
    o += text(M, mapY - 4, `Page map: ${sh.cols} across × ${sh.rows} down (${sh.pages} pattern pages)`, 4, ' font-weight="bold"');
    for (let r = 0; r < sh.rows; r++) for (let c = 0; c < sh.cols; c++) {
      const x = M + c * cell, y = mapY + r * cell * CH / CW;
      o += `<rect class="thin" x="${f(x)}" y="${f(y)}" width="${f(cell)}" height="${f(cell * CH / CW)}"/>` + text(x + cell / 2, y + cell * CH / CW / 2 + 2, pageId(r, c), 6, ' text-anchor="middle"');
    }
    const listY = mapY + sh.rows * cell * CH / CW + 14;
    o += text(M, listY, 'Pieces (for one pair)', 4, ' font-weight="bold"');
    p.pieces.forEach((pc, i) => { o += text(M, listY + 7 + i * 5.5, `${pc.id}  ${pc.name}: ${cutText(pc.cut)}  (${mm(pc.width)} × ${mm(pc.height)})`, 3.4); });
    o += scaleBar(M, A4.h - 6);
    return pageFrame(o);
  }

  function tilePage(sh, r, c) {
    const M = A4.margin, ox = c * CW, oy = r * CH, id = pageId(r, c);
    let o = `<svg x="${M}" y="${M}" width="${CW}" height="${CH}" viewBox="${f(ox)} ${f(oy)} ${CW} ${CH}" overflow="hidden">${sh.body}${matchMarks(sh)}</svg>`;
    o += `<rect x="${M}" y="${M}" width="${CW}" height="${CH}" fill="none" stroke="#111" stroke-width=".3"/>`;
    o += text(M, M - 4, `Page ${id}`, 5, ' font-weight="bold"') + text(M + 22, M - 4, `row ${r + 1} of ${sh.rows}, column ${c + 1} of ${sh.cols}`, 3.2);
    if (c < sh.cols - 1) o += text(A4.w - 4, A4.h / 2, `✂ trim on border — overlap onto ${pageId(r, c + 1)}`, 3, ` text-anchor="middle" transform="rotate(90 ${A4.w - 4} ${A4.h / 2})"`);
    if (r < sh.rows - 1) o += text(A4.w / 2 + 30, A4.h - 7.5, `✂ trim on border — overlap onto ${pageId(r + 1, c)}`, 3, ' text-anchor="middle"');
    o += scaleBar(M, A4.h - 4);
    return pageFrame(o);
  }

  /** Cover page plus one SVG per A4 tile. */
  function a4Pages(p) {
    const sh = bestSheet(p), pages = [coverPage(p, sh)];
    for (let r = 0; r < sh.rows; r++) for (let c = 0; c < sh.cols; c++) pages.push(tilePage(sh, r, c));
    return {cols: sh.cols, rows: sh.rows, pages};
  }

  /** Single full-size sheet (for plotters, copy shops or vector editors). */
  function fullSizeSvg(p) {
    const sh = bestSheet(p);
    const W = sh.width, H = sh.height + 12;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">${STYLE}${sh.body}` +
      text(4, H - 4, 'Fiido T2 passenger hand warmer — print at 100 %; check the 50 × 50 mm square. Prototype only.', 3.5) + '</svg>';
  }

  /** On-screen preview of the pattern sheet (same geometry as the printed pages). */
  function sheetPreview(p) {
    const sh = bestSheet(p);
    let grid = '';
    for (let c = 1; c < sh.cols; c++) grid += `<path d="M${c * CW} 0V${sh.rows * CH}" stroke="#bbb" stroke-dasharray="3 3" stroke-width=".4"/>`;
    for (let r = 1; r < sh.rows; r++) grid += `<path d="M0 ${r * CH}H${sh.cols * CW}" stroke="#bbb" stroke-dasharray="3 3" stroke-width=".4"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${f(sh.cols * CW + 4)} ${f(sh.rows * CH + 4)}">${STYLE}<rect x="0" y="0" width="${sh.cols * CW}" height="${sh.rows * CH}" fill="#fff" stroke="#bbb" stroke-width=".4"/>${grid}${sh.body}</svg>`;
  }

  /** 1. Schematic side view of the passenger frame showing where the hand warmers go. Not to scale. */
  function sideView(p) {
    const loop = [[30, 60], [600, 60], [650, 300], [150, 300]];
    const L = Math.min(p.m.length, 400) * 0.9, x0 = 330, y = 60, h = 50;
    let o = `<path d="${d(loop, true)}" fill="none" stroke="#333" stroke-width="12" stroke-linejoin="round"/>`;
    o += `<rect x="160" y="270" width="470" height="20" rx="6" fill="#ddd" stroke="#666"/>` + text(395, 284, 'passenger seat', 13, ' text-anchor="middle" fill="#444"');
    o += `<path d="M690 150c20-10 60-10 80 0v10h-80z" fill="#ddd" stroke="#666"/>` + text(730, 185, 'rider', 13, ' text-anchor="middle"');
    o += `<path d="M${x0} ${y + 8}v${-h}a12 12 0 0 1 12 -12h${L - 24}a12 12 0 0 1 12 12v${h}" fill="#e9e3d6" stroke="#111" stroke-width="2"/>`;
    o += `<path d="M${x0 + 10} ${y}h-22M${x0 + L - 10} ${y}h22" stroke="#111" stroke-width="5"/>`;
    o += text(x0 + L / 2, y - 18, 'hand warmer', 15, ' text-anchor="middle" font-weight="bold"');
    o += `<path d="M${x0 + L / 2} ${y + 12}L${x0 + L / 2 - 30} ${y + 120}" stroke="#111" stroke-width="1" fill="none"/>` + text(x0 + L / 2 - 30, y + 136, 'open underneath: the hand can always be pulled out', 12, ' text-anchor="middle"');
    o += `<path d="M${x0 + L + 12} ${y}L${x0 + L + 50} ${y - 40}" stroke="#111" stroke-width="1" fill="none"/>` + text(x0 + L + 54, y - 44, 'webbing tab at each end', 12);
    o += `<path d="M150 ${y}L130 ${y - 34}" stroke="#111" stroke-width="1" fill="none"/>` + text(30, y - 40, 'upper side rail (one each side)', 13);
    o += `<path d="M680 230h80" stroke="#111" stroke-width="1.5" marker-end="url(#ar)"/>` + text(720, 222, 'front', 12, ' text-anchor="middle"');
    o += `<path d="M30 340H650" class="dim" stroke-width="1"/>` + text(340, 356, '637 mm overall (manufacturer)', 12, ' text-anchor="middle"');
    o += `<path d="M8 60V300" class="dim" stroke-width="1"/>` + text(4, 180, '315 mm', 12, ' text-anchor="middle" transform="rotate(-90 4 180)"');
    o += text(390, y + 176, 'Keep it on the straight part of the rail, clear of the bends.', 12, ' text-anchor="middle"');
    o += text(770, 356, 'Schematic, not to scale', 11, ' text-anchor="end" fill="#555"');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 800 380" role="img" aria-label="Side view: mounting location"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L7 4L0 8z" fill="#111"/></marker></defs>${STYLE}${o}</svg>`;
  }

  /** 2. Dimensioned cross-section at true proportions: tube, shell, lining, skirt and gloved fist. */
  function crossSection(p) {
    const m = p.m, r = p.radius, t = m.lining, drop = m.skirt, S = ([u, v]) => [u, -v];
    const shell = SP.profilePoints(r, drop, 0, 120), lin = SP.profilePoints(r - t, drop, 0, 120);
    const fs = Math.max(4.2, r / 11);
    let o = `<path d="${d([...shell, ...[...lin].reverse()].map(S), true)}" fill="#e9e3d6" stroke="none"/>`;
    o += `<path d="${d(shell.map(S))}" fill="none" stroke="#111" stroke-width="1.4"/><path d="${d(lin.map(S))}" fill="none" stroke="#111" stroke-width=".6"/>`;
    const fw = m.fistWidth / 2, ft = m.tube / 2 + m.fistAbove;
    o += `<rect x="${f(-fw)}" y="${f(-ft)}" width="${f(2 * fw)}" height="${f(ft + m.tube / 2 + 12)}" rx="6" fill="none" stroke="#555" stroke-width=".6" stroke-dasharray="3 2"/>`;
    o += text(0, -ft + fs * 1.4, 'gloved fist', fs * 0.85, ' text-anchor="middle" fill="#444"');
    o += `<circle cx="0" cy="0" r="${f(m.tube / 2)}" fill="#333"/>`;
    const k = Math.hypot(fw, ft), ux = fw / k, uy = ft / k, inner = r - t;
    o += `<path d="M${f(fw)} ${f(-ft)}L${f(ux * inner)} ${f(-uy * inner)}" stroke="#b03a2e" stroke-width=".8" fill="none"/>`;
    o += text(ux * inner + 3, -uy * inner - 3, `room ${Math.round(p.clearance.radial)} mm`, fs * 0.85, ' fill="#b03a2e"');
    const hem = -drop, base = Math.max(drop, m.tube / 2 + 12) + 10;
    o += dim(-r, base, r, base, `${mm(2 * r)} outside width`, fs);
    o += dim(r + 10, -r, r + 10, 0, `${mm(r)}`, fs);
    if (drop > 0) o += dim(r + 10, 0, r + 10, -hem, `skirt ${mm(drop)}`, fs);
    o += `<path class="dim" d="M${f(-m.tube / 2)} 0H${f(-r - 22)}"/>` + text(-r - 24, fs * 0.35, `tube ⌀ ${mm(m.tube)}`, fs, ' text-anchor="end"');
    o += `<path class="dim" d="M${f(-(r - t / 2) * 0.7)} ${f(-(r - t / 2) * 0.71)}L${f(-r - 18)} ${f(-r - 8)}"/>` + text(-r - 20, -r - 10, `lining ${mm(t)} inside the shell`, fs, ' text-anchor="end"');
    o += text(0, base + fs * 2.6, 'Open lower edge (bound). Rail runs through notches in both end caps.', fs * 0.8, ' text-anchor="middle" fill="#444"');
    const pad = 30, x0 = -r - 110, w = 2 * r + 160;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(-r - pad)} ${f(w)} ${f(r + base + fs * 3.5 + pad)}" role="img" aria-label="Cross-section">${STYLE}${o}</svg>`;
  }

  globalThis.PatternDrawing = Object.freeze({A4, CW, CH, bestSheet, a4Pages, fullSizeSvg, sheetPreview, sideView, crossSection});
})();
