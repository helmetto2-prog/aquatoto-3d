import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* =========================================================
   鳥羽 3D たんけん水族館  （アクア・トト 3D v08 のエンジンを引き継いだ鳥羽水族館版）
   ========================================================= */
const QS = new URLSearchParams(location.search);          // 開発用（公開ページでは使わない）
const DEV = QS.has('auto');
const IS_MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = id => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa9d3ea, 110, 330);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 700);
const hemi = new THREE.HemisphereLight(0xd6ecff, 0x3d4a52, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 1.35); sun.position.set(40, 90, 60); scene.add(sun);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const SIGN_FONT = "'Hiragino Maru Gothic ProN','Hiragino Sans','Zen Maru Gothic','Meiryo','Noto Sans JP',sans-serif";

/* ================= キャンバステクスチャ工房 ================= */
function ctex(w, h, fn, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const stoneTex = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#8b9098'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += rnd(6, 16)) { g.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${64 + Math.random() * 40 | 0},${70 + Math.random() * 40 | 0},${rnd(.25, .6)})`; g.fillRect(0, y, w, rnd(3, 9)); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rnd(.02, .08)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(2, 20), rnd(1, 3)); }
}, 2, 2);
const woodTex = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#5a3a28'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) {
    g.fillStyle = `rgb(${74 + Math.random() * 22 | 0},${46 + Math.random() * 14 | 0},${30 + Math.random() * 10 | 0})`; g.fillRect(0, y + 1, w, 30);
    g.fillStyle = 'rgba(30,16,8,.8)'; g.fillRect(0, y, w, 2);
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(40,22,10,.35)'; g.fillRect(rnd(0, w), y + rnd(3, 27), rnd(10, 60), 1.5); }
  }
}, 2, 1);
const sandTex = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#d6c49a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${120 + Math.random() * 80 | 0},${100 + Math.random() * 70 | 0},${60 + Math.random() * 50 | 0},.4)`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); }
}, 3, 3);
const grassTex = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#5f9a48'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${50 + Math.random() * 60 | 0},${120 + Math.random() * 70 | 0},${40 + Math.random() * 40 | 0},.5)`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, rnd(2, 5)); }
}, 10, 10);
const lobbyTex = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#cfc8ba'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,110,95,.5)'; g.lineWidth = 2;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
}, 8, 8);
const floorTex = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#2f4256'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(16,24,34,.7)'; g.lineWidth = 2;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${rnd(.015, .05)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(2, 10), rnd(2, 10)); }
}, 8, 8);
function streakTex() {
  return ctex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const x = rnd(0, w), len = rnd(30, 140), y = rnd(-40, h), wd = rnd(1.5, 5);
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(235,248,255,${rnd(.35, .85)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x, y, wd, len);
    }
  });
}
const waterTex = ctex(128, 128, (g, w, h) => {
  g.fillStyle = '#2a7ca8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,255,255,${rnd(.05, .2)})`; g.lineWidth = rnd(1, 2.5); g.beginPath(); const y = rnd(0, h); g.moveTo(rnd(0, w), y); g.quadraticCurveTo(rnd(0, w), y + rnd(-6, 6), rnd(0, w), y); g.stroke(); }
}, 2, 2);
/* 鳥羽湾の海面（エメラルド寄り） */
const seaTex = ctex(256, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1f7f93'); gr.addColorStop(1, '#2a93a3');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(255,255,255,${rnd(.04, .18)})`; g.lineWidth = rnd(1, 2.2); g.beginPath(); const y = rnd(0, h), x = rnd(0, w); g.moveTo(x, y); g.quadraticCurveTo(x + rnd(6, 18), y + rnd(-4, 4), x + rnd(16, 40), y); g.stroke(); }
}, 40, 40);
/* 水槽の床にゆらめく光（コースティクス） */
const causticTex = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(150,220,255,${rnd(.12, .32)})`; g.lineWidth = rnd(1.5, 4);
    g.beginPath(); const x = rnd(0, w), y = rnd(0, h), r = rnd(10, 34);
    for (let a = 0; a <= 6.4; a += 0.5) { const rr = r * (0.7 + Math.random() * 0.6); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.stroke();
  }
}, 3, 3);
/* 水槽の奥の壁（深い青のグラデーション） */
function tankBackTex(top = '#2b8fc0', bot = '#06304d') {
  return ctex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}
/* 水草（透過のゆらゆら葉） */
const weedTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x0 = 12 + i * 16 + rnd(-4, 4); g.strokeStyle = ['#2e8b57', '#3aa76d', '#2f7a4f', '#4ab87a'][i % 4]; g.lineWidth = rnd(4, 7);
    g.beginPath(); g.moveTo(x0, 256); let x = x0;
    for (let y = 256; y > rnd(16, 70); y -= 20) { x += rnd(-9, 9); g.quadraticCurveTo(x + rnd(-7, 7), y - 10, x, y - 20); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

/* 説明パネル文字（幅に合わせて自動縮小・縦も中央） */
function textTex(lines, opt = {}) {
  const W = opt.w || 512, H = opt.h || (60 + lines.length * 54);
  const t = ctex(W, H, (g) => {
    g.fillStyle = opt.bg || '#0d3a5c'; g.fillRect(0, 0, W, H);
    if (opt.frame !== false) { g.strokeStyle = opt.frame || '#7fc4ee'; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12); }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = opt.col || '#ffffff';
    let sizes = lines.map((ln, i) => {
      let s = (i === 0 ? (opt.f1 || 44) : (opt.f2 || 30)); g.font = `bold ${s}px ${SIGN_FONT}`;
      const tw = g.measureText(ln).width; if (tw > W - 72) s = Math.max(16, Math.floor(s * (W - 72) / tw)); return s;
    });
    let totalH = sizes.reduce((a, s) => a + s * 1.32, 0);
    if (totalH > H - 28) { const k = (H - 28) / totalH; sizes = sizes.map(s => Math.max(14, Math.floor(s * k))); totalH = sizes.reduce((a, s) => a + s * 1.32, 0); }
    let y = (H - totalH) / 2;
    lines.forEach((ln, i) => {
      const s = sizes[i]; g.font = `bold ${s}px ${SIGN_FONT}`;
      if (i > 0 && opt.col2) g.fillStyle = opt.col2;
      g.fillText(ln, W / 2, y + s * 1.02); y += s * 1.32;
    });
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); t.anisotropy = 4;
  return { tex: t, w: W, h: H };
}
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
/* セクション：館内の1F・2F・スタジアム・水の回廊をまとめて表示/非表示（描画を軽く） */
const SECTIONS = {};
function secBegin(name) { const g = SECTIONS[name] || (SECTIONS[name] = new THREE.Group()); g.name = name; if (!g.parent) scene.add(g); scene.add = function (...o) { g.add(...o); return scene; }; return g; }
function secEnd() { delete scene.add; }
/* ゾーンごとのまとまり（離れたら描かない） */
function zoneGroup(name, f, cx, cz, r = 46, keys = []) { const g = secBegin(name); CULL_LATE.push({ g, x: cx, z: cz, f, r, keys }); return g; }
const CULL_LATE = [];
/* 立体看板（パネル箱＋金属フレーム＋脚 or 吊り棒） */
function sign3D(lines, o = {}) {
  const w = o.w || 4.4, h = o.h || 1.5;
  const g = new THREE.Group();
  const t = textTex(lines, { w: 1024, h: Math.max(180, Math.round(1024 * h / w)), bg: o.bg || '#0e2d4e', frame: o.frame || '#bfe4ff', col: o.col || '#ffffff', col2: o.col2, f1: o.f1 || 88, f2: o.f2 || 60 });
  const panel = box(w + 0.12, h + 0.12, 0.14, M.metal);
  const fm = new THREE.MeshBasicMaterial({ map: t.tex });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), fm); face.position.z = 0.072; panel.add(face);
  if (!o.oneSide) { const f2 = new THREE.Mesh(face.geometry, fm); f2.rotation.y = Math.PI; f2.position.z = -0.072; panel.add(f2); }
  g.add(panel);
  if (o.posts) {
    panel.position.y = o.posts;
    const p = box(w - 0.5, 0.001, 0.001, M.metal); p.visible = false;
    for (const sx of [-w / 2 + 0.25, w / 2 - 0.25]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, o.posts + h / 2, 6), M.metal); pp.position.set(sx, (o.posts + h / 2) / 2, 0); g.add(pp); }
  } else if (o.hang) {
    panel.position.y = o.hang; const L = (o.ceil || o.hang + 2) - o.hang;
    for (const sx of [-w / 2 + 0.3, w / 2 - 0.3]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L, 4), M.metal); rod.position.set(sx, o.hang + L / 2, 0); g.add(rod); }
  }
  scene.add(g);
  return g;
}
/* 大きなゾーン看板（アルファベット入りの円＋名前。鳥羽の館内サイン風） */
function zoneSign(letter, name, sub, o = {}) {
  const W = 1024, H = 300;
  const t = ctex(W, H, (g) => {
    g.fillStyle = o.bg || '#0b3352'; g.fillRect(0, 0, W, H);
    g.fillStyle = o.ring || '#ffc93c'; g.beginPath(); g.arc(150, H / 2, 108, 0, 7); g.fill();
    g.fillStyle = o.bg || '#0b3352'; g.font = `bold 150px ${SIGN_FONT}`; g.textAlign = 'center'; g.fillText(letter, 150, H / 2 + 54);
    g.textAlign = 'left'; g.fillStyle = '#fff';
    let s = 92; g.font = `bold ${s}px ${SIGN_FONT}`; while (g.measureText(name).width > W - 320 && s > 40) { s -= 4; g.font = `bold ${s}px ${SIGN_FONT}`; }
    g.fillText(name, 290, sub ? 150 : 180);
    if (sub) { let s2 = 46; g.font = `bold ${s2}px ${SIGN_FONT}`; while (g.measureText(sub).width > W - 320 && s2 > 24) { s2 -= 2; g.font = `bold ${s2}px ${SIGN_FONT}`; } g.fillStyle = '#9fd8ee'; g.fillText(sub, 292, 232); }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); t.anisotropy = 4;
  const w = o.w || 6, h = w * H / W;
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  g.add(face);
  if (!o.oneSide) { const f2 = face.clone(); f2.rotation.y = Math.PI; g.add(f2); }
  const back = box(w + 0.16, h + 0.16, 0.08, M.metal); back.position.z = 0; back.scale.z = 0.5; g.add(back);
  face.position.z = 0.03; if (g.children[1] && !o.oneSide) g.children[1].position.z = -0.03;
  if (o.hang) { for (const sx of [-w / 2 + 0.3, w / 2 - 0.3]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, o.hang, 6), M.metal); rod.position.set(sx, h / 2 + o.hang / 2, 0); g.add(rod); } }
  scene.add(g); return g;
}

/* ================= 素材（公開ページと同じフォルダの assets/） ================= */
const ASSET = {
  base: 'assets/',
  texCache: {},
  tex(path, rx = 1, ry = 1) {
    const key = path + '|' + rx + '|' + ry; if (this.texCache[key]) return this.texCache[key];
    const t = new THREE.TextureLoader().load(this.base + path, undefined, undefined, () => console.warn('tex fail', path));
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    this.texCache[key] = t; return t;
  },
  async json(path) { const r = await fetch(this.base + path); if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); },
};
const gltfLoader = new GLTFLoader();
function b64buf(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
/* .gltf（バッファをbase64で内蔵＝公開ページで配れる形）を読み、メモリ上でGLBに組み直して parse。
   data: URL を fetch しないので、ページの制限に引っかからない */
function loadEmbeddedGltf(path, onLoad, onErr) {
  ASSET.json(path).then(js => {
    const b = js.buffers && js.buffers[0], m = b && /^data:[^;,]*;base64,/.exec(b.uri || '');
    if (!m) throw new Error('no embedded buffer: ' + path);
    const bin = new Uint8Array(b64buf(b.uri.slice(m[0].length))); delete b.uri;
    const jb = new TextEncoder().encode(JSON.stringify(js)), jl = (jb.length + 3) & ~3, bl = (bin.length + 3) & ~3, total = 28 + jl + bl;
    const ab = new ArrayBuffer(total), dv = new DataView(ab), u8 = new Uint8Array(ab);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); u8.set(jb, 20); u8.fill(0x20, 20 + jb.length, 20 + jl);
    dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004E4942, true); u8.set(bin, 28 + jl);
    gltfLoader.parse(ab, '', onLoad, onErr);
  }).catch(onErr);
}

/* ================= マテリアル ================= */
const M = {
  stone: new THREE.MeshLambertMaterial({ map: stoneTex }),
  wood: new THREE.MeshLambertMaterial({ map: woodTex }),
  sand: new THREE.MeshLambertMaterial({ map: sandTex }),
  grass: new THREE.MeshLambertMaterial({ map: grassTex }),
  floorIn: new THREE.MeshLambertMaterial({ map: ASSET.tex('tex/tile_300_gray.jpg', 1, 1) }),
  floorDark: new THREE.MeshLambertMaterial({ map: floorTex }),
  lobby: new THREE.MeshLambertMaterial({ map: ASSET.tex('tex/tile_300_beige.jpg', 1, 1) }),
  path: new THREE.MeshLambertMaterial({ map: ASSET.tex('tex/paving_inter.jpg', 1, 1) }),
  terrace: new THREE.MeshLambertMaterial({ map: ASSET.tex('tex/paving_araidashi.jpg', 1, 1) }),
  deck: new THREE.MeshLambertMaterial({ map: ASSET.tex('tex/deck_wood.jpg', 2, 2) }),
  stoneWall: new THREE.MeshLambertMaterial({ map: ASSET.tex('tex/wall_stone.jpg', 3, 3) }),
  wallIn: new THREE.MeshLambertMaterial({ color: 0x173550 }),
  wallDeep: new THREE.MeshLambertMaterial({ color: 0x0a1c30 }),
  wallLobby: new THREE.MeshLambertMaterial({ color: 0xeee6d6 }),
  wallOut: new THREE.MeshLambertMaterial({ color: 0xe6e2d8 }),
  roof: new THREE.MeshLambertMaterial({ color: 0x5f7f99 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x22282e }),
  metal: new THREE.MeshLambertMaterial({ color: 0x9aa4ae }),
  steel: new THREE.MeshLambertMaterial({ color: 0xc8d0d8 }),
  white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  glass: new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  tankTint: new THREE.MeshBasicMaterial({ color: 0x1f7fb0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  caustic: new THREE.MeshBasicMaterial({ map: causticTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
};
/* 床・壁テクスチャの繰り返しをサイズに合わせる（タイル300角＝0.3m×10枚で3m） */
function tiled(mat, w, d, unit = 3) {
  const m = mat.clone(); if (m.map) { m.map = m.map.clone(); if (m.map.image) m.map.needsUpdate = true; m.map.repeat.set(Math.max(1, w / unit), Math.max(1, d / unit)); }
  return m;
}

/* ================= 当たり判定 ================= */
const solids = [];   // {x0,x1,y0,y1,z0,z1,active}
const grounds = [];  // {x0,x1,z0,z1,h}  h=数値 or {axis:'x'|'z', a,b, ha,hb}
function addSolid(x0, x1, y0, y1, z0, z1) { const s = { x0, x1, y0, y1, z0, z1, active: true }; solids.push(s); return s; }
function addGround(x0, x1, z0, z1, h) { const g = { x0, x1, z0, z1, h }; grounds.push(g); return g; }
function groundAt(g, x, z) {
  if (typeof g.h === 'number') return g.h;
  const v = g.h.axis === 'x' ? x : z;
  return g.h.ha + (g.h.hb - g.h.ha) * clamp((v - g.h.a) / (g.h.b - g.h.a), 0, 1);
}
function groundHeight(x, z, py) {
  let best = -1000;
  for (const g of grounds) {
    if (x < g.x0 || x > g.x1 || z < g.z0 || z > g.z1) continue;
    const h = groundAt(g, x, z);
    if (h <= py + 0.65 && h > best) best = h;
  }
  return best;
}
function wallX(x, z0, z1, y0, y1, mat, gaps = []) {
  let segs = [[z0, z1]];
  for (const g of gaps) { const ns = []; for (const s of segs) { if (g[0] > s[0]) ns.push([s[0], Math.min(g[0], s[1])]); if (g[1] < s[1]) ns.push([Math.max(g[1], s[0]), s[1]]); } segs = ns.filter(s => s[1] - s[0] > 0.01); }
  for (const s of segs) { const m = box(0.5, y1 - y0, s[1] - s[0], mat); m.position.set(x, (y0 + y1) / 2, (s[0] + s[1]) / 2); scene.add(m); addSolid(x - 0.25, x + 0.25, y0, y1, s[0], s[1]); }
}
function wallZ(z, x0, x1, y0, y1, mat, gaps = []) {
  let segs = [[x0, x1]];
  for (const g of gaps) { const ns = []; for (const s of segs) { if (g[0] > s[0]) ns.push([s[0], Math.min(g[0], s[1])]); if (g[1] < s[1]) ns.push([Math.max(g[1], s[0]), s[1]]); } segs = ns.filter(s => s[1] - s[0] > 0.01); }
  for (const s of segs) { const m = box(s[1] - s[0], y1 - y0, 0.5, mat); m.position.set((s[0] + s[1]) / 2, (y0 + y1) / 2, z); scene.add(m); addSolid(s[0], s[1], y0, y1, z - 0.25, z + 0.25); }
}
function slab(x0, x1, z0, z1, y, mat, thick = 0.4) { const m = box(x1 - x0, thick, z1 - z0, mat); m.position.set((x0 + x1) / 2, y - thick / 2, (z0 + z1) / 2); scene.add(m); return m; }
function floorPlane(x0, x1, z0, z1, y, mat, unit = 3) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), tiled(mat, x1 - x0, z1 - z0, unit));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y + 0.005, (z0 + z1) / 2); scene.add(m); return m;
}
/* 手すり（ガラス＋金属の笠木）。当たり判定つき */
function railing(x0, x1, z0, z1, y, H = 1.1) {
  const gl = box(Math.max(x1 - x0, 0.06), H, Math.max(z1 - z0, 0.06), M.glass); gl.position.set((x0 + x1) / 2, y + H / 2, (z0 + z1) / 2); scene.add(gl);
  const rl = box(Math.max(x1 - x0, 0.1), 0.08, Math.max(z1 - z0, 0.1), M.metal); rl.position.set((x0 + x1) / 2, y + H, (z0 + z1) / 2); scene.add(rl);
  addSolid(Math.min(x0, x1) - 0.05, Math.max(x0, x1) + 0.05, y, y + H, Math.min(z0, z1) - 0.05, Math.max(z0, z1) + 0.05);
}

/* ================= サウンド（WebAudio・ぜんぶ手作り） ================= */
let AC = null, sndOn = true, master = null;
function ac() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 1; master.connect(AC.destination); } return AC; }
function blip(f = 440, d = .1, type = 'sine', v = .08, slide = 0, when = 0) {
  if (!sndOn) return; const a = ac(); const t0 = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t0 + d);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.008); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + d + 0.02);
}
let noiseBuf = null;
function noise(d = .3, v = .1, f0 = 1200, f1 = 400, q = 0.7, when = 0, type = 'lowpass') {
  if (!sndOn) return; const a = ac(); const t0 = a.currentTime + when;
  if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const dd = noiseBuf.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = a.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + d);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(fl).connect(g).connect(master); s.start(t0, rnd(0, 1.5)); s.stop(t0 + d + 0.05);
}
const SE = {
  ding() { blip(880, .5, 'sine', .1); blip(660, .7, 'sine', .1, 0, .26); },
  btn() { blip(1200, .06, 'square', .05); },
  door() { blip(220, .35, 'sine', .04, -80); },
  step() { blip(140 + Math.random() * 40, .04, 'triangle', .02); },
  plop() { blip(500, .1, 'sine', .07, -250); },
  splash(big = 1) { noise(.35 + big * .25, .09 * big, 2400, 300, .6); blip(900, .14, 'triangle', .04 * big, -500); },
  stamp() { blip(660, .09, 'square', .07); blip(990, .14, 'square', .07, 0, .09); },
  happy() { [523, 659, 784].forEach((f, i) => blip(f, .14, 'sine', .07, 0, i * .09)); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => blip(f, .22, 'square', .05, 0, i * .14)); },
  whistle(len = .35) { if (!sndOn) return; const a = ac(); const t0 = a.currentTime; const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
    o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 140; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.07, t0 + .02); g.gain.setValueAtTime(0.07, t0 + len - .05); g.gain.exponentialRampToValueAtTime(.0001, t0 + len);
    o.connect(g).connect(master); o.start(t0); lfo.start(t0); o.stop(t0 + len + .02); lfo.stop(t0 + len + .02); },
  applause(len = 2.2, v = .07) { for (let i = 0; i < 18; i++) noise(.09, v * rnd(.5, 1), rnd(2600, 4200), rnd(1200, 2000), 1.4, rnd(0, len), 'bandpass'); noise(len, v * .45, 3000, 1800, .5); },
  bark() { blip(260, .16, 'sawtooth', .06, -120); blip(230, .2, 'sawtooth', .05, -110, .2); },     // アシカ「オウッ オウッ」
  kiss() { blip(1800, .05, 'sine', .07, 900); noise(.06, .05, 5000, 3000, 2, .03, 'bandpass'); },  // チュッ
  walrusWhistle() { blip(1500, .5, 'sine', .07, 500); blip(2000, .4, 'sine', .06, -400, .5); },
  walrusRoar() { blip(110, .7, 'sawtooth', .07, -30); noise(.6, .05, 500, 200, 1.2); },
  squawk() { blip(700, .12, 'square', .05, -300); blip(650, .14, 'square', .045, -250, .16); },     // ペンギン
  crunch() { noise(.08, .08, 1800, 900, 2, 0, 'bandpass'); noise(.08, .07, 1600, 800, 2, .12, 'bandpass'); },
  chime() { [784, 988, 1175].forEach((f, i) => blip(f, .5, 'sine', .05, 0, i * .12)); },
  good() { blip(880, .12, 'triangle', .07); blip(1320, .16, 'triangle', .06, 0, .08); },
  perfect() { [1047, 1319, 1568, 2093].forEach((f, i) => blip(f, .14, 'triangle', .06, 0, i * .05)); },
  miss() { blip(330, .25, 'sawtooth', .05, -120); },
};
/* ショーの音楽（明るい五音音階のループ） */
const MUSIC = {
  on: false, step: 0, next: 0, timer: null, tempo: 0.19,
  mel: [0, 2, 4, 7, 9, 7, 4, 2, 4, 7, 9, 12, 9, 7, 4, 7],
  bass: [0, 0, 7, 7, 5, 5, 7, 7],
  start() { if (this.on || !sndOn) return; this.on = true; const a = ac(); this.next = a.currentTime + 0.05; this.step = 0; this.timer = setInterval(() => this.sched(), 60); },
  stop() { this.on = false; clearInterval(this.timer); },
  sched() {
    if (!this.on || !sndOn) return; const a = ac();
    while (this.next < a.currentTime + 0.25) {
      const s = this.step, w = this.next - a.currentTime, root = 392;
      if (s % 2 === 0) blip(root * Math.pow(2, this.mel[(s / 2) % 16] / 12), .16, 'triangle', .035, 0, w);
      if (s % 4 === 0) blip(98 * Math.pow(2, this.bass[(s / 4) % 8] / 12), .22, 'square', .028, 0, w);
      if (s % 4 === 2) noise(.05, .025, 6000, 4000, 1, w, 'highpass');
      this.step++; this.next += this.tempo / 2;
    }
  },
};
/* 環境音（館内のこぽこぽ＋ざわざわ）。距離で音量を変える用のノイズ */
let ambGain = null;
function startAmbience() {
  const a = ac();
  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
  ambGain = a.createGain(); ambGain.gain.value = 0;
  src.connect(f).connect(ambGain).connect(master); src.start();
}

/* ================= HUD ================= */
let toastT = null;
function toast(msg, ms = 2600) { const e = $('toast'); e.textContent = msg; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, ms); }
let capT = null;
function caption(who, msg, ms = 2800) {
  const e = $('caption'); e.innerHTML = `<span class="who">${who}</span>${msg}`; e.hidden = false;
  clearTimeout(capT); if (ms) capT = setTimeout(() => e.hidden = true, ms);
}
function hideCaption() { $('caption').hidden = true; }

/* ================= スタンプ帳（12ゾーン＋ショー・イベント6） ================= */
const ZONE_STAMPS = [
  { id: 'A', icon: '🎪', name: 'パフォーマンススタジアム', sub: 'アシカショーの会場' },
  { id: 'B', icon: '🦭', name: '海獣の王国', sub: 'アシカ・アザラシ' },
  { id: 'C', icon: '🐚', name: '古代の海', sub: '生きている化石' },
  { id: 'D', icon: '🐠', name: 'コーラルリーフ・ダイビング', sub: 'サンゴ礁の海' },
  { id: 'E', icon: '🦞', name: '伊勢志摩の海・日本の海', sub: '鳥羽のまわりの海' },
  { id: 'F', icon: '🌴', name: 'ジャングルワールド', sub: 'アフリカマナティー' },
  { id: 'G', icon: '🐸', name: '奇跡の森', sub: 'カエル・カメ・ネコ' },
  { id: 'H', icon: '🧜', name: '人魚の海', sub: 'ジュゴンのセレナ' },
  { id: 'I', icon: '🦦', name: '極地の海', sub: 'ラッコ・イロワケイルカ' },
  { id: 'J', icon: '🏞', name: '日本の川', sub: '滝と急流' },
  { id: 'K', icon: '🔬', name: 'へんな生きもの研究所', sub: 'ダイオウグソクムシ' },
  { id: 'L', icon: '🐧', name: '水の回廊', sub: 'ペンギン・セイウチ' },
];
const EVENT_STAMPS = [
  { id: 'show', icon: '🎉', name: 'アシカショー大成功', sub: '合図でスコア60点以上' },
  { id: 'walrus', icon: '💋', name: 'セイウチの投げキッス', sub: 'ふれあいタイム' },
  { id: 'penguin', icon: '🚶', name: 'ペンギン散歩', sub: 'いっしょに歩いた' },
  { id: 'otter', icon: '🦑', name: 'イカミミジャンプ', sub: 'ラッコのお食事' },
  { id: 'serena', icon: '🥬', name: 'セレナのごはん', sub: '青いカゴにレタス' },
  { id: 'anago', icon: '🫣', name: 'チンアナゴ', sub: 'じっと待ったら顔を出した' },
];
const ALL_STAMPS = [...ZONE_STAMPS, ...EVENT_STAMPS];
let stampGot = {};
try { stampGot = JSON.parse(localStorage.getItem('toba3d_stamps_v1') || '{}') || {}; } catch (e) { stampGot = {}; }
function stampCount() { return ALL_STAMPS.filter(s => stampGot[s.id]).length; }
function drawStamps() {
  const n = stampCount();
  $('stampBtn').innerHTML = `🎫 ${n}/${ALL_STAMPS.length}<span class="bar"><i style="width:${(n / ALL_STAMPS.length * 100).toFixed(0)}%"></i></span>`;
  const cell = s => `<div class="st ${stampGot[s.id] ? 'on' : ''}"><span class="ic">${s.icon}</span><span class="nm">${s.id.length === 1 ? s.id + ' ' : ''}${s.name}<i>${s.sub}</i></span></div>`;
  $('sgZones').innerHTML = ZONE_STAMPS.map(cell).join('');
  $('sgEvents').innerHTML = EVENT_STAMPS.map(cell).join('');
}
drawStamps();
let onStampHook = null;
function getStamp(id) {
  if (stampGot[id]) return false;
  stampGot[id] = true;
  try { localStorage.setItem('toba3d_stamps_v1', JSON.stringify(stampGot)); } catch (e) { }
  const st = ALL_STAMPS.find(s => s.id === id);
  SE.stamp(); toast(`${st.icon} スタンプゲット！「${st.id.length === 1 ? st.id + ' ' : ''}${st.name}」`);
  drawStamps();
  const zonesDone = ZONE_STAMPS.every(s => stampGot[s.id]);
  const allDone = ALL_STAMPS.every(s => stampGot[s.id]);
  if (allDone) setTimeout(() => showCert(true), 1100);
  else if (zonesDone && ZONE_STAMPS.some(s => s.id === id)) setTimeout(() => showCert(false), 1100);
  if (onStampHook) onStampHook(id);
  return true;
}
function showCert(gold) {
  SE.fanfare();
  $('certTitle').textContent = gold ? 'ゴールドたんけんマスター' : 'たんけんマスター認定証';
  $('certText').innerHTML = gold
    ? '12のゾーンも、アシカショーもセイウチもペンギン散歩もラッコも、セレナもチンアナゴも！<br>鳥羽 3D たんけん水族館を<b>ぜんぶ</b>楽しんだことを証します'
    : '順路のない鳥羽水族館で、12のゾーンを<br>ぜんぶ見つけた「たんけんマスター」であることを証します';
  $('cert').hidden = false; if (typeof confetti === 'function') confetti();
}
$('certClose').addEventListener('click', () => $('cert').hidden = true);
$('stampBtn').addEventListener('click', () => { drawStamps(); $('stampCard').hidden = false; });
$('stampClose').addEventListener('click', () => $('stampCard').hidden = true);
$('stampCard').addEventListener('click', e => { if (e.target.id === 'stampCard') $('stampCard').hidden = true; });

/* 生きものモジュールの合流（ANIM_A=哺乳類・鳥 / ANIM_B=そのほか＋動きのコントローラ） */
let ANIM = null;
