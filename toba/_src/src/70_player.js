/* =========================================================
   プレイヤー（3Dのわたし）・入力・カメラ・案内・メインループ
   ========================================================= */
const START = { x: 0, y: 0, z: 44, yaw: Math.PI };
const player = { pos: new THREE.Vector3(START.x, START.y, START.z), yaw: Math.PI, vy: 0, onGround: true, riding: false, seated: false, avatar: null, legs: [], arms: [], footT: 0 };
{
  const g = new THREE.Group(), proc = new THREE.Group(); g.add(proc);
  const skin = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }), shirt = new THREE.MeshLambertMaterial({ color: 0x3a8ad0 }), pants = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.4, 4, 10), shirt); body.position.y = 0.85; proc.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin); head.position.y = 1.42; proc.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a5cb0 })); cap.position.y = 1.5; proc.add(cap);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), M.dark); e.position.set(s * 0.09, 1.45, 0.23); proc.add(e); }
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), skin); arm.position.set(s * 0.36, 0.9, 0); proc.add(arm); player.arms.push(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.34, 4, 8), pants); leg.position.set(s * 0.13, 0.3, 0); proc.add(leg); player.legs.push(leg);
  }
  player.proc = proc; scene.add(g); player.avatar = g; g.visible = false;
}
/* 前作の「3Dのわたし」（Meshyで作ったリグ付きモデル）を後から読み込む */
let playerMixer = null, playerAction = null, avatarLoading = false;
function loadAvatar() {
  if (avatarLoading) return; avatarLoading = true;
  loadEmbeddedGltf('player.gltf', gltf => {
    const root = gltf.scene || gltf.scenes[0]; if (!root) return;
    const TARGET_H = 1.25;
    root.updateMatrixWorld(true);
    let bMin = 1e9, bMax = -1e9; const bv = new THREE.Vector3();
    root.traverse(o => { if (o.isBone) { o.getWorldPosition(bv); bMin = Math.min(bMin, bv.y); bMax = Math.max(bMax, bv.y); } });
    const span = bMax - bMin, bb = new THREE.Box3().setFromObject(root), sz = new THREE.Vector3(); bb.getSize(sz);
    const height = span > 0.05 ? span * 1.12 : Math.max(0.001, sz.y);
    root.scale.setScalar(TARGET_H / height); root.updateMatrixWorld(true);
    const bb2 = new THREE.Box3().setFromObject(root), c = new THREE.Vector3(); bb2.getCenter(c);
    root.position.set(-c.x, Math.max(0, -(span > 0.05 ? bMin * root.scale.y : bb2.min.y)), -c.z);
    player.proc.visible = false; player.avatar.add(root);
    if (gltf.animations && gltf.animations.length) { playerMixer = new THREE.AnimationMixer(root); playerAction = playerMixer.clipAction(gltf.animations[0]); playerAction.play(); playerAction.paused = true; }
    if (!fpMode) toast('🧢 3Dのわたし（アクア・トト版から）、じゅんび完了！');
  }, e => console.warn('player.gltf', e));
}
let camYaw = START.yaw, camPitch = 0.2, camDist = 6.0, fpMode = true;

/* ================= 入力 ================= */
const keys = {};
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (!started) return;
  if (k === 'v') toggleView();
  if (k === 'm') toggleMap();
  if (k === 'e' || k === 'enter') { if (SHOW.on) showPress(); else doAction(); }
  if (k === ' ' && SHOW.on) { showPress(); keys[' '] = false; }
  if (k === 'escape') { if (SHOW.on) endShow(true); $('mapPanel').hidden = true; $('stampCard').hidden = true; }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('contextmenu', e => e.preventDefault());
let dragging = false, dragId = null, lastX = 0, lastY = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => {
  if (!started) return;
  if (SHOW.on) showPress();
  if (IS_MOBILE && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.45) return;
  dragging = true; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointermove', e => {
  if (!dragging || e.pointerId !== dragId) return;
  camYaw -= (e.clientX - lastX) * (IS_MOBILE ? 0.0065 : 0.0052);
  camPitch = clamp(camPitch + (e.clientY - lastY) * 0.004, -0.6, 1.1);
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', e => { if (e.pointerId === dragId) dragging = false; });
cv.addEventListener('wheel', e => { camDist = clamp(camDist + e.deltaY * 0.004, 2.2, 10); }, { passive: true });
const stick = { dx: 0, dy: 0, on: false };
if (IS_MOBILE) {
  $('touchUI').hidden = false; $('touchUI').style.display = 'none';
  const base = $('stickBase'), knob = $('stickKnob'); let sid = null;
  base.addEventListener('pointerdown', e => { sid = e.pointerId; base.setPointerCapture(sid); stick.on = true; mv(e); });
  base.addEventListener('pointermove', e => { if (e.pointerId === sid) mv(e); });
  const up = () => { sid = null; stick.on = false; stick.dx = stick.dy = 0; knob.style.left = '37px'; knob.style.top = '37px'; };
  base.addEventListener('pointerup', up); base.addEventListener('pointercancel', up);
  function mv(e) { const r = base.getBoundingClientRect(); let dx = (e.clientX - r.left - 58) / 46, dy = (e.clientY - r.top - 58) / 46; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stick.dx = dx; stick.dy = dy; knob.style.left = (37 + dx * 37) + 'px'; knob.style.top = (37 + dy * 37) + 'px'; }
  $('btnA').addEventListener('pointerdown', e => { e.preventDefault(); if (SHOW.on) showPress(); else doAction(); });
  $('btnJump').addEventListener('pointerdown', e => { e.preventDefault(); if (SHOW.on) showPress(); else tryJump(); });
}
$('viewBtn').addEventListener('click', () => toggleView());
$('mapBtn').addEventListener('click', () => toggleMap());
$('mapClose').addEventListener('click', () => $('mapPanel').hidden = true);
$('sndBtn').addEventListener('click', e => { sndOn = !sndOn; e.currentTarget.textContent = sndOn ? '🔊' : '🔇'; if (!sndOn) { MUSIC.stop(); if (ambGain) ambGain.gain.value = 0; } else if (SHOW.on) MUSIC.start(); });
$('helpBtn').addEventListener('click', () => toast('順路なし！好きなゾーンへ。🗺でフロアマップ、看板に近づくとスタンプ。アシカショーはA（西のはし）、ペンギン・セイウチは外のL（東）。2Fへはエレベーター・スタジアムの客席・外のスロープから', 6500));
function toggleView(silent) {
  fpMode = !fpMode; player.avatar.visible = !fpMode;
  if (!fpMode) loadAvatar();
  if (!silent) toast(fpMode ? '👁 一人称（水槽を近くで見られる）' : '🎥 三人称（3Dのわたし）');
}
function tryJump() { if (player.onGround && !player.riding) { player.vy = 6.2; player.onGround = false; SE.plop(); } }

/* ================= アクション・説明・ゾーン ================= */
let nearAction = null;
function doAction() { if (nearAction) { SE.btn(); nearAction.fn(); } }
function actionCheck() {
  nearAction = null;
  const f = floorOf(player.pos.y);
  if (!player.seated) {
    let bd = 1e9;
    for (const a of ACTIONS) {
      if (a.f && a.f !== f) continue;
      const d = Math.hypot(player.pos.x - a.x, player.pos.z - a.z);
      if (d < a.r && d < bd && (!a.when || a.when())) { bd = d; nearAction = a; }
    }
  }
  const el = $('prompt');
  if (nearAction) { const t = nearAction.label + (IS_MOBILE ? '  🖐' : '  [E]'); if (el.textContent !== t) el.textContent = t; el.hidden = false; }
  else el.hidden = true;
}
let plaqueKey = '';
function updatePlaque() {
  const f = floorOf(player.pos.y); let best = null, bd = 99;
  for (const F of FACTS) { if (F.f && F.f !== f) continue; const d = Math.hypot(player.pos.x - F.x, player.pos.z - F.z); if (d < F.r && d < bd) { bd = d; best = F; } }
  if (!best) for (const tg of treeTags) { if (tg.f !== f) continue; const d = Math.hypot(player.pos.x - tg.x, player.pos.z - tg.z); if (d < 2.6 && d < bd) { bd = d; best = { name: '🌳 ' + tg.name, txt: tg.txt }; } }
  const el = $('plaque');
  if (best && !SHOW.on) {
    const key = best.name;
    if (key !== plaqueKey) { plaqueKey = key; el.innerHTML = `${best.zone ? `<span class="zl">${best.zone}</span>` : ''}<b>${best.name}</b><br>${best.txt}`; }
    el.hidden = false;
  } else { el.hidden = true; plaqueKey = ''; }
}
let lastZone = '';
function updateZone() {
  const p = player.pos, f = floorOf(p.y);
  const outside = p.x > BX1 + 0.3 || p.z > BZ1 + 0.3 || p.x < BX0 || p.z < BZ0;
  const Z = zoneAt(p.x, p.z, f);
  const fl = outside ? (p.y > 3.5 ? '屋外 2F' : '屋外') : (Z && Z.id === 'A' ? 'スタジアム' : f + 'F');
  const name = Z ? (Z.id.length === 1 ? Z.id + ' ' : '') + Z.name : (outside ? '鳥羽湾のほとり' : '');
  const key = fl + name;
  if (key !== lastZone) {
    lastZone = key;
    $('zoneBadge').innerHTML = `${fl}<small>${name}</small>`;
    if (Z && Z.id.length === 1) getStamp(Z.id);
  }
}

/* ================= フロアマップ ================= */
let mapFloor = 1;
const MAPX0 = -68, MAPX1 = 92, MAPZ0 = -34, MAPZ1 = 50;
function toggleMap() { const el = $('mapPanel'); el.hidden = !el.hidden; if (!el.hidden) { mapFloor = floorOf(player.pos.y); setMapTabs(); drawMap(); } }
function setMapTabs() { [...$('mapTabs').children].forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.f === mapFloor))); }
[...$('mapTabs').children].forEach(b => b.addEventListener('click', () => { mapFloor = +b.dataset.f; setMapTabs(); drawMap(); }));
function drawMap() {
  const c = $('mapCv'), g = c.getContext('2d'), W = c.width, H = c.height;
  const sx = W / (MAPX1 - MAPX0), sz = H / (MAPZ1 - MAPZ0), X = x => (x - MAPX0) * sx, Zs = z => (z - MAPZ0) * sz;
  g.fillStyle = '#04121f'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#0d3550'; g.fillRect(0, Zs(55), W, H); g.fillRect(X(90.5), 0, W, H);           // 海
  g.fillStyle = '#1d3a22'; g.fillRect(0, 0, W, Zs(55)); g.fillRect(0, 0, X(90.5), Zs(55));         // 陸
  g.fillStyle = '#26323e'; g.fillRect(X(BX0), Zs(BZ0), (BX1 - BX0) * sx, (BZ1 - BZ0) * sz);
  g.fillStyle = '#5a6a72'; g.fillRect(X(-40), Zs(24), 90 * sx, 30 * sz);
  for (const Z of ZONES) {
    if (Z.id === 'OUT') continue;
    const show = Z.f === 0 || Z.f === mapFloor; if (!show) continue;
    g.globalAlpha = (Z.f === 0 && Z.id !== 'A') && mapFloor === 2 ? 0.45 : 1;
    g.fillStyle = Z.col; g.fillRect(X(Z.x0) + 2, Zs(Z.z0) + 2, (Z.x1 - Z.x0) * sx - 4, (Z.z1 - Z.z0) * sz - 4);
    g.globalAlpha = 1;
    const cx = X((Z.x0 + Z.x1) / 2), cz = Zs((Z.z0 + Z.z1) / 2);
    g.fillStyle = '#04121f'; g.textAlign = 'center';
    if (Z.id.length === 1) { g.font = `bold 52px ${SIGN_FONT}`; g.fillText(Z.id, cx, cz + 6); }
    g.font = `bold 20px ${SIGN_FONT}`; g.fillText(Z.name.replace(/（.*）/, ''), cx, cz + (Z.id.length === 1 ? 34 : 8));
    if (Z.id.length === 1 && stampGot[Z.id]) { g.fillStyle = '#fff'; g.font = `bold 30px ${SIGN_FONT}`; g.fillText('✓', X(Z.x1) - 22, Zs(Z.z0) + 34); }
  }
  /* 目印 */
  const mark = (x, z, txt) => { g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(X(x), Zs(z), 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `bold 18px ${SIGN_FONT}`; g.textAlign = 'left'; g.fillText(txt, X(x) + 13, Zs(z) + 6); };
  mark((EVS.x0 + EVS.x1) / 2, EVS.z0 - 1, 'エレベーター');
  if (mapFloor === 1) { mark(0, 24.5, '入口'); mark(-39, 19, '客席へ(坂)'); mark(56, 18, '水の回廊へ'); mark(59.5, 0, 'スロープ(2Fへ)'); }
  else { mark(-35.5, 0, 'スタジアム客席'); mark(57, -19.5, '外のスロープ'); }
  /* 現在地 */
  if (floorOf(player.pos.y) === mapFloor || player.pos.x > BX1 || player.pos.z > BZ1) {
    const px = X(player.pos.x), pz = Zs(player.pos.z);
    g.save(); g.translate(px, pz); g.rotate(-camYaw + Math.PI);
    g.fillStyle = '#2fd0c8'; g.beginPath(); g.moveTo(0, -20); g.lineTo(12, 12); g.lineTo(0, 5); g.lineTo(-12, 12); g.closePath(); g.fill();
    g.restore(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(px, pz, 16, 0, 7); g.stroke();
  }
  g.fillStyle = '#9fc6dc'; g.font = `bold 20px ${SIGN_FONT}`; g.textAlign = 'right'; g.fillText('北 ▲ ／ 鳥羽湾は南と東', W - 14, 28);
}

/* ================= プレイヤーの更新 ================= */
function updatePlayer(dt) {
  let mx = 0, mz = 0;
  if (!player.seated) {
    if (keys['w'] || keys['arrowup']) mz += 1; if (keys['s'] || keys['arrowdown']) mz -= 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1; if (keys['d'] || keys['arrowright']) mx += 1;
    if (stick.on) { mx += stick.dx; mz -= stick.dy; }
  }
  if (fpMode && !IS_MOBILE) { camYaw += (-mx) * 2.3 * dt; mx = 0; }
  if (fpMode && IS_MOBILE) { camYaw += (-mx) * 1.6 * dt; mx *= 0.35; }
  const dash = keys['shift'] ? 1.8 : 1;
  const len = Math.hypot(mx, mz); let moving = false;
  if (len > 0.1 && !player.riding) {
    moving = true;
    const a = Math.atan2(-mx, mz), wy = camYaw + a;
    let diff = wy - player.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); player.yaw += diff * Math.min(1, dt * 10);
    const spd = 4.4 * dash * Math.min(1, len);
    moveWithCollision(player.pos.x + Math.sin(wy) * spd * dt, player.pos.z + Math.cos(wy) * spd * dt);
    player.footT -= dt * dash; if (player.footT <= 0 && player.onGround) { SE.step(); player.footT = 0.32; }
  }
  if (keys[' '] && !SHOW.on) { tryJump(); keys[' '] = false; }
  if (!player.riding) {
    const gh = groundHeight(player.pos.x, player.pos.z, player.pos.y);
    player.vy -= 16 * dt; player.pos.y += player.vy * dt;
    if (gh > -900 && player.pos.y <= gh) { player.pos.y = gh; player.vy = 0; player.onGround = true; } else player.onGround = false;
    if (player.pos.y < -8) { player.pos.set(START.x, 0, START.z); player.vy = 0; toast('入口にもどったよ'); }
  }
  const av = player.avatar; av.position.copy(player.pos); av.rotation.y = player.yaw;
  if (player.proc.visible) { const sw = moving ? Math.sin(performance.now() * 0.012 * dash) : 0; player.legs[0].rotation.x = sw * 0.7; player.legs[1].rotation.x = -sw * 0.7; player.arms[0].rotation.x = -sw * 0.5; player.arms[1].rotation.x = sw * 0.5; }
  if (playerMixer) { if (moving) { playerAction.paused = false; playerAction.timeScale = dash > 1 ? 1.7 : 1.1; playerMixer.update(dt); } else if (!playerAction.paused) { playerAction.paused = true; playerAction.time = 0; playerMixer.update(0); } }
  const eye = player.seated ? 1.05 : 1.3;
  if (fpMode) {
    camera.position.set(player.pos.x, player.pos.y + eye, player.pos.z);
    camera.lookAt(player.pos.x + Math.sin(camYaw) * Math.cos(camPitch) * 3, player.pos.y + eye - Math.sin(camPitch - 0.15) * 3, player.pos.z + Math.cos(camYaw) * Math.cos(camPitch) * 3);
    player.yaw = camYaw;
  } else {
    const cx = player.pos.x - Math.sin(camYaw) * camDist * Math.cos(camPitch), cy = player.pos.y + 1.2 + Math.sin(camPitch) * camDist, cz = player.pos.z - Math.cos(camYaw) * camDist * Math.cos(camPitch);
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 7));
    camera.lookAt(player.pos.x, player.pos.y + 1.3, player.pos.z);
  }
}
function moveWithCollision(nx, nz) {
  const R = 0.34, py = player.pos.y;
  let ok = true;
  for (const s of solids) { if (!s.active || py + 1.3 < s.y0 || py + 0.25 > s.y1) continue; if (nx + R > s.x0 && nx - R < s.x1 && player.pos.z + R > s.z0 && player.pos.z - R < s.z1) { ok = false; break; } }
  if (ok) player.pos.x = nx;
  ok = true;
  for (const s of solids) { if (!s.active || py + 1.3 < s.y0 || py + 0.25 > s.y1) continue; if (player.pos.x + R > s.x0 && player.pos.x - R < s.x1 && nz + R > s.z0 && nz - R < s.z1) { ok = false; break; } }
  if (ok) player.pos.z = nz;
}

/* ================= 世界の更新 ================= */
function updateWorld(dt, t) {
  /* 入口の自動ドア */
  const AD = window.__autoDoor; const d = Math.hypot(player.pos.x, player.pos.z - BZ1);
  const want = (d < 4.5 && player.pos.y < 3) ? 1 : 0; AD.open += (want - AD.open) * Math.min(1, dt * 4); if (want && AD.open < 0.1) SE.door();
  AD.panels[0].position.x = -1.5 - AD.open * 2.9; AD.panels[1].position.x = 1.5 + AD.open * 2.9; AD.solid.active = AD.open < 0.5;
  /* 見えない物は描かない */
  const f = floorOf(player.pos.y), px = player.pos.x, pz = player.pos.z, py = player.pos.y;
  const inside = px > BX0 && px < BX1 && pz > BZ0 && pz < BZ1;
  const S = SECTIONS;
  if (S.f1) S.f1.visible = (inside && f === 1) || (!inside && Math.hypot(px, pz - BZ1) < 36) || (px > 50 && py < 3 && Math.abs(pz - 18) < 14);
  if (S.f2) S.f2.visible = (inside && f === 2) || (px > 54 && py > 2.5) || (px < -34 && py > 4.5);
  const Zc = zoneAt(px, pz, f), vis = Zc ? ZONE_VIS[Zc.id + Zc.f] : null;
  const seen = keys => vis ? keys.some(k => vis.includes(k)) : null;
  if (S.stadium) S.stadium.visible = vis ? vis.includes('A0') : px < -24;
  if (S.eastL) S.eastL.visible = !inside || px > 30;
  for (const c of CULL_LATE) { const v = c.keys && c.keys.length ? seen(c.keys) : null; c.g.visible = v != null ? v : ((c.f === 0 || c.f === f) && Math.hypot(px - c.x, pz - c.z) < c.r); }
  for (const c of CULL) { const v = c.keys ? seen(c.keys) : null; c.g.visible = (v != null ? v : true) && (c.f === 0 || c.f === f) && Math.hypot(px - c.x, pz - c.z) < c.r; if (c.ph) c.ph.visible = !c.g.visible && (c.f === 0 || c.f === f); }
  /* 近くの生きものだけ動かす */
  for (const u of UPD) { if (u.r === 0 || ((u.f === 0 || u.f === f) && Math.hypot(px - u.x, pz - u.z) < u.r)) u.fn(dt, t); }
  /* 環境音（水槽のこぽこぽ） */
  if (ambGain && sndOn) ambGain.gain.setTargetAtTime(pz < 24 && px < 56 ? 0.035 : 0.06, ac().currentTime, 0.4);
}

/* ================= メインループ ================= */
let last = performance.now(), started = false, simT = 0;
function tick(dt, t) {
  if (started) updatePlayer(dt); else previewCam(t);
  evUpdate(dt, player);
  showUpdate(dt, t);
  updateWorld(dt, t);
  FX.update(dt);
  if (started) { actionCheck(); updatePlaque(); updateZone(); if (!$('mapPanel').hidden) drawMap(); }
}
/* タイトル画面の背景＝スタジアムの舞台をゆっくり見せる */
function previewCam(t) {
  player.pos.set(-41.5, rampH(-41.5), 0);
  const a = Math.sin(t * 0.12) * 0.25;
  camera.position.set(-40.5 + Math.sin(a) * 2, 5.2, 4 + Math.cos(a) * 2);
  camera.lookAt(-54, 1.6, 0);
}
let frameCount = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  simT += dt; tick(dt, simT);
  renderer.render(scene, camera); frameCount++;
}
loop();

function startGame(fromHot) {
  if (started) return;
  started = true;
  $('title').hidden = true;
  for (const id of ['zoneBadge', 'stampBtn', 'btns']) $(id).hidden = false;
  if (IS_MOBILE) $('touchUI').style.display = 'block';
  player.pos.set(START.x, START.y, START.z); camYaw = START.yaw; camPitch = 0.15;
  if (!fromHot) {
    try { ac().resume && ac().resume(); startAmbience(); } catch (e) { }
    try { bgmInit(); SE.happy(); } catch (e) { }
    toast('ようこそ鳥羽水族館へ！順路はないよ。まずは入口から入ってみよう', 4200);
  }
  /* 3Dのわたし（大きいデータ）は、スマホでは三人称に切りかえた時だけ読む（メモリ節約） */
  if (!IS_MOBILE) setTimeout(loadAvatar, 4000);
}
$('startBtn').addEventListener('click', () => { if ($('startBtn').getAttribute('aria-disabled') === 'true') return; startGame(false); });
/* 公開ページの更新があっても、いた場所から続けられるように */
const HOT = window.claude && window.claude.hot;
try { if (HOT && HOT.snapshot) HOT.snapshot(() => ({ started, p: [player.pos.x, player.pos.y, player.pos.z], yaw: camYaw, fp: fpMode })); } catch (e) { }
function boot(data) {
  if (data && data.started) {
    startGame(true); player.pos.set(data.p[0], data.p[1], data.p[2]); camYaw = data.yaw || 0;
    if (data.fp === false) toggleView(true);
    const resume = () => { try { ac().resume(); startAmbience(); bgmInit(); } catch (e) { } removeEventListener('pointerdown', resume); };
    addEventListener('pointerdown', resume);
  }
}
try { HOT && HOT.ready ? HOT.ready(boot) : boot((HOT && HOT.data) || {}); } catch (e) { }
/* シェーダーを先に全部つくっておく（ショーの途中でカクッとしないように） */
{
  const btn = $('startBtn'), B = window.__boot || { say: m => { $('loadTxt').textContent = m; } };
  btn.setAttribute('aria-disabled', 'true'); B.say('じゅんび中…（水槽に水を入れています）');
  FX.splash(0, -60, 0, 0.1, 6); FX.stars(0, -60, 0, 1); FX.ripple(0, -60, 0, 1); FX.confetti(0, -62, 0, 4);
  let fin = false;
  const done = () => { if (fin) return; fin = true; B.ready = true; btn.setAttribute('aria-disabled', 'false'); btn.disabled = false; B.say(''); const r = $('retryBtn'); if (r) r.remove(); };
  /* 一度「じゅんび中」を画面に出してから（rAF→setTimeout）、重いシェーダー準備に入る */
  requestAnimationFrame(() => setTimeout(() => {
    try { const p = renderer.compileAsync ? renderer.compileAsync(scene, camera) : null; if (p && p.then) p.then(done, done); else { renderer.compile(scene, camera); done(); } } catch (e) { done(); }
    setTimeout(done, IS_MOBILE ? 6000 : 9000);
  }, 30));
}

/* ================= 開発用（?auto=1&x=&y=&z=&yaw=&pitch=&tp=） ================= */
self.DBG = {
  player, SHOW, stadium, startShow, showPress, cues: () => SHOW.cues.map(c => +c.at.toFixed(2)), step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { simT += dt; tick(dt, simT); } renderer.render(scene, camera); return simT.toFixed(2); },
  prof(n = 1, dt = 1 / 30) { const out = []; for (let i = 0; i < n; i++) { simT += dt; const a = performance.now(); tick(dt, simT); const b = performance.now(); renderer.render(scene, camera); const c = performance.now(); out.push([+(SHOW.t.toFixed(2)), Math.round(b - a), Math.round(c - b)]); } return out.filter(r => r[1] + r[2] > 150); },
  setFp(on) { if (on !== fpMode) toggleView(true); },
  tp(x, y, z, yaw, pitch) { player.pos.set(x, y, z); player.vy = 0; if (yaw != null) camYaw = yaw; if (pitch != null) camPitch = pitch; },
  breakdown() {
    const fr = new THREE.Frustum(), m = new THREE.Matrix4(); camera.updateMatrixWorld(); m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(m);
    const out = {};
    scene.traverseVisible(o => { if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return; if (o.frustumCulled && o.geometry && !fr.intersectsObject(o)) return;
      let top = o; while (top.parent && top.parent !== scene) top = top.parent; const k = top.name || (top.isGroup ? 'group' : top.type) + (top.children.length ? '(' + top.children.length + ')' : ''); out[k] = (out[k] || 0) + 1; });
    return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 18);
  },
  info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, solids: solids.length, upd: UPD.length }; },
  serena() { const S = DUGONG.st, p = DUGONG.c.g.position, r = DUGONG.c.g.rotation; return { mode: S.mode, k: +S.k.toFixed(2), feed: !!S.feed, p: [p.x, p.y, p.z].map(v => +v.toFixed(2)), rot: [r.x, r.y, r.z].map(v => +v.toFixed(2)) }; },
  feed() { DUGONG.giveLettuce(); },
  stamps: () => Object.keys(stampGot),
};
if (DEV) {
  startGame(true);
  if (QS.has('x')) DBG.tp(+QS.get('x'), +(QS.get('y') || 0), +QS.get('z'), +(QS.get('yaw') || 0), +(QS.get('pitch') || 0.1));
  if (QS.get('fp') === '0') toggleView(true);
  if (QS.has('show')) { startShow(); }
}
