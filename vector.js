// A drawing context that speaks enough of CanvasRenderingContext2D for drawContent()/drawGuides() and writes
// PDF operators instead of pixels. Text becomes glyph outlines (opentype.js fonts); images are embedded with
// their CSS filter baked in; opacity and blend modes map onto ExtGState /ca /BM.
// ponytail: only the canvas calls the app actually makes. A new call in drawing code needs a method here too.
import { arcBeziers, svgToPdf } from './lib.js';

const BM = {
  'source-over': 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten',
  'color-dodge': 'ColorDodge', 'color-burn': 'ColorBurn', 'hard-light': 'HardLight', 'soft-light': 'SoftLight',
  difference: 'Difference', exclusion: 'Exclusion', hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity',
};
const n = (v) => +(+v).toFixed(4);
const TAU = 2 * Math.PI;

function parseColor(css) { // → { rgb: [0..1 ×3], a }
  const s = String(css).trim();
  let m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(s);
  if (m) { const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]; return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), a: 1 }; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(',').map(parseFloat); return { rgb: p.slice(0, 3).map((v) => v / 255), a: p[3] ?? 1 }; }
  return { rgb: [0, 0, 0], a: 1 };
}

export class PdfCtx {
  // font(family, weight) → opentype Font; color([r,g,b] 0..1) → { v: 'operands', op: 'rg' | 'k' };
  // pixels(rgba Uint8ClampedArray) → { data: packed RGB or CMYK, cmyk }
  constructor({ font, color, pixels }) {
    Object.assign(this, { fontFor: font, color, pixels });
    this.ops = []; this.path = []; this.cur = null; this.stack = []; this.images = {}; this.gstates = {}; this.imgNames = new Map();
    this.st = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px Montserrat', letterSpacing: '0px', textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', lineJoin: 'miter', lineCap: 'butt', dash: [] };
    for (const k of Object.keys(this.st)) if (k !== 'dash') Object.defineProperty(this, k, { get: () => this.st[k], set: (v) => { this.st[k] = v; } });
  }

  save() { this.stack.push({ ...this.st, dash: [...this.st.dash] }); this.ops.push('q'); }
  restore() { if (this.stack.length) { this.st = this.stack.pop(); this.ops.push('Q'); } }
  transform(a, b, c, d, e, f) { this.ops.push(`${[a, b, c, d, e, f].map(n).join(' ')} cm`); }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
  setLineDash(d) { this.st.dash = [...d]; }

  beginPath() { this.path = []; this.cur = null; }
  moveTo(x, y) { this.path.push(`${n(x)} ${n(y)} m`); this.cur = [x, y]; }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.path.push(`${n(x)} ${n(y)} l`); this.cur = [x, y]; }
  closePath() { this.path.push('h'); }
  rect(x, y, w, h) { this.path.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re`); this.cur = [x, y]; }
  arc(cx, cy, r, a0, a1, ccw = false) { // canvas sweep rules: clockwise unless ccw, capped at a full turn
    let da = a1 - a0;
    if (!ccw) da = da >= TAU ? TAU : ((da % TAU) + TAU) % TAU;
    else da = -da >= TAU ? -TAU : ((da % TAU) - TAU) % TAU;
    const { start, segs } = arcBeziers(cx, cy, r, a0, da);
    this.cur ? this.lineTo(...start) : this.moveTo(...start);
    for (const s of segs) this.path.push(`${s.map(n).join(' ')} c`);
    this.cur = segs.length ? segs.at(-1).slice(4) : start;
  }

  gs(alpha) { // opacity × style alpha, blend mode
    const a = n(this.st.globalAlpha * alpha), bm = BM[this.st.globalCompositeOperation] || 'Normal', key = `GS${String(a).replace('.', 'p')}${bm}`;
    this.gstates[key] ??= `<< /Type /ExtGState /ca ${a} /CA ${a} /BM /${bm} >>`;
    this.ops.push(`/${key} gs`);
  }
  paint(style, stroke) { // colour + graphics state; returns nothing, pushes ops
    const { rgb, a } = parseColor(style), { v, op } = this.color(rgb);
    this.ops.push(`${v} ${stroke ? op.toUpperCase() : op}`);
    if (stroke) this.ops.push(`${n(this.st.lineWidth)} w ${{ round: 1, bevel: 2 }[this.st.lineJoin] || 0} j ${{ round: 1, square: 2 }[this.st.lineCap] || 0} J [${this.st.dash.map(n).join(' ')}] 0 d`);
    this.gs(a);
  }
  pathOf(p) { return typeof p === 'string' && p !== 'evenodd' && p !== 'nonzero' ? [svgToPdf(p)] : this.path; } // SVG string or current path
  fill(p, rule) {
    const path = this.pathOf(p), evenodd = (typeof p === 'string' && path === this.path ? p : rule) === 'evenodd';
    if (!path.join('').trim()) return;
    this.paint(this.st.fillStyle, false); this.ops.push(...path, evenodd ? 'f*' : 'f');
  }
  stroke(p) {
    const path = this.pathOf(p);
    if (!path.join('').trim()) return;
    this.paint(this.st.strokeStyle, true); this.ops.push(...path, 'S');
  }
  clip() { this.ops.push(...this.path, 'W n'); }
  fillRect(x, y, w, h) { this.paint(this.st.fillStyle, false); this.ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`); }
  strokeRect(x, y, w, h) { this.paint(this.st.strokeStyle, true); this.ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re S`); }

  layout(str) {
    const m = /^(\d+)\s+([\d.e-]+)px\s+"?([^"]+?)"?$/.exec(this.st.font.trim()) || [0, 400, 10, 'Montserrat'];
    const size = +m[2], f = this.fontFor(m[3], +m[1]), k = size / f.unitsPerEm, sp = parseFloat(this.st.letterSpacing) || 0;
    const glyphs = f.stringToGlyphs(str), pos = [];
    let x = 0;
    glyphs.forEach((g, i) => { pos.push(x); x += g.advanceWidth * k + sp; if (glyphs[i + 1]) x += f.getKerningValue(g, glyphs[i + 1]) * k; });
    return { f, size, glyphs, pos, width: x };
  }
  measureText(str) { return { width: this.layout(str).width }; }
  fillText(str, x, y) {
    const L = this.layout(str), { f, size } = L, al = this.st.textAlign, bl = this.st.textBaseline;
    const x0 = x - (al === 'center' ? L.width / 2 : al === 'right' || al === 'end' ? L.width : 0);
    const y0 = bl === 'middle' ? y + (f.ascender + f.descender) / 2 / f.unitsPerEm * size : bl === 'top' ? y + f.ascender / f.unitsPerEm * size : y;
    const out = [];
    L.glyphs.forEach((g, i) => {
      if (!g.index) return; // no glyph for this character in the font: skip it, like a missing-glyph box would
      let px = 0, py = 0;
      for (const c of g.getPath(x0 + L.pos[i], y0, size).commands) {
        if (c.type === 'M' || c.type === 'L') out.push(`${n(c.x)} ${n(c.y)} ${c.type.toLowerCase()}`);
        else if (c.type === 'C') out.push(`${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)} c`);
        else if (c.type === 'Q') out.push(`${n(px + 2 / 3 * (c.x1 - px))} ${n(py + 2 / 3 * (c.y1 - py))} ${n(c.x + 2 / 3 * (c.x1 - c.x))} ${n(c.y + 2 / 3 * (c.y1 - c.y))} ${n(c.x)} ${n(c.y)} c`);
        else if (c.type === 'Z') out.push('h');
        if (c.type !== 'Z') { px = c.x; py = c.y; }
      }
    });
    if (out.length) { this.paint(this.st.fillStyle, false); this.ops.push(...out, 'f'); }
  }

  drawImage(img, x, y, w, h) {
    const per = this.imgNames.get(img) || new Map(), filter = this.st.filter || 'none';
    this.imgNames.set(img, per);
    let name = per.get(filter);
    if (!name) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.filter = filter; g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, alpha = new Uint8Array(d.length / 4);
      let opaque = true;
      for (let i = 0; i < alpha.length; i++) { alpha[i] = d[i * 4 + 3]; if (alpha[i] < 255) opaque = false; }
      const { data, cmyk } = this.pixels(d);
      name = `Im${Object.keys(this.images).length}`;
      this.images[name] = { width: c.width, height: c.height, pixels: data, cmyk, smask: opaque ? null : alpha };
      per.set(filter, name);
    }
    this.gs(1);
    this.ops.push('q', `${n(w)} 0 0 ${n(-h)} ${n(x)} ${n(y + h)} cm`, `/${name} Do`, 'Q');
  }
}
