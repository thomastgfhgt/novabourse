/* ============================================================
   NOVATITRE — MOTEUR 3D DE POINTS LUMINEUX (V20, 03/11/2026)
   Three.js r149 (licence MIT, js/vendor/three.min.js).
   - Des milliers de points avec halo (mélange additif), en profondeur.
   - morph() : les points quittent une forme et en dessinent une autre,
     chacun avec son petit retard, en passant par la profondeur.
   - warp() : effet « vitesse lumière » (les points foncent vers nous).
   - Champ d'étoiles qui défile en 3D derrière.
   - Aucune donnée, aucun réseau : uniquement du dessin.
   Si WebGL n'existe pas, NTGL.ok = false et le site garde sa version 2D.
   ============================================================ */
(function () {
  'use strict';
  const T = window.THREE;
  const ok = (() => { try { if (!T) return false; const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  const mobile = Math.min(screen.width, screen.height) < 700;

  /* ---------- texte des shaders ---------- */
  const VS = `
    attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed; attribute float aSize; attribute float aDelay; attribute float aFlow;
    uniform vec3 uFlowDir; uniform float uFlowLen; uniform float uFlowSpeed;
    uniform float uMix; uniform float uTime; uniform float uWarp; uniform float uPix; uniform float uScale; uniform float uSpread; uniform float uScatter;
    varying float vA; varying float vSeed; varying float vNear;
    void main(){
      float d = aDelay * 0.55;
      float t = clamp((uMix - d) / 0.45, 0.0, 1.0);
      t = t * t * (3.0 - 2.0 * t);
      vec3 p = mix(aFrom, aTo, t);
      p.z += sin(t * 3.14159) * (aSeed - 0.5) * uSpread;
      /* points « en flux » (flamme, courant) : ils glissent le long d'une direction puis renaissent */
      float fl = 0.0; if (aFlow > 0.5) { fl = fract(aSeed * 7.13 + uTime * uFlowSpeed); p += uFlowDir * fl * uFlowLen * t + vec3(sin(aSeed * 71.0), 0.0, cos(aSeed * 53.0)) * fl * uFlowLen * 0.18 * t; }
      p += 0.011 * vec3(sin(uTime * 1.3 + aSeed * 40.0), cos(uTime * 1.1 + aSeed * 31.0), sin(uTime * 0.9 + aSeed * 23.0));
      p.z += uWarp * (1.5 + aSeed * 7.0);
      vec3 dir = normalize(vec3(sin(aSeed * 91.7), cos(aSeed * 53.3) * 0.85, sin(aSeed * 27.1 + 1.3)) + 0.0001);
      p += dir * uScatter * (0.25 + fract(aSeed * 13.7) * 1.5) + vec3(0.0, -uScatter * 0.5 * fract(aSeed * 7.3), 0.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPix * uScale / max(0.4, -mv.z) * (1.0 + uWarp * 2.5);
      vA = (0.6 + 0.4 * sin(uTime * 2.2 + aSeed * 57.0)) * (1.0 - fl * 0.95);
      vSeed = aSeed; vNear = clamp(1.0 - (-mv.z - 2.0) / 10.0, 0.25, 1.0) * (1.0 - uScatter * 0.3);
    }`;
  const FS = `
    uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uAlpha;
    varying float vA; varying float vSeed; varying float vNear;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float r = length(c);
      if (r > 0.5) discard;
      float glow = pow(smoothstep(0.5, 0.0, r), 2.2);
      float core = smoothstep(0.14, 0.0, r);
      vec3 col = vSeed < 0.55 ? uC1 : (vSeed < 0.8 ? uC2 : uC3);
      gl_FragColor = vec4(col * (0.75 + core * 0.9), glow * vA * uAlpha * vNear);
    }`;
  const SVS = `
    attribute float aSeed; uniform float uTime; uniform float uSpeed; uniform float uPix; uniform float uDepth;
    varying float vA;
    void main(){
      vec3 p = position;
      p.z = mod(p.z + uSpeed, uDepth) - uDepth + 4.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float near = clamp(1.0 - (-mv.z) / uDepth, 0.0, 1.0);
      gl_PointSize = uPix * (0.6 + 2.6 * near * near) ;
      vA = near * (0.55 + 0.45 * sin(uTime * 1.7 + aSeed * 60.0));
    }`;
  const SFS = `
    varying float vA;
    void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; gl_FragColor = vec4(0.88, 0.86, 1.0, pow(smoothstep(0.5, 0.0, r), 2.0) * vA * 0.8); }`;

  const col = h => new T.Color(h);
  const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  /* ---------- une scène de points ---------- */
  class Particles {
    constructor(canvas, o = {}) {
      this.cv = canvas; this.o = Object.assign({ count: mobile ? 7000 : 14000, stars: false, camZ: 6, fov: 45, spread: 2.2, sway: 0.25, pauseIf: null }, o);
      this.q = 1; this.ft = []; this.vis = true;
      if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(es => { this.vis = es[es.length - 1].isIntersecting; }); this.io.observe(canvas); }
      this.r = new T.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
      this.r.setClearColor(0x000000, 0);
      this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(this.o.fov, 1, 0.1, 100); this.cam.position.set(0, 0, this.o.camZ);
      this.group = new T.Group(); this.scene.add(this.group);
      const N = this.N = this.o.count, g = new T.BufferGeometry();
      const from = new Float32Array(N * 3), to = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
      for (let i = 0; i < N; i++) { const p = Particles.dust(); from.set(p, i * 3); to.set(p, i * 3); seed[i] = Math.random(); size[i] = 0.55 + Math.pow(Math.random(), 2.5) * 1.7; }
      g.setAttribute('position', new T.BufferAttribute(to.slice(), 3)); g.setAttribute('aFrom', new T.BufferAttribute(from, 3)); g.setAttribute('aTo', new T.BufferAttribute(to, 3));
      g.setAttribute('aSeed', new T.BufferAttribute(seed, 1)); g.setAttribute('aSize', new T.BufferAttribute(size, 1)); g.setAttribute('aDelay', new T.BufferAttribute(seed.slice(), 1)); g.setAttribute('aFlow', new T.BufferAttribute(new Float32Array(N), 1));
      g.boundingSphere = new T.Sphere(new T.Vector3(), 100);
      this.u = { uMix: { value: 1 }, uTime: { value: 0 }, uWarp: { value: 0 }, uPix: { value: 1 }, uScale: { value: 15 }, uSpread: { value: this.o.spread }, uAlpha: { value: 1 }, uScatter: { value: 0 }, uFlowDir: { value: new T.Vector3(0, -1, 0) }, uFlowLen: { value: 0 }, uFlowSpeed: { value: 0.6 },
        uC1: { value: col('#ffffff') }, uC2: { value: col('#c4b5ff') }, uC3: { value: col('#8fb4ff') } };
      this.mat = new T.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      this.pts = new T.Points(g, this.mat); this.group.add(this.pts); this.g = g;
      if (this.o.stars) {
        const M = mobile ? 900 : 1600, sp = new Float32Array(M * 3), ss = new Float32Array(M);
        for (let i = 0; i < M; i++) { sp[i * 3] = (Math.random() - 0.5) * 22; sp[i * 3 + 1] = (Math.random() - 0.5) * 36; sp[i * 3 + 2] = Math.random() * 40; ss[i] = Math.random(); }
        const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new T.BufferAttribute(ss, 1)); sg.boundingSphere = new T.Sphere(new T.Vector3(), 100);
        this.su = { uTime: { value: 0 }, uSpeed: { value: 0 }, uPix: { value: 1 }, uDepth: { value: 40 } };
        this.stars = new T.Points(sg, new T.ShaderMaterial({ uniforms: this.su, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        this.scene.add(this.stars);
      }
      this.tw = null; this.wv = 0; this.speed = 0; this.px = 0; this.py = 0; this.t0 = performance.now(); this.alive = true;
      this.size(); this._loop = this.loop.bind(this); this.raf = requestAnimationFrame(this._loop);
      this._rs = () => this.size(); addEventListener('resize', this._rs);
    }
    static dust() { const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), r = 5 + Math.random() * 7; return [Math.sin(b) * Math.cos(a) * r, Math.sin(b) * Math.sin(a) * r, Math.cos(b) * r - 6]; }
    /* taille visible (en unités 3D) au plan z = 0 */
    view() { const h = 2 * Math.tan((this.cam.fov * Math.PI) / 360) * this.o.camZ; return { h, w: h * this.cam.aspect }; }
    /* petit mouvement de caméra (avance ou recule doucement) */
    dolly(to, ms = 4000) { this.dl = { from: this.cz == null ? this.o.camZ : this.cz, to, t0: performance.now(), ms }; }
    size() { const w = this.cv.clientWidth || 1, h = this.cv.clientHeight || 1, d = Math.min(this.o.dprMax || 1.5, devicePixelRatio || 1) * (this.q < 1 ? 0.75 : 1);
      this.r.setPixelRatio(d); this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.u.uPix.value = d; if (this.su) this.su.uPix.value = d; }
    /* positions actuelles (pour repartir de là où sont les points) */
    current() { const f = this.g.attributes.aFrom.array, t = this.g.attributes.aTo.array, s = this.g.attributes.aDelay.array, m = this.u.uMix.value, out = new Float32Array(f.length);
      for (let i = 0; i < this.N; i++) { let k = Math.min(1, Math.max(0, (m - s[i] * 0.55) / 0.45)); k = k * k * (3 - 2 * k); for (let j = 0; j < 3; j++) out[i * 3 + j] = f[i * 3 + j] + (t[i * 3 + j] - f[i * 3 + j]) * k; } return out; }
    /* dessine une forme : pts = [[x, y, z], …] en unités 3D */
    morph(pts, dur = 1400, o = {}) {
      const cur = this.current(), to = this.g.attributes.aTo.array, n = pts.length, fa = this.g.attributes.aFlow.array;
      for (let i = 0; i < this.N; i++) fa[i] = i < n && pts[i % n] && pts[i % n][3] ? 1 : 0; this.g.attributes.aFlow.needsUpdate = true;
      if (o.flow) { this.u.uFlowDir.value.set(o.flow.dir[0], o.flow.dir[1], o.flow.dir[2]).normalize(); this.u.uFlowLen.value = o.flow.len; this.u.uFlowSpeed.value = o.flow.speed || 0.6; } else this.u.uFlowLen.value = 0;
      if (o.spin != null) this.spin = o.spin; if (o.tint) { this.u.uC1.value.set(o.tint[0]); this.u.uC2.value.set(o.tint[1]); this.u.uC3.value.set(o.tint[2]); }
      for (let i = 0; i < this.N; i++) { let p; if (i < n * (o.fill || 1) && n) { p = pts[i % n]; } else p = Particles.dust(); to[i * 3] = p[0]; to[i * 3 + 1] = p[1]; to[i * 3 + 2] = p[2]; }
      /* ordre d'arrivée : au hasard, ou « construction » (du bas vers le haut, comme un vrai bâtiment) */
      const dl = this.g.attributes.aDelay.array, sd = this.g.attributes.aSeed.array;
      if (o.order === 'build' && n) { let lo = 1e9, hi = -1e9; for (const p of pts) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
        for (let i = 0; i < this.N; i++) dl[i] = i < n ? Math.min(1, 0.82 * (to[i * 3 + 1] - lo) / Math.max(1e-6, hi - lo) + 0.18 * sd[i]) : sd[i]; }
      else for (let i = 0; i < this.N; i++) dl[i] = sd[i];
      this.g.attributes.aDelay.needsUpdate = true;
      this.g.attributes.aFrom.array.set(cur); this.g.attributes.aFrom.needsUpdate = true; this.g.attributes.aTo.needsUpdate = true;
      if (dur <= 0) { this.u.uMix.value = 1; this.tw = null; return; }
      this.u.uMix.value = 0; this.tw = { t0: performance.now(), dur };
    }
    /* qualité automatique : si l'appareil peine (moins de 45 images/s), on dessine moins de points et en plus petit */
    adapt(dt) { if (this.q <= 0.5 || dt > 250) return; this.ft.push(dt); if (this.ft.length < 45) return;
      const avg = this.ft.reduce((a, b) => a + b, 0) / this.ft.length; this.ft = [];
      if (avg > (this.o.maxFps ? 1000 / this.o.maxFps + 8 : 22)) { const q0 = this.q; this.q = this.q === 1 ? 0.7 : 0.5; this.g.setDrawRange(0, Math.floor(this.N * this.q)); if (this.stars) this.stars.geometry.setDrawRange(0, Math.floor(this.stars.geometry.attributes.position.count * this.q)); if (q0 === 1) this.size(); } }
    warp(power = 1) { this.wv = Math.max(this.wv, power); this.speed = Math.max(this.speed, 1.6 * power); }
    pointer(x, y) { this.px = x; this.py = y; }
    loop(now) {
      if (!this.alive) return; this.raf = requestAnimationFrame(this._loop);
      if (!this.cv.isConnected || document.hidden || !this.vis || (this.o.pauseIf && this.o.pauseIf())) { this.last = 0; return; }
      if (this.o.maxFps && this.last && now - this.last < 1000 / this.o.maxFps - 3) return;
      const dt = this.last ? now - this.last : 16.7, t = (now - this.t0) / 1000, k = Math.min(4, dt / 16.7); this.last = now; this.u.uTime.value = t;
      this.adapt(dt);
      if (this.tw) { const u = Math.min(1, (now - this.tw.t0) / this.tw.dur); this.u.uMix.value = ease(u); if (u >= 1) this.tw = null; }
      this.wv *= Math.pow(0.93, k); if (this.wv < 0.002) this.wv = 0; this.u.uWarp.value = this.wv;
      if (this.su) { this.speed = Math.max(0.012, this.speed * Math.pow(0.95, k)); this.su.uSpeed.value = (this.su.uSpeed.value + this.speed * k) % 4000; this.su.uTime.value = t; }
      const sw = this.o.sway;
      if (this.spin) { this.spinA = (this.spinA || 0) + this.spin * dt / 1000; }
      this.group.rotation.y += ((Math.sin(t * 0.25) * 0.18 * sw / 0.25 + this.px * 0.35 + (this.spinA || 0)) - this.group.rotation.y) * Math.min(1, 0.05 * k);
      this.group.rotation.x += ((Math.cos(t * 0.2) * 0.06 * sw / 0.25 - this.py * 0.2) - this.group.rotation.x) * Math.min(1, 0.05 * k);
      if (this.dl) { const u = Math.min(1, (now - this.dl.t0) / this.dl.ms), e = u * u * (3 - 2 * u); this.cz = this.dl.from + (this.dl.to - this.dl.from) * e; if (u >= 1) this.dl = null; } this.cam.position.z = this.cz == null ? this.o.camZ : this.cz;
      const cs = this.o.camSway == null ? 1 : this.o.camSway; this.cam.position.x = Math.sin(t * 0.13) * 0.18 * cs; this.cam.position.y = Math.cos(t * 0.11) * 0.12 * cs; this.cam.lookAt(0, 0, 0);
      this.r.render(this.scene, this.cam);
    }
    dispose() { this.alive = false; if (this.io) this.io.disconnect(); cancelAnimationFrame(this.raf); removeEventListener('resize', this._rs); try { this.g.dispose(); this.mat.dispose(); if (this.stars) { this.stars.geometry.dispose(); this.stars.material.dispose(); } this.r.dispose(); this.r.forceContextLoss && this.r.forceContextLoss(); } catch (e) {} }
  }

  /* ---------- formes → points ---------- */
  function fromCanvas(draw, n, o = {}) {
    const SZ = o.res || 256, c = document.createElement('canvas'); c.width = c.height = SZ; const g = c.getContext('2d', { willReadFrequently: true }); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = g.lineJoin = 'round'; draw(g);
    const d = g.getImageData(0, 0, SZ, SZ).data, raw = [];
    for (let y = 0; y < SZ; y += 1) for (let x = 0; x < SZ; x += 1) if (d[(y * SZ + x) * 4 + 3] > 110) raw.push(x, y);
    const k = raw.length / 2; if (!k) return [];
    const out = [], w = o.w || 2, cx = o.x || 0, cy = o.y || 0, depth = o.depth == null ? 0.16 : o.depth, aspect = o.aspect || 1;
    for (let i = 0; i < n; i++) { const j = Math.floor(Math.random() * k) * 2, u = raw[j] / SZ - 0.5, v = raw[j + 1] / SZ - 0.5;
      const layer = (Math.random() < 0.5 ? -1 : 1) * Math.random() * depth;
      out.push([cx + u * w + (Math.random() - 0.5) * 0.006 * w, cy - v * w / aspect + (Math.random() - 0.5) * 0.006 * w, layer]); }
    return out;
  }
  /* trait SVG (repère 100 × 100) */
  const pathPts = (d, n, o = {}) => fromCanvas(g => { const R = o.res || 256; g.scale(R / 100, R / 100); g.lineWidth = o.lw || 2.4; g.stroke(new Path2D(d)); if (o.fill) g.fill(new Path2D(o.fill)); }, n, o);
  /* image (ex. le temple en SVG) chargée une fois */
  const IMG = {};
  function loadSVG(key, svg) { return new Promise(res => { if (IMG[key]) return res(IMG[key]); const im = new Image(); im.onload = () => { IMG[key] = im; res(im); }; im.onerror = () => res(null); let x = String(svg); if (!/xmlns=/.test(x)) x = x.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const vb = x.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/); if (vb && !/^<svg[^>]*\swidth=/.test(x)) x = x.replace('<svg', `<svg width="${vb[1] * 2}" height="${vb[2] * 2}"`);
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x); }); }
  function imgPts(im, n, o = {}) { if (!im) return []; const ar = im.width / im.height || 1; const R = o.res || 512; return fromCanvas(g => { const w = R, h = R / ar; g.drawImage(im, 0, (R - h) / 2, w, h); }, n, Object.assign({ res: R }, o)); }

  /* place (en unités 3D) d'un élément de la page, vu depuis le canvas : pour que les points tombent pile sur le vrai dessin */
  function rectToWorld(P, el) { const c = P.cv.getBoundingClientRect(), r = el.getBoundingClientRect(), v = P.view();
    return { w: r.width / c.width * v.w, x: ((r.left + r.width / 2) - (c.left + c.width / 2)) / c.width * v.w, y: -((r.top + r.height / 2) - (c.top + c.height / 2)) / c.height * v.h }; }
  window.NTGL = { ok, mobile, Particles, pathPts, imgPts, loadSVG, fromCanvas, rectToWorld };
})();
