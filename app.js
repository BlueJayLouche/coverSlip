import { VHS, VHS_SPLIT, pieces, jcard, fits, BLEED as B, PAPERS, pdf } from './lib.js';

const LCMS_URL = 'https://cdn.jsdelivr.net/npm/lcms-wasm@1.0.5/dist/lcms.js';
const FONTS = ['Montserrat', 'Bebas Neue', 'Righteous', 'Monoton', 'VT323', 'Press Start 2P', 'Russo One', 'Permanent Marker'];
const BLENDS = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const PALETTES = { // 5 stripes (inner → outer), dark, light
  Rainbow: ['#ffc400', '#ff6a00', '#ff1744', '#b000c8', '#4a00b8', '#0b0d12', '#ece0bf'],
  Sunset: ['#ffd166', '#f8961e', '#f3722c', '#f94144', '#90323d', '#1d1a2f', '#f6ead4'],
  Neon: ['#fee440', '#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#0a0a14', '#e9e4f0'],
  Pastel: ['#ffe29a', '#ffc3a0', '#ff9aa2', '#d5a6e6', '#a0c4ff', '#2b2d42', '#f8f1e5'],
  Mono: ['#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575', '#4e4e4e', '#101010', '#ededed'],
};
const FIELDS = [ // key, label, default, multiline
  ['title', 'Front title', 'E-240'],
  ['subtitle', 'Front subtitle bar', 'EXTRA LONG PLAY'],
  ['tagline', 'Front tagline', 'HOME VIDEO'],
  ['label', 'Front label', '1989'],
  ['line1', 'Front line 1', 'FAMILY ARCHIVE'],
  ['line2', 'Front line 2', 'SUMMER TAPES'],
  ['blurb', 'Front blurb', 'Write what is on this tape here — dates, places, people, whatever you want to remember in thirty years.', true],
  ['brand', 'Footer brand', 'MEMORY LANE'],
  ['brand2', 'Footer sub-brand', 'VIDEO LABS'],
  ['spineTitle', 'Spine title', 'E-240'],
  ['spineSub', 'Spine subtitle', 'VIDEO CASSETTE'],
  ['badges', 'Badges (comma-separated)', 'VHS, HQ, HI-FI'],
  ['backTitle', 'Back title / J-card fold-out heading', 'CONTENTS'],
  ['backSub', 'Back corner text', 'SIDE A'],
  ['bullets', 'Back paragraphs / J-card fold-out list (one per line)', 'Birthday party at the lake house, grandma on the swing.\nFirst day of school, the new bike, the dog in the sprinkler.\nChristmas morning 1989 until the tape runs out.', true],
  ['recHeading', 'Table heading', 'RECORDING TIME'],
  ['sp', 'SP mode', '120 MIN'],
  ['lp', 'LP mode', '240 MIN'],
  ['ep', 'EP mode', '360 MIN'],
  ['barcode', 'Barcode number', '0 48291 77310 5'],
];
const defaults = () => ({
  theme: Object.fromEntries(FIELDS.map((f) => [f[0], f[2]])),
  colors: [...PALETTES.Rainbow], mirrorSpine: true, layers: [],
  format: 'vhs', splitLid: false, jflap: 15.9, jextra: 0, // jcard: back-flap width mm, fold-out panel count
  paper: 'A3', mode: 'rgb', guides: true, dielineOnly: false, profile: null, // profile: { name, asset }
});

let S = defaults();       // everything that's saved and undoable
let assets = {};          // id → { url, img? }  (images and the ICC profile, as data URLs)
let sel = null;           // selected layer id
let softProof = false, cms = null, lcmsP = null;
const view = { s: 1, x: 0, y: 0, fit: 1 }; // css px per mm, offset of bleed-box origin
const $ = (q) => document.querySelector(q);
const uid = () => Math.random().toString(36).slice(2, 10);
const O = 10; // theme shapes overdraw this far past panel edges; the panel clip trims them
let F, CUT, SLITS, FOLDS, AW, AH, geoKey, refit; // current format's geometry; AW × AH = bleed box
function geo() { // rebuild when the format settings change
  S.jflap = Math.min(40, Math.max(10, +S.jflap || 15.9)); S.jextra = Math.min(3, Math.max(0, Math.round(+S.jextra) || 0));
  const k = `${S.format}|${S.splitLid}|${S.jflap}|${S.jextra}`;
  if (k === geoKey) return;
  geoKey = k; refit = true; F = S.format === 'jcard' ? jcard(S.jflap, S.jextra) : S.splitLid ? VHS_SPLIT : VHS;
  CUT = new Path2D(F.cut); SLITS = new Path2D(F.slits); FOLDS = new Path2D(F.folds);
  AW = F.w + 2 * B; AH = F.h + 2 * B;
}
geo();
const mctx = document.createElement('canvas').getContext('2d'); // for measuring text

// ---------- drawing (ctx units = mm, origin = dieline top-left) ----------

function text(ctx, str, x, y, size, { weight = 800, color, maxW = Infinity, align = 'left', font = 'Montserrat', spacing = 0 } = {}) {
  if (!str) return;
  ctx.letterSpacing = `${spacing}px`;
  ctx.font = `${weight} ${size}px "${font}"`;
  const w = ctx.measureText(str).width;
  if (w > maxW) ctx.font = `${weight} ${size * maxW / w}px "${font}"`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.letterSpacing = '0px';
}

function wrap(ctx, str, x, y, maxW, size, lh, color, weight = 500, maxY = Infinity) { // stops at maxY
  ctx.font = `${weight} ${size}px Montserrat`; ctx.fillStyle = color; ctx.textAlign = 'left';
  let line = '';
  for (const word of str.split(/\s+/)) {
    const t = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(t).width > maxW) { if (y > maxY) return y; ctx.fillText(line, x, y); y += lh; line = word; } else line = t;
  }
  if (line && y <= maxY) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

function boxed(ctx, str, cx, y, size, color) { // badge: text in a thin box, centred on cx
  ctx.font = `600 ${size}px Montserrat`;
  const w = ctx.measureText(str).width + size;
  ctx.strokeStyle = color; ctx.lineWidth = size * 0.09;
  ctx.strokeRect(cx - w / 2, y - size * 1.05, w, size * 1.45);
  text(ctx, str, cx, y, size, { weight: 600, color, align: 'center' });
  return w;
}

function barcode(ctx, num, x, y, w, h, color) { // decorative, not a scannable UPC
  const bars = []; let pos = 0;
  for (const ch of `*${num}*`) {
    const c = ch.charCodeAt(0) * 7 + 3;
    for (let k = 0; k < 3; k++) { const bw = 0.25 + ((c >> k) & 1) * 0.4; bars.push([pos, bw]); pos += bw + 0.3 + ((c >> (k + 3)) & 1) * 0.35; }
  }
  const f = w / pos;
  ctx.fillStyle = color;
  for (const [p, bw] of bars) ctx.fillRect(x + p * f, y, bw * f, h);
  text(ctx, num, x + w / 2, y + h + 3.6, 2.8, { weight: 500, color, align: 'center', spacing: 0.3 });
}

function ext(p) { // panel rect, grown by the bleed on edges that aren't shared with a neighbour
  const last = Object.values(F.panels).at(-1);
  const x0 = p.x === 0 ? -B : p.x, x1 = p.x + p.w + (p === last ? B : 0);
  return { x: x0, y: p.y - B, w: x1 - x0, h: p.h + 2 * B };
}

function inPanel(ctx, p, fn) {
  const e = ext(p);
  ctx.save(); ctx.beginPath(); ctx.rect(e.x, e.y, e.w, e.h); ctx.clip();
  ctx.translate(p.x, p.y); fn(ctx, p.w, p.h); ctx.restore();
}

const col = () => ({ s: S.colors.slice(0, 5), dark: S.colors[5], light: S.colors[6] });
const FRONT = (W, H) => ({ sw: 4, Xs: W - 26, Ys: H * 0.64, R: 22 });

function frontShapes(ctx, W, H) {
  const { s, dark } = col(), { sw, Xs, Ys, R } = FRONT(W, H);
  ctx.fillStyle = dark; ctx.beginPath(); // dark window, rounded bottom-right corner
  ctx.moveTo(-O, -O); ctx.lineTo(Xs, -O); ctx.lineTo(Xs, Ys - R); ctx.arc(Xs - R, Ys - R, R, 0, Math.PI / 2); ctx.lineTo(-O, Ys); ctx.fill();
  s.forEach((c, i) => { // stripe band hugging the window: in from the left, round the corner, up and out the top
    const d = i * sw + sw / 2;
    ctx.strokeStyle = c; ctx.lineWidth = sw + 0.1; ctx.beginPath();
    ctx.moveTo(-O, Ys + d); ctx.lineTo(Xs - R, Ys + d); ctx.arc(Xs - R, Ys - R, R + d, Math.PI / 2, 0, true); ctx.lineTo(Xs + d, -O); ctx.stroke();
  });
  ctx.fillStyle = dark; ctx.fillRect(-O, H - 24, W + 2 * O, 14); // footer bar
  s.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-O, H - 22 + i * 2.2, 36 + O, 1); });
}

function frontText(ctx, W, H) {
  const { s, dark, light } = col(), { Xs, Ys } = FRONT(W, H), t = S.theme;
  text(ctx, t.title, 7, 30, 24, { color: light, maxW: Xs - 12 });
  if (t.subtitle) {
    ctx.fillStyle = light; ctx.fillRect(-O, 37, Xs - 4 + O, 8);
    ctx.fillStyle = s[2]; ctx.fillRect(-O, 45, Xs - 4 + O, 1.2);
    text(ctx, t.subtitle, 7, 42.8, 4.6, { weight: 700, color: dark, maxW: Xs - 14 });
  }
  const compact = H < 170; // J-card front: less room between the subtitle bar and the label
  text(ctx, t.tagline, 7, compact ? 57 : 62, compact ? 8 : 11, { color: light, maxW: Xs - 14 });
  text(ctx, t.label, 7, Ys - 32, 13, { color: light, maxW: Xs - 14 });
  if (t.label) { ctx.fillStyle = light; ctx.fillRect(-O, Ys - 29, 52 + O, 0.4); }
  text(ctx, t.line1, 7, Ys - 22, 4, { weight: 500, color: light, maxW: Xs - 14 });
  text(ctx, t.line2, 7, Ys - 16, 4, { weight: 500, color: light, maxW: Xs - 14 });
  if (t.blurb) wrap(ctx, t.blurb, 8, Ys + 28, W - 16, 2.8, 3.8, dark, 500, H - 27);
  text(ctx, t.brand, W - 6, H - 16.3, 6, { color: light, align: 'right', maxW: W - 50 });
  text(ctx, t.brand2, W - 6, H - 12, 2.8, { weight: 500, color: light, align: 'right', spacing: 0.8, maxW: W - 50 });
}

function spineShapes(ctx, w, h, plain) {
  const { s, dark } = col();
  for (let i = 0; i < 5; i++) { // stripe caps, purple on the outside
    ctx.fillStyle = s[4 - i];
    ctx.fillRect(-O, i ? i * 3 : -O, w + 2 * O, i ? 3 : 3 + O);
    ctx.fillRect(-O, h - (i + 1) * 3, w + 2 * O, i ? 3 : 3 + O);
  }
  if (plain) return;
  ctx.fillStyle = s[2]; ctx.fillRect(-O, 40, w + 2 * O, 1.5); ctx.fillRect(-O, h - 41.5, w + 2 * O, 1.5);
  ctx.fillStyle = dark; ctx.fillRect(-O, 42, w + 2 * O, h - 84);
}

function spineText(ctx, w, h) {
  const { dark, light } = col(), t = S.theme, badges = t.badges.split(',').map((b) => b.trim()).filter(Boolean);
  if (badges[0]) boxed(ctx, badges[0], w / 2, 30, 4.6, dark);
  if (badges[1]) boxed(ctx, badges[1], w / 2, h - 25, 4.6, dark);
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 2); // reads top-to-bottom
  text(ctx, t.spineTitle, 0, 3, 11, { color: light, align: 'center', maxW: h - 96 });
  text(ctx, t.spineSub, 0, 9, 3.4, { weight: 500, color: light, align: 'center', spacing: 0.6, maxW: h - 96 });
  ctx.restore();
}

const BACK = (H) => H * 0.56;

function backShapes(ctx, W, H) {
  const { s, dark } = col(), Yd = BACK(H);
  ctx.fillStyle = dark; ctx.fillRect(-O, -O, W + 2 * O, 30 + O); ctx.fillRect(-O, Yd, W + 2 * O, H - Yd + O);
  s.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-O, 30 + i * 1.5, W + 2 * O, 1.5); ctx.fillRect(-O, Yd - 12.5 + i * 2.5, W + 2 * O, 2.5); });
}

function backText(ctx, W, H) {
  const { s, dark, light } = col(), t = S.theme, Yd = BACK(H);
  text(ctx, t.backTitle, 7, 20, 9, { color: light, maxW: W - 45 });
  text(ctx, t.backSub, W - 7, 20, 3.6, { weight: 600, color: light, align: 'right', spacing: 0.6, maxW: 30 });
  let y = 48;
  t.bullets.split('\n').map((b) => b.trim()).filter(Boolean).slice(0, 5).forEach((b, i) => {
    if (y > Yd - 20) return;
    ctx.fillStyle = s[i % 5]; ctx.fillRect(7, y - 2.6, 7, 3);
    y = wrap(ctx, b, 18, y, W - 25, 2.9, 4, dark) + 3.5;
  });
  text(ctx, t.recHeading, 10, Yd + 14, 3.6, { weight: 600, color: light, spacing: 1.2, maxW: W - 20 });
  ctx.strokeStyle = light; ctx.lineWidth = 0.35;
  let ry = Yd + 18;
  for (const [k, v] of [['SP MODE', t.sp], ['LP MODE', t.lp], ['EP MODE', t.ep]]) {
    if (!v) continue;
    ctx.strokeRect(10, ry, 58, 7);
    text(ctx, k, 13, ry + 5, 3.2, { weight: 500, color: light });
    text(ctx, v, 44, ry + 5, 3.2, { weight: 500, color: light, maxW: 22 });
    ry += 7;
  }
  let bx = 10;
  for (const b of t.badges.split(',').map((x) => x.trim()).filter(Boolean)) {
    ctx.font = '600 3.6px Montserrat';
    const w = ctx.measureText(b).width + 3.6;
    if (bx + w > W - 44) break;
    boxed(ctx, b, bx + w / 2, H - 12, 3.6, light); bx += w + 3;
  }
  if (t.barcode) barcode(ctx, t.barcode, W - 38, H - 30, 30, 13, light);
}

// ---------- cassette J-card theme (front = the VHS front drawn at VHS width, scaled down) ----------

const scaled = (fn) => (ctx, w, h) => { const k = w / VHS.panels.front.w; ctx.scale(k, k); fn(ctx, w / k, h / k); };
const badges = () => S.theme.badges.split(',').map((b) => b.trim()).filter(Boolean);
const stripes = (ctx, y, w, t) => col().s.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-O, y + i * t, w + 2 * O, t); });

function jSpineShapes(ctx, w, h) {
  const { s, dark } = col();
  ctx.fillStyle = dark; ctx.fillRect(-O, -O, w + 2 * O, h + 2 * O);
  for (let i = 0; i < 5; i++) { // stripe caps, purple on the outside
    ctx.fillStyle = s[4 - i];
    ctx.fillRect(-O, i ? i * 1.2 : -O, w + 2 * O, i ? 1.2 : 1.2 + O);
    ctx.fillRect(-O, h - (i + 1) * 1.2, w + 2 * O, i ? 1.2 : 1.2 + O);
  }
}

function jSpineText(ctx, w, h) {
  const { light } = col(), t = S.theme;
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 2); // reads top-to-bottom
  text(ctx, t.spineTitle, -h / 2 + 10, 2.1, 6, { color: light, maxW: h * 0.55 });
  text(ctx, t.spineSub, h / 2 - 10, 1.5, 2.6, { weight: 500, color: light, align: 'right', spacing: 0.4, maxW: h * 0.28 });
  ctx.restore();
}

function flapShapes(ctx, w, h) { ctx.fillStyle = col().dark; ctx.fillRect(-O, -O, w + 2 * O, h + 2 * O); stripes(ctx, 8, w, 1.2); }

function flapText(ctx, w, h) {
  const { light } = col();
  let y = 26;
  for (const b of badges()) { if (y > h - 16) break; boxed(ctx, b, w / 2, y, Math.min(3, w / 5), light); y += 7; }
  text(ctx, S.theme.backSub, w / 2, h - 8, 2.4, { weight: 600, color: light, align: 'center', maxW: w - 3 });
}

function insidesText(ctx, P) { // heading + one-per-line list, flowing across fold-outs left to right
  const { s, dark } = col(), t = S.theme, items = t.bullets.split('\n').map((b) => b.trim()).filter(Boolean);
  let i = 0;
  Object.entries(P).filter(([k]) => k.startsWith('inside')).forEach(([, p], n) => inPanel(ctx, p, (c, w, h) => {
    let y = 20;
    if (n === 0 && t.backTitle) { text(c, t.backTitle, 6, 22, 6, { color: dark, maxW: w - 12 }); y = 32; }
    for (; i < items.length && y < h - 10; i++) {
      c.fillStyle = s[i % 5]; c.fillRect(6, y - 2.2, 3.5, 2.4);
      y = wrap(c, items[i], 12, y, w - 18, 2.6, 3.5, dark, 500, h - 7) + 2.5;
    }
  }));
}

const THEMES = { // shapes go under the layers, text over them
  VHS: {
    shapes: (ctx, P) => {
      inPanel(ctx, P.front, frontShapes); inPanel(ctx, P.back, backShapes);
      inPanel(ctx, P.spine, (c, w, h) => spineShapes(c, w, h)); inPanel(ctx, P.side, (c, w, h) => spineShapes(c, w, h, !S.mirrorSpine));
    },
    text: (ctx, P) => {
      inPanel(ctx, P.front, frontText); inPanel(ctx, P.back, backText);
      inPanel(ctx, P.spine, spineText); if (S.mirrorSpine) inPanel(ctx, P.side, spineText);
    },
  },
  'J-card': {
    shapes: (ctx, P) => {
      inPanel(ctx, P.front, scaled(frontShapes)); inPanel(ctx, P.spine, jSpineShapes); inPanel(ctx, P.flap, flapShapes);
      for (const [k, p] of Object.entries(P)) if (k.startsWith('inside')) inPanel(ctx, p, (c, w) => stripes(c, 6, w, 1.2));
    },
    text: (ctx, P) => { inPanel(ctx, P.front, scaled(frontText)); inPanel(ctx, P.spine, jSpineText); inPanel(ctx, P.flap, flapText); insidesText(ctx, P); },
  },
};

function panelRect(clip) { const p = F.panels[clip]; return p ? ext(p) : null; }

function layerSize(l) {
  if (l.type === 'image') return [l.w, l.h];
  mctx.letterSpacing = `${l.spacing}px`; mctx.font = `${l.weight} ${l.size}px "${l.font}"`;
  const lines = l.text.split('\n');
  return [Math.max(1, ...lines.map((x) => mctx.measureText(x).width)), l.size * 1.15 * lines.length];
}

function drawLayer(ctx, l) {
  const r = panelRect(l.clip);
  ctx.save();
  if (r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
  ctx.translate(l.x, l.y); ctx.rotate(l.rot * Math.PI / 180);
  ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blend;
  if (l.type === 'image') {
    const img = assets[l.asset]?.img;
    if (img) {
      ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
      ctx.filter = `brightness(${l.bri}%) contrast(${l.con}%) saturate(${l.sat}%) grayscale(${l.gray}%)`;
      ctx.drawImage(img, -l.w / 2, -l.h / 2, l.w, l.h);
    }
  } else {
    const lines = l.text.split('\n'), lh = l.size * 1.15;
    ctx.letterSpacing = `${l.spacing}px`; ctx.font = `${l.weight} ${l.size}px "${l.font}"`;
    ctx.fillStyle = l.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((t, i) => ctx.fillText(t, 0, (i - (lines.length - 1) / 2) * lh));
  }
  ctx.restore();
}

function drawArt(ctx) { // ctx origin = bleed-box top-left, units mm
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, AW, AH); ctx.clip(); ctx.translate(B, B);
  drawContent(ctx);
  ctx.restore();
}

function drawContent(ctx) { // ctx origin = dieline top-left
  const P = F.panels;
  if (S.dielineOnly) {
    ctx.fillStyle = '#fff'; ctx.fillRect(-B, -B, AW, AH);
    for (const [k, p] of Object.entries(P)) {
      ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); if (p.w < 40) ctx.rotate(Math.PI / 2);
      text(ctx, `${k.toUpperCase()}  ${p.w < 40 ? '←' : '↑'} top`, 0, 0, 7, { weight: 600, color: '#999', align: 'center' });
      ctx.restore();
    }
  } else {
    ctx.fillStyle = col().light; ctx.fillRect(-B, -B, AW, AH);
    THEMES[F.name].shapes(ctx, P);
    for (const l of S.layers) if (l.visible) drawLayer(ctx, l);
    THEMES[F.name].text(ctx, P);
  }
}

function drawGuides(ctx, px, g = { cut: CUT, slits: SLITS, folds: FOLDS }) { // px = one device pixel in mm, so lines stay hairline on screen
  ctx.save(); ctx.lineWidth = Math.max(0.2, px);
  ctx.strokeStyle = '#e0001b'; ctx.stroke(g.cut); ctx.stroke(g.slits);
  ctx.strokeStyle = '#2f6fd6'; ctx.setLineDash([2, 1.5]); ctx.stroke(g.folds);
  ctx.restore();
}

// ---------- editor view ----------

const cv = $('#cv'), vctx = cv.getContext('2d'), stage = $('#stage');

function fit() {
  const r = stage.getBoundingClientRect();
  view.fit = Math.min((r.width - 40) / AW, (r.height - 40) / AH);
  view.s = view.fit; view.x = (r.width - AW * view.s) / 2; view.y = (r.height - AH * view.s) / 2;
  $('#zoom').value = 1; render();
}

function zoomAt(s, cx, cy) {
  s = Math.min(Math.max(s, view.fit * 0.25), view.fit * 8);
  view.x = cx - (cx - view.x) * s / view.s; view.y = cy - (cy - view.y) * s / view.s; view.s = s;
  $('#zoom').value = s / view.fit; render();
}

const toMm = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.s - B, y: (e.clientY - r.top - view.y) / view.s - B }; };
const toScreen = (p) => ({ x: view.x + (p.x + B) * view.s, y: view.y + (p.y + B) * view.s });
const rotp = (p, deg) => { const a = deg * Math.PI / 180; return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }; };
const toLocal = (l, p) => rotp({ x: p.x - l.x, y: p.y - l.y }, -l.rot);
const toWorld = (l, p) => { const q = rotp(p, l.rot); return { x: l.x + q.x, y: l.y + q.y }; };
const selected = () => S.layers.find((l) => l.id === sel) || null;
function reclip(l) { // a panel-clipped layer moved onto another panel follows it, instead of vanishing
  if (l.clip === 'sheet') return;
  const hit = Object.entries(F.panels).find(([, p]) => l.x >= p.x && l.x < p.x + p.w && l.y >= p.y && l.y < p.y + p.h);
  if (hit) l.clip = hit[0];
}

function handles(l) { // screen-space positions of the corner (scale) and rotate handles
  const [w, h] = layerSize(l);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toScreen(toWorld(l, { x: a * w / 2, y: b * h / 2 })));
  const rot = toScreen(toWorld(l, { x: 0, y: -h / 2 - 24 / view.s }));
  return { corners, rot, top: toScreen(toWorld(l, { x: 0, y: -h / 2 })) };
}

function render() {
  geo(); if (refit) { refit = false; return fit(); }
  const dpr = devicePixelRatio || 1, r = stage.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.fillStyle = '#4a4b52'; vctx.fillRect(0, 0, cv.width, cv.height);
  const k = dpr * view.s;
  vctx.setTransform(k, 0, 0, k, dpr * view.x, dpr * view.y);
  drawArt(vctx);
  vctx.save(); vctx.translate(B, B);
  const outside = new Path2D(); outside.rect(-B, -B, AW, AH); outside.addPath(CUT);
  vctx.fillStyle = 'rgba(74,75,82,.6)'; vctx.fill(outside, 'evenodd'); // dim the bleed that gets cut off
  drawGuides(vctx, 1 / k);
  vctx.restore();
  if (softProof && cms) {
    const im = vctx.getImageData(0, 0, cv.width, cv.height);
    const rgb = transform(cms.lib, cms.proof, im.data, 3);
    for (let i = 0, j = 0; i < im.data.length; i += 4, j += 3) { im.data[i] = rgb[j]; im.data[i + 1] = rgb[j + 1]; im.data[i + 2] = rgb[j + 2]; }
    vctx.putImageData(im, 0, 0);
  }
  if (F.pieces) { // split lid: make the cut between the two sheets obvious
    const a = toScreen({ x: 0, y: F.pieces[0].y }), b = toScreen({ x: F.w, y: F.pieces[0].y }), label = '✂ split — lid + flaps print on sheet 2';
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.strokeStyle = '#e0001b'; vctx.lineWidth = 2; vctx.setLineDash([8, 5]);
    vctx.beginPath(); vctx.moveTo(a.x, a.y); vctx.lineTo(b.x, b.y); vctx.stroke(); vctx.setLineDash([]);
    vctx.font = '600 11px system-ui'; vctx.textBaseline = 'middle'; vctx.textAlign = 'left';
    const w = vctx.measureText(label).width + 12;
    vctx.fillStyle = '#e0001b'; vctx.fillRect(b.x - w, a.y - 22, w, 18);
    vctx.fillStyle = '#fff'; vctx.fillText(label, b.x - w + 6, a.y - 13);
  }
  const l = selected();
  if (l && l.visible) {
    const h = handles(l);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.strokeStyle = '#ff6a00'; vctx.lineWidth = 1.5; vctx.beginPath();
    h.corners.forEach((c, i) => (i ? vctx.lineTo(c.x, c.y) : vctx.moveTo(c.x, c.y))); vctx.closePath();
    vctx.moveTo(h.top.x, h.top.y); vctx.lineTo(h.rot.x, h.rot.y); vctx.stroke();
    vctx.fillStyle = '#fff';
    for (const c of h.corners) { vctx.fillRect(c.x - 5, c.y - 5, 10, 10); vctx.strokeRect(c.x - 5, c.y - 5, 10, 10); }
    vctx.beginPath(); vctx.arc(h.rot.x, h.rot.y, 6, 0, 7); vctx.fill(); vctx.stroke();
  }
}

let drag = null;
cv.addEventListener('pointerdown', (e) => {
  const m = toMm(e), r = cv.getBoundingClientRect(), sp = { x: e.clientX - r.left, y: e.clientY - r.top };
  const near = (p) => Math.hypot(p.x - sp.x, p.y - sp.y) < 9;
  let l = selected(), mode = null;
  if (l && l.visible) { const h = handles(l); mode = near(h.rot) ? 'rotate' : h.corners.some(near) ? 'scale' : null; }
  if (!mode) {
    l = [...S.layers].reverse().find((x) => { if (!x.visible) return false; const p = toLocal(x, m), [w, h] = layerSize(x); return Math.abs(p.x) <= w / 2 && Math.abs(p.y) <= h / 2; }) || null;
    sel = l?.id ?? null; mode = l ? 'move' : 'pan';
    syncLayers();
  }
  drag = { mode, m, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, l: l && { ...l } };
  cv.setPointerCapture(e.pointerId); render();
});
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const m = toMm(e), l = selected(), o = drag.l;
  if (drag.mode === 'pan') { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; }
  else if (drag.mode === 'move') { l.x = o.x + m.x - drag.m.x; l.y = o.y + m.y - drag.m.y; reclip(l); }
  else if (drag.mode === 'rotate') {
    let a = Math.atan2(m.y - o.y, m.x - o.x) * 180 / Math.PI + 90;
    if (e.shiftKey) a = Math.round(a / 15) * 15;
    l.rot = +(((a % 360) + 360) % 360).toFixed(1);
  } else if (drag.mode === 'scale') {
    if (l.type === 'image' && e.shiftKey) { const p = toLocal(o, m); l.w = Math.max(1, 2 * Math.abs(p.x)); l.h = Math.max(1, 2 * Math.abs(p.y)); }
    else {
      const f = Math.max(0.02, Math.hypot(m.x - o.x, m.y - o.y) / (Math.hypot(drag.m.x - o.x, drag.m.y - o.y) || 1));
      if (l.type === 'image') { l.w = o.w * f; l.h = o.h * f; } else l.size = Math.max(1, o.size * f);
    }
  }
  render(); if (drag.mode !== 'pan') syncProps();
});
cv.addEventListener('pointerup', () => { if (drag && drag.mode !== 'pan') commit(); drag = null; });
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey) zoomAt(view.s * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
  else { view.x -= e.deltaX; view.y -= e.deltaY; render(); }
}, { passive: false });
$('#zoom').oninput = (e) => { const r = stage.getBoundingClientRect(); zoomAt(view.fit * +e.target.value, r.width / 2, r.height / 2); };
$('#fit').onclick = fit;
new ResizeObserver(render).observe(stage);

// ---------- undo / autosave / project files ----------

let snap = JSON.stringify(S), undos = [], redos = [];
function commit() {
  const now = JSON.stringify(S);
  if (now === snap) return;
  undos.push(snap); if (undos.length > 50) undos.shift();
  redos = []; snap = now; autosave();
}
function step(from, to) {
  commit();
  if (!from.length) return;
  to.push(snap); snap = from.pop(); S = JSON.parse(snap);
  syncUI(); render(); autosave();
}
const undo = () => step(undos, redos), redo = () => step(redos, undos);

const idb = new Promise((res, rej) => {
  const r = indexedDB.open('coverslip', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const idbDo = async (mode, fn) => { const db = await idb; return new Promise((res, rej) => { const t = db.transaction('kv', mode); const q = fn(t.objectStore('kv')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); };
let saveTimer;
function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => idbDo('readwrite', (s) => s.put(project(), 'autosave')).catch(console.warn), 800); }

function project() {
  const used = new Set([...S.layers.map((l) => l.asset), S.profile?.asset].filter(Boolean));
  return { app: 'coverslip', version: 1, state: S, assets: Object.fromEntries([...used].map((id) => [id, assets[id].url])) };
}

async function loadAsset(id, url) {
  if (typeof url !== 'string' || !url.startsWith('data:')) throw new Error('bad asset');
  assets[id] = { url };
  if (url.startsWith('data:image/')) { const img = new Image(); img.src = url; await img.decode(); assets[id].img = img; }
}

async function loadProject(p) { // p may come from someone else's file: only data: URLs, known keys
  if (p?.app !== 'coverslip' || typeof p.state !== 'object') throw new Error('Not a CoverSlip project file');
  assets = {};
  await Promise.all(Object.entries(p.assets || {}).map(([id, url]) => loadAsset(id, url)));
  const d = defaults();
  S = { ...d, ...p.state, theme: { ...d.theme, ...p.state.theme } };
  if (!Array.isArray(S.layers)) S.layers = [];
  cms = null; sel = null; snap = JSON.stringify(S); undos = []; redos = [];
  syncUI(); render(); autosave();
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const fileName = (ext) => `${(S.theme.title || 'coverslip').replace(/[^\w-]+/g, '_')}.${ext}`;
const readAs = (file, how) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r[how](file); });
const status = (s) => { $('#status').textContent = s; };

// ---------- layers ----------

async function addImage(file) {
  const id = uid();
  await loadAsset(id, await readAs(file, 'readAsDataURL'));
  const img = assets[id].img, f = F.panels.front;
  const w = f.w + 2 * B, h = w * img.height / img.width;
  const l = { id: uid(), type: 'image', asset: id, name: file.name, x: f.x + f.w / 2, y: f.y + f.h / 2, w, h, rot: 0, flipX: false, flipY: false, opacity: 1, blend: 'source-over', clip: 'front', visible: true, bri: 100, con: 100, sat: 100, gray: 0 };
  S.layers.push(l); sel = l.id; commit(); syncLayers(); render();
}

function addText() {
  const f = F.panels.front;
  const l = { id: uid(), type: 'text', text: 'NEW TEXT', font: 'Bebas Neue', weight: 400, size: 14, color: '#ffffff', spacing: 0, x: f.x + f.w / 2, y: f.y + f.h / 2, rot: 0, opacity: 1, blend: 'source-over', clip: 'sheet', visible: true };
  S.layers.push(l); sel = l.id; commit(); syncLayers(); render();
}

function syncLayers() {
  const ul = $('#layers'); ul.innerHTML = '';
  if (!S.layers.length) ul.innerHTML = '<li class="empty">No layers — add an image or text, or drop files on the canvas.</li>';
  [...S.layers].reverse().forEach((l) => {
    const li = document.createElement('li'), i = S.layers.indexOf(l);
    li.className = l.id === sel ? 'sel' : '';
    li.innerHTML = '<input type="checkbox" title="Visible"><span></span><button title="Up">↑</button><button title="Down">↓</button><button title="Delete">✕</button>';
    const [vis, , up, down, del] = li.children;
    vis.checked = l.visible; li.children[1].textContent = l.type === 'image' ? `🖼 ${l.name}` : `T ${l.text.split('\n')[0] || '(empty)'}`;
    vis.onclick = (e) => { e.stopPropagation(); l.visible = vis.checked; commit(); render(); };
    const move = (d) => (e) => { e.stopPropagation(); const j = i + d; if (j < 0 || j >= S.layers.length) return; [S.layers[i], S.layers[j]] = [S.layers[j], S.layers[i]]; commit(); syncLayers(); render(); };
    up.onclick = move(1); down.onclick = move(-1);
    del.onclick = (e) => { e.stopPropagation(); removeLayer(l); };
    li.onclick = () => { sel = l.id; syncLayers(); render(); };
    ul.append(li);
  });
  buildProps();
}

function removeLayer(l) { S.layers = S.layers.filter((x) => x !== l); if (sel === l.id) sel = null; commit(); syncLayers(); render(); }

const opts = (list, labels = list) => list.map((v, i) => `<option value="${v}">${labels[i]}</option>`).join('');

function buildProps() { // built on selection change; values filled by syncProps
  const l = selected(), el = $('#props');
  if (!l) { el.innerHTML = ''; return; }
  const num = (k, label, step = 0.5) => `<label>${label}<input type="number" step="${step}" data-p="${k}"></label>`;
  const range = (k, label, min, max, step = 1) => `<label>${label}<input type="range" min="${min}" max="${max}" step="${step}" data-p="${k}"></label>`;
  el.innerHTML = `<h2>${l.type === 'image' ? 'Image' : 'Text'} layer</h2>
    ${l.type === 'text' ? `<label>Text<textarea rows="2" data-p="text"></textarea></label>
      <div class="grid2"><label>Font<select data-p="font">${opts(FONTS)}</select></label><label>Weight<select data-p="weight">${opts(['400', '600', '800'])}</select></label>
      ${num('size', 'Size mm')}${num('spacing', 'Spacing mm', 0.1)}<label>Colour<input type="color" data-p="color"></label></div>` : ''}
    <div class="grid2">${num('x', 'X mm')}${num('y', 'Y mm')}
      ${l.type === 'image' ? num('w', 'W mm') + num('h', 'H mm') : ''}${num('rot', 'Rotate °', 1)}
      <label>Clip to<select data-p="clip">${opts(['sheet', ...Object.keys(F.panels)], ['Whole sheet', ...Object.keys(F.panels).map((k) => k[0].toUpperCase() + k.slice(1))])}</select></label></div>
    ${range('opacity', 'Opacity', 0, 1, 0.01)}
    <label>Blend<select data-p="blend">${opts(BLENDS, ['normal', ...BLENDS.slice(1)])}</select></label>
    ${l.type === 'image' ? `<div class="grid2"><label class="row"><input type="checkbox" data-p="flipX"> Flip H</label><label class="row"><input type="checkbox" data-p="flipY"> Flip V</label>
      ${range('bri', 'Brightness', 0, 200)}${range('con', 'Contrast', 0, 200)}${range('sat', 'Saturation', 0, 300)}${range('gray', 'Grayscale', 0, 100)}</div>` : ''}`;
  syncProps();
}

function syncProps() {
  const l = selected();
  if (!l) return;
  for (const i of $('#props').querySelectorAll('[data-p]')) {
    if (i === document.activeElement) continue;
    const v = l[i.dataset.p];
    if (i.type === 'checkbox') i.checked = v; else i.value = typeof v === 'number' && i.type === 'number' ? +v.toFixed(2) : v;
  }
}

$('#props').addEventListener('input', (e) => {
  const l = selected(), t = e.target, k = t.dataset.p;
  if (!l || !k) return;
  l[k] = t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.type === 'range' || k === 'weight') ? +t.value : t.value;
  if (k === 'text') syncLayerNames();
  if (k === 'x' || k === 'y') { reclip(l); syncProps(); }
  render();
});
$('#props').addEventListener('change', commit);
const syncLayerNames = () => { const t = $('#layers li.sel span'), l = selected(); if (t && l?.type === 'text') t.textContent = `T ${l.text.split('\n')[0] || '(empty)'}`; };

// ---------- theme + export panels ----------

$('#preset').innerHTML = `<option value="">Custom</option>${opts(Object.keys(PALETTES))}`;
$('#colors').innerHTML = S.colors.map((_, i) => `<input type="color" data-c="${i}" title="${i < 5 ? `Stripe ${i + 1}` : i === 5 ? 'Dark' : 'Light'}">`).join('');
$('#fields').innerHTML = FIELDS.map(([k, label, , multi]) => `<label>${label}${multi ? `<textarea rows="3" data-k="${k}"></textarea>` : `<input data-k="${k}">`}</label>`).join('');

$('#preset').onchange = (e) => { if (e.target.value) { S.colors = [...PALETTES[e.target.value]]; commit(); syncUI(); render(); } };
$('#colors').addEventListener('input', (e) => { S.colors[+e.target.dataset.c] = e.target.value; $('#preset').value = ''; render(); });
$('#colors').addEventListener('change', commit);
$('#fields').addEventListener('input', (e) => { S.theme[e.target.dataset.k] = e.target.value; render(); });
$('#fields').addEventListener('change', commit);
for (const k of ['mirrorSpine', 'guides', 'dielineOnly']) $(`#${k}`).onchange = (e) => { S[k] = e.target.checked; commit(); render(); };
$('#format').onchange = (e) => { S.format = e.target.value; syncUI(); commit(); render(); }; // syncUI may swap the paper: same undo step
$('#splitLid').onchange = (e) => { S.splitLid = e.target.checked; if (S.splitLid) S.paper = 'A4'; syncUI(); commit(); render(); }; // the point of splitting is A4
for (const k of ['jflap', 'jextra']) $(`#${k}`).onchange = (e) => { S[k] = +e.target.value; syncUI(); commit(); render(); };
for (const k of ['paper', 'mode']) $(`#${k}`).onchange = (e) => { S[k] = e.target.value; commit(); };

function syncUI() {
  geo();
  $('#format').value = S.format; $('#jflap').value = S.jflap; $('#jextra').value = S.jextra;
  $('#jopts').hidden = S.format !== 'jcard'; $('#mirrorRow').hidden = $('#splitRow').hidden = S.format === 'jcard';
  $('#splitLid').checked = S.splitLid;
  const papers = PAPERS.filter((p) => !p.w || fits(p, F)); // only sheets this format fits on
  $('#paper').innerHTML = opts(papers.map((p) => p.name));
  if (!papers.some((p) => p.name === S.paper)) S.paper = papers[0].name;
  for (const i of $('#colors').children) i.value = S.colors[+i.dataset.c];
  $('#preset').value = Object.keys(PALETTES).find((k) => PALETTES[k].join() === S.colors.join()) || '';
  for (const i of $('#fields').querySelectorAll('[data-k]')) if (i !== document.activeElement) i.value = S.theme[i.dataset.k] ?? '';
  for (const k of ['mirrorSpine', 'guides', 'dielineOnly']) $(`#${k}`).checked = S[k];
  $('#paper').value = S.paper; $('#mode').value = S.mode;
  $('#iccName').textContent = S.profile?.name || 'none';
  $('#iccName').className = S.profile ? '' : 'empty';
  syncLayers();
}

// ---------- colour management (LittleCMS via WebAssembly, loaded on first use) ----------

function transform(lib, t, rgba, outCh) { // rgba → packed outCh bytes; chunked to keep the wasm heap small
  const n = rgba.length / 4, out = new Uint8Array(n * outCh), CH = 1 << 18, rgb = new Uint8Array(CH * 3);
  for (let i = 0; i < n; i += CH) {
    const m = Math.min(CH, n - i);
    for (let j = 0; j < m; j++) { const s = (i + j) * 4; rgb[j * 3] = rgba[s]; rgb[j * 3 + 1] = rgba[s + 1]; rgb[j * 3 + 2] = rgba[s + 2]; }
    out.set(lib.cmsDoTransform(t, rgb.subarray(0, m * 3), m).subarray(0, m * outCh), i * outCh);
  }
  return out;
}

async function getCms() {
  if (!S.profile) throw new Error('Load a CMYK ICC profile first');
  if (cms?.asset === S.profile.asset) return cms;
  const { m, lib } = await (lcmsP ??= import(LCMS_URL).then(async (m) => ({ m, lib: await m.instantiate() })));
  const bytes = new Uint8Array(await (await fetch(assets[S.profile.asset].url)).arrayBuffer());
  const prof = lib.cmsOpenProfileFromMem(bytes, bytes.length);
  if (!prof || lib.cmsGetColorSpaceASCII(prof) !== 'CMYK') throw new Error('That is not a CMYK ICC profile');
  const srgb = lib.cmsCreate_sRGBProfile();
  if (cms) { lib.cmsDeleteTransform(cms.toCmyk); lib.cmsDeleteTransform(cms.proof); }
  cms = {
    asset: S.profile.asset, lib, bytes,
    toCmyk: lib.cmsCreateTransform(srgb, m.TYPE_RGB_8, prof, m.TYPE_CMYK_8, m.INTENT_PERCEPTUAL, 0),
    proof: lib.cmsCreateProofingTransform(srgb, m.TYPE_RGB_8, srgb, m.TYPE_RGB_8, prof, m.INTENT_PERCEPTUAL, m.INTENT_RELATIVE_COLORIMETRIC, m.cmsFLAGS_SOFTPROOFING),
  };
  return cms;
}

async function loadProfile(file) {
  const id = uid(), prev = S.profile;
  await loadAsset(id, await readAs(file, 'readAsDataURL'));
  S.profile = { name: file.name, asset: id };
  try { await getCms(); } catch (err) { S.profile = prev; throw err; }
  S.mode = 'cmyk'; commit(); syncUI(); render();
}

$('#softProof').onchange = async (e) => {
  softProof = e.target.checked;
  if (softProof) try { await getCms(); } catch (err) { softProof = e.target.checked = false; alert(err.message); }
  render();
};

// ---------- export ----------

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };

function renderPiece(dpi, paper, pc) { // one printed sheet: piece pc of the current format, centred on paper (null = bleed box)
  const s = dpi / 25.4, bw = pc.w + 2 * B, bh = pc.h + 2 * B, pw = paper?.w || bw, ph = paper?.h || bh;
  const g = { cut: new Path2D(pc.cut), slits: new Path2D(pc.slits), folds: new Path2D(pc.folds) };
  const page = mk(pw * s, ph * s), px = page.getContext('2d');
  px.fillStyle = '#fff'; px.fillRect(0, 0, page.width, page.height);
  const art = mk(bw * s, bh * s), ac = art.getContext('2d'), toPiece = [s, 0, 0, s, s * (B - pc.x), s * (B - pc.y)];
  ac.setTransform(...toPiece); drawContent(ac);
  if (pc.glue) { // tab hidden inside the box: leave it blank and say what it's for
    const t = pc.glue;
    ac.fillStyle = '#fff'; ac.fillRect(t.x - B, t.y, t.w + 2 * B, t.h + B);
    text(ac, 'GLUE — fold down and stick inside the top of the box', t.x + t.w / 2, t.y + t.h / 2 + 1.1, 3, { weight: 600, color: '#999', align: 'center' });
  }
  if (!S.dielineOnly) { // trim everything outside cut line + bleed
    const m = mk(art.width, art.height), mc = m.getContext('2d');
    mc.setTransform(...toPiece); mc.fill(g.cut); mc.lineWidth = 2 * B; mc.lineJoin = 'round'; mc.stroke(g.cut);
    ac.setTransform(1, 0, 0, 1, 0, 0); ac.globalCompositeOperation = 'destination-in'; ac.drawImage(m, 0, 0);
  }
  const ox = (pw - bw) / 2, oy = (ph - bh) / 2;
  px.drawImage(art, Math.round(ox * s), Math.round(oy * s));
  if (S.guides || S.dielineOnly) { px.setTransform(s, 0, 0, s, (ox + B - pc.x) * s, (oy + B - pc.y) * s); drawGuides(px, 0.2, g); }
  return { page, pw, ph };
}

async function exportPdf() {
  status('Rendering 300 DPI…'); await document.fonts.ready; await tick();
  geo();
  const cmyk = S.mode === 'cmyk', c = cmyk ? await getCms() : null, paper = PAPERS.find((p) => p.name === S.paper), pt = 72 / 25.4, pages = [];
  for (const pc of pieces(F)) { // one page per piece (split VHS = body + lid)
    const { page, pw, ph } = renderPiece(300, paper, pc);
    const rgba = page.getContext('2d').getImageData(0, 0, page.width, page.height).data;
    status(cmyk ? 'Converting to CMYK…' : 'Compressing…'); await tick();
    let pixels;
    if (cmyk) pixels = transform(c.lib, c.toCmyk, rgba, 4);
    else { pixels = new Uint8Array(rgba.length / 4 * 3); for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { pixels[j] = rgba[i]; pixels[j + 1] = rgba[i + 1]; pixels[j + 2] = rgba[i + 2]; } }
    pages.push({ wPt: +(pw * pt).toFixed(2), hPt: +(ph * pt).toFixed(2), width: page.width, height: page.height, pixels });
  }
  download(await pdf({ pages, cmyk, icc: c?.bytes }), fileName('pdf'));
  status('');
}

async function exportPng() {
  status('Rendering 300 DPI…'); await document.fonts.ready;
  geo();
  for (const pc of pieces(F)) {
    const { page } = renderPiece(300, null, pc);
    download(await new Promise((res) => page.toBlob(res, 'image/png')), fileName(pc.name ? `${pc.name}.png` : 'png'));
  }
  status('');
}

const tick = () => new Promise((r) => setTimeout(r, 30)); // let the status paint; rAF would stall in a background tab
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (err) { console.error(err); status(''); alert(err.message); } };
$('#pdf').onclick = guard(exportPdf);
$('#png').onclick = guard(exportPng);

// ---------- files, buttons, keys ----------

$('#addImg').onclick = () => $('#imgFile').click();
$('#imgFile').onchange = guard(async (e) => { for (const f of e.target.files) await addImage(f); e.target.value = ''; });
$('#addText').onclick = addText;
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#save').onclick = () => download(new Blob([JSON.stringify(project())], { type: 'application/json' }), fileName('coverslip.json'));
$('#open').onclick = () => $('#projFile').click();
$('#projFile').onchange = guard(async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await loadProject(JSON.parse(await f.text())); });
$('#new').onclick = () => { if (confirm('Start a new cover? Unsaved changes will be lost.')) loadProject({ app: 'coverslip', state: defaults(), assets: {} }); };
$('#loadIcc').onclick = () => $('#iccFile').click();
$('#iccFile').onchange = guard(async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await loadProfile(f); });

stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', guard(async (e) => {
  e.preventDefault();
  for (const f of e.dataTransfer.files) {
    if (f.type.startsWith('image/')) await addImage(f);
    else if (/\.json$/i.test(f.name)) await loadProject(JSON.parse(await f.text()));
    else if (/\.ic[cm]$/i.test(f.name)) await loadProfile(f);
  }
}));

addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox';
  const mod = e.metaKey || e.ctrlKey;
  if (mod && (e.key.toLowerCase() === 'z' || e.key === 'y')) {
    if (typing) return; // let the field do its own undo
    e.preventDefault(); (e.shiftKey || e.key === 'y') ? redo() : undo(); return;
  }
  const l = selected();
  if (typing || !l) return;
  const d = e.shiftKey ? 10 : 1, moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
  if (moves[e.key]) { e.preventDefault(); l.x += moves[e.key][0]; l.y += moves[e.key][1]; reclip(l); commit(); syncProps(); render(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(l); }
  else if (e.key === 'Escape') { sel = null; syncLayers(); render(); }
});

// ---------- start ----------

await Promise.all(FONTS.flatMap((f) => ['400', '500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 16px "${f}"`)))).catch(() => status('Fonts failed to load (offline?)'));
try { const saved = await idbDo('readonly', (s) => s.get('autosave')); if (saved) await loadProject(saved); } catch (err) { console.warn('autosave not restored', err); }
syncUI(); fit();
