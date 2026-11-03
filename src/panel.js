// Slide card renderer: a large Minecraft-styled card drawn on a canvas with the vanilla bitmap font (ascii.png).
// A slide may have: eyebrow, title, body (paragraph text), bullets, images (graphics), footer.
// Layouts are automatic: text only -> full-width text; with images -> text column + image column;
// layout: 'image' -> the image(s) take the whole content area under the title.
export const CARD_W = 1760, CARD_H = 990;      // 16:9, so the window fills a 16:9 screen evenly
const GLYPH = 8;

function glyphWidths(fontImg) {
  const c = document.createElement('canvas'); c.width = fontImg.width; c.height = fontImg.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(fontImg, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const cell = c.width / 16;
  const widths = [];
  for (let code = 0; code < 256; code++) {
    const cx = (code % 16) * cell, cy = Math.floor(code / 16) * cell;
    let w = 0;
    for (let x = 0; x < cell; x++) for (let y = 0; y < cell; y++) if (d[((cy + y) * c.width + cx + x) * 4 + 3] > 0) w = Math.max(w, x + 1);
    widths[code] = code === 32 ? 4 : w ? w + 1 : 0;
  }
  return { widths, cell };
}

export function createPanelFactory(img) {
  const { widths, cell } = glyphWidths(img.font);
  const glyphCanvas = document.createElement('canvas'); glyphCanvas.width = img.font.width; glyphCanvas.height = img.font.height;
  glyphCanvas.getContext('2d').drawImage(img.font, 0, 0);
  const planks = img.dark_oak_planks;
  const cw = (ch) => widths[ch.charCodeAt(0) & 255] || 4;
  const measure = (text, scale) => { let w = 0; for (const ch of text) w += cw(ch) * scale; return w; };

  function drawText(g, text, x, y, scale, color, shadow = true) {
    const tmp = document.createElement('canvas'); tmp.width = Math.max(1, measure(text, 1) + 2); tmp.height = GLYPH;
    const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
    let px = 0;
    for (const ch of text) {
      const code = ch.charCodeAt(0) & 255;
      tg.drawImage(glyphCanvas, (code % 16) * cell, Math.floor(code / 16) * cell, cell, cell, px, 0, cell, cell);
      px += widths[code] || 4;
    }
    const tint = (col) => {
      const t2 = document.createElement('canvas'); t2.width = tmp.width; t2.height = tmp.height;
      const g2 = t2.getContext('2d');
      g2.drawImage(tmp, 0, 0);
      g2.globalCompositeOperation = 'source-in'; g2.fillStyle = col; g2.fillRect(0, 0, t2.width, t2.height);
      return t2;
    };
    g.imageSmoothingEnabled = false;
    if (shadow) g.drawImage(tint('#1b1b1b'), x + scale, y + scale, tmp.width * scale, tmp.height * scale);
    g.drawImage(tint(color), x, y, tmp.width * scale, tmp.height * scale);
  }

  function wrap(text, scale, maxW) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const t = line ? line + ' ' + word : word;
        if (measure(t, scale) > maxW && line) { lines.push(line); line = word; } else line = t;
      }
      lines.push(line);
    }
    return lines;
  }

  // body paragraphs + bullets as one flow of {text, bullet, first} lines at a given scale
  function flow(content, scale, maxW) {
    const out = [];
    const indent = measure('- ', scale);
    if (content.body) for (const para of String(content.body).split('\n')) { const head = /[A-Z]/.test(para) && para === para.toUpperCase(); for (const l of wrap(para, scale, maxW)) out.push({ text: l, bullet: false, head }); }
    if (content.body && content.bullets && content.bullets.length) out.push({ gap: true });
    for (const b of content.bullets || []) {
      wrap(b, scale, maxW - indent).forEach((l, i) => out.push({ text: l, bullet: true, first: i === 0, indent }));
    }
    if (content.body2) {                // a second heading with its own bullets
      out.push({ gap: true });
      for (const l of wrap(content.body2, scale, maxW)) out.push({ text: l, bullet: false });
      for (const b of content.bullets2 || []) wrap(b, scale, maxW - indent).forEach((l, i) => out.push({ text: l, bullet: true, first: i === 0, indent }));
    }
    if (content.after) { out.push({ gap: true }); for (const l of wrap(content.after, scale, maxW)) out.push({ text: l, bullet: false }); }     // closing paragraph below the bullets
    return out;
  }
  const lineH = (l, s) => (l.gap ? s * 4 : GLYPH * s + s * 3 + (l.first ? s * 2 : 0));
  const flowHeight = (lines, s) => lines.reduce((h, l) => h + lineH(l, s), 0);

  function drawImageFit(g, im, x, y, w, h) {
    const k = Math.min(w / im.width, h / im.height);
    const iw = im.width * k, ih = im.height * k, ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, h);
    g.imageSmoothingEnabled = k < 1 || im.width > 128;      // photos / charts stay smooth, pixel art stays crisp
    g.drawImage(im, ix, iy, iw, ih);
    g.strokeStyle = '#5c3b22'; g.lineWidth = 6; g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.strokeRect(x - 9, y - 9, w + 18, h + 18);
  }

  // team-photo box: framed, cover-cropped picture (or an empty "PHOTO" placeholder) with an optional caption underneath
  function drawPhotoBox(g, ph, x, y, w, h, capH) {
    const bh = h - capH;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, y, w, bh);
    const im = ph.image;
    if (im) {
      const k = Math.max(w / im.width, bh / im.height), sw = w / k, sh = bh / k;
      g.imageSmoothingEnabled = im.width > 128;
      g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, bh);
    } else {
      const t = ph.label || 'PHOTO';
      drawText(g, t, x + (w - measure(t, 4)) / 2, y + (bh - GLYPH * 4) / 2, 4, '#7d6a58');
    }
    g.strokeStyle = '#5c3b22'; g.lineWidth = 6; g.strokeRect(x - 3, y - 3, w + 6, bh + 6);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.strokeRect(x - 9, y - 9, w + 18, bh + 18);
    if (ph.caption) {
      let cs = 3; while (cs > 2 && measure(ph.caption, cs) > w + 40) cs--;
      drawText(g, ph.caption, x + (w - measure(ph.caption, cs)) / 2, y + bh + 14, cs, '#F5EFC6');
    }
    if (ph.role) {
      let rs = 2; while (rs > 1 && measure(ph.role, rs) > w + 40) rs--;
      drawText(g, ph.role, x + (w - measure(ph.role, rs)) / 2, y + bh + 14 + GLYPH * 3 + 8, rs, '#FFAA00');
    }
  }

  // content: { eyebrow, title, body, bullets, photos: [{ image, caption }], images: [HTMLImageElement], layout, footer }
  function renderCard(content) {
    const W = CARD_W, H = CARD_H;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y += 44) for (let x = 0; x < W; x += 44) g.drawImage(planks, 0, 0, 16, 16, x, y, 44, 44);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, W, 18); g.fillRect(0, H - 18, W, 18); g.fillRect(0, 0, 18, H); g.fillRect(W - 18, 0, 18, H);
    g.fillStyle = '#5c3b22'; g.fillRect(18, 18, W - 36, 7); g.fillRect(18, 18, 7, H - 36);
    const pad = 90, innerW = W - pad * 2;
    const tpad = 56;
    let y = 46;
    if (content.eyebrow) { drawText(g, content.eyebrow.toUpperCase(), pad, y, 5, '#A5BCD6'); y += GLYPH * 5 + 26; }
    let ts = 6.25; while (ts > 6 && measure(content.title, ts) > innerW) ts--;
    for (const l of wrap(content.title, ts, innerW)) { drawText(g, l, tpad, y, ts, '#F5EFC6'); y += GLYPH * ts + 12; }
    y += 14;
    const footerH = content.footer ? 96 : 56;
    const photos = content.photos || [];
    const PH = 180, PH_CAP = 66, PH_GAP = 40, STRIP_BOTTOM = 36, stripH = photos.length ? PH + PH_CAP + 20 : 0;    // photo strip in the bottom right corner: same square size on every slide
    const areaTop = y, areaBottom = H - footerH, areaH = (photos.length ? H - STRIP_BOTTOM - PH - PH_CAP - 20 : areaBottom) - areaTop;
    const imgs = (content.images || []).filter(Boolean);
    const wantImage = content.layout === 'image' && imgs.length;
    const cols = content.columns && content.columns.length ? content.columns : null;
    const hasText = !!(cols || content.body || content.after || (content.bullets && content.bullets.length));

    // room for pictures from past events: a column on the right above the team photos (wider when the slide has no text)
    const gallery = content.gallery || [];
    const GW = gallery.length ? (content.galleryW || (hasText ? 360 : 880)) : 0, galleryBottom = H - STRIP_BOTTOM - PH - PH_CAP - 24;
    let textW = innerW - (GW ? GW + 60 : 0), imgX = 0, imgW = 0;
    if (imgs.length && hasText && !wantImage) { textW = Math.round(innerW * 0.5); imgX = pad + textW + 70; imgW = W - pad - imgX; }
    else if (imgs.length) { imgX = pad; imgW = innerW; }

    const drawFlow = (lines, x, bs) => {
      let ty = areaTop;
      for (const l of lines) {
        if (l.gap) { ty += bs * 4; continue; }
        const off = l.first ? bs * 2 : 0;
        if (l.bullet) {
          if (l.first) drawText(g, '-', x, ty + off, bs, '#FFAA00');
          drawText(g, l.text, x + l.indent, ty + off, bs, '#FFFFFF');
        } else drawText(g, l.text, x, ty, bs, l.head ? '#FFAA00' : '#FFFFFF');
        ty += lineH(l, bs);
      }
    };
    if (hasText && !wantImage) {
      if (cols) {                       // side-by-side text columns, all at the largest size where every column fits
        const gapC = 60, tw = textW - gapC * (cols.length - 1), wsum = cols.reduce((a, cc) => a + (cc.w || 1), 0);
        const cws = cols.map((cc) => tw * (cc.w || 1) / wsum), xs = cws.map((_, ci) => pad + cws.slice(0, ci).reduce((a, v) => a + v + gapC, 0));
        let bs = 9;
        for (; bs > 3; bs -= 0.5) if (cols.every((cc, ci) => flowHeight(flow(cc, bs, cws[ci]), bs) <= areaH)) break;
        cols.forEach((cc, ci) => drawFlow(flow(cc, bs, cws[ci]), xs[ci], bs));
      } else {
        let bs = 9, lines;
        for (; bs > 3; bs -= 0.5) { lines = flow(content, bs, textW); if (flowHeight(lines, bs) <= areaH) break; }
        drawFlow(flow(content, bs, textW), pad, bs);
      }
    }
    if (gallery.length) {
      const n = gallery.length, gc = n <= 2 && GW < 600 ? 1 : n <= 2 ? n : 2, gr = Math.ceil(n / gc), gg = 28, gx0 = W - 52 - GW, gy0 = areaTop + 6;
      const cwid = (GW - gg * (gc - 1)) / gc, chei = (galleryBottom - gy0 - gg * (gr - 1)) / gr;
      gallery.forEach((ph, i) => drawPhotoBox(g, ph, gx0 + (i % gc) * (cwid + gg), gy0 + Math.floor(i / gc) * (chei + gg), cwid, chei, 0));
    }
    if (content.logos && content.logos.length) {                 // department logos, top right of the card, side by side, all the same height
      const LH = 80, LG = 34, ims = content.logos.filter(Boolean), widths = ims.map((im) => im.width / im.height * LH);
      let lx = W - 52 - (widths.reduce((a, v) => a + v, 0) + LG * (ims.length - 1));
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      ims.forEach((im, i) => { g.drawImage(im, lx, 34, widths[i], LH); lx += widths[i] + LG; });
      g.imageSmoothingEnabled = false;
    }
    if (content.centerBoxes && content.centerBoxes.length) {      // groups of square boxes centred on the card (heading, then boxes with name + CEO underneath)
      const groups = content.centerBoxes, SZ = 190, ROWH = 385, GAP2 = 60, blockH = (groups.length - 1) * (ROWH + GAP2) + 345;
      const topY = areaTop + Math.max(0, Math.round((H - areaTop - blockH) / 2)) - 12;                // centred vertically in the space below the title
      groups.forEach((gr, gi) => {
        const GAPB = gr.items.length <= 2 ? 190 : gr.items.length === 3 ? 215 : 100, pitch = SZ + GAPB;
        const fit = (txt, start) => { let z = start; while (z > 2 && measure(txt, z) > pitch - 24) z--; return z; };
        const NS = Math.min(...gr.items.map((b) => fit(b.name, 4))), CS = Math.min(3, ...gr.items.filter((b) => b.ceo).map((b) => fit('CEO: ' + b.ceo, 3)));
        const y0 = topY + gi * ROWH + (gi > 0 ? GAP2 : 0);
        drawText(g, gr.label, Math.round((W - measure(gr.label, 4)) / 2), y0, 4, '#FFAA00');
        const rowW = gr.items.length * SZ + (gr.items.length - 1) * GAPB, x0 = Math.round((W - rowW) / 2), by = y0 + GLYPH * 4 + 22;
        gr.items.forEach((b, i) => {
          const x = x0 + i * pitch;
          drawPhotoBox(g, { image: b.image, label: b.label || 'LOGO' }, x, by, SZ, SZ, 0);
          drawText(g, b.name, x + (SZ - measure(b.name, NS)) / 2, by + SZ + 22, NS, '#F5EFC6');
          if (!b.ceo) return;                                  // no CEO line for startups that don't list one
          const cl = 'CEO: ' + b.ceo;
          drawText(g, cl, x + (SZ - measure(cl, CS)) / 2, by + SZ + 22 + GLYPH * NS + 14, CS, '#FFAA00');
        });
      });
    }
    if (content.tagline) {              // the closing tag line, beside the photos (left of them), vertically centred on the boxes
      const rowW0 = photos.length ? photos.length * PH + (photos.length - 1) * PH_GAP : 0;
      const tx0 = pad, tx1 = (photos.length ? W - 52 - rowW0 - 70 : W - pad), tw = tx1 - tx0, boxH = PH + PH_CAP;
      let ts2 = 6, lines2;
      for (; ts2 >= 3; ts2--) { lines2 = wrap(content.tagline, ts2, tw); if (lines2.length * (GLYPH * ts2 + ts2 * 4) <= boxH) break; }
      lines2 = wrap(content.tagline, ts2, tw);
      const lh = GLYPH * ts2 + ts2 * 4, ty0 = H - STRIP_BOTTOM - PH - PH_CAP + (boxH - lines2.length * lh) / 2;
      lines2.forEach((l, i) => drawText(g, l, tx0, ty0 + i * lh, ts2, '#FFAA00'));
    }
    if (photos.length) {
      const rowW = photos.length * PH + (photos.length - 1) * PH_GAP, x0 = W - 52 - rowW, y0 = H - STRIP_BOTTOM - PH - PH_CAP;
      photos.forEach((ph, i) => drawPhotoBox(g, ph, x0 + i * (PH + PH_GAP), y0, PH, PH + PH_CAP, PH_CAP));
    }
    if (imgs.length) {
      if (imgs.length === 1) drawImageFit(g, imgs[0], imgX, areaTop, imgW, areaH);
      else {
        const cols = imgs.length === 2 && imgW < 900 ? 1 : 2, rows = Math.ceil(imgs.length / cols), gap = 28;
        const cwid = (imgW - gap * (cols - 1)) / cols, chei = (areaH - gap * (rows - 1)) / rows;
        imgs.forEach((im, i) => drawImageFit(g, im, imgX + (i % cols) * (cwid + gap), areaTop + Math.floor(i / cols) * (chei + gap), cwid, chei));
      }
    }
    if (content.footer) { let fs = 5; while (fs > 2 && measure(content.footer, fs) > innerW) fs--; drawText(g, content.footer, W - pad - measure(content.footer, fs), H - 78, fs, '#FFAA00'); }
    return cv;
  }
  return { renderCard };
}
