// Self-check for the maths that fails silently: node check.mjs
import assert from 'node:assert/strict';
import { VHS, VHS_SPLIT, VHS_SIDE, CLAMSHELL, DVD, BLURAY, CD, jcard, PAPERS, fits, pdf, svgToPdf } from './lib.js';

const { side, front, spine, back } = VHS.panels;
assert.equal(front.x, side.x + side.w, 'front abuts side');
assert.equal(spine.x, front.x + front.w, 'spine abuts front');
assert.equal(back.x, spine.x + spine.w, 'back abuts spine');
assert.ok(Math.abs(front.w - 104.775) < 1e-9 && Math.abs(front.h - 188.9125) < 1e-9, '4-1/8" x 7-7/16" face');
assert.ok(Math.abs(spine.w - 26.9875) < 1e-9, '1-1/16" spine');
const paper = (n) => PAPERS.find((p) => p.name === n);
for (const n of ['A3', 'SRA3', 'Tabloid 11×17"', '12×18"', '13×19"']) assert.ok(fits(paper(n)), `VHS fits ${n}`);
assert.ok(!fits(paper('A4')) && !fits(paper('Letter')), 'VHS too big for A4/Letter');
assert.ok(fits(paper('A4'), VHS_SPLIT) && !fits(paper('Letter'), VHS_SPLIT), 'split VHS fits A4, not Letter');
const [body, lid] = VHS_SPLIT.pieces;
assert.equal(body.y, front.y, 'body starts at the box top');
assert.ok(lid.glue.y === front.y && lid.h === front.y + lid.glue.h && lid.w === back.x, 'lid tab hangs below the box top across side+front+spine');

const j0 = jcard(15.9, 0), j3 = jcard(15.9, 3);
assert.ok(Math.abs(j0.w - (65.1 + 12.7 + 15.9)) < 1e-9 && j0.h === 101.6, 'J-card 3-panel size');
assert.ok(Math.abs(j3.w - j0.w - 3 * 65.1) < 1e-9 && j3.panels.inside1.x + 65.1 === j3.panels.front.x, 'fold-outs sit left of front');
assert.ok(fits(paper('A4'), j0) && fits(paper('Letter'), j0) && fits(paper('A4'), j3) && !fits(paper('Letter'), j3), 'J-card paper fits');

for (const f of [CLAMSHELL, DVD, BLURAY]) {
  const { back, spine, front } = f.panels;
  assert.ok(spine.x === back.x + back.w && front.x === spine.x + spine.w && Math.abs(f.w - (back.w + spine.w + front.w)) < 1e-9, `${f.name} panels abut`);
}
assert.ok(Math.abs(CLAMSHELL.w - 11.625 * 25.4) < 1e-9 && Math.abs(CLAMSHELL.h - 8.375 * 25.4) < 1e-9, 'clamshell 11-5/8" x 8-3/8"');
assert.ok(DVD.w === 273 && DVD.h === 183 && BLURAY.w === 269 && BLURAY.h === 148, 'DVD / Blu-ray wraps');
assert.ok(CD.panels.spine2.x + CD.panels.spine2.w === 151 && CD.panels.back.h === 118 && CD.panels.front.w === 120, 'CD tray 151x118 + booklet 120');
assert.ok(CD.panels.front.x - 151 >= 2 * 3.175, 'CD pieces far enough apart for both bleeds');
assert.ok(fits(paper('A3'), CLAMSHELL) && !fits(paper('A4'), CLAMSHELL), 'clamshell needs A3');
for (const f of [DVD, BLURAY, CD]) assert.ok(fits(paper('A4'), f), `${f.name} fits A4`);

{ // side-load: same box faces as bottom-load, end panels as deep as the spine
  const P = VHS_SIDE.panels;
  assert.ok(P.spine.x === P.back.x + P.back.w && P.front.x === P.spine.x + P.spine.w, 'side-load panels abut');
  assert.ok(P.front.w === front.w && P.front.h === front.h && P.spine.w === spine.w, 'side-load box = same box');
  assert.ok(P.top.h === spine.w && P.bottom.y === P.back.y + P.back.h, 'end panels hang off the back');
  assert.ok(fits(paper('A3'), VHS_SIDE) && !fits(paper('A4'), VHS_SIDE), 'side-load needs A3');
  assert.ok(svgToPdf(VHS_SIDE.cut).endsWith('h'), 'side-load cut converts');
}

// PDF: every xref offset must point at its "n 0 obj", and startxref at "xref".
const page = { wPt: 10, hPt: 10, content: 'q 10 0 0 10 0 0 cm /Im0 Do Q', images: { Im0: { width: 2, height: 2, pixels: new Uint8Array(16), cmyk: true } } };
const bytes = new Uint8Array(await (await pdf({ pages: [page, page], icc: new Uint8Array(8) })).arrayBuffer());
const text = new TextDecoder('latin1').decode(bytes);
const xref = +text.match(/startxref\n(\d+)/)[1];
assert.ok(text.startsWith('xref', xref), 'startxref points at xref');
const offs = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => +m[1]);
assert.equal(offs.length, 9); // catalog, tree, icc, 2 × (image, content, page)
assert.ok(text.includes('/Kids [6 0 R 9 0 R] /Count 2') && text.includes('[/ICCBased 3 0 R]'), 'page tree + icc refs');

// SVG → PDF paths: arcs become Béziers ending on the arc's end point, bulging the right way.
const p = svgToPdf('M 20 0 A 10 10 0 0 0 0 0 l 5 0 Z');
assert.ok(/ 0 0 c l?/.test(p) && p.endsWith('5 0 l h'), p);
assert.ok(p.match(/-?[\d.]+/g).map(Number).some((v, i) => i % 2 === 1 && v < -9), 'sweep 0 from right to left goes over the top (y < 0)');
assert.ok(svgToPdf(VHS.cut).split(' c').length > 5 && svgToPdf(VHS.cut).endsWith('h'), 'VHS cut converts');
offs.forEach((o, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, o), `obj ${i + 1} offset`));

console.log('ok');
