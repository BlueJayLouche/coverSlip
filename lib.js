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

// Flat wrap for a case with a clear outer sleeve: back | spine | front, front on the right (opens like a book).
function wrap(name, back, spine, h, front = back) {
  const panels = { back: { x: 0, y: 0, w: back, h }, spine: { x: back, y: 0, w: spine, h }, front: { x: back + spine, y: 0, w: front, h } }, w = back + spine + front;
  return { name, w, h, panels, cut: `M 0 0 H ${w} V ${h} H 0 Z`, slits: '', folds: `M ${back} 0 V ${h} M ${back + spine} 0 V ${h}` };
}
const IN = 25.4;
export const CLAMSHELL = wrap('VHS clamshell', 5.25 * IN, 1.125 * IN, 8.375 * IN); // heavy-duty library case sleeve
export const DVD = wrap('DVD', 129.5, 14, 183);
export const BLURAY = wrap('Blu-ray', 128.5, 12, 148); // ponytail: 12mm spine; some Blu-ray cases are 14mm

// CD jewel case: the tray card (spine | back | spine, U-folded round the tray) and the front booklet
// cover, side by side so both print on one sheet.
export const CD = (() => {
  const H = 118, SP = 6.5, BK = 138, TW = SP + BK + SP, GAP = 2 * BLEED + 4, BX = TW + GAP, BS = 120;
  return {
    name: 'CD', w: BX + BS, h: BS,
    panels: {
      spine1: { x: 0, y: 0, w: SP, h: H }, back: { x: SP, y: 0, w: BK, h: H }, spine2: { x: SP + BK, y: 0, w: SP, h: H },
      front: { x: BX, y: 0, w: BS, h: BS },
    },
    cut: `M 0 0 H ${TW} V ${H} H 0 Z M ${BX} 0 H ${BX + BS} V ${BS} H ${BX} Z`, slits: '',
    folds: `M ${SP} 0 V ${H} M ${SP + BK} 0 V ${H}`,
  };
})();

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

const num = (v) => +v.toFixed(3);

// Canvas-style arc → cubic Béziers. da = signed sweep (radians, y-down so + is clockwise on screen).
export function arcBeziers(cx, cy, r, a0, da) {
  const n = Math.max(1, Math.ceil(Math.abs(da) / (Math.PI / 2) - 1e-9)), step = da / n, k = 4 / 3 * Math.tan(step / 4), segs = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * step, t1 = t0 + step, c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    segs.push([cx + r * (c0 - k * s0), cy + r * (s0 + k * c0), cx + r * (c1 + k * s1), cy + r * (s1 - k * c1), cx + r * c1, cy + r * s1]);
  }
  return { start: [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], segs };
}

// SVG path data (the subset the dielines use: M L H V A Z, absolute or relative; circular arcs) → PDF path operators.
export function svgToPdf(d) {
  const t = d.match(/[MLHVAZmlhvaz]|-?[\d.]+(?:e-?\d+)?/g) || [], out = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '';
  const n = () => +t[i++];
  while (i < t.length) {
    if (/[a-z]/i.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z', C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { x = ox + n(); y = oy + n(); sx = x; sy = y; out.push(`${num(x)} ${num(y)} m`); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { x = ox + n(); y = oy + n(); out.push(`${num(x)} ${num(y)} l`); }
    else if (C === 'H') { x = ox + n(); out.push(`${num(x)} ${num(y)} l`); }
    else if (C === 'V') { y = oy + n(); out.push(`${num(x)} ${num(y)} l`); }
    else if (C === 'Z') { x = sx; y = sy; out.push('h'); }
    else if (C === 'A') { // circular arcs only (rx = ry, no rotation) — all the dielines need
      let r = n(); n(); n(); const fa = n(), fs = n(), x2 = ox + n(), y2 = oy + n();
      const dx = (x - x2) / 2, dy = (y - y2) / 2, d2 = dx * dx + dy * dy;
      r = Math.max(r, Math.sqrt(d2));
      const f = Math.sqrt(Math.max(0, (r * r - d2) / d2)) * (fa === fs ? -1 : 1), cx = f * dy + (x + x2) / 2, cy = -f * dx + (y + y2) / 2;
      const a0 = Math.atan2(y - cy, x - cx);
      let da = Math.atan2(y2 - cy, x2 - cx) - a0;
      if (fs && da < 0) da += 2 * Math.PI; else if (!fs && da > 0) da -= 2 * Math.PI;
      for (const s of arcBeziers(cx, cy, r, a0, da).segs) out.push(`${s.map(num).join(' ')} c`);
      x = x2; y = y2;
    } else throw new Error(`svgToPdf: unsupported "${cmd}"`);
  }
  return out.join(' ');
}

// Minimal PDF writer. pages: [{ wPt, hPt, content, images?, gstates?, group? }]
//   content: page content stream (PDF operators); images: { Name: { width, height, pixels, cmyk?, smask? } }
//   (pixels packed RGB or CMYK, smask = 8-bit alpha); gstates: { Name: '<< … >>' }; group: transparency group colour space.
// icc: CMYK profile bytes, embedded once as the CMYK images' ICCBased colour space.
export async function pdf({ pages, icc }) {
  const enc = (s) => new TextEncoder().encode(s), objs = [];
  const add = (...parts) => (objs.push(parts), objs.length);
  const stream = async (dict, data) => { const z = await deflate(data); return add(`<< ${dict} /Filter /FlateDecode /Length ${z.length} >>\nstream\n`, z, '\nendstream'); };
  add('<< /Type /Catalog /Pages 2 0 R >>'); add(); // 2 = page tree, filled in once the pages exist
  const iccId = icc ? await stream('/N 4 /Alternate /DeviceCMYK', icc) : 0;
  const kids = [];
  for (const p of pages) {
    const xo = [];
    for (const [name, im] of Object.entries(p.images || {})) {
      const head = `/Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /BitsPerComponent 8`;
      const cs = im.cmyk ? (iccId ? `[/ICCBased ${iccId} 0 R]` : '/DeviceCMYK') : '/DeviceRGB';
      const sm = im.smask ? await stream(`${head} /ColorSpace /DeviceGray`, im.smask) : 0;
      xo.push(`/${name} ${await stream(`${head} /ColorSpace ${cs}${sm ? ` /SMask ${sm} 0 R` : ''}`, im.pixels)} 0 R`);
    }
    const gs = Object.entries(p.gstates || {}).map(([n, d]) => `/${n} ${d}`).join(' ');
    const content = await stream('', enc(p.content));
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.wPt} ${p.hPt}] /Resources << /XObject << ${xo.join(' ')} >> /ExtGState << ${gs} >> >> /Contents ${content} 0 R${p.group ? ` /Group << /S /Transparency /CS ${p.group} >>` : ''} >>`));
  }
  objs[1] = [`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`];
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
