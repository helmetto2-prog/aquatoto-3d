/* =========================================================
   館の骨組み：鳥羽水族館（ファン版）の間取り
   x: 西(-)〜東(+) / z: 北(-)〜南(+)。南に入口と鳥羽湾、東の端に「水の回廊」、西の端に「パフォーマンススタジアム」
   ========================================================= */
const FY = { 1: 0, 2: 7 };
const CEIL = 6.6, ROOF = 14.4;
const BX0 = -64, BX1 = 56, BZ0 = -24, BZ1 = 24;
const floorOf = y => (y > 3.5 ? 2 : 1);

/* ---- 登録簿（近くにいる時だけ動かす・説明パネル・アクション・ゾーン） ---- */
const UPD = [];      // {fn(dt,t), x,z, f, r}  r=0なら常に
function onUpdate(fn, x = 0, z = 0, f = 0, r = 0) { const u = { fn, x, z, f, r }; UPD.push(u); return u; }
const FACTS = [];    // {x,z,f,r,name,txt,zone,stamp}
function addFact(o) { FACTS.push(Object.assign({ r: 5 }, o)); }
const ACTIONS = [];  // {x,z,f,r,label,fn,when}
function addAction(o) { ACTIONS.push(Object.assign({ r: 2.6 }, o)); return o; }
const ZONES = [];    // {id,f,x0,x1,z0,z1,name,col}
function addZone(id, f, x0, x1, z0, z1, name, col) { ZONES.push({ id, f, x0, x1, z0, z1, name, col }); }
function zoneAt(x, z, f) { return ZONES.find(Z => (Z.f === f || Z.f === 0) && x >= Z.x0 && x <= Z.x1 && z >= Z.z0 && z <= Z.z1); }
const CULL = [];     // {g, x,z,f, r}  遠い/別フロアの物は描かない
function cull(g, x, z, f, r = 46) { CULL.push({ g, x, z, f, r }); }

/* ================= 空・海・まわりの景色 ================= */
{
  const skyTex = ctex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f7fc4'); gr.addColorStop(.5, '#9ccaea'); gr.addColorStop(1, '#eef6fb'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })); scene.add(sky);
  for (let i = 0; i < 12; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(6, 11), 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, fog: false })); s.position.set(rnd(-10, 10), rnd(-1, 2), rnd(-5, 5)); cl.add(s); }
    cl.position.set(rnd(-400, 400), rnd(90, 150), rnd(-400, 400)); scene.add(cl);
  }
  /* 陸（芝）と広場 */
  const land = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), M.grass); land.rotation.x = -Math.PI / 2; land.position.set(0, -0.03, -20); scene.add(land);
  addGround(-130, 130, -95, 55, 0);
  floorPlane(-40, 50, 24, 54, 0.0, M.path, 3);                    // 入口前の広場（インターロッキング）
  floorPlane(56, 90, -26, 26, 0.0, M.terrace, 3);                 // 水の回廊のテラス
  addGround(56, 90, -26, 26, 0);
  /* 鳥羽湾（南と東）。岸壁で落ちないようにする */
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ map: seaTex, transparent: true, opacity: .96 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.2, 0); scene.add(sea); window.__seaTex = seaTex;
  const quay = (x0, x1, z0, z1) => { const q = box(x1 - x0, 1.4, z1 - z0, M.stoneWall); q.position.set((x0 + x1) / 2, -0.7, (z0 + z1) / 2); scene.add(q); };
  quay(-130, 130, 54.5, 56); quay(90, 91.5, -95, 56);
  /* 岸壁の手すり（海に落ちないように） */
  railing(-130, 130, 55.2, 55.3, 0, 1.1); railing(90.5, 90.6, -95, 55.3, 0, 1.1);
  const pier = box(6, 0.5, 26, M.deck); pier.position.set(22, -0.2, 68); scene.add(pier); addGround(19, 25, 55, 81, 0.05);
  railing(19, 19.1, 56, 81, 0.05, 1.0); railing(24.9, 25, 56, 81, 0.05, 1.0); railing(19, 25, 80.9, 81, 0.05, 1.0);
  /* 島々（ミキモト真珠島のイメージ＋遠くの島） */
  const island = (x, z, r, h, col = 0x3f7a3a) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: col }));
    m.scale.y = h / r; m.position.set(x, -1.2, z); scene.add(m);
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.06, 1.6, 18), M.stone); rock.position.set(x, -0.8, z); scene.add(rock);
    return m;
  };
  island(120, 120, 34, 18); island(-90, 210, 60, 26, 0x40703c); island(260, -60, 70, 30, 0x456f3e); island(40, 260, 80, 22, 0x4a7444);
  const pearl = new THREE.Group();
  const hall = box(14, 5, 9, M.wallOut); hall.position.y = 6; pearl.add(hall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 3, 4), new THREE.MeshLambertMaterial({ color: 0x3a6a8a })); roof.rotation.y = Math.PI / 4; roof.position.y = 10; pearl.add(roof);
  pearl.position.set(118, 9, 118); scene.add(pearl);
  /* 遠くの山並み */
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(rnd(60, 110), rnd(40, 80), 7), new THREE.MeshLambertMaterial({ color: [0x4f7d55, 0x5b8a60, 0x48704e][i % 3] })); m.position.set(-300 + i * 75, 10, -230 - rnd(0, 60)); scene.add(m); }
  /* フェリー（白に水色の楕円もよう・赤い船底。霧の鳥羽湾に浮かぶ）*/
  const hullTex = ctex(512, 128, (g, w, h) => {
    g.fillStyle = '#f4f6f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2bb5b8';
    for (let i = 0; i < 26; i++) { const x = 30 + i * 18 + rnd(-6, 6), y = 30 + (i % 4) * 18 + rnd(-5, 5), L = 34 - i * 0.6; g.save(); g.translate(x, y); g.rotate(-0.42); g.beginPath(); g.ellipse(0, 0, Math.max(8, L), 6.5, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = '#c0392b'; g.fillRect(0, h - 16, w, 16);
  });
  const hullM = new THREE.MeshLambertMaterial({ map: hullTex }), whiteM = new THREE.MeshLambertMaterial({ color: 0xf4f6f6 });
  const winTex = ctex(256, 32, (g, w, h) => { g.fillStyle = '#f4f6f6'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3a48'; for (let x = 6; x < w; x += 20) g.fillRect(x, 9, 14, 13); });
  const winM = new THREE.MeshLambertMaterial({ map: winTex });
  function makeFerry() {
    const s = new THREE.Group();
    const hull = box(34, 4.2, 7, [hullM, hullM, whiteM, whiteM, hullM, hullM]); hull.position.y = 0.6; s.add(hull);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 4.2, 16, 1, false, 0, Math.PI), whiteM); bow.rotation.y = Math.PI / 2; bow.position.set(17, 0.6, 0); bow.scale.x = 0.9; s.add(bow);
    const d1 = box(22, 2.2, 6.4, winM); d1.position.set(1, 3.8, 0); s.add(d1);
    const d2 = box(12, 1.9, 6, winM); d2.position.set(4, 5.8, 0); s.add(d2);
    const br = box(5, 1.6, 6.6, winM); br.position.set(8.5, 7.5, 0); s.add(br);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), whiteM); mast.position.set(7, 10.5, 0); s.add(mast);
    const fun = box(2.2, 3.2, 2, whiteM); fun.position.set(-8, 5.6, 0); s.add(fun);
    const band = box(2.25, 0.6, 2.05, new THREE.MeshLambertMaterial({ color: 0x2bb5b8 })); band.position.set(-8, 6.6, 0); s.add(band);
    scene.add(s); return s;
  }
  const ferryA = makeFerry(); ferryA.position.set(112, -0.9, 30); ferryA.rotation.y = Math.PI / 2 + 0.15;
  const ferryB = makeFerry();
  onUpdate((dt, t) => { const a = t * 0.02; ferryB.position.set(60 + Math.cos(a) * 110, -0.9, 150 + Math.sin(a) * 55); ferryB.rotation.y = -a; ferryB.rotation.z = Math.sin(t * 0.7) * 0.012; window.__seaTex.offset.x += dt * 0.004; window.__seaTex.offset.y += dt * 0.002; });
}

/* ================= 木（造園屋さんの樹名板つき） ================= */
const TREE_INFO = {
  tree_kusunoki: ['クスノキ（楠）', 'しょうのうの香りがする常緑の大木。潮風にも強い'],
  tree_akamatsu: ['アカマツ（赤松）', '赤い幹の和の松。海辺の松林でもおなじみ'],
  tree_palm: ['ワシントンヤシ', '南国ムードの背高ヤシ。水族館の入口の定番'],
  bush_tsutsuji: ['ツツジ（躑躅）', '春に花のじゅうたんになる生垣の定番低木'],
  tree_keyaki: ['ケヤキ（欅）', 'ほうき形が美しい街路樹の王様。秋の紅葉がみごと'],
  tree_sarusuberi: ['サルスベリ（百日紅）', '夏のあいだ100日咲く花木。幹はつるつる'],
};
const treeTags = [];
function btree(name, x, y, z, h) {
  const mat = new THREE.MeshBasicMaterial({ map: ASSET.tex('trees/' + name + '.png'), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
  mat.map.wrapS = mat.map.wrapT = THREE.ClampToEdgeWrapping;
  const g = new THREE.Group();
  for (const ry of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(h, h), mat); p.rotation.y = ry; p.position.y = h / 2; g.add(p); }
  g.position.set(x, y, z); g.rotation.y = rnd(0, 6.28); scene.add(g); return g;
}
function namedTree(kind, x, z, h, y = 0) {
  btree(kind, x, y, z, h);
  const info = TREE_INFO[kind]; if (!info) return;
  treeTags.push({ x, z, f: floorOf(y + 0.1), name: info[0], txt: info[1] });
  const t = textTex([info[0]], { bg: '#3e5e30', f1: 64, w: 512, h: 120, frame: '#d8e8c8' });
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.28), new THREE.MeshBasicMaterial({ map: t.tex, side: THREE.DoubleSide }));
  bd.position.set(x + 0.6, y + 0.74, z + 0.6); bd.rotation.x = -0.35; scene.add(bd);
  const st = box(0.06, 0.72, 0.06, M.deck); st.position.set(x + 0.6, y + 0.36, z + 0.62); scene.add(st);
}
{
  for (let i = 0; i < 5; i++) { namedTree(['tree_palm', 'tree_kusunoki', 'tree_palm', 'tree_kusunoki', 'tree_palm'][i], -24 + i * 6, 29, i % 2 ? 6 : 6.4); namedTree(['tree_palm', 'tree_keyaki', 'tree_palm', 'tree_keyaki', 'tree_palm'][i], 8 + i * 6, 29, i % 2 ? 5.8 : 6.4); }
  for (let i = 0; i < 7; i++) namedTree('bush_tsutsuji', -26 + i * 9 + rnd(-1, 1), 33.5, 1.6);
  for (let i = 0; i < 6; i++) namedTree('tree_akamatsu', -36 + i * 16, 50, 7);
  namedTree('tree_sarusuberi', 44, 32, 4.6); namedTree('tree_sarusuberi', -34, 32, 4.6);
  /* 植え込み（花壇の縁石） */
  for (const [x0, x1] of [[-27, -5], [5, 33]]) { const cb = box(x1 - x0, 0.35, 1.2, M.stoneWall); cb.position.set((x0 + x1) / 2, 0.17, 33.5); scene.add(cb); }
}

/* ================= 外壁・床・屋根 ================= */
/* 外壁に埋め込む水槽の窓（あとで wallTank が窓枠・ガラスを作る）。床ごとの窓の位置 */
const OUTER_GAPS = { 'S1': [[-3, 3]], 'S2': [], 'N1': [], 'N2': [], 'E1': [[15, 21]], 'E2': [[-22.5, -16.5]], 'W1': [], 'W2': [] };
const TANKS = [];   // wallTank の結果
/* 水槽スペック（外壁にはめこむ大水槽たち）— 先に窓の穴を登録 */
const TANK_SPECS = {
  D_reef: { wall: 'N', f: 1, from: -33, to: -15, y0: 0.35, h: 5.9, depth: 7.5, top: '#3aa8d8', bot: '#0a3a5e' },
  E_ise: { wall: 'N', f: 1, from: 15.5, to: 32.5, y0: 0.4, h: 5.4, depth: 6.5, top: '#2f86b8', bot: '#08263e' },
  C_naut: { wall: 'S', f: 1, from: -32, to: -26, y0: 0.9, h: 2.4, depth: 2.6, top: '#1e4c78', bot: '#050f1f' },
  C_kabuto: { wall: 'S', f: 1, from: -24, to: -17, y0: 0.5, h: 1.5, depth: 2.6, top: '#4c8fa8', bot: '#163a4c' },
  E_lobster: { wall: 'S', f: 1, from: 16, to: 22.5, y0: 0.5, h: 1.8, depth: 2.4, top: '#3a7896', bot: '#0d2b3a' },
  E_takaashi: { wall: 'S', f: 1, from: 24.5, to: 32.5, y0: 0.45, h: 3.2, depth: 4.2, top: '#1b4466', bot: '#040b16' },
  F_amazon: { wall: 'S', f: 2, from: -33, to: -15.5, y0: 7.3, h: 5.4, depth: 6.5, top: '#4f9a86', bot: '#10342c' },
  G_cat: { wall: 'N', f: 2, from: -33, to: -25.5, y0: 7.25, h: 3.6, depth: 5.5, top: '#c9d3cf', bot: '#7d8a86', land: true },
  G_gator: { wall: 'N', f: 2, from: -24.5, to: -15.5, y0: 7.25, h: 3.6, depth: 6.5, top: '#d8e4c8', bot: '#6a7a58', land: true },
  H_dugong: { wall: 'N', f: 2, from: 15.5, to: 33, y0: 7.3, h: 5.6, depth: 8.5, top: '#86c9a6', bot: '#174f3e' },   // 写真のとおり緑がかった水
  I_otter: { wall: 'N', f: 2, from: 35.5, to: 46, y0: 7.25, h: 4.2, depth: 6.5, top: '#bfe6f6', bot: '#2a6f9a', surf: 2.4 },
  I_dolphin: { wall: 'N', f: 2, from: 47.5, to: 55.5, y0: 7.25, h: 4.6, depth: 7.5, top: '#5fc2e8', bot: '#0a3c66' },
  J_river: { wall: 'S', f: 2, from: 36, to: 48.5, y0: 7.25, h: 5.5, depth: 6.0, top: '#5fb4b0', bot: '#0d3b3a' },
};
for (const k in TANK_SPECS) { const s = TANK_SPECS[k]; OUTER_GAPS[s.wall + s.f].push([s.from, s.to]); }
{
  const band = { 1: [0, 7], 2: [7, ROOF] };
  for (const f of [1, 2]) {
    const [y0, y1] = band[f];
    wallZ(BZ1, BX0, BX1, y0, y1, M.wallOut, OUTER_GAPS['S' + f]);
    wallZ(BZ0, BX0, BX1, y0, y1, M.wallOut, OUTER_GAPS['N' + f]);
    wallX(BX0, BZ0, BZ1, y0, y1, M.wallOut, OUTER_GAPS['W' + f]);
    wallX(BX1, BZ0, BZ1, y0, y1, M.wallOut, OUTER_GAPS['E' + f]);
  }
  /* 東の出入口（1F=ショップから水の回廊へ / 2F=極地の海からテラスのスロープへ）の上の壁 */
  wallX(BX1, 15, 21, 3.6, 7, M.wallOut); wallX(BX1, -22.5, -16.5, 10.6, ROOF, M.wallOut);
  /* 入口ドアの上 */
  wallZ(BZ1, -3, 3, 3.8, 7, M.wallOut);
  /* 屋根（少し張り出し） */
  const rf = box(BX1 - BX0 + 2, 0.8, BZ1 - BZ0 + 2, M.roof); rf.position.set((BX0 + BX1) / 2, ROOF + 0.4, 0); scene.add(rf);
  /* 正面の大看板・キャノピー */
  const cano = box(14, 0.5, 6, new THREE.MeshLambertMaterial({ color: 0x1e6aa8 })); cano.position.set(0, 4.4, 27); scene.add(cano);
  for (const sx of [-6.6, 6.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 10), M.steel); p.position.set(sx, 2.2, 29.6); scene.add(p); addSolid(sx - 0.2, sx + 0.2, 0, 4.4, 29.4, 29.8); }
  const big = sign3D(['鳥羽水族館', 'TOBA AQUARIUM'], { w: 13, h: 3.2, bg: '#0b4a7c', f1: 120, f2: 70, oneSide: true });
  big.position.set(0, 8.6, 24.32);
  const fan = sign3D(['3D たんけん水族館（ファン作品）', '順路はありません。すきなところから！'], { w: 9, h: 1.5, bg: '#13405f', f1: 64, f2: 44, oneSide: true });
  fan.position.set(0, 12.2, 24.32);
  /* 入口の自動ドア */
  window.__autoDoor = { panels: [], open: 0, solid: null };
  const p1 = box(3, 3.6, 0.15, M.glass); p1.position.set(-1.5, 1.8, BZ1); scene.add(p1);
  const p2 = box(3, 3.6, 0.15, M.glass); p2.position.set(1.5, 1.8, BZ1); scene.add(p2);
  const fr = box(6.6, 0.3, 0.4, M.metal); fr.position.set(0, 3.75, BZ1); scene.add(fr);
  window.__autoDoor.panels = [p1, p2]; window.__autoDoor.solid = addSolid(-3, 3, 0, 3.6, BZ1 - 0.2, BZ1 + 0.2);
}
/* 1F床（全体）と2F床（吹き抜け・海獣の王国のプール・エレベーターの穴を除く） */
const POOL_B = { x0: -12, x1: 12, z0: -22, z1: -7 };
const EVS = { x0: -13.6, x1: -9.6, z0: 19.6, z1: 23.6 };   // エレベーター昇降路
secBegin('f1');
{
  floorPlane(-34, BX1, BZ0, BZ1, 0, M.floorIn, 3);
  floorPlane(-14, 14, 0, BZ1, 0.003, M.lobby, 3);                          // エントランスホールは明るい床
  addGround(-34, BX1, BZ0, BZ1, 0);
  const f2 = (x0, x1, z0, z1, mat = M.floorIn) => { slab(x0, x1, z0, z1, FY[2], mat, 0.4); floorPlane(x0, x1, z0, z1, FY[2], mat, 3); addGround(x0, x1, z0, z1, FY[2]); };
  secEnd();
  f2(-34, -14, BZ0, BZ1);                       // F・G
  f2(-14, 14, -7, 0);                           // 海獣の王国 2F の南デッキ
  f2(-14, -12, BZ0, -7); f2(12, 14, BZ0, -7); f2(-12, 12, BZ0, -22);     // プールのまわり
  f2(-14, 14, 0, EVS.z0); f2(-9.6, 14, EVS.z0, BZ1); f2(-14, -13.6, EVS.z0, BZ1);
  f2(14, BX1, BZ0, BZ1);                        // H・特別展示室・I・J
  /* 2F天井（屋根の下面） */
  const ceil = box(BX1 + 34, 0.2, BZ1 - BZ0, new THREE.MeshLambertMaterial({ color: 0x2a3f55 })); ceil.position.set((BX1 - 34) / 2, ROOF - 0.7, 0); scene.add(ceil);
  /* 天井のライト（光るパネル） */
  const lm = new THREE.MeshBasicMaterial({ color: 0xcfe2ff });
  for (const f of [1, 2]) { secBegin('f' + f); for (let x = -30; x <= 52; x += 10) for (let z = -18; z <= 18; z += 9) {
    if (f === 2 && x > -14 && x < 12 && z < -6) continue;
    const l = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), lm); l.rotation.x = Math.PI / 2; l.position.set(x, f === 1 ? CEIL - 0.02 : ROOF - 0.81, z); scene.add(l);
  } secEnd(); }
}

/* ================= 館内の仕切り壁（ゾーンの境目） =================
   1F: C古代の海(西南) D コーラル(西北) エントランス(中南) B海獣1F(中北) E伊勢志摩(東) ショップ/レストラン(東端)
   2F: Fジャングル(西南) G奇跡の森(西北) K研究所(中南) B海獣2F(中北) H人魚(東北) 特別展示室(東南) I極地(東端北) J日本の川(東端南) */
{
  const W1 = [0, CEIL], W2 = [FY[2], FY[2] + CEIL];
  secBegin('f1');
  // ---- 1F ----
  wallX(-34, BZ0, BZ1, ...W1, M.wallIn, [[17, 22]]);                          // スタジアムとの境（客席わきの通路への入口）
  wallZ(0, -34, -14, ...W1, M.wallIn, [[-30, -18]]);                          // C｜D
  wallX(-14, 0, BZ1, ...W1, M.wallIn, [[8, 16]]);                            // C｜ホール
  wallX(-14, BZ0, 0, ...W1, M.wallIn, [[-7, -1]]);                           // D｜B
  wallX(14, 0, BZ1, ...W1, M.wallIn, [[8, 16]]);                             // ホール｜E
  wallX(14, BZ0, 0, ...W1, M.wallIn, [[-7, -1]]);                            // B｜E
  wallX(34, BZ0, BZ1, ...W1, M.wallIn, [[-12, -6], [6, 12]]);                // E｜レストラン・ショップ
  wallZ(0, 34, BX1, ...W1, M.wallLobby, [[42, 48]]);                         // レストラン｜ショップ
  secEnd(); secBegin('f2');
  // ---- 2F ----
  wallX(-34, BZ0, BZ1, ...W2, M.wallIn, [[-10, -4], [4, 10]]);               // スタジアム客席の最上段へ
  wallZ(0, -34, -14, ...W2, M.wallIn, [[-30, -18]]);                          // F｜G
  wallX(-14, 0, BZ1, ...W2, M.wallIn, [[8, 16]]);                            // F｜K
  wallX(-14, BZ0, 0, ...W2, M.wallIn, [[-7, -1]]);                           // G｜B
  wallX(14, 0, BZ1, ...W2, M.wallDeep, [[8, 16]]);                           // K｜特別展示室
  wallX(14, BZ0, 0, ...W2, M.wallIn, [[-7, -1]]);                            // B｜H
  wallZ(0, 14, 34, ...W2, M.wallDeep, [[20, 28]]);                           // H｜特別展示室
  wallX(34, BZ0, 0, ...W2, M.wallIn, [[-14, -6]]);                           // H｜I
  wallX(34, 0, BZ1, ...W2, M.wallDeep, [[8, 16]]);                           // 特別展示室｜J
  wallZ(0, 34, BX1, ...W2, M.wallIn, [[40, 48]]);                            // I｜J
  /* 2Fのプールまわりの手すり */
  railing(POOL_B.x0, POOL_B.x1, POOL_B.z1, POOL_B.z1 + 0.06, FY[2], 1.1);
  railing(POOL_B.x0 - 0.06, POOL_B.x0, POOL_B.z0, POOL_B.z1, FY[2], 1.1);
  railing(POOL_B.x1, POOL_B.x1 + 0.06, POOL_B.z0, POOL_B.z1, FY[2], 1.1);
  railing(POOL_B.x0, POOL_B.x1, POOL_B.z0 - 0.06, POOL_B.z0, FY[2], 1.1);
  secEnd();
}
/* ゾーン登録（ミニマップ・バッジ・スタンプ用） */
addZone('A', 0, -64, -34, BZ0, BZ1, 'パフォーマンススタジアム', '#e8a23a');
addZone('C', 1, -34, -14, 0, BZ1, '古代の海', '#8a7ad0');
addZone('D', 1, -34, -14, BZ0, 0, 'コーラルリーフ・ダイビング', '#e0697a');
addZone('HALL', 1, -14, 14, 0, BZ1, 'エントランスホール', '#7f9fb8');
addZone('B', 1, -14, 14, BZ0, 0, '海獣の王国（水中）', '#3f8fd0');
addZone('E', 1, 14, 34, BZ0, BZ1, '伊勢志摩の海・日本の海', '#3fb0a8');
addZone('SHOP', 1, 34, BX1, 0, BZ1, 'メインショップ', '#c07ab8');
addZone('REST', 1, 34, BX1, BZ0, 0, 'レストラン', '#b89a6a');
addZone('F', 2, -34, -14, 0, BZ1, 'ジャングルワールド', '#5fae4a');
addZone('G', 2, -34, -14, BZ0, 0, '奇跡の森', '#3f8a5a');
addZone('K', 2, -14, 14, 0, BZ1, 'へんな生きもの研究所', '#b0b8c8');
addZone('B', 2, -14, 14, BZ0, 0, '海獣の王国（水上）', '#3f8fd0');
addZone('H', 2, 14, 34, BZ0, 0, '人魚の海', '#4ab8e0');
addZone('JELLY', 2, 14, 34, 0, BZ1, '特別展示室（クラゲ）', '#7a5ad0');
addZone('I', 2, 34, BX1, BZ0, 0, '極地の海', '#9fd8f0');
addZone('J', 2, 34, BX1, 0, BZ1, '日本の川', '#4a9a8a');
addZone('L', 0, BX1, 90, -26, 26, '水の回廊（アクアプロムナード）', '#e0c04a');
addZone('OUT', 0, -130, 130, 24, 56, '入口前の広場・鳥羽湾', '#8ab070');

/* ================= 壁にはめこむ水槽 =================
   窓（ガラス）は外壁のライン上、水槽は建物の外側にふくらむ。外から見ると白い箱 */
function wallTank(spec, name) {
  const s = spec, g = new THREE.Group(); g.name = 'tank:' + name;
  const dir = (s.wall === 'N') ? -1 : (s.wall === 'S') ? 1 : (s.wall === 'E') ? 1 : -1;
  const alongX = (s.wall === 'N' || s.wall === 'S');
  const wpos = s.wall === 'N' ? BZ0 : s.wall === 'S' ? BZ1 : s.wall === 'E' ? BX1 : BX0;
  const fy = FY[s.f], top = fy + CEIL, W = s.to - s.from, D = s.depth;
  const y0 = s.y0, y1 = s.y0 + s.h;
  const mid = (s.from + s.to) / 2;
  /* ワールド座標で: a=壁に沿う軸, b=奥行き軸 */
  const P = (a, y, b) => alongX ? new THREE.Vector3(a, y, wpos + dir * b) : new THREE.Vector3(wpos + dir * b, y, a);
  const place = (m, a, y, b, rotY = 0) => { m.position.copy(P(a, y, b)); m.rotation.y = rotY + (alongX ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2)); g.add(m); return m; };
  /* 窓の上下の壁（腰壁・垂れ壁） */
  const fm = M.wallIn;
  if (y0 - fy > 0.02) { const ap = box(W, y0 - fy, 0.5, fm); place(ap, mid, (fy + y0) / 2, 0); }
  if (top + 0.4 - y1 > 0.02) { const hd = box(W, top + 0.4 - y1, 0.5, fm); place(hd, mid, (y1 + top + 0.4) / 2, 0); }
  /* 窓枠 */
  const frm = new THREE.MeshLambertMaterial({ color: 0x1a2430 });
  for (const [w, h, a, y] of [[W, 0.16, mid, y0], [W, 0.16, mid, y1], [0.16, s.h, s.from, (y0 + y1) / 2], [0.16, s.h, s.to, (y0 + y1) / 2]]) { const b = box(w, h, 0.56, frm); place(b, a, y, 0); }
  /* ガラス（当たり判定） */
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(W, s.h), M.glass); place(gl, mid, (y0 + y1) / 2, 0.02);
  if (alongX) addSolid(s.from, s.to, fy, top, Math.min(wpos, wpos + dir * 0.3), Math.max(wpos, wpos + dir * 0.3));
  else addSolid(Math.min(wpos, wpos + dir * 0.3), Math.max(wpos, wpos + dir * 0.3), fy, top, s.from, s.to);
  /* 水槽の中（奥・左右・天井は内側を向く光る面） */
  const back = new THREE.MeshBasicMaterial({ map: tankBackTex(s.top, s.bot), side: THREE.DoubleSide });
  const sideM = new THREE.MeshBasicMaterial({ map: tankBackTex(s.top, s.bot), side: THREE.DoubleSide, color: 0xc8d8e0 });
  const ybot = y0 - 0.25, H = (s.surf ? y0 + s.surf : y1) - ybot;
  const inTop = y1 + 0.3;
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(W, inTop - ybot), back); place(bp, mid, (ybot + inTop) / 2, D);
  for (const a of [s.from, s.to]) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(D, inTop - ybot), sideM); place(sp, a, (ybot + inTop) / 2, D / 2, Math.PI / 2); }
  /* 底（砂・岩 or 陸）とゆらめく光 */
  const floorM = s.land ? M.grass : M.sand;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), tiled(floorM, W, D, 3)); fl.rotation.x = -Math.PI / 2; fl.position.copy(P(mid, ybot, D / 2)); if (!alongX) fl.rotation.z = Math.PI / 2; g.add(fl);
  let caus = null;
  if (!s.land) { caus = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.caustic.clone()); caus.material.map = causticTex.clone(); caus.material.map.needsUpdate = true; caus.material.map.repeat.set(W / 4, D / 4); caus.rotation.x = -Math.PI / 2; caus.position.copy(P(mid, ybot + 0.02, D / 2)); if (!alongX) caus.rotation.z = Math.PI / 2; g.add(caus); }
  /* 水面（下から見上げる明るいゆらぎ）・水上がある水槽は水面を上から */
  const surfY = s.surf ? y0 + s.surf : inTop - 0.05;
  if (!s.land) {
    const sm = new THREE.MeshBasicMaterial({ map: waterTex.clone(), transparent: true, opacity: s.surf ? 0.55 : 0.7, side: THREE.DoubleSide, color: s.surf ? 0x9fdcff : 0xbfeaff, depthWrite: false });
    sm.map.needsUpdate = true; sm.map.repeat.set(W / 5, D / 5);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(W, D), sm); sp.rotation.x = -Math.PI / 2; sp.position.copy(P(mid, surfY, D / 2)); if (!alongX) sp.rotation.z = Math.PI / 2; g.add(sp);
    onUpdate((dt) => { sm.map.offset.x += dt * 0.03; sm.map.offset.y += dt * 0.017; if (caus) { caus.material.map.offset.x += dt * 0.05; caus.material.map.offset.y -= dt * 0.03; } }, P(mid, 0, 0).x, P(mid, 0, 0).z, s.f, 40);
  }
  /* 外から見た箱（建物の張り出し）。ガラス側の面は作らない＝中が見える */
  {
    const yb0 = fy - 0.2, yt = inTop + 0.6, hh = yt - yb0;
    const part = (wa, hy, wb, a, y, b) => { const m = alongX ? box(wa, hy, wb, M.wallOut) : box(wb, hy, wa, M.wallOut); m.position.copy(P(a, y, b)); scene.add(m); };
    part(W + 0.7, hh, 0.3, mid, yb0 + hh / 2, D + 0.22);               // 奥（内側の面と重ならないよう少し外へ）
    part(0.3, hh, D, s.from - 0.22, yb0 + hh / 2, D / 2);               // 左右
    part(0.3, hh, D, s.to + 0.22, yb0 + hh / 2, D / 2);
    part(W + 0.6, 0.3, D + 0.3, mid, yt - 0.15, D / 2 + 0.15);           // 屋根
    if (s.f === 2) part(W + 0.6, 0.3, D + 0.3, mid, yb0 + 0.15, D / 2 + 0.15);   // 2Fの張り出しは底も
  }
  scene.add(g);
  const c = P(mid, 0, D / 2);
  const B = alongX
    ? { x0: s.from + 0.5, x1: s.to - 0.5, y0: ybot + 0.35, y1: surfY - 0.35, z0: Math.min(wpos + dir * 0.6, wpos + dir * (D - 0.5)), z1: Math.max(wpos + dir * 0.6, wpos + dir * (D - 0.5)) }
    : { x0: Math.min(wpos + dir * 0.6, wpos + dir * (D - 0.5)), x1: Math.max(wpos + dir * 0.6, wpos + dir * (D - 0.5)), y0: ybot + 0.35, y1: surfY - 0.35, z0: s.from + 0.5, z1: s.to - 0.5 };
  const T = { g, B, f: s.f, cx: c.x, cz: c.z, glassAt: P(mid, (y0 + y1) / 2, 0), floorY: ybot, surfY, W, D, P, name, spec: s,
    add(obj) { g.add(obj); return obj; } };
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(W, s.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.bot).lerp(new THREE.Color(s.top), 0.35) }));
  ph.position.copy(P(mid, (y0 + y1) / 2, 0.06)); ph.rotation.y = alongX ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2); scene.add(ph); ph.visible = false;
  cull(g, c.x, c.z, s.f, 58); CULL[CULL.length - 1].ph = ph;
  TANKS.push(T);
  return T;
}
const TK = {};
for (const k in TANK_SPECS) TK[k] = wallTank(TANK_SPECS[k], k);
/* どのゾーンにいる時、どのゾーンが見えるか（ドアや窓ごしに見える範囲） */
const TANK_ZONE = { D_reef: 'D1', E_ise: 'E1', C_naut: 'C1', C_kabuto: 'C1', E_lobster: 'E1', E_takaashi: 'E1', F_amazon: 'F2', G_cat: 'G2', G_gator: 'G2', H_dugong: 'H2', I_otter: 'I2', I_dolphin: 'I2', J_river: 'J2' };
for (const c of CULL) { const T = TANKS.find(T => T.g === c.g); if (T) c.keys = [TANK_ZONE[T.name]]; }
const ZONE_VIS = {
  HALL1: ['HALL1', 'B1', 'OUT0'], B1: ['B1', 'HALL1', 'B2'], C1: ['C1', 'D1', 'A0'], D1: ['D1', 'C1'], E1: ['E1'],
  SHOP1: ['SHOP1', 'REST1', 'L0'], REST1: ['REST1', 'SHOP1'],
  A0: ['A0'], F2: ['F2', 'G2'], G2: ['G2', 'F2'], B2: ['B2', 'B1', 'K2'], K2: ['K2', 'B2'],
  H2: ['H2', 'JELLY2'], JELLY2: ['JELLY2', 'H2'], I2: ['I2', 'J2'], J2: ['J2', 'I2'],
  L0: ['L0', 'OUT0', 'SHOP1'], OUT0: ['OUT0', 'HALL1', 'L0'],
};

/* 島型の水槽（四方ガラス）。研究所や古代の海などの小さめの水槽に */
function islandTank(o) {
  const g = new THREE.Group(); g.name = 'island';
  const w = o.x1 - o.x0, d = o.z1 - o.z0, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, h = o.h || 2, yb = o.y + (o.base ?? 0.6);
  const base = box(w + 0.3, o.base ?? 0.6, d + 0.3, o.baseMat || M.dark); base.position.set(cx, o.y + (o.base ?? 0.6) / 2, cz); g.add(base);
  addSolid(o.x0 - 0.15, o.x1 + 0.15, o.y, o.y + (o.base ?? 0.6) + h, o.z0 - 0.15, o.z1 + 0.15);
  const backM = new THREE.MeshBasicMaterial({ map: tankBackTex(o.top || '#3a9ad0', o.bot || '#0b3556'), side: THREE.DoubleSide, transparent: true, opacity: o.dim ?? 0.35, depthWrite: false });
  const water = box(w - 0.06, h - 0.1, d - 0.06, backM); water.position.set(cx, yb + (h - 0.1) / 2, cz); g.add(water);
  const glass = box(w, h, d, M.glass); glass.position.set(cx, yb + h / 2, cz); g.add(glass);
  const lid = box(w + 0.06, 0.08, d + 0.06, M.dark); lid.position.set(cx, yb + h + 0.04, cz); g.add(lid);
  const lit = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), new THREE.MeshBasicMaterial({ color: 0xcfeaff })); lit.rotation.x = Math.PI / 2; lit.position.set(cx, yb + h - 0.02, cz); g.add(lit);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, d - 0.1), o.floorMat || M.sand); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, yb + 0.02, cz); g.add(fl);
  if (o.rocks) for (let i = 0; i < o.rocks; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.12, .32) * (o.rockScale || 1), 0), M.stone); r.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); r.position.set(rnd(o.x0 + .3, o.x1 - .3), yb + 0.08, rnd(o.z0 + .3, o.z1 - .3)); g.add(r); }
  scene.add(g);
  const B = { x0: o.x0 + 0.3, x1: o.x1 - 0.3, y0: yb + 0.15, y1: yb + h - 0.25, z0: o.z0 + 0.3, z1: o.z1 - 0.3 };
  const f = floorOf(o.y + 0.5);
  cull(g, cx, cz, f, 40);
  return { g, B, f, cx, cz, floorY: yb, add(obj) { g.add(obj); return obj; } };
}
/* 水草のビルボード（水槽用） */
const weedMat = new THREE.MeshBasicMaterial({ map: weedTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: false });
function weedAt(parent, x, y, z, hgt) { for (const ry of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(hgt * 0.55, hgt), weedMat); p.rotation.y = ry + rnd(-0.3, 0.3); p.position.set(x, y + hgt / 2, z); parent.add(p); } }
/* 岩（ケニーの岩モデルが読めたら差し替え、なければ多面体） */
const KLIB = {}, kenneyQueue = [];
ASSET.json('kenney.json').then(KB => {
  for (const name in KB) {
    try { gltfLoader.parse(b64buf(KB[name]), '', gltf => { const root = gltf.scene || gltf.scenes[0]; if (!root) return; KLIB[name] = root; for (const w of kenneyQueue.filter(q => q.name === name)) placeKenney(w); }, e => console.warn('kenney', name, e)); }
    catch (e) { console.warn('kenney', name, e); }
  }
}).catch(e => console.warn('kenney.json', e));
function kenney(name, x, y, z, s = 1, ry = 0, parent = null) { const w = { name, x, y, z, s, ry, parent }; if (KLIB[name]) placeKenney(w); else kenneyQueue.push(w); }
function placeKenney(w) { const g = KLIB[w.name].clone(true); g.scale.setScalar(w.s); g.rotation.y = w.ry; g.position.set(w.x, w.y, w.z); (w.parent || scene).add(g); }
function rockAt(parent, x, y, z, s = 1, mat = M.stone) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), mat); r.scale.set(1, rnd(.55, .85), rnd(.8, 1.2)); r.rotation.set(rnd(0, .4), rnd(0, 6), rnd(0, .4)); r.position.set(x, y + s * 0.35, z); parent.add(r); return r; }

/* ================= ゾーン看板（館内サイン） ================= */
function zoneBoard(id, x, y, z, rotY, w = 5.6) {
  const Z = ZONE_STAMPS.find(s => s.id === id);
  const sg = zoneSign(id, Z.name, Z.sub, { w, hang: 0.9 });
  sg.position.set(x, y, z); sg.rotation.y = rotY;
  return sg;
}

/* ================= エレベーター（1F⇔2F・ポーンポーン） ================= */
const EV = { y: FY[1], from: 1, state: 'idle', doorT: 0, waitT: 0, cab: null, doors: [], hall: {}, moveT: 0, ground: null };
{
  const ex = (EVS.x0 + EVS.x1) / 2, ez0 = EVS.z0;     // ドアは北向き（z=EVS.z0）
  for (const f of [1, 2]) {
    const y = FY[f]; secBegin('f' + f);
    wallZ(ez0, EVS.x0, ex - 1.05, y, y + 3.6, M.wallLobby);
    wallZ(ez0, ex + 1.05, EVS.x1, y, y + 3.6, M.wallLobby);
    wallZ(ez0, EVS.x0, EVS.x1, y + 3.6, y + CEIL, M.wallLobby);
    const fr = box(4.4, 0.7, 0.3, M.metal); fr.position.set(ex, y + 3.95, ez0); scene.add(fr);
    const lampT = textTex(['1F'], { bg: '#101820', f1: 60, w: 128, h: 96, col: '#ffcf5a' });
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshBasicMaterial({ map: lampT.tex })); lamp.position.set(ex, y + 4.1, ez0 - 0.16); lamp.rotation.y = Math.PI; scene.add(lamp);
    const dl = box(1.05, 3.6, 0.2, M.steel); dl.position.set(ex - 0.53, y + 1.8, ez0); scene.add(dl);
    const dr = box(1.05, 3.6, 0.2, M.steel); dr.position.set(ex + 0.53, y + 1.8, ez0); scene.add(dr);
    const solid = addSolid(ex - 1.05, ex + 1.05, y, y + 3.6, ez0 - 0.15, ez0 + 0.15);
    const cb = box(0.4, 0.6, 0.15, M.dark); cb.position.set(ex + 1.6, y + 1.5, ez0 - 0.12); scene.add(cb);
    const cl = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: 0x888888 })); cl.position.set(ex + 1.6, y + 1.55, ez0 - 0.2); cl.rotation.y = Math.PI; scene.add(cl);
    EV.hall[f] = { lamp, lampT, panels: [dl, dr], solid, callLamp: cl };
    /* 光る枠（見つけやすく） */
    const gm = new THREE.MeshBasicMaterial({ color: 0x39d7ff, transparent: true, opacity: 0.8 });
    for (const [gw, gh, gx, gy] of [[2.6, 0.18, ex, y + 3.7], [0.18, 3.7, ex - 1.2, y + 1.85], [0.18, 3.7, ex + 1.2, y + 1.85]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, 0.1), gm); m.position.set(gx, gy, ez0 - 0.2); scene.add(m); }
    EV.hall[f].glow = gm;
    addAction({ x: ex + 1.4, z: ez0 - 1.0, f, r: 2.4, label: '🛗 エレベーターを呼ぶ', fn: () => evCall(f) });
    const sg = sign3D(['🛗 エレベーター', f === 1 ? '2F（研究所・人魚の海）へ' : '1F（エントランス）へ'], { w: 4.6, h: 1.3, hang: y + 4.9, ceil: y + CEIL - 0.1, bg: '#123a8e', frame: '#7fd7ff', f2: 50 });
    sg.position.set(ex, 0, ez0 - 2.2);
    secEnd();
  }
  wallX(EVS.x0, EVS.z0, EVS.z1, 0, ROOF, M.wallLobby); wallX(EVS.x1, EVS.z0, EVS.z1, 0, ROOF, M.wallLobby);
  const cab = new THREE.Group();
  const fl = box(3.6, 0.2, 3.6, M.floorIn); fl.position.y = 0.1; cab.add(fl);
  const wm = new THREE.MeshLambertMaterial({ color: 0xb8c4cc });
  const bk = box(3.6, 4.2, 0.2, wm); bk.position.set(0, 2.1, 1.75); cab.add(bk);
  for (const sx of [-1.75, 1.75]) { const w = box(0.2, 4.2, 3.6, wm); w.position.set(sx, 2.1, 0); cab.add(w); }
  const ce = box(3.6, 0.15, 3.6, M.steel); ce.position.y = 4.1; cab.add(ce);
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xfff8e0 })); lp.rotation.x = Math.PI / 2; lp.position.y = 4.0; cab.add(lp);
  const mir = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), new THREE.MeshBasicMaterial({ color: 0xdce8f0 })); mir.position.set(0, 2.2, 1.63); mir.rotation.y = Math.PI; cab.add(mir);
  const cdl = box(0.9, 3.6, 0.15, M.steel); cdl.position.set(-0.5, 1.8, -1.72); cab.add(cdl);
  const cdr = box(0.9, 3.6, 0.15, M.steel); cdr.position.set(0.5, 1.8, -1.72); cab.add(cdr);
  EV.doors = [cdl, cdr];
  const pnT = textTex(['▲▼', '1F ⇔ 2F'], { bg: '#182028', f1: 40, f2: 30, w: 256, h: 170 });
  const pn = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.53), new THREE.MeshBasicMaterial({ map: pnT.tex })); pn.position.set(1.62, 1.7, -1.2); pn.rotation.y = -Math.PI / 2; cab.add(pn);
  cab.position.set(ex, FY[1], (EVS.z0 + EVS.z1) / 2); scene.add(cab); EV.cab = cab;
  EV.ground = addGround(EVS.x0 + 0.2, EVS.x1 - 0.2, EVS.z0 + 0.2, EVS.z1 - 0.2, FY[1] + 0.2);
}
function evSetLamp(f, txt, on) {
  const hd = EV.hall[f]; if (!hd || hd.key === txt + on) return; hd.key = txt + on;
  const cv = hd.lampT.tex.image, g = cv.getContext('2d');
  g.fillStyle = '#101820'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = on ? '#ffcf5a' : '#7f8a96'; g.font = `bold 60px ${SIGN_FONT}`; g.textAlign = 'center'; g.fillText(txt, cv.width / 2, 68);
  hd.lampT.tex.needsUpdate = true;
}
function evCall(f) {
  if (EV.state !== 'idle') return;
  if (EV.from === f) { EV.state = 'opening'; EV.doorT = 0; SE.ding(); }
  else { EV.state = 'coming'; EV.callFloor = f; EV.waitT = 0; SE.btn(); EV.hall[f].callLamp.material.color.set(0xffcf5a); toast('🛗 エレベーターを呼びました…'); }
}
function insideCab(p) { return p.pos.x > EVS.x0 + 0.2 && p.pos.x < EVS.x1 - 0.2 && p.pos.z > EVS.z0 + 0.15 && p.pos.z < EVS.z1 - 0.2 && Math.abs(p.pos.y - EV.cab.position.y) < 2; }
function evUpdate(dt, player) {
  const ex = (EVS.x0 + EVS.x1) / 2;
  const setDoors = k => { EV.doors[0].position.x = -0.5 - k * 0.95; EV.doors[1].position.x = 0.5 + k * 0.95; };
  switch (EV.state) {
    case 'coming': { EV.waitT += dt; const k = Math.min(1, EV.waitT / 3.2); const y = lerp(FY[EV.from], FY[EV.callFloor], k); EV.cab.position.y = y;
      evSetLamp(EV.callFloor, (y > 3.5 ? 2 : 1) + 'F', true);
      if (k >= 1) { EV.from = EV.callFloor; EV.state = 'opening'; EV.doorT = 0; SE.ding(); EV.hall[EV.from].callLamp.material.color.set(0x888888); } break; }
    case 'opening': EV.doorT += dt * 1.4; setDoors(Math.min(1, EV.doorT)); if (EV.doorT >= 1) { EV.state = 'open'; EV.waitT = 0; } break;
    case 'open': setDoors(1); EV.waitT += dt; if ((insideCab(player) && EV.waitT > 1.6) || EV.waitT > 7) { EV.state = 'closing'; EV.doorT = 0; SE.door(); } break;
    case 'closing': EV.doorT += dt * 1.4; setDoors(1 - Math.min(1, EV.doorT));
      if (EV.doorT >= 1) { if (insideCab(player)) { EV.state = 'moving'; EV.to = EV.from === 1 ? 2 : 1; EV.moveT = 0; toast(EV.to === 2 ? '🛗 2Fへまいります' : '🛗 1Fへまいります'); } else EV.state = 'idle'; } break;
    case 'moving': { EV.moveT += dt; const k = Math.min(1, EV.moveT / 4.2); const y = lerp(FY[EV.from], FY[EV.to], ease(k)); EV.cab.position.y = y;
      if (insideCab(player)) { player.pos.y = y + 0.2; player.vy = 0; player.riding = true; }
      evSetLamp(1, (y > 3.5 ? 2 : 1) + 'F', false); evSetLamp(2, (y > 3.5 ? 2 : 1) + 'F', false);
      if (k >= 1) { EV.from = EV.to; EV.state = 'opening'; EV.doorT = 0; SE.ding(); player.riding = false; toast(EV.from === 2 ? '✨ 2F とうちゃく！へんな生きもの研究所' : '✨ 1F とうちゃく！エントランスホール'); }
      break; }
    default: setDoors(0);
  }
  EV.ground.h = EV.cab.position.y + 0.2;
  for (const f of [1, 2]) {
    const hd = EV.hall[f];
    const here = EV.from === f && (EV.state === 'opening' || EV.state === 'open' || EV.state === 'closing');
    let k = 0; if (here) k = EV.state === 'opening' ? Math.min(1, EV.doorT) : EV.state === 'open' ? 1 : 1 - Math.min(1, EV.doorT);
    hd.panels[0].position.x = ex - 0.53 - k * 1.05; hd.panels[1].position.x = ex + 0.53 + k * 1.05; hd.solid.active = k < 0.5;
    if (EV.state === 'idle') evSetLamp(f, EV.from + 'F', false);
  }
}
