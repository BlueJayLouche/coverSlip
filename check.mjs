// Self-check for the maths that fails silently: node check.mjs
import assert from 'node:assert/strict';
import { VHS, jcard, PAPERS, fits, pdf } from './lib.js';

const { side, front, spine, back } = VHS.panels;
assert.equal(front.x, side.x + side.w, 'front abuts side');
assert.equal(spine.x, front.x + front.w, 'spine abuts front');
assert.equal(back.x, spine.x + spine.w, 'back abuts spine');
assert.ok(Math.abs(front.w - 104.775) < 1e-9 && Math.abs(front.h - 188.9125) < 1e-9, '4-1/8" x 7-7/16" face');
assert.ok(Math.abs(spine.w - 26.9875) < 1e-9, '1-1/16" spine');
const paper = (n) => PAPERS.find((p) => p.name === n);
for (const n of ['A3', 'SRA3', 'Tabloid 11×17"', '12×18"', '13×19"']) assert.ok(fits(paper(n)), `VHS fits ${n}`);
assert.ok(!fits(paper('A4')) && !fits(paper('Letter')), 'VHS too big for A4/Letter');

const j0 = jcard(15.9, 0), j3 = jcard(15.9, 3);
assert.ok(Math.abs(j0.w - (65.1 + 12.7 + 15.9)) < 1e-9 && j0.h === 101.6, 'J-card 3-panel size');
assert.ok(Math.abs(j3.w - j0.w - 3 * 65.1) < 1e-9 && j3.panels.inside1.x + 65.1 === j3.panels.front.x, 'fold-outs sit left of front');
assert.ok(fits(paper('A4'), j0) && fits(paper('Letter'), j0) && fits(paper('A4'), j3) && !fits(paper('Letter'), j3), 'J-card paper fits');

// PDF: every xref offset must point at its "n 0 obj", and startxref at "xref".
const bytes = new Uint8Array(await (await pdf({ wPt: 10, hPt: 10, width: 2, height: 2, pixels: new Uint8Array(16), cmyk: true, icc: new Uint8Array(8) })).arrayBuffer());
const text = new TextDecoder('latin1').decode(bytes);
const xref = +text.match(/startxref\n(\d+)/)[1];
assert.ok(text.startsWith('xref', xref), 'startxref points at xref');
const offs = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => +m[1]);
assert.equal(offs.length, 6);
offs.forEach((o, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, o), `obj ${i + 1} offset`));

console.log('ok');
