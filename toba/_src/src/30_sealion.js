/* ================= 生きものモジュールの合流＋予備の形 ================= */
ANIM = Object.assign({}, typeof ANIM_A === 'object' ? ANIM_A : {}, typeof ANIM_B === 'object' ? ANIM_B : {});
/* 予備: モジュールが無い/失敗しても落ちないように、色つきカプセルで代用 */
function fallbackCreature(len = 1, col = 0x888888) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.18, len * 0.6, 4, 10), new THREE.MeshLambertMaterial({ color: col }));
  b.rotation.x = Math.PI / 2; g.add(b);
  return { g, update() { }, setAction() { }, setMode() { }, setGraze() { }, setEat() { } };
}
function mk(name, ...args) {
  try { if (typeof ANIM[name] === 'function') { const c = ANIM[name](...args); if (c && c.g) return c; } }
  catch (e) { console.warn('ANIM', name, e); }
  return fallbackCreature(1, 0x7a7a8a);
}
/* 動きコントローラ（ANIM_B に無ければ簡易版） */
function swimmerCtl(c, B, o = {}) {
  if (typeof ANIM.swimmer === 'function') { try { return ANIM.swimmer(c, B, o); } catch (e) { console.warn('swimmer', e); } }
  const ctl = { lure: null, speedMul: 1, yaw: rnd(0, 6.28), tgt: new THREE.Vector3(), spd: (o.spd || 0.6) * rnd(.8, 1.2) };
  const pick = () => ctl.tgt.set(rnd(B.x0, B.x1), o.bottom ? B.y0 : rnd(B.y0, B.y1), rnd(B.z0, B.z1));
  c.g.position.set(rnd(B.x0, B.x1), o.bottom ? B.y0 : rnd(B.y0, B.y1), rnd(B.z0, B.z1)); pick();
  ctl.update = (dt) => {
    const p = c.g.position, T = ctl.lure || ctl.tgt; const dx = T.x - p.x, dz = T.z - p.z;
    if (Math.hypot(dx, dz) < 0.5 && !ctl.lure) pick();
    let d = Math.atan2(dx, dz) - ctl.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); ctl.yaw += d * Math.min(1, dt * (o.turn || 1.2));
    const s = ctl.spd * ctl.speedMul * (ctl.lure ? 1.8 : 1);
    p.x += Math.sin(ctl.yaw) * s * dt; p.z += Math.cos(ctl.yaw) * s * dt; p.y += clamp(T.y - p.y, -.4, .4) * dt;
    p.x = clamp(p.x, B.x0, B.x1); p.y = clamp(p.y, B.y0, B.y1); p.z = clamp(p.z, B.z0, B.z1);
    c.g.rotation.y = ctl.yaw; c.moving = true; c.speed = s;
  };
  return ctl;
}
function walkerCtl(c, A, o = {}) {
  if (typeof ANIM.walker === 'function') { try { return ANIM.walker(c, A, o); } catch (e) { console.warn('walker', e); } }
  const ctl = { target: null, wait: rnd(1, 3), tgt: null };
  c.g.position.set(rnd(A.x0, A.x1), A.y || 0, rnd(A.z0, A.z1));
  ctl.update = (dt) => {
    const p = c.g.position;
    if (ctl.wait > 0 && !ctl.target) { ctl.wait -= dt; c.moving = false; return; }
    const T = ctl.target || ctl.tgt || (ctl.tgt = { x: rnd(A.x0, A.x1), z: rnd(A.z0, A.z1) });
    const dx = T.x - p.x, dz = T.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.2) { if (!ctl.target) { ctl.tgt = null; ctl.wait = rnd(...(o.wait || [1, 4])); } c.moving = false; return; }
    let a = Math.atan2(dx, dz) - c.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); c.g.rotation.y += a * Math.min(1, dt * 4);
    const s = o.spd || 0.5; p.x += dx / d * s * dt; p.z += dz / d * s * dt; c.moving = true; c.speed = s;
  };
  return ctl;
}

/* ================= カリフォルニアアシカ（ショーの主役。ポーズを混ぜて動かす） =================
   ローカル: +Z=頭の向き, +Y=上。原点=おなかの下の地面（腰ピボットの真下あたり）。
   姿勢は setPose(name) で目標をセット → update で滑らかに追従。 */
const SL_MAT = {
  body: new THREE.MeshPhongMaterial({ color: 0x2c231d, specular: 0x5a5048, shininess: 70 }),
  fin: new THREE.MeshPhongMaterial({ color: 0x1e1814, specular: 0x3a3430, shininess: 40 }),
  snout: new THREE.MeshPhongMaterial({ color: 0x3b2f27, specular: 0x444444, shininess: 50 }),
  nose: new THREE.MeshPhongMaterial({ color: 0x0e0c0b, shininess: 90 }),
  eye: new THREE.MeshPhongMaterial({ color: 0x050505, specular: 0xffffff, shininess: 120 }),
  shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};
const SL_GEO = (() => {
  const lathe = (pts) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18); g.rotateX(Math.PI / 2); g.scale(1, 0.9, 1); return g; };
  /* 胴体は「腰（後ろ半分）」と「胸（前半分）」の2つに分けて、腰をくの字に曲げて座れるようにする */
  const rear = lathe([[0.0, -0.42], [0.04, -0.40], [0.09, -0.33], [0.135, -0.22], [0.165, -0.08], [0.178, 0.02], [0.0, 0.06]]);
  const front = lathe([[0.0, -0.07], [0.178, -0.04], [0.2, 0.12], [0.212, 0.28], [0.19, 0.42], [0.155, 0.52], [0.0, 0.59]]);
  const waistJ = new THREE.SphereGeometry(0.172, 16, 12); waistJ.scale(1, 0.9, 1);
  const neck = new THREE.CylinderGeometry(0.105, 0.15, 0.36, 14, 1, true); neck.rotateX(Math.PI / 2); neck.translate(0, 0, 0.16);
  const joint = new THREE.SphereGeometry(0.152, 14, 10);
  const head = new THREE.SphereGeometry(0.112, 16, 12); head.scale(1, 0.92, 1.12);
  const snout = new THREE.CylinderGeometry(0.036, 0.064, 0.15, 12); snout.rotateX(Math.PI / 2);
  const noseTip = new THREE.SphereGeometry(0.036, 10, 8); noseTip.scale(1.15, 0.85, 0.7);
  const eye = new THREE.SphereGeometry(0.022, 10, 8);
  const shine = new THREE.SphereGeometry(0.006, 6, 4);
  const ear = new THREE.ConeGeometry(0.014, 0.045, 6); ear.rotateX(-Math.PI / 2 - 0.4);
  const fore = new THREE.SphereGeometry(1, 14, 8); fore.scale(0.014, 0.25, 0.085); fore.translate(0, -0.23, 0.02);
  const hind = new THREE.SphereGeometry(1, 12, 6); hind.scale(0.065, 0.012, 0.16); hind.translate(0, 0, -0.15);
  const wisk = new THREE.BufferGeometry();
  const wp = []; for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const y = -0.012 + i * 0.007; wp.push(s * 0.04, y, 0.0, s * (0.15 + i * 0.006), y - 0.02 + i * 0.006, -0.03 - i * 0.008); }
  wisk.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  return { rear, front, waistJ, neck, joint, head, snout, noseTip, eye, shine, ear, fore, hind, wisk };
})();
const SL_WHISK = new THREE.LineBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0.8 });
/* pe=腰の傾き wa=胸の起こし sh=首 hd=頭 fx/fz=前ビレ(前後/開き) hf=後ろビレを前へ折る hs=後ろビレの開き */
const SL_POSES = {
  lie: { pe: 0, wa: -0.2, sh: -0.42, hd: 0.40, fx: 0.6, fz: 1.0, hf: 1, hs: 0.5 },
  sit: { pe: 0.05, wa: -1.2, sh: -0.05, hd: 0.35, fx: 1.12, fz: 0.22, hf: 1, hs: 0.6 },
  noseUp: { pe: 0.05, wa: -1.25, sh: -0.5, hd: -0.9, fx: 1.05, fz: 0.42, hf: 1, hs: 0.6 },
  swim: { pe: 0, wa: 0, sh: 0.0, hd: 0.10, fx: 0.9, fz: 0.25, hf: 0, hs: 0.25 },
  jump: { pe: 0, wa: 0.05, sh: 0.05, hd: 0.05, fx: 1.3, fz: 0.15, hf: 0, hs: 0.15 },
  bow: { pe: 0.05, wa: -1.0, sh: 0.6, hd: 0.8, fx: 1.0, fz: 0.3, hf: 1, hs: 0.6 },
  wave: { pe: 0.05, wa: -1.2, sh: -0.12, hd: 0.25, fx: 1.12, fz: 0.22, hf: 1, hs: 0.6, wave: 1 },
  clap: { pe: 0.05, wa: -1.2, sh: -0.18, hd: 0.2, fx: -0.4, fz: 0.1, hf: 1, hs: 0.6, clap: 1 },
  hand: { pe: 0, wa: 0, sh: -1.25, hd: 0.3, fx: -1.5, fz: 0.28, hf: 0, hs: 1.0 },     // 逆立ち（体ごと前に倒すのはショー側）
  slide: { pe: 0, wa: 0.05, sh: -0.25, hd: 0.25, fx: 1.2, fz: 0.2, hf: 0, hs: 0.2 },  // おなかで滑る
  ring: { pe: 0.05, wa: -1.2, sh: -0.38, hd: -0.25, fx: 1.05, fz: 0.42, hf: 1, hs: 0.6 }, // 輪キャッチの構え
};
function makeSeaLion(o = {}) {
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);
  const pelvis = new THREE.Group(); pelvis.position.set(0, 0.19, -0.2); root.add(pelvis);
  const rear = new THREE.Mesh(SL_GEO.rear, SL_MAT.body); pelvis.add(rear);
  const waist = new THREE.Group(); waist.position.set(0, 0.0, 0.0); pelvis.add(waist);
  waist.add(new THREE.Mesh(SL_GEO.waistJ, SL_MAT.body));
  const front = new THREE.Mesh(SL_GEO.front, SL_MAT.body); waist.add(front);
  const shoulder = new THREE.Group(); shoulder.position.set(0, 0.03, 0.47); waist.add(shoulder);
  shoulder.add(new THREE.Mesh(SL_GEO.joint, SL_MAT.body));
  const neck = new THREE.Mesh(SL_GEO.neck, SL_MAT.body); shoulder.add(neck);
  const headP = new THREE.Group(); headP.position.set(0, 0.0, 0.33); shoulder.add(headP);
  headP.add(new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 10), SL_MAT.body));
  const head = new THREE.Mesh(SL_GEO.head, SL_MAT.body); head.position.set(0, 0.03, 0.05); headP.add(head);
  const snout = new THREE.Mesh(SL_GEO.snout, SL_MAT.snout); snout.position.set(0, 0.0, 0.195); headP.add(snout);
  const nose = new THREE.Mesh(SL_GEO.noseTip, SL_MAT.nose); nose.position.set(0, 0.012, 0.272); headP.add(nose);
  const noseTip = new THREE.Object3D(); noseTip.position.set(0, 0.035, 0.29); headP.add(noseTip);   // ボールを乗せる点
  const wisk = new THREE.LineSegments(SL_GEO.wisk, SL_WHISK); wisk.position.set(0, -0.005, 0.23); headP.add(wisk);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(SL_GEO.eye, SL_MAT.eye); e.position.set(s * 0.064, 0.064, 0.118); headP.add(e); eyes.push(e);
    const sh = new THREE.Mesh(SL_GEO.shine, SL_MAT.shine); sh.position.set(s * 0.07, 0.072, 0.136); headP.add(sh);
    const ear = new THREE.Mesh(SL_GEO.ear, SL_MAT.fin); ear.position.set(s * 0.092, 0.07, -0.02); ear.rotation.z = s * 0.5; headP.add(ear);
  }
  const fores = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.15, -0.09, 0.3); waist.add(p);
    p.add(new THREE.Mesh(SL_GEO.fore, SL_MAT.fin));
    const tip = new THREE.Object3D(); tip.position.set(0, -0.47, 0.03); p.add(tip);
    fores.push({ p, s, tip });
  }
  const tail = new THREE.Group(); tail.position.set(0, -0.01, -0.37); pelvis.add(tail);
  const hinds = [];
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.05, 0, 0); tail.add(p); p.add(new THREE.Mesh(SL_GEO.hind, SL_MAT.fin)); hinds.push({ p, s }); }
  const S = o.scale || 1; g.scale.setScalar(S);
  const cur = Object.assign({ wave: 0, clap: 0 }, SL_POSES.lie), tgt = Object.assign({ wave: 0, clap: 0 }, SL_POSES.lie);
  const c = {
    g, pelvis, waist, shoulder, headP, noseTip, fores, pose: 'lie', speed: 0, blinkT: rnd(1, 4), lookYaw: 0, lookPitch: 0, swimK: 1, poseRate: 5, tt: 0,
    setPose(n, rate = 5) { if (!SL_POSES[n]) return; c.pose = n; Object.assign(tgt, { wave: 0, clap: 0 }, SL_POSES[n]); c.poseRate = rate; },
    snapPose(n) { c.setPose(n); Object.assign(cur, tgt); },
    update(dt, t) {
      const k = 1 - Math.exp(-dt * c.poseRate);
      for (const key in tgt) cur[key] += (tgt[key] - cur[key]) * k;
      pelvis.rotation.x = cur.pe; waist.rotation.x = cur.wa; shoulder.rotation.x = cur.sh;
      headP.rotation.x = cur.hd + c.lookPitch; headP.rotation.y = c.lookYaw;
      const br = Math.sin(t * 1.6);
      front.scale.set(1 + br * 0.012, 1 + br * 0.02, 1);
      const swimming = (c.pose === 'swim' || c.pose === 'jump' || c.pose === 'slide');
      const fr = 3 + c.speed * 1.4;
      const stroke = swimming ? Math.sin(t * fr) * 0.55 * c.swimK : 0;
      for (const F of fores) {
        let rx = cur.fx, rz = cur.fz * F.s;
        if (swimming) { rz += stroke * F.s; rx += Math.cos(t * fr) * 0.25 * c.swimK; }
        if (cur.wave > 0.02 && F.s > 0) { rx = lerp(rx, -1.5, cur.wave); rz = lerp(rz, 0.5 + Math.sin(t * 9) * 0.32, cur.wave); }
        if (cur.clap > 0.02) { const cl = Math.sin(t * 14) * 0.5 + 0.5; rz = lerp(rz, F.s * lerp(-0.26, 0.38, cl), cur.clap); }
        F.p.rotation.set(rx, 0, rz);
      }
      tail.rotation.x = swimming ? Math.sin(t * 2.2) * 0.14 : 0;
      for (const H of hinds) H.p.rotation.set(cur.hf * 0.35, H.s * (cur.hs * 0.5 + cur.hf * 1.9), swimming ? Math.sin(t * 2.2) * 0.1 : 0);
      c.blinkT -= dt; const bl = c.blinkT < 0.12 ? 0.15 : 1; if (c.blinkT < 0) c.blinkT = rnd(2, 5);
      eyes[0].scale.y = eyes[1].scale.y = bl;
    },
    lowestFore() { const v = new THREE.Vector3(); let m = 1e9; for (const F of fores) { F.tip.getWorldPosition(v); m = Math.min(m, v.y); } return m; },
  };
  c.snapPose(o.pose || 'lie');
  return c;
}

/* ================= 飼育員さん（青シャツ＋黄緑のサロペット＋黒長靴：動画の衣装） ================= */
const TR_MAT = {
  shirt: new THREE.MeshLambertMaterial({ color: 0x2a5bc4 }),
  bib: new THREE.MeshLambertMaterial({ color: 0xb8d62a }),
  skin: new THREE.MeshLambertMaterial({ color: 0xe9c09a }),
  hair: new THREE.MeshLambertMaterial({ color: 0x1c1712 }),
  boot: new THREE.MeshLambertMaterial({ color: 0x141414 }),
  pouch: new THREE.MeshLambertMaterial({ color: 0x5e6670 }),
};
function makeTrainer() {
  const g = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  const legs = [];
  for (const s of [-1, 1]) {
    const L = new THREE.Group(); L.position.set(s * 0.11, 0, 0); hips.add(L);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.36, 4, 8), TR_MAT.bib); thigh.position.y = -0.24; L.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.46; L.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 8), TR_MAT.bib); shin.position.y = -0.17; knee.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.28), TR_MAT.boot); boot.position.set(0, -0.4, 0.05); knee.add(boot);
    legs.push({ L, knee, s });
  }
  const torsoG = new THREE.Group(); hips.add(torsoG);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.2, 4, 10), TR_MAT.bib); belly.position.y = 0.12; belly.scale.z = 0.8; torsoG.add(belly);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.2, 4, 10), TR_MAT.shirt); chest.position.y = 0.4; chest.scale.z = 0.78; torsoG.add(chest);
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.05), TR_MAT.bib); bib.position.set(0, 0.36, 0.13); torsoG.add(bib);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.3), TR_MAT.bib); st.position.set(s * 0.11, 0.48, 0); torsoG.add(st); }
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.1), TR_MAT.pouch); pouch.position.set(0.2, 0.05, 0.08); torsoG.add(pouch);
  const head = new THREE.Group(); head.position.y = 0.72; torsoG.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), TR_MAT.skin));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), TR_MAT.hair); hair.position.y = 0.012; hair.rotation.x = -0.25; head.add(hair);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), SL_MAT.eye); e.position.set(s * 0.04, 0.01, 0.105); head.add(e); }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.25, 0.55, 0); torsoG.add(sh);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.24, 4, 8), TR_MAT.shirt); up.position.y = -0.16; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), TR_MAT.skin); lo.position.y = -0.14; el.add(lo);
    const hand = new THREE.Object3D(); hand.position.y = -0.3; el.add(hand);
    arms.push({ sh, el, hand, s });
  }
  const c = {
    g, arms, head, torsoG, walkT: 0, moving: false, gest: 'idle', gestT: 0,
    gesture(n) { c.gest = n; c.gestT = 0; },
    update(dt, t) {
      c.gestT += dt;
      const w = c.moving ? Math.sin(c.walkT += dt * 7) : 0;
      for (const L of legs) { L.L.rotation.x = w * 0.55 * L.s; L.knee.rotation.x = Math.max(0, -w * L.s) * 0.6; }
      hips.position.y = 0.92 + Math.abs(w) * 0.03;
      const A = arms[1], B = arms[0];     // A=右手, B=左手
      const set = (arm, sx, sz, ex) => { arm.sh.rotation.x = lerp(arm.sh.rotation.x, sx, Math.min(1, dt * 10)); arm.sh.rotation.z = lerp(arm.sh.rotation.z, sz * arm.s, Math.min(1, dt * 10)); arm.el.rotation.x = lerp(arm.el.rotation.x, ex, Math.min(1, dt * 10)); };
      switch (c.gest) {
        case 'signal': set(A, -2.9, 0.15, -0.2); set(B, 0, 0.12, -0.2); break;                       // 片手を高く上げる合図
        case 'point': set(A, -1.45, 0.05, 0); set(B, 0, 0.12, -0.2); break;                          // 指し示す
        case 'throw': { const k = clamp(c.gestT / 0.45, 0, 1); set(A, lerp(0.9, -2.4, ease(k)), 0.1, -0.3); set(B, -0.6, 0.15, -0.4); break; }
        case 'hoop': set(A, -1.2, -0.25, -0.5); set(B, -1.2, -0.25, -0.5); break;                    // 輪を前に構える
        case 'clap': { const k = Math.sin(c.gestT * 16) * 0.5 + 0.5; set(A, -1.2, -0.3 - k * 0.25, -0.9); set(B, -1.2, -0.3 - k * 0.25, -0.9); break; }
        case 'feed': { const k = Math.sin(c.gestT * 5); set(A, -0.9 + k * 0.4, 0.1, -0.8); set(B, 0, 0.12, -0.2); break; }
        case 'wave': set(A, -2.6, 0.25 + Math.sin(c.gestT * 9) * 0.35, -0.3); set(B, 0, 0.12, -0.2); break;
        case 'bow': set(A, 0.1, 0.1, -0.1); set(B, 0.1, 0.1, -0.1); break;
        default: set(A, w * -0.5, 0.12, -0.25); set(B, w * 0.5, 0.12, -0.25);
      }
      torsoG.rotation.x = lerp(torsoG.rotation.x, c.gest === 'bow' ? 0.55 : 0, Math.min(1, dt * 6));
      head.rotation.y = Math.sin(t * 0.7) * 0.15;
    },
    handWorld(i = 1) { const v = new THREE.Vector3(); arms[i].hand.getWorldPosition(v); return v; },
  };
  return c;
}

/* ================= 観客（インスタンス描画で軽く。拍手で揺れる） ================= */
function makeAudience(seats) {
  const n = seats.length;
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.34, 3, 8), headGeo = new THREE.SphereGeometry(0.13, 10, 8), handGeo = new THREE.SphereGeometry(0.05, 6, 4);
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial(), n);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), n);
  const hands = new THREE.InstancedMesh(handGeo, new THREE.MeshLambertMaterial({ color: 0xe9c09a }), n * 2);
  const shirt = [0xe85a5a, 0x4a8ad8, 0xf2c14e, 0x5bbf7a, 0xf0f0f0, 0x333a44, 0xd77ac8, 0x8a5a3a, 0x58c0d0, 0xff9a52];
  const hair = [0x1a1410, 0x2a1e16, 0x3b2a1e, 0x111111, 0x6a4a2a];
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const people = seats.map((s, i) => ({ ...s, ph: rnd(0, 6.28), kid: Math.random() < 0.25 }));
  people.forEach((pp, i) => {
    bodies.setColorAt(i, col.setHex(shirt[(Math.random() * shirt.length) | 0]));
    heads.setColorAt(i, col.setHex(Math.random() < 0.15 ? 0xe9c09a : hair[(Math.random() * hair.length) | 0]));
  });
  const g = new THREE.Group(); g.add(bodies, heads, hands);
  const A = { g, cheer: 0, look: null,
    update(dt, t) {
      A.cheer = Math.max(0, A.cheer - dt * 0.35);
      people.forEach((pp, i) => {
        const k = pp.kid ? 0.78 : 1;
        const bob = A.cheer > 0 ? Math.abs(Math.sin(t * 9 + pp.ph)) * 0.06 * Math.min(1, A.cheer * 2) : Math.sin(t * 0.8 + pp.ph) * 0.006;
        p.set(pp.x, pp.y + 0.45 * k + bob, pp.z); sc.set(k, k, k); q.identity(); m4.compose(p, q, sc); bodies.setMatrixAt(i, m4);
        p.set(pp.x, pp.y + 0.86 * k + bob, pp.z); m4.compose(p, q, sc); heads.setMatrixAt(i, m4);
        for (let h = 0; h < 2; h++) {
          const s = h ? 1 : -1;
          if (A.cheer > 0.05) { const cl = Math.sin(t * 15 + pp.ph) * 0.5 + 0.5; p.set(pp.x + pp.fx * 0.25 + pp.sx * s * (0.03 + cl * 0.09), pp.y + 0.82 * k + bob, pp.z + pp.fz * 0.25 + pp.sz * s * (0.03 + cl * 0.09)); }
          else { p.set(pp.x + pp.fx * 0.18 + pp.sx * s * 0.12, pp.y + 0.38 * k, pp.z + pp.fz * 0.18 + pp.sz * s * 0.12); }
          m4.compose(p, q, sc); hands.setMatrixAt(i * 2 + h, m4);
        }
      });
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = hands.instanceMatrix.needsUpdate = true;
    } };
  A.update(0, 0);
  return A;
}

/* ================= 舞台の小道具 ================= */
const crateTex = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#ece6d4'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,140,115,.6)'; g.lineWidth = 3; for (let y = 0; y < h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = '#d8cfb4'; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22);
  g.beginPath(); g.moveTo(16, 16); g.lineTo(w - 16, h - 16); g.moveTo(w - 16, 16); g.lineTo(16, h - 16); g.stroke();
  g.strokeStyle = 'rgba(120,110,90,.45)'; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
});
function makeCrate() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ map: crateTex });
  const b = box(1.0, 0.62, 0.66, m); b.position.y = 0.31; g.add(b);
  const lid = box(0.82, 0.03, 0.4, new THREE.MeshLambertMaterial({ color: 0xb8a27a })); lid.position.set(0, 0.635, 0); g.add(lid);
  return g;
}
const BALL_MAT = new THREE.MeshPhongMaterial({ color: 0xffc928, specular: 0x777755, shininess: 60 });
function makeBall(r = 0.13) {
  const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), BALL_MAT); g.add(b);
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.002, r * 0.06, 6, 24), new THREE.MeshPhongMaterial({ color: 0xff8a1c, shininess: 40 })); band.rotation.x = Math.PI / 2; g.add(band);
  return g;
}
const hoopTex = ctex(256, 16, (g, w, h) => { const cs = ['#ff6f95', '#ffffff', '#4a7ae0', '#ffffff']; for (let i = 0; i < 16; i++) { g.fillStyle = cs[i % 4]; g.fillRect(i * 16, 0, 16, h); } });
function makeHoop(R = 0.55) { return new THREE.Mesh(new THREE.TorusGeometry(R, 0.024, 8, 40), new THREE.MeshLambertMaterial({ map: hoopTex })); }
function makeRing(col) { return new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), new THREE.MeshLambertMaterial({ color: col })); }
function makeBucket(col = 0xffffff) {
  const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 14, 1, true), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })); b.position.y = 0.13; g.add(b);
  const fish = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshPhongMaterial({ color: 0xb8c6d0, shininess: 90 })); fish.scale.set(1, 0.5, 2); fish.position.y = 0.22; g.add(fish); return g;
}
function makeFishSnack() { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshPhongMaterial({ color: 0xc0ccd6, shininess: 100 })); f.scale.set(0.5, 0.6, 2); return f; }
