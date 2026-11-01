(() => {
  const plate = document.getElementById('plate');
  const meadow = document.getElementById('meadow');
  const air = document.getElementById('air');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const img = new Image();
  img.src = "assets/meadow.jpg";

  let W = 0, H = 0, dpr = 1, grainTile = null;

  /* seeded randomness for the painted edge */
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let R = mulberry(1);
  const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  function deform(pts, depth, amt) {
    for (let d = 0; d < depth; d++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y), v = (a.v + b.v) / 2;
        out.push(a, { x: (a.x + b.x) / 2 + gauss() * len * v * amt, y: (a.y + b.y) / 2 + gauss() * len * v * amt, v: v * (0.85 + R() * 0.25) });
      }
      pts = out;
    }
    return pts;
  }
  function rectPoly(inset, per) {
    const pts = [], x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
    const side = (ax, ay, bx, by) => { for (let i = 0; i < per; i++) { const t = i / per; pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, v: 0.4 + R() * 0.9 }); } };
    side(x0, y0, x1, y0); side(x1, y0, x1, y1); side(x1, y1, x0, y1); side(x0, y1, x0, y0);
    return pts;
  }
  function trace(c, p) { c.beginPath(); c.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y); c.closePath(); }
  const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ---------- the painted meadow ---------- */
  function paintMeadow() {
    if (!img.complete || !img.naturalWidth) return;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    meadow.width = pw; meadow.height = ph;

    // 1. photo, cover-fit, softened toward a watercolour palette
    const pic = off(pw, ph), p = pic.getContext('2d');
    const s = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    p.filter = 'saturate(0.95) contrast(1.02) brightness(1.02) sepia(0.06)';
    p.drawImage(img, (pw - iw) * 0.62, (ph - ih) * 0.5, iw, ih);
    p.filter = 'none';
    // pigment wash: deepen the centre for the lettering, warm the morning sun
    let g = p.createRadialGradient(pw / 2, ph * 0.5, 0, pw / 2, ph * 0.5, Math.max(pw, ph) * 0.62);
    g.addColorStop(0, 'rgba(30,22,16,0.40)'); g.addColorStop(0.55, 'rgba(30,22,16,0.18)'); g.addColorStop(1, 'rgba(30,22,16,0)');
    p.fillStyle = g; p.fillRect(0, 0, pw, ph);
    p.globalCompositeOperation = 'screen';
    g = p.createRadialGradient(pw * 0.9, -ph * 0.05, 0, pw * 0.9, -ph * 0.05, Math.max(pw, ph) * 0.55);
    g.addColorStop(0, 'rgba(250,210,150,0.5)'); g.addColorStop(1, 'rgba(250,206,140,0)');
    p.fillStyle = g; p.fillRect(0, 0, pw, ph);
    // paper grain, only where there is paint
    p.globalCompositeOperation = 'multiply'; p.globalAlpha = 0.28;
    p.fillStyle = p.createPattern(grainTile, 'repeat'); p.fillRect(0, 0, pw, ph);
    p.globalAlpha = 1; p.globalCompositeOperation = 'source-over';

    // 2. ragged watercolour edge as a mask
    R = mulberry(2021);
    const m = Math.min(W, H) * 0.03;
    const mask = off(pw, ph), mc = mask.getContext('2d');
    mc.scale(dpr, dpr);
    const base = deform(rectPoly(m * 0.75, 7), 2, 0.04);
    for (let i = 0; i < 40; i++) { mc.fillStyle = 'rgba(0,0,0,0.06)'; trace(mc, deform(base, 3, 0.045)); mc.fill(); }
    mc.filter = `blur(${m * 0.9}px)`; mc.fillStyle = '#000';
    mc.fillRect(m * 2.2, m * 2.2, W - m * 4.4, H - m * 4.4);
    mc.filter = 'none';

    // 3. pigment pooling along the edge
    p.save(); p.scale(dpr, dpr);
    for (let i = 0; i < 5; i++) { p.strokeStyle = 'rgba(60,40,26,0.06)'; p.lineWidth = m * 0.35; trace(p, deform(base, 3, 0.03)); p.stroke(); }
    p.restore();

    p.globalCompositeOperation = 'destination-in';
    p.drawImage(mask, 0, 0);

    const ctx = meadow.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(pic, 0, 0);
  }

  /* ---------- paper grain ---------- */
  function paintGrain() {
    const size = 220, c = off(size, size), x = c.getContext('2d'), d = x.createImageData(size, size);
    R = mulberry(7);
    for (let i = 0; i < d.data.length; i += 4) { const v = 205 + R() * 50; d.data[i] = v; d.data[i + 1] = v * 0.97; d.data[i + 2] = v * 0.9; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    grainTile = c;
  }

  /* ---------- sun rays + floating fluff ---------- */
  const actx = air.getContext('2d');
  let rays = [], raysCanvas = null, sun = { x: 0, y: 0 }, specks = [], sprites = null, L = 0;

  function buildRays() {
    sun = { x: W * 0.9, y: -H * 0.1 };
    L = Math.hypot(W, H) * 1.1;
    // angles pointing down-left from the sun (canvas radians: 0 = right, PI/2 = down)
    const centre = Math.atan2(H * 0.6 - sun.y, W * 0.3 - sun.x);
    R = mulberry(33);
    rays = [];
    for (let i = 0; i < 7; i++) rays.push({ a: centre + (i - 3) * 0.11 + (R() - 0.5) * 0.05, w: 0.018 + R() * 0.035, k: 0.45 + R() * 0.55 });
    raysCanvas = off(Math.round(W * dpr), Math.round(H * dpr));
    const r = raysCanvas.getContext('2d');
    r.scale(dpr, dpr);
    r.filter = `blur(${Math.max(8, Math.min(W, H) * 0.025)}px)`;
    for (const ray of rays) {
      const g = r.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, L);
      g.addColorStop(0, `rgba(255,232,186,${0.5 * ray.k})`);
      g.addColorStop(0.6, `rgba(255,232,186,${0.2 * ray.k})`);
      g.addColorStop(1, 'rgba(255,232,186,0)');
      r.fillStyle = g;
      r.beginPath(); r.moveTo(sun.x, sun.y); r.arc(sun.x, sun.y, L, ray.a - ray.w, ray.a + ray.w); r.closePath(); r.fill();
    }
  }
  function lightAt(x, y, sway) {
    const a = Math.atan2(y - sun.y, x - sun.x) - sway, d = Math.hypot(x - sun.x, y - sun.y) / L;
    let v = 0;
    for (const ray of rays) { const t = (a - ray.a) / (ray.w * 1.4); v += ray.k * Math.exp(-t * t); }
    return Math.min(1, v) * Math.max(0, 1 - d * 0.9);
  }

  function buildSprites() {
    const glow = off(64, 64), g = glow.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,254,250,1)'); rg.addColorStop(0.28, 'rgba(255,252,242,0.95)');
    rg.addColorStop(0.5, 'rgba(255,244,222,0.35)'); rg.addColorStop(1, 'rgba(255,240,214,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    // a dandelion-style seed: a bright point with fine radiating filaments
    const seed = off(96, 96), s = seed.getContext('2d');
    s.drawImage(glow, 32, 32, 32, 32);
    s.strokeStyle = 'rgba(255,252,242,0.75)'; s.lineWidth = 0.9; s.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + (i % 2) * 0.12, r1 = 5, r2 = 22 + (i % 3) * 5;
      s.beginPath(); s.moveTo(48 + Math.cos(a) * r1, 48 + Math.sin(a) * r1); s.lineTo(48 + Math.cos(a) * r2, 48 + Math.sin(a) * r2); s.stroke();
    }
    const halo = s.createRadialGradient(48, 48, 0, 48, 48, 40);
    halo.addColorStop(0, 'rgba(255,248,230,0.25)'); halo.addColorStop(1, 'rgba(255,248,230,0)');
    s.fillStyle = halo; s.fillRect(0, 0, 96, 96);
    sprites = { glow, seed };
  }

  function buildSpecks() {
    R = mulberry(5150);
    const n = Math.round(Math.min(240, Math.max(90, W * H / 4200)));
    specks = Array.from({ length: n }, () => {
      const z = Math.pow(R(), 1.35);              // most specks are far away and tiny
      return {
        x: R() * W, y: R() * H, z,
        size: 4.5 + z * 11, seed: z > 0.72 && R() < 0.6,
        p1: R() * 6.28, p2: R() * 6.28, p3: R() * 6.28,
        f1: 0.08 + R() * 0.18, f2: 0.06 + R() * 0.15,
        spin: (R() - 0.5) * 0.6, rot: R() * 6.28
      };
    });
  }

  let last = 0, t0 = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const t = (now - t0) / 1000;
    const sway = Math.sin(t * 0.12) * 0.022 + Math.sin(t * 0.05) * 0.012;
    const breathe = 0.82 + Math.sin(t * 0.35) * 0.1 + Math.sin(t * 0.9) * 0.04;

    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, air.width, air.height);
    // rays
    actx.globalCompositeOperation = 'screen';
    actx.globalAlpha = breathe;
    actx.translate(sun.x * dpr, sun.y * dpr); actx.rotate(sway); actx.translate(-sun.x * dpr, -sun.y * dpr);
    actx.drawImage(raysCanvas, 0, 0);
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // fluff
    actx.globalCompositeOperation = 'source-over';
    for (const p of specks) {
      const zf = 0.35 + p.z;
      p.x += (-3.5 + Math.sin(t * p.f1 + p.p1) * 7 + Math.sin(t * 0.31 + p.p3) * 2) * zf * dt;
      p.y += (-1.6 + Math.sin(t * p.f2 + p.p2) * 5) * zf * dt;
      p.rot += p.spin * dt;
      const pad = 40;
      if (p.x < -pad) p.x = W + pad; else if (p.x > W + pad) p.x = -pad;
      if (p.y < -pad) p.y = H + pad; else if (p.y > H + pad) p.y = -pad;

      const lit = lightAt(p.x, p.y, sway);
      const twinkle = 0.8 + 0.2 * Math.sin(t * (1.3 + p.f1 * 6) + p.p3);
      const a = (0.5 + 0.5 * lit) * twinkle * (0.6 + 0.4 * p.z);
      if (a < 0.02) continue;
      actx.globalAlpha = Math.min(1, a);
      if (p.seed) {
        const s = p.size * 1.7;
        actx.save(); actx.translate(p.x, p.y); actx.rotate(p.rot);
        actx.drawImage(sprites.seed, -s / 2, -s / 2, s, s);
        actx.restore();
      } else {
        const s = p.size;
        actx.drawImage(sprites.glow, p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    actx.globalAlpha = 1; actx.globalCompositeOperation = 'source-over';
    if (!reduce) requestAnimationFrame(frame);
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = plate.clientWidth; H = plate.clientHeight;
    air.width = Math.round(W * dpr); air.height = Math.round(H * dpr);
    paintGrain(); paintMeadow(); buildRays(); buildSpecks();
  }

  if (!sprites) buildSprites();
  layout();
  img.decode ? img.decode().then(paintMeadow, paintMeadow) : (img.onload = paintMeadow);
  requestAnimationFrame(frame);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); if (reduce) requestAnimationFrame(frame); }, 150); });

})();