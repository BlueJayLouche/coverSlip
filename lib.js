// Pure geometry + PDF writing. No DOM, so check.mjs can run it under Node.
// All units are millimetres unless a name says otherwise.

export const BLEED = 3.175; // 1/8"

// Bottom-load VHS slip box, 4-1/8" x 1-1/16" x 7-7/16".
// ponytail: panel sizes come from the listed box size; flap shapes are traced by eye from the
// duplication.ca template image. Flaps fold inside so "close" is enough — do a plain-paper test fit.
// New media format = another object shaped like this one.
export const [VHS, VHS_SPLIT] = (() => {
  const IN = 25.4, W = 4.125 * IN, D = 1.0625 * IN, H = 7.4375 * IN;
  const TUCK = 18, DUST = 22, GLUE = 14, R = 12, TAB = 10;
  const y0 = D + TUCK, y1 = y0 + H; // body top / bottom (bottom is the open end, with thumb notches)
  const a = 0, b = D, c = D + W, d = 2 * D + W, e = 2 * D + 2 * W; // side | front | spine | back | glue
  const notch = (cx) => { // shallow arc cut up into a spine's bottom edge, 21mm wide, 6mm deep
    const h = 10.5, dep = 6, r = (h * h + dep * dep) / (2 * dep);
    return `L ${cx + h} ${y1} A ${r} ${r} 0 0 0 ${cx - h} ${y1}`;
  };
  const top = [ // (a, y0-7) → (d, y0)
    `M ${a} ${y0 - 7} L ${a + 2} ${y0 - 10} L ${a + 6} ${y0 - DUST} L ${b} ${y0 - DUST}`, // side dust flap
    `L ${b} ${R} A ${R} ${R} 0 0 1 ${b + R} 0 L ${c - R} 0 A ${R} ${R} 0 0 1 ${c} ${R}`, // lid tuck
    `L ${c} ${y0 - DUST} L ${d - 6} ${y0 - DUST} L ${d - 2} ${y0 - 10} L ${d} ${y0 - 7} L ${d} ${y0}`, // spine dust flap
  ].join(' ');
  const body = [ // (d, y0) → round the glue flap and bottom → close
    `L ${e} ${y0} L ${e + GLUE} ${y0 + 5} L ${e + GLUE} ${y1 - 12} L ${e} ${y1}`, // back top + glue flap
    notch((c + d) / 2), notch((a + b) / 2), `L ${a} ${y1} Z`,
  ].join(' ');
  // cuts inside the outline: flap/lid separations and the tuck lock slits
  const slits = `M ${b} ${y0} L ${b} ${y0 - DUST} M ${c} ${y0} L ${c} ${y0 - DUST} M ${b} ${y0 - D} l 8 0 M ${c} ${y0 - D} l -8 0`;
  const bodyFolds = `M ${b} ${y0} V ${y1} M ${c} ${y0} V ${y1} M ${d} ${y0} V ${y1} M ${e} ${y0} V ${y1}`;
  const vhs = {
    name: 'VHS',
    w: e + GLUE, h: y1,
    panels: {
      side: { x: a, y: y0, w: D, h: H },
      front: { x: b, y: y0, w: W, h: H },
      spine: { x: c, y: y0, w: D, h: H },
      back: { x: d, y: y0, w: W, h: H },
    },
    cut: `${top} ${body}`, slits,
    folds: `${bodyFolds} M ${a} ${y0} H ${d} M ${b} ${y0 - D} H ${c}`,
  };
  // Same box as two sheets so it fits A4: the body, and the lid + dust flaps on a TAB-high strip that
  // folds down and glues inside the body's top edge. The editor still shows the whole box, split line in red.
  const split = {
    ...vhs, slits: `${slits} M ${a} ${y0} H ${e}`,
    pieces: [
      { name: 'body', x: 0, y: y0, w: vhs.w, h: H, cut: `M ${a} ${y0} ${body}`, slits: '', folds: bodyFolds },
      {
        name: 'lid', x: 0, y: 0, w: d, h: y0 + TAB,
        cut: `${top} L ${d} ${y0 + TAB} L ${a} ${y0 + TAB} Z`, slits,
        folds: `M ${a} ${y0} H ${d} M ${b} ${y0 - D} H ${c} M ${b} ${y0} V ${y0 + TAB} M ${c} ${y0} V ${y0 + TAB}`,
        glue: { x: 0, y: y0, w: d, h: TAB },
      },
    ],
  };
  return [vhs, split];
})();

// What gets printed: one sheet per piece. Formats without `pieces` print whole.
export const pieces = (fmt) => fmt.pieces || [{ name: '', x: 0, y: 0, w: fmt.w, h: fmt.h, cut: fmt.cut, slits: fmt.slits, folds: fmt.folds }];

// Cassette J-card: [fold-outs…] front | spine | back flap, 4" tall. Straight cut, so just a rectangle.
// extra = fold-out panels left of the front (they fold behind it), numbered outward: inside1 is next to the front.
export function jcard(flap = 15.9, extra = 0) {
  const H = 101.6, FW = 65.1, SP = 12.7, panels = {};
  let x = 0;
  for (let i = extra; i >= 1; i--) { panels[`inside${i}`] = { x, y: 0, w: FW, h: H }; x += FW; }
  panels.front = { x, y: 0, w: FW, h: H }; x += FW;
  panels.spine = { x, y: 0, w: SP, h: H }; x += SP;
  panels.flap = { x, y: 0, w: flap, h: H }; x += flap;
  const folds = Object.values(panels).slice(1).map((p) => `M ${p.x} 0 V ${H}`).join(' ');
  return { name: 'J-card', w: x, h: H, panels, cut: `M 0 0 H ${x} V ${H} H 0 Z`, slits: '', folds };
}

// Landscape sheets; the app lists only the ones the current format + bleed fits on. w 0 = trim to bleed box.
export const PAPERS = [
  { name: 'A4', w: 297, h: 210 },
  { name: 'Letter', w: 279.4, h: 215.9 },
  { name: 'A3', w: 420, h: 297 },
  { name: 'SRA3', w: 450, h: 320 },
  { name: 'Tabloid 11×17"', w: 431.8, h: 279.4 },
  { name: '12×18"', w: 457.2, h: 304.8 },
  { name: '13×19"', w: 482.6, h: 330.2 },
  { name: 'Bleed box only', w: 0, h: 0 },
];

export const fits = (p, fmt = VHS) => pieces(fmt).every((pc) => p.w >= pc.w + 2 * BLEED && p.h >= pc.h + 2 * BLEED);

const deflate = async (u8) =>
  new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());

// Minimal PDF, one full-page image per page. pages: [{ wPt, hPt, width, height, pixels }], pixels packed
// RGB or CMYK bytes. icc (CMYK only): profile bytes, embedded once as the images' ICCBased colour space.
export async function pdf({ pages, cmyk, icc }) {
  const enc = (s) => new TextEncoder().encode(s);
  const n = pages.length, iccId = 3 + 3 * n; // objects: 1 catalog, 2 page tree, then page/content/image per page, then icc
  const cs = cmyk ? (icc ? `[/ICCBased ${iccId} 0 R]` : '/DeviceCMYK') : '/DeviceRGB';
  const objs = [
    ['<< /Type /Catalog /Pages 2 0 R >>'],
    [`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`],
  ];
  for (const [i, p] of pages.entries()) {
    const id = 3 + 3 * i, img = await deflate(p.pixels), content = `q ${p.wPt} 0 0 ${p.hPt} 0 0 cm /Im0 Do Q`;
    objs.push(
      [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.wPt} ${p.hPt}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`],
      [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
      [`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>\nstream\n`, img, '\nendstream'],
    );
  }
  if (cmyk && icc) {
    const p = await deflate(icc);
    objs.push([`<< /N 4 /Alternate /DeviceCMYK /Filter /FlateDecode /Length ${p.length} >>\nstream\n`, p, '\nendstream']);
  }
  const parts = [], offsets = [];
  let pos = 0;
  const put = (x) => { const u = typeof x === 'string' ? enc(x) : x; parts.push(u); pos += u.length; };
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objs.forEach((o, i) => { offsets.push(pos); put(`${i + 1} 0 obj\n`); o.forEach(put); put('\nendobj\n'); });
  const xref = pos;
  put(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  put(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
