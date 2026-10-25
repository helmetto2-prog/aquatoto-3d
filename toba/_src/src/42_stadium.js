/* =========================================================
   A パフォーマンススタジアム（アシカショー会場）— 動画の舞台を再現
   客席は東→西（舞台）を向く。客席の最上段が2F、横の通路が1F（古代の海）につながる
   ========================================================= */
const STG = {
  stageTop: 1.2, waterY: 0.72, poolX0: -56, poolX1: -46, poolZ0: -15, poolZ1: 15, rimX: -46,
  walkY: 1.4, seatX0: -44, seatX1: -37.4, topY: FY[2],
};
const rampH = x => STG.walkY + clamp((x - STG.seatX0) / (STG.seatX1 - STG.seatX0), 0, 1) * (STG.topY - STG.walkY);
/* 岩肌（ベージュの砂岩っぽい段々。動画の背景の岩） */
const stageRockTex = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#d6c7a2'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += rnd(14, 30)) {
    const hh = rnd(10, 26);
    g.fillStyle = `rgba(${200 + rnd(-20, 20) | 0},${186 + rnd(-20, 20) | 0},${150 + rnd(-20, 20) | 0},.9)`; g.fillRect(0, y, w, hh);
    g.fillStyle = 'rgba(120,100,70,.35)'; g.fillRect(0, y + hh - 2, w, 2.5);
    for (let x = 0; x < w; x += rnd(30, 70)) { g.fillStyle = 'rgba(110,92,64,.32)'; g.fillRect(x, y, 2, hh); }
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd(80, 140) | 0},${rnd(70, 120) | 0},${rnd(50, 90) | 0},${rnd(.05, .18)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 6), rnd(1, 4)); }
}, 2, 2);
const muralTex = ctex(512, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fd6e0'); gr.addColorStop(.45, '#2fb6b8'); gr.addColorStop(1, '#127a86');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) { g.beginPath(); const y = 50 + i * 8; for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 4); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(40 + i * 110, 22 + (i % 2) * 6, 26, 8, 0, 0, 7); g.fill(); }
});
const stadium = { sea: null, trainer: null, aud: null, props: {}, seat: null, idle: true };
secBegin('stadium');
{
  const sx0 = -64, sx1 = -34;
  /* 床（ホール全体の暗い床）— プールの所は抜く */
  floorPlane(sx0, STG.poolX0, BZ0, BZ1, 0, M.floorDark, 4);
  floorPlane(STG.poolX1, sx1, BZ0, STG.poolZ0 - 0.2, 0, M.floorDark, 4);
  floorPlane(STG.poolX1, sx1, STG.poolZ1 + 0.2, BZ1, 0, M.floorDark, 4);
  /* 天井とライト */
  const lm = new THREE.MeshBasicMaterial({ color: 0xfff4d8 });
  for (let x = -60; x <= -38; x += 6) for (let z = -16; z <= 16; z += 8) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), lm); l.rotation.x = Math.PI / 2; l.position.set(x, ROOF - 0.75, z); scene.add(l); }
  const ceil = box(30, 0.2, 48, new THREE.MeshLambertMaterial({ color: 0x24384c })); ceil.position.set(-49, ROOF - 0.7, 0); scene.add(ceil);
  /* ---- 舞台（白っぽい床・手前がふくらんだ形）---- */
  const shp = new THREE.Shape();
  shp.moveTo(-62.6, -13); shp.lineTo(-62.6, 13); shp.lineTo(-55.6, 13); shp.quadraticCurveTo(-51.6, 0, -55.6, -13); shp.lineTo(-62.6, -13);
  const sg = new THREE.ExtrudeGeometry(shp, { depth: STG.stageTop + 3.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.08, bevelSegments: 2, curveSegments: 24 });
  sg.rotateX(Math.PI / 2); sg.translate(0, STG.stageTop, 0);
  const stageM = new THREE.MeshPhongMaterial({ color: 0xefe9da, specular: 0x666666, shininess: 35 });
  const stage = new THREE.Mesh(sg, stageM); scene.add(stage);
  /* 舞台のうっすら水たまり（濡れた床の光） */
  for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(rnd(0.4, 1.1), 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })); p.rotation.x = -Math.PI / 2; p.position.set(rnd(-60, -56), STG.stageTop + 0.01, rnd(-10, 10)); scene.add(p); }
  /* ---- 岩の背景（段々の岩＋白いドア＋上に海の壁画）---- */
  const rockM = new THREE.MeshLambertMaterial({ map: stageRockTex });
  const wallB = box(1.2, 11, 34, rockM); wallB.position.set(-63.6, 5.5, 0); scene.add(wallB);
  for (let i = 0; i < 26; i++) {
    const z = rnd(-16, 16), y = rnd(1.4, 8.5), s = rnd(1.0, 2.2);
    const r = new THREE.Mesh(new THREE.BoxGeometry(s * rnd(1.2, 2), s * rnd(0.5, 0.9), s * rnd(1.4, 2.6)), rockM); r.position.set(-62.9 + rnd(-0.2, 0.5), y, z); r.rotation.set(rnd(-0.08, 0.08), rnd(-0.2, 0.2), rnd(-0.06, 0.06)); scene.add(r);
  }
  /* 右手（北側）の段々の岩棚 */
  for (let i = 0; i < 5; i++) { const st = box(2.4 - i * 0.3, 0.9, 6, rockM); st.position.set(-61.6 + i * 0.25, STG.stageTop + 0.45 + i * 0.9, -9.5 + i * 0.6); scene.add(st); }
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(34, 3.4), new THREE.MeshBasicMaterial({ map: muralTex })); mural.position.set(-62.95, 9.6, 0); mural.rotation.y = Math.PI / 2; scene.add(mural);
  const door = box(0.3, 2.6, 1.5, M.white); door.position.set(-62.7, STG.stageTop + 1.3, 3.5); scene.add(door);
  /* 左手（南側）の籐のキャビネット＋バケツ */
  const cab = box(0.8, 1.2, 1.1, new THREE.MeshLambertMaterial({ color: 0x3a2e26 })); cab.position.set(-61.6, STG.stageTop + 0.75, 9.4); scene.add(cab);
  for (const dz of [-0.45, 0.45]) for (const dx of [-0.3, 0.3]) { const lg = box(0.06, 0.3, 0.06, M.dark); lg.position.set(-61.6 + dx, STG.stageTop + 0.15, 9.4 + dz); scene.add(lg); }
  const bk = makeBucket(0xffffff); bk.position.set(-61.6, STG.stageTop + 1.35, 9.2); scene.add(bk);
  /* 北の端の木の格子 */
  for (let i = 0; i < 6; i++) { const st = box(0.08, 3.2, 0.12, new THREE.MeshLambertMaterial({ color: 0x9c8a70 })); st.position.set(-61.0, STG.stageTop + 1.6, -12.6 + i * 0.5); st.rotation.x = (i % 2 ? 0.6 : -0.6); scene.add(st); }
  /* ---- プール（深い青。客席側のふちは青いコンクリート）---- */
  const poolIn = new THREE.MeshLambertMaterial({ color: 0x1d5f8c });
  const pfl = box(STG.poolX1 - STG.poolX0 + 1, 0.3, STG.poolZ1 - STG.poolZ0 + 1, poolIn); pfl.position.set((STG.poolX0 + STG.poolX1) / 2, -3.15, 0); scene.add(pfl);
  for (const z of [STG.poolZ0 - 0.3, STG.poolZ1 + 0.3]) { const w = box(STG.poolX1 - STG.poolX0 + 0.6, 4.3, 0.6, poolIn); w.position.set((STG.poolX0 + STG.poolX1) / 2, -0.85, z); scene.add(w); }
  const rim = box(0.9, 4.4, STG.poolZ1 - STG.poolZ0 + 1.2, new THREE.MeshLambertMaterial({ color: 0x2b78c2 })); rim.position.set(STG.rimX + 0.45, -0.85, 0); scene.add(rim);
  const rimTop = box(1.0, 0.18, STG.poolZ1 - STG.poolZ0 + 1.2, new THREE.MeshLambertMaterial({ color: 0x3a8ad6 })); rimTop.position.set(STG.rimX + 0.45, STG.walkY + 0.06, 0); scene.add(rimTop);
  const waterM = new THREE.MeshBasicMaterial({ map: waterTex.clone(), color: 0x2a86b0, transparent: true, opacity: 0.86, depthWrite: false });
  waterM.map.needsUpdate = true; waterM.map.repeat.set(3, 6);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(STG.poolX1 - STG.poolX0 + 0.2, STG.poolZ1 - STG.poolZ0 + 0.4), waterM); water.rotation.x = -Math.PI / 2; water.position.set((STG.poolX0 + STG.poolX1) / 2, STG.waterY, 0); scene.add(water);
  stadium.waterM = waterM;
  /* ---- 客席（8段・中央に通路）---- */
  const benchM = new THREE.MeshLambertMaterial({ color: 0x2f7fa8 }), riserM = new THREE.MeshLambertMaterial({ color: 0x5d6b78 });
  const rows = 8, rw = (STG.seatX1 - STG.seatX0) / rows;
  const seats = [];
  for (let i = 0; i < rows; i++) {
    const x0 = STG.seatX0 + i * rw, tH = rampH(x0 + rw * 0.5);
    const riser = box(rw, tH, 30.4, riserM); riser.position.set(x0 + rw / 2, tH / 2, 0); scene.add(riser);
    const tread = box(rw, 0.06, 30.4, new THREE.MeshLambertMaterial({ color: 0x8796a4 })); tread.position.set(x0 + rw / 2, tH + 0.03, 0); scene.add(tread);
    for (const [z0, z1] of [[-15, -1.1], [1.1, 15]]) {
      const b = box(0.42, 0.42, z1 - z0, benchM); b.position.set(x0 + 0.28, tH + 0.24, (z0 + z1) / 2); scene.add(b);
      for (let z = z0 + 0.45; z < z1 - 0.3; z += 0.78) {
        if (i === 2 && z > 1 && z < 2.6) continue;                    // あなたの席（黄色いクッション）は空けておく
        if (Math.random() < 0.72) seats.push({ x: x0 + 0.3, y: tH + 0.12, z: z + rnd(-0.08, 0.08), fx: -1, fz: 0, sx: 0, sz: 1 });
      }
    }
  }
  addGround(STG.seatX0, STG.seatX1, -15, 15, { axis: 'x', a: STG.seatX0, b: STG.seatX1, ha: STG.walkY, hb: STG.topY });
  /* あなたの席（黄色いクッション）*/
  const myX = STG.seatX0 + 2 * rw + 0.3, myY = rampH(STG.seatX0 + 2.5 * rw);
  const cushion = box(0.4, 0.08, 0.7, new THREE.MeshLambertMaterial({ color: 0xffc93c })); cushion.position.set(myX - 0.02, myY + 0.5, 1.85); scene.add(cushion);
  stadium.seat = { x: myX + 0.15, y: myY + 0.12, z: 1.85 };
  /* 観客 */
  stadium.aud = makeAudience(seats); scene.add(stadium.aud.g);
  /* 前の通路（1段目の前・プールのふち沿い）と最上段の通路 */
  const walk = box(2.0, STG.walkY, 37, M.floorDark); walk.position.set(-45, STG.walkY / 2, 3.5); scene.add(walk);
  addGround(-46, -44, -15, 22, STG.walkY);
  const topW = box(STG.seatX1 + 34 > 0 ? 0.1 : -34 - STG.seatX1, 0.4, 30.4, M.floorIn); topW.position.set((STG.seatX1 - 34) / 2, STG.topY - 0.2, 0); scene.add(topW);
  floorPlane(STG.seatX1, -34, -15.2, 15.2, STG.topY, M.floorIn, 3);
  addGround(STG.seatX1, -34, -15.2, 15.2, STG.topY);
  /* 横の通路（1Fの古代の海から、ゆるい坂で前の通路へ）*/
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 5.5), tiled(M.floorDark, 10, 5.5, 4));
  aisle.rotation.x = -Math.PI / 2; aisle.rotation.y = Math.atan2(STG.walkY, 10); aisle.position.set(-39, STG.walkY / 2, 19.25); scene.add(aisle);
  const aisleBase = box(10, 0.1, 5.5, M.floorDark); aisleBase.visible = false;
  addGround(-44, -34, 16.5, 22, { axis: 'x', a: -44, b: -34, ha: STG.walkY, hb: 0 });
  /* 落ちないための壁と手すり */
  wallZ(15.35, -44, -34, 0, 8.3, M.wallIn); wallZ(-15.35, -46.1, -34, 0, 8.3, M.wallIn);
  wallZ(16.3, -44, -34, 0, 1.6, M.wallIn);
  railing(STG.rimX - 0.02, STG.rimX + 0.04, -15, 15, STG.walkY, 1.0);
  railing(-46.1, -44, 22, 22.1, STG.walkY, 1.0); railing(-46.2, -46.1, 15, 22, STG.walkY, 1.0);
  railing(STG.seatX1, -34, 15.2, 15.25, STG.topY, 1.1); railing(STG.seatX1, -34, -15.25, -15.2, STG.topY, 1.1);
  addSolid(-64, STG.rimX - 0.05, -16, 16, STG.walkY - 1, 12);   // 舞台とプールには入れない
  solids[solids.length - 1] = { x0: -64, x1: STG.rimX - 0.05, y0: -4, y1: 12, z0: -16, z1: 16, active: true };
  /* 看板 */
  zoneBoard('A', -45, STG.topY + 4.6, 0, -Math.PI / 2, 7);
  const sh = sign3D(['🦭 アシカショー', '10:30 ／ 13:00 ／ 15:30（約15分）'], { w: 6, h: 1.6, bg: '#8a3a1a', f2: 56, oneSide: true });
  sh.position.set(-62.8, 11.6, 0); sh.rotation.y = Math.PI / 2;
  const sg2 = sign3D(['A パフォーマンススタジアム', '席にすわって [E] でショーがはじまるよ'], { w: 5.4, h: 1.4, posts: 2.3, bg: '#8a4a12', f2: 46 });
  sg2.position.set(-36.6, STG.topY, -13.5); sg2.rotation.y = -Math.PI / 2;
  const sg3 = sign3D(['▲ 客席・2Fへ', 'アシカショー会場（前の通路へ）'], { w: 4.6, h: 1.3, posts: 1.6, bg: '#8a4a12', f2: 46 });
  sg3.position.set(-35.5, 0, 19.2); sg3.rotation.y = -Math.PI / 2;
  /* ---- 出演者 ---- */
  stadium.sea = makeSeaLion({ scale: 1.14, pose: 'swim' }); scene.add(stadium.sea.g);
  stadium.trainer = makeTrainer(); scene.add(stadium.trainer.g);
  stadium.trainer.g.position.set(-59.5, STG.stageTop, -6); stadium.trainer.g.rotation.y = Math.PI / 2;
  const P = stadium.props;
  P.crate = makeCrate(); P.crate.position.set(-58.2, STG.stageTop, 5.2); P.crate.rotation.y = Math.PI / 2; scene.add(P.crate);
  P.ball = makeBall(0.14); scene.add(P.ball);
  P.stand = new THREE.Group(); const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.1, 16), M.dark); sb.position.y = 0.05; P.stand.add(sb);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), M.dark); pole.position.y = 0.6; P.stand.add(pole);
  P.stand.position.set(-56.8, STG.stageTop, -10.4); scene.add(P.stand);
  P.ball.position.set(-56.8, STG.stageTop + 1.29, -10.4);
  P.ballHome = P.ball.position.clone();
  P.hoop = makeHoop(0.58); P.hoop.visible = false; scene.add(P.hoop);
  P.rings = [0xff6f95, 0x4a7ae0, 0xffc93c].map(c => { const r = makeRing(c); r.visible = false; scene.add(r); return r; });
  /* ハイジャンプのボール（天井から吊るす）*/
  P.hiBall = makeBall(0.17); P.hiBall.position.set(-50.6, 5.2, 0); scene.add(P.hiBall);
  P.hiLine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), M.dark); scene.add(P.hiLine);
  P.hiTop = ROOF - 0.8;
  const pl = new THREE.PointLight(0xfff0d0, 1.2, 40); pl.position.set(-52, 10, 0); scene.add(pl);
  /* ふだん（ショーの前後）はプールをくるくる泳ぐ */
  stadium.idleT = 0;
  onUpdate((dt, t) => {
    waterM.map.offset.x += dt * 0.05; waterM.map.offset.y += dt * 0.02;
    const L = P.hiLine, b = P.hiBall.position; L.position.set(b.x, (b.y + P.hiTop) / 2, b.z); L.scale.y = Math.max(0.1, P.hiTop - b.y);
    stadium.aud.update(dt, t);
    if (!stadium.idle) return;
    stadium.idleT += dt;
    const a = stadium.idleT * 0.55, S = stadium.sea;
    const x = -51 + Math.cos(a) * 3.2, z = Math.sin(a) * 11;
    const y = STG.waterY - 0.55 + Math.sin(stadium.idleT * 1.7) * 0.25;
    S.g.position.set(x, y, z);
    S.g.rotation.set(0, Math.atan2(-Math.sin(a) * 3.2, Math.cos(a) * 11), 0);
    if (S.pose !== 'swim') S.setPose('swim'); S.speed = 2.2;
    S.update(dt, t);
    const T = stadium.trainer; T.moving = false; if (T.gest !== 'idle') T.gesture('idle'); T.update(dt, t);
  }, -48, 0, 0, 60);
}
secEnd();
addFact({ x: -45, z: 0, f: 1, r: 7, zone: 'A', name: 'A パフォーマンススタジアム', txt: 'アシカショーの会場。客席の上の段は2F、横の通路は1Fの古代の海につながっているよ' });
addFact({ x: -36, z: 0, f: 2, r: 4.5, zone: 'A', name: 'A パフォーマンススタジアム（客席の上）', txt: '前のほうの席に座るとしぶきが来るかも！黄色いクッションがあなたの席' });
