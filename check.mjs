// Self-check for the maths that fails silently: node check.mjs
import assert from 'node:assert/strict';
import { VHS, PAPERS, fits, pdf } from './lib.js';

const { side, front, spine, back } = VHS.panels;
assert.equal(front.x, side.x + side.w, 'front abuts side');
assert.equal(spine.x, front.x + front.w, 'spine abuts front');
assert.equal(back.x, spine.x + spine.w, 'back abuts spine');
assert.ok(Math.abs(front.w - 104.775) < 1e-9 && Math.abs(front.h - 188.9125) < 1e-9, '4-1/8" x 7-7/16" face');
assert.ok(Math.abs(spine.w - 26.9875) < 1e-9, '1-1/16" spine');
for (const p of PAPERS) if (p.w) assert.ok(fits(p), `${p.name} fits`);
assert.ok(!fits({ w: 297, h: 210 }), 'A4 does not fit');

// PDF: every xref offset must point at its "n 0 obj", and startxref at "xref".
const bytes = new Uint8Array(await (await pdf({ wPt: 10, hPt: 10, width: 2, height: 2, pixels: new Uint8Array(16), cmyk: true, icc: new Uint8Array(8) })).arrayBuffer());
const text = new TextDecoder('latin1').decode(bytes);
const xref = +text.match(/startxref\n(\d+)/)[1];
assert.ok(text.startsWith('xref', xref), 'startxref points at xref');
const offs = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => +m[1]);
assert.equal(offs.length, 6);
offs.forEach((o, i) => assert.ok(text.startsWith(`${i + 1} 0 obj`, o), `obj ${i + 1} offset`));

console.log('ok');
