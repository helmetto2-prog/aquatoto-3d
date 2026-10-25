/* =====================================================================
   鳥羽の生きもの（哺乳類・鳥）— 手続き生成の3Dモデル  ANIM_A
   使えるもの: THREE / rnd / clamp / ctex（コアで定義済み）
   約束: 1 = 1m、+Z = 頭の向き、+Y = 上。
     各 makeXxx() は { g, update(dt,t), ... } を返す。
     update() は体の中の動き（ひれ・しっぽ・呼吸・まばたき）だけ。
     体ごとの移動・向きは呼び出し側が g.position / g.rotation で行う。
     c.moving / c.speed(m/s) を立てると泳ぎ・歩きのテンポが変わる。
   原点: 泳ぐ動物＝体の中心 / 地面の動物＝体の真下の地面(y=0)
   ===================================================================== */
const ANIM_A = (() => {
  const PI = Math.PI, TAU = PI * 2;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const env = (t, dur, fin = 0.35, fout = 0.45) => sstep(0, fin, t) * (1 - sstep(dur - fout, dur, t));
  const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
  const bump = (t, a, b) => (t <= a || t >= b) ? 0 : Math.sin(PI * (t - a) / (b - a));   // a〜bで 0→1→0

  /* ---------------- キャッシュ（同じ色・形は全個体で共有） ---------------- */
  const MAT = new Map(), GEO = new Map(), TEX = new Map();
  const once = (m, k, fn) => { let v = m.get(k); if (v === undefined) { v = fn(); m.set(k, v); } return v; };
  const lam = c => once(MAT, 'L' + c, () => new THREE.MeshLambertMaterial({ color: c }));
  const pho = (c, sh = 60) => once(MAT, 'P' + c + '_' + sh, () => new THREE.MeshPhongMaterial({ color: c, shininess: sh, specular: 0x3a3a3a }));
  const bas = c => once(MAT, 'B' + c, () => new THREE.MeshBasicMaterial({ color: c }));
  const matK = (k, fn) => once(MAT, 'K' + k, fn);
  const lineM = c => once(MAT, 'N' + c, () => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.8 }));
  const tex = (k, w, h, fn, rx = 1, ry = 1) => once(TEX, k, () => ctex(w, h, fn, rx, ry));
  const texMat = (k, t, o = {}) => matK(k, () => o.phong
    ? new THREE.MeshPhongMaterial({ map: t, shininess: o.phong, specular: 0x2a2a2a, vertexColors: !!o.vc })
    : new THREE.MeshLambertMaterial({ map: t, vertexColors: !!o.vc }));

  /* 形 */
  const SPH = (w = 14, h = 10) => once(GEO, 's' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h));
  const SPHZ = (w = 16, h = 12) => once(GEO, 'z' + w + '_' + h, () => new THREE.SphereGeometry(1, w, h).rotateX(PI / 2)); // 極がZ向き（しわ・斑点を胴まわりに巻く用）
  const CYL = (rt, rb, h, s = 8) => once(GEO, `c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const CONE = (r, h, s = 8) => once(GEO, `k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
  /* 回転体（prof=[[半径,z],…] を尾→頭の順。+Zに沿った胴になる。u=0がおなか、u=0.5が背中） */
  function latheZ(k, prof, segs = 14) {
    return once(GEO, 'la' + k, () => {
      const g = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-4), z)), segs);
      g.rotateX(PI / 2); g.computeVertexNormals(); return g;
    });
  }
  /* 頂点カラーで背中は濃く・おなかは淡く */
  function shadeY(k, geo, top, bot, y0, y1) {
    return once(GEO, 'sh' + k, () => {
      const g = geo.clone(), p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
      const ct = new THREE.Color(top), cb = new THREE.Color(bot), c = new THREE.Color();
      for (let i = 0; i < n; i++) { c.copy(cb).lerp(ct, sstep(y0, y1, p.getY(i))); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
    });
  }
  /* 尾びれ（切れこみ付きの三日月）。付け根=原点、後ろ(-Z)へ広がる水平の板 */
  function flukeGeo(k, span, chord, thick = 0.035, notch = 0.62) {
    return once(GEO, 'fk' + k, () => {
      const s = new THREE.Shape(), h = span / 2;
      s.moveTo(0, 0.02);
      s.quadraticCurveTo(h * 0.55, 0.0, h, -chord);
      s.quadraticCurveTo(h * 0.45, -chord * 0.5, 0.012, -chord * notch);
      s.lineTo(-0.012, -chord * notch);
      s.quadraticCurveTo(-h * 0.45, -chord * 0.5, -h, -chord);
      s.quadraticCurveTo(-h * 0.55, 0.0, 0, 0.02);
      const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.45, bevelSize: thick * 0.45, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -thick / 2); g.rotateX(PI / 2); g.computeVertexNormals(); return g;
    });
  }
  /* 背びれなど縦の板（横から見た輪郭 pts=[[z,y],…]） */
  function sideFinGeo(k, fn, thick = 0.025) {
    return once(GEO, 'sf' + k, () => {
      const s = new THREE.Shape(); fn(s);
      const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.4, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -thick / 2); g.rotateY(-PI / 2); g.computeVertexNormals(); return g;
    });
  }
  /* ひげ（+X側1本ぶん。左側は scale.x=-1 で鏡写し） */
  function whiskerGeo(k, n, len, spread, droop = 0) {
    return once(GEO, 'wk' + k, () => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n - 1) - 0.5) * spread;
        pts.push(0, i * 0.006, 0, len * Math.cos(a) * 0.9, i * 0.006 + len * Math.sin(a) - droop, -len * 0.25);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
    });
  }

  /* 部品づくり */
  function E(par, rx, ry, rz, mat, x = 0, y = 0, z = 0, geo = null) {
    const m = new THREE.Mesh(geo || SPH(), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); par.add(m); return m;
  }
  function MS(par, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; }
  function P(par, x = 0, y = 0, z = 0) { const p = new THREE.Group(); p.position.set(x, y, z); par.add(p); return p; }
  function eyePair(par, r, x, y, z, col = 0x141010, hl = false) {
    const out = [];
    for (const s of [-1, 1]) {
      const e = E(par, r, r, r, pho(col, 110), s * x, y, z, SPH(10, 8)); e.userData.r = r;
      if (hl) E(e, 0.38, 0.38, 0.38, bas(0xffffff), s * 0.25, 0.42, 0.78, SPH(6, 4));
      out.push(e);
    }
    return out;
  }
  function whiskers(par, k, x, y, z, n, len, spread, col = 0xd8d0c0, droop = 0) {
    const geo = whiskerGeo(k, n, len, spread, droop);
    for (const s of [-1, 1]) { const l = new THREE.LineSegments(geo, lineM(col)); l.position.set(s * x, y, z); l.scale.x = s; par.add(l); }
  }
  /* まばたき（ときどき目を細くする） */
  function makeBlink() {
    let tt = 0, next = rnd(1.5, 5);
    return (dt, eyes) => {
      tt += dt; let k = 1;
      if (tt > next) { const u = tt - next; k = u < 0.07 ? 1 - u / 0.07 * 0.88 : u < 0.15 ? 0.12 + (u - 0.07) / 0.08 * 0.88 : 1; if (u >= 0.15) { tt = 0; next = rnd(2, 6); } }
      for (const e of eyes) e.scale.y = e.userData.r * k;
    };
  }
  /* 毛なみテクスチャ（短い線をたくさん） */
  function furTex(k, base, light, dark, w = 128, h = 128, n = 700) {
    return tex(k, w, h, g => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        g.strokeStyle = Math.random() < 0.5 ? light : dark; g.globalAlpha = rnd(0.15, 0.45); g.lineWidth = rnd(0.8, 1.6);
        const x = rnd(0, w), y = rnd(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-1, 1), y + rnd(2, 6)); g.stroke();
      }
      g.globalAlpha = 1;
    });
  }
  /* ひげの根元のぽつぽつ */
  function bristleTex(k, base, dot, n = 220) {
    return tex(k, 128, 128, g => {
      g.fillStyle = base; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < n; i++) { g.fillStyle = dot; g.globalAlpha = rnd(0.35, 0.8); g.beginPath(); g.arc(rnd(0, 128), rnd(0, 128), rnd(0.8, 1.9), 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    });
  }
  /* 回転体のz→v（UVのv）変換：模様の境目を決める用 */
  function zToV(prof, z) {
    for (let j = 0; j < prof.length - 1; j++) {
      const a = prof[j][1], b = prof[j + 1][1];
      if (z <= b) return (j + clamp((z - a) / (b - a), 0, 1)) / (prof.length - 1);
    }
    return 1;
  }

  /* =============================================================
     1. セイウチ  原点=地面（腹ばいの体の真下）  全長約3m
     setAction('kiss'|'situp'|'whistle'|'bow'|'flap')  c.busy  c.onEvent(name)
     ============================================================= */
  /* セイウチの肌：まだら＋ところどころ途切れる深いしわ（胴まわりに巻く） */
  function walrusTex(k, folds, strong) {
    return tex(k, 256, 256, (g, w, h) => {
      g.fillStyle = '#b27c63'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${140 + rnd(0, 70) | 0},${88 + rnd(0, 45) | 0},${66 + rnd(0, 35) | 0},${rnd(.06, .18)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(3, 16), rnd(2, 7)); }
      g.lineCap = 'round';
      for (let i = 0; i < folds; i++) {
        const y = rnd(0, h), x0 = rnd(0, w), len = rnd(0.25, 0.75) * w, amp = rnd(1, 3), ph = rnd(0, TAU), k2 = 2 + (Math.random() * 3 | 0);
        const lw = rnd(1, strong ? 2.6 : 1.6), a = rnd(0.18, strong ? 0.5 : 0.3);
        for (const off of [0, -w]) {
          g.strokeStyle = `rgba(92,52,38,${a})`; g.lineWidth = lw; g.beginPath();
          for (let x = 0; x <= len; x += 6) { const X = x0 + x + off, yy = y + Math.sin((x0 + x) / w * TAU * k2 + ph) * amp; x ? g.lineTo(X, yy) : g.moveTo(X, yy); }
          g.stroke();
          g.strokeStyle = `rgba(236,190,166,${a * 0.45})`; g.lineWidth = 1; g.beginPath();
          for (let x = 0; x <= len; x += 6) { const X = x0 + x + off, yy = y + lw + 1 + Math.sin((x0 + x) / w * TAU * k2 + ph) * amp; x ? g.lineTo(X, yy) : g.moveTo(X, yy); }
          g.stroke();
        }
      }
      for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(70,38,28,.35)'; g.fillRect(rnd(0, w), rnd(0, h), 1, 1); }
    });
  }
  /* 回転体のおなか側を平らにつぶす（地面に寝そべった重み） */
  function flatBelly(k, geo, yCut, f) {
    return once(GEO, 'fb' + k, () => {
      const g = geo.clone(), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < yCut) p.setY(i, yCut + (y - yCut) * f); }
      g.computeVertexNormals(); return g;
    });
  }
  function makeWalrus() {
    const skinA = texMat('walrusA', walrusTex('walrusA', 60, false), { phong: 24 });
    const skinB = texMat('walrusB', walrusTex('walrusB', 95, true), { phong: 24 });
    const mus = texMat('walrusMus', bristleTex('walrusMus', '#d9b49a', '#6b4434', 260));
    const dark = pho(0x93604c, 20);
    const PB = [[0.1, -1.45], [0.26, -1.36], [0.42, -1.15], [0.55, -0.85], [0.64, -0.5], [0.69, -0.15], [0.7, 0.15], [0.69, 0.35], [0.5, 0.5], [0.0, 0.56]];
    const PU = [[0.0, -0.42], [0.5, -0.38], [0.69, -0.25], [0.73, 0.0], [0.72, 0.25], [0.68, 0.5], [0.6, 0.7], [0.5, 0.86], [0.36, 0.98], [0.0, 1.04]];
    const g = new THREE.Group();
    const root = P(g);
    const body = P(root, 0, 0.455, 0);                       // 呼吸でふくらむ
    MS(body, flatBelly('wB', latheZ('wB', PB, 18), -0.35, 0.45), skinA).scale.set(1.1, 0.88, 1);
    const hind = [];
    for (const s of [-1, 1]) {                               // 後ろびれ（地面にぺたり）
      const hp = P(root, s * 0.13, 0.1, -1.36); hp.rotation.y = s * 0.42;
      E(hp, 0.12, 0.085, 0.16, dark, 0, 0.02, -0.04, SPH(10, 8));
      E(hp, 0.2, 0.048, 0.34, dark, 0, -0.03, -0.3, SPH(12, 8));
      hind.push(hp);
    }
    const upper = P(root, 0, 0.455, 0.2);                    // 上半身（腹筋・おじぎ）
    MS(upper, flatBelly('wU', latheZ('wU', PU, 18), -0.35, 0.45), skinB).scale.set(1.1, 0.88, 1);
    const fore = [];
    for (const s of [-1, 1]) {                               // 大きな前びれ（前・外向きに地面へ）
      const fp = P(upper, s * 0.54, -0.5, 0.5);
      E(fp, 0.13, 0.1, 0.16, dark, 0, 0.04, 0.0, SPH(10, 8));
      E(fp, 0.17, 0.05, 0.3, dark, s * 0.06, -0.01, 0.2, SPH(12, 8));
      fp.userData.s = s; fore.push(fp);
    }
    const neck = P(upper, 0, 0.12, 0.92);                    // 頭のつけね（首は太いまま頭へつながる）
    const head = P(neck);
    E(head, 0.36, 0.33, 0.33, skinB, 0, 0.04, 0.08, SPHZ(14, 10));
    for (const s of [-1, 1]) E(head, 0.2, 0.17, 0.17, mus, s * 0.135, -0.1, 0.32);   // 口ひげのふくらみ
    E(head, 0.15, 0.09, 0.12, mus, 0, -0.02, 0.38);
    const lips = E(head, 0.075, 0.055, 0.06, pho(0x7c4038, 40), 0, -0.23, 0.37);
    for (const s of [-1, 1]) {                               // 牙（先は地面にとどくくらい）
      const tp = P(head, s * 0.095, -0.22, 0.36); tp.rotation.set(-0.25, 0, s * 0.06);
      MS(tp, CYL(0.04, 0.013, 0.44, 8), pho(0xf4eddb, 55), 0, -0.22, 0);
    }
    for (const s of [-1, 1]) E(head, 0.036, 0.014, 0.025, lam(0x4e2a20), s * 0.07, 0.065, 0.43, SPH(8, 6));  // 鼻の穴
    const eyes = eyePair(head, 0.034, 0.25, 0.17, 0.18, 0x2a1810);
    whiskers(head, 'walrus', 0.23, -0.14, 0.39, 6, 0.12, 0.9, 0xe8d8c4, 0.04);

    const c = { g, busy: false, onEvent: null, moving: false, speed: 0 };
    const ACTS = { kiss: [2.6, [1.45]], situp: [3.0, [0.5, 1.4, 2.3]], whistle: [2.6, [0.55]], bow: [2.2, [0.95]], flap: [2.5, [0.6, 1.1, 1.6, 2.1]] };
    let act = null, oneSide = false; const ph = rnd(0, 9), blink = makeBlink();
    c.setAction = name => { const A = ACTS[name]; if (!A) return false; act = { name, t: 0, dur: A[0], ev: A[1].slice() }; c.busy = true; return true; };
    c.actions = Object.keys(ACTS);
    c.update = (dt, t) => {
      const br = Math.sin(t * 1.25 + ph);
      body.scale.set(1 + br * 0.012, 1 + br * 0.02, 1);
      let upX = 0, hX = Math.sin(t * 0.37 + ph) * 0.04, hY = Math.sin(t * 0.21 + ph) * 0.2, hZ = 0;
      let fx = 0, fy = 0, fz = 0, lift = 0;              // 前びれ（右基準・左は鏡写し）
      let lipZ = 1, lipS = 1, lipP = 0;
      if (act) {
        act.t += dt; const T = act.t, D = act.dur, e = env(T, D);
        while (act.ev.length && T >= act.ev[0]) { act.ev.shift(); c.onEvent && c.onEvent(act.name); }
        hY *= 1 - e;
        if (act.name === 'kiss') {
          hX -= 0.3 * e; hZ += 0.14 * e;
          const toMouth = sstep(0.2, 0.85, T) * (1 - sstep(1.3, 1.7, T)), sweep = bump(T, 1.25, 2.35);
          fx = -1.3 * toMouth - 0.8 * sweep; fy = -1.15 * toMouth + 0.85 * sweep; fz = 0.35 * sweep;
          const push = bump(T, 0.45, 1.85); lipZ = 1 + 1.8 * push; lipS = 1 - 0.3 * push; lipP = 0.06 * push;
          oneSide = true;
        } else if (act.name === 'situp') {
          const rep = (1 - Math.cos(TAU * Math.min(T, 2.7) / 0.9)) / 2;
          upX = -0.5 * rep * e; hX += 0.22 * rep * e; lift = 0.3 * rep * e;
        } else if (act.name === 'whistle') {
          hX -= 0.45 * e; const p = bump(T, 0.4, 2.2);
          lipS = 1 - 0.35 * p; lipZ = 1 + 1.4 * p + Math.sin(T * 45) * 0.25 * p; lipP = 0.05 * p;
        } else if (act.name === 'bow') {
          upX = 0.16 * e; hX += 0.6 * bump(T, 0.15, 2.0);
        } else if (act.name === 'flap') {
          const k = (T - 0.6) / 0.5, close = 0.5 + 0.5 * Math.cos(TAU * k);
          fx = -0.8 * e; fy = (-0.2 - 0.75 * close) * e; fz = 0.25 * e; hX -= 0.12 * e;
        }
        if (T >= D) { act = null; c.busy = false; oneSide = false; }
      }
      upper.rotation.x = -0.15 + upX;                       // ふだんは前びれで上半身を少し起こしている
      neck.rotation.set(hX, hY, hZ);
      for (const fp of fore) {
        const s = fp.userData.s, one = oneSide && s < 0;        // 投げキッスは右のひれだけ
        fp.rotation.set((one ? 0 : fx - lift) + 0.15 - upX * 0.6, s * (0.45 + (one ? 0 : fy)), one ? 0 : s * fz);
      }
      lips.scale.set(0.075 * lipS, 0.055 * lipS, 0.06 * lipZ); lips.position.z = 0.4 + lipP;
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     2. ジュゴン  原点=体の中心  全長2.6m
     setGraze(on)：鼻先を下げて海草をもぐもぐ
     ============================================================= */
  function makeDugong() {
    const top = 0x786e63, bot = 0xb6ab9c;
    const PF = [[0.29, -0.42], [0.35, -0.2], [0.38, 0.05], [0.37, 0.3], [0.33, 0.55], [0.29, 0.72], [0.26, 0.84], [0.21, 0.95], [0.11, 1.02], [0.0, 1.04]];
    const PR = [[0.055, -0.98], [0.08, -0.9], [0.13, -0.72], [0.2, -0.48], [0.27, -0.22], [0.31, 0.0], [0.31, 0.12], [0.28, 0.2]];
    const skin = matK('dgSkin', () => new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, shininess: 45, specular: 0x2a2a2a }));
    const headM = pho(0x8b8176, 40), finM = pho(0x6f665c, 40);
    const padM = texMat('dgPad', bristleTex('dgPad', '#6e5f52', '#e6d8c4', 200));
    const g = new THREE.Group(), root = P(g);
    MS(root, shadeY('dgF', latheZ('dgF', PF, 16), top, bot, -0.3, 0.28), skin).scale.y = 0.86;
    const tailP = P(root, 0, 0, -0.28);
    MS(tailP, shadeY('dgR', latheZ('dgR', PR, 14), top, bot, -0.25, 0.25), skin).scale.y = 0.86;
    const flukeP = P(tailP, 0, 0, -0.95);
    MS(flukeP, flukeGeo('dg', 0.95, 0.3, 0.035), finM);
    const headP = P(root, 0, 0, 0.84);
    E(headP, 0.235, 0.205, 0.22, headM, 0, 0.0, 0.08);
    const snout = E(headP, 0.215, 0.2, 0.165, headM, 0, -0.12, 0.2); snout.rotation.x = 0.55;   // ぐっと下を向いた鼻先
    const pad = E(headP, 0.175, 0.06, 0.135, padM, 0, -0.27, 0.26); pad.rotation.x = 0.35;      // 口の剛毛パッド
    const jawP = P(headP, 0, -0.25, 0.12);
    E(jawP, 0.11, 0.045, 0.1, pho(0x9c9184, 30), 0, -0.03, 0.07);
    for (const s of [-1, 1]) E(headP, 0.028, 0.013, 0.022, lam(0x3a302a), s * 0.055, 0.055, 0.27, SPH(8, 6));
    const eyes = eyePair(headP, 0.019, 0.185, 0.05, 0.1, 0x1a1410);
    const fl = [];
    for (const s of [-1, 1]) {
      const fp = P(root, s * 0.3, -0.16, 0.52); fp.rotation.set(0, s * 0.35, -s * 0.45);
      E(fp, 0.12, 0.028, 0.17, finM, s * 0.03, 0, -0.14, SPH(12, 8)); fl.push(fp);
    }
    /* c.bellyY: 原点からおなかの底まで（草をはむと鼻先はさらに約0.12m下がる） */
    const c = { g, moving: true, speed: 0.6, bellyY: -0.33 };
    let phs = rnd(0, 9), graze = 0, grazeOn = false; const blink = makeBlink();
    c.setGraze = on => { grazeOn = !!on; };
    c.update = (dt, t) => {
      graze = damp(graze, grazeOn ? 1 : 0, 2.5, dt);
      const A = (c.moving ? 1 : 0.35) * (1 - 0.55 * graze);
      phs += dt * TAU * (c.moving ? 0.55 + (c.speed || 0) * 0.6 : 0.3);
      tailP.rotation.x = 0.13 * A * Math.sin(phs);
      flukeP.rotation.x = 0.36 * A * Math.sin(phs - 0.9);
      root.rotation.x = -0.035 * A * Math.sin(phs + 0.4);
      headP.rotation.x = 0.05 * A * Math.sin(phs + 1.2) + 0.3 * graze;
      jawP.rotation.x = graze * (0.1 + 0.12 * Math.sin(t * 7));
      for (const fp of fl) fp.rotation.x = 0.14 * Math.sin(phs * 0.5) + 0.15 * graze;
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     3. アフリカマナティー  原点=体の中心  全長約3m
     setEat(on)：口を上げてレタスをもぐもぐ
     ============================================================= */
  function makeManatee() {
    const wT = tex('mnSkin', 256, 128, (g, w, h) => {          // 灰緑の肌＋うっすら藻のぽつぽつ
      g.fillStyle = '#7f8a80'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${96 + rnd(0, 46) | 0},${110 + rnd(0, 46) | 0},${98 + rnd(0, 40) | 0},${rnd(.08, .2)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(3, 14), rnd(2, 6)); }
      for (let y = 2; y < h; y += rnd(5, 10)) {
        const ph = rnd(0, TAU), k = 2 + (Math.random() * 4 | 0);
        g.strokeStyle = `rgba(52,62,54,${rnd(.18, .35)})`; g.lineWidth = rnd(0.8, 1.6);
        g.beginPath(); for (let x = 0; x <= w; x += 8) { const yy = y + Math.sin(x / w * TAU * k + ph) * 1.6; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
      }
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${70 + rnd(0, 30) | 0},${104 + rnd(0, 40) | 0},${52 + rnd(0, 20) | 0},${rnd(.18, .38)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(1.5, 6), rnd(1, 4), rnd(0, PI), 0, TAU); g.fill(); }   // 藻
      for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(60,92,48,.45)'; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); }
      for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(38,44,40,.5)'; g.fillRect(rnd(0, w), rnd(0, h), 1, 2); }
    });
    const skin = texMat('mnSkin', wT, { phong: 30, vc: true });
    const bot = 0xffffff;
    const PF = [[0.38, -0.55], [0.44, -0.3], [0.47, 0.0], [0.46, 0.3], [0.42, 0.6], [0.36, 0.84], [0.3, 0.98], [0.25, 1.08], [0.15, 1.17], [0.0, 1.2]];
    const PR = [[0.1, -0.95], [0.16, -0.85], [0.27, -0.6], [0.36, -0.3], [0.42, 0.0], [0.43, 0.15]];
    const g = new THREE.Group(), root = P(g);
    MS(root, shadeY('mnF', latheZ('mnF', PF, 16), 0xc4cbc4, bot, -0.4, 0.4), skin).scale.y = 0.84;
    const tailP = P(root, 0, 0, -0.42);
    MS(tailP, shadeY('mnR', latheZ('mnR', PR, 14), 0xc4cbc4, bot, -0.35, 0.35), skin).scale.y = 0.84;
    const padP = P(tailP, 0, 0, -0.92);
    E(padP, 0.42, 0.045, 0.37, pho(0x67736a, 30), 0, 0, -0.32, SPH(16, 8));     // まるいうちわ形の尾
    const headP = P(root, 0, 0, 1.0);
    const mz = texMat('mnMuz', bristleTex('mnMuz', '#76827a', '#2c322e', 260));
    const headM = pho(0x77827a, 28);
    E(headP, 0.27, 0.24, 0.24, headM, 0, 0, 0.06);
    const muz = P(headP, 0, -0.05, 0.2); muz.rotation.x = 0.22;
    E(muz, 0.22, 0.19, 0.16, mz, 0, 0, 0.04);
    const lipsL = E(muz, 0.11, 0.1, 0.1, mz, -0.07, -0.04, 0.14), lipsR = E(muz, 0.11, 0.1, 0.1, mz, 0.07, -0.04, 0.14);
    const chin = E(muz, 0.12, 0.06, 0.08, headM, 0, -0.17, 0.07);
    for (const s of [-1, 1]) E(muz, 0.03, 0.014, 0.02, lam(0x2a2e30), s * 0.06, 0.13, 0.11, SPH(8, 6));
    whiskers(muz, 'mn', 0.15, -0.04, 0.16, 5, 0.06, 1.0, 0xcfd3d3, 0.02);
    const eyes = eyePair(headP, 0.016, 0.205, 0.07, 0.1, 0x101010);
    const fl = [];
    for (const s of [-1, 1]) {
      const fp = P(root, s * 0.38, -0.2, 0.7); fp.rotation.set(0.2, s * 0.25, -s * 0.5);
      E(fp, 0.12, 0.035, 0.2, headM, s * 0.03, 0, -0.16, SPH(12, 8));
      for (let i = 0; i < 3; i++) E(fp, 0.016, 0.012, 0.016, lam(0xe7dfcf), s * 0.03 + (i - 1) * 0.045, 0.02, -0.34, SPH(6, 4));   // 爪
      fl.push(fp);
    }
    /* c.bellyY: 原点からおなかの底までの高さ（水底に寝かせるとき g.position.y = 底 - c.bellyY） */
    const c = { g, moving: true, speed: 0.4, bellyY: -0.4 };
    let phs = rnd(0, 9), eat = 0, eatOn = false, rest = 0, restOn = false, twT = rnd(2, 6), tw = 0; const blink = makeBlink(), ph0 = rnd(0, 9);
    c.setEat = on => { eatOn = !!on; };
    c.setRest = on => { restOn = !!on; };      // 水底でじっと休む（ひれをたたみ・尾を垂らし・ゆっくり呼吸）
    c.update = (dt, t) => {
      eat = damp(eat, eatOn ? 1 : 0, 2.2, dt);
      rest = damp(rest, restOn ? 1 : 0, 1.6, dt);
      const A = (c.moving ? 1 : 0.3) * (1 - 0.6 * eat) * (1 - rest);
      phs += dt * TAU * (c.moving ? 0.35 + (c.speed || 0) * 0.5 : 0.25) * (1 - 0.9 * rest);
      tailP.rotation.x = 0.1 * A * Math.sin(phs) - 0.1 * rest;
      padP.rotation.x = 0.28 * A * Math.sin(phs - 0.8) - 0.14 * rest;
      const br = 0.5 - 0.5 * Math.cos(t * 0.6 + ph0);                  // 休んでいるときのゆっくりした呼吸（約10秒）
      root.rotation.x = -0.03 * A * Math.sin(phs + 0.4);
      root.scale.set(1 + 0.012 * rest * br, 1 + 0.03 * rest * br, 1);
      root.position.y = 0.012 * rest * br;
      twT -= dt; if (twT <= 0) { twT = rnd(3, 8); tw = 0.5; }            // ときどき鼻先・ひげがぴくっ
      let twitch = 0; if (tw > 0) { tw -= dt; twitch = Math.sin((0.5 - tw) * 30) * bump(0.5 - tw, 0, 0.5); }
      headP.rotation.x = 0.04 * Math.sin(phs + 1) * A - 0.38 * eat + 0.07 * rest;
      muz.rotation.x = 0.22 + 0.07 * twitch * (0.4 + rest);
      const chew = eat * (0.5 + 0.5 * Math.sin(t * 6.5));
      const tl = 0.12 * Math.abs(twitch) * (0.4 + rest);
      lipsL.scale.y = lipsR.scale.y = 0.1 * (1 + 0.25 * chew + tl); lipsL.position.x = -0.07 - 0.015 * chew; lipsR.position.x = 0.07 + 0.015 * chew;
      chin.rotation.x = 0.25 * chew;
      for (const fp of fl) {
        const s = Math.sign(fp.position.x);
        fp.rotation.x = (0.2 + 0.12 * Math.sin(phs * 0.5) * (1 - rest)) * (1 - 0.6 * rest) - 0.9 * eat + 0.7 * rest;
        fp.rotation.y = s * (0.25 - 0.55 * eat - 0.15 * rest);
        fp.rotation.z = -s * (0.5 - 0.35 * rest);
      }
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     4. ラッコ  原点=体の中心  全長1.2m（しっぽ込み）
     setMode('back'|'swim'|'dive')（はじめは'back'＝あおむけで浮く）
     setAction('groom'|'crack'|'roll')  c.holdShell=true で貝を胸に
     ============================================================= */
  function makeSeaOtter() {
    const furT = furTex('otterFur', '#4a3426', '#6e5038', '#2c1e15', 128, 128, 800);
    const fur = texMat('otterFur', furT);
    const faceM = texMat('otterFace', furTex('otterFace', '#d6cab4', '#efe7d8', '#a8987e', 64, 64, 260));
    const pawM = lam(0x2e221a), noseM = pho(0x161210, 90);
    const g = new THREE.Group(), root = P(g);
    E(root, 0.17, 0.15, 0.38, fur, 0, 0, -0.02, SPHZ());                      // 胴
    E(root, 0.145, 0.125, 0.16, faceM, 0, -0.035, 0.26, SPHZ(12, 8));         // 白っぽい胸・のど
    const headP = P(root, 0, 0.02, 0.38);
    E(headP, 0.105, 0.098, 0.105, faceM, 0, 0.03, 0.07);
    for (const s of [-1, 1]) E(headP, 0.048, 0.037, 0.042, faceM, s * 0.032, -0.005, 0.155);   // ひげ袋
    E(headP, 0.027, 0.02, 0.02, noseM, 0, 0.026, 0.188, SPH(8, 6));                          // 鼻
    for (const s of [-1, 1]) E(headP, 0.022, 0.022, 0.012, fur, s * 0.078, 0.1, 0.035, SPH(8, 6));  // 耳
    const eyes = eyePair(headP, 0.0145, 0.052, 0.065, 0.135, 0x0e0c0a);
    whiskers(headP, 'otter', 0.05, 0.0, 0.17, 5, 0.075, 0.8, 0xf0ece4, 0.015);
    const paws = [];
    for (const s of [-1, 1]) {
      const pp = P(root, s * 0.11, -0.06, 0.28);
      E(pp, 0.035, 0.035, 0.08, fur, 0, 0, 0.06, SPH(8, 6));
      E(pp, 0.036, 0.03, 0.036, pawM, 0, 0, 0.13, SPH(8, 6));
      pp.userData.s = s; paws.push(pp);
    }
    const feet = [];
    for (const s of [-1, 1]) {
      const fp = P(root, s * 0.08, -0.02, -0.33);
      E(fp, 0.065, 0.016, 0.11, pawM, s * 0.02, 0, -0.1, SPH(10, 6));        // 水かきのある大きな後ろ足
      fp.userData.s = s; feet.push(fp);
    }
    const tailP = P(root, 0, 0, -0.37);
    E(tailP, 0.065, 0.022, 0.16, fur, 0, 0, -0.14, SPH(10, 6));             // ひらたいしっぽ
    const shell = E(root, 0.045, 0.02, 0.04, pho(0x9a8a72, 30), 0, -0.17, 0.13, SPH(10, 6));  // 胸の上の貝（あおむけ時は上を向く）
    shell.visible = false;

    const c = { g, moving: false, speed: 0, busy: false, holdShell: false, mode: 'back' };
    const POSE = {
      back: { roll: PI, pitch: 0, head: 1.62, paw: 2.05, pawY: 0.42, foot: -0.95, tail: -0.25 },
      swim: { roll: 0, pitch: 0, head: -0.18, paw: 1.25, pawY: 0.1, foot: 0.25, tail: 0 },
      dive: { roll: 0, pitch: 0.65, head: 0.1, paw: 1.35, pawY: 0.1, foot: 0.25, tail: 0 },
    };
    const cur = Object.assign({}, POSE.back);
    let act = null, phs = rnd(0, 9), rollOff = 0; const blink = makeBlink(), ph0 = rnd(0, 9);
    c.setMode = m => { if (POSE[m]) c.mode = m; };
    c.setAction = name => { const D = { groom: 3.2, crack: 3.0, roll: 1.3 }[name]; if (!D) return false; act = { name, t: 0, dur: D }; c.busy = true; return true; };
    c.update = (dt, t) => {
      const tg = POSE[c.mode] || POSE.back;
      for (const k in tg) cur[k] = damp(cur[k], tg[k], 3.2, dt);
      let headX = cur.head, headY = Math.sin(t * 0.5 + ph0) * 0.15, headZ = 0, pawX = cur.paw, pawXL = 0, pawXR = 0, pawY = cur.pawY;
      let showShell = c.holdShell;
      const swimming = c.mode !== 'back';
      phs += dt * TAU * (swimming ? 1.3 + (c.speed || 0) * 1.5 : 0.5);
      let footA = swimming ? 0.55 : 0.12, tailA = swimming ? 0.3 : 0.08;
      if (act) {
        act.t += dt; const T = act.t, e = env(T, act.dur);
        if (act.name === 'groom') {
          pawXL = (-0.75 + 0.35 * Math.sin(T * 9)) * e; pawXR = (-0.75 + 0.35 * Math.sin(T * 9 + PI)) * e;
          headY += Math.sin(T * 4) * 0.25 * e; headZ = Math.sin(T * 3) * 0.2 * e;
        } else if (act.name === 'crack') {
          showShell = true; headX += 0.3 * e;
          const hit = Math.max(0, Math.sin(T * 14)); pawXL = pawXR = (-0.2 + 0.35 * hit) * e; pawY *= 1 - 0.7 * e;
        } else if (act.name === 'roll') {
          rollOff = TAU * sstep(0, act.dur, T);
        }
        if (T >= act.dur) { act = null; c.busy = false; rollOff = 0; }
      }
      root.rotation.set(cur.pitch, 0, cur.roll + rollOff);
      root.position.y = (c.mode === 'back' ? 0 : 0) + Math.sin(t * 1.1 + ph0) * 0.008;
      headP.rotation.set(headX, headY, headZ);
      for (const pp of paws) {
        const s = pp.userData.s; pp.rotation.set(pawX + (s < 0 ? pawXL : pawXR), s * -pawY, 0);
      }
      for (const fp of feet) { const s = fp.userData.s; fp.rotation.set(cur.foot + footA * Math.sin(phs + (s < 0 ? 0 : PI)), s * 0.15, 0); }
      tailP.rotation.x = cur.tail + tailA * Math.sin(phs * 0.8);
      shell.visible = showShell;
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     5. ケープペンギン  原点=足もと  身長0.6m
     c.moving=true でよちよち歩き
     ============================================================= */
  function makePenguin() {
    const bodyT = tex('pgBody', 256, 256, (g, w, h) => {
      g.fillStyle = '#17171b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5f4ef'; g.beginPath(); g.ellipse(64, 178, 50, 104, 0, 0, TAU); g.fill();       // 白いおなか（u=0.25が前）
      g.strokeStyle = '#17171b'; g.lineWidth = 9; g.beginPath(); g.ellipse(64, 205, 42, 108, 0, PI, TAU); g.stroke();  // 胸の黒い帯
      g.fillStyle = '#17171b';
      for (let i = 0; i < 46; i++) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()); const x = 64 + Math.cos(a) * r * 34, y = 175 + Math.sin(a) * r * 60; if (y > 115) { g.beginPath(); g.arc(x, y, rnd(1.2, 2.6), 0, TAU); g.fill(); } }
      g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 300; i++) g.fillRect(rnd(0, w), rnd(0, h), 2, 1);
    });
    const headT = tex('pgHead', 128, 128, (g, w, h) => {
      g.fillStyle = '#17171b'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f5f4ef'; g.lineWidth = 7; g.lineCap = 'round';
      for (const s of [-1, 1]) {           // くちばしの根元→目の上→頬・首のわきへ回る白い帯（前はu=0.25→x=32）
        g.beginPath(); g.moveTo(32 + s * 3, 40); g.quadraticCurveTo(32 + s * 13, 26, 32 + s * 17, 56); g.quadraticCurveTo(32 + s * 19, 92, 32 + s * 14, 128); g.stroke();
        g.fillStyle = '#ee8a94'; g.beginPath(); g.ellipse(32 + s * 9, 48, 5.5, 4.5, 0, 0, TAU); g.fill();   // 目の上のピンクの肌
      }
    });
    const bodyM = texMat('pgBody', bodyT, { phong: 30 }), headM = texMat('pgHead', headT, { phong: 30 });
    const blk = lam(0x17171b), footM = lam(0xcf9a92);
    const g = new THREE.Group();
    const bodyP = P(g, 0, 0.03, 0);
    E(bodyP, 0.155, 0.245, 0.15, bodyM, 0, 0.25, 0, SPH(16, 12));
    E(bodyP, 0.05, 0.03, 0.08, blk, 0, 0.06, -0.14, SPH(8, 6)).rotation.x = 0.6;           // しっぽ
    const headP = P(bodyP, 0, 0.47, 0.015);
    E(headP, 0.082, 0.086, 0.088, headM, 0, 0.03, 0, SPH(14, 10));
    const bill = MS(headP, CONE(0.017, 0.075, 6), lam(0x1b1b1b), 0, 0.02, 0.112); bill.rotation.x = PI / 2 + 0.12;
    const eyes = eyePair(headP, 0.011, 0.052, 0.042, 0.062, 0x0a0a0a);
    const flips = [];
    for (const s of [-1, 1]) {
      const fp = P(bodyP, s * 0.14, 0.38, 0.0);
      E(fp, 0.016, 0.115, 0.048, blk, s * 0.012, -0.1, 0, SPH(10, 6));
      fp.userData.s = s; flips.push(fp);
    }
    const feet = [];
    for (const s of [-1, 1]) {
      const fp = P(g, s * 0.065, 0.03, 0.05);
      E(fp, 0.042, 0.014, 0.066, footM, 0, -0.016, 0.035, SPH(8, 6));
      fp.userData.s = s; feet.push(fp);
    }
    const c = { g, moving: false, speed: 0.4 };
    let phs = rnd(0, 9), idleT = rnd(1, 3), look = 0, lookT = 0, flapT = 0, preenT = 0; const blink = makeBlink();
    c.update = (dt, t) => {
      const mv = c.moving;
      if (mv) phs += dt * TAU * (2.2 + (c.speed || 0) * 2.0);
      const w = mv ? Math.sin(phs) : 0;
      bodyP.rotation.z = 0.16 * w;
      bodyP.position.y = 0.03 + (mv ? 0.012 * Math.abs(Math.sin(phs)) : 0);
      bodyP.rotation.x = mv ? 0.06 : 0;
      for (const f of feet) {
        const s = f.userData.s, up = mv ? Math.max(0, s * w) : 0;
        f.position.y = 0.03 + 0.03 * up; f.rotation.x = -0.45 * up;
      }
      idleT -= dt;
      if (idleT <= 0) { idleT = rnd(1.5, 4); const r = Math.random(); if (r < 0.5) { look = rnd(-0.8, 0.8); } else if (r < 0.75) flapT = 0.7; else if (!mv) preenT = 1.4; }
      lookT = damp(lookT, mv ? 0 : look, 3, dt);
      let flapA = mv ? 0.45 : 0.08;
      if (flapT > 0) { flapT -= dt; flapA = 0.5 + 0.5 * Math.abs(Math.sin(flapT * 22)); }
      let px = 0, pz = 0;
      if (preenT > 0) { preenT -= dt; const k = bump(1.4 - preenT, 0, 1.4); px = 0.7 * k; pz = 0.5 * k; }
      headP.rotation.set(px + (mv ? 0.05 * Math.sin(phs * 2) : 0), lookT, pz);
      for (const f of flips) f.rotation.set(0, 0, f.userData.s * flapA);
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     6. ハイイロアザラシ  原点=体の中心  全長2m（耳たぶ無し・ローマ鼻）
     ============================================================= */
  function makeGraySeal() {
    const T = tex('sealSkin', 256, 128, (g, w, h) => {
      g.fillStyle = '#9ba1a5'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(52,58,64,${rnd(.45, .85)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(3, 10), rnd(2, 6), rnd(0, PI), 0, TAU); g.fill(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(210,214,216,.35)'; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(3, 9), rnd(2, 5), rnd(0, PI), 0, TAU); g.fill(); }
    });
    const skin = texMat('sealSkin', T, { phong: 70, vc: true });
    const PF = [[0.27, -0.35], [0.31, -0.1], [0.32, 0.1], [0.3, 0.35], [0.24, 0.55], [0.18, 0.7], [0.15, 0.78]];
    const PR = [[0.04, -0.88], [0.08, -0.8], [0.15, -0.6], [0.22, -0.35], [0.28, -0.1], [0.3, 0.05], [0.3, 0.12]];
    const hd = pho(0x868c90, 70), dk = pho(0x50565b, 60);
    const g = new THREE.Group(), root = P(g);
    MS(root, shadeY('slF', latheZ('slF', PF, 16), 0x8f9599, 0xe9ecec, -0.25, 0.25), skin);
    const rearP = P(root, 0, 0, -0.22);
    MS(rearP, shadeY('slR', latheZ('slR', PR, 14), 0x8f9599, 0xe9ecec, -0.2, 0.2), skin);
    const hindP = P(rearP, 0, 0, -0.86);
    for (const s of [-1, 1]) { const h = E(hindP, 0.022, 0.13, 0.19, dk, s * 0.045, 0, -0.15, SPH(10, 8)); h.rotation.y = s * 0.12; }
    const headP = P(root, 0, 0.02, 0.72);
    E(headP, 0.145, 0.14, 0.17, hd, 0, 0.03, 0.08);
    E(headP, 0.098, 0.1, 0.17, hd, 0, 0.0, 0.26);                 // 長いマズル
    E(headP, 0.072, 0.05, 0.13, hd, 0, 0.075, 0.25);              // ローマ鼻のふくらみ
    E(headP, 0.062, 0.052, 0.035, dk, 0, 0.02, 0.41, SPH(10, 6));  // 鼻先
    for (const s of [-1, 1]) E(headP, 0.012, 0.022, 0.01, lam(0x1c1f22), s * 0.022, 0.035, 0.44, SPH(6, 4));
    const eyes = eyePair(headP, 0.03, 0.098, 0.085, 0.15, 0x0b0b0c);
    whiskers(headP, 'seal', 0.08, -0.01, 0.34, 6, 0.11, 0.9, 0xe7e4dc, 0.02);
    const fl = [];
    for (const s of [-1, 1]) {
      const fp = P(root, s * 0.25, -0.17, 0.45); fp.rotation.set(0.3, s * 0.35, -s * 0.4);
      E(fp, 0.06, 0.025, 0.13, dk, s * 0.02, 0, -0.09, SPH(10, 6)); fl.push(fp);
    }
    const c = { g, moving: true, speed: 0.8 };
    let phs = rnd(0, 9); const blink = makeBlink();
    c.update = (dt, t) => {
      phs += dt * TAU * (c.moving ? 0.7 + (c.speed || 0) * 0.7 : 0.25);
      const A = c.moving ? 1 : 0.3;
      rearP.rotation.y = 0.22 * A * Math.sin(phs);
      hindP.rotation.y = 0.42 * A * Math.sin(phs - 0.9);
      headP.rotation.y = -0.07 * A * Math.sin(phs + 0.3);
      headP.rotation.x = Math.sin(t * 0.4) * 0.04;
      for (const fp of fl) fp.rotation.x = 0.3 + 0.1 * Math.sin(phs * 0.5);
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     7. イロワケイルカ（パンダイルカ）  原点=体の中心  全長1.4m
     ============================================================= */
  function makeCommersonDolphin() {
    const PF = [[0.19, -0.25], [0.215, -0.05], [0.22, 0.12], [0.21, 0.3], [0.185, 0.45], [0.15, 0.57], [0.1, 0.66], [0.05, 0.71], [0.0, 0.72]];
    const PR = [[0.035, -0.62], [0.045, -0.55], [0.08, -0.4], [0.13, -0.22], [0.18, -0.05], [0.2, 0.05], [0.2, 0.12]];
    const W = '#f4f5f2', K = '#141517';
    const tF = tex('dolF', 128, 128, (g, w, h) => {   // u=0がおなか・0.5が背中 / v=尾→頭
      const Y = v => (1 - v) * h;
      g.fillStyle = W; g.fillRect(0, 0, w, h);
      const vHead = zToV(PF, 0.33), vSad = zToV(PF, -0.02);
      g.fillStyle = K; g.fillRect(0, 0, w, Y(vHead) + 3);                      // 黒い頭
      g.fillStyle = W; g.beginPath(); g.ellipse(0, Y(zToV(PF, 0.5)), 16, 9, 0, 0, TAU); g.ellipse(w, Y(zToV(PF, 0.5)), 16, 9, 0, 0, TAU); g.fill();  // のどの白
      g.fillStyle = K; g.beginPath(); g.ellipse(w / 2, h, w * 0.3, h - Y(vSad), 0, 0, TAU); g.fill();    // 背びれまわりの黒いくら
    });
    const tR = tex('dolR', 128, 128, (g, w, h) => {
      const Y = v => (1 - v) * h;
      g.fillStyle = K; g.fillRect(0, 0, w, h);
      g.fillStyle = W; const v0 = zToV(PR, -0.3);
      g.beginPath(); g.ellipse(0, 0, w * 0.2, Y(v0), 0, 0, TAU); g.ellipse(w, 0, w * 0.2, Y(v0), 0, 0, TAU); g.fill();   // おなか側の白
    });
    const mF = texMat('dolF', tF, { phong: 80 }), mR = texMat('dolR', tR, { phong: 80 }), blk = pho(0x161719, 80);
    const g = new THREE.Group(), root = P(g);
    MS(root, latheZ('dolF', PF, 16), mF);
    const tailP = P(root, 0, 0, -0.15);
    MS(tailP, latheZ('dolR', PR, 14), mR);
    const flukeP = P(tailP, 0, 0, -0.6);
    MS(flukeP, flukeGeo('dol', 0.4, 0.15, 0.02, 0.7), blk);
    MS(root, sideFinGeo('dolD', s => { s.moveTo(0.07, 0); s.quadraticCurveTo(0.05, 0.13, -0.03, 0.125); s.quadraticCurveTo(-0.1, 0.12, -0.1, 0); s.lineTo(0.07, 0); }, 0.025), blk, 0, 0.18, -0.06);
    const fl = [];
    for (const s of [-1, 1]) {
      const fp = P(root, s * 0.16, -0.09, 0.36); fp.rotation.set(0.2, s * 0.5, -s * 0.5);
      E(fp, 0.06, 0.018, 0.09, blk, 0, 0, -0.06, SPH(10, 6)); fl.push(fp);
    }
    const c = { g, moving: true, speed: 2.0 };
    let phs = rnd(0, 9);
    c.update = (dt, t) => {
      phs += dt * TAU * (c.moving ? 1.1 + (c.speed || 0) * 0.6 : 0.4);
      const A = c.moving ? 1 : 0.35;
      tailP.rotation.x = 0.16 * A * Math.sin(phs);
      flukeP.rotation.x = 0.42 * A * Math.sin(phs - 0.9);
      root.rotation.x = -0.03 * A * Math.sin(phs + 0.5);
      for (const fp of fl) fp.rotation.x = 0.2 + 0.08 * Math.sin(phs);
    };
    return c;
  }

  /* =============================================================
     8. コツメカワウソ  原点=体の中心  全長0.8m（しっぽ込み）
     setMode('swim'|'walk')  歩くときは g.position.y = 地面 - c.footY
     ============================================================= */
  function makeSmallOtter() {
    const fur = texMat('koFur', furTex('koFur', '#6e4b33', '#8c6646', '#4a301f', 128, 64, 500));
    const pale = lam(0xd6be9a), dk = lam(0x3c2a1d);
    const g = new THREE.Group(), root = P(g);
    E(root, 0.075, 0.07, 0.2, fur, 0, 0, 0, SPHZ(14, 10));
    E(root, 0.06, 0.06, 0.09, fur, 0, 0.015, 0.17, SPH(10, 8));
    E(root, 0.045, 0.034, 0.075, pale, 0, -0.028, 0.2, SPH(10, 6));        // 明るいのど
    const headP = P(root, 0, 0.03, 0.25);
    E(headP, 0.056, 0.05, 0.06, fur, 0, 0.01, 0.04, SPH(12, 8));
    E(headP, 0.036, 0.027, 0.035, pale, 0, -0.012, 0.09, SPH(10, 6));
    E(headP, 0.015, 0.01, 0.01, pho(0x111111, 90), 0, 0.006, 0.122, SPH(6, 4));
    for (const s of [-1, 1]) E(headP, 0.013, 0.013, 0.006, fur, s * 0.045, 0.04, 0.0, SPH(6, 4));
    const eyes = eyePair(headP, 0.009, 0.03, 0.026, 0.075, 0x0a0a0a);
    whiskers(headP, 'ko', 0.025, -0.01, 0.1, 4, 0.04, 0.7, 0xe8e0d0, 0.008);
    const legs = [];
    for (const [x, z] of [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]]) {
      const lp = P(root, x, -0.035, z);
      E(lp, 0.02, 0.045, 0.02, fur, 0, -0.035, 0, SPH(8, 6));
      E(lp, 0.022, 0.01, 0.03, dk, 0, -0.075, 0.01, SPH(8, 4));
      lp.userData.front = z > 0; lp.userData.s = Math.sign(x); legs.push(lp);
    }
    const t1 = P(root, 0, 0, -0.19), t2 = P(t1, 0, 0, -0.12), t3 = P(t2, 0, 0, -0.1);
    E(t1, 0.045, 0.04, 0.07, fur, 0, 0, -0.06, SPH(10, 6));
    E(t2, 0.03, 0.028, 0.06, fur, 0, 0, -0.05, SPH(8, 6));
    E(t3, 0.017, 0.016, 0.05, fur, 0, 0, -0.04, SPH(8, 6));
    const c = { g, moving: true, speed: 0.6, mode: 'swim', footY: -0.12 };
    let phs = rnd(0, 9), sw = 1; const blink = makeBlink();
    c.setMode = m => { if (m === 'swim' || m === 'walk') c.mode = m; };
    c.update = (dt, t) => {
      sw = damp(sw, c.mode === 'swim' ? 1 : 0, 4, dt);
      const mv = c.moving;
      phs += dt * TAU * (mv ? (c.mode === 'swim' ? 1.6 : 2.2) + (c.speed || 0) * 1.4 : 0.4);
      const s1 = Math.sin(phs);
      for (const lp of legs) {
        const diag = (lp.userData.front ? 1 : -1) * lp.userData.s;
        const walkA = mv ? 0.55 * s1 * diag : 0;
        const swimX = lp.userData.front ? 1.1 : 1.35 + (mv ? 0.45 * Math.sin(phs + (lp.userData.s > 0 ? 0 : PI)) : 0);
        lp.rotation.x = walkA * (1 - sw) + swimX * sw;
      }
      root.position.y = (1 - sw) * (mv ? 0.01 * Math.abs(Math.cos(phs)) : 0);
      const u = sw * (mv ? 0.25 : 0.08);
      t1.rotation.set(u * Math.sin(phs - 0.6), (1 - sw) * 0.25 * Math.sin(phs * 0.5), 0);
      t2.rotation.set(u * 1.2 * Math.sin(phs - 1.2), (1 - sw) * 0.2 * Math.sin(phs * 0.5 - 0.6), 0);
      t3.rotation.set(u * 1.4 * Math.sin(phs - 1.8), 0, 0);
      root.rotation.x = sw * (mv ? 0.06 * Math.sin(phs) : 0);
      headP.rotation.set(-0.15 * sw + (1 - sw) * 0.05 * Math.sin(phs * 2), Math.sin(t * 0.7) * 0.25 * (mv ? 0.3 : 1), 0);
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     9. ペリカン  原点=足もと  高さ約1.5m
     ============================================================= */
  function makePelican() {
    const wh = lam(0xf6eee8), blk = lam(0x262626), billM = pho(0xf0b23c, 50), pouchM = pho(0xf09a3a, 40), legM = lam(0xeea052);
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      MS(g, CYL(0.026, 0.03, 0.3, 6), legM, s * 0.085, 0.15, 0);
      E(g, 0.065, 0.012, 0.075, legM, s * 0.085, 0.012, 0.045, SPH(8, 4));
    }
    const bodyP = P(g, 0, 0.6, -0.03); bodyP.rotation.x = -0.22;
    E(bodyP, 0.23, 0.26, 0.42, wh, 0, 0, 0, SPH(16, 12));
    E(bodyP, 0.11, 0.045, 0.13, wh, 0, -0.08, -0.43, SPH(10, 6));
    const wings = [];
    for (const s of [-1, 1]) {
      const wp = P(bodyP, s * 0.2, 0.1, 0.12);
      E(wp, 0.05, 0.17, 0.38, wh, s * 0.02, -0.04, -0.18, SPH(12, 8));
      E(wp, 0.04, 0.1, 0.25, blk, s * 0.02, -0.08, -0.48, SPH(10, 6));
      wp.userData.s = s; wings.push(wp);
    }
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.76, 0.24), new THREE.Vector3(0, 0.95, 0.33), new THREE.Vector3(0, 1.13, 0.23), new THREE.Vector3(0, 1.3, 0.27)]);
    MS(g, once(GEO, 'pelNeck', () => new THREE.TubeGeometry(neck, 12, 0.062, 7, false)), wh);
    const headP = P(g, 0, 1.33, 0.28);
    E(headP, 0.072, 0.072, 0.092, wh, 0, 0, 0, SPH(12, 8));
    E(headP, 0.03, 0.05, 0.06, lam(0xf3e2a8), 0, 0.05, -0.06, SPH(8, 6));
    for (const s of [-1, 1]) E(headP, 0.022, 0.022, 0.01, lam(0xf2b8a8), s * 0.058, 0.015, 0.03, SPH(8, 4));
    const eyes = eyePair(headP, 0.012, 0.064, 0.015, 0.032, 0x1a1a1a);
    const billP = P(headP, 0, -0.01, 0.07); billP.rotation.x = 0.16;
    E(billP, 0.03, 0.018, 0.22, billM, 0, 0, 0.2, SPH(10, 6));
    E(billP, 0.016, 0.014, 0.02, pho(0xe0603a, 40), 0, -0.012, 0.405, SPH(6, 4));
    const lowP = P(billP, 0, -0.015, 0.0);
    E(lowP, 0.045, 0.062, 0.2, pouchM, 0, -0.058, 0.18, SPH(12, 8)).rotation.x = 0.12;     // のどぶくろ
    const c = { g, moving: false, speed: 0 };
    let idleT = rnd(1, 3), look = 0, lk = 0, stretchT = 0, clapT = 0; const blink = makeBlink();
    c.update = (dt, t) => {
      idleT -= dt;
      if (idleT <= 0) { idleT = rnd(2, 5); const r = Math.random(); if (r < 0.5) look = rnd(-0.9, 0.9); else if (r < 0.75) stretchT = 2.4; else clapT = 1.0; }
      lk = damp(lk, look, 2.5, dt);
      headP.rotation.set(Math.sin(t * 0.6) * 0.05, lk, 0);
      let wOpen = 0; if (stretchT > 0) { stretchT -= dt; wOpen = bump(2.4 - stretchT, 0, 2.4); }
      for (const wp of wings) { const s = wp.userData.s; wp.rotation.set(0, s * 0.35 * wOpen, s * 1.25 * wOpen); }
      let clap = 0; if (clapT > 0) { clapT -= dt; clap = Math.max(0, Math.sin(clapT * 18)) * 0.35; }
      lowP.rotation.x = clap;
      bodyP.position.y = 0.6 + Math.sin(t * 1.2) * 0.005;
      blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     10. スナドリネコ  原点=足もと  体長0.75m
     c.moving=true で歩く／止まると見回し・ときどきおすわり
     ============================================================= */
  function makeFishingCat() {
    const bodyT = tex('catBody', 256, 128, (g, w, h) => {      // SPHZ：x=胴まわり(u=0.25おなか/0.75背中)・y=頭→しっぽ
      g.fillStyle = '#9a937d'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(225,215,190,.6)'; g.fillRect(40, 0, 48, h);                    // おなかは明るめ
      for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(190,182,160,.3)' : 'rgba(80,74,60,.25)'; g.fillRect(rnd(0, w), rnd(0, h), 1, rnd(2, 5)); }
      g.fillStyle = '#3a342b';
      for (let row = 0; row < 8; row++) for (let i = 0; i < 16; i++) {
        const x = (i + (row % 2) * 0.5) * w / 16 + rnd(-3, 3), y = 8 + row * 15 + rnd(-3, 3);
        if (Math.abs(x - 64) < 18) continue;
        g.beginPath(); g.ellipse(x, y, rnd(2.5, 5), rnd(3, 5.5), 0, 0, TAU); g.fill();
      }
      g.fillRect(186, 0, 4, h * 0.45); g.fillRect(198, 0, 4, h * 0.45);                    // 背中の縞
    });
    const headT = tex('catHead', 128, 64, (g, w, h) => {
      g.fillStyle = '#a19a84'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3a342b'; g.lineWidth = 2.5;
      for (const dx of [-7, 0, 7]) { g.beginPath(); g.moveTo(32 + dx, 2); g.lineTo(32 + dx * 1.3, 22); g.stroke(); }   // ひたいの縞（前=u0.25→x32）
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(32 + s * 13, 28); g.lineTo(32 + s * 24, 34); g.stroke(); }
      g.fillStyle = 'rgba(230,224,206,.85)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(32 + s * 8, 30, 4, 2.5, 0, 0, TAU); g.fill(); }
    });
    const bodyM = texMat('catBody', bodyT), headM = texMat('catHead', headT);
    const pale = lam(0xdcd4c0), legM = texMat('catLeg', furTex('catLeg', '#8f8873', '#b0a88e', '#4a443a', 64, 64, 200)), dk = lam(0x2f2a24);
    const tailT = tex('catTail', 64, 64, (g, w, h) => { g.fillStyle = '#968f7a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f2a24'; for (let y = 8; y < h; y += 14) g.fillRect(0, y, w, 5); });
    const tailM = texMat('catTail', tailT);
    const g = new THREE.Group();
    const bodyP = P(g, 0, 0.3, 0);
    const torso = E(bodyP, 0.125, 0.13, 0.3, bodyM, 0, 0, 0, SPHZ(14, 10));
    const chest = E(bodyP, 0.1, 0.11, 0.12, bodyM, 0, 0.02, 0.21, SPHZ(10, 8));
    const headP = P(bodyP, 0, 0.1, 0.33);
    E(headP, 0.096, 0.086, 0.092, headM, 0, 0.03, 0.04, SPH(12, 10));
    E(headP, 0.05, 0.036, 0.042, pale, 0, -0.012, 0.12, SPH(10, 6));
    E(headP, 0.016, 0.011, 0.01, lam(0x6b4a46), 0, 0.014, 0.16, SPH(6, 4));
    const eyes = [], lids = [];
    for (const s of [-1, 1]) {
      const e = E(headP, 0.017, 0.017, 0.012, pho(0xc9b94a, 80), s * 0.04, 0.045, 0.115, SPH(8, 6)); e.userData.r = 0.017;
      E(e, 0.45, 0.85, 0.5, bas(0x0a0a0a), 0, 0, 0.7, SPH(6, 4)); eyes.push(e);
      const lid = P(headP, s * 0.04, 0.045, 0.117);              // 閉じた目（毛色のまぶた＋黒い線）
      E(lid, 0.019, 0.016, 0.011, lam(0xa19a84), 0, 0.002, 0, SPH(8, 6));
      E(lid, 0.016, 0.0035, 0.005, dk, 0, -0.003, 0.009, SPH(6, 4)).rotation.z = s * 0.25;
      lid.visible = false; lids.push(lid);
    }
    const ears = [];
    for (const s of [-1, 1]) { const ear = E(headP, 0.03, 0.03, 0.012, dk, s * 0.062, 0.1, 0.0, SPH(8, 6)); ear.rotation.z = -s * 0.3; ear.userData.s = s; ears.push(ear); }
    whiskers(headP, 'cat', 0.03, -0.015, 0.13, 4, 0.07, 0.6, 0xf2efe6, 0.01);
    const legs = [];
    for (const [x, y, z] of [[-0.07, -0.06, 0.18], [0.07, -0.06, 0.18], [-0.075, -0.04, -0.19], [0.075, -0.04, -0.19]]) {
      const lp = P(bodyP, x, y, z);
      E(lp, 0.055, 0.08, 0.065, bodyM, 0, -0.02, 0, SPH(8, 6));          // 太もも・肩（胴になじませる）
      E(lp, 0.04, 0.11, 0.045, legM, 0, -0.12, 0, SPH(8, 6));
      E(lp, 0.042, 0.02, 0.055, legM, 0, -0.225 - (z < 0 ? 0.02 : 0), 0.015, SPH(8, 4));
      lp.userData.front = z > 0; lp.userData.s = Math.sign(x); legs.push(lp);
    }
    const tailP = P(bodyP, 0, 0.04, -0.29);
    E(tailP, 0.036, 0.036, 0.15, tailM, 0, 0, -0.13, SPHZ(8, 6));
    /* setSleep(on)：岩棚の上で横倒しにぐっすり（原点は体の下の地面のまま。棚の天面に置けばOK） */
    const c = { g, moving: false, speed: 0.5, sleeping: false };
    let phs = rnd(0, 9), idle = 0, look = 0, lk = 0, lookT = rnd(1, 3), sit = 0, sleep = 0, sleepOn = false;
    let earT = rnd(2, 6), earK = 0, earS = 1; const blink = makeBlink(), ph0 = rnd(0, 9);
    c.setSleep = on => { sleepOn = !!on; c.sleeping = sleepOn; };
    c.update = (dt, t) => {
      sleep = damp(sleep, sleepOn ? 1 : 0, 1.8, dt);
      const S = sleep, A = 1 - S;
      const mv = c.moving && !sleepOn;
      if (mv) { phs += dt * TAU * (1.4 + (c.speed || 0) * 1.6); idle = 0; } else idle += dt;
      sit = damp(sit, !mv && !sleepOn && idle > 6 ? 1 : 0, 2.5, dt);
      const s1 = Math.sin(phs);
      for (const lp of legs) {
        const front = lp.userData.front, up = lp.userData.s > 0;   // +X側の足＝寝たとき上になる側
        const diag = (front ? 1 : -1) * lp.userData.s;
        const awakeX = (mv ? 0.45 * s1 * diag : 0) + (front ? 0.25 * sit : -1.35 * sit);
        const sleepX = front ? (up ? -0.95 : -0.75) : (up ? 0.2 : 0.45);   // 前足は前へ・後ろ足はだらん
        const sleepZ = 0.24 - (up ? (front ? 0.1 : 0.22) : 0);             // 上側の足は下の足へ垂れる
        lp.rotation.set(awakeX * A + sleepX * S, 0, sleepZ * S);
      }
      bodyP.rotation.set(-0.45 * sit * A, 0, 1.35 * S);                     // 寝姿＝体ごと横倒し（+X側が上）
      bodyP.position.y = (0.3 - 0.06 * sit + (mv ? 0.008 * Math.abs(Math.cos(phs)) : 0)) * A + 0.135 * S;
      bodyP.position.z = -0.06 * sit * A;
      const br = Math.sin(t * 1.4 + ph0);                                    // 寝息：わき腹がゆっくり上下（約4.5秒）
      torso.scale.set(0.125 * (1 + 0.045 * S * br), 0.13 * (1 + 0.012 * S * br), 0.3);
      chest.scale.x = 0.1 * (1 + 0.03 * S * br);
      lookT -= dt; if (lookT <= 0) { lookT = rnd(1.5, 4); look = mv ? 0 : rnd(-0.8, 0.8); }
      lk = damp(lk, mv || sleepOn ? 0 : look, 3, dt);
      headP.position.set(-0.06 * S, 0.1 - 0.035 * S, 0.33 + 0.01 * S);   // 頭は棚にぺたり
      headP.rotation.set((0.45 * sit + (mv ? 0.04 * Math.sin(phs * 2) : 0)) * A + 0.12 * S, lk * A - 0.25 * S, 0);
      tailP.rotation.set((0.55 - 0.2 * sit) * A + 0.08 * S, 0.25 * Math.sin(t * (mv ? 3 : 1.2)) * A + (0.35 + 0.04 * Math.sin(t * 0.5)) * S, 0);
      if (sleepOn) { earT -= dt; if (earT <= 0) { earT = rnd(3, 8); earK = 0.35; earS = Math.random() < 0.5 ? -1 : 1; } }   // ときどき耳がぴくっ
      let tw = 0; if (earK > 0) { earK -= dt; tw = Math.sin((0.35 - earK) * 45) * bump(0.35 - earK, 0, 0.35); }
      for (const e of ears) { const s = e.userData.s, on = s === earS; e.rotation.set(on ? 0.25 * tw : 0, 0, -s * 0.3 + (on ? 0.35 * tw : 0)); }
      const closed = S > 0.5;
      for (const e of eyes) e.visible = !closed;
      for (const l of lids) l.visible = closed;
      if (!closed) blink(dt, eyes);
    };
    return c;
  }

  /* =============================================================
     11. カモメ  原点=体の中心  翼を広げて約1.2m
     ============================================================= */
  function makeSeagull() {
    const wh = lam(0xf7f7f4), gray = lam(0xa2abb4), blk = lam(0x1f1f22);
    const g = new THREE.Group(), root = P(g);
    E(root, 0.07, 0.068, 0.2, wh, 0, 0, 0, SPH(12, 8));
    E(root, 0.054, 0.052, 0.058, wh, 0, 0.045, 0.19, SPH(10, 8));
    const b = MS(root, CONE(0.012, 0.06, 6), lam(0xf2cf4a), 0, 0.036, 0.265); b.rotation.x = PI / 2 + 0.1;
    E(root, 0.006, 0.006, 0.006, bas(0xd83a2a), 0, 0.026, 0.285, SPH(6, 4));
    eyePair(root, 0.008, 0.036, 0.058, 0.215, 0x111111);
    E(root, 0.07, 0.01, 0.07, wh, 0, 0.012, -0.22, SPH(10, 4));
    E(root, 0.07, 0.009, 0.025, blk, 0, 0.012, -0.28, SPH(10, 4));
    const wingI = [], wingO = [];
    for (const s of [-1, 1]) {
      const ip = P(root, s * 0.055, 0.03, 0.03);
      E(ip, 0.2, 0.014, 0.085, gray, s * 0.17, 0, 0, SPH(12, 4));
      const op = P(ip, s * 0.33, 0, 0);
      E(op, 0.2, 0.011, 0.06, gray, s * 0.15, 0, -0.025, SPH(12, 4));
      E(op, 0.09, 0.012, 0.042, blk, s * 0.3, 0, -0.04, SPH(8, 4));
      ip.userData.s = s; op.userData.s = s; wingI.push(ip); wingO.push(op);
    }
    const c = { g, moving: true, speed: 6 };
    let phs = rnd(0, 9), modeT = rnd(1, 3), flapping = true, amp = 1;
    c.update = (dt, t) => {
      modeT -= dt; if (modeT <= 0) { flapping = !flapping; modeT = flapping ? rnd(1.2, 2.6) : rnd(1.8, 4); }
      amp = damp(amp, flapping ? 1 : 0, 3, dt);
      phs += dt * TAU * 2.6;
      for (const ip of wingI) ip.rotation.z = ip.userData.s * (0.08 + 0.55 * amp * Math.sin(phs));
      for (const op of wingO) op.rotation.z = op.userData.s * (0.06 + 0.45 * amp * Math.sin(phs - 0.7));
      root.position.y = -0.03 * amp * Math.sin(phs + 0.5);
      root.rotation.z = (1 - amp) * 0.08 * Math.sin(t * 0.8);
    };
    return c;
  }

  /* =============================================================
     12. ぬいぐるみ（ショップ用・動かない）  原点=底  高さ約0.3m
     ============================================================= */
  function plushEyes(par, r, x, y, z) { return eyePair(par, r, x, y, z, 0x101010, true); }
  function makeSeaLionPlush(color = 0x6e5038) {
    const m = lam(color), lt = lam(new THREE.Color(color).lerp(new THREE.Color(0xe8d6c0), 0.45).getHex());
    const g = new THREE.Group();
    E(g, 0.1, 0.12, 0.085, m, 0, 0.12, 0, SPH(14, 10));
    E(g, 0.085, 0.08, 0.08, m, 0, 0.27, 0.025, SPH(14, 10));
    E(g, 0.048, 0.034, 0.04, lt, 0, 0.245, 0.095, SPH(10, 8));
    E(g, 0.016, 0.012, 0.01, lam(0x1a1210), 0, 0.262, 0.134, SPH(6, 4));
    plushEyes(g, 0.017, 0.038, 0.29, 0.085);
    for (const s of [-1, 1]) { const f = E(g, 0.035, 0.012, 0.07, m, s * 0.09, 0.02, 0.06, SPH(10, 6)); f.rotation.y = s * 0.5; }
    for (const s of [-1, 1]) { const f = E(g, 0.03, 0.012, 0.06, m, s * 0.05, 0.015, -0.11, SPH(10, 6)); f.rotation.y = -s * 0.5; }
    return { g, update() {} };
  }
  function makeOtterPlush() {
    const br = lam(0x5a3e2c), face = lam(0xe6dccb), g = new THREE.Group();
    E(g, 0.09, 0.12, 0.08, br, 0, 0.12, 0, SPH(14, 10));
    E(g, 0.075, 0.07, 0.07, face, 0, 0.27, 0.01, SPH(14, 10));
    for (const s of [-1, 1]) E(g, 0.028, 0.022, 0.025, face, s * 0.022, 0.25, 0.07, SPH(8, 6));
    E(g, 0.013, 0.01, 0.008, lam(0x1a1210), 0, 0.265, 0.09, SPH(6, 4));
    plushEyes(g, 0.014, 0.032, 0.29, 0.06);
    for (const s of [-1, 1]) E(g, 0.016, 0.016, 0.01, br, s * 0.055, 0.325, 0.0, SPH(6, 4));
    for (const s of [-1, 1]) { const p = E(g, 0.022, 0.02, 0.035, br, s * 0.04, 0.17, 0.075, SPH(8, 6)); p.rotation.x = -0.6; }
    E(g, 0.035, 0.012, 0.03, lam(0xf2a6b4), 0, 0.165, 0.1, SPH(10, 6));       // ピンクの貝
    E(g, 0.03, 0.01, 0.08, br, 0, 0.012, -0.1, SPH(10, 6));
    return { g, update() {} };
  }
  function makeDugongPlush() {
    const m = lam(0x9a9aa4), lt = lam(0xc8c4c4), g = new THREE.Group();
    E(g, 0.1, 0.075, 0.16, m, 0, 0.075, 0, SPH(14, 10));
    E(g, 0.075, 0.07, 0.07, m, 0, 0.09, 0.14, SPH(12, 10));
    const sn = E(g, 0.06, 0.045, 0.04, lt, 0, 0.065, 0.2, SPH(10, 8)); sn.rotation.x = 0.4;
    plushEyes(g, 0.013, 0.045, 0.115, 0.185);
    for (const s of [-1, 1]) { const f = E(g, 0.035, 0.01, 0.05, m, s * 0.09, 0.03, 0.08, SPH(8, 6)); f.rotation.y = s * 0.6; }
    const fk = MS(g, flukeGeo('plush', 0.18, 0.07, 0.02), m, 0, 0.05, -0.15);
    return { g, update() {} };
  }

  return { makeWalrus, makeDugong, makeManatee, makeSeaOtter, makePenguin, makeGraySeal,
    makeCommersonDolphin, makeSmallOtter, makePelican, makeFishingCat, makeSeagull,
    makeSeaLionPlush, makeOtterPlush, makeDugongPlush };
})();
