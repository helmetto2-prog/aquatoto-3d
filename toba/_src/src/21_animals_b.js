/* =====================================================================
   鳥羽の生きもの（無脊椎・爬虫類・魚スプライト）＋装飾＋動きのコントローラ  ANIM_B
   使えるもの: THREE / rnd / clamp / ctex（コアで定義済み）
   約束: 1 = 1m、ローカル +Z = 頭の向き、+Y = 上。
     各 makeXxx() は { g, update(dt,t), len, moving, speed, ... } を返す。
     update() は体の中の動き（脚・ひれ・拍動）だけ。体の移動・向きは呼び出し側
     （または下の swimmer / walker / school）が g.position / g.rotation で行う。
     ※ コントローラは c.update を呼ばない → 毎フレーム ctl.update と c.update の両方を呼ぶ。
   原点: 泳ぐもの＝体の中心 / 這う・歩くもの＝体の真下の地面(y=0)
   ===================================================================== */
const ANIM_B = (() => {
  const PI = Math.PI, TAU = PI * 2;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const UP = new THREE.Vector3(0, 1, 0);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));

  /* ---------------- キャッシュ ---------------- */
  const GEO = new Map(), MAT = new Map(), TEX = new Map();
  const once = (m, k, fn) => { let v = m.get(k); if (v === undefined) { v = fn(); m.set(k, v); } return v; };
  const SPH = (w = 12, h = 8) => once(GEO, `s${w}_${h}`, () => new THREE.SphereGeometry(1, w, h));
  const HEMI = (w = 12, h = 6) => once(GEO, `h${w}_${h}`, () => new THREE.SphereGeometry(1, w, h, 0, TAU, 0, PI / 2));
  /* 根元が原点・+Y方向に長さ1の円柱（先細り） */
  const SEG = (taper = 0.6, s = 5, open = false) => once(GEO, `g${taper}_${s}_${open}`, () => { const g = new THREE.CylinderGeometry(taper, 1, 1, s, 1, open); g.translate(0, 0.5, 0); return g; });
  const CONE = (s = 5) => once(GEO, `k${s}`, () => { const g = new THREE.ConeGeometry(1, 1, s); g.translate(0, 0.5, 0); return g; });
  const lam = c => once(MAT, 'L' + c, () => new THREE.MeshLambertMaterial({ color: c }));
  const lamDS = c => once(MAT, 'LD' + c, () => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
  const pho = (c, sh = 40, sp = 0x333333) => once(MAT, `P${c}_${sh}_${sp}`, () => new THREE.MeshPhongMaterial({ color: c, shininess: sh, specular: sp }));
  const matK = (k, fn) => once(MAT, 'K' + k, fn);
  const tex = (k, w, h, fn, rx = 1, ry = 1) => once(TEX, k, () => ctex(w, h, fn, rx, ry));
  const VC_LAM = () => matK('vcLam', () => new THREE.MeshLambertMaterial({ vertexColors: true }));
  const VC_LAM_DS = () => matK('vcLamDS', () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));

  function mk(geo, mat, sx = 1, sy = sx, sz = sx, x = 0, y = 0, z = 0, parent = null) {
    const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    if (parent) parent.add(m); return m;
  }
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; };
  /* 点aから点bへの先細り円柱 */
  function rod(a, b, r0, r1, mat, s = 5, parent = null) {
    const d = new THREE.Vector3().subVectors(b, a); const L = d.length();
    const m = new THREE.Mesh(SEG(+(r1 / r0).toFixed(2), s), mat);
    m.scale.set(r0, L, r0); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.normalize());
    if (parent) parent.add(m); return m;
  }
  function polyRod(pts, r0, r1, mat, s = 5, parent = null) {
    const g = new THREE.Group(); const n = pts.length - 1;
    for (let i = 0; i < n; i++) rod(pts[i], pts[i + 1], r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n, mat, s, g);
    if (parent) parent.add(g); return g;
  }
  /* 上から見た平面投影UV（甲羅・殻の模様用） */
  function planarUV(geo) {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getZ(i) * 0.5 + 0.5);
    uv.needsUpdate = true; return geo;
  }
  const PHEMI = (w = 18, h = 7) => once(GEO, `ph${w}_${h}`, () => planarUV(new THREE.SphereGeometry(1, w, h, 0, TAU, 0, PI / 2)));

  /* 脚: 外向きの縦の面に沿って関節をつなぐ。segs=[{len,a(水平からの仰角),r,mat}] */
  function jointLeg(parent, x, y, z, side, splay, segs, jointMat = null) {
    const yaw = grp(parent, x, y, z); yaw.rotation.y = -side * splay;
    let prev = 0, holder = yaw; const piv = [];
    segs.forEach((s, i) => {
      const p = grp(holder, 0, i === 0 ? 0 : segs[i - 1].len, 0);
      const phi = side * (s.a - PI / 2);
      p.rotation.z = phi - prev; prev = phi;
      mk(SEG(s.taper ?? 0.7, s.seg ?? 5), s.mat, s.r, s.len, s.r, 0, 0, 0, p);
      if (jointMat && i > 0) mk(SPH(6, 4), jointMat, s.r * 1.25, s.r * 1.25, s.r * 1.25, 0, 0, 0, p);
      piv.push(p); holder = p;
    });
    return { yaw, piv, side, splay, base: piv.map(p => p.rotation.z) };
  }
  /* 歩行の脚振り（ph: 位相, k: 0〜1の歩き具合） */
  function stepLeg(L, ph, k, swing = 0.22, lift = 0.22) {
    L.yaw.rotation.y = -L.side * L.splay + swing * k * Math.sin(ph);
    L.piv[0].rotation.z = L.base[0] + L.side * lift * k * Math.max(0, Math.cos(ph));
  }

  /* 静的な飾りをまとめて1メッシュに（頂点カラー） */
  function Merger() {
    const P = [], N = [], C = [], I = []; let vc = 0;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3(), col = new THREE.Color();
    return {
      add(geo, m4, color, colorFn) {
        const pos = geo.attributes.position, nor = geo.attributes.normal;
        nm.getNormalMatrix(m4);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m4); P.push(v.x, v.y, v.z);
          const wx = v.x, wy = v.y, wz = v.z;
          if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0);
          if (colorFn) colorFn(col, wx, wy, wz, i); else col.set(color);
          C.push(col.r, col.g, col.b);
        }
        if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) I.push(ix[i] + vc); }
        else for (let i = 0; i < pos.count; i++) I.push(i + vc);
        vc += pos.count;
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(I); return g;
      },
      get count() { return vc; }
    };
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const compose = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { _e.set(rx, ry, rz); _q.setFromEuler(_e); return _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); };
  const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const noise3 = (x, y, z) => Math.sin(x * 5.1 + 1.3) * Math.cos(y * 6.3 + 0.7) * Math.sin(z * 5.7 + 2.1) * 0.5 + Math.sin(x * 11.3 + z * 9.1 + y * 4.0) * 0.25;
  const creature = (g, len, update, extra = {}) => Object.assign({ g, len, moving: false, speed: 0, update }, extra);

  /* ===================================================================
     B. 魚スプライト（512×256・頭は左）
     =================================================================== */
  const W = 512, H = 256;
  function bodyPath(x0, x1, cy, h, o = {}) {
    const L = x1 - x0, ht = h / 2, top = o.top ?? 0.42, sy = o.snoutY ?? 4, ped = o.ped ?? h * 0.3, bel = o.belly ?? 1, nose = o.nose ?? 0.5;
    const P = new Path2D();
    P.moveTo(x0, cy + sy);
    P.bezierCurveTo(x0 + L * 0.02, cy - ht * nose, x0 + L * top * 0.45, cy - ht, x0 + L * top, cy - ht);
    P.bezierCurveTo(x0 + L * (top + (1 - top) * 0.5), cy - ht, x1 - L * 0.12, cy - ped / 2, x1, cy - ped / 2);
    P.lineTo(x1, cy + ped / 2);
    P.bezierCurveTo(x1 - L * 0.12, cy + ped / 2, x0 + L * (top + (1 - top) * 0.45), cy + ht * bel, x0 + L * top, cy + ht * bel);
    P.bezierCurveTo(x0 + L * top * 0.45, cy + ht * bel, x0 + L * 0.03, cy + ht * 0.55, x0, cy + sy);
    P.closePath(); return P;
  }
  /* 点列を通るなめらかな閉曲線 */
  function smoothPath(pts) {
    const P = new Path2D(); const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m0 = mid(pts[n - 1], pts[0]); P.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); P.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    P.closePath(); return P;
  }
  function polyPath(pts) { const P = new Path2D(); pts.forEach((p, i) => i ? P.lineTo(p[0], p[1]) : P.moveTo(p[0], p[1])); P.closePath(); return P; }
  /* ひれ: 塗り＋すじ（rays: base0→base1 の根元から outer点へ） */
  function fin(c, pts, fill, edge = 'rgba(0,0,0,.35)', rays = 0, rayCol = 'rgba(0,0,0,.18)', smooth = true) {
    const P = smooth ? smoothPath(pts) : polyPath(pts);
    c.fillStyle = fill; c.fill(P);
    if (rays) {
      c.save(); c.clip(P); c.strokeStyle = rayCol; c.lineWidth = 1.6;
      const a = pts[0], b = pts[pts.length - 1];
      for (let i = 1; i < rays; i++) {
        const k = i / rays, bx = a[0] + (b[0] - a[0]) * k, by = a[1] + (b[1] - a[1]) * k;
        const oi = Math.min(pts.length - 2, 1 + Math.floor(k * (pts.length - 2))); const o = pts[oi];
        c.beginPath(); c.moveTo(bx, by); c.lineTo(o[0] + (bx - o[0]) * -0.15, o[1] + (by - o[1]) * -0.15); c.stroke();
      }
      c.restore();
    }
    if (edge) { c.strokeStyle = edge; c.lineWidth = 2; c.stroke(P); }
    return P;
  }
  /* 胸びれ（根元(x,y)から角度angへ扇形・すじ入り） */
  function pecFin(c, x, y, len, ang, col, ray = 'rgba(0,0,0,.28)', spread = 0.55) {
    const a0 = ang - spread / 2, a1 = ang + spread / 2, P = new Path2D();
    P.moveTo(x, y - 5);
    P.quadraticCurveTo(x + Math.cos(a0) * len * 0.55, y + Math.sin(a0) * len * 0.55 - 4, x + Math.cos(a0) * len, y + Math.sin(a0) * len);
    P.quadraticCurveTo(x + Math.cos(ang) * len * 1.12, y + Math.sin(ang) * len * 1.12, x + Math.cos(a1) * len * 0.92, y + Math.sin(a1) * len * 0.92);
    P.quadraticCurveTo(x + Math.cos(a1) * len * 0.45, y + Math.sin(a1) * len * 0.45 + 3, x, y + 5); P.closePath();
    c.fillStyle = col; c.fill(P);
    c.save(); c.clip(P); c.strokeStyle = ray; c.lineWidth = 1.3;
    for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * i / 8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len * 1.15, y + Math.sin(a) * len * 1.15); c.stroke(); }
    c.restore(); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.4; c.stroke(P);
  }
  function eye(c, x, y, r, iris = '#d8b450', ring = 'rgba(0,0,0,.55)') {
    c.fillStyle = iris; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = '#080808'; c.beginPath(); c.arc(x + r * 0.08, y + r * 0.04, r * 0.62, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(x - r * 0.22, y - r * 0.3, r * 0.22, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x + r * 0.28, y + r * 0.25, r * 0.1, 0, TAU); c.fill();
    c.strokeStyle = ring; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  }
  function shade(c, P, x0, x1, cy, h, top = 'rgba(0,0,30,.28)', bot = 'rgba(255,255,255,.35)') {
    c.save(); c.clip(P);
    const g = c.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, top); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(x0 - 20, cy - h, x1 - x0 + 60, h * 2);
    const hl = c.createRadialGradient(x0 + (x1 - x0) * 0.38, cy - h * 0.22, 4, x0 + (x1 - x0) * 0.38, cy - h * 0.22, h * 0.6);
    hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(x0 - 20, cy - h, x1 - x0 + 60, h * 2);
    c.restore();
  }
  function scales(c, P, x0, x1, cy, h, col = 'rgba(255,255,255,.13)', step = 13) {
    c.save(); c.clip(P); c.strokeStyle = col; c.lineWidth = 1.4;
    for (let x = x0 + 30, j = 0; x < x1 + 10; x += step, j++)
      for (let y = cy - h / 2 + (j % 2) * step / 2; y < cy + h / 2; y += step) { c.beginPath(); c.arc(x, y, step * 0.7, -PI * 0.45, PI * 0.45); c.stroke(); }
    c.restore();
  }
  function outline(c, P, col = 'rgba(0,0,0,.4)', w = 2.5) { c.strokeStyle = col; c.lineWidth = w; c.stroke(P); }
  function gill(c, x, cy, h, col = 'rgba(0,0,0,.28)') { c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, cy - h * 0.32); c.quadraticCurveTo(x + h * 0.14, cy, x, cy + h * 0.32); c.stroke(); }
  function inClip(c, P, fn) { c.save(); c.clip(P); fn(); c.restore(); }
  const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([k, col]) => g.addColorStop(k, col)); return g; };
  function spots(c, n, x0, x1, y0, y1, r0, r1, col) { c.fillStyle = col; for (let i = 0; i < n; i++) { c.beginPath(); c.arc(rnd(x0, x1), rnd(y0, y1), rnd(r0, r1), 0, TAU); c.fill(); } }
  function blotch(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU, rr = r * rnd(0.7, 1.15); i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } c.closePath(); c.fill(); }

  const PAINT = {
    kakure(c) { // カクレクマノミ
      const x0 = 72, x1 = 398, cy = 128, h = 150;
      fin(c, [[394, 100], [440, 58], [492, 86], [494, 128], [492, 170], [440, 198], [394, 156]], '#ff8418', '#111', 9, 'rgba(120,40,0,.25)');
      c.strokeStyle = '#141414'; c.lineWidth = 7; c.beginPath(); c.moveTo(440, 62); c.quadraticCurveTo(500, 90, 496, 128); c.quadraticCurveTo(500, 168, 440, 194); c.stroke();
      fin(c, [[150, 66], [175, 34], [215, 30], [258, 52], [300, 36], [345, 40], [382, 96]], '#ff8418', '#111', 10, 'rgba(120,40,0,.25)');
      fin(c, [[300, 188], [330, 228], [370, 222], [388, 170]], '#ff8418', '#111', 5);
      fin(c, [[196, 190], [214, 232], [246, 220], [244, 192]], '#ff8418', '#111', 4);
      const P = bodyPath(x0, x1, cy, h, { top: 0.42, snoutY: 8, ped: 62, nose: 0.75 });
      c.fillStyle = lg(c, 0, cy - 75, 0, cy + 75, [[0, '#f26100'], [0.5, '#ff8a1c'], [1, '#ffab4a']]); c.fill(P);
      inClip(c, P, () => {
        const band = (xa, xb, bulge) => {
          const B = new Path2D(); B.moveTo(xa, cy - 90); B.bezierCurveTo(xa - bulge, cy - 30, xa - bulge, cy + 30, xa, cy + 90);
          B.lineTo(xb, cy + 90); B.bezierCurveTo(xb - bulge, cy + 30, xb - bulge, cy - 30, xb, cy - 90); B.closePath();
          c.fillStyle = '#fbfbf7'; c.fill(B); c.strokeStyle = '#121212'; c.lineWidth = 6; c.stroke(B);
        };
        band(140, 172, 22); band(252, 292, 34); band(380, 398, 10);
      });
      shade(c, P, x0, x1, cy, h, 'rgba(120,20,0,.25)', 'rgba(255,255,255,.18)'); outline(c, P, 'rgba(60,15,0,.55)');
      pecFin(c, 198, 140, 50, 0.35, 'rgba(255,146,46,.95)', 'rgba(90,30,0,.4)');
      eye(c, 112, 114, 17, '#ff9a2a');
      c.strokeStyle = 'rgba(60,10,0,.6)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(74, 136); c.quadraticCurveTo(86, 142, 96, 138); c.stroke();
    },
    nanyou(c) { // ナンヨウハギ
      const x0 = 58, x1 = 392, cy = 128, h = 168;
      fin(c, [[388, 112], [470, 46], [454, 128], [470, 210], [388, 146]], '#ffd21a', '#151515', 10, 'rgba(160,110,0,.35)', false);
      c.strokeStyle = '#151515'; c.lineWidth = 6; c.beginPath(); c.moveTo(470, 46); c.lineTo(392, 112); c.moveTo(470, 210); c.lineTo(392, 146); c.stroke();
      fin(c, [[110, 58], [180, 34], [280, 30], [360, 52], [392, 104]], '#2050d8', '#0d0d1a', 14, 'rgba(0,0,40,.3)');
      fin(c, [[160, 200], [250, 230], [340, 218], [390, 154]], '#2050d8', '#0d0d1a', 10, 'rgba(0,0,40,.3)');
      const P = bodyPath(x0, x1, cy, h, { top: 0.45, snoutY: 10, ped: 42, nose: 0.6 });
      c.fillStyle = lg(c, 0, cy - 84, 0, cy + 84, [[0, '#1440c0'], [0.5, '#2a64ee'], [1, '#4b86ff']]); c.fill(P);
      inClip(c, P, () => {
        c.strokeStyle = '#0b0b16'; c.lineCap = 'round';
        c.lineWidth = 26; c.beginPath(); c.moveTo(96, 104); c.bezierCurveTo(170, 60, 300, 70, 400, 116); c.stroke();
        c.lineWidth = 16; c.beginPath(); c.moveTo(170, 116); c.bezierCurveTo(220, 170, 330, 160, 396, 122); c.stroke();
        c.lineWidth = 12; c.beginPath(); c.moveTo(150, 92); c.lineTo(178, 118); c.stroke();
      });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,40,.25)', 'rgba(180,220,255,.25)'); outline(c, P, 'rgba(0,0,30,.6)');
      pecFin(c, 156, 146, 52, 0.3, 'rgba(255,214,40,.92)', 'rgba(60,50,0,.35)');
      eye(c, 96, 112, 15, '#0e0e1a', 'rgba(140,190,255,.9)');
      c.strokeStyle = 'rgba(0,0,20,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(60, 138); c.lineTo(76, 140); c.stroke();
    },
    kiiro(c) { // キイロハギ
      const x0 = 112, x1 = 382, cy = 128, h = 168;
      fin(c, [[376, 108], [446, 70], [440, 128], [446, 186], [376, 148]], '#ffd700', 'rgba(150,110,0,.5)', 8, 'rgba(170,120,0,.3)', false);
      fin(c, [[150, 56], [200, 14], [300, 16], [372, 70], [384, 108]], '#ffd800', 'rgba(150,110,0,.5)', 16, 'rgba(170,120,0,.3)');
      fin(c, [[170, 200], [230, 244], [320, 240], [378, 186], [384, 150]], '#ffd800', 'rgba(150,110,0,.5)', 14, 'rgba(170,120,0,.3)');
      const snout = new Path2D(); snout.moveTo(118, 118); snout.quadraticCurveTo(84, 122, 66, 134); snout.quadraticCurveTo(86, 146, 120, 150); snout.closePath();
      c.fillStyle = '#ffd400'; c.fill(snout); outline(c, snout, 'rgba(140,100,0,.5)', 2);
      const P = bodyPath(x0, x1, cy, h, { top: 0.4, snoutY: 6, ped: 46, nose: 0.85 });
      c.fillStyle = lg(c, 0, cy - 84, 0, cy + 84, [[0, '#ffcc00'], [0.5, '#ffe033'], [1, '#fff07a']]); c.fill(P);
      shade(c, P, x0, x1, cy, h, 'rgba(160,90,0,.22)', 'rgba(255,255,255,.3)'); outline(c, P, 'rgba(150,100,0,.55)');
      c.fillStyle = '#fffdf0'; c.beginPath(); c.ellipse(370, 128, 4, 11, 0.2, 0, TAU); c.fill();
      pecFin(c, 196, 138, 46, 0.3, 'rgba(255,228,70,.92)', 'rgba(160,110,0,.35)');
      eye(c, 146, 108, 13, '#2a2410');
    },
    tsunodashi(c) { // ツノダシ
      const x0 = 112, x1 = 332, cy = 140, h = 150;
      fin(c, [[326, 116], [390, 100], [392, 140], [390, 182], [326, 162]], '#1a1a1a', null, 0, '', false);
      c.fillStyle = '#f3f3ee'; c.fillRect(372, 100, 14, 82);
      fin(c, [[160, 82], [196, 56], [250, 52], [300, 76], [330, 116]], '#f2f2ec', 'rgba(0,0,0,.4)', 8);
      fin(c, [[180, 196], [240, 236], [300, 226], [330, 166]], '#151515', null, 0);
      const flm = new Path2D(); flm.moveTo(192, 66); flm.bezierCurveTo(260, 2, 380, 6, 498, 34); flm.bezierCurveTo(380, 18, 270, 22, 214, 74); flm.closePath();
      c.fillStyle = '#f7f7f2'; c.fill(flm); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.5; c.stroke(flm);
      const sn = new Path2D(); sn.moveTo(120, 128); sn.quadraticCurveTo(90, 132, 58, 148); sn.quadraticCurveTo(88, 160, 122, 162); sn.closePath();
      c.fillStyle = '#e9e6dc'; c.fill(sn); c.fillStyle = '#ff9a2a'; c.beginPath(); c.ellipse(92, 141, 18, 7, -0.25, 0, TAU); c.fill(); outline(c, sn, 'rgba(0,0,0,.4)', 2);
      const P = bodyPath(x0, x1, cy, h, { top: 0.5, snoutY: 6, ped: 46, nose: 0.9 });
      c.fillStyle = '#f4f2ea'; c.fill(P);
      inClip(c, P, () => {
        c.fillStyle = '#121212'; c.beginPath(); c.moveTo(120, 40); c.bezierCurveTo(150, 80, 150, 200, 126, 230); c.lineTo(186, 230); c.bezierCurveTo(196, 190, 196, 90, 176, 40); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(248, 40); c.bezierCurveTo(262, 100, 262, 180, 250, 232); c.lineTo(300, 232); c.bezierCurveTo(306, 170, 306, 100, 290, 40); c.closePath(); c.fill();
        c.fillStyle = '#ffd21e'; c.beginPath(); c.moveTo(296, 60); c.bezierCurveTo(330, 90, 336, 140, 312, 168); c.lineTo(340, 170); c.lineTo(340, 60); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,214,40,.75)'; c.fillRect(186, 96, 62, 40);
      });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.2)'); outline(c, P, 'rgba(0,0,0,.5)');
      eye(c, 140, 128, 11, '#1a1a1a', 'rgba(255,255,255,.7)');
    },
    chouchou(c) { // チョウチョウウオ
      const x0 = 96, x1 = 380, cy = 128, h = 168;
      fin(c, [[374, 104], [440, 82], [452, 128], [440, 174], [374, 152]], '#ffd23a', 'rgba(0,0,0,.35)', 7);
      c.strokeStyle = 'rgba(40,30,0,.6)'; c.lineWidth = 4; c.beginPath(); c.moveTo(420, 88); c.quadraticCurveTo(434, 128, 420, 168); c.stroke();
      fin(c, [[140, 56], [210, 30], [300, 32], [360, 56], [380, 100]], '#ffd23a', 'rgba(0,0,0,.35)', 14);
      const thr = new Path2D(); thr.moveTo(352, 56); thr.bezierCurveTo(380, 40, 410, 40, 440, 50); thr.bezierCurveTo(410, 48, 384, 54, 362, 66); thr.closePath(); c.fillStyle = '#ffd23a'; c.fill(thr);
      fin(c, [[170, 198], [250, 234], [330, 226], [378, 156]], '#ffd23a', 'rgba(0,0,0,.35)', 12);
      const P = bodyPath(x0, x1, cy, h, { top: 0.42, snoutY: 12, ped: 44, nose: 0.75 });
      c.fillStyle = lg(c, x0, 0, x1, 0, [[0, '#f8f8f2'], [0.55, '#f6f3e6'], [0.7, '#ffe066'], [1, '#ffd02a']]); c.fill(P);
      inClip(c, P, () => {
        c.strokeStyle = 'rgba(60,60,70,.5)'; c.lineWidth = 2;
        for (let i = 0; i < 9; i++) { const x = 150 + i * 18; c.beginPath(); c.moveTo(x, 50); c.lineTo(x + 36, 128); c.lineTo(x, 210); c.stroke(); }
        c.fillStyle = '#141414'; c.beginPath(); c.moveTo(118, 40); c.bezierCurveTo(108, 100, 108, 160, 118, 220); c.lineTo(142, 220); c.bezierCurveTo(132, 160, 132, 100, 142, 40); c.closePath(); c.fill();
      });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.25)'); outline(c, P, 'rgba(0,0,0,.45)');
      c.fillStyle = '#121212'; c.beginPath(); c.arc(342, 70, 11, 0, TAU); c.fill(); c.strokeStyle = '#fffbe6'; c.lineWidth = 3; c.stroke();
      pecFin(c, 178, 146, 44, 0.3, 'rgba(255,248,225,.82)', 'rgba(120,100,40,.35)');
      eye(c, 130, 112, 11, '#141414', 'rgba(255,255,255,.6)');
      c.fillStyle = '#efe9d8'; c.beginPath(); c.moveTo(98, 132); c.lineTo(72, 140); c.lineTo(98, 146); c.closePath(); c.fill();
    },
    madai(c) { // マダイ
      const x0 = 52, x1 = 402, cy = 132, h = 152;
      fin(c, [[398, 118], [452, 74], [500, 60], [470, 128], [500, 198], [452, 184], [398, 146]], 'rgba(226,96,104,.95)', 'rgba(90,10,20,.5)', 12, 'rgba(120,20,30,.25)', false);
      c.strokeStyle = 'rgba(70,20,30,.7)'; c.lineWidth = 5; c.beginPath(); c.moveTo(500, 60); c.lineTo(470, 128); c.lineTo(500, 198); c.stroke();
      fin(c, [[130, 64], [150, 34], [210, 30], [290, 44], [360, 70], [390, 112]], 'rgba(240,120,130,.9)', 'rgba(110,20,30,.4)', 16, 'rgba(130,20,40,.3)');
      fin(c, [[300, 196], [330, 226], [370, 214], [384, 158]], 'rgba(244,150,150,.9)', 'rgba(110,20,30,.4)', 6);
      const P = bodyPath(x0, x1, cy, h, { top: 0.36, snoutY: 22, ped: 38, nose: 0.95 });
      c.fillStyle = lg(c, 0, cy - 76, 0, cy + 76, [[0, '#cc3a50'], [0.35, '#ec6d78'], [0.7, '#f8b4b0'], [1, '#fde8e0']]); c.fill(P);
      scales(c, P, x0, x1, cy, h, 'rgba(255,255,255,.16)', 13);
      inClip(c, P, () => { for (let i = 0; i < 46; i++) { const x = rnd(110, 380), y = rnd(cy - 66, cy + 10); c.fillStyle = 'rgba(80,220,255,.95)'; c.beginPath(); c.arc(x, y, rnd(1.6, 3.2), 0, TAU); c.fill(); } });
      shade(c, P, x0, x1, cy, h, 'rgba(120,0,20,.2)', 'rgba(255,255,255,.3)'); outline(c, P, 'rgba(110,20,30,.5)');
      gill(c, 140, cy, h, 'rgba(120,20,30,.35)');
      pecFin(c, 158, 152, 86, 0.14, 'rgba(250,150,150,.88)', 'rgba(120,20,30,.35)', 0.32);
      eye(c, 104, 112, 15, '#e8b030');
      c.strokeStyle = 'rgba(120,20,30,.7)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(54, 152); c.quadraticCurveTo(70, 158, 86, 154); c.stroke();
    },
    ishidai(c) { // イシダイ
      const x0 = 68, x1 = 392, cy = 130, h = 164;
      fin(c, [[388, 110], [448, 82], [456, 130], [448, 178], [388, 150]], '#3a3a3a', 'rgba(0,0,0,.5)', 8, 'rgba(255,255,255,.08)', false);
      fin(c, [[140, 58], [180, 30], [260, 28], [340, 48], [384, 104]], '#4a4a48', 'rgba(0,0,0,.5)', 14, 'rgba(255,255,255,.1)');
      fin(c, [[280, 200], [320, 234], [362, 222], [384, 156]], '#4a4a48', 'rgba(0,0,0,.5)', 6);
      const P = bodyPath(x0, x1, cy, h, { top: 0.42, snoutY: 20, ped: 44, nose: 0.9 });
      c.fillStyle = lg(c, 0, cy - 82, 0, cy + 82, [[0, '#a9a69a'], [0.5, '#d8d5c8'], [1, '#efece2']]); c.fill(P);
      scales(c, P, x0, x1, cy, h, 'rgba(255,255,255,.12)', 12);
      inClip(c, P, () => { c.fillStyle = '#1c1c1e'; for (let i = 0; i < 7; i++) { const x = 92 + i * 44; c.beginPath(); c.moveTo(x, 30); c.bezierCurveTo(x + 10, 90, x + 10, 170, x - 2, 240); c.lineTo(x + 18, 240); c.bezierCurveTo(x + 28, 170, x + 28, 90, x + 18, 30); c.closePath(); c.fill(); } });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.18)', 'rgba(255,255,255,.2)'); outline(c, P, 'rgba(0,0,0,.5)');
      pecFin(c, 154, 150, 58, 0.25, 'rgba(110,110,104,.88)', 'rgba(0,0,0,.35)');
      eye(c, 118, 112, 14, '#d0b060');
      c.fillStyle = '#2a2a2a'; c.beginPath(); c.moveTo(70, 146); c.quadraticCurveTo(62, 152, 70, 160); c.lineTo(84, 154); c.closePath(); c.fill();
    },
    iwashi(c) { // マイワシ
      const x0 = 38, x1 = 408, cy = 128, h = 82;
      fin(c, [[404, 120], [462, 82], [496, 74], [458, 128], [496, 182], [462, 174], [404, 136]], 'rgba(120,150,170,.85)', 'rgba(20,40,60,.5)', 8, 'rgba(255,255,255,.2)', false);
      fin(c, [[210, 92], [236, 64], [268, 70], [276, 90]], 'rgba(110,140,160,.85)', 'rgba(20,40,60,.4)', 5);
      fin(c, [[300, 162], [320, 182], [350, 176], [356, 158]], 'rgba(170,190,200,.8)', 'rgba(20,40,60,.3)', 3);
      const P = bodyPath(x0, x1, cy, h, { top: 0.42, snoutY: 6, ped: 22, nose: 0.6 });
      c.fillStyle = lg(c, 0, cy - 41, 0, cy + 41, [[0, '#24507a'], [0.32, '#5c86a6'], [0.5, '#c8d6e0'], [0.75, '#eef3f6'], [1, '#ffffff']]); c.fill(P);
      scales(c, P, x0, x1, cy, h, 'rgba(255,255,255,.14)', 10);
      inClip(c, P, () => { const sh = lg(c, 0, cy - 8, 0, cy + 6, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(220,240,255,.55)'], [1, 'rgba(255,255,255,0)']]); c.fillStyle = sh; c.fillRect(x0, cy - 8, x1 - x0, 14); });
      c.fillStyle = '#10161e'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(132 + i * 34, cy - 4 + Math.sin(i) * 1.5, 4.6, 0, TAU); c.fill(); }
      shade(c, P, x0, x1, cy, h, 'rgba(0,10,40,.2)', 'rgba(255,255,255,.3)'); outline(c, P, 'rgba(10,30,50,.5)', 2);
      gill(c, 104, cy, h, 'rgba(40,70,100,.4)');
      eye(c, 76, 122, 12, '#cfd8e0', 'rgba(30,50,70,.6)');
    },
    gar(c) { // アリゲーターガー
      const P = new Path2D(); const cy = 128;
      P.moveTo(16, 128); P.quadraticCurveTo(60, 120, 112, 118); P.quadraticCurveTo(140, 106, 180, 100); P.bezierCurveTo(260, 94, 360, 100, 418, 118);
      P.lineTo(418, 140); P.bezierCurveTo(360, 160, 260, 162, 180, 158); P.quadraticCurveTo(140, 152, 112, 138); P.quadraticCurveTo(60, 136, 16, 130); P.closePath();
      fin(c, [[414, 112], [456, 92], [496, 104], [500, 132], [490, 158], [452, 166], [414, 146]], 'rgba(120,100,60,.95)', 'rgba(40,30,10,.5)', 9);
      fin(c, [[344, 100], [372, 72], [398, 80], [404, 110]], 'rgba(120,100,60,.95)', 'rgba(40,30,10,.5)', 5);
      fin(c, [[338, 156], [366, 184], [396, 178], [402, 148]], 'rgba(130,110,70,.95)', 'rgba(40,30,10,.5)', 5);
      fin(c, [[196, 152], [222, 178], [244, 170], [236, 152]], 'rgba(140,120,80,.9)', 'rgba(40,30,10,.4)', 3);
      c.fillStyle = lg(c, 0, 96, 0, 162, [[0, '#5e5430'], [0.45, '#8f8050'], [0.8, '#c8bc94'], [1, '#e2d8b8']]); c.fill(P);
      inClip(c, P, () => { for (let i = 0; i < 70; i++) { const x = rnd(150, 420); spots(c, 1, x, x, rnd(98, 150), rnd(98, 150), 2.5, 5.5, 'rgba(40,30,12,.55)'); } scales(c, P, 110, 420, cy, 64, 'rgba(255,255,255,.08)', 10); });
      c.fillStyle = 'rgba(40,30,12,.5)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(rnd(420, 494), rnd(100, 160), rnd(2, 4.5), 0, TAU); c.fill(); }
      shade(c, P, 16, 420, cy, 64, 'rgba(20,20,0,.2)', 'rgba(255,255,255,.18)'); outline(c, P, 'rgba(30,24,8,.6)', 2);
      c.strokeStyle = 'rgba(30,20,10,.75)'; c.lineWidth = 2; c.beginPath(); c.moveTo(18, 129); c.lineTo(118, 128); c.stroke();
      c.fillStyle = '#f4f0e0'; for (let x = 26; x < 112; x += 8) { c.beginPath(); c.moveTo(x, 127); c.lineTo(x + 3, 122); c.lineTo(x + 6, 127); c.fill(); c.beginPath(); c.moveTo(x + 2, 130); c.lineTo(x + 5, 135); c.lineTo(x + 8, 130); c.fill(); }
      eye(c, 128, 116, 8, '#d0a040');
    },
    kasago(c) { // カサゴ
      const x0 = 58, x1 = 380, cy = 136, h = 150;
      fin(c, [[376, 112], [430, 92], [470, 120], [472, 150], [430, 178], [376, 158]], '#b8523a', 'rgba(60,20,10,.5)', 9, 'rgba(255,230,200,.25)');
      c.strokeStyle = 'rgba(240,210,180,.6)'; c.lineWidth = 4; c.beginPath(); c.moveTo(430, 96); c.quadraticCurveTo(452, 135, 430, 174); c.stroke();
      const dor = [[128, 76]]; for (let i = 0; i < 12; i++) { const x = 140 + i * 19; dor.push([x, i < 8 ? 26 + (i % 2) * 18 : 44 + (i % 2) * 10]); dor.push([x + 9, 60]); } dor.push([370, 100]);
      fin(c, dor, '#a94430', 'rgba(60,20,10,.55)', 0, '', false);
      fin(c, [[290, 196], [318, 236], [356, 226], [370, 166]], '#b04a34', 'rgba(60,20,10,.5)', 5);
      const P = bodyPath(x0, x1, cy, h, { top: 0.3, snoutY: 10, ped: 52, nose: 1.0 });
      c.fillStyle = lg(c, 0, cy - 75, 0, cy + 75, [[0, '#8e3020'], [0.5, '#c4583c'], [1, '#e9b08a']]); c.fill(P);
      inClip(c, P, () => { for (let i = 0; i < 26; i++) blotch(c, rnd(80, 380), rnd(cy - 70, cy + 50), rnd(8, 20), 'rgba(80,20,10,.45)'); for (let i = 0; i < 18; i++) blotch(c, rnd(80, 380), rnd(cy - 50, cy + 60), rnd(5, 12), 'rgba(250,220,190,.35)'); spots(c, 60, 70, 380, cy - 70, cy + 70, 1, 2.2, 'rgba(255,255,255,.6)'); });
      shade(c, P, x0, x1, cy, h, 'rgba(60,0,0,.22)', 'rgba(255,240,220,.25)'); outline(c, P, 'rgba(60,15,5,.6)');
      c.fillStyle = '#7a2a1a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(96 + i * 12, 90 - i * 2); c.lineTo(100 + i * 12, 74 - i * 2); c.lineTo(104 + i * 12, 92 - i * 2); c.fill(); }
      const pec = [[176, 128]]; for (let i = 0; i <= 8; i++) { const a = -0.9 + i * 0.24; pec.push([176 + Math.cos(a) * 92, 150 + Math.sin(a) * 70]); } pec.push([176, 172]);
      const pp = fin(c, pec, 'rgba(200,90,60,.92)', 'rgba(60,20,10,.5)', 9, 'rgba(60,20,10,.3)');
      inClip(c, pp, () => { c.strokeStyle = 'rgba(250,220,190,.45)'; c.lineWidth = 5; for (const r of [40, 66]) { c.beginPath(); c.arc(176, 150, r, -0.9, 1.2); c.stroke(); } });
      eye(c, 112, 110, 15, '#e05030');
      c.strokeStyle = 'rgba(60,15,5,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(60, 148); c.quadraticCurveTo(80, 160, 104, 152); c.stroke();
    },
    manbou(c) { // マンボウ（体の幅は全体の約半分）
      const cx = 268, cy = 128;
      fin(c, [[300, 70], [318, 22], [340, 6], [352, 30], [338, 78]], '#8e98a2', 'rgba(30,40,50,.5)', 6, 'rgba(255,255,255,.12)');
      fin(c, [[300, 186], [318, 234], [340, 250], [352, 226], [338, 178]], '#8e98a2', 'rgba(30,40,50,.5)', 6, 'rgba(255,255,255,.12)');
      const P = new Path2D(); P.moveTo(150, 128); P.bezierCurveTo(150, 56, 240, 44, 300, 54); P.quadraticCurveTo(372, 62, 382, 128); P.quadraticCurveTo(372, 194, 300, 202); P.bezierCurveTo(240, 212, 150, 200, 150, 128); P.closePath();
      const clav = new Path2D(); clav.moveTo(370, 70); for (let i = 0; i <= 10; i++) { const a = -1.1 + i * 0.22; clav.lineTo(376 + Math.cos(a) * 26 + (i % 2) * 6, cy + Math.sin(a) * 66); } clav.lineTo(370, 186); clav.closePath();
      c.fillStyle = '#9aa4ae'; c.fill(clav); outline(c, clav, 'rgba(30,40,50,.5)', 2);
      c.fillStyle = lg(c, 0, 50, 0, 206, [[0, '#7d8994'], [0.5, '#aab4bc'], [1, '#dfe5e8']]); c.fill(P);
      inClip(c, P, () => { for (let i = 0; i < 30; i++) blotch(c, rnd(170, 380), rnd(60, 200), rnd(4, 10), 'rgba(240,245,248,.35)'); });
      shade(c, P, 150, 382, cy, 150, 'rgba(0,10,20,.2)', 'rgba(255,255,255,.25)'); outline(c, P, 'rgba(30,40,50,.5)');
      fin(c, [[226, 118], [250, 108], [256, 132], [232, 138]], 'rgba(150,160,170,.9)', 'rgba(30,40,50,.4)', 3);
      eye(c, 186, 112, 9, '#30383e');
      c.fillStyle = '#5a646c'; c.beginPath(); c.ellipse(153, 134, 4, 6, 0, 0, TAU); c.fill();
      void cx;
    },
    hirame(c) { // ヒラメ（上から見た姿・頭は左）
      const cx = 250, cy = 128;
      const fr = new Path2D(); fr.ellipse(cx, cy, 196, 108, 0, 0, TAU);
      c.fillStyle = 'rgba(130,100,64,.9)'; c.fill(fr);
      c.save(); c.clip(fr); c.strokeStyle = 'rgba(60,40,20,.35)'; c.lineWidth = 1.5;
      for (let i = 0; i < 80; i++) { const a = i / 80 * TAU; c.beginPath(); c.moveTo(cx + Math.cos(a) * 160, cy + Math.sin(a) * 82); c.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 110); c.stroke(); }
      c.restore();
      fin(c, [[420, 104], [470, 84], [500, 128], [470, 172], [420, 152]], 'rgba(130,100,64,.95)', 'rgba(60,40,20,.5)', 7);
      const P = new Path2D(); P.ellipse(cx - 6, cy, 168, 86, 0, 0, TAU);
      c.fillStyle = lg(c, 0, 40, 0, 216, [[0, '#7a5c38'], [0.5, '#94744a'], [1, '#7a5c38']]); c.fill(P);
      inClip(c, P, () => { for (let i = 0; i < 26; i++) { const x = rnd(110, 400), y = rnd(60, 196); c.strokeStyle = 'rgba(60,40,18,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, rnd(5, 11), 0, TAU); c.stroke(); } spots(c, 90, 90, 410, 50, 206, 1, 3, 'rgba(240,220,180,.5)'); for (let i = 0; i < 14; i++) blotch(c, rnd(100, 400), rnd(60, 196), rnd(8, 16), 'rgba(70,48,22,.3)'); });
      outline(c, P, 'rgba(50,34,16,.6)');
      eye(c, 128, 104, 10, '#c8a050'); eye(c, 150, 128, 10, '#c8a050');
      c.strokeStyle = 'rgba(50,30,10,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(92, 138); c.quadraticCurveTo(104, 150, 120, 146); c.stroke();
    },
    /* ---- 追加（来館写真から） ---- */
    redtail(c) { // レッドテール・キャットフィッシュ
      const x0 = 36, x1 = 404, cy = 132, h = 104;
      fin(c, [[398, 112], [448, 70], [496, 66], [470, 130], [496, 196], [448, 190], [398, 152]], '#ff4a1a', 'rgba(110,20,0,.5)', 10, 'rgba(255,200,150,.3)', false);
      fin(c, [[170, 84], [196, 34], [232, 30], [250, 80]], lg(c, 0, 84, 0, 30, [[0, '#2e2e32'], [0.65, '#4a3630'], [1, '#ff5a2a']]), 'rgba(0,0,0,.5)', 6, 'rgba(255,120,60,.25)');
      fin(c, [[330, 100], [354, 86], [376, 96], [380, 112]], '#2e2e32', 'rgba(0,0,0,.5)', 0);
      fin(c, [[300, 176], [330, 206], [366, 198], [378, 162]], '#4a4a50', 'rgba(0,0,0,.5)', 5);
      const P = bodyPath(x0, x1, cy, h, { top: 0.24, snoutY: 6, ped: 36, nose: 0.62, belly: 1.0 });
      c.fillStyle = lg(c, 0, cy - 52, 0, cy + 52, [[0, '#1c1c20'], [0.45, '#3a3a40'], [0.62, '#e9e6dc'], [0.82, '#f4f1e8'], [1, '#c9c4b8']]); c.fill(P);
      inClip(c, P, () => { spots(c, 70, 50, 400, cy - 50, cy - 4, 1.5, 3.5, 'rgba(0,0,0,.55)'); c.fillStyle = 'rgba(30,30,34,.85)'; c.beginPath(); c.moveTo(60, cy + 20); c.bezierCurveTo(160, cy + 40, 300, cy + 44, 404, cy + 20); c.lineTo(404, cy + 60); c.lineTo(60, cy + 60); c.closePath(); c.fill(); });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.25)', 'rgba(255,255,255,.12)'); outline(c, P, 'rgba(0,0,0,.6)');
      pecFin(c, 122, 152, 62, 0.45, 'rgba(56,56,60,.95)', 'rgba(255,255,255,.12)');
      c.strokeStyle = '#ece6d6'; c.lineCap = 'round';
      c.lineWidth = 3.2; c.beginPath(); c.moveTo(48, 128); c.bezierCurveTo(20, 112, 14, 80, 30, 50); c.stroke();
      c.lineWidth = 2.6; c.beginPath(); c.moveTo(44, 142); c.bezierCurveTo(24, 170, 26, 200, 46, 222); c.stroke();
      c.lineWidth = 2.2; c.beginPath(); c.moveTo(56, 146); c.bezierCurveTo(48, 176, 62, 196, 80, 210); c.stroke();
      eye(c, 84, 116, 7, '#c8a850');
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(38, 138); c.quadraticCurveTo(60, 146, 84, 140); c.stroke();
    },
    pacu(c) { // パクー（コロソマ）
      const x0 = 62, x1 = 386, cy = 128, h = 196;
      fin(c, [[380, 108], [440, 64], [480, 70], [452, 128], [480, 186], [440, 192], [380, 148]], '#24282c', 'rgba(0,0,0,.6)', 9, 'rgba(255,255,255,.08)', false);
      fin(c, [[200, 36], [236, 6], [270, 10], [282, 40]], '#2a2e32', 'rgba(0,0,0,.6)', 6, 'rgba(255,255,255,.08)');
      fin(c, [[324, 52], [344, 40], [358, 54], [350, 70]], '#2a2e32', 'rgba(0,0,0,.6)', 0);
      fin(c, [[260, 218], [300, 248], [356, 236], [374, 170]], '#3a2a28', 'rgba(0,0,0,.6)', 8, 'rgba(255,90,60,.25)');
      fin(c, [[170, 214], [186, 244], [210, 238], [210, 214]], '#5a2a22', 'rgba(0,0,0,.6)', 4);
      const P = bodyPath(x0, x1, cy, h, { top: 0.42, snoutY: 18, ped: 48, nose: 0.9 });
      c.fillStyle = lg(c, 0, cy - 98, 0, cy + 98, [[0, '#15181b'], [0.45, '#2c3136'], [0.8, '#3e3a38'], [1, '#6a3a30']]); c.fill(P);
      scales(c, P, x0, x1, cy, h, 'rgba(255,255,255,.07)', 11);
      inClip(c, P, () => { const rg = c.createRadialGradient(200, 214, 4, 200, 214, 80); rg.addColorStop(0, 'rgba(200,70,50,.55)'); rg.addColorStop(1, 'rgba(200,70,50,0)'); c.fillStyle = rg; c.fillRect(100, 140, 220, 100); });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.25)', 'rgba(255,255,255,.08)'); outline(c, P, 'rgba(0,0,0,.6)');
      gill(c, 130, cy + 6, h * 0.8, 'rgba(0,0,0,.45)');
      pecFin(c, 140, 160, 48, 0.4, 'rgba(90,64,60,.92)', 'rgba(0,0,0,.35)');
      eye(c, 100, 112, 12, '#b89040');
      c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 148); c.quadraticCurveTo(76, 154, 88, 150); c.stroke();
    },
    kue(c) { // クエ
      const x0 = 50, x1 = 392, cy = 132, h = 140;
      fin(c, [[388, 110], [440, 82], [482, 104], [486, 132], [482, 160], [440, 182], [388, 156]], '#5e4430', 'rgba(30,20,10,.55)', 9, 'rgba(255,230,200,.15)');
      const dor = [[136, 74]]; for (let i = 0; i < 11; i++) dor.push([150 + i * 16, 40 + (i % 2) * 10], [158 + i * 16, 64]); dor.push([336, 46], [370, 56], [388, 104]);
      fin(c, dor, '#6a4c34', 'rgba(30,20,10,.55)', 0, '', false);
      fin(c, [[290, 190], [318, 226], [360, 218], [380, 160]], '#6a4c34', 'rgba(30,20,10,.55)', 6);
      const P = bodyPath(x0, x1, cy, h, { top: 0.36, snoutY: 16, ped: 48, nose: 0.8 });
      c.fillStyle = lg(c, 0, cy - 70, 0, cy + 70, [[0, '#5a3e28'], [0.5, '#7e5c3e'], [1, '#b89a78']]); c.fill(P);
      inClip(c, P, () => { for (let i = 0; i < 6; i++) { c.save(); c.translate(120 + i * 52, cy); c.rotate(-0.5); for (let k = 0; k < 4; k++) blotch(c, rnd(-10, 10), -60 + k * 34, rnd(13, 19), 'rgba(40,26,14,.5)'); c.restore(); } spots(c, 40, 70, 390, cy - 60, cy + 60, 1.5, 3, 'rgba(240,220,190,.4)'); });
      shade(c, P, x0, x1, cy, h, 'rgba(20,10,0,.25)', 'rgba(255,240,220,.2)'); outline(c, P, 'rgba(30,20,10,.6)');
      gill(c, 140, cy, h, 'rgba(30,20,10,.45)');
      pecFin(c, 162, 146, 64, 0.3, 'rgba(118,86,58,.94)', 'rgba(30,20,10,.4)');
      eye(c, 104, 110, 11, '#c09040');
      c.strokeStyle = 'rgba(30,15,5,.8)'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(52, 150); c.quadraticCurveTo(84, 166, 120, 152); c.stroke();
    },
    mahata(c) { // マハタ
      const x0 = 52, x1 = 392, cy = 132, h = 142;
      fin(c, [[388, 110], [444, 86], [470, 132], [444, 178], [388, 156]], '#6e675a', 'rgba(20,20,15,.55)', 8, 'rgba(255,255,255,.1)');
      const dor = [[136, 74]]; for (let i = 0; i < 11; i++) dor.push([150 + i * 16, 40 + (i % 2) * 10], [158 + i * 16, 64]); dor.push([336, 46], [370, 56], [388, 104]);
      fin(c, dor, '#5e584c', 'rgba(20,20,15,.55)', 0, '', false);
      fin(c, [[290, 190], [318, 226], [360, 218], [380, 160]], '#5e584c', 'rgba(20,20,15,.55)', 6);
      const P = bodyPath(x0, x1, cy, h, { top: 0.36, snoutY: 16, ped: 48, nose: 0.8 });
      c.fillStyle = lg(c, 0, cy - 71, 0, cy + 71, [[0, '#6f695c'], [0.5, '#958e7c'], [1, '#c4bca8']]); c.fill(P);
      inClip(c, P, () => { c.fillStyle = 'rgba(46,42,34,.7)'; for (let i = 0; i < 7; i++) { const x = 92 + i * 42; c.beginPath(); c.moveTo(x, 40); c.bezierCurveTo(x + 6, 100, x + 6, 170, x - 4, 230); c.lineTo(x + 20, 230); c.bezierCurveTo(x + 28, 170, x + 28, 100, x + 22, 40); c.closePath(); c.fill(); } scales(c, P, x0, x1, cy, h, 'rgba(255,255,255,.07)', 10); });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.22)', 'rgba(255,255,255,.18)'); outline(c, P, 'rgba(20,20,15,.6)');
      gill(c, 140, cy, h, 'rgba(20,20,15,.45)');
      pecFin(c, 162, 146, 64, 0.3, 'rgba(116,110,96,.94)', 'rgba(20,20,15,.4)');
      eye(c, 104, 110, 11, '#b8a060');
      c.strokeStyle = 'rgba(20,15,10,.8)'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(54, 150); c.quadraticCurveTo(84, 166, 120, 152); c.stroke();
    },
    koshoudai(c) { // コショウダイ
      const x0 = 56, x1 = 392, cy = 132, h = 150;
      const tail = fin(c, [[388, 112], [444, 80], [478, 92], [470, 132], [478, 172], [444, 184], [388, 152]], '#d9d4c6', 'rgba(30,30,30,.5)', 8);
      inClip(c, tail, () => spots(c, 26, 392, 480, 82, 184, 2, 4, '#1a1a1a'));
      const df = fin(c, [[140, 62], [170, 32], [250, 26], [330, 40], [384, 100]], '#cfcabc', 'rgba(30,30,30,.5)', 14);
      inClip(c, df, () => spots(c, 30, 220, 384, 26, 90, 2, 4, '#1a1a1a'));
      fin(c, [[290, 198], [320, 230], [360, 220], [382, 158]], '#bdb8aa', 'rgba(30,30,30,.5)', 6);
      const P = bodyPath(x0, x1, cy, h, { top: 0.4, snoutY: 16, ped: 46, nose: 0.85 });
      c.fillStyle = lg(c, 0, cy - 75, 0, cy + 75, [[0, '#a8a396'], [0.5, '#d4cfc2'], [1, '#efebe2']]); c.fill(P);
      inClip(c, P, () => {
        c.fillStyle = 'rgba(40,36,30,.78)';
        const band = (xt, xb, wd) => { c.beginPath(); c.moveTo(xt, 40); c.lineTo(xt + wd, 40); c.lineTo(xb + wd, 230); c.lineTo(xb, 230); c.closePath(); c.fill(); };
        band(150, 70, 30); band(232, 140, 28); band(316, 226, 26);
        spots(c, 50, 250, 392, cy - 66, cy + 40, 2, 4.2, '#161616');
      });
      shade(c, P, x0, x1, cy, h, 'rgba(0,0,0,.18)', 'rgba(255,255,255,.2)'); outline(c, P, 'rgba(30,30,30,.55)');
      gill(c, 134, cy, h, 'rgba(30,30,30,.4)');
      pecFin(c, 160, 150, 58, 0.3, 'rgba(196,190,176,.92)', 'rgba(30,30,30,.35)');
      eye(c, 106, 112, 12, '#c8b070');
      c.fillStyle = '#6e6458'; c.beginPath(); c.ellipse(64, 150, 13, 7, 0.2, 0, TAU); c.fill(); c.beginPath(); c.ellipse(70, 160, 12, 6, 0.1, 0, TAU); c.fill();
    },
  };
  const FISH_KINDS = Object.keys(PAINT);
  const FT = {};
  function fishTex(kind) {
    if (!PAINT[kind]) kind = 'iwashi';
    if (FT[kind]) return FT[kind];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    PAINT[kind](c);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (FT[kind] = t);
  }
  const spriteMat = kind => matK('spr_' + kind, () => new THREE.MeshBasicMaterial({ map: fishTex(kind), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  const SPRITE_GEO = () => once(GEO, 'spritePlane', () => new THREE.PlaneGeometry(1, 0.5));
  /* 板の魚。len=全長(m)。ヒラメは自動で寝かせる */
  function makeSpriteFish(kind, len = 0.3) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(SPRITE_GEO(), spriteMat(kind)); m.scale.set(len, len, 1);
    const flat = kind === 'hirame';
    if (flat) { m.rotation.set(-PI / 2, 0, PI / 2); m.position.y = 0.005; } else m.rotation.y = PI / 2;
    g.add(m);
    const c = creature(g, len, null, { kind, sprite: true, ph: rnd(0, TAU), mesh: m, moving: true, speed: 0.25 });
    let tt = rnd(0, 10);
    c.update = (dt, t) => {
      tt += dt * (4 + 6 * clamp(c.speed / Math.max(0.08, len), 0.2, 2.5));
      const a = Math.sin(tt + c.ph);
      if (flat) m.rotation.z = PI / 2 + a * 0.025;
      else { m.rotation.y = PI / 2 + a * 0.13; m.scale.x = len * (1 - 0.035 * Math.abs(a)); }
    };
    return c;
  }

  /* ===================================================================
     C. 立体の生きもの
     =================================================================== */

  /* 1. ダイオウグソクムシ（約0.4m・原点=接地） */
  function makeGiantIsopod() {
    const g = new THREE.Group(), body = grp(g);
    const shA = pho(0xd8ccd6, 22, 0x2a2a2a), shB = pho(0xc6b8c4, 22, 0x2a2a2a), under = lam(0xe6dac8), eyeM = pho(0x251e2c, 90, 0x666666), legM = lam(0xdccfbe);
    const BY = 0.034;
    mk(SPH(14, 6), under, 0.074, 0.016, 0.19, 0, BY, -0.005, body);
    for (let i = 0; i < 7; i++) {
      const z = 0.116 - i * 0.031, w = 0.076 + Math.sin((i + 1) / 8 * PI) * 0.012;
      mk(HEMI(16, 5), i % 2 ? shB : shA, w, 0.041 - Math.abs(i - 3) * 0.002, 0.027, 0, BY, z, body).rotation.x = 0.16;
    }
    for (let i = 0; i < 4; i++) mk(HEMI(14, 4), i % 2 ? shA : shB, 0.07 - i * 0.004, 0.033, 0.015, 0, BY, -0.094 - i * 0.016, body).rotation.x = 0.18;
    mk(HEMI(14, 5), shA, 0.058, 0.029, 0.05, 0, BY, -0.164, body);
    for (let k = -3; k <= 3; k++) {
      const a = k * 0.33, sp = mk(CONE(4), legM, 0.0045, 0.02, 0.0045, Math.sin(a) * 0.054, BY + 0.004, -0.164 - Math.cos(a) * 0.046, body);
      sp.rotation.order = 'YXZ'; sp.rotation.set(-PI / 2, -a, 0);
    }
    for (const s of [-1, 1]) mk(SPH(10, 5), shB, 0.022, 0.007, 0.046, s * 0.06, BY + 0.006, -0.158, body).rotation.y = s * 0.35;
    const head = grp(body, 0, BY, 0.155);
    mk(HEMI(14, 5), shA, 0.052, 0.03, 0.038, 0, 0, 0, head);
    for (const s of [-1, 1]) mk(SPH(10, 6), eyeM, 0.015, 0.012, 0.025, s * 0.04, 0.012, 0.006, head).rotation.y = s * 0.5;
    const ants = [];
    for (const s of [-1, 1]) {
      const a = grp(head, s * 0.028, 0.008, 0.032);
      polyRod([V3(0, 0, 0), V3(s * 0.03, 0.004, 0.02), V3(s * 0.075, 0, 0.012), V3(s * 0.11, -0.006, -0.04), V3(s * 0.122, -0.012, -0.11)], 0.0036, 0.0012, legM, 4, a);
      const b = grp(head, s * 0.012, 0.012, 0.036);
      polyRod([V3(0, 0, 0), V3(s * 0.012, 0.008, 0.02), V3(s * 0.03, 0.01, 0.04)], 0.003, 0.0012, legM, 4, b);
      ants.push(a, b);
    }
    const legs = [];
    for (let i = 0; i < 7; i++) for (const s of [-1, 1])
      legs.push(Object.assign(jointLeg(body, s * 0.05, BY + 0.004, 0.116 - i * 0.031, s, (3 - i) * 0.12,
        [{ len: 0.033, a: -0.2, r: 0.0058, mat: legM, seg: 4 }, { len: 0.037, a: -1.2, r: 0.0046, mat: legM, seg: 4, taper: 0.5 }]), { ph: i * 0.9 + (s > 0 ? PI : 0) }));
    let walk = 0;
    const c = creature(g, 0.42, (dt, t) => {
      const k = c.moving ? 1 : 0; walk += dt * (3 + 30 * (c.speed || 0)) * k;
      for (const L of legs) stepLeg(L, walk + L.ph, k, 0.25, 0.3);
      body.position.y = k * 0.002 * Math.sin(walk * 2);
      ants.forEach((a, i) => { a.rotation.y = 0.08 * Math.sin(t * 1.3 + i * 1.7); a.rotation.x = 0.05 * Math.sin(t * 0.9 + i); });
    });
    return c;
  }

  /* 2. ミズクラゲ（傘の中心が原点・暗い背景で光る） */
  function jellyMat(k, color, op, side = THREE.DoubleSide, map = null) {
    return matK(`jel_${k}_${color}`, () => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side }));
  }
  function makeJellyfish(color = 0xbfe6ff) {
    const g = new THREE.Group(), inner = grp(g);
    const R = rnd(0.15, 0.19);
    const bellGeo = once(GEO, 'jbell', () => new THREE.SphereGeometry(1, 24, 9, 0, TAU, 0, PI * 0.46));
    const gonTex = tex('jgon', 128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.translate(64, 64);
      for (let k = 0; k < 4; k++) {
        const a = k * PI / 2 + PI / 4, x = Math.cos(a) * 27, y = Math.sin(a) * 27;
        c.strokeStyle = 'rgba(255,180,230,.35)'; c.lineWidth = 15; c.beginPath(); c.arc(x, y, 14, a + PI * 0.36, a + PI * 1.64); c.stroke();
        c.strokeStyle = 'rgba(255,215,245,.95)'; c.lineWidth = 7; c.beginPath(); c.arc(x, y, 14, a + PI * 0.36, a + PI * 1.64); c.stroke();
      }
      const rg = c.createRadialGradient(0, 0, 2, 0, 0, 62); rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(0, 0, 62, 0, TAU); c.fill();
    });
    const bell = new THREE.Mesh(bellGeo, jellyMat('bell', color, 0.3)); inner.add(bell);
    const bell2 = new THREE.Mesh(bellGeo, jellyMat('bell2', color, 0.16, THREE.BackSide)); bell2.scale.setScalar(0.94); bell.add(bell2);
    const rim = new THREE.Mesh(once(GEO, 'jrim', () => new THREE.TorusGeometry(1, 0.03, 4, 36)), jellyMat('rim', color, 0.35)); rim.rotation.x = PI / 2; inner.add(rim);
    const gon = new THREE.Mesh(once(GEO, 'jgonD', () => planarUV(new THREE.SphereGeometry(1, 24, 8, 0, TAU, 0, PI * 0.46))), jellyMat('gon', 0xffffff, 0.85, THREE.DoubleSide, gonTex));
    inner.add(gon);
    const fringeGeo = once(GEO, 'jfringe', () => {
      const P = [], N = 60;
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, L = rnd(0.2, 0.55), x = Math.cos(a), z = Math.sin(a), wob = rnd(-0.05, 0.05);
        let px = x * 0.99, py = 0.069, pz = z * 0.99;
        for (let s = 1; s <= 3; s++) { const nx = x * (0.99 - 0.035 * s) + wob * s, ny = 0.069 - L * s / 3, nz = z * (0.99 - 0.035 * s); P.push(px, py, pz, nx, ny, nz); px = nx; py = ny; pz = nz; }
      }
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return ge;
    });
    const fringe = new THREE.LineSegments(fringeGeo, matK('jline' + color, () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
    fringe.rotation.y = rnd(0, TAU); inner.add(fringe);
    const armTex = tex('jarm', 64, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y++) {
        const k = y / h, half = (8 + 9 * Math.abs(Math.sin(k * 18))) * (1 - 0.55 * k), a = 0.85 * (1 - k * 0.8);
        c.fillStyle = `rgba(255,235,250,${a * 0.55})`; c.fillRect(w / 2 - half, y, half * 2, 1);
        c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(w / 2 - half, y, 2, 1); c.fillRect(w / 2 + half - 2, y, 2, 1);
      }
    });
    const armGeo = once(GEO, 'jarmG', () => { const ge = new THREE.PlaneGeometry(0.5, 1); ge.translate(0, -0.5, 0); return ge; });
    const arms = grp(inner); const armM = jellyMat('arm', color, 0.7, THREE.DoubleSide, armTex);
    for (let k = 0; k < 4; k++) { const a = mk(armGeo, armM, R, R * rnd(1.2, 1.6), 1, Math.cos(k * PI / 2 + 0.6) * R * 0.12, R * 0.1, Math.sin(k * PI / 2 + 0.6) * R * 0.12, arms); a.rotation.y = k * PI / 2 + 0.6 + PI / 2; }
    const halo = new THREE.Sprite(matK('jhalo' + color, () => new THREE.SpriteMaterial({
      map: tex('jhaloT', 64, 64, (c, w, h) => { const rg = c.createRadialGradient(32, 32, 2, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(0, 0, w, h); }),
      color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false
    })));
    halo.scale.setScalar(R * 2.8); inner.add(halo);
    const ph = rnd(0, 1), rate = rnd(0.55, 0.8);
    const c = creature(g, R * 2.2, (dt, t) => {
      const cyc = t * rate + ph, p = Math.pow(Math.max(0, Math.sin(cyc * TAU)), 2);
      const sx = R * (1 - 0.14 * p), sy = R * 0.55 * (1 + 0.22 * p);
      bell.scale.set(sx, sy, sx);
      rim.scale.setScalar(sx * 0.99); rim.position.y = sy * 0.125;
      fringe.scale.set(sx, R * (1 + 0.15 * p), sx);
      gon.scale.set(sx * 0.9, sy * 0.86, sx * 0.9);
      arms.rotation.y = 0.25 * Math.sin(t * 0.3 + ph * 6);
      arms.children.forEach((a, i) => { a.rotation.x = 0.1 * Math.sin(t * 1.1 + i); a.rotation.z = 0.08 * Math.sin(t * 0.9 + i * 2); });
      inner.position.y = 0.03 * Math.sin(cyc * TAU - 1.3);
    }, { R });
    return c;
  }

  /* 3. アオウミガメ（1m・原点=体の中心） */
  const scaleTex = () => tex('scaleSkin', 128, 128, (c, w, h) => {
    c.fillStyle = '#3e3020'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = rnd(0, w), y = rnd(0, h), r = rnd(5, 11); c.fillStyle = `rgb(${rnd(80, 105) | 0},${rnd(68, 88) | 0},${rnd(40, 52) | 0})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(220,205,160,.75)'; c.lineWidth = 2; c.stroke(); }
  });
  function makeSeaTurtle() {
    const g = new THREE.Group(), body = grp(g);
    const shellT = tex('turtleShell', 256, 256, (c, w, h) => {
      c.fillStyle = '#3e2e16'; c.fillRect(0, 0, w, h);
      const scute = pts => {
        const P = polyPath(pts); let mx = 0, my = 0; pts.forEach(p => { mx += p[0]; my += p[1]; }); mx /= pts.length; my /= pts.length;
        const gr = c.createRadialGradient(mx, my - 8, 2, mx, my, 48); gr.addColorStop(0, '#c9ac5a'); gr.addColorStop(0.45, '#7e6230'); gr.addColorStop(1, '#3a2812');
        c.fillStyle = gr; c.fill(P);
        c.save(); c.clip(P);
        for (let i = 0; i < 28; i++) { const a = rnd(0, TAU); c.strokeStyle = `rgba(${rnd(25, 60) | 0},${rnd(15, 40) | 0},5,${rnd(0.3, 0.7)})`; c.lineWidth = rnd(1, 3.2); c.beginPath(); c.moveTo(mx, my - 8); c.lineTo(mx + Math.cos(a) * 60, my - 8 + Math.sin(a) * 60); c.stroke(); }
        for (let i = 0; i < 10; i++) { const a = rnd(0, TAU); c.strokeStyle = 'rgba(230,200,110,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx, my - 8); c.lineTo(mx + Math.cos(a) * 40, my - 8 + Math.sin(a) * 40); c.stroke(); }
        c.restore(); c.strokeStyle = '#21160a'; c.lineWidth = 3.5; c.stroke(P);
      };
      const X = y => Math.sqrt(Math.max(0, 106 * 106 - (y - 128) * (y - 128)));
      const rows = [[20, 74], [74, 128], [128, 180], [180, 232]];
      for (const s of [-1, 1]) for (const [y0, y1] of rows) scute([[128 + s * 27, y0], [128 + s * X(y0), y0], [128 + s * X((y0 + y1) / 2) * 1.0, (y0 + y1) / 2], [128 + s * X(y1), y1], [128 + s * 27, y1]]);
      [34, 80, 128, 176, 220].forEach((y, i) => { const hw = i === 0 || i === 4 ? 22 : 28, hh = 23; scute([[128 - hw, y], [128 - hw * 0.62, y - hh], [128 + hw * 0.62, y - hh], [128 + hw, y], [128 + hw * 0.62, y + hh], [128 - hw * 0.62, y + hh]]); });
      for (let i = 0; i < 24; i++) { const a0 = i / 24 * TAU, a1 = (i + 1) / 24 * TAU; scute([[128 + Math.cos(a0) * 106, 128 + Math.sin(a0) * 106], [128 + Math.cos(a0) * 126, 128 + Math.sin(a0) * 126], [128 + Math.cos(a1) * 126, 128 + Math.sin(a1) * 126], [128 + Math.cos(a1) * 106, 128 + Math.sin(a1) * 106]]); }
    });
    const shellM = matK('turtleShellM', () => new THREE.MeshPhongMaterial({ map: shellT, shininess: 35, specular: 0x333322 }));
    const skinM = matK('turtleSkin', () => new THREE.MeshLambertMaterial({ map: scaleTex() }));
    mk(PHEMI(20, 8), shellM, 0.37, 0.14, 0.46, 0, -0.01, 0, body);
    mk(HEMI(16, 4), lam(0xe4d3a2), 0.34, 0.05, 0.43, 0, -0.012, 0, body).rotation.x = PI;
    const head = grp(body, 0, 0.0, 0.43);
    mk(SPH(10, 6), skinM, 0.075, 0.06, 0.1, 0, -0.005, 0.0, head);
    mk(SPH(12, 8), skinM, 0.074, 0.064, 0.098, 0, 0.012, 0.09, head);
    mk(SPH(8, 6), pho(0x4a3c24, 40), 0.042, 0.034, 0.04, 0, -0.008, 0.17, head);
    for (const s of [-1, 1]) mk(SPH(8, 6), pho(0x0c0c0c, 90, 0x666666), 0.014, 0.016, 0.016, s * 0.058, 0.028, 0.13, head);
    const flips = [];
    for (const s of [-1, 1]) {
      const p = grp(body, s * 0.27, -0.015, 0.22); p.rotation.order = 'YZX';
      mk(SPH(14, 6), skinM, 0.3, 0.022, 0.085, s * 0.27, 0, -0.02, p).rotation.y = s * 0.12;
      flips.push({ p, s, front: true });
      const r = grp(body, s * 0.21, -0.02, -0.34); r.rotation.order = 'YZX';
      mk(SPH(10, 5), skinM, 0.12, 0.018, 0.07, s * 0.1, 0, 0, r);
      flips.push({ p: r, s, front: false });
    }
    mk(CONE(5), skinM, 0.03, 0.09, 0.02, 0, -0.01, -0.44, body).rotation.x = -PI / 2;
    let sw = rnd(0, 6);
    const c = creature(g, 1.0, (dt, t) => {
      sw += dt * (1.8 + 2.2 * clamp(c.speed || 0.2, 0, 1.2));
      for (const F of flips) {
        if (F.front) { F.p.rotation.z = F.s * 0.55 * Math.sin(sw); F.p.rotation.y = F.s * (0.5 + 0.28 * Math.sin(2 * sw + 0.6)); }
        else { F.p.rotation.y = F.s * 0.95; F.p.rotation.z = F.s * 0.18 * Math.sin(sw * 0.5 + 1); }
      }
      head.rotation.x = 0.06 * Math.sin(sw * 0.5); body.position.y = -0.015 * Math.sin(sw);
    });
    return c;
  }

  /* 4. マダラトビエイ（翼幅1.6m・原点=体の中心・翼は頂点アニメ） */
  function makeRay() {
    const g = new THREE.Group(), body = grp(g);
    const b = 0.8, NS = 12, NC = 8, cols = 2 * NS + 1, rows = NC + 1;
    const zF = s => 0.26 - 0.42 * Math.pow(s, 1.25), zB = s => -0.36 + 0.17 * Math.pow(s, 0.8);
    const th = (s, k) => 0.11 * Math.pow(1 - s, 1.6) * Math.pow(Math.sin(PI * k), 0.8) + 0.003;
    const nv = cols * rows, pos = new Float32Array(nv * 2 * 3), uv = new Float32Array(nv * 2 * 2), sArr = new Float32Array(nv * 2), baseY = new Float32Array(nv * 2);
    let zmin = 1e9, zmax = -1e9;
    for (let L = 0; L < 2; L++) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i - NS) / NS * b, s = Math.abs(x) / b, k = j / NC, z = zF(s) + (zB(s) - zF(s)) * k, t = th(s, k);
      const y = L === 0 ? t * 0.5 : -t * 0.32 - 0.006 * (1 - s), idx = L * nv + j * cols + i;
      pos[idx * 3] = x; pos[idx * 3 + 1] = y; pos[idx * 3 + 2] = z; sArr[idx] = s; baseY[idx] = y; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
    }
    for (let n = 0; n < nv * 2; n++) { uv[n * 2] = pos[n * 3] / (2 * b) + 0.5; uv[n * 2 + 1] = (pos[n * 3 + 2] - zmin) / (zmax - zmin); }
    const idx = [];
    for (let j = 0; j < NC; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b1 = a + 1, c1 = a + cols, d = c1 + 1; idx.push(a, b1, c1, b1, d, c1); }
    const topCount = idx.length;
    for (let j = 0; j < NC; j++) for (let i = 0; i < cols - 1; i++) { const a = nv + j * cols + i, b1 = a + 1, c1 = a + cols, d = c1 + 1; idx.push(a, c1, b1, b1, c1, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.addGroup(0, topCount, 0); geo.addGroup(topCount, idx.length - topCount, 1); geo.computeVertexNormals();
    const topT = tex('raySpots', 256, 256, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w * 0.6); gr.addColorStop(0, '#2c3c4e'); gr.addColorStop(1, '#17212c');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { const x = rnd(0, w), y = rnd(0, h), r = rnd(1.8, 5.2); c.fillStyle = 'rgba(235,245,255,.95)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); if (r > 4) { c.fillStyle = '#1d2a38'; c.beginPath(); c.arc(x, y, r * 0.45, 0, TAU); c.fill(); } }
    });
    const topM = matK('rayTop', () => new THREE.MeshPhongMaterial({ map: topT, shininess: 30, specular: 0x222222 }));
    const botM = matK('rayBot', () => new THREE.MeshLambertMaterial({ color: 0xf2f4f6 }));
    const wing = new THREE.Mesh(geo, [topM, botM]); body.add(wing);
    const dark = pho(0x1e2a37, 30);
    mk(SPH(12, 8), dark, 0.09, 0.05, 0.11, 0, 0.012, 0.27, body);
    mk(SPH(10, 6), dark, 0.062, 0.026, 0.075, 0, 0.0, 0.37, body);
    mk(SPH(8, 6), lam(0xf2f4f6), 0.06, 0.02, 0.07, 0, -0.012, 0.36, body);
    for (const s of [-1, 1]) mk(SPH(8, 6), pho(0x060606, 90, 0x555555), 0.012, 0.014, 0.016, s * 0.075, 0.032, 0.28, body);
    const tail = []; let par = grp(body, 0, 0, -0.35);
    for (let i = 0; i < 4; i++) { const p = grp(par, 0, 0, i === 0 ? 0 : 0.36); p.rotation.x = i === 0 ? -PI / 2 : 0; mk(SEG(0.6, 4), dark, 0.012 * (1 - i * 0.22), 0.36, 0.012 * (1 - i * 0.22), 0, 0, 0, p); if (i) { p.position.set(0, 0.36, 0); } tail.push(p); par = p; }
    let fl = rnd(0, 6);
    const c = creature(g, 1.0, (dt, t) => {
      fl += dt * (1.7 + 1.4 * clamp(c.speed || 0.3, 0, 1.5));
      const A = 0.21;
      for (let n = 0; n < nv * 2; n++) { const s = sArr[n]; pos[n * 3 + 1] = baseY[n] + A * Math.pow(s, 1.6) * Math.sin(fl - 2.2 * s); }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
      body.position.y = -0.03 * Math.sin(fl - 0.4);
      tail.forEach((p, i) => { p.rotation.z = (i ? 0.16 : 0.08) * Math.sin(t * 1.8 - i * 0.9); });
    }, { wingspan: 1.6, len: 1.6 });
    return c;
  }

  /* 5. ネムリブカ（1.5m・原点=体の中心・胴は頂点アニメで泳ぐ） */
  function finGeo(pts, white) {
    const ge = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))));
    const P = ge.attributes.position, C = [], col = new THREE.Color(), gray = new THREE.Color(0x6c7782), wht = new THREE.Color(0xf4f6f8);
    for (let i = 0; i < P.count; i++) { col.copy(gray).lerp(wht, white === undefined ? 0 : sstep(white - 0.02, white + 0.02, P.getY(i))); C.push(col.r, col.g, col.b); }
    ge.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return ge;
  }
  function makeShark() {
    const g = new THREE.Group(), body = grp(g);
    const prof = [[1.0, 0.022], [0.88, 0.04], [0.75, 0.065], [0.6, 0.095], [0.45, 0.115], [0.3, 0.12], [0.18, 0.105], [0.08, 0.075], [0.03, 0.045], [0.0, 0.004]];
    const Lb = 1.15, base = once(GEO, 'sharkBody', () => {
      const ge = new THREE.LatheGeometry(prof.map(([u, r]) => new THREE.Vector2(r, -u * Lb)), 12);
      ge.rotateX(PI / 2); ge.translate(0, 0, 0.75);
      const P = ge.attributes.position, C = [], col = new THREE.Color(), top = new THREE.Color(0x6a7580), bel = new THREE.Color(0xe8ecee);
      for (let i = 0; i < P.count; i++) {
        let x = P.getX(i) * 0.82, y = P.getY(i); const z = P.getZ(i);
        if (z > 0.45) y *= 1 - 0.25 * clamp((z - 0.45) / 0.3, 0, 1);
        P.setXYZ(i, x, y, z);
        const r = Math.max(1e-3, Math.hypot(x / 0.82, y)); col.copy(bel).lerp(top, sstep(-0.35, 0.25, y / r)); C.push(col.r, col.g, col.b);
      }
      ge.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); ge.computeVertexNormals(); return ge;
    });
    const geo = base.clone(); const P = geo.attributes.position, bx = Float32Array.from({ length: P.count }, (_, i) => P.getX(i)), bz = Float32Array.from({ length: P.count }, (_, i) => P.getZ(i));
    body.add(new THREE.Mesh(geo, VC_LAM()));
    const finM = VC_LAM_DS();
    const d1 = new THREE.Mesh(once(GEO, 'shD1', () => finGeo([[0, 0], [0.08, 0.14], [0.115, 0.16], [0.125, 0.13], [0.16, 0]], 0.115).rotateY(PI / 2)), finM); d1.position.set(0, 0.1, 0.2); body.add(d1);
    const d2 = new THREE.Mesh(once(GEO, 'shD2', () => finGeo([[0, 0], [0.04, 0.06], [0.06, 0.065], [0.075, 0]], 0.05).rotateY(PI / 2)), finM); d2.position.set(0, 0.04, -0.2); body.add(d2);
    const an = new THREE.Mesh(once(GEO, 'shAn', () => finGeo([[0, 0], [0.04, -0.055], [0.06, -0.06], [0.075, 0]]).rotateY(PI / 2)), finM); an.position.set(0, -0.035, -0.22); body.add(an);
    const caud = grp(body, 0, 0, -0.4);
    caud.add(new THREE.Mesh(once(GEO, 'shCa', () => finGeo([[0, 0.025], [0.15, 0.12], [0.32, 0.25], [0.27, 0.15], [0.2, 0.06], [0.21, 0], [0.24, -0.12], [0.1, -0.06], [0, -0.025]], 0.19).rotateY(PI / 2)), finM));
    const pecG = once(GEO, 'shPec', () => { const ge = finGeo([[0, 0], [0.19, -0.12], [0.15, -0.155], [0, -0.1]]); ge.rotateX(PI / 2); return ge; });
    const pecs = [];
    for (const s of [-1, 1]) { const p = new THREE.Mesh(pecG, finM); p.position.set(s * 0.07, -0.055, 0.4); p.scale.x = s; p.rotation.z = -s * 0.42; body.add(p); pecs.push(p); }
    for (const s of [-1, 1]) { const p = new THREE.Mesh(pecG, finM); p.position.set(s * 0.035, -0.06, -0.05); p.scale.set(s * 0.4, 0.4, 0.4); p.rotation.z = -s * 0.5; body.add(p); }
    const eyeM = pho(0x0a0a0a, 90, 0x666666);
    for (const s of [-1, 1]) {
      mk(SPH(8, 6), eyeM, 0.011, 0.011, 0.014, s * 0.056, 0.022, 0.6, body);
      for (let k = 0; k < 5; k++) { const gl = mk(SPH(4, 3), lam(0x4a545c), 0.002, 0.03, 0.004, s * 0.072, -0.012, 0.5 - k * 0.022, body); gl.rotation.x = 0.2; }
    }
    let sw = rnd(0, 6);
    const off = z => { const d = 0.3 - z; return d <= 0 ? 0 : 0.075 * Math.pow(d / 0.7, 1.6) * Math.sin(sw - 4 * d); };
    const c = creature(g, 1.5, (dt, t) => {
      sw += dt * (3.2 + 3.5 * clamp(c.speed || 0.3, 0, 1.5));
      for (let i = 0; i < P.count; i++) P.setX(i, bx[i] + off(bz[i]) * (bz[i] < 0.3 ? 1 : 0));
      P.needsUpdate = true; geo.computeVertexNormals();
      d2.position.x = off(-0.22); an.position.x = off(-0.24);
      const ox = off(-0.4); caud.position.x = ox; caud.rotation.y = -Math.atan2(ox - off(-0.35), 0.05) * 1.2;
      pecs.forEach((p, i) => { p.rotation.x = 0.06 * Math.sin(t * 0.8 + i); });
    });
    return c;
  }

  /* 6. オウムガイ（直径0.2m・原点=殻の中心・殻口は+Z、渦巻きは上側） */
  function makeNautilus() {
    const g = new THREE.Group(), inner = grp(g);
    const r1 = 0.071, KR = 0.78, KX = 0.62;
    const shellGeo = once(GEO, 'nautShell2', () => {
      const bb = 0.175, th0 = -2.6 * PI, th1 = 0, NU = 52, NV = 14, P = [], U = [], I = [];
      for (let i = 0; i <= NU; i++) {
        const th = th0 + (th1 - th0) * i / NU, r = r1 * Math.exp(bb * th), cz = r * Math.sin(th), cy = -r * Math.cos(th), ez = Math.sin(th), ey = -Math.cos(th);
        for (let j = 0; j <= NV; j++) { const ph = j / NV * TAU; P.push(Math.sin(ph) * r * KX, cy + Math.cos(ph) * r * KR * ey, cz + Math.cos(ph) * r * KR * ez); U.push(i / NU, j / NV); }
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b1 = a + NV + 1; I.push(a, a + 1, b1, a + 1, b1 + 1, b1); }
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); ge.setIndex(I); ge.computeVertexNormals(); return ge;
    });
    const shT = tex('nautTex2', 256, 64, (c, w, h) => {
      c.fillStyle = '#f3e7cf'; c.fillRect(0, 0, w, h);
      for (let x = 4; x < w * 0.8; x += rnd(8, 12)) {
        const fade = 1 - sstep(w * 0.6, w * 0.8, x); c.strokeStyle = `rgba(176,78,24,${0.92 * fade})`; c.lineWidth = rnd(3, 6) * (0.6 + 0.4 * fade);
        c.beginPath(); for (let y = 0; y <= h; y += 4) { const ww = Math.cos((y / h) * TAU); const xx = x + 7 * Math.sin(y / h * TAU * 1.5 + x * 0.3) - 6 * ww; y ? c.lineTo(xx, y) : c.moveTo(xx, y); } c.stroke();
      }
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(110,60,25,.3)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(0.93, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,20,10,.35)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    mk(shellGeo, matK('nautM2', () => new THREE.MeshPhongMaterial({ map: shT, shininess: 80, specular: 0x666655, side: THREE.DoubleSide })), 1, 1, 1, 0, 0, 0, inner);
    const hoodT = tex('nautHood', 64, 64, (c, w, h) => { c.fillStyle = '#6a3016'; c.fillRect(0, 0, w, h); spots(c, 40, 0, w, 0, h, 1.2, 3, 'rgba(240,215,180,.75)'); spots(c, 20, 0, w, 0, h, 2, 5, 'rgba(50,20,8,.5)'); });
    const hood = mk(SPH(14, 8), matK('nautHoodM', () => new THREE.MeshLambertMaterial({ map: hoodT })), r1 * 0.55, r1 * 0.36, r1 * 0.32, 0, -r1 * 0.55, r1 * 0.04, inner);
    hood.rotation.x = 0.25;
    mk(SPH(12, 8), lam(0xd9b48a), r1 * 0.5, r1 * 0.45, r1 * 0.22, 0, -r1 * 1.15, 0, inner);
    for (const s of [-1, 1]) mk(SPH(8, 6), pho(0x141010, 80, 0x555555), r1 * 0.11, r1 * 0.11, r1 * 0.07, s * r1 * 0.5, -r1 * 0.95, r1 * 0.06, inner);
    const tents = grp(inner, 0, -r1 * 1.18, r1 * 0.04); const tm = lam(0xe8cba4);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU, bx = Math.cos(a) * r1 * 0.34, by = Math.sin(a) * r1 * 0.3, L = r1 * rnd(0.45, 0.8);
      const dir = V3(Math.cos(a) * 0.45 + rnd(-0.1, 0.1), Math.sin(a) * 0.35 - 0.15, 1).normalize();
      const p = grp(tents, bx, by, 0); rod(V3(0, 0, 0), dir.multiplyScalar(L), r1 * 0.045, r1 * 0.02, tm, 4, p);
    }
    inner.position.set(0, r1 * 0.3, -r1 * 0.2);
    const ph = rnd(0, 6);
    const c = creature(g, 0.22, (dt, t) => {
      inner.position.y = r1 * 0.3 + 0.01 * Math.sin(t * 1.3 + ph);
      inner.rotation.x = 0.08 * Math.sin(t * 0.9 + ph);
      inner.position.z = -r1 * 0.2 + 0.008 * Math.max(0, Math.sin(t * 0.7 + ph));
      tents.children.forEach((p, i) => { p.rotation.x = 0.12 * Math.sin(t * 1.5 + i); p.rotation.y = 0.1 * Math.sin(t * 1.1 + i * 1.7); });
    });
    return c;
  }

  /* 7. カブトガニ（0.5m・原点=接地） */
  function makeHorseshoeCrab() {
    const g = new THREE.Group(), body = grp(g);
    const kT = tex('kabutoT', 128, 128, (c, w, h) => {
      const gr = c.createRadialGradient(64, 60, 6, 64, 64, 70); gr.addColorStop(0, '#8a7444'); gr.addColorStop(1, '#4e4024'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(40,30,12,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 14); c.lineTo(64, 118); c.stroke();
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(64 + s * 18, 22); c.quadraticCurveTo(64 + s * 34, 70, 64 + s * 26, 118); c.stroke(); }
      spots(c, 90, 0, w, 0, h, 0.8, 2, 'rgba(30,22,8,.35)');
      c.strokeStyle = 'rgba(200,180,120,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.stroke();
    });
    const shM = matK('kabutoM', () => new THREE.MeshPhongMaterial({ map: kT, shininess: 60, specular: 0x444433 }));
    const dk = pho(0x55462a, 50, 0x333322), under = lam(0x9a8a5c);
    mk(PHEMI(18, 7), shM, 0.17, 0.065, 0.15, 0, 0.012, 0.075, body);
    mk(HEMI(14, 3), under, 0.15, 0.012, 0.13, 0, 0.012, 0.075, body).rotation.x = PI;
    for (const s of [-1, 1]) mk(SPH(8, 5), pho(0x1c160c, 80), 0.011, 0.006, 0.016, s * 0.075, 0.058, 0.085, body);
    const ab = grp(body, 0, 0.012, -0.055);
    mk(HEMI(14, 5), dk, 0.105, 0.042, 0.075, 0, 0, -0.055, ab);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const sp = mk(CONE(4), dk, 0.004, 0.022, 0.004, s * (0.098 - i * 0.006), 0.004, -0.02 - i * 0.017, ab); sp.rotation.z = -s * PI / 2; }
    const tel = grp(ab, 0, 0.01, -0.125); tel.rotation.x = -PI / 2 + 0.12;
    mk(SEG(0.15, 5), dk, 0.009, 0.25, 0.009, 0, 0, 0, tel);
    const legs = [];
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) legs.push(Object.assign(jointLeg(body, s * 0.035, 0.022, 0.13 - i * 0.022, s, (2 - i) * 0.2, [{ len: 0.03, a: -0.4, r: 0.004, mat: under, seg: 4 }, { len: 0.022, a: -1.2, r: 0.003, mat: under, seg: 4 }]), { ph: i * 1.1 + (s > 0 ? PI : 0) }));
    let walk = 0;
    const c = creature(g, 0.52, (dt, t) => {
      const k = c.moving ? 1 : 0; walk += dt * (4 + 25 * (c.speed || 0)) * k;
      legs.forEach(L => stepLeg(L, walk + L.ph, k, 0.3, 0.35));
      ab.rotation.x = 0.04 * Math.sin(t * 0.7); tel.rotation.y = 0.12 * Math.sin(t * 0.5);
    });
    return c;
  }

  /* 8. 甲殻類: 'ise' イセエビ / 'takaashi' タカアシガニ / 'zarigani' ザリガニ（原点=接地） */
  function makeCrustacean(kind = 'ise') {
    const g = new THREE.Group(), body = grp(g);
    const legs = [], ants = [], claws = [];
    let len = 0.3;
    if (kind === 'takaashi') {
      len = 2.6;
      const oraT = tex('takaT', 128, 128, (c, w, h) => { c.fillStyle = '#d0682a'; c.fillRect(0, 0, w, h); spots(c, 70, 0, w, 0, h, 1.5, 4.5, 'rgba(255,240,225,.85)'); spots(c, 40, 0, w, 0, h, 2, 6, 'rgba(150,60,20,.35)'); });
      const shM = matK('takaM', () => new THREE.MeshPhongMaterial({ map: oraT, shininess: 30, specular: 0x332211 }));
      const ora = pho(0xd2692b, 30), wht = pho(0xf3e6d6, 25), ora2 = pho(0xb4561f, 30);
      const BY = 0.45;
      mk(PHEMI(18, 7), shM, 0.15, 0.1, 0.18, 0, BY, 0, body);
      mk(HEMI(14, 4), ora2, 0.14, 0.05, 0.16, 0, BY, 0, body).rotation.x = PI;
      for (let i = 0; i < 16; i++) { const x = rnd(-0.11, 0.11), z = rnd(-0.12, 0.14), q = 1 - (x / 0.15) ** 2 - (z / 0.18) ** 2; if (q <= 0.05) continue; mk(HEMI(6, 3), ora, 0.012, 0.014, 0.012, x, BY + 0.1 * Math.sqrt(q) - 0.003, z, body); }
      for (const s of [-1, 1]) { const r = mk(CONE(4), ora, 0.008, 0.06, 0.008, s * 0.018, BY + 0.05, 0.17, body); r.rotation.set(1.2, 0, -s * 0.25); mk(SPH(6, 4), pho(0x140c08, 80), 0.008, 0.008, 0.008, s * 0.04, BY + 0.06, 0.15, body); }
      const yaws = [0.75, 0.25, -0.25, -0.75], zs = [0.07, 0.02, -0.04, -0.1];
      for (let i = 0; i < 4; i++) for (const s of [-1, 1])
        legs.push(Object.assign(jointLeg(body, s * 0.12, BY - 0.01, zs[i], s, yaws[i],
          [{ len: 0.55, a: 0.33, r: 0.02, mat: ora }, { len: 0.55, a: -1.03, r: 0.016, mat: ora }, { len: 0.17, a: -1.37, r: 0.01, mat: wht, taper: 0.3 }], wht), { ph: i * PI / 2 + (s > 0 ? PI : 0) }));
      for (const s of [-1, 1]) {
        const L = jointLeg(body, s * 0.08, BY - 0.02, 0.15, s, 1.05, [{ len: 0.42, a: 0.15, r: 0.016, mat: ora }, { len: 0.36, a: -0.75, r: 0.013, mat: ora }], wht);
        const tip = grp(L.piv[1], 0, 0.36, 0);
        mk(SPH(8, 5), ora, 0.018, 0.05, 0.014, 0, 0.04, 0, tip);
        const fA = mk(CONE(4), wht, 0.006, 0.05, 0.006, 0.006, 0.08, 0, tip); fA.rotation.z = -0.15;
        const fB = mk(CONE(4), wht, 0.006, 0.05, 0.006, -0.006, 0.08, 0, tip); fB.rotation.z = 0.25;
        claws.push({ fB }); legs.push(Object.assign(L, { ph: s > 0 ? 0.5 : 2.2, claw: true }));
      }
    } else if (kind === 'zarigani') {
      len = 0.14;
      const red = pho(0xc0261a, 60, 0x553333), red2 = pho(0x941a10, 60, 0x553333), dk = pho(0x1a0d0a, 90, 0x666666);
      const BY = 0.02;
      mk(SPH(12, 8), red, 0.016, 0.0145, 0.03, 0, BY + 0.004, 0.022, body);
      mk(CONE(4), red, 0.004, 0.016, 0.003, 0, BY + 0.007, 0.05, body).rotation.x = PI / 2;
      for (const s of [-1, 1]) { mk(SPH(6, 4), dk, 0.0032, 0.0032, 0.0032, s * 0.007, BY + 0.013, 0.05, body); const a = grp(body, s * 0.004, BY + 0.006, 0.05); polyRod([V3(0, 0, 0), V3(s * 0.02, 0.006, 0.04), V3(s * 0.05, 0.002, 0.075), V3(s * 0.085, -0.004, 0.07)], 0.0014, 0.0005, red2, 3, a); ants.push(a); }
      for (let i = 0; i < 6; i++) mk(SPH(10, 5), i % 2 ? red : red2, 0.0145 - i * 0.0011, 0.0105 - i * 0.0004, 0.0085, 0, BY + 0.002 - i * 0.0012, -0.008 - i * 0.0095, body);
      for (let k = -2; k <= 2; k++) { const f = mk(SPH(6, 4), red, 0.0065, 0.0016, 0.012, Math.sin(k * 0.35) * 0.012, BY - 0.005, -0.07 - Math.cos(k * 0.35) * 0.008, body); f.rotation.y = -k * 0.35; }
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) legs.push(Object.assign(jointLeg(body, s * 0.012, BY, 0.03 - i * 0.008, s, (1.5 - i) * 0.3, [{ len: 0.018, a: 0.5, r: 0.0018, mat: red2, seg: 4 }, { len: 0.03, a: -1.1, r: 0.0014, mat: red2, seg: 4 }]), { ph: i * 1.2 + (s > 0 ? PI : 0) }));
      for (const s of [-1, 1]) {
        const arm = grp(body, s * 0.012, BY + 0.002, 0.044); arm.rotation.y = s * 0.35;
        const a1 = grp(arm); a1.rotation.x = PI / 2 - 0.15; mk(SEG(0.8, 5), red, 0.0035, 0.024, 0.0035, 0, 0, 0, a1);
        const palm = grp(arm, 0, 0.004, 0.024); palm.rotation.y = -s * 0.5;
        mk(SPH(10, 6), red, 0.0085, 0.006, 0.017, 0, 0, 0.012, palm);
        const fa = mk(CONE(4), red2, 0.003, 0.018, 0.0024, s * 0.0035, 0, 0.026, palm); fa.rotation.x = PI / 2;
        const fbp = grp(palm, -s * 0.004, 0, 0.022); const fb = mk(CONE(4), red2, 0.0026, 0.017, 0.0022, 0, 0, 0, fbp); fb.rotation.x = PI / 2;
        claws.push({ fbp, s });
      }
    } else {
      len = 0.32;
      const red = pho(0x8a2c16, 50, 0x443322), red2 = pho(0xa8442a, 50, 0x443322), pale = pho(0xd8b27a, 40), dk = pho(0x1e0e0a, 90, 0x666666);
      const BY = 0.056;
      mk(SPH(12, 8), red, 0.045, 0.038, 0.072, 0, BY + 0.01, 0.07, body);
      for (let i = 0; i < 16; i++) { const x = rnd(-0.03, 0.03), z = rnd(0.02, 0.13), q = 1 - (x / 0.045) ** 2 - ((z - 0.07) / 0.072) ** 2; if (q < 0.15) continue; const sp = mk(CONE(4), red2, 0.0035, 0.012, 0.0035, x, BY + 0.01 + 0.038 * Math.sqrt(q) - 0.002, z, body); sp.rotation.x = 0.5; }
      for (const s of [-1, 1]) {
        const hn = mk(CONE(5), red, 0.009, 0.036, 0.009, s * 0.022, BY + 0.038, 0.125, body); hn.rotation.set(1.0, 0, -s * 0.2);
        mk(SPH(6, 5), dk, 0.0075, 0.0075, 0.0075, s * 0.019, BY + 0.028, 0.142, body);
        const a = grp(body, s * 0.025, BY + 0.02, 0.135);
        polyRod([V3(0, 0, 0), V3(s * 0.04, 0.025, 0.1), V3(s * 0.12, 0.032, 0.2), V3(s * 0.24, 0.02, 0.24), V3(s * 0.36, 0, 0.2)], 0.0095, 0.0025, red2, 5, a); ants.push(a);
        const b = grp(body, s * 0.01, BY + 0.016, 0.14);
        polyRod([V3(0, 0, 0), V3(s * 0.01, 0.012, 0.05), V3(s * 0.022, 0.022, 0.09)], 0.0025, 0.001, pale, 3, b); ants.push(b);
      }
      for (let i = 0; i < 6; i++) {
        const z = -0.0 - i * 0.024, y = BY + 0.008 - i * 0.003;
        mk(SPH(12, 6), i % 2 ? red : red2, 0.04 - i * 0.0025, 0.028 - i * 0.001, 0.02, 0, y, z, body);
        mk(SPH(10, 4), pale, 0.04 - i * 0.0025, 0.0285 - i * 0.001, 0.004, 0, y, z - 0.016, body);
      }
      for (let k = -2; k <= 2; k++) { const f = mk(SPH(8, 4), k ? red2 : red, 0.017, 0.0045, 0.034, Math.sin(k * 0.32) * 0.03, BY - 0.012, -0.15 - Math.cos(k * 0.32) * 0.02, body); f.rotation.y = -k * 0.32; }
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) legs.push(Object.assign(jointLeg(body, s * 0.03, BY, 0.11 - i * 0.02, s, (2 - i) * 0.25,
        [{ len: 0.04, a: 0.5, r: 0.0045, mat: pale, seg: 4 }, { len: 0.075, a: -1.1, r: 0.0035, mat: red2, seg: 4 }]), { ph: i * 1.1 + (s > 0 ? PI : 0) }));
    }
    let walk = rnd(0, 6);
    const c = creature(g, len, (dt, t) => {
      const k = c.moving ? 1 : 0, slow = kind === 'takaashi' ? 0.45 : 1;
      walk += dt * (2.5 + 18 * (c.speed || 0) / Math.max(0.15, len)) * k * slow;
      legs.forEach(L => { if (L.claw) { L.yaw.rotation.y = -L.side * L.splay + 0.06 * Math.sin(t * 0.6 + L.ph); return; } stepLeg(L, walk + L.ph, k, kind === 'takaashi' ? 0.13 : 0.22, kind === 'takaashi' ? 0.1 : 0.25); });
      ants.forEach((a, i) => { a.rotation.y = 0.12 * Math.sin(t * 1.4 + i * 1.9); a.rotation.x = 0.06 * Math.sin(t * 1.1 + i); });
      claws.forEach((C, i) => { const o = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 2); if (C.fbp) C.fbp.rotation.y = -C.s * 0.45 * o; if (C.fB) C.fB.rotation.z = 0.25 + 0.3 * o; });
      body.position.y = k * 0.003 * Math.abs(Math.sin(walk));
    }, { kind });
    return c;
  }

  /* 9. グリーンイグアナ（1.2m・原点=おなか＝枝の上） */
  function makeIguana() {
    const g = new THREE.Group(), body = grp(g);
    const grn = pho(0x5a9a3a, 25), grn2 = pho(0x86b852, 25), dark = pho(0x33401e, 25), pale = pho(0xcfd8b0, 30), eyeM = pho(0x8a4a10, 90, 0x666666);
    mk(SPH(14, 8), grn, 0.065, 0.055, 0.18, 0, 0.05, 0, body);
    mk(SPH(12, 6), grn2, 0.058, 0.035, 0.16, 0, 0.032, 0, body);
    const head = grp(body, 0, 0.07, 0.17);
    mk(SPH(10, 6), grn, 0.042, 0.04, 0.05, 0, 0, 0, head);
    mk(SPH(12, 8), grn, 0.038, 0.034, 0.06, 0, 0.012, 0.05, head);
    mk(SPH(10, 6), grn, 0.02, 0.018, 0.034, 0, 0.008, 0.096, head);
    mk(SPH(10, 6), grn2, 0.034, 0.02, 0.05, 0, -0.012, 0.05, head);
    const eyes = [];
    for (const s of [-1, 1]) { mk(SPH(10, 6), pale, 0.005, 0.017, 0.017, s * 0.036, -0.008, 0.03, head); eyes.push(mk(SPH(8, 6), eyeM, 0.009, 0.008, 0.009, s * 0.031, 0.024, 0.064, head)); }
    const dew = new THREE.Mesh(once(GEO, 'dewlap', () => new THREE.CircleGeometry(1, 12, PI, PI).rotateY(PI / 2)), matK('dewM', () => new THREE.MeshLambertMaterial({ color: 0x7aa84a, side: THREE.DoubleSide })));
    dew.scale.setScalar(0.055); dew.position.set(0, -0.028, 0.04); head.add(dew);
    for (let i = 0; i < 16; i++) {
      const z = 0.22 - i * 0.026, hgt = (i < 4 ? 0.022 + i * 0.003 : 0.03 - (i - 4) * 0.0018), y = z > 0.15 ? 0.11 : 0.05 + 0.055 * Math.sqrt(Math.max(0, 1 - (z / 0.18) ** 2));
      const sp = mk(CONE(4), grn2, 0.004, Math.max(0.008, hgt), 0.007, 0, y - 0.004, z, body); sp.rotation.x = -0.5;
    }
    const tail = []; let par = grp(body, 0, 0.045, -0.165); par.rotation.x = -PI / 2 - 0.12; tail.push(par);
    for (let i = 0; i < 10; i++) {
      const r = 0.032 * (1 - i / 10.5) + 0.004;
      mk(SEG(0.82, 6), i % 2 ? dark : grn, r, 0.08, r, 0, 0, 0, par);
      if (i < 9) { const p = grp(par, 0, 0.08, 0); p.rotation.x = -0.09; tail.push(p); par = p; }
    }
    for (const [z, s] of [[0.1, -1], [0.1, 1], [-0.11, -1], [-0.11, 1]]) {
      const L = jointLeg(body, s * 0.05, 0.045, z, s, z > 0 ? 0.6 : -0.6, [{ len: 0.075, a: 0.15, r: 0.015, mat: grn }, { len: 0.07, a: -1.3, r: 0.011, mat: grn }]);
      const ft = grp(L.piv[1], 0, 0.07, 0);
      for (let k = 0; k < 4; k++) { const toe = mk(CONE(3), dark, 0.003, 0.035, 0.003, 0, 0, 0, ft); toe.rotation.set(PI / 2 + 0.6, (k - 1.5) * 0.4, 0); }
    }
    let bob = 0, nextBob = rnd(2, 6), blink = 0;
    const c = creature(g, 1.2, (dt, t) => {
      nextBob -= dt; if (nextBob <= 0) { bob = 1.6; nextBob = rnd(4, 9); }
      if (bob > 0) { bob -= dt; head.rotation.x = -0.18 * Math.abs(Math.sin(bob * 7)); } else head.rotation.x = damp(head.rotation.x, 0, 4, dt);
      dew.scale.set(0.045, 0.045 * (1 + 0.15 * Math.sin(t * 2.2)), 0.045);
      tail.forEach((p, i) => { p.rotation.z = 0.05 * Math.sin(t * 0.9 - i * 0.45); });
      blink -= dt; if (blink < -3.5) blink = 0.15; eyes.forEach(e => { e.scale.y = blink > 0 ? 0.002 : 0.008; });
    });
    return c;
  }

  /* 10. ヤドクガエル（4cm・原点=接地。呼び出し側で×4などに拡大してよい） */
  function makePoisonFrog(color = 0x1e5bff, pattern = 0x0a0a14) {
    const g = new THREE.Group(), body = grp(g);
    const ft = tex(`frog${color}_${pattern}`, 64, 64, (c, w, h) => {
      const col = '#' + new THREE.Color(color).getHexString(), pat = '#' + new THREE.Color(pattern).getHexString();
      c.fillStyle = col; c.fillRect(0, 0, w, h);
      const hl = c.createLinearGradient(0, 0, 0, h); hl.addColorStop(0, 'rgba(255,255,255,.18)'); hl.addColorStop(1, 'rgba(0,0,0,.15)'); c.fillStyle = hl; c.fillRect(0, 0, w, h);
      c.fillStyle = pat; for (let i = 0; i < 16; i++) { c.beginPath(); c.ellipse(rnd(0, w), rnd(0, h), rnd(1.5, 5), rnd(1.5, 4), rnd(0, 3), 0, TAU); c.fill(); }
    });
    const skin = matK(`frogM${color}_${pattern}`, () => new THREE.MeshPhongMaterial({ map: ft, shininess: 100, specular: 0x777777 }));
    const eyeM = pho(0x050505, 120, 0x888888);
    mk(SPH(12, 8), skin, 0.016, 0.012, 0.02, 0, 0.013, -0.002, body).rotation.x = -0.25;
    mk(SPH(12, 8), skin, 0.0135, 0.0105, 0.012, 0, 0.016, 0.014, body);
    for (const s of [-1, 1]) mk(SPH(8, 6), eyeM, 0.0046, 0.0046, 0.0046, s * 0.009, 0.021, 0.018, body);
    const throat = mk(SPH(8, 6), pho(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35).getHex(), 60), 0.008, 0.004, 0.007, 0, 0.007, 0.017, body);
    const thighs = [];
    for (const s of [-1, 1]) {
      const th = grp(body, s * 0.011, 0.008, -0.01); th.rotation.y = s * 0.6;
      mk(SPH(8, 6), skin, 0.006, 0.006, 0.014, 0, 0, -0.008, th);
      mk(SPH(8, 6), skin, 0.004, 0.004, 0.012, s * 0.006, -0.003, 0.004, th);
      mk(SPH(6, 4), skin, 0.006, 0.0015, 0.008, s * 0.004, -0.007, 0.012, th);
      thighs.push(th);
      const fl = grp(body, s * 0.01, 0.012, 0.012); rod(V3(0, 0, 0), V3(s * 0.006, -0.012, 0.006), 0.0025, 0.002, skin, 4, fl);
      mk(SPH(6, 4), skin, 0.0035, 0.0012, 0.0035, s * 0.007, -0.0115, 0.008, fl);
    }
    let hop = 0, next = rnd(3, 8);
    const c = creature(g, 0.04, (dt, t) => {
      throat.scale.y = 0.004 * (1 + 0.6 * Math.max(0, Math.sin(t * 6)));
      next -= dt; if (next <= 0 && hop <= 0) { hop = 0.45; next = rnd(4, 10); }
      if (hop > 0) { hop -= dt; const k = 1 - hop / 0.45; body.position.y = 0.03 * Math.sin(PI * k); thighs.forEach((th, i) => { th.rotation.x = -0.9 * Math.sin(PI * k); }); }
      else { body.position.y = 0; thighs.forEach(th => { th.rotation.x = 0; }); }
    });
    return c;
  }

  /* 11. タコ（頭＋胴≒0.6m・腕0.9m・原点=接地。setMode('cling'|'swim')。
         c.drape: 1=岩にかぶさって腕が垂れる（幅0.8m・高さ0.6〜0.8mの岩向き）/ 0=床に平らに広がる */
  function makeOctopus(o = {}) {
    const g = new THREE.Group(), body = grp(g);
    const skT = tex('octoSkin', 128, 128, (c, w, h) => {
      c.fillStyle = '#9a4630'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) blotch(c, rnd(0, w), rnd(0, h), rnd(4, 11), `rgba(${rnd(90, 120) | 0},${rnd(30, 45) | 0},${rnd(20, 30) | 0},.55)`);
      for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(240,200,170,${rnd(0.25, 0.55)})`; c.beginPath(); c.arc(rnd(0, w), rnd(0, h), rnd(1, 2.6), 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(70,20,10,.35)'; c.lineWidth = 1.2; for (let i = 0; i < 26; i++) { const y = rnd(0, h); c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * 0.2 + i) * 2.5); c.stroke(); }
    }, 2, 2);
    const skin = matK('octoM', () => new THREE.MeshPhongMaterial({ map: skT, shininess: 45, specular: 0x332222 }));
    const armT = tex('octoArm', 64, 128, (c, w, h) => {
      c.fillStyle = '#9a4630'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 22; i++) blotch(c, rnd(0, w), rnd(0, h), rnd(3, 7), 'rgba(100,35,22,.5)');
      for (let y = 6; y < h; y += 10) for (const x of [0, w]) { c.fillStyle = '#f0dcc0'; c.beginPath(); c.arc(x + (y % 20 ? 5 : -5) * (x ? -1 : 1), y, 5, 0, TAU); c.fill(); c.fillStyle = 'rgba(180,120,90,.8)'; c.beginPath(); c.arc(x + (y % 20 ? 5 : -5) * (x ? -1 : 1), y, 2, 0, TAU); c.fill(); }
    }, 1, 1);
    const armM = matK('octoArmM', () => new THREE.MeshPhongMaterial({ map: armT, shininess: 50, specular: 0x332222 }));
    const mantle = grp(body, 0, 0.24, -0.08);
    const man = mk(SPH(16, 10), skin, 0.15, 0.18, 0.22, 0, 0, 0, mantle); man.rotation.x = -0.6;
    const head = grp(body, 0, 0.16, 0.08);
    mk(SPH(14, 8), skin, 0.13, 0.1, 0.12, 0, 0, 0, head);
    for (const s of [-1, 1]) {
      mk(SPH(10, 6), skin, 0.035, 0.03, 0.035, s * 0.085, 0.06, 0.04, head);
      mk(SPH(8, 6), pho(0xe8d8a0, 80), 0.017, 0.013, 0.017, s * 0.106, 0.07, 0.05, head);
      mk(SPH(6, 4), pho(0x0a0a0a, 90, 0x666666), 0.004, 0.0035, 0.012, s * 0.121, 0.071, 0.052, head);
    }
    const siphon = mk(SEG(0.6, 6), skin, 0.022, 0.06, 0.022, 0.09, 0.0, -0.02, head); siphon.rotation.set(0.3, 0, -1.3);
    const NSEG = 8, SL = 0.115, arms = [];
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) / 8 * TAU, root = grp(body, Math.sin(a) * 0.075, 0.1, 0.06 + Math.cos(a) * 0.075); root.rotation.y = a;
      const piv = []; let par = root;
      for (let i = 0; i < NSEG; i++) {
        const p = grp(par, 0, i === 0 ? 0 : SL, 0); const r = 0.045 * (1 - i / NSEG * 0.85);
        mk(SEG(+(1 - 0.85 / NSEG / (1 - i / NSEG * 0.85 + 1e-3)).toFixed(2), 6), armM, r, SL * 1.02, r, 0, 0, 0, p);
        piv.push(p); par = p;
      }
      arms.push({ root, piv, a, ph: rnd(0, TAU), spd: rnd(0.4, 0.7) });
    }
    let mode = 'cling', mix = 0;
    const c = creature(g, 1.6, (dt, t) => {
      mix = damp(mix, mode === 'swim' ? 1 : 0, 2.5, dt);
      const dr = clamp(c.drape, 0, 1);
      man.scale.set(0.15 * (1 + 0.05 * Math.sin(t * 1.6)), 0.18, 0.22 * (1 + 0.04 * Math.sin(t * 1.6)));
      body.rotation.x = mix * PI / 2; body.position.set(0, -0.12 * mix, -0.06 * mix);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      for (const A of arms) {
        const w = Math.sin(t * A.spd + A.ph);
        A.piv.forEach((p, i) => {
          const f = i / NSEG;
          const cling = i === 0 ? PI / 2 + 0.45 - 0.3 * dr : i < 3 ? -0.3 * (1 - dr) + 0.17 * dr : 0.17 * dr + 0.05 * Math.sin(t * 0.7 + A.ph + i * 0.7);
          const swim = i === 0 ? PI - 0.12 - 0.3 * pulse : 0.03 * Math.sin(t * 3 - i * 0.8 + A.ph) + 0.04 * pulse;
          p.rotation.x = cling * (1 - mix) + swim * mix;
          p.rotation.z = (i >= 3 ? (0.1 + 0.3 * f) * (0.55 + 0.45 * w) * A.curl : 0.04 * Math.sin(t * 0.6 + A.ph + i)) * (1 - mix * 0.7);
        });
      }
    }, { drape: o.drape ?? 0.8, setMode(m) { mode = m === 'swim' ? 'swim' : 'cling'; } });
    Object.defineProperty(c, 'mode', { get: () => mode, enumerable: true });
    arms.forEach(A => { A.curl = Math.random() < 0.5 ? 1 : -1; });
    return c;
  }

  /* 12. ウツボ（1.0〜1.3m・原点=接地。山盛りに重ねる前提。c.headUp 0〜1, c.mouth 0〜1） */
  function makeMoray() {
    const g = new THREE.Group();
    const L = rnd(1.0, 1.3), NR = 30, NV = 8;
    const mT = tex('morayT2', 256, 64, (c, w, h) => {
      c.fillStyle = '#cdb76c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) blotch(c, rnd(-6, w + 6), rnd(-4, h + 4), rnd(3, 8), `rgba(${rnd(52, 78) | 0},${rnd(36, 50) | 0},${rnd(14, 22) | 0},.8)`);
      c.strokeStyle = 'rgba(66,44,18,.65)'; c.lineWidth = 2.4; for (let i = 0; i < 26; i++) { c.beginPath(); let x = rnd(0, w), y = rnd(0, h); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-9, 9); y += rnd(-9, 9); c.lineTo(x, y); } c.stroke(); }
      spots(c, 50, 0, w, 0, h, 0.8, 1.8, 'rgba(245,235,190,.55)');
    });
    const mM = matK('morayM2', () => new THREE.MeshPhongMaterial({ map: mT, shininess: 45, specular: 0x333322 }));
    const nVert = (NR + 1) * (NV + 1), pos = new Float32Array(nVert * 3), uv = new Float32Array(nVert * 2), idx = [];
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NV; j++) { const n = i * (NV + 1) + j; uv[n * 2] = i / NR * L / 1.2; uv[n * 2 + 1] = j / NV; }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b1 = a + NV + 1; idx.push(a, b1, a + 1, a + 1, b1, b1 + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mM); g.add(mesh);
    /* 太さ: しっぽは細く、頭の後ろが少し太く、口先は丸く閉じる */
    const rad = s => { const tail = 0.06 + 0.94 * sstep(0.0, 0.42, s), neck = 1 + 0.1 * sstep(0.78, 0.9, s), snout = s < 0.93 ? 1 : Math.max(0.1, Math.sqrt(Math.max(0, 1 - ((s - 0.93) / 0.072) ** 2))); return 0.058 * tail * neck * snout; };
    const dors = s => 0.55 * sstep(0.1, 0.25, s) * (1 - sstep(0.8, 0.86, s)), anal = s => 0.35 * sstep(0.04, 0.12, s) * (1 - sstep(0.45, 0.55, s));
    const headG = grp(g);
    mk(SPH(10, 6), pho(0x2a0e0a, 30), 0.03, 0.012, 0.055, 0, -0.02, 0.02, headG);
    const jaw = grp(headG, 0, -0.024, -0.03); mk(SPH(10, 6), mM, 0.034, 0.013, 0.064, 0, -0.004, 0.044, jaw);
    for (const s of [-1, 1]) { mk(SPH(8, 6), pho(0xd8c060, 70, 0x666666), 0.0095, 0.0095, 0.0095, s * 0.034, 0.03, 0.016, headG); mk(SPH(6, 5), pho(0x080808, 90, 0x666666), 0.0062, 0.0062, 0.0062, s * 0.041, 0.031, 0.019, headG); }
    for (const s of [-1, 1]) { const nt = mk(SEG(0.6, 4), mM, 0.004, 0.014, 0.004, s * 0.014, 0.012, 0.062, headG); nt.rotation.x = 1.2; }
    const amp = rnd(0.12, 0.22), wav = rnd(1.4, 2.2), dir = Math.random() < 0.5 ? 1 : -1, ph0 = rnd(0, TAU);
    const C = [], T = new THREE.Vector3(), Nn = new THREE.Vector3(), Bn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i <= NR; i++) C.push(new THREE.Vector3());
    const c = creature(g, L, null, { headUp: rnd(0.35, 1), mouth: rnd(0.2, 0.7) });
    c.update = (dt, t) => {
      const hu = clamp(c.headUp, 0, 1);
      for (let i = 0; i <= NR; i++) {
        const s = i / NR, zz = (s - 0.62) * L, lat = dir * amp * Math.sin(s * wav * PI + ph0 + t * 0.35) * (1 - 0.6 * sstep(0.72, 1, s));
        const rise = hu * 0.42 * Math.pow(sstep(0.55, 1.0, s), 1.3);
        C[i].set(lat + (s > 0.8 ? 0.1 * Math.sin(t * 0.9 + ph0) * (s - 0.8) : 0), rad(s) * 1.05 + rise, zz);
      }
      for (let i = 0; i <= NR; i++) {
        const s = i / NR, a = C[Math.max(0, i - 1)], b1 = C[Math.min(NR, i + 1)];
        T.subVectors(b1, a).normalize(); Bn.crossVectors(T, up).normalize(); Nn.crossVectors(Bn, T).normalize();
        const r = rad(s), hw = r * 0.68, ds = dors(s), as = anal(s);
        for (let j = 0; j <= NV; j++) {
          const ang = j / NV * TAU, cx = Math.cos(ang), cy = Math.sin(ang), n = (i * (NV + 1) + j) * 3;
          const crest = cy > 0 ? ds * Math.pow(cy, 8) : as * Math.pow(-cy, 8), hh = r * 1.08 * (1 + crest);
          pos[n] = C[i].x + Bn.x * cx * hw + Nn.x * cy * hh; pos[n + 1] = C[i].y + Bn.y * cx * hw + Nn.y * cy * hh; pos[n + 2] = C[i].z + Bn.z * cx * hw + Nn.z * cy * hh;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
      const hp = C[NR - 3], hn = C[NR]; headG.position.copy(hp); headG.quaternion.setFromUnitVectors(FWD, T.subVectors(hn, hp).normalize());
      jaw.rotation.x = 0.05 + 0.34 * clamp(c.mouth, 0, 1) * (0.7 + 0.3 * Math.sin(t * 1.7 + ph0));
    };
    c.update(0, 0); geo.computeBoundingSphere();
    return c;
  }

  /* 13. ミシシッピーワニ（全長約3m・原点=おなかの接地点。setAction('yawn')） */
  function makeAlligator() {
    const g = new THREE.Group(), body = grp(g);
    const backT = tex('gatorBack', 128, 256, (c, w, h) => {
      c.fillStyle = '#15191a'; c.fillRect(0, 0, w, h);
      for (let y = 2, r = 0; y < h; y += 13, r++) for (let x = -8 + (r % 2) * 8; x < w + 8; x += 16) {
        const k = Math.abs(x - w / 2) / (w / 2); c.fillStyle = `rgb(${(rnd(34, 46) - k * 8) | 0},${(rnd(38, 50) - k * 8) | 0},${(rnd(38, 48) - k * 8) | 0})`;
        c.fillRect(x - 6.5, y, 13, 10.5);
        if (k < 0.55) { c.fillStyle = 'rgba(140,150,140,.35)'; c.fillRect(x - 1.5, y + 1.5, 3, 7.5); }
      }
      spots(c, 120, 0, w, 0, h, 0.5, 1.4, 'rgba(0,0,0,.4)');
    });
    const tailT = tex('gatorTail', 64, 128, (c, w, h) => {
      c.fillStyle = '#171b1c'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 11) { for (let x = 0; x < w; x += 9) { c.fillStyle = `rgb(${rnd(34, 46) | 0},${rnd(38, 50) | 0},${rnd(38, 48) | 0})`; c.fillRect(x + 1, y + 1, 7, 9); } }
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0.28, 'rgba(200,190,140,0)'); gr.addColorStop(0.5, 'rgba(200,190,140,.85)'); gr.addColorStop(0.72, 'rgba(200,190,140,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    const headT = tex('gatorHead', 128, 128, (c, w, h) => { c.fillStyle = '#1c2022'; c.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${rnd(40, 60) | 0},${rnd(44, 64) | 0},${rnd(44, 60) | 0},.8)`; c.beginPath(); c.arc(rnd(0, w), rnd(0, h), rnd(2, 5), 0, TAU); c.fill(); } });
    const backM = matK('gatorBackM', () => new THREE.MeshPhongMaterial({ map: backT, shininess: 70, specular: 0x4a4a4a }));
    const tailM = matK('gatorTailM', () => new THREE.MeshPhongMaterial({ map: tailT, shininess: 70, specular: 0x4a4a4a }));
    const headM = matK('gatorHeadM', () => new THREE.MeshPhongMaterial({ map: headT, shininess: 70, specular: 0x4a4a4a }));
    const dk = pho(0x262c2e, 60, 0x444444), belly = lam(0xd6cc9a), throat = lam(0xddd3a2), tooth = lam(0xf2eee0), mouthM = lam(0xe8c0a8);
    /* 胴（背中=うろこ板の模様、おなか=クリーム色） */
    const torso = mk(PHEMI(16, 6), backM, 0.28, 0.15, 0.56, 0, 0.11, 0, body);
    mk(HEMI(16, 4), belly, 0.27, 0.1, 0.54, 0, 0.11, 0, body).rotation.x = PI;
    for (const x of [-0.11, -0.04, 0.04, 0.11]) for (let z = -0.42; z <= 0.42; z += (Math.abs(x) > 0.1 ? 0.14 : 0.09)) {
      const q = 1 - (x / 0.28) ** 2 - (z / 0.56) ** 2; if (q < 0.08) continue;
      mk(HEMI(5, 2), dk, 0.02, 0.018, 0.026, x, 0.11 + 0.15 * Math.sqrt(q) - 0.007, z, body);
    }
    mk(SPH(10, 6), backM, 0.17, 0.105, 0.2, 0, 0.115, 0.53, body);
    /* 頭（幅広いU字の口先・目と鼻は上に出っぱる） */
    const head = grp(body, 0, 0.115, 0.66);
    mk(SPH(12, 6), headM, 0.135, 0.08, 0.16, 0, 0.0, 0.06, head);
    mk(SPH(12, 6), headM, 0.105, 0.048, 0.25, 0, -0.008, 0.28, head);
    mk(SPH(8, 6), headM, 0.032, 0.02, 0.028, 0, 0.026, 0.49, head);
    for (const s of [-1, 1]) {
      mk(SPH(5, 4), pho(0x050505, 40), 0.006, 0.005, 0.006, s * 0.011, 0.044, 0.5, head);
      mk(SPH(8, 6), headM, 0.034, 0.03, 0.04, s * 0.068, 0.066, 0.06, head);
      mk(SPH(6, 4), pho(0xa6a43a, 120, 0x888888), 0.016, 0.014, 0.021, s * 0.083, 0.08, 0.072, head);
      mk(SPH(6, 4), pho(0x050505, 120, 0x888888), 0.004, 0.012, 0.006, s * 0.098, 0.081, 0.077, head);
      for (let z = 0.12; z <= 0.46; z += 0.034) {
        const xx = 0.103 * Math.sqrt(Math.max(0, 1 - ((z - 0.28) / 0.25) ** 2)); if (xx < 0.02) continue;
        mk(CONE(3), tooth, 0.0055, 0.018, 0.0055, s * xx * 0.97, -0.036, z, head).rotation.x = PI;
      }
    }
    const jaw = grp(head, 0, -0.036, -0.04);
    mk(SPH(10, 6), dk, 0.118, 0.036, 0.27, 0, -0.012, 0.29, jaw);
    mk(SPH(10, 6), throat, 0.112, 0.03, 0.26, 0, -0.022, 0.28, jaw);
    mk(SPH(10, 6), mouthM, 0.09, 0.012, 0.22, 0, 0.012, 0.29, jaw);
    for (const s of [-1, 1]) for (let z = 0.14; z <= 0.46; z += 0.04) { const xx = 0.1 * Math.sqrt(Math.max(0, 1 - ((z - 0.29) / 0.26) ** 2)); if (xx < 0.02) continue; mk(CONE(3), tooth, 0.005, 0.014, 0.005, s * xx * 0.92, 0.012, z, jaw); }
    /* 脚（短く横に張り出す） */
    body.updateMatrixWorld(true);
    const end = new THREE.Vector3();
    for (const [z, len1, len2, r1, r2] of [[0.36, 0.15, 0.13, 0.045, 0.034], [-0.34, 0.18, 0.15, 0.055, 0.04]]) for (const s of [-1, 1]) {
      const L = jointLeg(body, s * 0.22, 0.09, z, s, z > 0 ? 0.55 : -0.5, [{ len: len1, a: -0.22, r: r1, mat: headM, seg: 6 }, { len: len2, a: -0.78, r: r2, mat: headM, seg: 6 }]);
      body.updateMatrixWorld(true); end.set(0, len2, 0); L.piv[1].localToWorld(end); body.worldToLocal(end);
      const foot = grp(body, end.x, 0.012, end.z); foot.rotation.y = -s * (z > 0 ? 0.55 : -0.45) * 0.6 + (s > 0 ? -0.3 : 0.3);
      mk(SPH(8, 5), headM, 0.045, 0.014, 0.06, 0, 0, 0.02, foot);
      for (let k = 0; k < 4; k++) { const toe = mk(CONE(3), dk, 0.009, 0.06, 0.006, (k - 1.5) * 0.022, 0.0, 0.05, foot); toe.rotation.set(PI / 2, 0, -(k - 1.5) * 0.25); }
    }
    /* しっぽ（左右に平たい・背に2列→1列のとさか） */
    const tail = []; let par = grp(body, 0, 0.115, -0.5); par.rotation.x = -PI / 2 - 0.06;
    const NT = 11, TL = 0.13;
    for (let i = 0; i < NT; i++) {
      const r = 0.13 * (1 - i / (NT + 0.6)) + 0.012, rn = 0.13 * (1 - (i + 1) / (NT + 0.6)) + 0.012;
      mk(SEG(+(rn / r).toFixed(2), 6), tailM, r * 0.62, TL * 1.02, r, 0, 0, 0, par);
      for (const fy of [0.3, 0.75]) {
        if (i < 6) for (const s of [-1, 1]) { const cr = mk(CONE(3), dk, 0.006, 0.03 + 0.012 * (1 - i / 6), 0.018, s * r * 0.3, TL * fy, r * 0.88, par); cr.rotation.x = PI / 2; }
        else { const cr = mk(CONE(3), dk, 0.005, 0.045 * (1 - (i - 6) / 7), 0.02, 0, TL * fy, r * 0.9, par); cr.rotation.x = PI / 2; }
      }
      tail.push(par);
      if (i < NT - 1) { const p = grp(par, 0, TL, 0); p.rotation.x = -0.008; par = p; }
    }
    let yawnT = -1, nextYawn = rnd(25, 50), swayT = 0, nextSway = rnd(5, 10);
    const c = creature(g, 3.0, (dt, t) => {
      const b = Math.sin(t * TAU / 5.5);
      torso.scale.set(0.28 * (1 + 0.012 * b), 0.15 * (1 + 0.03 * b), 0.56);
      nextYawn -= dt; if (nextYawn <= 0 && yawnT < 0) { yawnT = 0; nextYawn = rnd(30, 60); }
      if (yawnT >= 0) {
        yawnT += dt; const k = yawnT < 1.6 ? sstep(0, 1.6, yawnT) : yawnT < 3.6 ? 1 : 1 - sstep(3.6, 5.2, yawnT);
        head.rotation.x = -0.5 * k; jaw.rotation.x = 0.56 * k; if (yawnT > 5.2) { yawnT = -1; jaw.rotation.x = 0; head.rotation.x = 0; }
      }
      nextSway -= dt; if (nextSway <= 0 && swayT <= 0) { swayT = 4; nextSway = rnd(6, 14); }
      const sw = swayT > 0 ? Math.sin(PI * (1 - swayT / 4)) : 0; if (swayT > 0) swayT -= dt;
      tail.forEach((p, i) => { p.rotation.z = (0.05 + 0.1 * sw) * Math.sin(t * 1.3 - i * 0.45) * (0.3 + i * 0.07); });
    }, { setAction(a) { if (a === 'yawn' && yawnT < 0) yawnT = 0; } });
    return c;
  }

  /* ===================================================================
     D. 飾り
     =================================================================== */
  const PAL = [0xff6fa0, 0xd94fc9, 0x9b6be8, 0xc7a6ff, 0xf5d046, 0xff9a3c, 0x3fc7b8, 0x7fc55a, 0x5aa0ff, 0xe8463c];
  const pick = a => a[(Math.random() * a.length) | 0];
  const fanTex = col => tex('fan' + col, 128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#' + new THREE.Color(col).getHexString(); c.lineCap = 'round';
    const br = (x, y, a, len, wd, d) => { const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); if (d > 0) { br(x2, y2, a - rnd(0.2, 0.5), len * 0.78, wd * 0.72, d - 1); br(x2, y2, a + rnd(0.2, 0.5), len * 0.78, wd * 0.72, d - 1); } };
    br(64, 126, -PI / 2, 26, 5, 5);
    c.globalAlpha = 0.25; c.fillStyle = c.strokeStyle; c.beginPath(); c.ellipse(64, 66, 56, 54, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  });
  function coralPatch(w, d, o = {}) {
    const g = new THREE.Group(), sway = [], M = Merger(), dens = o.density ?? 1;
    const N = Math.min(220, Math.round(w * d * 7 * dens)), back = z => 1 + 0.7 * clamp(-z / (d / 2), 0, 1);
    const rndAxis = dir => new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).cross(dir).normalize();
    const col = new THREE.Color(), white = new THREE.Color(0xffffff);
    const branch = (x, z, s, color) => {
      const tip = new THREE.Color(color).lerp(white, 0.5);
      const rec = (p, dir, len, r, depth) => {
        const end = p.clone().addScaledVector(dir, len); _q.setFromUnitVectors(UP, dir);
        M.add(SEG(0.72, 4, true), _m4.compose(p, _q, _s.set(r, len, r)), color);
        if (depth === 0) { M.add(SPH(4, 2), _m4.compose(end, _q, _s.set(r * 0.9, r * 0.9, r * 0.9)), tip); return; }
        const n = 2 + (Math.random() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) { const nd = dir.clone().applyAxisAngle(rndAxis(dir), rnd(0.35, 0.8)); nd.y = Math.max(nd.y, 0.25); nd.normalize(); rec(end, nd, len * rnd(0.62, 0.82), r * 0.7, depth - 1); }
      };
      rec(V3(x, 0, z), V3(rnd(-0.2, 0.2), 1, rnd(-0.2, 0.2)).normalize(), rnd(0.13, 0.2) * s, 0.028 * s, Math.random() < 0.15 ? 3 : 2);
    };
    const brain = (x, z, s, color) => {
      const ge = once(GEO, 'ico1', () => new THREE.IcosahedronGeometry(1, 1)); const base = new THREE.Color(color), dark = base.clone().multiplyScalar(0.6);
      const tmp = ge.clone(), P = tmp.attributes.position;
      for (let i = 0; i < P.count; i++) { const x0 = P.getX(i), y0 = P.getY(i), z0 = P.getZ(i), k = 1 + 0.12 * noise3(x0, y0, z0); P.setXYZ(i, x0 * k, Math.max(-0.2, y0) * k, z0 * k); }
      tmp.computeVertexNormals();
      M.add(tmp, compose(x, -0.03 * s, z, 0.26 * s, 0.2 * s, 0.24 * s, 0, rnd(0, 6), 0), null, (cc, wx, wy, wz) => { cc.copy(base).lerp(dark, 0.5 + 0.5 * Math.sin((wx + wz) * 60 + Math.sin(wz * 40) * 2)); });
    };
    const table = (x, z, s, color) => {
      M.add(SEG(0.8, 5), compose(x, 0, z, 0.026 * s, 0.2 * s, 0.026 * s), color);
      M.add(once(GEO, 'tbl', () => { const ge = new THREE.CylinderGeometry(1, 0.85, 0.06, 14); const P = ge.attributes.position; for (let i = 0; i < P.count; i++) { const x0 = P.getX(i), z0 = P.getZ(i), r = Math.hypot(x0, z0); if (r > 0.7) P.setY(i, P.getY(i) + 0.05 * Math.sin(Math.atan2(z0, x0) * 5)); } ge.computeVertexNormals(); return ge; }), compose(x, 0.2 * s, z, 0.25 * s, s, 0.23 * s, rnd(-0.12, 0.12), 0, rnd(-0.12, 0.12)), null, (cc, wx, wy) => cc.set(color).lerp(white, wy > 0.23 * s ? 0.3 : 0));
    };
    const rock = (x, z, s) => { const sh = pick([0x7d7466, 0x8f8572, 0x6a6a5e, 0x84796a]); M.add(once(GEO, 'dod', () => new THREE.DodecahedronGeometry(1, 0)), compose(x, 0.02, z, rnd(0.18, 0.4) * s, rnd(0.1, 0.25) * s, rnd(0.16, 0.35) * s, rnd(0, 3), rnd(0, 3), rnd(0, 3)), sh); };
    const soft = (x, z, s) => {
      const SM = Merger(), cc = pick([0xff4a5a, 0xff8a3a, 0xc86ef0, 0xff7fd0, 0xffd04a]), stalk = 0xf0e6ea;
      s *= 1.5; SM.add(SEG(0.7, 5), compose(0, 0, 0, 0.022 * s, 0.14 * s, 0.022 * s), stalk);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + rnd(0, 1), e = rnd(0.3, 0.8), L = rnd(0.08, 0.15) * s, bx = Math.cos(a) * Math.sin(e), bz = Math.sin(a) * Math.sin(e), by = Math.cos(e);
        const p0 = V3(0, 0.12 * s, 0), dir = V3(bx, by, bz); _q.setFromUnitVectors(UP, dir);
        SM.add(SEG(0.6, 4, true), _m4.compose(p0, _q, _s.set(0.012 * s, L, 0.012 * s)), stalk);
        for (let k = 0; k < 6; k++) { const pp = p0.clone().addScaledVector(dir, L * rnd(0.45, 1.1)).add(V3(rnd(-0.025, 0.025) * s, rnd(-0.01, 0.035) * s, rnd(-0.025, 0.025) * s)); SM.add(SPH(4, 2), compose(pp.x, pp.y, pp.z, 0.024 * s, 0.024 * s, 0.024 * s), cc); }
      }
      const m = new THREE.Mesh(SM.build(), VC_LAM()); m.position.set(x, 0, z); g.add(m); sway.push({ m, ph: rnd(0, TAU), amp: 0.08 });
    };
    const anemone = (x, z, s) => {
      s *= 1.4; const AM = Merger(), base = pick([0xd2367a, 0xe0559a, 0x9a3fd0]), tipc = pick([0xc8f06a, 0xfff07a, 0xffb0e0]);
      AM.add(SEG(0.9, 8), compose(0, 0, 0, 0.06 * s, 0.05 * s, 0.06 * s), base);
      const disc = 0.05 * s;
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU + rnd(-0.1, 0.1), rr = rnd(0.01, 0.055) * s, L = rnd(0.05, 0.1) * s, dir = V3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();
        _q.setFromUnitVectors(UP, dir);
        AM.add(CONE(4), _m4.compose(V3(Math.cos(a) * rr, disc, Math.sin(a) * rr), _q, _s.set(0.008 * s, L, 0.008 * s)), null, (cc, wx, wy) => cc.set(base).lerp(new THREE.Color(tipc), sstep(disc, disc + 0.08 * s, wy)));
      }
      const geo = AM.build(), P = geo.attributes.position, by = Float32Array.from({ length: P.count }, (_, i) => P.getY(i)), bxA = Float32Array.from({ length: P.count }, (_, i) => P.getX(i)), bzA = Float32Array.from({ length: P.count }, (_, i) => P.getZ(i));
      const m = new THREE.Mesh(geo, VC_LAM()); m.position.set(x, 0, z); g.add(m);
      sway.push({ m, ph: rnd(0, TAU), amp: 0.03, verts: { P, by, bx: bxA, bz: bzA, disc, s } });
    };
    const fan = (x, z, s) => {
      const color = pick([0xd2405a, 0xa05ae0, 0xf0a030, 0xff6a3a]);
      const m = new THREE.Mesh(once(GEO, 'fanG', () => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)), matK('fanM' + color, () => new THREE.MeshLambertMaterial({ map: fanTex(color), alphaTest: 0.35, side: THREE.DoubleSide })));
      m.scale.set(0.55 * s, 0.5 * s, 1); m.position.set(x, 0, z); m.rotation.y = rnd(-0.4, 0.4); g.add(m); sway.push({ m, ph: rnd(0, TAU), amp: 0.1, fan: true });
    };
    const budget = o.maxTris ?? 14000; let extra = 0;
    for (let i = 0; i < N; i++) {
      if (M.count * 0.55 + extra > budget) break;
      const x = rnd(-w / 2 + 0.12, w / 2 - 0.12), z = rnd(-d / 2 + 0.12, d / 2 - 0.12), s = rnd(0.7, 1.25) * back(z), r = Math.random();
      if (r >= 0.64 && r < 0.9) extra += 280;
      if (r < 0.36) branch(x, z, s, pick(PAL));
      else if (r < 0.5) brain(x, z, s, pick([0xc9a46a, 0x9fb06a, 0xd88aa0, 0xb8c070, 0x8ab0a0, 0xe0a060]));
      else if (r < 0.54) table(x, z, s, pick([0x9aa070, 0xc8b88a, 0x8aa0b8, 0xb0c890]));
      else if (r < 0.64) rock(x, z, s);
      else if (r < 0.8) soft(x, z, s);
      else if (r < 0.9) anemone(x, z, s);
      else fan(x, Math.min(z, 0), s * 1.2);
    }
    if (M.count) g.add(new THREE.Mesh(M.build(), VC_LAM()));
    return {
      g, update(dt, t) {
        for (const S of sway) {
          if (S.verts) {
            const V = S.verts, P = V.P;
            for (let i = 0; i < P.count; i++) { const hgt = V.by[i] - V.disc; if (hgt <= 0) continue; const k = hgt * hgt * 60; P.setX(i, V.bx[i] + k * 0.02 * Math.sin(t * 1.6 + S.ph + V.bz[i] * 30)); P.setZ(i, V.bz[i] + k * 0.02 * Math.cos(t * 1.3 + S.ph + V.bx[i] * 30)); }
            P.needsUpdate = true;
          } else if (S.fan) S.m.rotation.x = S.amp * 0.5 * Math.sin(t * 0.8 + S.ph);
          else { S.m.rotation.z = S.amp * Math.sin(t * 0.9 + S.ph); S.m.rotation.x = S.amp * 0.6 * Math.sin(t * 0.7 + S.ph * 1.3); }
        }
      }
    };
  }

  /* アマモ場（ジュゴン水槽用・頂点アニメで揺れる・原点=床の中心） */
  function seagrassBed(w, d, density = 30) {
    const n = Math.min(1200, Math.round(w * d * density)), SG = 6, vpb = (SG + 1) * 2;
    const pos = new Float32Array(n * vpb * 3), base = new Float32Array(n * vpb * 3), col = new Float32Array(n * vpb * 3), wgt = new Float32Array(n * vpb), phs = new Float32Array(n * vpb), I = [];
    const dark = new THREE.Color(0x2f7a2a), light = new THREE.Color(0xa6e070), cc = new THREE.Color();
    for (let b = 0; b < n; b++) {
      const x = rnd(-w / 2, w / 2), z = rnd(-d / 2, d / 2), h = rnd(0.3, 0.9), wd = rnd(0.026, 0.042), a = rnd(0, PI), ph = rnd(0, TAU), lean = rnd(-0.12, 0.12);
      for (let s = 0; s <= SG; s++) {
        const f = s / SG, hw = wd / 2 * (s === SG ? 0.15 : 1 - 0.25 * f), y = f * h;
        for (let side = 0; side < 2; side++) {
          const n3 = ((b * vpb) + s * 2 + side), sx = side ? 1 : -1;
          base[n3 * 3] = x + Math.cos(a) * hw * sx + lean * f * f; base[n3 * 3 + 1] = y; base[n3 * 3 + 2] = z + Math.sin(a) * hw * sx;
          cc.copy(dark).lerp(light, f * 0.9 + rnd(0, 0.1)); col[n3 * 3] = cc.r; col[n3 * 3 + 1] = cc.g; col[n3 * 3 + 2] = cc.b;
          wgt[n3] = f * f * h; phs[n3] = ph;
        }
        if (s < SG) { const o = b * vpb + s * 2; I.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      }
    }
    pos.set(base);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(I); geo.computeVertexNormals();
    const g = new THREE.Group(); const m = new THREE.Mesh(geo, VC_LAM_DS()); m.frustumCulled = false; g.add(m);
    return {
      g, update(dt, t) {
        const cur = 0.12 + 0.05 * Math.sin(t * 0.35);
        for (let i = 0; i < wgt.length; i++) { const k = wgt[i]; if (k === 0) continue; const ph = phs[i]; pos[i * 3] = base[i * 3] + k * (cur + 0.08 * Math.sin(t * 1.1 + ph)); pos[i * 3 + 2] = base[i * 3 + 2] + k * 0.08 * Math.sin(t * 0.8 + ph * 1.7); pos[i * 3 + 1] = base[i * 3 + 1] * (1 - 0.06 * k); }
        geo.attributes.position.needsUpdate = true;
      }
    };
  }

  /* 氷の岩（ラッコ水槽用・静的・原点=床の中心） */
  function iceRocks(w, d) {
    const M = Merger(), lo = new THREE.Color(0xb6dcf2), hi = new THREE.Color(0xf6fbff);
    const block = (x, z, sx, sy, sz, flatTop) => {
      const tmp = once(GEO, 'iceIco', () => new THREE.IcosahedronGeometry(1, 1)).clone(), P = tmp.attributes.position;
      for (let i = 0; i < P.count; i++) { const x0 = P.getX(i), y0 = P.getY(i), z0 = P.getZ(i), k = 1 + 0.18 * (hash3(x0, y0, z0) - 0.5) * 2; P.setXYZ(i, x0 * k, Math.min(flatTop, Math.max(-0.1, y0 * k)), z0 * k); }
      tmp.computeVertexNormals();
      M.add(tmp, compose(x, 0, z, sx, sy, sz, 0, rnd(0, 6), 0), null, (cc, wx, wy) => cc.copy(lo).lerp(hi, sstep(0, sy * 0.7, wy) * 0.9 + rnd(0, 0.1)));
    };
    const nb = Math.max(3, Math.round(w / 1.2));
    for (let i = 0; i < nb; i++) block(-w / 2 + (i + 0.5) * w / nb + rnd(-0.2, 0.2), -d / 2 + rnd(0.3, 0.6), rnd(0.5, 0.9), rnd(0.35, 0.8), rnd(0.35, 0.6), rnd(0.55, 0.8));
    for (let i = 0; i < Math.max(2, Math.round(w / 2)); i++) block(rnd(-w / 2 + 0.5, w / 2 - 0.5), rnd(-d / 4, d / 4), rnd(0.4, 0.8), rnd(0.1, 0.18), rnd(0.3, 0.6), 0.6);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(M.build(), matK('iceM', () => new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 80, specular: 0x8899aa }))));
    return g;
  }

  /* 小道具: ロメインレタス（高さ約0.26m・原点=根元）/ 貝 / イカ */
  function lettuce() {
    const g = new THREE.Group();
    const lt = tex('lettuceT', 64, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const P = new Path2D(); P.moveTo(w / 2, h);
      for (let y = h; y >= 4; y -= 4) P.lineTo(w / 2 - (12 + 16 * Math.sin((h - y) / h * PI * 0.9) + 2.5 * Math.sin(y * 0.6)), y);
      for (let y = 4; y <= h; y += 4) P.lineTo(w / 2 + (12 + 16 * Math.sin((h - y) / h * PI * 0.9) + 2.5 * Math.sin(y * 0.6 + 1)), y);
      P.closePath();
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6fbf3e'); gr.addColorStop(0.6, '#a8db6a'); gr.addColorStop(1, '#e8f6c8'); c.fillStyle = gr; c.fill(P);
      c.strokeStyle = 'rgba(255,255,240,.9)'; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 10); c.stroke();
      c.strokeStyle = 'rgba(255,255,240,.5)'; c.lineWidth = 1.2; for (let y = h - 14; y > 16; y -= 12) { c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 - 18, y - 10); c.moveTo(w / 2, y); c.lineTo(w / 2 + 18, y - 10); c.stroke(); }
    });
    const lm = matK('lettuceM', () => new THREE.MeshLambertMaterial({ map: lt, alphaTest: 0.5, side: THREE.DoubleSide }));
    const lg2 = once(GEO, 'leafG', () => { const ge = new THREE.PlaneGeometry(0.09, 0.26, 2, 5); ge.translate(0, 0.13, 0); const P = ge.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i), x = P.getX(i); P.setZ(i, 0.05 * (y / 0.26) ** 2 + 0.012 * Math.cos(x / 0.045 * PI)); } ge.computeVertexNormals(); return ge; });
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(lg2, lm); m.rotation.order = 'YXZ'; m.rotation.set(-0.25 - (k % 2) * 0.12, k * PI / 3 + rnd(-0.2, 0.2), 0); m.scale.setScalar(rnd(0.85, 1.05)); g.add(m); }
    return g;
  }
  function shell() {
    const g = new THREE.Group();
    const st = tex('clamT', 64, 64, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); for (let r = 6; r < 46; r += 5) { c.strokeStyle = r % 10 ? 'rgba(150,110,70,.55)' : 'rgba(110,80,50,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(32, 62, r, PI, TAU); c.stroke(); } c.strokeStyle = 'rgba(120,90,60,.3)'; for (let a = 0; a < 12; a++) { c.beginPath(); c.moveTo(32, 62); c.lineTo(32 + Math.cos(PI + a / 11 * PI) * 50, 62 + Math.sin(PI + a / 11 * PI) * 50); c.stroke(); } });
    const sm = matK('clamM', () => new THREE.MeshPhongMaterial({ map: st, shininess: 50, specular: 0x444433 }));
    mk(PHEMI(14, 5), sm, 0.035, 0.012, 0.03, 0, 0, 0, g);
    mk(PHEMI(14, 4), sm, 0.035, 0.009, 0.03, 0, 0, 0, g).rotation.x = PI;
    return g;
  }
  function squid() {
    const g = new THREE.Group(), m = pho(0xf0d4cc, 40, 0x332222), dk = pho(0x101010, 90);
    mk(SPH(10, 8), m, 0.022, 0.022, 0.075, 0, 0, 0.0, g);
    for (const s of [-1, 1]) mk(SPH(6, 4), m, 0.028, 0.003, 0.02, s * 0.02, 0, 0.06, g).rotation.y = -s * 0.5;
    mk(SPH(8, 6), m, 0.016, 0.014, 0.02, 0, 0, -0.085, g);
    for (const s of [-1, 1]) mk(SPH(6, 4), dk, 0.005, 0.005, 0.005, s * 0.014, 0.004, -0.085, g);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, L = i < 2 ? 0.1 : rnd(0.05, 0.07); rod(V3(Math.cos(a) * 0.008, Math.sin(a) * 0.008, -0.1), V3(Math.cos(a) * 0.022, Math.sin(a) * 0.022, -0.1 - L), 0.0035, 0.001, m, 4, g); }
    return g;
  }

  /* ===================================================================
     A. 動きのコントローラ（ctl.update は c.update を呼ばない）
     =================================================================== */
  /* 水槽内を泳ぐ。B は c.g の親のローカル座標の箱。
     opts: spd(m/s) turn(rad/s) bottom(床を這う/滑る) hover(bottom時の浮き) surface(秒ごとに水面へ息つぎ)
           bank(旋回で傾く: true or 係数) circle(周回) rest:[a,b](bottom時に休む秒) restP radius(壁との余白・既定=c.len/2) pitchMul */
  function swimmer(c, B, o = {}) {
    const g = c.g, p = g.position, _t = new THREE.Vector3();
    const spd0 = (o.spd ?? 0.4) * rnd(0.75, 1.25), turn = o.turn ?? 1.2;
    const rad = o.radius ?? clamp((c.len || 0.3) * 0.5, 0.03, 1.6);
    const I = { x0: B.x0 + rad, x1: B.x1 - rad, z0: B.z0 + rad, z1: B.z1 - rad, y0: B.y0 + (o.bottom ? 0 : Math.min(rad * 0.35, 0.3)), y1: B.y1 - Math.min(rad * 0.3, 0.3) };
    for (const [a, b] of [['x0', 'x1'], ['z0', 'z1'], ['y0', 'y1']]) if (I[a] > I[b]) { const m = (I[a] + I[b]) / 2; I[a] = I[b] = m; }
    const inside = p.x >= I.x0 && p.x <= I.x1 && p.z >= I.z0 && p.z <= I.z1 && p.y >= I.y0 - 1e-6 && p.y <= I.y1 + 1e-6;
    if (!inside || (p.x === 0 && p.y === 0 && p.z === 0)) p.set(rnd(I.x0, I.x1), o.bottom ? I.y0 + (o.hover || 0) : rnd(I.y0, I.y1), rnd(I.z0, I.z1));
    const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2, rxE = Math.max(0.02, (I.x1 - I.x0) / 2 * 0.9), rzE = Math.max(0.02, (I.z1 - I.z0) / 2 * 0.9);
    let yaw = Math.atan2(cx - p.x + rnd(-0.5, 0.5), cz - p.z + rnd(-0.5, 0.5)), vy = 0, cur = 0, pitch = 0, roll = 0, pickT = 0, breathT = o.surface ? rnd(0.3, 1) * o.surface : Infinity, hold = 0;
    let circA = Math.atan2(p.z - cz, p.x - cx); const circDir = Math.random() < 0.5 ? 1 : -1;
    const ctl = { lure: null, speedMul: 1, tgt: new THREE.Vector3(), mode: 'wander', rest: 0, bounds: I, update,
      sync(y, pt = 0) { yaw = y; pitch = pt; vy = 0; cur = 0; } };   // 外から姿勢を決めたあと、向きを合わせて泳ぎに戻す
    const pickT0 = () => {
      pickT = 0;
      if (o.circle) { circA += circDir * rnd(0.45, 0.8); ctl.tgt.set(cx + Math.cos(circA) * rxE, o.bottom ? I.y0 + (o.hover || 0) : clamp(p.y + rnd(-0.4, 0.4), I.y0, I.y1), cz + Math.sin(circA) * rzE); }
      else ctl.tgt.set(rnd(I.x0, I.x1), o.bottom ? I.y0 + (o.hover || 0) : rnd(I.y0, I.y1), rnd(I.z0, I.z1));
    };
    pickT0();
    function update(dt) {
      dt = Math.min(dt, 0.1); pickT += dt;
      let tgt = ctl.tgt, spd = spd0 * ctl.speedMul;
      if (o.surface && !ctl.lure && ctl.mode === 'wander') { breathT -= dt; if (breathT <= 0) ctl.mode = 'breathe'; }
      if (ctl.lure) tgt = ctl.lure;
      else if (ctl.mode === 'breathe') {
        _t.set(clamp(p.x + Math.sin(yaw) * 0.6, I.x0, I.x1), I.y1, clamp(p.z + Math.cos(yaw) * 0.6, I.z0, I.z1)); tgt = _t;
        if (p.y > I.y1 - 0.08) { hold += dt; spd *= 0.4; if (hold > 1.4) { ctl.mode = 'wander'; hold = 0; breathT = o.surface * rnd(0.8, 1.2); pickT0(); } }
      } else if (ctl.rest > 0) { ctl.rest -= dt; spd = 0; }
      const dx = tgt.x - p.x, dy = tgt.y - p.y, dz = tgt.z - p.z, dh = Math.hypot(dx, dz);
      if (!ctl.lure && ctl.mode === 'wander' && ((dh < Math.max(0.2, rad * 0.8) && Math.abs(dy) < 0.6) || pickT > 14)) {
        pickT0(); if (o.rest && Math.random() < (o.restP ?? 0.35)) ctl.rest = rnd(o.rest[0], o.rest[1]);
      }
      if (ctl.lure) { spd *= 1.8; const d3 = Math.hypot(dx, dy, dz); if (d3 < 0.6) spd *= clamp((d3 - 0.1) / 0.5, 0, 1); }
      let hx = dh > 1e-4 ? dx / dh : Math.sin(yaw), hz = dh > 1e-4 ? dz / dh : Math.cos(yaw);
      const m = Math.max(0.15, rad + 0.3);
      const ax = p.x - I.x0 < m ? (m - (p.x - I.x0)) / m : (I.x1 - p.x < m ? -(m - (I.x1 - p.x)) / m : 0);
      const az = p.z - I.z0 < m ? (m - (p.z - I.z0)) / m : (I.z1 - p.z < m ? -(m - (I.z1 - p.z)) / m : 0);
      if (!ctl.lure) { hx += ax * 1.4; hz += az * 1.4; }
      const want = Math.atan2(hx, hz);
      let diff = want - yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const mt = turn * dt * (ctl.lure ? 2 : 1), dyaw = clamp(diff, -mt, mt); yaw += dyaw;
      cur = damp(cur, spd * (1 - 0.55 * Math.min(1, Math.abs(diff) / PI)), 2.5, dt);
      p.x += Math.sin(yaw) * cur * dt; p.z += Math.cos(yaw) * cur * dt;
      const wvy = clamp(dy * 0.9, -0.35, 0.35) * (o.bottom ? 1.6 : 1) * (ctl.mode === 'breathe' ? 1.8 : 1);
      vy = damp(vy, wvy, 2, dt); p.y += vy * dt;
      p.x = clamp(p.x, I.x0, I.x1); p.z = clamp(p.z, I.z0, I.z1); p.y = clamp(p.y, I.y0, I.y1);
      const yawRate = dyaw / Math.max(dt, 1e-4);
      const tp = o.bottom ? 0 : -Math.atan2(vy, Math.max(0.3, cur)) * (o.pitchMul ?? 1);
      pitch = damp(pitch, clamp(tp, -0.55, 0.55), 2.5, dt);
      roll = damp(roll, o.bank ? clamp(-yawRate * 0.4 * (o.bank === true ? 1 : o.bank), -0.6, 0.6) : 0, 3, dt);
      g.rotation.order = 'YXZ'; g.rotation.set(pitch, yaw, roll);
      c.moving = cur > 0.03; c.speed = cur;
    }
    return ctl;
  }
  /* 地面を歩く。A={x0,x1,z0,z1,y}。opts: spd turn wait:[a,b] arrive。ctl.target={x,z} で行き先指定、ctl.onArrive() */
  function walker(c, A, o = {}) {
    const g = c.g, p = g.position, spd0 = (o.spd ?? 0.4) * rnd(0.85, 1.15), turn = o.turn ?? 2.5, wait = o.wait || [1, 4];
    if (!(p.x >= A.x0 && p.x <= A.x1 && p.z >= A.z0 && p.z <= A.z1) || (p.x === 0 && p.z === 0)) p.set(rnd(A.x0, A.x1), A.y ?? 0, rnd(A.z0, A.z1));
    let tgt = null, waitT = rnd(0, wait[1]), cur = 0, yaw = rnd(0, TAU), timer = 0;
    const ctl = { target: null, onArrive: null, update };
    function update(dt) {
      dt = Math.min(dt, 0.1);
      let goal = ctl.target || tgt;
      if (!ctl.target && waitT > 0) { waitT -= dt; goal = null; }
      else if (!goal) { tgt = { x: rnd(A.x0, A.x1), z: rnd(A.z0, A.z1) }; goal = tgt; timer = 0; }
      let want = 0;
      if (goal) {
        const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz); timer += dt;
        if (d < (o.arrive ?? 0.15) || timer > 25) {
          const forced = !!ctl.target; ctl.target = null; tgt = null; waitT = rnd(wait[0], wait[1]); timer = 0;
          if (forced && ctl.onArrive) ctl.onArrive();
        } else {
          const wy = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(wy - yaw), Math.cos(wy - yaw));
          yaw += clamp(diff, -turn * dt, turn * dt); want = spd0 * (Math.abs(diff) < 1.0 ? 1 : 0.15) * Math.min(1, d / 0.3);
        }
      }
      cur = damp(cur, want, 4, dt);
      p.x = clamp(p.x + Math.sin(yaw) * cur * dt, A.x0, A.x1); p.z = clamp(p.z + Math.cos(yaw) * cur * dt, A.z0, A.z1);
      if (A.y !== undefined) p.y = A.y;
      g.rotation.y = yaw; c.moving = cur > 0.02; c.speed = cur;
    }
    return ctl;
  }
  /* 魚の群れ（竜巻状の輪）。makeFn(i)→creature、または makeFn=null で opts.kind のスプライトをInstancedMesh 1回描画。
     opts: kind len R(輪の半径) H(群れの高さ) spd(m/s) drift(中心の流れ 0〜1) */
  function school(n, makeFn, B, o = {}) {
    const g = new THREE.Group(), len = o.len ?? 0.18;
    const hw = (B.x1 - B.x0) / 2, hd = (B.z1 - B.z0) / 2, cx0 = (B.x0 + B.x1) / 2, cz0 = (B.z0 + B.z1) / 2, cy0 = (B.y0 + B.y1) / 2;
    const R = o.R ?? Math.max(0.2, Math.min(hw, hd) * 0.55), H = o.H ?? (B.y1 - B.y0) * 0.55, spd = o.spd ?? 0.9, drift = o.drift ?? 1;
    const ampX = Math.max(0, hw - R - len) * drift, ampZ = Math.max(0, hd - R - len) * drift, dir = Math.random() < 0.5 ? 1 : -1;
    const th = new Float32Array(n), rr = new Float32Array(n), hh = new Float32Array(n), ww = new Float32Array(n), sf = new Float32Array(n);
    for (let i = 0; i < n; i++) { th[i] = rnd(0, TAU); rr[i] = R * rnd(0.55, 1.0); hh[i] = rnd(-0.5, 0.5); ww[i] = rnd(0, TAU); sf[i] = rnd(0.9, 1.12); }
    let inst = null, members = null;
    if (!makeFn && o.kind) {
      const ge = once(GEO, 'schoolPlane', () => new THREE.PlaneGeometry(1, 0.5).rotateY(PI / 2));
      inst = new THREE.InstancedMesh(ge, spriteMat(o.kind), n); inst.frustumCulled = false;
      const col = new THREE.Color(); for (let i = 0; i < n; i++) { col.setScalar(rnd(0.85, 1.05)); inst.setColorAt(i, col); }
      g.add(inst);
    } else {
      members = []; for (let i = 0; i < n; i++) { const c = makeFn ? makeFn(i) : makeSpriteFish('iwashi', len); members.push(c); g.add(c.g); }
    }
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(len, len, len), Ps = new THREE.Vector3(), E = new THREE.Euler();
    let T = rnd(0, 100);
    const ctl = {
      g, center: new THREE.Vector3(), update(dt, t) {
        T += Math.min(dt, 0.1);
        const cx = cx0 + ampX * Math.sin(T * 0.07), cz = cz0 + ampZ * Math.sin(T * 0.053 + 1.3), cy = cy0 + (B.y1 - B.y0 - H) * 0.25 * Math.sin(T * 0.11);
        ctl.center.set(cx, cy, cz);
        for (let i = 0; i < n; i++) {
          const a = th[i] + dir * spd / R * sf[i] * T, k = hh[i] + 0.5;
          const r = rr[i] * (0.7 + 0.3 * k) + 0.06 * Math.sin(T * 1.3 + ww[i]);
          const x = clamp(cx + Math.cos(a) * r, B.x0 + len / 2, B.x1 - len / 2), z = clamp(cz + Math.sin(a) * r, B.z0 + len / 2, B.z1 - len / 2);
          const y = clamp(cy + hh[i] * H + 0.05 * Math.sin(T * 0.8 + ww[i]), B.y0, B.y1);
          const yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
          if (inst) { E.set(0, yaw + 0.14 * Math.sin(T * 9 * sf[i] + ww[i]), 0); Q.setFromEuler(E); M4.compose(Ps.set(x, y, z), Q, Sc); inst.setMatrixAt(i, M4); }
          else { const c = members[i]; c.g.position.set(x, y, z); c.g.rotation.y = yaw; c.moving = true; c.speed = spd; c.update && c.update(dt, t); }
        }
        if (inst) inst.instanceMatrix.needsUpdate = true;
      }
    };
    return ctl;
  }

  return {
    /* 生きもの */
    makeGiantIsopod, makeJellyfish, makeSeaTurtle, makeRay, makeShark, makeNautilus, makeHorseshoeCrab,
    makeCrustacean, makeIguana, makePoisonFrog, makeOctopus, makeMoray, makeAlligator,
    /* 魚スプライト */
    fishTex, makeSpriteFish, fishKinds: FISH_KINDS,
    /* 飾り・小道具 */
    coralPatch, seagrassBed, iceRocks, lettuce, shell, squid,
    /* 動き */
    swimmer, walker, school,
  };
})();
