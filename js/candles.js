/* ============================================================
   NOVATITRE — MOTEUR DE GRAPHIQUES (bougies, volumes, indicateurs)
   ------------------------------------------------------------
   Les graphiques des missions et de la salle de marché sont
   GÉNÉRÉS (données simulées, reproductibles). Sur le vrai site, la
   salle de marché pourra rejouer de vraies séances passées,
   anonymisées, avec des données sous licence.
   ============================================================ */
window.NT_CANDLES = (() => {
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => [...String(s)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7);
  const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  /* g = { kind, n, seed, base, vol, tail:[figures] }
     kinds : up, down, range, breakout, fakeout, top, bottom, flat, crash, regime (salle de marché) */
  function gen(g){
    const r = mulberry(hash(g.kind + ':' + (g.seed || 1)));
    const n = g.n || 48, base = g.base || 50, vol = g.vol || 0.011, out = [];
    let p = base, regime = 0, rLeft = 0;
    const rangeEnd = Math.floor(n * 0.72);
    for (let i = 0; i < n; i++){
      let drift = 0, vm = 1, volu = 1;
      switch (g.kind){
        case 'up': drift = 0.0055; vm = 1.35; break;
        case 'down': drift = -0.0055; vm = 1.35; break;
        case 'flat': drift = (base - p) / p * 0.3; break;
        case 'range': { const t = base * (1 + 0.045 * Math.sin(i / n * Math.PI * 2 * 2.6)); drift = (t - p) / p * 0.55; vm = 0.55; break; }
        case 'breakout': if (i < rangeEnd){ const t = base * (1 + 0.035 * Math.sin(i / rangeEnd * Math.PI * 2 * 2)); drift = (t - p) / p * 0.55; vm = 0.5; volu = 0.8; }
          else { drift = i === rangeEnd ? 0.045 : 0.009; volu = i < rangeEnd + 3 ? 3.2 : 1.6; } break;
        case 'fakeout': if (i < rangeEnd){ const t = base * (1 + 0.035 * Math.sin(i / rangeEnd * Math.PI * 2 * 2)); drift = (t - p) / p * 0.55; vm = 0.5; volu = 0.9; }
          else if (i < rangeEnd + 2){ drift = 0.03; volu = 0.7; } else { drift = -0.012; volu = 1.4; } break;
        case 'top': drift = i < n * 0.55 ? 0.006 : -0.006; vm = 1.3; break;
        case 'bottom': drift = i < n * 0.55 ? -0.006 : 0.006; vm = 1.3; break;
        case 'crash': drift = i < n * 0.6 ? 0.004 : (i < n * 0.75 ? -0.03 : 0.006); volu = i >= n * 0.6 && i < n * 0.75 ? 3 : 1; vm = i >= n * 0.6 && i < n * 0.75 ? 2 : 1; break;
        case 'regime': if (rLeft-- <= 0){ const x = r(); regime = x < 0.3 ? 1 : x < 0.55 ? -1 : 0; rLeft = 25 + Math.floor(r() * 45); }
          drift = regime * 0.004 + (regime === 0 ? (base - p) / p * 0.04 : 0); vm = regime === 0 ? 0.8 : 1.1; break;
      }
      const o = out.length ? out[out.length - 1].c * (1 + gauss(r) * vol * 0.12) : p;
      const c = Math.max(0.5, o * (1 + drift + gauss(r) * vol * 0.75 * vm));
      const hi = Math.max(o, c) * (1 + Math.abs(gauss(r)) * vol * 0.45 * vm);
      const lo = Math.min(o, c) * (1 - Math.abs(gauss(r)) * vol * 0.45 * vm);
      out.push({ o, h: hi, l: lo, c, v: Math.round(100 * (0.75 + r() * 0.5) * volu) });
      p = c;
    }
    for (const f of (g.tail || [])) out.push(...figure(f, out[out.length - 1].c, r));
    const meta = { last: out[out.length - 1].c };
    const lows = out.map(x => x.l), highs = out.map(x => x.h);
    const core = g.kind === 'breakout' || g.kind === 'fakeout' ? out.slice(0, rangeEnd) : out;
    meta.hi = Math.max(...core.map(x => x.h)); meta.lo = Math.min(...core.map(x => x.l));
    meta.max = Math.max(...highs); meta.min = Math.min(...lows);
    const tailN = (g.tail || []).length ? (g.tail || []).length + 1 : 0;
    const recent = out.slice(-(12 + tailN));
    meta.swingLow = Math.min(...recent.map(x => x.l)); meta.swingHigh = Math.max(...recent.map(x => x.h));
    return { cs: out, meta };
  }
  /* figures de bougies ajoutées à la fin (p = dernier cours) */
  function figure(f, p, r){
    const k = 1 + (r() - 0.5) * 0.002;
    switch (f){
      case 'hammer':   return [{ o: p, c: p * 1.004 * k, h: p * 1.006, l: p * 0.968, v: 140 }];
      case 'shooting': return [{ o: p, c: p * 0.996 * k, h: p * 1.032, l: p * 0.994, v: 140 }];
      case 'doji':     return [{ o: p, c: p * 1.0004, h: p * 1.016, l: p * 0.984, v: 110 }];
      case 'bullEngulf': { const a = { o: p, c: p * 0.992, h: p * 1.002, l: p * 0.99, v: 90 }; return [a, { o: p * 0.986, c: p * 1.024, h: p * 1.027, l: p * 0.984, v: 210 }]; }
      case 'bearEngulf': { const a = { o: p, c: p * 1.008, h: p * 1.01, l: p * 0.998, v: 90 }; return [a, { o: p * 1.014, c: p * 0.976, h: p * 1.016, l: p * 0.973, v: 210 }]; }
      case 'bigGreen': return [{ o: p, c: p * 1.035, h: p * 1.038, l: p * 0.998, v: 260 }];
      case 'bigRed':   return [{ o: p, c: p * 0.965, h: p * 1.002, l: p * 0.962, v: 260 }];
    }
    return [];
  }
  const sma = (cs, n) => cs.map((_, i) => i < n - 1 ? null : cs.slice(i - n + 1, i + 1).reduce((s, x) => s + x.c, 0) / n);
  function rsi(cs, n = 14){
    const out = cs.map(() => null); let g = 0, l = 0;
    for (let i = 1; i < cs.length; i++){
      const d = cs[i].c - cs[i - 1].c, up = Math.max(0, d), dn = Math.max(0, -d);
      if (i <= n){ g += up; l += dn; if (i === n){ g /= n; l /= n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    return out;
  }
  /* niveaux { k:'hi'|'lo'|'swingLow'|'swingHigh'|'last'|'max'|'min', off:0.01, label:'A' } → prix */
  const levelPrice = (meta, L) => (L.y != null ? L.y : meta[L.k]) * (1 + (L.off || 0));

  /* rendu SVG. opt = { w, ma:[20,50], vol:true, rsi:true, levels:[], marks:[{i,label}], lines:[{y,color,label,dash}], from }  */
  function svg(cs, opt = {}){
    const w = opt.w || 340, ph = opt.ph || 170, vh = opt.vol ? 34 : 0, rh = opt.rsi ? 56 : 0, gap = 8;
    const H = ph + (vh ? vh + gap : 0) + (rh ? rh + gap : 0) + 4;
    const view = cs.slice(opt.from || 0), N = view.length;
    const ex = (opt.lines || []).map(x => x.y).concat((opt.levels || []).map(x => x.y));
    const mn = Math.min(...view.map(x => x.l), ...ex), mx = Math.max(...view.map(x => x.h), ...ex);
    const pad = (mx - mn) * 0.08 || 1, lo = mn - pad, hi = mx + pad;
    const cw = (w - 44) / N, X = i => 4 + i * cw + cw / 2, Y = v => 6 + (1 - (v - lo) / (hi - lo)) * (ph - 12);
    let s = `<svg class="cchart" viewBox="0 0 ${w} ${H}" role="img" aria-label="${opt.label || 'Graphique en bougies'}">`;
    for (let k = 0; k <= 3; k++){ const v = lo + (hi - lo) * k / 3; s += `<line x1="0" x2="${w - 40}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="${w - 36}" y="${(Y(v) + 3).toFixed(1)}" class="ax">${v.toFixed(v < 20 ? 2 : 1).replace('.', ',')}</text>`; }
    (opt.ma || []).forEach((n, k) => { const m = sma(cs, n).slice(opt.from || 0); const pts = m.map((v, i) => v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).filter(Boolean).join(' ');
      if (pts) s += `<polyline points="${pts}" fill="none" stroke="${['#a68cff', '#66d0ff', '#ff7aa8'][k]}" stroke-width="1.6" opacity=".95"/>`; });
    const bw = Math.max(1.5, cw * 0.62);
    view.forEach((c, i) => { const up = c.c >= c.o, col = up ? '#3fd39a' : '#ff6b7f', x = X(i);
      s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(c.h).toFixed(1)}" y2="${Y(c.l).toFixed(1)}" stroke="${col}" stroke-width="1.1"/>`;
      const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
      s += `<rect x="${(x - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, y2 - y1).toFixed(1)}" fill="${col}" rx="0.6"/>`; });
    (opt.lines || []).concat(opt.levels || []).forEach(L => { const y = Y(L.y).toFixed(1), col = L.color || '#fff';
      s += `<line x1="0" x2="${w - 40}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="1.4" ${L.dash === false ? '' : 'stroke-dasharray="5 4"'}/>`;
      if (L.label) s += `<g><rect x="${w - 40}" y="${(+y - 9).toFixed(1)}" width="38" height="18" rx="6" fill="${col}"/><text x="${w - 21}" y="${(+y + 4).toFixed(1)}" text-anchor="middle" class="lbl">${L.label}</text></g>`; });
    (opt.marks || []).forEach(m => { const i = m.i < 0 ? N + m.i : m.i, c = view[i]; if (!c) return; const x = X(i), y = Y(c.h) - 16;
      s += `<g><circle cx="${x.toFixed(1)}" cy="${Math.max(10, y).toFixed(1)}" r="9" fill="#fff"/><text x="${x.toFixed(1)}" y="${(Math.max(10, y) + 4).toFixed(1)}" text-anchor="middle" class="lbl">${m.label}</text></g>`; });
    let top = ph + gap;
    if (vh){ const vmx = Math.max(...view.map(x => x.v));
      view.forEach((c, i) => { const hh = c.v / vmx * vh; s += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${(top + vh - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${c.c >= c.o ? '#3fd39a' : '#ff6b7f'}" opacity=".45"/>`; });
      s += `<text x="${w - 36}" y="${top + 10}" class="ax">Vol.</text>`; top += vh + gap; }
    if (rh){ const R = rsi(cs).slice(opt.from || 0), RY = v => top + (1 - v / 100) * rh;
      s += `<rect x="0" y="${RY(70).toFixed(1)}" width="${w - 40}" height="${(RY(30) - RY(70)).toFixed(1)}" fill="rgba(255,255,255,.04)"/>`;
      [70, 30].forEach(v => { s += `<line x1="0" x2="${w - 40}" y1="${RY(v).toFixed(1)}" y2="${RY(v).toFixed(1)}" class="grid"/><text x="${w - 36}" y="${(RY(v) + 3).toFixed(1)}" class="ax">${v}</text>`; });
      const pts = R.map((v, i) => v == null ? null : `${X(i).toFixed(1)},${RY(v).toFixed(1)}`).filter(Boolean).join(' ');
      if (pts) s += `<polyline points="${pts}" fill="none" stroke="#c4b5ff" stroke-width="1.5"/>`;
      s += `<text x="4" y="${top + 10}" class="ax">RSI 14</text>`; }
    return s + '</svg>';
  }
  /* Un graphique de question doit vraiment montrer ce que la question affirme.
     Sert à changer de graphique quand on rejoue (seulement des graphiques « conformes »). */
  function valid(g, show = {}){
    const { cs, meta } = gen(g), L = cs[cs.length - 1], F = cs[0], m20 = sma(cs, 20), r = rsi(cs), last = x => x[x.length - 1];
    const tailN = (g.tail || []).length ? 3 : 0, core = cs.slice(0, cs.length - tailN), cl = core[core.length - 1], ch = (cl.c / F.o - 1) * 100;
    let ok = true;
    switch (g.kind){
      case 'up': ok = ch > (tailN ? 4 : 10); if (!tailN && show.ma) ok = ok && L.c > last(m20); if (show.rsi) ok = ok && last(r) > 70; break;
      case 'down': ok = ch < -(tailN ? 4 : 10); if (!tailN && show.ma) ok = ok && L.c < last(m20); if (show.rsi) ok = ok && last(r) < 35; break;
      case 'range': ok = Math.abs(ch) < 3 && L.c > meta.lo * 1.01 && L.c < meta.hi * 0.99; break;
      case 'breakout': ok = L.c > meta.hi * 1.04 && (!show.ma || L.c > last(m20)); break;
      case 'fakeout': ok = meta.max > meta.hi * 1.005 && L.c < meta.hi * 0.99; break;
      case 'top': ok = L.c < last(m20) && last(m20) < m20[m20.length - 6]; break;
    }
    return ok;
  }
  /* Description texte (lecteurs d'écran, accessibilité) */
  function describe(cs, opt = {}){
    const F = cs[0], L = cs[cs.length - 1], ch = (L.c / F.o - 1) * 100, hi = Math.max(...cs.map(x => x.h)), lo = Math.min(...cs.map(x => x.l));
    const f = v => v.toFixed(2).replace('.', ',');
    let t = `Graphique en bougies de ${cs.length} périodes. Le cours passe de ${f(F.o)} à ${f(L.c)} (${ch >= 0 ? '+' : ''}${ch.toFixed(1).replace('.', ',')} %). Plus haut ${f(hi)}, plus bas ${f(lo)}. Dernière bougie ${L.c >= L.o ? 'verte' : 'rouge'}, ouverture ${f(L.o)}, clôture ${f(L.c)}, plus haut ${f(L.h)}, plus bas ${f(L.l)}.`;
    (opt.levels || []).forEach(x => { t += ` Ligne ${x.label} à ${f(x.y)}.`; });
    (opt.ma || []).forEach(n => { const m = sma(cs, n), v = m[m.length - 1]; if (v) t += ` Moyenne mobile ${n} à ${f(v)}, cours ${L.c > v ? 'au-dessus' : 'en dessous'}.`; });
    if (opt.rsi){ const r = rsi(cs); t += ` RSI à ${Math.round(r[r.length - 1])}.`; }
    if (opt.vol){ const v = cs.map(x => x.v), avg = v.slice(0, -5).reduce((a, b) => a + b, 0) / (v.length - 5), rec = Math.max(...v.slice(-12)); t += ` Volumes récents ${rec > avg * 2 ? 'nettement supérieurs' : 'proches'} de la moyenne.`; }
    return t;
  }
  return { gen, sma, rsi, svg, levelPrice, valid, describe };
})();
