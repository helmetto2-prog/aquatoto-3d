/* =========================================================
   エフェクト（しぶき・波紋・ハート・キラキラ・紙ふぶき）
   ========================================================= */
const FX = (() => {
  const list = [];
  const dropTex = ctex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(210,240,255,.8)'); gr.addColorStop(1, 'rgba(210,240,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const heartTex = ctex(64, 64, (g) => { g.fillStyle = '#ff6a8a'; g.font = '50px sans-serif'; g.textAlign = 'center'; g.fillText('♥', 32, 50); });
  const starTex = ctex(64, 64, (g) => { g.fillStyle = '#ffe27a'; g.font = '50px sans-serif'; g.textAlign = 'center'; g.fillText('★', 32, 50); });
  function splash(x, y, z, power = 1, n = 70) {
    const N = Math.round(n * power), pos = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) { pos[i * 3] = x + rnd(-.3, .3); pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + rnd(-.3, .3); const a = rnd(0, 6.28), s = rnd(.8, 2.6) * power; vel.push(Math.cos(a) * s, rnd(2.5, 6.5) * power, Math.sin(a) * s); }
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: dropTex, size: 0.22, transparent: true, depthWrite: false, opacity: 1 });
    const p = new THREE.Points(ge, m); scene.add(p);
    list.push({ kind: 'splash', obj: p, pos, vel, N, t: 0, y0: y });
    ripple(x, y + 0.02, z, 1.4 * power);
    SE.splash(Math.min(1.6, power));
  }
  function ripple(x, y, z, s = 1) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 28), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.set(x, y, z); scene.add(r); list.push({ kind: 'ripple', obj: r, t: 0, s });
  }
  function sprite(tex, x, y, z, sc = .7, kind = 'heart') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.position.set(x, y, z); s.scale.setScalar(sc); scene.add(s);
    list.push({ kind, obj: s, t: 0, vx: rnd(-.3, .3), vz: rnd(-.3, .3) });
  }
  function hearts(x, y, z, n = 3) { for (let i = 0; i < n; i++) setTimeout(() => sprite(heartTex, x + rnd(-.3, .3), y + rnd(0, .3), z + rnd(-.3, .3), rnd(.5, .8)), i * 160); }
  function stars(x, y, z, n = 6) { for (let i = 0; i < n; i++) sprite(starTex, x + rnd(-.6, .6), y + rnd(-.2, .5), z + rnd(-.6, .6), rnd(.35, .6), 'star'); }
  function confetti(x, y, z, n = 80) {
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ color: [0xffd76a, 0x7ac0ff, 0x9ae08a, 0xff8a9a][i % 4], side: THREE.DoubleSide }));
      c.position.set(x + rnd(-3, 3), y + rnd(2, 5), z + rnd(-3, 3)); scene.add(c);
      list.push({ kind: 'conf', obj: c, t: 0, vy: rnd(-.5, -1.5), rs: rnd(2, 7) });
    }
  }
  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]; f.t += dt; let done = false;
      if (f.kind === 'splash') {
        for (let j = 0; j < f.N; j++) { f.vel[j * 3 + 1] -= 11 * dt; f.pos[j * 3] += f.vel[j * 3] * dt; f.pos[j * 3 + 1] += f.vel[j * 3 + 1] * dt; f.pos[j * 3 + 2] += f.vel[j * 3 + 2] * dt; }
        f.obj.geometry.attributes.position.needsUpdate = true; f.obj.material.opacity = Math.max(0, 1 - f.t / 1.3); done = f.t > 1.3;
      } else if (f.kind === 'ripple') { f.obj.scale.setScalar(1 + f.t * 4 * f.s); f.obj.material.opacity = Math.max(0, .9 - f.t * .9); done = f.t > 1; }
      else if (f.kind === 'heart' || f.kind === 'star') { f.obj.position.y += dt * .8; f.obj.position.x += f.vx * dt; f.obj.position.z += f.vz * dt; f.obj.material.opacity = Math.max(0, 1 - f.t * .7); done = f.t > 1.4; }
      else if (f.kind === 'conf') { f.obj.position.y += f.vy * dt; f.obj.rotation.x += f.rs * dt; f.obj.rotation.z += f.rs * dt; done = f.t > 3.2; }
      if (done) { scene.remove(f.obj); if (f.obj.geometry) f.obj.geometry.dispose(); if (f.obj.material) f.obj.material.dispose(); list.splice(i, 1); }
    }
  }
  return { splash, ripple, hearts, stars, confetti, update };
})();
function confetti() { FX.confetti(player.pos.x, player.pos.y, player.pos.z); }

/* =========================================================
   アシカショー（合図のタイミングで技が決まる）
   ========================================================= */
const SHOW = { on: false, t: 0, i: 0, bt: 0, score: 0, n: 0, cue: null, results: [], ended: 0 };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SP = {
  front: V3(-55.3, STG.stageTop, 0.6), center: V3(-57.4, STG.stageTop, 0.4), crate: V3(-58.2, STG.stageTop, 5.2),
  trainer: V3(-57.9, STG.stageTop, -2.4), trEdge: V3(-54.6, STG.stageTop, -1.2),
};
const FACE_AUD = Math.PI / 2;     // アシカ・飼育員が客席（+X）を向く角度
const arc = (p0, p1, h, k) => V3(lerp(p0.x, p1.x, k), lerp(p0.y, p1.y, k) + 4 * h * k * (1 - k), lerp(p0.z, p1.z, k));
function slAt(p, rotY = FACE_AUD, pitch = 0) { const S = stadium.sea; S.g.position.copy(p); S.g.rotation.order = 'YXZ'; S.g.rotation.set(pitch, rotY, 0); }
function trWalk(dt, to, spd = 1.6) {
  const T = stadium.trainer, p = T.g.position, dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.06) { T.moving = false; return true; }
  const s = Math.min(d, spd * dt); p.x += dx / d * s; p.z += dz / d * s; T.g.rotation.y = Math.atan2(dx, dz); T.moving = true; return false;
}
function trFace(rot = FACE_AUD, dt = 0.016) { const T = stadium.trainer; let a = rot - T.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); T.g.rotation.y += a * Math.min(1, dt * 6); }
function say(msg, ms = 2600) { caption('🎤 トレーナー', msg, ms); }
function cheer(k = 1.4) { stadium.aud.cheer = Math.max(stadium.aud.cheer, k); SE.applause(1.2 + k, 0.05 + k * 0.02); }
/* ---- ビート（各技）。cue=合図の時刻（秒）。res: 'pf'|'gd'|'ms' ---- */
const BEATS = [
  { name: 'opening', dur: 4.2,
    enter(B) { say('みなさーん、こんにちは！アシカショーのはじまりでーす！', 3800); stadium.trainer.g.position.set(-61, STG.stageTop, -6); cheer(0.8); },
    update(B, bt, dt, t) { trWalk(dt, SP.trainer, 1.7); if (!stadium.trainer.moving) { trFace(FACE_AUD, dt); stadium.trainer.gesture('wave'); }
      const a = 1.2 + bt * 1.1; slAt(V3(-50.8 + Math.cos(a) * 2.6, STG.waterY - 0.45, Math.sin(a) * 10), Math.atan2(-Math.sin(a) * 2.6, Math.cos(a) * 10)); stadium.sea.setPose('swim'); stadium.sea.speed = 3; } },
  { name: 'entry', dur: 5.6, cue: 3.0,
    enter(B) { say('まずは元気よく登場！合図でジャンプ！', 2800); stadium.trainer.gesture('idle'); },
    update(B, bt, dt, t) {
      const S = stadium.sea; trFace(FACE_AUD, dt);
      if (bt < B.cue) { const k = bt / B.cue; slAt(V3(-49.5, STG.waterY - 0.5 + Math.sin(bt * 3) * 0.1, lerp(12, -5, k)), Math.PI); S.setPose('swim'); S.speed = 3.5; if (bt > B.cue - 0.5) stadium.trainer.gesture('signal'); return; }
      const j = bt - B.cue, good = B.res !== 'ms';
      if (j < 1.0) { const k = j / 1.0; const p0 = V3(-49.5, STG.waterY - 0.4, -5), p1 = V3(-54.4, STG.stageTop + 0.05, -1.5); const h = good ? 2.2 : 0.9;
        const p = arc(p0, p1, h, k); const vy = (p1.y - p0.y) + 4 * h * (1 - 2 * k); slAt(p, Math.atan2(p1.x - p0.x, p1.z - p0.z), -Math.atan2(vy, 6.2) * 0.9); S.setPose('jump', 12);
        if (!B.sp1) { B.sp1 = 1; FX.splash(p0.x, STG.waterY, p0.z, good ? 1.2 : 0.6); if (good) { SE.bark(); cheer(1.2); } } }
      else { const k = Math.min(1, (j - 1.0) / 1.2); slAt(V3(lerp(-54.4, -56.6, ease(k)), STG.stageTop, lerp(-1.5, 0.4, k)), lerp(Math.atan2(-2.2, 1.9), FACE_AUD, k)); S.setPose(k < 0.6 ? 'slide' : 'lie', 6); stadium.trainer.gesture('idle');
        if (!B.say2) { B.say2 = 1; say(good ? 'ジャンプで登場！みんなに見せてあげて〜！' : 'ゆっくり登場…でもかわいい！', 2400); } }
    } },
  { name: 'greet', dur: 4.8, cue: 1.6,
    enter(B) { say('ごあいさつ、できるかな？', 2000); },
    update(B, bt, dt, t) { const S = stadium.sea; slAt(V3(-56.6, STG.stageTop, 0.4)); trFace(FACE_AUD, dt);
      if (bt < B.cue) { S.setPose('sit', 4); if (bt > B.cue - 0.45) stadium.trainer.gesture('point'); return; }
      const j = bt - B.cue;
      if (B.res === 'ms') { S.setPose(j < 1.2 ? 'sit' : 'bow', 2); if (!B.s) { B.s = 1; say('ちょっと照れちゃったかな？', 2000); } }
      else { S.setPose(j < 1.1 ? 'bow' : 'wave', 6); stadium.trainer.gesture(j < 1.1 ? 'bow' : 'wave');
        if (!B.s) { B.s = 1; SE.bark(); say('上手にごあいさつできました！', 2200); cheer(1.0); } }
    } },
  { name: 'ball', dur: 8.4, cue: 3.0,
    enter(B) { say('つぎはボールのせ！鼻の上でバランス！', 2800); B.ball = stadium.props.ball; },
    update(B, bt, dt, t) {
      const S = stadium.sea, T = stadium.trainer, P = stadium.props, ball = P.ball;
      slAt(V3(-56.4, STG.stageTop, 0.6 + (bt > B.cue + 1.4 && B.res !== 'ms' ? Math.sin((bt - B.cue - 1.4) * 1.6) * 0.5 : 0)));
      if (bt < 1.6) { trWalk(dt, V3(-56.8, STG.stageTop, -9.6), 2.6); if (bt > 1.2) { ball.position.copy(T.handWorld(1)); } return; }
      if (bt < B.cue) { trWalk(dt, V3(-57.4, STG.stageTop, -2.2), 2.6); if (!T.moving) trFace(Math.atan2(0.6 + 2.2, 1.0), dt); ball.position.copy(T.handWorld(1)); S.setPose('noseUp', 4); if (bt > B.cue - 0.45) T.gesture('throw'); return; }
      const j = bt - B.cue; const nose = new THREE.Vector3(); S.noseTip.getWorldPosition(nose);
      if (!B.from) { B.from = ball.position.clone(); T.gesture('throw'); }
      if (j < 0.65) { ball.position.copy(arc(B.from, V3(nose.x, nose.y + 0.15, nose.z), 1.2, j / 0.65)); return; }
      if (B.res === 'ms') {   // 転がって落ちる
        if (!B.fall) { B.fall = { p: ball.position.clone(), v: V3(rnd(.6, 1.2), 1.6, rnd(-1, 1)) }; say('あらら、ボールが転がっちゃった。どんまい！', 2400); SE.plop(); }
        const F = B.fall; F.v.y -= 9 * dt; F.p.addScaledVector(F.v, dt); if (F.p.y < STG.stageTop + 0.14) { F.p.y = STG.stageTop + 0.14; F.v.y *= -0.4; F.v.x *= 0.9; F.v.z *= 0.9; }
        ball.position.copy(F.p); S.setPose('sit', 3); T.gesture('idle');
        if (j > 3.2) { trWalk(dt, V3(F.p.x - 0.4, STG.stageTop, F.p.z), 2.4); }
        if (j > 4.6) { ball.position.copy(P.ballHome); }
        return;
      }
      /* ピタッとバランス */
      ball.position.set(nose.x + Math.sin(t * 7) * 0.03, nose.y + 0.15, nose.z + Math.cos(t * 5) * 0.03);
      ball.rotation.y += dt * 4;
      if (!B.ok) { B.ok = 1; SE.bark(); say(B.res === 'pf' ? 'ピタッ！パーフェクト！' : 'ピタッ！おみごと！', 2400); cheer(B.res === 'pf' ? 1.6 : 1.1); if (B.res === 'pf') FX.stars(nose.x, nose.y + 0.4, nose.z, 8); }
      T.gesture('clap');
      if (j > 4.4) { ball.position.copy(P.ballHome); }
    } },
  { name: 'hand', dur: 7.6, cue: 3.0,
    enter(B) { say('箱の上で…逆立ち、いきます！', 2800); stadium.trainer.gesture('idle'); },
    update(B, bt, dt, t) {
      const S = stadium.sea, top = STG.stageTop + 0.66, c = SP.crate;
      trWalk(dt, V3(-57.0, STG.stageTop, 2.4), 2); if (!stadium.trainer.moving) trFace(Math.atan2(c.x + 57.0, c.z - 2.4), dt);
      if (bt < 1.5) { const k = ease(bt / 1.5); slAt(V3(lerp(-56.4, c.x + 0.2, k), STG.stageTop + Math.sin(k * Math.PI) * 0.5 + (k > 0.7 ? (k - 0.7) / 0.3 * 0.66 : 0), lerp(0.6, c.z, k)), FACE_AUD); S.setPose(k < 0.5 ? 'lie' : 'sit', 5); return; }
      if (bt < B.cue) { slAt(V3(c.x + 0.2, top, c.z), FACE_AUD); S.setPose('sit', 5); if (bt > B.cue - 0.45) stadium.trainer.gesture('signal'); return; }
      const j = bt - B.cue, good = B.res !== 'ms';
      const up = good ? (j < 0.7 ? ease(j / 0.7) : j < 2.6 ? 1 : Math.max(0, 1 - (j - 2.6) / 0.7)) : (j < 0.6 ? ease(j / 0.6) * 0.45 : Math.max(0, 0.45 - (j - 0.6) * 0.6));
      S.setPose(up > 0.3 ? 'hand' : 'sit', 8);
      const pitch = up * 1.42;
      slAt(V3(c.x + 0.2 - up * 0.15, top, c.z), FACE_AUD, pitch);
      S.g.updateMatrixWorld(true);
      if (up > 0.25) { const low = S.lowestFore(); S.g.position.y += (top - low) * Math.min(1, up * 1.4); }
      if (good && j > 0.7 && !B.ok) { B.ok = 1; say(B.res === 'pf' ? 'ビシッと逆立ち！パーフェクト！' : 'ビシッと逆立ち！拍手〜！', 2400); cheer(B.res === 'pf' ? 1.6 : 1.2); if (B.res === 'pf') FX.stars(c.x, top + 1.6, c.z, 10); stadium.trainer.gesture('clap'); }
      if (!good && !B.ok && j > 0.6) { B.ok = 1; say('おっとっと…惜しい！', 2000); }
    } },
  { name: 'rings', dur: 8.6, cues: [2.2, 3.6, 5.0],
    enter(B) { say('遠くから投げる輪っかを、首でキャッチ！3連続いくよ！', 3000); B.flying = []; B.got = 0; },
    update(B, bt, dt, t) {
      const S = stadium.sea, T = stadium.trainer, P = stadium.props;
      if (bt < 1.4) { const k = ease(bt / 1.4); slAt(V3(lerp(SP.crate.x + 0.2, -55.9, k), STG.stageTop + (1 - k) * 0.66 * (k < 0.3 ? 1 : 0) , lerp(SP.crate.z, 2.4, k)), FACE_AUD); S.setPose('sit', 5); }
      else { slAt(V3(-55.9, STG.stageTop, 2.4), Math.atan2(-2.0, -7.4)); S.setPose('ring', 5); }
      trWalk(dt, V3(-57.6, STG.stageTop, -5.2), 2.2); if (!T.moving) trFace(Math.atan2(-55.9 + 57.6, 2.4 + 5.2), dt);
      B.cues.forEach((c, i) => {
        const r = P.rings[i];
        if (bt >= c - 0.55 && !B['th' + i]) { B['th' + i] = { from: T.handWorld(1), t0: bt }; r.visible = true; T.gesture('throw'); }
        const th = B['th' + i]; if (!th) return;
        const neck = new THREE.Vector3(); S.shoulder.getWorldPosition(neck); neck.y += 0.25;
        const k = (bt - th.t0) / 0.55;
        if (k <= 1) { r.position.copy(arc(th.from, neck, 0.9, k)); r.rotation.set(Math.PI / 2 + k * 6, 0, k * 3); return; }
        const res = B.resList ? B.resList[i] : null;
        if (res && res !== 'ms') { if (!th.on) { th.on = 1; B.got++; SE.good(); say(['ナイス！', 'ナイス！もう一回！', 'すごい、3つ全部！'][Math.min(2, B.got - 1)], 1300); if (B.got === 3) cheer(1.6); else cheer(0.7); }
          r.position.set(neck.x, neck.y - 0.22 - B.got * 0.0 - i * 0.05, neck.z); r.rotation.set(Math.PI / 2 - 0.5, 0, 0); }
        else if (res === 'ms') { if (!th.fall) { th.fall = { p: r.position.clone(), v: V3(rnd(-.5, .5), 1.2, rnd(-1, 1)) }; SE.miss(); }
          const F = th.fall; F.v.y -= 9 * dt; F.p.addScaledVector(F.v, dt); if (F.p.y < STG.stageTop + 0.03) { F.p.y = STG.stageTop + 0.03; F.v.multiplyScalar(0.5); } r.position.copy(F.p); r.rotation.x = Math.PI / 2; }
      });
      if (bt > 7.6) P.rings.forEach(r => r.visible = false);
    } },
  { name: 'hoop', dur: 8.2, cue: 4.4,
    enter(B) { say('つづいて、輪くぐりジャンプ！', 2400); },
    update(B, bt, dt, t) {
      const S = stadium.sea, T = stadium.trainer, P = stadium.props, H = P.hoop;
      const hoopC = V3(-52.9, 1.95, 0.0);
      trWalk(dt, V3(-54.2, STG.stageTop, 0.9), 2.4); if (!T.moving) { trFace(Math.PI / 2, dt); T.gesture('hoop'); }
      H.visible = bt > 0.8; H.position.copy(hoopC); H.rotation.set(0, 0, 0);
      if (bt < 1.2) { const k = bt / 1.2; slAt(arc(V3(-55.9, STG.stageTop, 2.4), V3(-51, STG.waterY - 0.6, 4), 0.6, k), Math.atan2(5, 1.6), k * 0.8); S.setPose('jump', 8); if (k > 0.85 && !B.sp0) { B.sp0 = 1; FX.splash(-51.5, STG.waterY, 3.6, 0.8); } return; }
      if (bt < B.cue) { const k = (bt - 1.2) / (B.cue - 1.2); const a = 0.6 + k * 4.2; slAt(V3(-50.4 + Math.cos(a) * 2.2, STG.waterY - 0.6, -2 + Math.sin(a) * 4.5), Math.atan2(-Math.sin(a) * 2.2, Math.cos(a) * 4.5)); S.setPose('swim'); S.speed = 4; if (bt > B.cue - 0.45) T.gesture('signal'); return; }
      const j = bt - B.cue, good = B.res !== 'ms';
      if (j < 1.1) { const k = j / 1.1; const p0 = V3(-52.9, STG.waterY - 0.3, -4.6), p1 = V3(-52.9, STG.waterY - 0.3, 4.6); const h = good ? 1.75 : 1.25;
        const p = arc(p0, p1, h, k); slAt(p, 0, -Math.atan2(4 * h * (1 - 2 * k), 9.2)); S.setPose('jump', 14);
        if (!B.sp1) { B.sp1 = 1; FX.splash(p0.x, STG.waterY, p0.z, 1.0); }
        if (!good) H.rotation.x = Math.sin(j * 20) * 0.25 * (1 - k);
        T.gesture('hoop'); return; }
      if (!B.sp2) { B.sp2 = 1; FX.splash(-52.9, STG.waterY, 4.6, good ? 1.4 : 0.9); if (good) { say(B.res === 'pf' ? 'スパーン！パーフェクトな輪くぐり！' : 'きれいにくぐりました！', 2400); cheer(B.res === 'pf' ? 1.6 : 1.2); } else say('惜しい、輪っかにタッチ！', 2000); }
      const k = Math.min(1, (j - 1.1) / 1.6); slAt(V3(-52.9 + k * 2, STG.waterY - 0.6, 4.6 - k * 3), Math.PI); S.setPose('swim'); T.gesture(good ? 'clap' : 'idle');
      if (bt > 7.6) H.visible = false;
    } },
  { name: 'hijump', dur: 8.6, cue: 4.6,
    enter(B) { say('さいごは大技、ハイジャンプ！あの高いボールまで届くかな？', 3200); B.ball0 = stadium.props.hiBall.position.clone(); },
    update(B, bt, dt, t) {
      const S = stadium.sea, T = stadium.trainer, P = stadium.props, hb = P.hiBall;
      const target = V3(-50.6, 4.1, 0);
      trWalk(dt, V3(-55.0, STG.stageTop, -3.2), 2.4); if (!T.moving) trFace(Math.atan2(4.4, 3.2), dt);
      P.hoop.visible = false;
      if (bt < 2) hb.position.set(target.x, lerp(B.ball0.y, target.y, ease(bt / 2)), target.z);
      if (bt < B.cue) { const a = bt * 1.9; slAt(V3(-50.6 + Math.cos(a) * 2.4, STG.waterY - 1.0, Math.sin(a) * 6), Math.atan2(-Math.sin(a) * 2.4, Math.cos(a) * 6)); S.setPose('swim'); S.speed = 4.5; if (bt > B.cue - 0.45) T.gesture('signal'); return; }
      const j = bt - B.cue, good = B.res !== 'ms', apex = good ? target.y - 0.9 : target.y - 1.9;
      if (j < 1.5) { const k = j / 1.5; const y = (STG.waterY - 0.6) + 4 * (apex - STG.waterY + 0.6) * k * (1 - k);
        slAt(V3(-50.6, y, 0.3 - k * 0.6), Math.PI / 2, -Math.PI / 2 * (1 - k * 2) * 0.95); S.setPose('jump', 14);
        if (!B.sp1) { B.sp1 = 1; FX.splash(-50.6, STG.waterY, 0.3, 1.1); }
        if (good && k > 0.45 && !B.hit) { B.hit = j; SE.perfect(); FX.stars(target.x, target.y, target.z, 10); }
        if (B.hit) hb.position.set(target.x + Math.sin((j - B.hit) * 6) * 0.5 * Math.exp(-(j - B.hit)), target.y, target.z);
        return; }
      if (!B.sp2) { B.sp2 = 1; FX.splash(-50.6, STG.waterY, -0.3, good ? 1.8 : 1.0); if (good) { say(B.res === 'pf' ? 'とどいたー！！大ジャンプ大成功！' : 'とどいたー！！', 2600); cheer(2.0); } else say('あとちょっと！でもすごいジャンプ！', 2400); }
      if (B.hit) hb.position.set(target.x + Math.sin((j - B.hit) * 6) * 0.5 * Math.exp(-(j - B.hit)), target.y, target.z);
      const k = Math.min(1, (j - 1.5) / 2); slAt(V3(-50.6 + k, STG.waterY - 0.6, -0.3 + k * 3), 0.3); S.setPose('swim');
      if (bt > 7.0) hb.position.y = lerp(hb.position.y, B.ball0.y, dt * 2);
    } },
  { name: 'finale', dur: 8.0,
    enter(B) { say('アシカに大きな拍手をおねがいします！', 3000); },
    update(B, bt, dt, t) {
      const S = stadium.sea, T = stadium.trainer;
      trWalk(dt, V3(-57.2, STG.stageTop, -1.4), 2.2); if (!T.moving) trFace(FACE_AUD, dt);
      if (bt < 1.4) { const k = bt / 1.4; slAt(arc(V3(-51, STG.waterY - 0.5, 1.5), V3(-55.8, STG.stageTop, 0.6), 1.6, k), Math.atan2(-4.8, -0.9), 0); S.setPose('jump', 10); if (!B.sp) { B.sp = 1; FX.splash(-51, STG.waterY, 1.5, 1.1); } return; }
      slAt(V3(-55.8, STG.stageTop, 0.6));
      if (bt < 4.2) { S.setPose('clap', 6); T.gesture('clap'); if (!B.c) { B.c = 1; cheer(2.2); SE.bark(); } }
      else if (bt < 6.4) { S.setPose('wave', 6); T.gesture('wave'); if (!B.w) { B.w = 1; say('ありがとうございましたー！またね〜！', 2600); } }
      else { S.setPose('bow', 5); T.gesture('bow'); }
    } },
];
const CUE_LEAD = 1.2, PF_WIN = 0.15, GD_WIN = 0.32;
function cueList() { const L = []; let acc = 0; BEATS.forEach((B, bi) => { const cs = B.cues || (B.cue != null ? [B.cue] : []); cs.forEach((c, ci) => L.push({ at: acc + c, bi, ci, done: false })); acc += B.dur; }); return L; }
const SHOW_LEN = BEATS.reduce((a, B) => a + B.dur, 0);
function startShow() {
  if (SHOW.on) return;
  SHOW.on = true; SHOW.t = 0; SHOW.i = -1; SHOW.score = 0; SHOW.results = []; SHOW.cues = cueList(); SHOW.ended = 0;
  BEATS.forEach(B => { for (const k of Object.keys(B)) if (!['name', 'dur', 'cue', 'cues', 'enter', 'update'].includes(k)) delete B[k]; });
  stadium.idle = false;
  /* あなたの席へ */
  const s = stadium.seat; player.pos.set(s.x, s.y, s.z); player.vy = 0; player.riding = true; player.seated = true;
  SHOW.prevFp = fpMode; if (!fpMode) toggleView(true);
  camYaw = -Math.PI / 2; camPitch = 0.12;
  MUSIC.start(); SE.whistle(.5);
  $('showHud').hidden = false; drawShowHud();
  toast('🎪 アシカショー開始！黄色い丸に白い輪が重なった瞬間に合図（E / 黄色ボタン / 画面タップ）', 4200);
}
function endShow(aborted = false) {
  SHOW.on = false; MUSIC.stop(); player.riding = false; player.seated = false;
  $('cue').hidden = true; $('cueRes').hidden = true; stadium.idle = true; stadium.idleT = 0;
  stadium.props.hoop.visible = false; stadium.props.rings.forEach(r => r.visible = false);
  stadium.props.ball.position.copy(stadium.props.ballHome);
  if (SHOW.prevFp === false) toggleView(true);
  if (aborted) { $('showHud').hidden = true; toast('ショーをとちゅうでやめました'); return; }
  const n = SHOW.cues.length, pts = Math.round(SHOW.results.reduce((a, r) => a + (r === 'pf' ? 100 : r === 'gd' ? 60 : 0), 0) / n);
  const rank = pts >= 90 ? ['伝説のトレーナー', '★★★'] : pts >= 70 ? ['名トレーナー', '★★☆'] : pts >= 40 ? ['トレーナー見習い', '★☆☆'] : ['また挑戦してね', '☆☆☆'];
  $('showHud').innerHTML = `ショー結果 ${pts}点<small>${rank[1]} ${rank[0]}</small><small>パーフェクト ${SHOW.results.filter(r => r === 'pf').length}／グッド ${SHOW.results.filter(r => r === 'gd').length}／ミス ${SHOW.results.filter(r => r === 'ms').length}</small>`;
  setTimeout(() => { if (!SHOW.on) $('showHud').hidden = true; }, 9000);
  caption('🎪 アシカショー', `${pts}点！${rank[0]} ${rank[1]}`, 5200);
  if (pts >= 60) { getStamp('show'); FX.confetti(player.pos.x, player.pos.y, player.pos.z, 90); SE.fanfare(); }
  try { const best = +(localStorage.getItem('toba3d_showbest') || 0); if (pts > best) { localStorage.setItem('toba3d_showbest', String(pts)); setTimeout(() => toast(`🏅 自己ベスト更新！ ${pts}点`), 2600); } } catch (e) { }
}
function drawShowHud() {
  const done = SHOW.results.length, n = SHOW.cues.length;
  const pts = Math.round(SHOW.results.reduce((a, r) => a + (r === 'pf' ? 100 : r === 'gd' ? 60 : 0), 0) / n);
  $('showHud').innerHTML = `🎪 合図 ${done}/${n}　${pts}点<small>${SHOW.results.map(r => r === 'pf' ? '◎' : r === 'gd' ? '○' : '×').join('')}</small><button type="button" id="showQuit" style="margin-top:4px;background:#0f3b5e;border:1px solid #2f77a8;border-radius:8px;font-size:12px;font-weight:700;padding:2px 10px;cursor:pointer">やめる</button>`;
  $('showQuit').onclick = () => endShow(true);
}
function judge(c, grade) {
  c.done = true; c.res = grade; SHOW.results.push(grade);
  const B = BEATS[c.bi];
  if (B.cues) { B.resList = B.resList || []; B.resList[c.ci] = grade; } else B.res = grade;
  const e = $('cueRes'); e.className = grade; e.textContent = grade === 'pf' ? 'パーフェクト！' : grade === 'gd' ? 'グッド！' : (c.early ? 'はやい！' : 'ミス…'); e.hidden = false;
  clearTimeout(judge.t); judge.t = setTimeout(() => e.hidden = true, 800);
  if (grade === 'pf') SE.perfect(); else if (grade === 'gd') SE.good(); else SE.miss();
  drawShowHud();
}
function showPress() {
  if (!SHOW.on) return false;
  const c = SHOW.cues.find(c => !c.done && SHOW.t >= c.at - CUE_LEAD && SHOW.t <= c.at + GD_WIN + 0.05);
  if (!c) return true;
  const d = Math.abs(SHOW.t - c.at);
  if (d <= PF_WIN) judge(c, 'pf'); else if (d <= GD_WIN) judge(c, 'gd'); else { c.early = true; judge(c, 'ms'); }
  return true;
}
function showUpdate(dt, t) {
  if (!SHOW.on) return;
  SHOW.t += dt;
  /* どのビートか */
  let acc = 0, bi = 0; for (; bi < BEATS.length; bi++) { if (SHOW.t < acc + BEATS[bi].dur) break; acc += BEATS[bi].dur; }
  if (bi >= BEATS.length) { endShow(false); return; }
  const B = BEATS[bi];
  if (bi !== SHOW.i) { SHOW.i = bi; B.enter && B.enter(B); }
  /* 合図のリング */
  const c = SHOW.cues.find(c => !c.done && SHOW.t >= c.at - CUE_LEAD && SHOW.t <= c.at + GD_WIN + 0.05);
  const cueEl = $('cue');
  if (c) {
    const k = (c.at - SHOW.t) / CUE_LEAD;           // 1→0 で合図
    cueEl.hidden = false; cueEl.querySelector('.ring').style.transform = `scale(${(1 + Math.max(-0.3, k) * 1.5).toFixed(3)})`;
    cueEl.querySelector('.ring').style.opacity = k < -0.15 ? '0.4' : '0.95';
  } else cueEl.hidden = true;
  /* 押し忘れ＝ミス */
  for (const q of SHOW.cues) if (!q.done && SHOW.t > q.at + GD_WIN + 0.05) judge(q, 'ms');
  /* 合図より前のビートは「まだ判定なし」= 成功扱いで演技を準備（判定後に分岐） */
  B.update(B, SHOW.t - acc, dt, t);
  const S = stadium.sea; S.update(dt, t); stadium.trainer.update(dt, t);
}
addAction({ x: -41.5, z: 0, f: 0, r: 5.8, label: '🎪 アシカショーを見る（あなたの席へ）', when: () => !SHOW.on && player.pos.x < -36.8 && player.pos.x > -46.5 && Math.abs(player.pos.z) < 15, fn: startShow });
addAction({ x: -45, z: 10, f: 0, r: 4, label: '🎪 アシカショーを見る（あなたの席へ）', when: () => !SHOW.on && player.pos.x < -43.5, fn: startShow });
