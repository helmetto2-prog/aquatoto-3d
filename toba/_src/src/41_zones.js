/* =========================================================
   ゾーンの中身（B〜L・エントランス・ショップ）
   ========================================================= */
/* 前作の図鑑イラスト（なのばなな）を使う魚。縦横比は切り抜き後の実寸 */
const PHOTO_AR = { amago: 384 / 169, ayu: 362 / 156, cichlid_b: 350 / 229, cichlid_y: 344 / 184, hariyo: 384 / 161, iwana: 368 / 150, koi: 354 / 187, medaka: 384 / 143, namazu: 358 / 150, neon_tetra: 384 / 182, oosansho: 384 / 176, piranha: 384 / 255, pirarucu: 377 / 121, salamander_k: 384 / 143, sawagani: 384 / 208 };
const photoMats = {};
function photoFish(name, len) {
  const ar = PHOTO_AR[name] || 2.2;
  if (!photoMats[name]) { const t = ASSET.tex('fish/' + name + '.png'); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; photoMats[name] = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, depthWrite: false }); }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, len / ar), photoMats[name]); m.rotation.y = Math.PI / 2; g.add(m);
  const ph = rnd(0, 6);
  return { g, update(dt, t) { m.rotation.x = Math.sin(t * 5 + ph) * 0.05; m.scale.x = 1 + Math.sin(t * 7 + ph) * 0.025; } };
}
function spriteFish(kind, len) { return (typeof ANIM.makeSpriteFish === 'function') ? mk('makeSpriteFish', kind, len) : photoFish('cichlid_y', len); }
/* 水槽に生きものを放す */
function swimIn(T, c, opts = {}) {
  T.g.add(c.g); const ctl = swimmerCtl(c, opts.B || T.B, opts);
  onUpdate((dt, t) => { ctl.update(dt, t); c.update(dt, t); }, T.cx, T.cz, T.f, opts.r || 34);
  return ctl;
}
function staticIn(T, c, x, y, z, ry = 0, s = 1) { T.g.add(c.g); c.g.position.set(x, y, z); c.g.rotation.y = ry; c.g.scale.multiplyScalar(s); onUpdate((dt, t) => c.update(dt, t), T.cx, T.cz, T.f, 30); return c; }
function benches(x0, z0, n, dx, dz, y = 0, ry = 0) { for (let i = 0; i < n; i++) { const b = box(2.4, 0.45, 0.6, M.deck); b.position.set(x0 + i * dx, y + 0.22, z0 + i * dz); b.rotation.y = ry; scene.add(b); } }
/* 色つきの形をひとつのジオメトリにまとめる（描画回数を減らす）。list = [[geometry, color], ...] */
function mergeGeo(list) {
  const pos = [], nor = [], col = [], C = new THREE.Color();
  for (const [geo, color] of list) {
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array; C.set(color);
    for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(C.r, C.g, C.b); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/* チンアナゴ・ニシキアナゴ（写真の砂地）。全員で1つのメッシュを毎フレーム曲げる。
   そばでバタバタ動くと砂にひっこみ、じっとしていると、またそーっと顔を出す */
function gardenEels(S, list, o = {}) {
  const NL = 20, NR = 7, RING = (NL + 1) * NR, PER = RING + 1 + 12, TAU2 = Math.PI * 2;
  const n = list.length, pos = new Float32Array(n * PER * 3), nor = new Float32Array(n * PER * 3), col = new Float32Array(n * PER * 3), idx = [];
  const C = new THREE.Color(), setC = (v, hex) => { C.set(hex); col[v * 3] = C.r; col[v * 3 + 1] = C.g; col[v * 3 + 2] = C.b; };
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const OCT = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  list.forEach((e, i) => {
    const o0 = i * PER, tip = o0 + RING;
    for (let k = 0; k <= NL; k++) for (let j = 0; j < NR; j++) {
      const t = k / NL; let hex;
      if (e.kind === 'nishiki') hex = t > 0.86 ? 0xf08a2e : (Math.floor(t * 7.5) % 2 ? 0xfff4e6 : 0xee7420);
      else { hex = hash(i * 31 + k, j) < 0.22 ? 0x45403a : 0xe9e3d0; if (t > 0.7 && t < 0.78 && j % 3 !== 0) hex = 0x1e1c1a; }
      setC(o0 + k * NR + j, hex);
    }
    setC(tip, e.kind === 'nishiki' ? 0xf08a2e : 0xe9e3d0);
    for (let q = 0; q < 12; q++) setC(tip + 1 + q, 0x0e0e10);
    for (let k = 0; k < NL; k++) for (let j = 0; j < NR; j++) { const a = o0 + k * NR + j, b = o0 + k * NR + (j + 1) % NR; idx.push(a, b, a + NR, b, b + NR, a + NR); }
    for (let j = 0; j < NR; j++) idx.push(o0 + NL * NR + j, o0 + NL * NR + (j + 1) % NR, tip);
    for (let s = 0; s < 2; s++) for (const [a, b, c] of OCT) idx.push(tip + 1 + s * 6 + a, tip + 1 + s * 6 + b, tip + 1 + s * 6 + c);
    Object.assign(e, { out: rnd(0.75, 1), max: rnd(0.82, 1), fear: 0, rate: rnd(0.5, 1.0), ph: rnd(0, TAU2), w: rnd(0.9, 1.5), sway: rnd(0.16, 0.26), lean: rnd(0.05, 0.2), bend: rnd(1.25, 1.6),
      FX: Math.sin(e.yaw), FZ: Math.cos(e.yaw), SXx: Math.cos(e.yaw), SXz: -Math.sin(e.yaw) });
  });
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ge.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); ge.setAttribute('color', new THREE.BufferAttribute(col, 3)); ge.setIndex(idx);
  const mesh = new THREE.Mesh(ge, new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.frustumCulled = false; S.g.add(mesh);
  /* 体の中心線をたどりながら輪を置く（ローカル軸: s=横, u=上, f=前） */
  const prof = t => (1 + 0.16 * Math.exp(-(((t - 0.9) / 0.05) ** 2))) * (t > 0.95 ? 1 - (t - 0.95) / 0.05 * 0.5 : 1);
  function pose(e, i, t) {
    const o0 = i * PER, L = e.L, sub = L * (1 - e.out);
    let ps = 0, pu = 0, pf = 0, vPrev = -1, cs = 0, cu = 0, cf = 0, dS = 0, dU = 1, dF = 0, eye = null;
    const put = (v, ls, lu, lf, ns, nu, nf) => {
      pos[v * 3] = e.x + ls * e.SXx + lf * e.FX; pos[v * 3 + 1] = e.y + lu; pos[v * 3 + 2] = e.z + ls * e.SXz + lf * e.FZ;
      nor[v * 3] = ns * e.SXx + nf * e.FX; nor[v * 3 + 1] = nu; nor[v * 3 + 2] = ns * e.SXz + nf * e.FZ;
    };
    for (let k = 0; k <= NL; k++) {
      const tk = k / NL, u = tk * L * 0.97, v = u - sub;
      if (v <= 0) { cs = 0; cu = v; cf = 0; dS = 0; dU = 1; dF = 0; }
      else {
        const q = v / L;
        const thF = e.lean + e.bend * Math.pow(q, 2.2) + 0.12 * Math.sin(t * 0.7 + e.ph) * q;
        const thS = e.sway * q * Math.sin(t * e.w + e.ph - v * 6);
        dS = Math.sin(thS); dU = Math.cos(thS) * Math.cos(thF); dF = Math.cos(thS) * Math.sin(thF);
        const step = v - Math.max(0, vPrev);
        ps += dS * step; pu += dU * step; pf += dF * step; cs = ps; cu = pu; cf = pf;
      }
      vPrev = v;
      /* 横向きの基準(1,0,0)を接線に直交化 → N、B = T×N */
      let ns = 1 - dS * dS, nu = -dS * dU, nf = -dS * dF; const nl = Math.hypot(ns, nu, nf) || 1; ns /= nl; nu /= nl; nf /= nl;
      const bs = dU * nf - dF * nu, bu = dF * ns - dS * nf, bf = dS * nu - dU * ns;
      const r = e.r * prof(tk);
      for (let j = 0; j < NR; j++) {
        const a = j / NR * TAU2, ca = Math.cos(a), sa = Math.sin(a);
        const os = ca * ns + sa * bs, ou = ca * nu + sa * bu, of = ca * nf + sa * bf;
        put(o0 + k * NR + j, cs + os * r, cu + ou * r, cf + of * r, os, ou, of);
      }
      if (k === NL) put(o0 + RING, cs + dS * e.r * 0.9, cu + dU * e.r * 0.9, cf + dF * e.r * 0.9, dS, dU, dF);
      if (k === Math.round(NL * 0.92)) eye = { cs, cu, cf, ns, nu, nf, bs, bu, bf, r };
    }
    /* 目（小さな八面体×2） */
    const E = eye, es = E.r * 0.45;   // 目は背中側（カーブの外側）寄りに
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1, b0 = o0 + RING + 1 + s * 6;
      const ex = E.cs + sg * E.ns * E.r * 0.92 + E.bs * E.r * 0.25, ey = E.cu + sg * E.nu * E.r * 0.92 + E.bu * E.r * 0.25, ez = E.cf + sg * E.nf * E.r * 0.92 + E.bf * E.r * 0.25;
      const D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      D.forEach(([dx, dy, dz], q) => put(b0 + q, ex + dx * es, ey + dy * es, ez + dz * es, dx, dy, dz));
    }
  }
  let lx = null, lz = 0, stillT = 0, done = false;
  const st = { mesh, list, allOut: false };
  onUpdate((dt, t) => {
    const pp = player.pos; if (lx === null) { lx = pp.x; lz = pp.z; }
    const sp = Math.hypot(pp.x - lx, pp.z - lz) / Math.max(dt, 1 / 120); lx = pp.x; lz = pp.z;
    const onF = Math.abs(pp.y - S.floorY) < 3;
    stillT = sp < 0.4 ? stillT + dt : 0;
    let all = true;
    list.forEach((e, i) => {
      const d = Math.hypot(pp.x - e.x, pp.z - e.z);
      if (onF && d < 2.9 && sp > 1.3) e.fear = rnd(2.5, 4.5);
      if (e.fear > 0) e.fear -= dt;
      const tgt = e.fear > 0 ? 0.04 : e.max;
      e.out += (tgt - e.out) * (1 - Math.exp(-(tgt < e.out ? 7 : e.rate) * dt));
      if (e.out < tgt - 0.08 || e.fear > 0) all = false;
      pose(e, i, t);
    });
    st.allOut = all;
    ge.attributes.position.needsUpdate = true; ge.attributes.normal.needsUpdate = true;
    const dc = Math.hypot(pp.x - S.cx, pp.z - S.cz);
    if (o.onAllOut && !done && all && onF && dc < 4.3 && stillT > 1.5) { done = true; o.onAllOut(); }
  }, S.cx, S.cz, S.f, 26);
  return st;
}

/* 白い水玉のクラゲ（タコクラゲのなかま）。かさ＋口腕の2メッシュだけ */
const SPJ = {};
function makeSpottedJelly() {
  if (!SPJ.bellM) {
    const tx = ctex(256, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(168,142,112,0.95)'); gr.addColorStop(0.75, 'rgba(204,184,156,0.8)'); gr.addColorStop(1, 'rgba(232,222,204,0.6)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 170; i++) { const y = Math.random() * h * 0.93, r = 1.8 + Math.random() * 3.4 * (0.45 + y / h); c.fillStyle = 'rgba(255,255,250,0.96)'; c.beginPath(); c.ellipse(Math.random() * w, y, r * (0.45 + 0.6 * y / h), r, 0, 0, 7); c.fill(); }
    });
    tx.wrapT = THREE.ClampToEdgeWrapping;
    SPJ.bellM = new THREE.MeshBasicMaterial({ map: tx, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    SPJ.bellG = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const parts = [], ax = new THREE.Vector3(), m4 = new THREE.Matrix4();
    const col = new THREE.CylinderGeometry(0.17, 0.12, 0.5, 8); col.translate(0, -0.3, 0); parts.push([col, 0xc9b597]);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2, ca = Math.cos(a), sa = Math.sin(a), L = rnd(0.9, 1.15);
      ax.set(-sa, 0, ca); m4.makeRotationAxis(ax, 0.24);
      const add = (geo, color, along, off = 0) => { geo.translate(off * ca, -along, off * sa); geo.applyMatrix4(m4); geo.translate(ca * 0.26, -0.12, sa * 0.26); parts.push([geo, color]); };
      const arm = new THREE.CylinderGeometry(0.075, 0.05, L, 6); arm.translate(0, L / 2, 0); add(arm, 0xd9c8ae, L);
      for (const [f, sz] of [[0.35, 0.13], [0.58, 0.12], [0.8, 0.1]]) { const fr = new THREE.SphereGeometry(sz, 6, 4); fr.scale(1, 0.55, 1); add(fr, 0xefe4d2, L * f, (f * 37 % 1 > 0.5 ? 1 : -1) * 0.03); }
      const club = new THREE.SphereGeometry(0.1, 8, 6); club.scale(0.8, 1.3, 0.8); add(club, 0xffffff, L + 0.06);
    }
    SPJ.armG = mergeGeo(parts);
    SPJ.armM = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x8a7a66, transparent: true, opacity: 0.93 });
  }
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const R = rnd(0.17, 0.21);
  const bell = new THREE.Mesh(SPJ.bellG, SPJ.bellM); inner.add(bell);
  const arms = new THREE.Mesh(SPJ.armG, SPJ.armM); inner.add(arms);
  const ph = rnd(0, 1), rate = rnd(0.45, 0.65);
  return { g, len: R * 2.2, moving: true, speed: 0.05, update(dt, t) {
    const cyc = t * rate + ph, p = Math.pow(Math.max(0, Math.sin(cyc * Math.PI * 2)), 2);
    const sx = R * (1 - 0.12 * p), sy = R * 0.62 * (1 + 0.18 * p);
    bell.scale.set(sx, sy, sx);
    arms.scale.set(R * (1 - 0.05 * p), R * (1 + 0.08 * p), R * (1 - 0.05 * p));
    arms.rotation.y = 0.3 * Math.sin(t * 0.25 + ph * 6); arms.rotation.x = 0.06 * Math.sin(t * 0.8 + ph * 3);
    inner.position.y = 0.03 * Math.sin(cyc * Math.PI * 2 - 1.3);
  } };
}

zoneGroup('zHall', 1, 0, 12, 44, ['HALL1']);
/* ================= エントランスホール（1F） ================= */
{
  /* 入館してすぐの大水槽（イワシの群れ・エイ・サメ） */
  const T = islandTank({ x0: -8, x1: 8, z0: 1.4, z1: 6.6, y: 0, h: 5.5, base: 0.5, top: '#3fa6d8', bot: '#0c3a60', dim: 0.42 });
  for (let i = 0; i < 9; i++) rockAt(T.g, rnd(-7, 7), T.floorY, rnd(2, 6), rnd(.3, .7), M.stoneWall);
  if (typeof ANIM.school === 'function') {
    try { const sc = ANIM.school(120, null, { x0: -6.8, x1: 6.8, y0: 1.4, y1: 5.2, z0: 2.3, z1: 5.7 }, { kind: 'iwashi', len: 0.3 }); T.g.add(sc.g); onUpdate((dt, t) => sc.update(dt, t), 0, 4, 1, 34); } catch (e) { console.warn('school', e); }
  } else for (let i = 0; i < 30; i++) swimIn(T, spriteFish('iwashi', 0.32), { spd: 1.6 });
  for (let i = 0; i < 2; i++) swimIn(T, mk('makeRay'), { spd: 0.6, B: { x0: -6.5, x1: 6.5, y0: 1.4, y1: 4.8, z0: 2.4, z1: 5.6 } });
  for (let i = 0; i < 2; i++) swimIn(T, mk('makeShark'), { spd: 0.8, B: { x0: -6.5, x1: 6.5, y0: 1.4, y1: 4.8, z0: 2.4, z1: 5.6 } });
  addFact({ x: 0, z: 9.5, f: 1, r: 5.5, name: 'エントランス大水槽', txt: '入ってすぐの大きな水槽。イワシの群れがぐるぐる回って、エイやサメもいっしょに泳いでるよ' });
  addFact({ x: 0, z: -2.5, f: 1, r: 3.2, name: 'エントランス大水槽（うら側）', txt: '裏からも見られる水槽。イワシの群れは天敵から身を守るために集まって泳ぐんだって' });
  /* インフォメーションとフロア案内 */
  const desk = box(5, 1.1, 1.4, M.deck); desk.position.set(9.5, 0.55, 19.2); scene.add(desk); addSolid(7, 12, 0, 1.1, 18.5, 19.9);
  const inf = sign3D(['インフォメーション', '順路はありません。すきなところから！'], { w: 5.4, h: 1.4, hang: 3.0, ceil: CEIL, bg: '#0b4a7c', f2: 46 }); inf.position.set(9.5, 0, 19.6);
  const map1 = sign3D(['館内マップ（12ゾーン）', '1F: A C D B E ショップ ／ 2F: A F G B K H I J', '外の東: L 水の回廊　［M］でフロアマップ'], { w: 6.6, h: 2.6, posts: 1.6, bg: '#123a5c', f1: 70, f2: 44 });
  map1.position.set(-6, 0, 15); map1.rotation.y = 0.35;
  const wel = sign3D(['ようこそ 鳥羽 3D たんけん水族館へ', 'スタンプは全部で18こ（ゾーン12＋イベント6）'], { w: 8, h: 1.2, hang: 5.4, ceil: CEIL, bg: '#0b3352', f2: 50 }); wel.position.set(0, 0, 12);
  benches(-4, 9.5, 3, 4, 0);
  /* 海のシアター（Claude版＝いただいたCG動画をループ／公開版＝動画を外して、手描きのCGアニメ） */
  {
    let vt, play = () => { }, stop = () => { };
    if (!__PUBLIC__) {
      const vid = document.createElement('video'); vid.src = ASSET.base + 'theater.mp4'; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.preload = 'auto'; vid.crossOrigin = 'anonymous';
      vt = new THREE.VideoTexture(vid); vt.colorSpace = THREE.SRGBColorSpace;
      play = () => vid.play().catch(() => { playing = false; }); stop = () => vid.pause();
    } else {
      const W = 512, H = 384, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      const bg = document.createElement('canvas'); bg.width = W; bg.height = H; {
        const b = bg.getContext('2d'), gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2f9fd0'); gr.addColorStop(0.55, '#145a8a'); gr.addColorStop(1, '#0a2e4c');
        b.fillStyle = gr; b.fillRect(0, 0, W, H);
        b.fillStyle = '#d9c79a'; b.beginPath(); b.moveTo(0, H); for (let x = 0; x <= W; x += 16) b.lineTo(x, H - 46 - 10 * Math.sin(x * 0.02)); b.lineTo(W, H); b.fill();
        const cor = ['#ff8a7a', '#ffb35c', '#c58cff', '#ff6fa8', '#7ad8c8'];
        for (let i = 0; i < 16; i++) { const x = 14 + i * 32 + Math.random() * 12, h = 30 + Math.random() * 50; b.strokeStyle = cor[i % cor.length]; b.lineWidth = 6; b.lineCap = 'round';
          for (let k = 0; k < 4; k++) { b.beginPath(); b.moveTo(x, H - 40); b.quadraticCurveTo(x + (k - 1.5) * 10, H - 40 - h * 0.6, x + (k - 1.5) * 16, H - 40 - h); b.stroke(); } }
      }
      const pal = ['#ffd23f', '#ff8c42', '#4cc9f0', '#f7f7ff', '#ff5d8f', '#9ef01a'];
      const fish = Array.from({ length: 16 }, (_, i) => ({ x: Math.random() * W, y: 50 + Math.random() * 230, s: 0.6 + Math.random() * 0.9, v: (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 30), c: pal[i % pal.length], ph: Math.random() * 6 }));
      const bub = Array.from({ length: 22 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 3.5, v: 18 + Math.random() * 30 }));
      let tx = -120;
      const draw = (t, dt) => {
        g.drawImage(bg, 0, 0);
        g.globalAlpha = 0.10; g.fillStyle = '#ffffff';
        for (let i = 0; i < 5; i++) { const x = ((i * 120 + t * 12) % (W + 200)) - 100; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x - 60, H); g.lineTo(x - 110, H); g.fill(); }
        g.globalAlpha = 1;
        tx += dt * 22; if (tx > W + 140) tx = -140;     // ウミガメがゆっくり横切る
        const ty = 120 + 14 * Math.sin(t * 0.5); g.fillStyle = '#5d8a5a'; g.beginPath(); g.ellipse(tx, ty, 46, 30, 0, 0, 7); g.fill();
        g.fillStyle = '#7fae6c'; g.beginPath(); g.ellipse(tx + 52, ty - 2, 13, 10, 0, 0, 7); g.fill();
        const fl = Math.sin(t * 2.4) * 0.5; g.fillStyle = '#6f9a62';
        for (const [ox, oy, a] of [[18, -22, -0.8 - fl], [18, 22, 0.8 + fl], [-30, -18, -2.3], [-30, 18, 2.3]]) { g.save(); g.translate(tx + ox, ty + oy); g.rotate(a); g.beginPath(); g.ellipse(14, 0, 18, 6, 0, 0, 7); g.fill(); g.restore(); }
        for (const f of fish) {
          f.x += f.v * dt; if (f.x > W + 40) f.x = -40; if (f.x < -40) f.x = W + 40;
          const y = f.y + 6 * Math.sin(t * 1.5 + f.ph), d = Math.sign(f.v), L = 22 * f.s;
          g.fillStyle = f.c; g.beginPath(); g.ellipse(f.x, y, L, L * 0.45, 0, 0, 7); g.fill();
          const wag = Math.sin(t * 8 + f.ph) * 4 * f.s; g.beginPath(); g.moveTo(f.x - d * L * 0.8, y); g.lineTo(f.x - d * L * 1.5, y - L * 0.45 + wag); g.lineTo(f.x - d * L * 1.5, y + L * 0.45 + wag); g.fill();
          g.fillStyle = '#10202c'; g.beginPath(); g.arc(f.x + d * L * 0.5, y - L * 0.08, Math.max(1.5, L * 0.09), 0, 7); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (const b of bub) { b.y -= b.v * dt; if (b.y < -6) { b.y = H - 40; b.x = Math.random() * W; } g.beginPath(); g.arc(b.x + 3 * Math.sin(t * 2 + b.x), b.y, b.r, 0, 7); g.fill(); }
      };
      draw(0, 0);
      vt = new THREE.CanvasTexture(cv); vt.colorSpace = THREE.SRGBColorSpace;
      let on = false, acc = 0, last = 0;
      play = () => { on = true; }; stop = () => { on = false; };
      onUpdate((dt, t) => { if (!on) return; acc += dt; if (acc < 1 / 20) return; draw(t, acc); acc = 0; vt.needsUpdate = true; }, 8, 6, 1, 24);
    }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.8), new THREE.MeshBasicMaterial({ map: vt, color: 0xdddddd })); scr.position.set(13.68, 3.3, 4.0); scr.rotation.y = -Math.PI / 2; scene.add(scr);
    const fr = box(0.18, 5.1, 6.7, M.dark); fr.position.set(13.8, 3.3, 4.0); scene.add(fr);
    const tl = sign3D(['海のシアター', 'サンゴの海と海の生きもの（CG）'], { w: 4.2, h: 0.9, bg: '#0b3352', f1: 70, f2: 50, oneSide: true }); tl.position.set(13.6, 6.2, 4.0); tl.rotation.y = -Math.PI / 2;
    let playing = false;
    onUpdate(() => { const want = started && Math.hypot(player.pos.x - 8, player.pos.z - 6) < 18 && player.pos.y < 3; if (want && !playing) { playing = true; play(); } else if (!want && playing) { playing = false; stop(); } }, 0, 0, 0, 0);
    addFact({ x: 10, z: 4, f: 1, r: 3.6, name: '海のシアター', txt: 'サンゴの海、トンネルの水槽、ウミガメ…ベンチにすわってのんびりどうぞ' });
  }
  const s2 = sign3D(['◀ C 古代の海 ／ スタジアム', 'E 伊勢志摩の海・ショップ ▶'], { w: 7, h: 1.5, hang: 4.4, ceil: CEIL, bg: '#123a5c', f1: 64, f2: 64 }); s2.position.set(0, 0, 17.5);
}

secEnd();

/* ================= B 海獣の王国（1F=水中の窓 / 2F=水上から） ================= */
zoneGroup('zB', 0, 0, -12, 52, ['B1', 'B2']);
{
  const P = POOL_B, wy0 = 0.4, wy1 = 6.3, surf = 6.35;
  /* 1Fの大きな窓（z=-7）・プールの壁・中の背景 */
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0 - 0.6, wy1 - wy0), M.glass); glass.position.set(0, (wy0 + wy1) / 2, P.z1); scene.add(glass);
  addSolid(P.x0, P.x1, 0, CEIL, P.z1 - 0.15, P.z1 + 0.15);
  const ap = box(P.x1 - P.x0, wy0, 0.4, M.wallIn); ap.position.set(0, wy0 / 2, P.z1); scene.add(ap);
  const hd = box(P.x1 - P.x0, FY[2] - wy1, 0.4, M.wallIn); hd.position.set(0, (wy1 + FY[2]) / 2, P.z1 + 0.05); scene.add(hd);
  const backM = new THREE.MeshBasicMaterial({ map: tankBackTex('#4fb2e0', '#0a3a62'), side: THREE.DoubleSide });
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, surf), backM); bp.position.set(0, surf / 2, P.z0); scene.add(bp);
  for (const x of [P.x0, P.x1]) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(P.z1 - P.z0, surf), backM); sp.position.set(x, surf / 2, (P.z0 + P.z1) / 2); sp.rotation.y = Math.PI / 2; scene.add(sp); }
  floorPlane(P.x0, P.x1, P.z0, P.z1, 0.02, M.sand, 3);
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), M.caustic.clone()); caus.material.map = causticTex.clone(); caus.material.map.needsUpdate = true; caus.material.map.repeat.set(5, 4);
  caus.rotation.x = -Math.PI / 2; caus.position.set(0, 0.05, (P.z0 + P.z1) / 2); scene.add(caus);
  const sm = new THREE.MeshBasicMaterial({ map: waterTex.clone(), color: 0x7fd0f0, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }); sm.map.needsUpdate = true; sm.map.repeat.set(5, 4);
  const surfM = new THREE.Mesh(new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), sm); surfM.rotation.x = -Math.PI / 2; surfM.position.set(0, surf, (P.z0 + P.z1) / 2); scene.add(surfM);
  onUpdate(dt => { sm.map.offset.x += dt * 0.03; sm.map.offset.y += dt * 0.02; caus.material.map.offset.x += dt * 0.04; }, 0, -14, 0, 50);
  /* チリの海岸っぽい岩場 */
  const pg = new THREE.Group(); scene.add(pg);
  for (let i = 0; i < 14; i++) rockAt(pg, rnd(P.x0 + 1, P.x1 - 1), 0, rnd(P.z0 + 0.8, P.z0 + 4), rnd(.6, 1.6), M.stone);
  for (let i = 0; i < 4; i++) rockAt(pg, rnd(P.x0 + 1, P.x1 - 1), 0, rnd(P.z0 + 5, P.z1 - 3), rnd(.4, .9), M.stone);
  const T = { g: pg, B: { x0: P.x0 + 1, x1: P.x1 - 1, y0: 0.9, y1: surf - 0.45, z0: P.z0 + 1.2, z1: P.z1 - 1 }, cx: 0, cz: -14, f: 0 };
  for (let i = 0; i < 2; i++) { const sl = makeSeaLion({ pose: 'swim' }); sl.setPose('swim'); swimIn(T, sl, { spd: 2.2, turn: 1.6, surface: 9, bank: true, r: 40 }); }
  for (let i = 0; i < 2; i++) swimIn(T, mk('makeGraySeal'), { spd: 1.2, turn: 1.0, surface: 12, bank: true, r: 40 });
  zoneBoard('B', 0, 4.4, -2.0, 0, 6);
  zoneBoard('B', 0, FY[2] + 4.4, -2.2, 0, 6);
  addFact({ x: 0, z: -4.2, f: 1, r: 6, zone: 'B', name: 'B 海獣の王国（水中から）', txt: 'カリフォルニアアシカとハイイロアザラシのプール。2階から見ると水面に顔を出すところが見えるよ' });
  addFact({ x: 0, z: -4.5, f: 2, r: 6, zone: 'B', name: 'B 海獣の王国（水上から）', txt: 'お食事タイムは10:00と15:00。アシカは前ビレ、アザラシは後ろビレで泳ぐのがちがい' });
  const ft = sign3D(['お食事タイム', '10:00 ／ 15:00'], { w: 3.6, h: 1.1, posts: 1.4, bg: '#0b4a7c', f2: 60 }); ft.position.set(-10.5, FY[2], -3.5); ft.rotation.y = 0.4;
}
secEnd();

zoneGroup('zC', 1, -24, 12, 44, ['C1']);
/* ================= C 古代の海（1F） ================= */
{
  const N = TK.C_naut;
  for (let i = 0; i < 6; i++) swimIn(N, mk('makeNautilus'), { spd: 0.15, turn: 0.6 });
  for (let i = 0; i < 4; i++) rockAt(N.g, rnd(N.B.x0, N.B.x1), N.floorY, rnd(N.B.z0, N.B.z1), rnd(.2, .45), M.stone);
  const K = TK.C_kabuto;
  for (let i = 0; i < 4; i++) swimIn(K, mk('makeHorseshoeCrab'), { spd: 0.12, bottom: true, turn: 0.5 });
  /* アリゲーターガー（島型水槽） */
  const G = islandTank({ x0: -29, x1: -19, z0: 8.8, z1: 12.6, y: 0, h: 1.8, base: 0.6, top: '#6aa080', bot: '#173a2a', rocks: 5 });
  for (let i = 0; i < 4; i++) swimIn(G, spriteFish('gar', 1.3), { spd: 0.35, turn: 0.5 });
  /* シーラカンスの映像（キャンバスのアニメ） */
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const cg = cv.getContext('2d');
  const vt = new THREE.CanvasTexture(cv); vt.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({ map: vt })); scr.position.set(-33.68, 2.9, 7.2); scr.rotation.y = Math.PI / 2; scene.add(scr);
  const scf = box(0.2, 3.9, 7.5, M.dark); scf.position.set(-33.8, 2.9, 7.2); scene.add(scf);
  let vtT = 0;
  onUpdate((dt, t) => {
    vtT += dt; if (vtT < 0.066) return; vtT = 0;
    const gr = cg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0b2a48'); gr.addColorStop(1, '#020812'); cg.fillStyle = gr; cg.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) { cg.fillStyle = `rgba(160,200,230,${0.15 + 0.1 * Math.sin(t + i)})`; cg.fillRect((i * 97 + t * 8) % 512, (i * 53) % 256, 2, 2); }
    const x = ((t * 26) % 700) - 120, y = 140 + Math.sin(t * 0.8) * 16;
    cg.save(); cg.translate(x, y);
    cg.fillStyle = '#3a5f86'; cg.beginPath(); cg.ellipse(0, 0, 92, 30, 0, 0, 7); cg.fill();
    cg.fillStyle = '#4f7aa6'; for (const [fx, fy, a] of [[-20, 26, .5], [10, 26, .3], [-40, -26, -.5], [20, -26, -.4], [55, 18, .6]]) { cg.save(); cg.translate(fx, fy); cg.rotate(a + Math.sin(t * 4 + fx) * 0.3); cg.beginPath(); cg.ellipse(0, 0, 14, 7, 0, 0, 7); cg.fill(); cg.restore(); }
    cg.beginPath(); cg.moveTo(-88, 0); cg.lineTo(-128, -22); cg.lineTo(-118, 0); cg.lineTo(-128, 22); cg.closePath(); cg.fill();
    cg.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 18; i++) { cg.fillRect(-60 + (i * 37) % 120, -18 + (i * 23) % 34, 6, 4); }
    cg.fillStyle = '#fff'; cg.beginPath(); cg.arc(70, -6, 5, 0, 7); cg.fill(); cg.fillStyle = '#000'; cg.beginPath(); cg.arc(71, -6, 2.5, 0, 7); cg.fill();
    cg.restore();
    cg.fillStyle = '#cfe8ff'; cg.font = `bold 26px ${SIGN_FONT}`; cg.fillText('シーラカンス（映像）', 16, 36);
    cg.font = `bold 18px ${SIGN_FONT}`; cg.fillStyle = '#9fc6dc'; cg.fillText('4億年前から姿を変えない「生きている化石」', 16, 62);
    vt.needsUpdate = true;
  }, -30, 7, 1, 26);
  zoneBoard('C', -24, 4.4, 15.5, 0, 5.6);
  addFact({ x: -29, z: 21, f: 1, r: 4, zone: 'C', name: 'オウムガイ', txt: '殻の中の部屋の空気を調節して浮き沈みする「生きている化石」。4億年以上前からいるよ' });
  addFact({ x: -20.5, z: 21.5, f: 1, r: 3.6, zone: 'C', name: 'カブトガニ', txt: 'カニではなくクモやサソリに近いなかま。血が青いんだって' });
  addFact({ x: -24, z: 14.2, f: 1, r: 4, zone: 'C', name: 'アリゲーターガー', txt: 'ワニみたいな口の古代魚。うろこはかたいエナメル質でできている' });
  addFact({ x: -31, z: 7, f: 1, r: 4.5, zone: 'C', name: 'シーラカンスの映像', txt: '絶滅したと思われていたのに1938年に生きたまま見つかった、まぼろしの魚' });
}

secEnd(); zoneGroup('zD', 1, -24, -12, 46, ['D1']);
/* ================= D コーラルリーフ・ダイビング（1F） ================= */
{
  const T = TK.D_reef;
  if (typeof ANIM.coralPatch === 'function') { try { const cp = ANIM.coralPatch(T.W - 0.6, T.D - 0.6, {}); cp.g.position.set(T.cx, T.floorY, T.cz); T.g.add(cp.g); onUpdate((dt, t) => cp.update && cp.update(dt, t), T.cx, T.cz, 1, 34); } catch (e) { console.warn('coral', e); } }
  else for (let i = 0; i < 20; i++) rockAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0, T.B.z1), rnd(.3, .9), M.stoneWall);
  const kinds = [['kakure', 9, 0.16], ['nanyou', 9, 0.3], ['kiiro', 10, 0.22], ['tsunodashi', 6, 0.26], ['chouchou', 8, 0.22], ['madai', 4, 0.4]];
  for (const [k, n, len] of kinds) for (let i = 0; i < n; i++) swimIn(T, spriteFish(k, len * 2.3), { spd: 0.7, turn: 1.6 });
  for (let i = 0; i < 2; i++) swimIn(T, mk('makeSeaTurtle'), { spd: 0.45, turn: 0.7, surface: 20 });
  swimIn(T, mk('makeRay'), { spd: 0.55, turn: 0.6 });
  swimIn(T, mk('makeShark'), { spd: 0.7, turn: 0.7 });
  /* クマノミの小さな水槽 */
  const S = islandTank({ x0: -28, x1: -21, z0: -11, z1: -8, y: 0, h: 1.5, base: 0.7, top: '#58c0e8', bot: '#0d4a6e' });
  if (typeof ANIM.coralPatch === 'function') { try { const cp = ANIM.coralPatch(6.4, 2.4, { dense: true }); cp.g.position.set(-24.5, S.floorY, -9.5); S.g.add(cp.g); onUpdate((dt, t) => cp.update && cp.update(dt, t), -24.5, -9.5, 1, 26); } catch (e) { } }
  for (let i = 0; i < 6; i++) swimIn(S, spriteFish('kakure', 0.24), { spd: 0.4 });
  /* 写真のとおり：砂地からニョキッ。チンアナゴ＆ニシキアナゴの水槽 */
  const GE = islandTank({ x0: -19.4, x1: -15.8, z0: -12.6, z1: -9.2, y: 0, h: 1.3, base: 0.8, top: '#a6e0ee', bot: '#3d8fb4', dim: 0.28 });
  const eels = [];
  for (let i = 0; i < 15; i++) {
    const nish = i % 4 === 3;
    let x, z, ok = false;
    for (let tries = 0; tries < 30 && !ok; tries++) { x = rnd(GE.B.x0 + 0.15, GE.B.x1 - 0.15); z = rnd(GE.B.z0 + 0.15, GE.B.z1 - 0.15); ok = eels.every(e => Math.hypot(e.x - x, e.z - z) > 0.42); }
    eels.push({ x, z, y: GE.floorY, kind: nish ? 'nishiki' : 'chin', L: nish ? rnd(0.36, 0.44) : rnd(0.44, 0.56), r: nish ? 0.021 : 0.019, yaw: 0.7 + rnd(-0.3, 0.3) });
  }
  gardenEels(GE, eels, { onAllOut: () => { if (!stampGot.anago) { getStamp('anago'); caption('🎤 飼育員さん', 'じっと待ってたら、みんな顔を出してくれたね！ チンアナゴはこわがりなんだ', 3000); } } });
  addFact({ x: -17.6, z: -10.9, f: 1, r: 3.3, name: 'チンアナゴ・ニシキアナゴ', txt: '砂にもぐって体を半分出し、流れてくるプランクトンを食べるよ。バタバタ近づくとひっこむから、そーっと来て、じっと待ってみて' });
  benches(-29, -15.8, 3, 4.2, 0);
  zoneBoard('D', -24, 4.6, -3.0, 0, 6);
  addFact({ x: -24, z: -18.5, f: 1, r: 6.5, zone: 'D', name: 'D コーラルリーフ・ダイビング', txt: '壁から天井までガラスの大水槽。サンゴ礁にクマノミやナンヨウハギ、ウミガメも泳いでいるよ' });
  addFact({ x: -24.5, z: -7, f: 1, r: 3.2, name: 'カクレクマノミ', txt: 'イソギンチャクのトゲに刺されない、ふしぎな体。イソギンチャクをおうちにしているよ' });
}

secEnd(); zoneGroup('zE', 1, 24, 0, 48, ['E1']);
/* ================= E 伊勢志摩の海・日本の海（1F） ================= */
{
  const T = TK.E_ise;
  for (let i = 0; i < 10; i++) rockAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0 + 0.5, T.B.z1), rnd(.5, 1.3), M.stone);
  for (const [k, n, len, spd] of [['kue', 4, 1.25, 0.35], ['mahata', 4, 1.0, 0.4], ['koshoudai', 6, 0.8, 0.5], ['ishidai', 4, 0.65, 0.55], ['kasago', 3, 0.45, 0.2]]) for (let i = 0; i < n; i++) swimIn(T, spriteFish(k, len), { spd, turn: 0.9, bottom: k === 'kasago' });
  /* 写真のとおり：底にウツボがごちゃっと */
  for (let i = 0; i < 7; i++) { const c = mk('makeMoray'); staticIn(T, c, rnd(17, 23), T.floorY, rnd(-25.2, -24.6) - rnd(0, 1.4), rnd(-1, 1) + (i % 2 ? Math.PI : 0)); if ('headUp' in c) c.headUp = Math.random() < 0.6 ? rnd(0.4, 1) : 0; }
  /* タコは岩の上に */
  const oct = mk('makeOctopus', { drape: 1 }); const rk = rockAt(T.g, 29.5, T.floorY - 0.12, -27.0, 0.48, M.stone); staticIn(T, oct, 29.5, T.floorY, -27.0, -0.6);
  /* 写真に写っていた太いロープ */
  const curve = new THREE.CatmullRomCurve3([V3n(31.5, T.floorY + 5.4, -27.8), V3n(27, T.floorY + 3.2, -27.0), V3n(23, T.floorY + 1.4, -26.2), V3n(20, T.floorY + 0.3, -25.6)]);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.045, 6), new THREE.MeshLambertMaterial({ color: 0x4a3a2a })); T.g.add(rope);
  const L = TK.E_lobster;
  for (let i = 0; i < 5; i++) rockAt(L.g, rnd(L.B.x0, L.B.x1), L.floorY, rnd(L.B.z0, L.B.z1), rnd(.25, .5), M.stone);
  for (let i = 0; i < 6; i++) swimIn(L, mk('makeCrustacean', 'ise'), { spd: 0.08, bottom: true, turn: 0.4 });
  const Tk = TK.E_takaashi;
  for (let i = 0; i < 2; i++) swimIn(Tk, mk('makeCrustacean', 'takaashi'), { spd: 0.06, bottom: true, turn: 0.3 });
  zoneBoard('E', 24, 4.4, -12, 0, 6.2);
  addFact({ x: 24, z: -19.5, f: 1, r: 6.5, zone: 'E', name: 'E 伊勢志摩の海・日本の海', txt: '熊野灘や伊勢湾の海。クエ・マハタ・コショウダイがゆうゆう泳ぎ、底にはウツボがかたまっているよ' });
  addFact({ x: 29.5, z: -21.5, f: 1, r: 3.0, name: 'タコ', txt: '8本のうでに吸盤がずらり。岩のすきまが大好きで、体の色を一瞬で変えられる' });
  addFact({ x: 19, z: 21, f: 1, r: 3.6, zone: 'E', name: 'イセエビ', txt: '伊勢志摩の名物。長い触角でまわりをさぐる。夜行性で、昼は岩かげでじっとしている' });
  addFact({ x: 28.5, z: 21, f: 1, r: 4.2, zone: 'E', name: 'タカアシガニ', txt: '足を広げると3m以上！世界最大のカニ。深い海にすんでいる' });
  addFact({ x: 24, z: 3, f: 1, r: 5, name: '鳥羽は海女さんの町', txt: '素もぐりでアワビやサザエをとる海女さん。鳥羽・志摩は日本で一番海女さんが多い地域だよ' });
  benches(19, -9.5, 3, 4.2, 0);
}
function V3n(x, y, z) { return new THREE.Vector3(x, y, z); }

secEnd(); zoneGroup('zShop', 1, 45, 0, 34, ['SHOP1', 'REST1']);
/* ================= ショップ・レストラン（1F東） ================= */
{
  const shelfM = new THREE.MeshLambertMaterial({ color: 0xf2e6d0 });
  const plush = ['makeSeaLionPlush', 'makeOtterPlush', 'makeDugongPlush'];
  for (let r = 0; r < 3; r++) {
    const sh = box(6, 1.5, 0.9, shelfM); sh.position.set(44, 0.75, 6 + r * 4.5); scene.add(sh); addSolid(41, 47, 0, 1.6, 5.55 + r * 4.5, 6.45 + r * 4.5);
    for (let i = 0; i < 6; i++) { const c = mk(plush[(i + r) % 3]); c.g.position.set(41.6 + i * 0.95, 1.5, 6 + r * 4.5); c.g.rotation.y = rnd(-0.5, 0.5) + (r % 2 ? Math.PI : 0); c.g.scale.setScalar(0.9); scene.add(c.g); }
  }
  const cnt = box(4, 1.0, 1.2, M.deck); cnt.position.set(52, 0.5, 4); scene.add(cnt); addSolid(50, 54, 0, 1.1, 3.4, 4.6);
  const ss = sign3D(['メインショップ', 'アシカ・ラッコ・ジュゴンのぬいぐるみ'], { w: 5.8, h: 1.4, hang: 4.2, ceil: CEIL, bg: '#7a3a6a', f2: 44 }); ss.position.set(44, 0, 2);
  const se = sign3D(['水の回廊（屋外）▶', 'ペンギン・セイウチ・ペリカン'], { w: 5, h: 1.4, posts: 2, bg: '#7a6a12', f2: 46 }); se.position.set(53.5, 0, 13.6); se.rotation.y = -Math.PI / 2;
  /* レストラン */
  for (let i = 0; i < 6; i++) {
    const x = 39 + (i % 3) * 5.5, z = -18 + Math.floor(i / 3) * 7;
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 16), new THREE.MeshLambertMaterial({ color: 0xf4efe6 })); tb.position.set(x, 0.75, z); scene.add(tb);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.72, 8), M.metal); leg.position.set(x, 0.36, z); scene.add(leg);
    addSolid(x - 0.7, x + 0.7, 0, 0.8, z - 0.7, z + 0.7);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const ch = box(0.45, 0.45, 0.45, new THREE.MeshLambertMaterial({ color: 0x2f7fa8 })); ch.position.set(x + Math.cos(a) * 1.05, 0.23, z + Math.sin(a) * 1.05); scene.add(ch); }
  }
  const rs = sign3D(['レストラン', '鳥羽湾をながめながら ひと休み'], { w: 5.4, h: 1.4, hang: 4.2, ceil: CEIL, bg: '#6a4a1a', f2: 46 }); rs.position.set(44, 0, -3);
}

secEnd();

zoneGroup('zF', 2, -24, 12, 46, ['F2']);
/* ================= F ジャングルワールド（2F） ================= */
{
  const Y = FY[2], T = TK.F_amazon;
  /* 写真の大水槽：ピラルク・パクー・レッドテールキャット・ピラニア */
  for (let i = 0; i < 3; i++) swimIn(T, photoFish('pirarucu', 2.7), { spd: 0.35, turn: 0.4 });
  for (let i = 0; i < 4; i++) swimIn(T, spriteFish('pacu', 0.85), { spd: 0.4, turn: 0.6 });
  for (let i = 0; i < 2; i++) swimIn(T, spriteFish('redtail', 1.35), { spd: 0.3, turn: 0.5, bottom: true });
  for (let i = 0; i < 7; i++) swimIn(T, photoFish('piranha', 0.42), { spd: 0.6, turn: 1.2 });
  const woodM = new THREE.MeshLambertMaterial({ color: 0x5a4430 });
  for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, rnd(3, 5), 7), woodM); w.position.set(rnd(-32, -17), T.floorY + 1.5, rnd(26.5, 29.5)); w.rotation.set(rnd(-0.6, 0.6), rnd(0, 6), rnd(-1.2, 1.2)); T.g.add(w); }
  for (let i = 0; i < 10; i++) weedAt(T.g, rnd(-32.5, -16), T.floorY, rnd(27.5, 30), rnd(1, 2.4));
  for (let i = 0; i < 8; i++) rockAt(T.g, rnd(-32, -17), T.floorY, rnd(25.5, 30), rnd(.4, .9), M.stone);
  /* マナティーのプール（ガラス張り。南側の台にのぼると上からのぞける） */
  const px0 = -31, px1 = -18.5, pz0 = 4, pz1 = 13, wTop = Y + 1.9, rim = Y + 2.1;
  const pool = new THREE.Group(); scene.add(pool);
  const pb = new THREE.MeshBasicMaterial({ map: tankBackTex('#5fa89a', '#163d3a'), side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false });
  const vol = box(px1 - px0 - 0.1, wTop - Y - 0.05, pz1 - pz0 - 0.1, pb); vol.position.set((px0 + px1) / 2, (Y + wTop) / 2, (pz0 + pz1) / 2); pool.add(vol);
  const pg = box(px1 - px0, rim - Y, pz1 - pz0, M.glass); pg.position.set((px0 + px1) / 2, (Y + rim) / 2, (pz0 + pz1) / 2); pool.add(pg);
  addSolid(px0, px1, Y, rim, pz0, pz1);
  const rimM = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
  for (const [w, d, x, z] of [[px1 - px0 + 0.3, 0.3, (px0 + px1) / 2, pz0], [px1 - px0 + 0.3, 0.3, (px0 + px1) / 2, pz1], [0.3, pz1 - pz0, px0, (pz0 + pz1) / 2], [0.3, pz1 - pz0, px1, (pz0 + pz1) / 2]]) { const r = box(w, 0.12, d, rimM); r.position.set(x, rim, z); pool.add(r); }
  const wm = new THREE.MeshBasicMaterial({ map: waterTex.clone(), color: 0x8fd8c8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }); wm.map.needsUpdate = true; wm.map.repeat.set(3, 2);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0 - 0.1, pz1 - pz0 - 0.1), wm); ws.rotation.x = -Math.PI / 2; ws.position.set((px0 + px1) / 2, wTop, (pz0 + pz1) / 2); pool.add(ws);
  const pfl = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, pz1 - pz0), M.sand); pfl.rotation.x = -Math.PI / 2; pfl.position.set((px0 + px1) / 2, Y + 0.02, (pz0 + pz1) / 2); pool.add(pfl);
  const lr = rockAt(pool, -20.5, Y, 6, 0.9, M.stoneWall);
  /* のぞき台（写真の、身を乗り出してのぞく丸い窓） */
  const deck = box(5, 0.9, 2, M.deck); deck.position.set(-25, Y + 0.45, 14.3); scene.add(deck);
  addGround(-27.5, -22.5, 13.3, 15.3, Y + 0.9);
  addGround(-27.5, -22.5, 15.3, 18.3, { axis: 'z', a: 15.3, b: 18.3, ha: Y + 0.9, hb: Y });
  const st = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.15), M.deck); st.rotation.x = -Math.PI / 2 + Math.atan2(0.9, 3); st.position.set(-25, Y + 0.45, 16.8); scene.add(st);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 12, 0, Math.PI, 0, Math.PI / 2), M.glass); bub.position.set(-25, rim, pz1); bub.rotation.y = Math.PI; bub.scale.set(1, 0.6, 0.8); scene.add(bub);
  cull(pool, -25, 8, 2, 40);
  const MB = { x0: px0 + 1.4, x1: px1 - 1.4, y0: Y + 0.55, y1: wTop - 0.5, z0: pz0 + 1.2, z1: pz1 - 1.2 };
  const MT = { g: pool, B: MB, cx: -25, cz: 8, f: 2 };
  const mans = [];
  for (let i = 0; i < 2; i++) {
    const c = mk('makeManatee'); const ctl = swimIn(MT, c, { spd: 0.18, turn: 0.4, r: 34 });
    mans.push({ c, ctl, rest: true, t: rnd(4, 14) });
  }
  /* ほとんど寝てる：底でじっと。たまに息つぎで水面へ */
  onUpdate((dt, t) => {
    for (const m of mans) {
      m.t -= dt;
      if (m.rest) { if (m.c.setRest) m.c.setRest(true); m.ctl.speedMul = 0; m.c.g.position.y = lerp(m.c.g.position.y, MB.y0 - 0.1, dt * 0.6); if (m.t < 0) { m.rest = false; m.t = rnd(6, 9); if (m.c.setRest) m.c.setRest(false); } }
      else { m.ctl.speedMul = 1; if (m.t > 4) m.c.g.position.y = lerp(m.c.g.position.y, MB.y1, dt * 0.5); if (m.t < 0) { m.rest = true; m.t = rnd(14, 26); } }
    }
    wm.map.offset.x += dt * 0.02;
  }, -25, 8, 2, 34);
  /* 水草水槽（写真：流木とモスのじゅうたん） */
  const A = islandTank({ x0: -33, x1: -27.5, z0: 16, z1: 21.5, y: Y, h: 1.3, base: 0.8, top: '#3f8fd0', bot: '#0b3a5c', dim: 0.25 });
  const mossTex = ctex(128, 128, (g, w, h) => { g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { g.strokeStyle = `rgba(${60 + rnd(0, 90) | 0},${150 + rnd(0, 80) | 0},${40 + rnd(0, 40) | 0},.8)`; g.lineWidth = 1; g.beginPath(); const x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); g.lineTo(x + rnd(-4, 4), y - rnd(2, 7)); g.stroke(); } }, 3, 3);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 5.3), new THREE.MeshLambertMaterial({ map: mossTex })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(-30.25, A.floorY + 0.04, 18.75); A.g.add(carpet);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rnd(.25, .5), 10, 8), new THREE.MeshLambertMaterial({ map: mossTex, color: 0xcfe8a0 })); b.scale.y = 0.6; b.position.set(rnd(-32.4, -28), A.floorY + 0.15, rnd(16.6, 21)); A.g.add(b); }
  const dwM = new THREE.MeshLambertMaterial({ color: 0xd8c8a8 });
  for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, rnd(0.8, 1.6), 6), dwM); w.position.set(-29.3 + rnd(-.4, .4), A.floorY + 0.5, 18.4 + rnd(-.5, .5)); w.rotation.set(rnd(-1.2, 1.2), rnd(0, 6), rnd(-1.2, 1.2)); A.g.add(w); }
  for (let i = 0; i < 5; i++) weedAt(A.g, rnd(-32.6, -28), A.floorY + 0.8, rnd(16.3, 17.2), rnd(.6, 1.0));
  for (let i = 0; i < 10; i++) swimIn(A, photoFish('neon_tetra', 0.12), { spd: 0.5 });
  /* ヤシ（ジャングル感） */
  for (const [x, z] of [[-16, 2], [-33, 2], [-16, 22.5], [-21, 14.5]]) btree('tree_palm', x, Y, z, 4.6);
  zoneBoard('F', -24, Y + 4.6, 2.6, 0, 6);
  addFact({ x: -24, z: 21.3, f: 2, r: 5.5, zone: 'F', name: 'F ジャングルワールド（アマゾンの大水槽）', txt: 'ピラルク・パクー・レッドテールキャットフィッシュ。アマゾン川の大きな魚がいっしょに泳ぐ' });
  addFact({ x: -25, z: 14.6, f: 2, r: 3.4, name: 'アフリカマナティー', txt: '日本で見られるのはここだけ。ほとんど水底でお昼寝…なかなか動かない！たまに息つぎで上がってくるよ' });
  addFact({ x: -30, z: 15, f: 2, r: 3.2, name: '水草の水槽', txt: '流木とふかふかのモス。小さなネオンテトラがキラキラ' });
}

secEnd();

/* ================= G 奇跡の森（2F） ================= */
let tortoiseTpl = null; const tortoiseWait = [];
/* 手作りのケヅメリクガメ（公開版用）。こんもりした甲羅＋太い脚。描画は2つにまとめる */
function makeTortoiseTpl() {
  const grp = new THREE.Group();
  const shellTex = ctex(256, 128, (c, w, h) => {
    c.fillStyle = '#b48a52'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
      const cx = (i + (row % 2) * 0.5) * (w / 6) + 10, cy = 18 + row * 40, r = 19;
      c.fillStyle = row === 0 ? '#c79d60' : '#bf9658'; c.strokeStyle = '#6a4a26'; c.lineWidth = 4;
      c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85); } c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(106,74,38,.45)'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; c.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.5); } c.closePath(); c.stroke();
    }
  });
  shellTex.wrapT = THREE.ClampToEdgeWrapping;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: shellTex }));
  shell.scale.set(0.36, 0.3, 0.46); shell.position.y = 0.16; grp.add(shell);
  const parts = [], add = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => { geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z); parts.push([geo, col]); };
  const rim = new THREE.CylinderGeometry(1, 1, 0.06, 24); rim.scale(0.37, 1, 0.47); add(rim, 0x8a6638, 0, 0.16, 0);
  const belly = new THREE.CylinderGeometry(1, 0.92, 0.1, 20); belly.scale(0.33, 1, 0.43); add(belly, 0xc9b285, 0, 0.11, 0);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    add(new THREE.CylinderGeometry(0.075, 0.09, 0.17, 8), 0x9c8a66, sx * 0.25, 0.08, sz * 0.27, 0, 0, sx * 0.25);
    add(new THREE.SphereGeometry(0.095, 8, 6), 0x8f7d5a, sx * 0.27, 0.02, sz * 0.27);
  }
  add(new THREE.CylinderGeometry(0.06, 0.075, 0.2, 8), 0xa39070, 0, 0.17, 0.5, Math.PI / 2 - 0.35);
  const head = new THREE.SphereGeometry(1, 12, 10); head.scale(0.085, 0.075, 0.11); add(head, 0xa89474, 0, 0.22, 0.6);
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.016, 6, 5), 0x141414, sx * 0.06, 0.245, 0.64);
  add(new THREE.ConeGeometry(0.03, 0.08, 6), 0x9c8a66, 0, 0.13, -0.49, -Math.PI / 2);
  grp.add(new THREE.Mesh(mergeGeo(parts), new THREE.MeshLambertMaterial({ vertexColors: true })));
  return grp;
}
if (__PUBLIC__) tortoiseTpl = makeTortoiseTpl();
else loadEmbeddedGltf('tortoise.gltf', gltf => {
  const root = gltf.scene || gltf.scenes[0]; if (!root) return;
  root.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.emissiveMap = null; o.material.emissive && o.material.emissive.set(0); o.material.metalness = 0; o.material.roughness = 0.9; o.material.color && o.material.color.set(0xf2e2c8); } });
  const bb = new THREE.Box3().setFromObject(root), sz = new THREE.Vector3(); bb.getSize(sz);
  root.scale.setScalar(0.62 / Math.max(0.001, sz.y));
  const bb2 = new THREE.Box3().setFromObject(root), c = new THREE.Vector3(); bb2.getCenter(c); root.position.set(-c.x, -bb2.min.y, -c.z);
  tortoiseTpl = new THREE.Group(); tortoiseTpl.add(root);
  tortoiseWait.forEach(fn => fn()); tortoiseWait.length = 0;
}, e => console.warn('tortoise', e));
zoneGroup('zG', 2, -24, -12, 46, ['G2']);
{
  const Y = FY[2], T = TK.G_cat;
  /* スナドリネコ：写真のとおり、段々の岩棚の上でびろーんとお昼寝 */
  const ledgeM = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0x9a9890 });
  for (let i = 0; i < 3; i++) { const l = box(6.6 - i * 1.2, 0.45, 1.6 - i * 0.15, ledgeM); l.position.set(-29.3 + i * 0.3, T.floorY + 0.22 + i * 0.45, -28.6 + i * 0.75); T.g.add(l); }
  const wallTile = new THREE.Mesh(new THREE.PlaneGeometry(T.W - 0.2, 3.4), new THREE.MeshLambertMaterial({ map: ctex(256, 128, (g, w, h) => { g.fillStyle = '#d6d2c8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a8a294'; g.lineWidth = 4; for (let x = 0; x <= w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }, 2, 1) }));
  wallTile.position.set(T.cx, T.floorY + 1.8, BZ0 - T.D + 0.12); T.g.add(wallTile);
  for (let i = 0; i < 4; i++) rockAt(T.g, rnd(-32.5, -26), T.floorY, rnd(-25.6, -24.8), rnd(.3, .5), M.stone);
  const cat = mk('makeFishingCat'); T.g.add(cat.g);
  cat.g.position.set(-29.8, T.floorY + 1.35, -27.25); cat.g.rotation.y = -Math.PI / 2;
  if (cat.setSleep) cat.setSleep(true);
  onUpdate((dt, t) => cat.update(dt, t), T.cx, T.cz, 2, 30);
  /* ミシシッピーワニ：浅い水場＋クワズイモの大きな葉っぱ */
  const A = TK.G_gator;
  const gw = new THREE.Mesh(new THREE.PlaneGeometry(A.W - 0.4, 3.6), new THREE.MeshBasicMaterial({ map: waterTex.clone(), color: 0x9fb89a, transparent: true, opacity: 0.55, depthWrite: false }));
  gw.material.map.needsUpdate = true; gw.material.map.repeat.set(3, 1.2); gw.rotation.x = -Math.PI / 2; gw.position.set(A.cx, A.floorY + 0.38, BZ0 - 1.9); A.g.add(gw);
  const gfl = new THREE.Mesh(new THREE.PlaneGeometry(A.W - 0.4, 3.6), new THREE.MeshLambertMaterial({ color: 0xb8b498 })); gfl.rotation.x = -Math.PI / 2; gfl.position.set(A.cx, A.floorY + 0.02, BZ0 - 1.9); A.g.add(gfl);
  const bank = box(A.W - 0.4, 0.7, 2.6, new THREE.MeshLambertMaterial({ map: stoneTex, color: 0x8a8678 })); bank.position.set(A.cx, A.floorY + 0.35, BZ0 - 5.0); A.g.add(bank);
  const leafTex = ctex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#4f9a3a'; g.beginPath(); g.moveTo(64, 120); g.bezierCurveTo(-10, 90, 0, 10, 64, 4); g.bezierCurveTo(128, 10, 138, 90, 64, 120); g.fill(); g.strokeStyle = '#cfe8a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 118); g.lineTo(64, 10); g.stroke(); g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const y = 100 - i * 15; g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(36, y - 10, 14, y - 20); g.moveTo(64, y); g.quadraticCurveTo(92, y - 10, 114, y - 20); g.stroke(); } });
  leafTex.wrapS = leafTex.wrapT = THREE.ClampToEdgeWrapping;
  const leafM = new THREE.MeshLambertMaterial({ map: leafTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const stemM = new THREE.MeshLambertMaterial({ color: 0x7aa85a });
  for (let i = 0; i < 6; i++) {
    const x = -23.5 + i * 1.5 + rnd(-.3, .3), z = BZ0 - 5.4 + rnd(-.5, .5), hgt = rnd(1.4, 2.3);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, hgt, 6), stemM); st.position.set(x, A.floorY + 0.7 + hgt / 2, z); st.rotation.z = rnd(-.3, .3); A.g.add(st);
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), leafM); lf.position.set(x + rnd(-.2, .2), A.floorY + 0.7 + hgt + 0.5, z + 0.4); lf.rotation.set(-0.5 + rnd(-.3, .3), rnd(-.6, .6), rnd(-.4, .4)); A.g.add(lf);
  }
  const gator = mk('makeAlligator'); A.g.add(gator.g); gator.g.position.set(-19.5, A.floorY + 0.03, BZ0 - 1.7); gator.g.rotation.y = -Math.PI / 2 - 0.35;
  let yawnT = rnd(8, 16);
  onUpdate((dt, t) => { gator.update(dt, t); gw.material.map.offset.x += dt * 0.01; yawnT -= dt; if (yawnT < 0) { yawnT = rnd(14, 26); gator.setAction && gator.setAction('yawn'); } }, A.cx, A.cz, 2, 30);
  /* ケヅメリクガメのお部屋（写真：低い壁＋黒い柵・土・水場・ヒーターのライト） */
  const pen = { x0: -24, x1: -15.5, z0: -14.5, z1: -6.5 };
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(pen.x1 - pen.x0, pen.z1 - pen.z0), new THREE.MeshLambertMaterial({ map: ctex(128, 128, (g, w, h) => { g.fillStyle = '#7a5a3e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${70 + rnd(0, 60) | 0},${50 + rnd(0, 40) | 0},${30 + rnd(0, 30) | 0},.5)`; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); } }, 3, 3) }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.set((pen.x0 + pen.x1) / 2, Y + 0.02, (pen.z0 + pen.z1) / 2); scene.add(dirt);
  const wallM = new THREE.MeshLambertMaterial({ color: 0xcdb48a });
  for (const [w, d, x, z] of [[pen.x1 - pen.x0, 0.3, (pen.x0 + pen.x1) / 2, pen.z1], [0.3, pen.z1 - pen.z0, pen.x1, (pen.z0 + pen.z1) / 2], [pen.x1 - pen.x0, 0.3, (pen.x0 + pen.x1) / 2, pen.z0], [0.3, pen.z1 - pen.z0, pen.x0, (pen.z0 + pen.z1) / 2]]) {
    const wl = box(w, 0.75, d, wallM); wl.position.set(x, Y + 0.37, z); scene.add(wl);
  }
  addSolid(pen.x0 - 0.15, pen.x1 + 0.15, Y, Y + 1.6, pen.z0 - 0.15, pen.z1 + 0.15);
  const barM = new THREE.MeshLambertMaterial({ color: 0x2a2e33 });
  const rail = box(pen.x1 - pen.x0, 0.06, 0.06, barM); rail.position.set((pen.x0 + pen.x1) / 2, Y + 1.55, pen.z1); scene.add(rail);
  for (let x = pen.x0 + 0.3; x < pen.x1; x += 0.32) { const b = box(0.03, 0.8, 0.03, barM); b.position.set(x, Y + 1.15, pen.z1); scene.add(b); }
  const back = box(pen.x1 - pen.x0, 1.8, 0.3, wallM); back.position.set((pen.x0 + pen.x1) / 2, Y + 0.9, pen.z0); scene.add(back);
  const tp = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshBasicMaterial({ map: waterTex, color: 0x8a9a70, transparent: true, opacity: .85 })); tp.rotation.x = -Math.PI / 2; tp.position.set(-21.5, Y + 0.05, -12.7); scene.add(tp);
  for (const x of [-22, -18]) { const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xd8dde2, side: THREE.DoubleSide })); lamp.position.set(x, Y + 2.2, -13.8); lamp.rotation.x = Math.PI; scene.add(lamp); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd08a })); bulb.position.set(x, Y + 2.1, -13.8); scene.add(bulb); }
  const glow = new THREE.PointLight(0xffc070, 0.8, 7); glow.position.set(-20, Y + 2, -12); scene.add(glow);
  const torts = [];
  const spawnT = (x, z, s) => { const place = () => { const g = tortoiseTpl.clone(true); g.scale.setScalar(s); g.position.set(x, Y + 0.02, z); g.rotation.y = rnd(0, 6.28); scene.add(g); torts.push({ g, t: rnd(0, 9), tgt: null, wait: rnd(1, 5) }); }; if (tortoiseTpl) place(); else tortoiseWait.push(place); };
  spawnT(-21, -9, 1.0); spawnT(-18, -11.5, 0.85); spawnT(-17.5, -8, 0.7);
  onUpdate((dt, t) => {
    for (const T2 of torts) {
      T2.t += dt; const p = T2.g.position;
      if (T2.wait > 0) { T2.wait -= dt; continue; }
      if (!T2.tgt) T2.tgt = { x: rnd(pen.x0 + 1, pen.x1 - 1), z: rnd(pen.z0 + 1, pen.z1 - 1) };
      const dx = T2.tgt.x - p.x, dz = T2.tgt.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { T2.tgt = null; T2.wait = rnd(3, 9); continue; }
      let a = Math.atan2(dx, dz) - T2.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); T2.g.rotation.y += a * Math.min(1, dt * 1.5);
      p.x += dx / d * 0.18 * dt; p.z += dz / d * 0.18 * dt; T2.g.rotation.z = Math.sin(T2.t * 3) * 0.03;
    }
  }, -20, -10, 2, 30);
  /* イグアナ（枝の上） */
  const I = islandTank({ x0: -32.5, x1: -28.5, z0: -14, z1: -9.5, y: Y, h: 2.4, base: 0.5, top: '#a8d8a0', bot: '#3a6a40', dim: 0.15, floorMat: M.grass });
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 7), new THREE.MeshLambertMaterial({ color: 0x5a4430 })); br.rotation.z = 1.1; br.position.set(-30.5, I.floorY + 1.1, -11.7); I.g.add(br);
  const ig = mk('makeIguana'); staticIn(I, ig, -30.6, I.floorY + 1.28, -11.7, Math.PI / 2 - 0.45);
  for (let i = 0; i < 4; i++) weedAt(I.g, rnd(-32.2, -28.8), I.floorY, rnd(-13.7, -9.8), rnd(.6, 1.2));
  /* ヤドクガエルのテラリウム */
  const frogC = [[0x2a6ae0, 0x101010], [0xf2d02a, 0x101010], [0xe0402a, 0x2a2a2a]];
  frogC.forEach(([c1, c2], i) => {
    const F = islandTank({ x0: -32.5 + i * 3.4, x1: -30 + i * 3.4, z0: -3.6, z1: -1.6, y: Y, h: 0.9, base: 1.0, top: '#9fd8a0', bot: '#2a5a30', dim: 0.12, floorMat: M.grass });
    for (let k = 0; k < 3; k++) { const fr = mk('makePoisonFrog', c1, c2); staticIn(F, fr, rnd(F.B.x0, F.B.x1), F.floorY + 0.02, rnd(F.B.z0, F.B.z1), rnd(0, 6), 3.5); }
    weedAt(F.g, -31.2 + i * 3.4, F.floorY, -2.6, 0.7);
  });
  for (const [x, z] of [[-15.5, -2], [-15.5, -22.5], [-26, -16.5]]) btree('tree_palm', x, Y, z, 4.2);
  zoneBoard('G', -24, Y + 4.6, -2.0, Math.PI, 6);
  addFact({ x: -29.3, z: -21.5, f: 2, r: 4.0, zone: 'G', name: 'スナドリネコ', txt: '水にとびこんで魚をとる、およぎが得意なネコ。きょうは岩の上でぐっすりお昼寝中…' });
  addFact({ x: -20, z: -21.5, f: 2, r: 4.0, zone: 'G', name: 'ミシシッピーワニ', txt: 'アメリカの沼や川にすむワニ。口先が丸いU字なのがアリゲーターのなかまのしるし。ほとんど動かずじっとしている' });
  addFact({ x: -19.8, z: -5.4, f: 2, r: 3.6, zone: 'G', name: 'ケヅメリクガメ', txt: '前足にトゲ（けづめ）があるリクガメ。のんびり歩いて、ライトの下でひなたぼっこ' });
  addFact({ x: -30.5, z: -8.4, f: 2, r: 3, name: 'グリーンイグアナ', txt: '木の上でくらすトカゲ。のどの下のヒラヒラは「肉垂（にくすい）」' });
  addFact({ x: -28, z: -0.6, f: 2, r: 3.4, name: 'ヤドクガエル', txt: 'あざやかな色は「毒があるよ」のサイン。でも水族館のカエルは毒をもっていないよ' });
}

secEnd(); zoneGroup('zK', 2, 0, 12, 44, ['K2']);
/* ================= K へんな生きもの研究所（2F） ================= */
{
  const Y = FY[2];
  floorPlane(-14, 14, 0, 19.6, Y + 0.004, M.lobby, 3);
  /* 研究所らしい白い机と試験管 */
  const benchM = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
  for (const [x, z] of [[-8, 3.5], [6, 3.5]]) {
    const b = box(4.5, 0.9, 1.2, benchM); b.position.set(x, Y + 0.45, z); scene.add(b); addSolid(x - 2.25, x + 2.25, Y, Y + 1, z - 0.6, z + 0.6);
    for (let i = 0; i < 6; i++) { const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), new THREE.MeshBasicMaterial({ color: [0x7fd0ff, 0xffd27f, 0xb0ff9f, 0xff9fd0][i % 4], transparent: true, opacity: .8 })); tt.position.set(x - 1.6 + i * 0.6, Y + 1.06, z); scene.add(tt); }
  }
  const mic = new THREE.Group(); const mb = box(0.3, 0.06, 0.4, M.dark); mic.add(mb); const ma = box(0.06, 0.45, 0.06, M.dark); ma.position.set(0, 0.25, -0.1); mic.add(ma); const mt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), M.dark); mt.rotation.x = 0.5; mt.position.set(0, 0.42, 0); mic.add(mt); mic.position.set(-8, Y + 0.93, 3.5); scene.add(mic);
  /* ダイオウグソクムシ */
  const D = islandTank({ x0: -6, x1: 4, z0: 10, z1: 14, y: Y, h: 1.2, base: 0.7, top: '#1b3a5c', bot: '#040a14', dim: 0.5 });
  for (let i = 0; i < 6; i++) rockAt(D.g, rnd(-5.5, 3.5), D.floorY, rnd(10.4, 13.6), rnd(.15, .3), M.stone);
  for (let i = 0; i < 5; i++) swimIn(D, mk('makeGiantIsopod'), { spd: 0.04, bottom: true, turn: 0.3 });
  /* オオグソクムシ（小さめ）とほかの深海のなかま */
  const S = islandTank({ x0: 6, x1: 11, z0: 10, z1: 13, y: Y, h: 1.0, base: 0.8, top: '#203a5a', bot: '#050b16', dim: 0.5 });
  for (let i = 0; i < 6; i++) { const c = mk('makeGiantIsopod'); c.g.scale.setScalar(0.4); swimIn(S, c, { spd: 0.03, bottom: true, turn: 0.3 }); }
  const no1 = sign3D(['ダイオウグソクムシ No.1', '5年以上なにも食べずに生きた伝説'], { w: 4.6, h: 1.3, posts: 1.3, bg: '#2a2a3a', f2: 46 }); no1.position.set(-1, Y, 15.2);
  zoneBoard('K', 0, Y + 4.6, 7.5, 0, 6);
  addFact({ x: -1, z: 15.6, f: 2, r: 4, zone: 'K', name: 'ダイオウグソクムシ', txt: '深海にすむ大きなダンゴムシのなかま。鳥羽水族館のNo.1は5年以上も絶食したことで有名になったよ' });
  addFact({ x: 8.5, z: 14.6, f: 2, r: 3.4, name: 'オオグソクムシ', txt: 'ダイオウより小さい日本近海のなかま。死んだ魚を食べる「海のそうじ屋さん」' });
}

secEnd(); zoneGroup('zH', 2, 24, -12, 46, ['H2']);
/* ================= H 人魚の海（2F）＝ジュゴンのセレナ ================= */
const DUGONG = { c: null, ctl: null, lettuce: null };
{
  const T = TK.H_dugong;
  if (typeof ANIM.seagrassBed === 'function') { try { const sg = ANIM.seagrassBed(T.W - 0.8, T.D - 0.8); sg.g.position.set(T.cx, T.floorY, T.cz); T.g.add(sg.g); onUpdate((dt, t) => sg.update && sg.update(dt, t), T.cx, T.cz, 2, 34); } catch (e) { console.warn('seagrass', e); } }
  else for (let i = 0; i < 26; i++) weedAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0, T.B.z1), rnd(.5, 1.2));
  for (let i = 0; i < 5; i++) rockAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0, T.B.z0 + 2), rnd(.4, .9), M.stone);
  /* 写真のとおり：ガラスの近くの青いカゴ（海草とレタス）。セレナはここでもぐもぐ */
  const BK = { x: 24.25, z: BZ0 - 1.9, y: T.floorY };
  {
    const lat = ctex(128, 64, (g2, w, h) => {
      g2.fillStyle = '#2f7fe6'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#62a8ff'; g2.fillRect(0, 0, w, 5); g2.fillRect(0, h - 5, w, 5);
      g2.globalCompositeOperation = 'destination-out'; for (let y = 9; y < h - 10; y += 11) for (let x = 2; x < w; x += 9) g2.fillRect(x, y, 5, 7);
    }, 4, 1);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.4, 20, 1, true), new THREE.MeshLambertMaterial({ map: lat, alphaTest: 0.5, side: THREE.DoubleSide }));
    wall.position.set(BK.x, BK.y + 0.2, BK.z); T.g.add(wall);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshLambertMaterial({ color: 0x2a6fd0 })); bot.rotation.x = -Math.PI / 2; bot.position.set(BK.x, BK.y + 0.02, BK.z); T.g.add(bot);
    const parts = [];
    for (let i = 0; i < 10; i++) { const a = rnd(0, 6.28), rr = rnd(0, 0.24); const lf = new THREE.SphereGeometry(rnd(0.1, 0.15), 7, 5); lf.scale(1, 0.45, 1.35); lf.rotateY(rnd(0, 3)); lf.translate(BK.x + Math.cos(a) * rr, BK.y + rnd(0.16, 0.34), BK.z + Math.sin(a) * rr); parts.push([lf, [0x7cc55a, 0x9fd86e, 0x5aa848][i % 3]]); }
    for (let i = 0; i < 16; i++) { const a = rnd(0, 6.28), rr = rnd(0, 0.3), hh = rnd(0.25, 0.5); const bl = new THREE.BoxGeometry(0.03, hh, 0.008); bl.translate(0, hh / 2, 0); bl.rotateZ(rnd(-0.6, 0.6)); bl.rotateY(rnd(0, 3)); bl.translate(BK.x + Math.cos(a) * rr, BK.y + 0.22, BK.z + Math.sin(a) * rr); parts.push([bl, 0x3f8a3a]); }
    T.g.add(new THREE.Mesh(mergeGeo(parts), new THREE.MeshLambertMaterial({ vertexColors: true })));
    /* 水にただよう海草のかけら（緑っぽい水） */
    const N = 170, P = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { P[i * 3] = rnd(T.B.x0, T.B.x1); P[i * 3 + 1] = rnd(T.B.y0, T.B.y1); P[i * 3 + 2] = rnd(T.B.z0, T.B.z1); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xa6d488, size: 0.06, transparent: true, opacity: 0.75, depthWrite: false })); T.g.add(pts);
    onUpdate((dt, t) => pts.position.set(Math.sin(t * 0.07) * 0.5, Math.sin(t * 0.11) * 0.25, Math.cos(t * 0.05) * 0.3), T.cx, T.cz, 2, 34);
  }
  const c = mk('makeDugong'); DUGONG.c = c;
  const ctl = DUGONG.ctl = swimIn(T, c, { spd: 0.45, turn: 0.5, surface: 25, r: 40, radius: 0.8 });
  for (let i = 0; i < 8; i++) swimIn(T, spriteFish('iwashi', 0.3), { spd: 1.0 });
  /* セレナの気まぐれ：①カゴでごはん ②ガラスの前で立ち泳ぎのごあいさつ（どちらも写真から） */
  const I = ctl.bounds, z1N = I ? I.z1 : 0, GY = FY[2] + 2.3, GZ0 = BZ0 - 1.5, GZ1 = BZ0 - 0.85;
  const S = DUGONG.st = { mode: 'free', t: 0, k: 0, cool: 6, selfT: rnd(20, 32), nearT: 0, side: 1, pose: 'greet', feed: null, dur: 0, greets: 0, gx: 24, yawP: 0 };
  const dmp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), eB = new THREE.Euler(0, 0, 0, 'YXZ'), tgt = new THREE.Vector3();
  const near = () => player.pos.y > FY[2] - 0.5 && player.pos.x > 15.5 && player.pos.x < 33 && player.pos.z > BZ0 && player.pos.z < BZ0 + 4.6;
  const release = cool => {
    S.mode = 'release'; S.t = 0; ctl.lure = null; ctl.speedMul = 1; c.setGraze && c.setGraze(false); S.cool = cool;
    if (ctl.sync) ctl.sync(S.pose === 'greet' ? S.yawP : -S.side * Math.PI / 2, 0);
    if (I) ctl.tgt.set(clamp(c.g.position.x + rnd(-4, 4), I.x0, I.x1), rnd(I.y0 + 0.4, I.y1 - 1), I.z0 + rnd(0.5, 2.5));
  };
  const makeLettuce = () => { try { if (typeof ANIM.lettuce === 'function') { const l = ANIM.lettuce(); return l.g || l; } } catch (e) { } const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshLambertMaterial({ color: 0x8ad05a })); m.scale.set(1, 0.5, 1.6); return m; };
  DUGONG.giveLettuce = () => { if (S.feed) return; const m = makeLettuce(); m.position.set(BK.x + rnd(-0.08, 0.08), T.surfY - 0.15, BK.z + rnd(-0.08, 0.08)); T.g.add(m); S.feed = { m, v: 0, eat: 0 }; };
  onUpdate((dt, t) => {
    const p = c.g.position; S.t += dt; S.cool -= dt;
    S.nearT = near() ? S.nearT + dt : 0;
    if (S.feed && S.feed.m.position.y > BK.y + 0.3) { const m = S.feed.m; S.feed.v += dt * 0.7; m.position.y = Math.max(BK.y + 0.3, m.position.y - S.feed.v * dt); m.rotation.y += dt * 1.5; m.rotation.z = 0.3 * Math.sin(t * 2); }
    switch (S.mode) {
      case 'free':
        if (I && I.z1 > z1N) I.z1 = Math.max(z1N, Math.min(I.z1, p.z + 0.02));
        if (S.feed) { S.mode = 'toBasket'; S.t = 0; S.side = p.x < BK.x ? -1 : 1; }
        else if (S.nearT > 1.2 && S.cool <= 0) { S.mode = 'toGlass'; S.t = 0; S.gx = clamp(player.pos.x, 17.5, 31); }
        else if ((S.selfT -= dt) <= 0) { S.mode = 'toBasket'; S.t = 0; S.side = p.x < BK.x ? -1 : 1; }
        break;
      case 'toGlass':
        tgt.set(S.gx, GY, GZ0); ctl.lure = tgt;
        if (S.feed) release(2);
        else if (p.distanceTo(tgt) < 0.8 || S.t > 14) {
          S.mode = 'hold'; S.pose = 'greet'; S.t = 0; ctl.speedMul = 0; if (I) I.z1 = GZ1 + 0.01; S.yawP = 0; S.greets++;
          if (S.greets === 1) caption('🎤 飼育員さん', 'セレナがガラスの前に来てくれたよ！ 立ち泳ぎで、こっちを見てるね', 3000); else toast('🧜 セレナがあいさつに来た！');
        }
        break;
      case 'hold': {
        S.yawP = dmp(S.yawP, clamp(Math.atan2(player.pos.x - p.x, player.pos.z - p.z), -0.7, 0.7), 1.5, dt);
        tgt.set(S.gx, GY + 0.08 * Math.sin(t * 0.9), lerp(GZ0, GZ1, S.k)); p.lerp(tgt, 1 - Math.exp(-2.5 * dt)); ctl.lure = tgt;
        if (S.feed || S.t > 8 || (S.nearT === 0 && S.t > 2.5)) release(S.feed ? 1 : 26);
        break;
      }
      case 'toBasket':
        tgt.set(BK.x + S.side * 1.0, BK.y + 0.78, BK.z); ctl.lure = tgt;
        if (p.distanceTo(tgt) < 0.5 || S.t > 16) { S.mode = 'graze'; S.pose = 'graze'; S.t = 0; ctl.speedMul = 0; c.setGraze && c.setGraze(true); S.dur = rnd(6, 9); }
        break;
      case 'graze': {
        tgt.set(BK.x + S.side * 1.0, BK.y + 0.78, BK.z); p.lerp(tgt, 1 - Math.exp(-2.5 * dt)); ctl.lure = tgt;
        if (Math.random() < dt * 2.2 && player.pos.distanceTo(p) < 11) SE.crunch();
        const F = S.feed;
        if (F && F.m.position.y <= BK.y + 0.31) {
          F.eat += dt; F.m.scale.setScalar(Math.max(0.05, 1 - F.eat / 5));
          if (F.eat > 5) { T.g.remove(F.m); S.feed = null; FX.hearts(p.x, p.y + 0.8, p.z, 3); caption('🎤 飼育員さん', 'もぐもぐ…ごちそうさま！ セレナ、ぜんぶ食べたね', 2400); if (!stampGot.serena) getStamp('serena'); release(8); S.selfT = rnd(40, 60); }
        } else if (!F && S.t > S.dur) { release(10); S.selfT = rnd(40, 65); }
        break;
      }
      case 'release':
        if (S.pose === 'greet') { p.z = Math.min(p.z, lerp(GZ0, GZ1, S.k)); ctl.speedMul = S.k < 0.12 ? 1 : 0; }
        if (S.t > 1.8 && S.k < 0.05) { S.mode = 'free'; ctl.speedMul = 1; }
        break;
    }
    const want = (S.mode === 'hold' || S.mode === 'graze') ? 1 : 0;
    S.k = dmp(S.k, want, want ? 1.4 : 1.8, dt);
    if (S.k > 0.003) {
      qA.copy(c.g.quaternion);
      if (S.pose === 'greet') eB.set(-1.25 + 0.06 * Math.sin(t * 1.3), S.yawP, 0); else eB.set(0.3, -S.side * Math.PI / 2, 0);
      qB.setFromEuler(eB); c.g.quaternion.slerpQuaternions(qA, qB, S.k);
    }
  }, T.cx, T.cz, 2, 40);
  benches(18.5, -6.5, 3, 4.2, 0, FY[2]);
  zoneBoard('H', 24, FY[2] + 4.6, -2.2, Math.PI, 6);
  addFact({ x: 24, z: -19.5, f: 2, r: 7, zone: 'H', name: 'H 人魚の海 — ジュゴンのセレナ', txt: '日本でジュゴンに会えるのはここだけ。セレナは1987年からいる女の子。1日に約30kgの海草やレタスを食べるよ' });
}

secEnd(); zoneGroup('zJelly', 2, 24, 12, 36, ['JELLY2']);
/* ================= 特別展示室（クラゲの部屋・2F） ================= */
const JELLY = { inside: false };
{
  const Y = FY[2];
  floorPlane(14, 34, 0, BZ1, Y + 0.004, M.floorDark, 3);
  const cols = [0x5ad0ff, 0xff7ad8, 0xa07aff, 0x5affc8, 0xffc85a, 0x7a9cff];
  const tanks = [];
  [[18.5, 7], [24, 5.5], [29.5, 7], [18.5, 17], [24, 18.5], [29.5, 17]].forEach(([x, z], i) => {
    const spot = i === 4;   // 写真の「白い水玉のクラゲ」の水槽（色は変わらない深い青）
    const g = new THREE.Group(); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.8, 24), M.dark); base.position.set(x, Y + 0.4, z); g.add(base);
    const glowM = new THREE.MeshBasicMaterial({ color: spot ? 0x2456c8 : cols[i], transparent: true, opacity: spot ? 0.34 : 0.22, depthWrite: false, side: THREE.BackSide });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.8, 24, 1, true), glowM); water.position.set(x, Y + 2.2, z); g.add(water);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(1.03, 1.03, 2.8, 24, 1, true), M.glass); gl.position.copy(water.position); g.add(gl);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 24), M.dark); cap.position.set(x, Y + 3.7, z); g.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: spot ? 0x8ab4ff : cols[i] })); ring.rotation.x = Math.PI / 2; ring.position.set(x, Y + 0.82, z); g.add(ring);
    addSolid(x - 1.2, x + 1.2, Y, Y + 3.8, z - 1.2, z + 1.2);
    const B = { x0: x - 0.55, x1: x + 0.55, y0: Y + 1.2, y1: Y + 3.1, z0: z - 0.55, z1: z + 0.55 };
    const T = { g, B, cx: x, cz: z, f: 2 };
    if (spot) for (let k = 0; k < 3; k++) swimIn(T, makeSpottedJelly(), { spd: 0.06, turn: 0.35, r: 30, pitchMul: 0.3 });
    else for (let k = 0; k < 4; k++) swimIn(T, mk('makeJellyfish', cols[i]), { spd: 0.08, turn: 0.4, r: 30 });
    tanks.push({ glowM, ring, i, fixed: spot });
    cull(g, x, z, 2, 30);
  });
  /* 色がゆっくり変わる */
  const col = new THREE.Color();
  onUpdate((dt, t) => { tanks.forEach(T => { if (T.fixed) return; col.setHSL(((t * 0.03) + T.i / 6) % 1, 0.75, 0.6); T.glowM.color.copy(col); T.ring.material.color.copy(col); }); }, 24, 12, 2, 26);
  const js = sign3D(['特別展示室', 'クラゲ ― ふわふわ光る海の妖精'], { w: 5.6, h: 1.4, hang: Y + 4.6, ceil: Y + CEIL, bg: '#2a1a4a', frame: '#c8a8ff', f2: 46 }); js.position.set(24, 0, 12);
  addFact({ x: 24, z: 12, f: 2, r: 6.5, name: '特別展示室（クラゲ）', txt: 'クラゲは脳も心臓もないのに、体のふちの神経でふわふわ泳ぐ。体の95%以上が水！' });
  addFact({ x: 24, z: 16.6, f: 2, r: 2.4, name: '白い水玉のクラゲ（タコクラゲのなかま）', txt: 'かさに白い水玉もよう。体の中に小さな藻（褐虫藻）をすまわせていて、光をあびると栄養を分けてもらえるんだって' });
}

secEnd(); zoneGroup('zI', 2, 45, -12, 46, ['I2']);
/* ================= I 極地の海（2F）＝ラッコ・イロワケイルカ ================= */
const OTTERS = { list: [], surfY: 0, T: null };
{
  const T = TK.I_otter; OTTERS.T = T; OTTERS.surfY = T.surfY;
  if (typeof ANIM.iceRocks === 'function') { try { const ir = ANIM.iceRocks(T.W - 1, 2.4); const g = ir.g || ir; g.position.set(T.cx, T.surfY - 0.6, T.B.z0 + 0.6); T.g.add(g); } catch (e) { console.warn('ice', e); } }
  else for (let i = 0; i < 8; i++) rockAt(T.g, rnd(T.B.x0, T.B.x1), T.surfY - 0.6, rnd(-30.5, -29.4), rnd(.6, 1.1), M.white);
  for (let i = 0; i < 6; i++) rockAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0, T.B.z1), rnd(.3, .6), M.stone);
  ['メイ', 'キラ'].forEach((name, i) => {
    const c = mk('makeSeaOtter'); T.g.add(c.g);
    const o = { c, name, x: 38 + i * 4, z: -26 - i * 1.2, vx: rnd(-.2, .2), vz: 0, rot: rnd(0, 6), t: rnd(2, 6), state: 'float', jumpT: 0 };
    c.g.position.set(o.x, T.surfY, o.z);
    OTTERS.list.push(o);
  });
  onUpdate((dt, t) => {
    for (const o of OTTERS.list) {
      const c = o.c;
      if (o.state === 'float') {
        o.t -= dt; o.x += o.vx * dt; o.z += o.vz * dt;
        if (o.x < T.B.x0 + 0.6 || o.x > T.B.x1 - 0.6) o.vx *= -1; if (o.z < T.B.z0 + 0.6 || o.z > T.B.z1 - 0.8) o.vz *= -1;
        o.rot += dt * 0.15;
        c.g.position.set(o.x, OTTERS.surfY - 0.06 + Math.sin(t * 1.3 + o.rot) * 0.04, o.z); c.g.rotation.set(0, o.rot, 0);
        if (c.setMode) c.setMode('back');
        if (o.t < 0) { o.t = rnd(4, 9); const r = Math.random(); if (c.setAction) c.setAction(r < 0.4 ? 'groom' : r < 0.75 ? 'crack' : 'roll'); if (r < 0.75 && c.setAction && r >= 0.4) SE.crunch(); o.vx = rnd(-.25, .25); o.vz = rnd(-.12, .12); }
      }
      c.update(dt, t);
    }
  }, T.cx, T.cz, 2, 34);
  const D = TK.I_dolphin;
  for (let i = 0; i < 4; i++) swimIn(D, mk('makeCommersonDolphin'), { spd: 2.2, turn: 1.4, circle: true, surface: 12, bank: true });
  zoneBoard('I', 45, FY[2] + 4.6, -12, 0, 6);
  addFact({ x: 41, z: -20.5, f: 2, r: 5.5, zone: 'I', name: 'I 極地の海 — ラッコのメイとキラ', txt: '日本でラッコに会えるのは、いまはここだけ。おなかの上で貝をわって食べるよ。お食事タイムは9:40・13:00・16:10' });
  addFact({ x: 51.5, z: -20.5, f: 2, r: 4.5, name: 'イロワケイルカ', txt: '白と黒のパンダみたいなイルカ。体長1.5mくらいの小さなイルカで、すばしっこい' });
}

secEnd(); zoneGroup('zJ', 2, 45, 12, 44, ['J2']);
/* ================= J 日本の川（2F）＋ザリガニコーナー ================= */
{
  const T = TK.J_river, Y = FY[2];
  /* 奥の壁にアクア・トト版の滝の絵 */
  const art = ASSET.tex('tex/falls.jpg'); art.wrapS = art.wrapT = THREE.ClampToEdgeWrapping; art.repeat.set(1, 0.62); art.offset.set(0, 0.2);
  const ap = new THREE.Mesh(new THREE.PlaneGeometry(T.W - 0.1, 5.8), new THREE.MeshBasicMaterial({ map: art, color: 0xd8f0f0 })); ap.position.set(T.cx, T.floorY + 2.9, T.cz + T.D / 2 - 0.08); ap.rotation.y = Math.PI; T.g.add(ap);
  const sheets = [];
  for (const [x, w] of [[41.5, 2.4], [44.6, 1.2]]) { const tx = streakTex(); tx.repeat.set(1, 2); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 5), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide })); s.position.set(x, T.floorY + 2.6, T.cz + T.D / 2 - 0.5); T.g.add(s); sheets.push(tx); }
  onUpdate(dt => sheets.forEach(tx => tx.offset.y += dt * 2.6), T.cx, T.cz, 2, 34);
  for (let i = 0; i < 12; i++) rockAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0, T.B.z1), rnd(.25, .8), M.stone);
  for (let i = 0; i < 6; i++) weedAt(T.g, rnd(T.B.x0, T.B.x1), T.floorY, rnd(T.B.z0 + 2, T.B.z1), rnd(.6, 1.4));
  for (let i = 0; i < 12; i++) swimIn(T, photoFish('ayu', 0.42), { spd: 1.3, turn: 1.4 });
  for (let i = 0; i < 5; i++) swimIn(T, photoFish('iwana', 0.5), { spd: 0.8 });
  for (let i = 0; i < 5; i++) swimIn(T, photoFish('amago', 0.45), { spd: 0.9 });
  for (let i = 0; i < 2; i++) swimIn(T, photoFish('oosansho', 1.2), { spd: 0.06, bottom: true, turn: 0.2 });
  /* ザリガニコーナー（2026年10月リニューアル） */
  for (let k = 0; k < 3; k++) {
    const Z = islandTank({ x0: 37 + k * 5.6, x1: 41.5 + k * 5.6, z0: 3, z1: 5.4, y: Y, h: 0.8, base: 0.9, top: '#8ac0b0', bot: '#2a4a40', rocks: 4, rockScale: 0.6 });
    for (let i = 0; i < 3; i++) { const c = mk('makeCrustacean', 'zarigani'); c.g.scale.multiplyScalar(2.2); swimIn(Z, c, { spd: 0.06, bottom: true, turn: 0.5, r: 24 }); }
  }
  const zs = sign3D(['ザリガニコーナー', '2026年10月 リニューアルオープン！'], { w: 4.8, h: 1.3, posts: 1.6, bg: '#8a2a1a', f2: 44 }); zs.position.set(53.5, Y, 7.6); zs.rotation.y = -0.6;
  zoneBoard('J', 45, Y + 4.6, 12, Math.PI, 6);
  addFact({ x: 42.3, z: 21.3, f: 2, r: 6, zone: 'J', name: 'J 日本の川', txt: '滝や急流を再現した水槽。アユ・イワナ・アマゴ、底にはオオサンショウウオ（アクア・トトでも会ったね！）' });
  addFact({ x: 45, z: 6.6, f: 2, r: 5, name: 'ザリガニコーナー', txt: 'いろんなザリガニを集めたコーナー。大きなハサミで「ばんざい」して身を守るよ' });
}

secEnd();

zoneGroup('zL', 0, 72, 0, 70, ['L0']);
/* ================= L 水の回廊（アクアプロムナード・屋外の東） ================= */
const WALRUS = { c: null, n: 0 }, PENG = { list: [], walk: null, keeper: null };
{
  /* 2Fの出口からテラスへ下りるスロープ */
  const rz0 = -16.5, rz1 = 11.5, rx0 = 57.5, rx1 = 61.5;
  const land = box(5.5, 0.4, 6, M.terrace); land.position.set(58.75, FY[2] - 0.2, -19.5); scene.add(land);
  addGround(56, 61.5, -22.5, rz0, FY[2]);
  railing(56, 61.5, -22.6, -22.5, FY[2], 1.1); railing(61.5, 61.6, -22.5, rz0, FY[2], 1.1);
  const len = rz1 - rz0, ang = Math.atan2(FY[2], len);
  const rp = new THREE.Mesh(new THREE.BoxGeometry(rx1 - rx0, 0.3, Math.hypot(len, FY[2])), M.terrace); rp.position.set((rx0 + rx1) / 2, FY[2] / 2 - 0.15, (rz0 + rz1) / 2); rp.rotation.x = ang; scene.add(rp);
  addGround(rx0, rx1, rz0, rz1, { axis: 'z', a: rz0, b: rz1, ha: FY[2], hb: 0 });
  for (let i = 0; i < 7; i++) { const z0 = rz0 + i * 4, h = FY[2] * (1 - (i * 4) / len); for (const x of [rx0 - 0.05, rx1]) { const r = box(0.06, 1.1, 4, M.glass); r.position.set(x + 0.03, h - 0.3, z0 + 2); r.rotation.x = ang; scene.add(r); addSolid(x - 0.05, x + 0.1, h - 1.2, h + 1.0, z0, z0 + 4); } }
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, FY[2] * (1 - (i * 7) / len), 8), M.steel); p.position.set((rx0 + rx1) / 2, FY[2] * (1 - (i * 7) / len) / 2, rz0 + i * 7); scene.add(p); }
  const s1 = sign3D(['L 水の回廊へ ▼', 'ペンギン・セイウチ・ペリカン'], { w: 4.6, h: 1.3, posts: 1.5, bg: '#7a6a12', f2: 46 }); s1.position.set(58.75, FY[2], -21.3);
  /* ---- ペンギンの岩場とプール ---- */
  const pz = { x0: 64, x1: 80, z0: -24, z1: -8.5 };
  const rockFloor = new THREE.Mesh(new THREE.PlaneGeometry(pz.x1 - pz.x0, pz.z1 - pz.z0), tiled(M.stoneWall, 16, 15, 4)); rockFloor.rotation.x = -Math.PI / 2; rockFloor.position.set((pz.x0 + pz.x1) / 2, 0.02, (pz.z0 + pz.z1) / 2); scene.add(rockFloor);
  const ppool = new THREE.Mesh(new THREE.PlaneGeometry(8, 6.5), new THREE.MeshBasicMaterial({ map: waterTex, color: 0x5ab0d8, transparent: true, opacity: .9 })); ppool.rotation.x = -Math.PI / 2; ppool.position.set(75, 0.04, -19.5); scene.add(ppool);
  for (let i = 0; i < 9; i++) rockAt(scene, rnd(65, 71), 0, rnd(-23, -12), rnd(.5, 1.2), M.stone);
  railing(pz.x0, pz.x1, pz.z1, pz.z1 + 0.06, 0, 1.0); railing(pz.x0 - 0.06, pz.x0, pz.z0, pz.z1, 0, 1.0);
  const gate = box(2.4, 1.0, 0.1, M.wood); gate.position.set(65.3, 0.5, pz.z1 + 0.02); scene.add(gate);
  for (let i = 0; i < 10; i++) {
    const c = mk('makePenguin'); scene.add(c.g);
    const ctl = walkerCtl(c, { x0: 65, x1: 79, z0: -23, z1: -9.5, y: 0 }, { spd: 0.35, wait: [1.5, 6] });
    PENG.list.push({ c, ctl, home: true });
  }
  onUpdate((dt, t) => { for (const P of PENG.list) { if (P.home) P.ctl.update(dt, t); P.c.update(dt, t); if (P.home) P.c.g.position.y = 0; } }, 72, -16, 0, 50);
  /* ペンギン散歩の飼育員さん */
  PENG.keeper = makeTrainer(); PENG.keeper.g.position.set(66, 0, -7.4); PENG.keeper.g.rotation.y = Math.PI; scene.add(PENG.keeper.g);
  onUpdate((dt, t) => PENG.keeper.update(dt, t), 66, -6, 0, 40);
  const ps = sign3D(['🐧 ペンギン散歩 12:00', 'E でいっしょにお散歩！'], { w: 4.4, h: 1.3, posts: 1.6, bg: '#1a4a7a', f2: 48 }); ps.position.set(61.5, 0, -7.2); ps.rotation.y = -0.7;
  /* ---- セイウチのステージ ---- */
  const stg = box(8, 0.5, 10, new THREE.MeshLambertMaterial({ color: 0xc8c0b0 })); stg.position.set(72, 0.25, 10); scene.add(stg);
  const wp = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), new THREE.MeshBasicMaterial({ map: waterTex, color: 0x3a90c8, transparent: true, opacity: .9 })); wp.rotation.x = -Math.PI / 2; wp.position.set(81, 0.03, 10); scene.add(wp);
  railing(66, 66.06, 3, 17, 0, 1.1); railing(66, 86, 2.94, 3, 0, 1.1); railing(66, 86, 17, 17.06, 0, 1.1);
  addSolid(66, 90, -1, 3, 3, 17);
  const w = mk('makeWalrus'); WALRUS.c = w; w.g.position.set(70.5, 0.5, 10); w.g.rotation.y = -Math.PI / 2; scene.add(w.g);
  onUpdate((dt, t) => w.update(dt, t), 70, 10, 0, 45);
  const wt = sign3D(['🦭 セイウチふれあいタイム', '11:00 ／ 14:00　柵の前で E'], { w: 5, h: 1.4, posts: 1.6, bg: '#5a3a1a', f2: 46 }); wt.position.set(64.6, 0, 18.6); wt.rotation.y = -Math.PI / 2 - 0.5;
  /* ---- ペリカン ---- */
  const pp = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ map: waterTex, color: 0x6ab0c0, transparent: true, opacity: .9 })); pp.rotation.x = -Math.PI / 2; pp.position.set(84.5, 0.04, -3); scene.add(pp);
  railing(80, 80.06, -7, 1, 0, 1.0); railing(80, 89, -7.06, -7, 0, 1.0); railing(80, 89, 1, 1.06, 0, 1.0);
  for (let i = 0; i < 2; i++) { const c = mk('makePelican'); c.g.position.set(82.5 + i * 3, 0, -5 + i * 3.4); c.g.rotation.y = -Math.PI / 2 + rnd(-.5, .5); scene.add(c.g); onUpdate((dt, t) => c.update(dt, t), 84, -3, 0, 40); }
  /* ---- コツメカワウソ ---- */
  railing(78, 78.06, 19, 25.5, 0, 1.0); railing(78, 89, 18.94, 19, 0, 1.0);
  const st = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: waterTex, color: 0x5ab0c8, transparent: true, opacity: .9 })); st.rotation.x = -Math.PI / 2; st.position.set(84, 0.04, 22.5); scene.add(st);
  for (let i = 0; i < 3; i++) { const c = mk('makeSmallOtter'); if (c.setMode) c.setMode('walk'); scene.add(c.g); const ctl = walkerCtl(c, { x0: 79.5, x1: 88.5, z0: 20, z1: 25, y: 0 }, { spd: 0.9, wait: [0.5, 2.5] }); onUpdate((dt, t) => { ctl.update(dt, t); c.update(dt, t); c.g.position.y = (c.footY != null ? -c.footY : 0.12); }, 84, 22, 0, 40); }
  /* 海辺のカモメ */
  for (let i = 0; i < 5; i++) { const c = mk('makeSeagull'); scene.add(c.g); const ph = rnd(0, 6), r = rnd(14, 30), cx = rnd(70, 110), cz = rnd(-10, 60), h = rnd(9, 18);
    onUpdate((dt, t) => { const a = t * 0.25 + ph; c.g.position.set(cx + Math.cos(a) * r, h + Math.sin(a * 2) * 1.2, cz + Math.sin(a) * r); c.g.rotation.set(0, -a, 0.25); c.update(dt, t); }, cx, cz, 0, 0); }
  zoneBoard('L', 60.5, 5.2, 1.0, -Math.PI / 2, 6);
  addFact({ x: 72, z: -6.5, f: 1, r: 6, zone: 'L', name: 'L 水の回廊 — ケープペンギン', txt: 'アフリカの南の海にすむペンギン。目の上のピンクの所は、羽がなくて体の熱をにがす窓' });
  addFact({ x: 64.5, z: 10, f: 1, r: 5.5, name: 'セイウチ', txt: 'キバは歯がのびたもの。キバをひっかけて氷の上に体を持ちあげるよ。ヒゲで貝をさがす' });
  addFact({ x: 79, z: -3, f: 1, r: 4.5, name: 'ペリカン', txt: '大きなくちばしの袋は、魚を水ごとすくう網。水を出してから魚を飲みこむ' });
  addFact({ x: 77, z: 22, f: 1, r: 4.5, name: 'コツメカワウソ', txt: '世界一小さいカワウソ。手先が器用で、石でお手玉みたいに遊ぶこともあるよ' });
}

secEnd();
