// Period styles. Each style draws panels by role, like the rainbow one in app.js:
//   front / back / spine / side: drawn at VHS height (188.9mm) and scaled to the panel (app.js `scaled`),
//   spineN (spines under 20mm) / flap / inside / top / bottom: real mm.
// Anything a style leaves out falls back to the rainbow drawing, in the style's palette.
// ponytail: generic period looks, not any brand's trade dress — no real names, logos or exact layouts.
// Only canvas calls PdfCtx (vector.js) understands: rects, lines, arcs, text, transforms, alpha. No gradients or curves.

export function makeStyles(h) {
  const { text, wrap, boxed, barcode, col, T, badges, O, inPanel } = h;
  const MARKER = 'Permanent Marker', CONDENSED = 'Bebas Neue';

  const fill = (c, color, x, y, w, hh) => { c.fillStyle = color; c.fillRect(x, y, w, hh); };
  const bg = (c, color, w, hh) => fill(c, color, -O, -O, w + 2 * O, hh + 2 * O);
  const skew = (c, x, y, fn) => { c.save(); c.translate(x, y); c.transform(1, 0, -0.21, 1, 0, 0); fn(); c.restore(); }; // fake italic
  const lines = (c, x0, x1, y0, y1, step, color, alpha = 1, lw = 0.3) => {
    c.save(); c.strokeStyle = color; c.lineWidth = lw; c.globalAlpha *= alpha;
    for (let y = y0; y <= y1 + 1e-6; y += step) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
    c.restore();
  };
  const poly = (c, color, pts) => { c.fillStyle = color; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  const items = () => T().bullets.split('\n').map((b) => b.trim()).filter(Boolean);
  const hex = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const bands = (c, x, y, w, hh, c1, c2, n = 36) => { // vertical colour ramp as flat bands (PDF-safe "gradient")
    const A = hex(c1), Bc = hex(c2);
    for (let i = 0; i < n; i++) fill(c, `rgb(${A.map((v, k) => Math.round(v + (Bc[k] - v) * i / (n - 1))).join(',')})`, x, y + i * hh / n, w, hh / n + 0.4);
  };
  const along = (c, w, hh, title, sub, color, { font = 'Montserrat', weight = 800, start = 10 } = {}) => { // title down a thin spine
    const ts = Math.min(font === MARKER ? 7 : 6, w * 0.47), ss = Math.min(2.6, w * 0.3);
    c.save(); c.translate(w / 2, hh / 2); c.rotate(Math.PI / 2);
    text(c, title, -hh / 2 + start, ts * 0.35, ts, { color, font, weight, maxW: hh * (sub ? 0.55 : 0.85) - start + 10 });
    if (sub) text(c, sub, hh / 2 - 10, ss * 0.36, ss, { weight: 500, color, align: 'right', spacing: 0.4, maxW: hh * 0.28 });
    c.restore();
  };
  const stacked = (c, w, hh, title, sub, color, { font = 'Montserrat', weight = 800, size = 11 } = {}) => { // wide spine
    c.save(); c.translate(w / 2, hh / 2); c.rotate(Math.PI / 2);
    text(c, title, 0, 3, size, { color, font, weight, align: 'center', maxW: hh - 96 });
    text(c, sub, 0, 9, 3.4, { weight: 500, color, align: 'center', spacing: 0.6, maxW: hh - 96 });
    c.restore();
  };
  const onLines = (c, list, x, y0, step, maxW, maxY, color, size = 4.6, font = MARKER) => { // handwriting on ruled lines
    let y = y0;
    for (const s of list) { if (y > maxY) break; text(c, s, x, y - 1.1, size, { color, font, weight: 400, maxW }); y += step; }
  };
  const table = (c, x, y, color, w = 58) => { // SP / LP / EP rows
    const t = T();
    c.strokeStyle = color; c.lineWidth = 0.35;
    for (const [k, v] of [['SP', t.sp], ['LP', t.lp], ['EP', t.ep]]) {
      if (!v) continue;
      c.strokeRect(x, y, w, 7);
      text(c, `${k} MODE`, x + 3, y + 5, 3.2, { weight: 500, color });
      text(c, v, x + w * 0.58, y + 5, 3.2, { weight: 500, color, maxW: w * 0.4 });
      y += 7;
    }
    return y;
  };
  const badgeRow = (c, x, y, size, color, maxX) => {
    for (const b of badges()) {
      c.font = `600 ${size}px Montserrat`;
      const w = c.measureText(b).width + size;
      if (x + w > maxX) break;
      boxed(c, b, x + w / 2, y, size, color); x += w + size * 0.8;
    }
  };
  const bullets = (c, x, y, maxW, maxY, color, size = 2.9, mark = '•') => {
    for (const b of items()) { if (y > maxY) break; text(c, mark, x, y, size, { weight: 700, color }); y = wrap(c, b, x + size * 1.4, y, maxW - size * 1.4, size, size * 1.38, color, 500, maxY) + size * 0.9; }
    return y;
  };
  // ruled, numbered index for a tape style's back: paper + rules go under the layers, the list over them
  const indexPaper = (c, x, y, W, H, paper, ink, top = 34) => { fill(c, paper, x, y, W, H); lines(c, x + 10, x + W - 10, y + top, y + H - 16, 8, ink, 0.45); };
  const index = (c, W, H, { head, hand, top = 34, printed = false }) => {
    const t = T();
    text(c, t.backTitle, 10, top - 8, 4, { weight: 700, color: head, spacing: 1.5, maxW: W - 20 });
    items().forEach((s, i) => {
      const y = top + 8 * (i + 1) - 1.2;
      if (y > H - 16) return;
      text(c, `${i + 1}.`, 10, y, 2.8, { weight: 600, color: head });
      text(c, s, 16, y, printed ? 3 : 4.2, { color: hand, font: printed ? 'Montserrat' : MARKER, weight: printed ? 500 : 400, maxW: W - 28 });
    });
  };
  const insidePaper = (paper, ink) => (c, w, hh) => { bg(c, paper, w, hh); lines(c, 6, w - 6, 16, hh - 6, 7, ink, 0.45); };
  const insidesFlow = (head, hand, printed) => (c, P) => { // list flowing across J-card fold-outs (text pass)
    const list = items(), t = T();
    let i = 0;
    Object.entries(P).filter(([k]) => k.startsWith('inside')).forEach(([, p], n) => inPanel(c, p, (cc, w, hh) => {
      if (n === 0) text(cc, t.backTitle, 6, 11, 4, { weight: 700, color: head, spacing: 1.2, maxW: w - 12 });
      for (let y = 16 + 7; i < list.length && y <= hh - 6; i++, y += 7) text(cc, list[i], 7, y - 1.2, printed ? 2.8 : 3.8, { color: hand, font: printed ? 'Montserrat' : MARKER, weight: printed ? 500 : 400, maxW: w - 14 });
    }));
  };

  // ---------------- VHS: Blank Tape '84 — black sleeve, silver band, speed stripes, giant grade number ----------------
  const blank84 = {
    label: "Blank Tape '84", media: 'VHS', base: 'dark',
    palette: ['#e2231a', '#f7941d', '#1c5bab', '#c7cbd1', '#8d939c', '#121418', '#eef0f3'],
    shapes: {
      front(c, W, H) {
        const { s, dark } = col();
        bg(c, dark, W, H);
        fill(c, s[4], -O, 58.5, W + 2 * O, 43); fill(c, s[3], -O, 60, W + 2 * O, 40);
        for (let i = 0; i < 3; i++) { const x = W - 50 + i * 11; poly(c, s[i], [[x, 100], [x + 8, 100], [x + 22, 60], [x + 14, 60]]); }
        [0, 1, 2].forEach((i) => fill(c, s[i], -O, H - 34 + i * 3, W + 2 * O, 1.2));
      },
      back(c, W, H) {
        const { s, dark } = col();
        bg(c, dark, W, H);
        fill(c, s[3], -O, 16, W + 2 * O, 16);
        for (let i = 0; i < 3; i++) { const x = W - 34 + i * 8; poly(c, s[i], [[x, 32], [x + 6, 32], [x + 16, 16], [x + 10, 16]]); }
        [0, 1, 2].forEach((i) => fill(c, s[i], -O, H - 30 + i * 3, W + 2 * O, 1.2));
      },
      spine(c, w, H) {
        const { s, dark } = col();
        bg(c, dark, w, H); fill(c, s[3], -O, 12, w + 2 * O, 30);
        for (let i = 0; i < 3; i++) { const y = H - 44 + i * 10; poly(c, s[i], [[-O, y + 7], [w + O, y], [w + O, y + 4], [-O, y + 11]]); }
      },
      spineN(c, w, hh) { const { s, dark } = col(); bg(c, dark, w, hh); fill(c, s[3], -O, 0, w + 2 * O, 12); fill(c, s[0], -O, hh - 8, w + 2 * O, 1.2); fill(c, s[1], -O, hh - 5.5, w + 2 * O, 1.2); },
    },
    texts: {
      front(c, W, H) {
        const { dark, light } = col(), t = T();
        text(c, t.label, 8, 16, 4, { weight: 600, color: light, spacing: 1 });
        if (badges()[0]) boxed(c, badges()[0], W - 14, 18, 4.5, light);
        text(c, t.subtitle, 8, 52, 5, { weight: 700, color: light, spacing: 1.2, maxW: W - 16 });
        skew(c, 8, 95, () => text(c, t.title, 0, 0, 30, { color: dark, maxW: W - 72 }));
        text(c, t.tagline, 8, 116, 7, { color: light, maxW: W - 16 });
        text(c, t.line1, 8, 126, 4, { weight: 500, color: light, maxW: W - 16 });
        text(c, t.line2, 8, 132, 4, { weight: 500, color: light, maxW: W - 16 });
        if (t.blurb) wrap(c, t.blurb, 8, 141, W - 16, 2.8, 3.8, light, 500, H - 38);
        text(c, t.brand, 8, H - 12, 7, { color: light, maxW: W * 0.6 });
        text(c, t.brand2, W - 8, H - 12, 3, { weight: 600, color: light, align: 'right', spacing: 1, maxW: W * 0.35 });
      },
      back(c, W, H) {
        const { s, dark, light } = col(), t = T();
        skew(c, 8, 28.5, () => text(c, t.backTitle, 0, 0, 9, { color: dark, maxW: W - 52 }));
        bullets(c, 10, 46, W - 20, H * 0.55, light);
        text(c, t.recHeading, 8, H * 0.6, 3.6, { weight: 600, color: light, spacing: 1.2, maxW: W - 16 });
        table(c, 10, H * 0.6 + 4, light);
        badgeRow(c, 8, H - 40, 3.6, light, W - 44);
        if (t.barcode) barcode(c, t.barcode, W - 36, H - 62, 28, 12, light);
        text(c, t.backSub, W - 8, 12, 3.2, { weight: 600, color: s[3], align: 'right', spacing: 1, maxW: 40 });
        text(c, t.brand, 8, H - 9, 5, { color: light, maxW: W - 16 });
      },
      spine(c, w, H) {
        const { dark, light } = col(), t = T();
        if (badges()[0]) boxed(c, badges()[0], w / 2, 30, 4.6, dark);
        stacked(c, w, H, t.spineTitle, t.spineSub, light);
      },
      spineN(c, w, hh) { const { dark, light } = col(), t = T(); text(c, badges()[0] || '', w / 2, 8, Math.min(3, w * 0.25), { weight: 800, color: dark, align: 'center', maxW: w - 2 }); along(c, w, hh, t.spineTitle, t.spineSub, light, { start: 16 }); },
    },
  };

  // ---------------- VHS: Rental '91 — photo sleeve (add an image layer), title block, rewind sticker ----------------
  const sticker = (c, x, y, r) => {
    const { s, dark } = col();
    c.save(); c.translate(x, y); c.rotate(-0.21);
    c.fillStyle = s[0]; c.beginPath(); c.arc(0, 0, r, 0, 2 * Math.PI); c.fill();
    c.strokeStyle = dark; c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, 0, r * 0.86, 0, 2 * Math.PI); c.stroke();
    text(c, 'BE KIND', 0, -r * 0.08, r * 0.33, { color: dark, align: 'center' });
    text(c, 'REWIND', 0, r * 0.36, r * 0.33, { color: dark, align: 'center' });
    c.restore();
  };
  const rental91 = {
    label: "Rental '91", media: 'VHS',
    palette: ['#ffd200', '#e10600', '#0a3d91', '#ffffff', '#8a8a8a', '#0b0b0b', '#ffffff'],
    shapes: {
      front(c, W, H) { // dark "photo" area with faint scanlines; your photo layer goes on top of this
        const { s, dark } = col();
        bg(c, dark, W, H);
        c.save(); c.globalAlpha *= 0.18; for (let y = 0; y < H; y += 3) fill(c, s[2], -O, y, W + 2 * O, 1); c.restore();
      },
      back(c, W, H) {
        const { s, light } = col();
        bg(c, light, W, H); fill(c, s[1], -O, H - 14, W + 2 * O, 14 + O);
        const fw = (W - 22) / 3;
        for (let i = 0; i < 3; i++) fill(c, s[4], 8 + i * (fw + 3), 74, fw, 28); // stills: clip photo layers here
      },
      spine(c, w, H) { const { s, light } = col(); bg(c, light, w, H); fill(c, s[1], -O, -O, w + 2 * O, 36 + O); fill(c, s[1], -O, H - 20, w + 2 * O, 20 + O); },
      spineN(c, w, hh) { const { s, light } = col(); bg(c, light, w, hh); fill(c, s[1], -O, -O, w + 2 * O, 14 + O); },
    },
    texts: {
      front(c, W, H) { // drawn over your photo layers
        const { s, dark, light } = col(), t = T();
        fill(c, s[1], -O, -O, W + 2 * O, 16 + O);
        text(c, t.tagline, 7, 11, 5, { color: light, spacing: 1, maxW: W * 0.6 });
        text(c, t.label, W - 7, 11, 4, { weight: 600, color: light, align: 'right', maxW: W * 0.3 });
        c.save(); c.globalAlpha *= 0.78; fill(c, dark, -O, H - 64, W + 2 * O, 64 + O); c.restore();
        text(c, t.line1.toUpperCase(), W / 2, H - 54, 3.4, { weight: 600, color: light, align: 'center', spacing: 1.2, maxW: W - 14 });
        text(c, t.title, W / 2, H - 32, 16, { color: light, align: 'center', maxW: W - 12 });
        text(c, t.subtitle, W / 2, H - 22, 4.6, { weight: 700, color: s[0], align: 'center', maxW: W - 14 });
        text(c, t.line2, W / 2, H - 15, 3, { weight: 500, color: light, align: 'center', maxW: W - 14 });
        if (badges()[0]) boxed(c, badges()[0], 13, H - 6, 3.6, light);
        text(c, t.brand, W - 7, H - 6, 3.4, { weight: 700, color: light, align: 'right', maxW: W * 0.5 });
        sticker(c, W - 22, 36, 14);
      },
      back(c, W, H) {
        const { s, dark, light } = col(), t = T();
        text(c, t.title, 8, 20, 10, { color: dark, maxW: W - 16 });
        text(c, t.tagline, 8, 28, 4.4, { weight: 700, color: s[1], maxW: W - 16 });
        if (t.blurb) wrap(c, t.blurb, 8, 38, W - 16, 3.1, 4.2, dark, 500, 68);
        text(c, t.backTitle, 8, 112, 3.6, { weight: 700, color: s[1], spacing: 1.2, maxW: W - 16 });
        bullets(c, 10, 119, W - 20, H * 0.72, dark);
        text(c, t.recHeading, 8, H - 46, 3, { weight: 600, color: dark, spacing: 1, maxW: W - 48 });
        table(c, 10, H - 42, dark, 50);
        if (t.barcode) barcode(c, t.barcode, W - 36, H - 46, 28, 11, dark);
        text(c, t.brand, 8, H - 5, 4.2, { color: light, maxW: W * 0.55 });
        text(c, t.brand2, W - 8, H - 5, 3, { weight: 600, color: light, align: 'right', spacing: 1, maxW: W * 0.4 });
      },
      spine(c, w, H) {
        const { dark, light } = col(), t = T();
        if (badges()[0]) boxed(c, badges()[0], w / 2, 24, 4.6, light);
        stacked(c, w, H, t.spineTitle, t.spineSub, dark);
        text(c, t.brand, w / 2, H - 8, 3, { weight: 800, color: light, align: 'center', maxW: w - 3 });
      },
      spineN(c, w, hh) { const { dark, light } = col(), t = T(); text(c, badges()[0] || '', w / 2, 9, Math.min(3.2, w * 0.25), { color: light, align: 'center', maxW: w - 2 }); along(c, w, hh, t.spineTitle, t.spineSub, dark, { start: 18 }); },
    },
  };

  // ---------------- VHS: Home Recording — plain sleeve, ruled label, handwritten titles, speed boxes ----------------
  const home = {
    label: 'Home Recording', media: 'VHS', fonts: [[MARKER, 400]],
    palette: ['#1f47a8', '#d0021b', '#9aa0a6', '#d9dde2', '#5f6368', '#202124', '#fbfaf4'],
    shapes: {
      front(c, W, H) {
        const { s, dark, light } = col();
        bg(c, s[3], W, H);
        fill(c, light, 8, 40, W - 16, H - 80); c.strokeStyle = s[2]; c.lineWidth = 0.4; c.strokeRect(8, 40, W - 16, H - 80);
        fill(c, dark, 8, 40, W - 16, 12);
        lines(c, 12, W - 12, 70, H - 50, 9, s[0], 0.35);
      },
      back(c, W, H) { const { s, light } = col(); bg(c, s[3], W, H); indexPaper(c, 8, 20, W - 16, H - 40, light, s[0]); },
      spine(c, w, H) { const { s, light } = col(); bg(c, s[3], w, H); fill(c, light, 3, 20, w - 6, H - 40); },
      spineN(c, w, hh) { const { s, light } = col(); bg(c, s[3], w, hh); fill(c, light, 1.5, 8, w - 3, hh - 16); },
    },
    texts: {
      front(c, W, H) {
        const { s, dark, light } = col(), t = T();
        text(c, t.tagline, 12, 48.2, 3.6, { weight: 700, color: light, spacing: 1.5, maxW: W - 60 });
        ['SP', 'LP', 'EP'].forEach((k, i) => { // speed boxes, ticked when that field has a value
          const x = W - 44 + i * 12;
          c.strokeStyle = light; c.lineWidth = 0.35; c.strokeRect(x, 43.5, 4.5, 4.5);
          text(c, k, x + 5.5, 47.6, 3, { weight: 700, color: light });
          if (t[k.toLowerCase()]) text(c, '×', x + 0.5, 48.2, 5, { color: s[1], font: MARKER, weight: 400 });
        });
        if (badges().length) badgeRow(c, 10, 28, 3.6, dark, W - 10);
        text(c, t.title, 12, 66.5, 10, { color: s[0], font: MARKER, weight: 400, maxW: W - 24 });
        onLines(c, [t.subtitle, t.line1, t.line2, ...items()].filter(Boolean), 13, 79, 9, W - 26, H - 52, s[0]);
        text(c, 'DATE', 12, H - 44, 2.8, { weight: 700, color: s[4] });
        text(c, t.label, 24, H - 43.5, 4.4, { color: s[0], font: MARKER, weight: 400, maxW: W - 36 });
        text(c, t.brand, W / 2, H - 22, 4, { weight: 700, color: dark, align: 'center', spacing: 2, maxW: W - 16 });
        text(c, t.brand2, W / 2, H - 16, 2.8, { weight: 500, color: dark, align: 'center', spacing: 1, maxW: W - 16 });
      },
      back(c, W, H) { const { s, dark } = col(); c.save(); c.translate(8, 20); index(c, W - 16, H - 40, { head: dark, hand: s[0] }); c.restore(); },
      spine(c, w, H) { const { s } = col(), t = T(); stacked(c, w, H, t.spineTitle, '', s[0], { font: MARKER, weight: 400, size: 9 }); },
      spineN(c, w, hh) { const { s } = col(); along(c, w, hh, T().spineTitle, '', s[0], { font: MARKER, weight: 400 }); },
    },
  };

  // ---------------- Cassette: Chrome Type II '82 — black, gold rules, high-bias band, metallic lines ----------------
  const chrome82 = {
    label: "Chrome Type II '82", media: 'Cassette', base: 'dark',
    palette: ['#caa24a', '#e6e6e6', '#b8322b', '#8c8c8c', '#454545', '#0d0d0d', '#f2f2f2'],
    insides: insidesFlow('#0d0d0d', '#1b3f8f', false),
    shapes: {
      front(c, W, H) {
        const { s, dark } = col();
        bg(c, dark, W, H);
        fill(c, s[0], -O, 40, W + 2 * O, 0.8); fill(c, s[0], -O, 42.2, W + 2 * O, 0.4);
        fill(c, s[0], -O, 112, W + 2 * O, 14);
        for (let i = 0; i < 10; i++) fill(c, i % 2 ? s[3] : s[1], -O, H - 44 + i * 2.7, W + 2 * O, 0.8);
      },
      back(c, W, H) {
        const { s, dark } = col();
        bg(c, dark, W, H); fill(c, s[0], -O, 16, W + 2 * O, 14);
        for (let i = 0; i < 8; i++) fill(c, i % 2 ? s[3] : s[1], -O, H - 30 + i * 2.7, W + 2 * O, 0.8);
      },
      spine(c, w, H) { const { s, dark } = col(); bg(c, dark, w, H); fill(c, s[0], 3, -O, 0.8, H + 2 * O); fill(c, s[0], w - 3.8, -O, 0.8, H + 2 * O); },
      spineN(c, w, hh) { const { s, dark } = col(); bg(c, dark, w, hh); fill(c, s[0], 1, -O, 0.5, hh + 2 * O); fill(c, s[0], w - 1.5, -O, 0.5, hh + 2 * O); },
      flap(c, w, hh) { const { s, dark } = col(); bg(c, dark, w, hh); fill(c, s[0], -O, 8, w + 2 * O, 0.8); fill(c, s[0], -O, 10.2, w + 2 * O, 0.4); },
      inside: insidePaper('#f2f2f2', '#8c8c8c'),
    },
    texts: {
      front(c, W, H) {
        const { s, dark, light } = col(), t = T();
        text(c, t.title, 8, 33, 26, { color: light, maxW: W - 16 });
        text(c, t.label, W - 8, 14, 3.6, { weight: 600, color: s[0], align: 'right', maxW: W * 0.4 });
        text(c, t.tagline, 8, 106, 4, { weight: 700, color: light, spacing: 3, maxW: W - 16 });
        text(c, t.subtitle, 8, 122, 5.2, { color: dark, spacing: 2, maxW: W - 16 });
        text(c, t.line1, 8, 134, 4, { weight: 500, color: light, maxW: W - 16 });
        text(c, t.line2, 8, 140, 4, { weight: 500, color: light, maxW: W - 16 });
        text(c, t.brand, 8, H - 8, 7, { color: light, maxW: W * 0.6 });
        text(c, t.brand2, W - 8, H - 10, 3, { weight: 600, color: s[0], align: 'right', spacing: 1, maxW: W * 0.35 });
      },
      back(c, W, H) {
        const { s, dark, light } = col(), t = T();
        text(c, t.backTitle, 8, 26, 8, { color: dark, maxW: W - 16 });
        bullets(c, 10, 44, W - 20, H * 0.55, light);
        text(c, t.recHeading, 8, H * 0.62, 3.6, { weight: 600, color: s[0], spacing: 1.2, maxW: W - 16 });
        table(c, 10, H * 0.62 + 4, light);
        if (t.barcode) barcode(c, t.barcode, W - 36, H - 58, 28, 12, light);
        badgeRow(c, 8, H - 38, 3.6, light, W - 44);
      },
      spine(c, w, H) { const { light } = col(), t = T(); stacked(c, w, H, t.spineTitle, t.spineSub, light); },
      spineN(c, w, hh) { const { light } = col(), t = T(); along(c, w, hh, t.spineTitle, t.spineSub, light); },
      flap(c, w, hh) { const { s } = col(); let y = 22; for (const b of badges()) { if (y > hh - 12) break; boxed(c, b, w / 2, y, Math.min(3, w / 5), s[0]); y += 7; } },
    },
  };

  // ---------------- Cassette: Normal Bias '79 — cream, stepped colour bars, ruled A/B lines ----------------
  const normal79 = {
    label: "Normal Bias '79", media: 'Cassette', fonts: [[MARKER, 400]],
    palette: ['#e5541c', '#f3a712', '#3c8d5a', '#2f6db5', '#6d3b8e', '#2a2420', '#f4ead5'],
    insides: insidesFlow('#2a2420', '#2f6db5', false),
    shapes: {
      front(c, W, H) {
        const { s, dark, light } = col();
        bg(c, light, W, H); fill(c, dark, 8, 46, W - 16, 0.5);
        [60, 84, 104, 76, 52].forEach((bh, i) => fill(c, s[i], W - 52 + i * 9, H - 58 - bh, 8, bh));
        fill(c, dark, -O, H - 58, W + 2 * O, 0.6);
        lines(c, 18, W - 8, H - 40, H - 28, 12, dark, 0.7);
      },
      back(c, W, H) { const { s, dark, light } = col(); bg(c, light, W, H); s.forEach((cc, i) => fill(c, cc, 8 + i * 9, 10, 8, 10)); indexPaper(c, 0, 18, W, H - 18, light, dark); },
      spine(c, w, H) { const { s, light } = col(); bg(c, light, w, H); s.forEach((cc, i) => fill(c, cc, -O, 10 + i * 4, w + 2 * O, 4)); },
      spineN(c, w, hh) { const { s, light } = col(); bg(c, light, w, hh); s.forEach((cc, i) => fill(c, cc, 1.5 + i * (w - 3) / 5, 3, (w - 3) / 5, 4)); },
      flap(c, w, hh) { const { s, light } = col(); bg(c, light, w, hh); s.forEach((cc, i) => fill(c, cc, -O, 6 + i * 2, w + 2 * O, 2)); },
      inside: insidePaper('#f4ead5', '#2a2420'),
    },
    texts: {
      front(c, W, H) {
        const { s, dark } = col(), t = T();
        text(c, t.title, 8, 32, 26, { color: dark, maxW: W - 16 });
        text(c, t.subtitle, 8, 42, 4.2, { weight: 700, color: dark, spacing: 2, maxW: W - 16 });
        text(c, t.tagline, 8, 56, 4, { weight: 700, color: s[0], spacing: 1, maxW: W * 0.5 });
        text(c, t.label, 8, 64, 3.4, { weight: 500, color: dark, maxW: W * 0.5 });
        text(c, 'A', 8, H - 41, 5, { color: dark }); text(c, 'B', 8, H - 29, 5, { color: dark });
        text(c, t.line1, 19, H - 41.3, 5, { color: s[3], font: MARKER, weight: 400, maxW: W - 30 });
        text(c, t.line2, 19, H - 29.3, 5, { color: s[3], font: MARKER, weight: 400, maxW: W - 30 });
        text(c, t.brand, 8, H - 9, 5.6, { color: dark, maxW: W * 0.6 });
        text(c, t.brand2, W - 8, H - 9, 2.8, { weight: 600, color: dark, align: 'right', spacing: 1, maxW: W * 0.35 });
      },
      back(c, W, H) { const { s, dark } = col(); c.save(); c.translate(0, 18); index(c, W, H - 18, { head: dark, hand: s[3] }); c.restore(); },
      spine(c, w, H) { const { dark } = col(), t = T(); stacked(c, w, H, t.spineTitle, t.spineSub, dark); },
      spineN(c, w, hh) { const { dark } = col(), t = T(); along(c, w, hh, t.spineTitle, t.spineSub, dark); },
      flap(c, w, hh) { const { dark } = col(); text(c, T().brand, w / 2, hh - 8, Math.min(3, w / 5), { color: dark, align: 'center', maxW: w - 2 }); },
    },
  };

  // ---------------- Cassette: Mixtape — lined index card, red margin, marker handwriting ----------------
  const mixtape = {
    label: 'Mixtape', media: 'Cassette', fonts: [[MARKER, 400]],
    palette: ['#d0021b', '#1d57b7', '#9bb8e8', '#e8a0a0', '#555555', '#1b1b1b', '#fffdf6'],
    insides: insidesFlow('#d0021b', '#1d57b7', false),
    shapes: {
      front(c, W, H) { const { s, light } = col(); bg(c, light, W, H); fill(c, s[0], -O, 30, W + 2 * O, 0.7); lines(c, -O, W + O, 40, H - 6, 10, s[2], 0.9, 0.4); fill(c, s[3], 14, -O, 0.6, H + 2 * O); },
      back(c, W, H) { const { s, light } = col(); bg(c, light, W, H); fill(c, s[0], -O, 30, W + 2 * O, 0.7); lines(c, -O, W + O, 40, H - 6, 10, s[2], 0.9, 0.4); fill(c, s[3], 14, -O, 0.6, H + 2 * O); },
      spine(c, w, H) { const { s, light } = col(); bg(c, light, w, H); fill(c, s[0], -O, 10, w + 2 * O, 0.6); },
      spineN(c, w, hh) { const { light } = col(); bg(c, light, w, hh); },
      flap(c, w, hh) { const { s, light } = col(); bg(c, light, w, hh); lines(c, -O, w + O, 10, hh - 4, 7, s[2], 0.9); },
      inside: insidePaper('#fffdf6', '#9bb8e8'),
    },
    texts: {
      front(c, W, H) {
        const { s } = col(), t = T();
        c.save(); c.translate(17, 24); c.rotate(-0.05); text(c, t.title, 0, 0, 16, { color: s[0], font: MARKER, weight: 400, maxW: W - 26 }); c.restore();
        text(c, t.label, W - 6, 12, 5, { color: s[1], font: MARKER, weight: 400, align: 'right', maxW: W * 0.4 });
        onLines(c, [t.subtitle, t.line1, t.line2, ...items()].filter(Boolean), 17, 50, 10, W - 22, H - 8, s[1], 6.4);
      },
      back(c, W, H) {
        const { s } = col(), t = T();
        text(c, t.backTitle, 17, 24, 10, { color: s[0], font: MARKER, weight: 400, maxW: W - 26 });
        items().forEach((b, i) => { const y = 50 + i * 10; if (y < H - 6) text(c, `${i + 1}. ${b}`, 17, y - 1.4, 5.6, { color: s[1], font: MARKER, weight: 400, maxW: W - 22 }); });
      },
      spine(c, w, H) { const { s } = col(); stacked(c, w, H, T().spineTitle, '', s[0], { font: MARKER, weight: 400, size: 9 }); },
      spineN(c, w, hh) { const { s } = col(); along(c, w, hh, T().spineTitle, '', s[0], { font: MARKER, weight: 400 }); },
      flap(c, w, hh) { const { s } = col(); c.save(); c.translate(w / 2, hh / 2); c.rotate(Math.PI / 2); text(c, T().label, 0, 1.5, Math.min(5, w * 0.35), { color: s[1], font: MARKER, weight: 400, align: 'center', maxW: hh - 10 }); c.restore(); },
    },
  };

  // ---------------- CD: '90s Jewel — dusk colour ramp, disc rings, chunky slanted title ----------------
  const jewel90 = {
    label: "'90s Jewel", media: 'CD', base: 'dark',
    palette: ['#ff2e88', '#7a2cff', '#00d0ff', '#00f5a0', '#ffe14d', '#0b0320', '#ffffff'],
    shapes: {
      front(c, W, H) {
        const { s, dark } = col();
        bands(c, -O, -O, W + 2 * O, H + 2 * O, dark, s[1]);
        c.save(); c.lineWidth = 1.4;
        [[58, s[2]], [46, s[0]], [34, s[3]], [22, s[4]]].forEach(([r, cc]) => { c.strokeStyle = cc; c.beginPath(); c.arc(W * 0.68, H * 0.42, r, 0, 2 * Math.PI); c.stroke(); });
        c.restore();
        c.fillStyle = dark; c.beginPath(); c.arc(W * 0.68, H * 0.42, 6, 0, 2 * Math.PI); c.fill();
      },
      back(c, W, H) { const { s, dark } = col(); bands(c, -O, -O, W + 2 * O, H + 2 * O, dark, s[1]); },
      spine(c, w, H) { const { s, dark } = col(); bands(c, -O, -O, w + 2 * O, H + 2 * O, dark, s[1]); },
      spineN(c, w, hh) { bg(c, col().dark, w, hh); },
    },
    texts: {
      front(c, W, H) {
        const { s, light } = col(), t = T();
        text(c, t.label, 10, 16, 4, { weight: 700, color: light, spacing: 3, maxW: W * 0.4 });
        text(c, t.tagline, W - 10, 16, 4, { weight: 700, color: s[4], align: 'right', maxW: W * 0.5 });
        skew(c, 10, H - 26, () => text(c, t.title, 0, 0, 26, { color: light, maxW: W - 24 }));
        text(c, t.subtitle, 10, H - 13, 6, { weight: 700, color: s[2], maxW: W - 20 });
      },
      back(c, W, H) {
        const { s, light } = col(), t = T();
        text(c, t.title, 10, 20, 9, { color: light, maxW: W - 20 });
        const list = items(), half = Math.ceil(list.length / 2);
        [list.slice(0, half), list.slice(half)].forEach((col2, k) => col2.forEach((b, i) => {
          const y = 38 + i * 9, x = 10 + k * (W - 20) / 2;
          text(c, String(k * half + i + 1).padStart(2, '0'), x, y, 4, { color: s[0] });
          text(c, b, x + 9, y, 3.4, { weight: 500, color: light, maxW: (W - 20) / 2 - 12 });
        }));
        badgeRow(c, 10, H - 14, 3.6, light, W - 50);
        if (t.barcode) barcode(c, t.barcode, W - 40, H - 34, 30, 12, light);
        text(c, `${t.label ? `© ${t.label} ` : ''}${t.brand}`, 10, H - 26, 3.2, { weight: 500, color: light, maxW: W - 60 });
      },
      spine(c, w, H) { const { light } = col(), t = T(); stacked(c, w, H, t.spineTitle, t.spineSub, light); },
      spineN(c, w, hh) { const { light } = col(), t = T(); along(c, w, hh, t.spineTitle, t.spineSub, light); },
    },
  };

  // ---------------- CD: Promo — stark white, black type, not-for-sale band ----------------
  const promoBand = (c, W, y) => { const { dark, light } = col(); fill(c, dark, -O, y, W + 2 * O, 12); text(c, 'FOR PROMOTIONAL USE ONLY · NOT FOR SALE', W / 2, y + 7.8, 3.6, { weight: 700, color: light, align: 'center', spacing: 1.5, maxW: W - 10 }); };
  const promo = {
    label: 'Promo CD', media: 'CD',
    palette: ['#000000', '#e10600', '#777777', '#cccccc', '#999999', '#111111', '#ffffff'],
    shapes: {
      front(c, W, H) { bg(c, col().light, W, H); },
      back(c, W, H) { bg(c, col().light, W, H); },
      spine(c, w, H) { bg(c, col().light, w, H); },
      spineN(c, w, hh) { bg(c, col().light, w, hh); },
    },
    texts: {
      front(c, W, H) {
        const { s, dark } = col(), t = T();
        text(c, t.title, 10, 40, 22, { color: dark, maxW: W - 20 });
        text(c, t.subtitle, 10, 51, 6, { weight: 600, color: dark, maxW: W - 20 });
        text(c, t.label, W - 10, 14, 3.4, { weight: 600, color: s[2], align: 'right', maxW: W * 0.4 });
        promoBand(c, W, H * 0.62);
        items().forEach((b, i) => { const y = H * 0.62 + 22 + i * 6; if (y < H - 16) text(c, `${i + 1}. ${b}`, 10, y, 3.6, { weight: 500, color: dark, maxW: W - 20 }); });
        text(c, t.brand, 10, H - 8, 3.6, { weight: 700, color: dark, spacing: 2, maxW: W - 20 });
      },
      back(c, W, H) {
        const { s, dark } = col(), t = T();
        text(c, t.title, 10, 18, 8, { color: dark, maxW: W - 20 });
        items().forEach((b, i) => { const y = 32 + i * 7; if (y < H - 46) text(c, `${i + 1}. ${b}`, 10, y, 3.6, { weight: 500, color: dark, maxW: W - 20 }); });
        promoBand(c, W, H - 42);
        if (t.barcode) barcode(c, t.barcode, W - 40, H - 26, 30, 10, dark);
        text(c, `${t.label ? `${t.label} · ` : ''}${t.brand}`, 10, H - 12, 3.2, { weight: 500, color: s[2], maxW: W - 60 });
      },
      spine(c, w, H) { const { dark } = col(), t = T(); stacked(c, w, H, t.spineTitle, t.spineSub, dark); },
      spineN(c, w, hh) { const { dark } = col(), t = T(); along(c, w, hh, t.spineTitle, t.label, dark); },
    },
  };

  // ---------------- DVD / Blu-ray: 2000s Keepcase — photo, top billing, credit block, special features ----------------
  const credits = (c, W, y, color) => { const t = T(); if (t.blurb) { c.save(); c.globalAlpha *= 0.75; wrap(c, t.blurb.toUpperCase(), 8, y, W - 16, 2.6, 2.8, color, 400, y + 6, CONDENSED); c.restore(); } };
  const keepcase00 = {
    label: '2000s Keepcase', media: 'DVD / Blu-ray', base: 'dark', fonts: [[CONDENSED, 400]],
    palette: ['#e7c46b', '#c1121f', '#8d99ae', '#edf2f4', '#2b2d42', '#07080c', '#f5f5f5'],
    shapes: {
      front(c, W, H) { bg(c, col().dark, W, H); },
      back(c, W, H) { const { s, dark } = col(); bg(c, dark, W, H); const fw = (W - 22) / 3; for (let i = 0; i < 3; i++) fill(c, s[4], 8 + i * (fw + 3), 58, fw, 24); },
      spine(c, w, H) { bg(c, col().dark, w, H); },
      spineN(c, w, hh) { bg(c, col().dark, w, hh); },
    },
    texts: {
      front(c, W, H) { // over your photo layer
        const { s, light } = col(), t = T();
        text(c, [t.line1, t.line2].filter(Boolean).join('    ').toUpperCase(), W / 2, 14, 3.6, { weight: 600, color: light, align: 'center', spacing: 1.5, maxW: W - 14 });
        skew(c, W / 2, H * 0.62, () => text(c, t.tagline, 0, 0, 4.4, { weight: 500, color: light, align: 'center', maxW: W - 16 }));
        text(c, t.title, W / 2, H * 0.72, 17, { color: light, align: 'center', maxW: W - 14 });
        text(c, t.subtitle, W / 2, H * 0.72 + 9, 5, { weight: 600, color: s[0], align: 'center', spacing: 1.5, maxW: W - 16 });
        credits(c, W, H - 22, light);
        const bs = badges(); if (bs.length) { c.font = '600 3.2px Montserrat'; const tw = bs.reduce((a, b) => a + c.measureText(b).width + 5.8, 0); badgeRow(c, (W - tw) / 2, H - 6, 3.2, light, W); }
      },
      back(c, W, H) {
        const { s, light } = col(), t = T();
        text(c, t.tagline, W / 2, 16, 5, { weight: 700, color: s[0], align: 'center', maxW: W - 16 });
        if (t.blurb) wrap(c, t.blurb, 8, 26, W - 16, 3, 4, light, 500, 52);
        text(c, t.backTitle, 8, 94, 4, { weight: 700, color: s[0], spacing: 1.2, maxW: W - 16 });
        bullets(c, 10, 101, W - 20, H * 0.68, light);
        text(c, t.recHeading, 8, H - 50, 3, { weight: 600, color: light, spacing: 1, maxW: W - 50 });
        table(c, 10, H - 46, light, 50);
        credits(c, W, H - 20, light);
        if (t.barcode) barcode(c, t.barcode, W - 36, H - 48, 28, 10, light);
        badgeRow(c, 8, H - 5, 3, light, W - 8);
      },
      spine(c, w, H) {
        const { light } = col(), t = T();
        if (badges()[0]) boxed(c, badges()[0], w / 2, 22, 4.6, light);
        stacked(c, w, H, t.spineTitle, t.spineSub, light);
        text(c, t.brand, w / 2, H - 8, 3, { weight: 800, color: light, align: 'center', maxW: w - 3 });
      },
      spineN(c, w, hh) {
        const { light } = col(), t = T();
        if (badges()[0]) boxed(c, badges()[0], w / 2, 9, Math.min(3, w * 0.2), light);
        along(c, w, hh, t.spineTitle, t.brand, light, { start: 16 });
      },
    },
  };

  // ---------------- DVD / Blu-ray: Numbered Collection — minimal, spine number, lots of air ----------------
  const numbered = {
    label: 'Numbered Collection', media: 'DVD / Blu-ray',
    palette: ['#111111', '#c0392b', '#888888', '#dddddd', '#aaaaaa', '#111111', '#f7f5f0'],
    shapes: {
      front(c, W, H) { const { dark, light } = col(); bg(c, light, W, H); fill(c, dark, 10, 38, W - 20, 0.35); fill(c, dark, 10, 150, W - 20, 0.35); },
      back(c, W, H) { const { dark, light } = col(); bg(c, light, W, H); fill(c, dark, 10, 26, W - 20, 0.35); },
      spine(c, w, H) { bg(c, col().light, w, H); },
      spineN(c, w, hh) { bg(c, col().light, w, hh); },
    },
    texts: {
      front(c, W, H) {
        const { s, dark } = col(), t = T();
        text(c, t.label, 10, 32, 22, { color: dark, maxW: W - 20 });
        text(c, t.title.toUpperCase(), W / 2, 106, 8, { weight: 700, color: dark, align: 'center', spacing: 1, maxW: W - 20 });
        text(c, t.subtitle, W / 2, 115, 4, { weight: 500, color: s[2], align: 'center', maxW: W - 20 });
        text(c, t.line1, W / 2, 124, 3.4, { weight: 500, color: dark, align: 'center', maxW: W - 20 });
        text(c, t.brand.toUpperCase(), W / 2, H - 12, 3.4, { weight: 600, color: dark, align: 'center', spacing: 3, maxW: W - 20 });
      },
      back(c, W, H) {
        const { s, dark } = col(), t = T();
        text(c, t.title.toUpperCase(), 10, 20, 5, { weight: 700, color: dark, spacing: 1, maxW: W - 40 });
        text(c, t.label, W - 10, 20, 5, { color: s[1], align: 'right', maxW: 28 });
        if (t.blurb) wrap(c, t.blurb, 10, 36, W - 20, 3, 4.2, dark, 500, 80);
        bullets(c, 10, 90, W - 20, H - 50, dark, 2.9, '—');
        if (t.barcode) barcode(c, t.barcode, W - 38, H - 30, 26, 9, dark);
        text(c, t.brand.toUpperCase(), 10, H - 12, 3, { weight: 600, color: dark, spacing: 2, maxW: W - 50 });
      },
      spine(c, w, H) {
        const { dark } = col(), t = T();
        text(c, t.label, w / 2, 20, Math.min(8, w * 0.35), { color: dark, align: 'center', maxW: w - 3 });
        stacked(c, w, H, t.spineTitle.toUpperCase(), t.brand, dark, { weight: 600, size: 7 });
      },
      spineN(c, w, hh) {
        const { dark } = col(), t = T();
        text(c, t.label, w / 2, 9, Math.min(4, w * 0.3), { color: dark, align: 'center', maxW: w - 1.5 });
        along(c, w, hh, t.spineTitle.toUpperCase(), t.brand, dark, { weight: 600, start: 16 });
      },
    },
  };

  return { blank84, rental91, home, chrome82, normal79, mixtape, jewel90, promo, keepcase00, numbered };
}
