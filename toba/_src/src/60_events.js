/* =========================================================
   イベント：セイウチふれあい・ペンギン散歩（クイズ）・ラッコのイカミミジャンプ・セレナのお食事・クラゲの部屋の音楽
   ========================================================= */
/* ---------- セイウチふれあいタイム ---------- */
{
  const W = WALRUS.c, ORDER = ['kiss', 'whistle', 'situp', 'flap', 'bow'];
  const label = { kiss: '💋 投げキッス', whistle: '🎵 口笛', situp: '💪 腹筋', flap: '👏 ヒレで拍手', bow: '🙇 おじぎ' };
  const mouth = () => { const v = new THREE.Vector3(); W.g.getWorldPosition(v); return v.add(new THREE.Vector3(-1.3, 1.0, 0)); };
  W.onEvent = (name) => {
    const m = mouth();
    if (name === 'kiss') { SE.kiss(); FX.hearts(m.x, m.y + 0.3, m.z, 4); if (!stampGot.walrus) getStamp('walrus'); }
    else if (name === 'whistle') SE.walrusWhistle();
    else if (name === 'situp') SE.walrusRoar();
    else if (name === 'flap') blip(180, .08, 'triangle', .07, -40);
    else if (name === 'bow') SE.happy();
  };
  addAction({ x: 64.6, z: 10, f: 1, r: 3.2, label: '🦭 セイウチに合図する（ふれあいタイム）', when: () => !W.busy, fn: () => {
    const a = ORDER[WALRUS.n++ % ORDER.length];
    const ok = W.setAction ? W.setAction(a) : false;
    caption('🎤 飼育員さん', `${label[a]}！${a === 'kiss' ? 'チュッ♡' : a === 'situp' ? 'いち、に、さん！' : a === 'whistle' ? 'ピューッ♪' : a === 'flap' ? 'パチパチ！' : 'ありがとう〜'}`, 2400);
    if (!ok && !W.setAction) W.onEvent && W.onEvent(a);
  } });
}

/* ---------- ペンギン散歩（とちゅうでクイズ） ---------- */
const QUIZ = [
  { q: 'ケープペンギンのふるさとは、どこの海辺？', o: ['南アフリカ', '南極', '北極'], a: 0, x: 'アフリカ大陸の南の海辺にすむペンギンだよ' },
  { q: '目の上のピンクの所は、なんのため？', o: ['体の熱をにがすため', '仲間に光って見せるため', '毒があるしるし'], a: 0, x: '暑い日は血が集まって、ピンクが濃くなるんだって' },
  { q: '胸の黒い点もようは？', o: ['1羽ずつちがう', 'みんな同じ', '大人になると消える'], a: 0, x: '指紋みたいに、1羽ずつもようがちがうよ' },
  { q: '北極にペンギンはいる？', o: ['いない', 'いる', '夏だけいる'], a: 0, x: '野生のペンギンは、ほとんど南半球だけにすんでいるよ' },
];
{
  const PATH = [[65.3, -10.5], [65.3, -7.6], [63.0, -5.6], [63.0, 9.5], [64.0, 11.2], [65.0, 9.5], [65.0, -5.0], [65.3, -7.6], [65.3, -10.5]].map(([x, z]) => new THREE.Vector2(x, z));
  const segL = []; let total = 0; for (let i = 1; i < PATH.length; i++) { const l = PATH[i].distanceTo(PATH[i - 1]); segL.push(l); total += l; }
  const at = (s) => { s = clamp(s, 0, total); for (let i = 0; i < segL.length; i++) { if (s <= segL[i]) { const k = s / segL[i]; const a = PATH[i], b = PATH[i + 1]; return { x: lerp(a.x, b.x, k), z: lerp(a.y, b.y, k), yaw: Math.atan2(b.x - a.x, b.y - a.y) }; } s -= segL[i]; } const L = PATH[PATH.length - 1]; return { x: L.x, z: L.y, yaw: Math.PI }; };
  const SPD = 0.7, GAP = 1.05;
  function startWalk() {
    if (PENG.walk) return;
    const members = PENG.list.slice(0, 7);
    members.forEach((P, i) => { P.home = false; P.delay = 1.6 + i * GAP / SPD; });
    PENG.walk = { t: 0, members, near: 0, quizDone: false };
    caption('🎤 飼育員さん', 'ペンギン散歩のはじまりでーす！みんな道をあけてね〜', 3200); SE.squawk();
  }
  function endWalk() {
    const W = PENG.walk; W.members.forEach(P => { P.home = true; P.c.moving = false; P.c.g.position.set(rnd(66, 70), 0, rnd(-14, -10)); });
    if (W.near > 6 && !stampGot.penguin) getStamp('penguin');
    caption('🎤 飼育員さん', 'おさんぽ、おしまい！また遊びに来てね', 2600);
    PENG.walk = null;
  }
  addAction({ x: 62, z: -7.6, f: 1, r: 3.4, label: '🐧 ペンギン散歩をはじめる', when: () => !PENG.walk, fn: startWalk });
  addAction({ x: 65.3, z: -7.0, f: 1, r: 2.2, label: '🐧 ペンギン散歩をはじめる', when: () => !PENG.walk, fn: startWalk });
  onUpdate((dt, t) => {
    const W = PENG.walk; if (!W) return;
    W.t += dt;
    /* 飼育員さんが先頭 */
    const k = at(W.t * SPD + 1.2); const K = PENG.keeper;
    K.g.position.set(k.x, 0, k.z); K.g.rotation.y = k.yaw; K.moving = W.t * SPD + 1.2 < total; if (!K.moving) K.gesture('wave');
    let allDone = true;
    W.members.forEach((P, i) => {
      const s = (W.t - P.delay) * SPD;
      if (s < 0) { allDone = false; P.c.moving = false; return; }
      if (s < total) allDone = false;
      const p = at(s); P.c.g.position.set(p.x + Math.sin(t * 9 + i) * 0.03, 0, p.z); P.c.g.rotation.y = p.yaw; P.c.moving = s < total; P.c.speed = SPD;
      if (Math.random() < dt * 0.15) SE.squawk();
    });
    if (Math.hypot(player.pos.x - K.g.position.x, player.pos.z - K.g.position.z) < 12 && player.pos.y < 2) W.near += dt;
    if (!W.quizDone && W.t > 16 && W.near > 3) { W.quizDone = true; openQuiz(QUIZ[(Math.random() * QUIZ.length) | 0]); }
    if (allDone) endWalk();
  }, 64, 2, 0, 0);
}
function openQuiz(Q) {
  const el = $('quiz'); el.hidden = false;
  el.querySelector('.q').textContent = '🐧 ペンギンクイズ！ ' + Q.q;
  const box_ = el.querySelector('.opts'); box_.innerHTML = '';
  Q.o.forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = ['①', '②', '③'][i] + ' ' + o;
    b.onclick = () => {
      [...box_.children].forEach((c, j) => { c.disabled = true; if (j === Q.a) c.classList.add('ok'); });
      if (i === Q.a) { SE.happy(); caption('🎤 飼育員さん', '正解！' + Q.x, 3600); }
      else { b.classList.add('ng'); SE.miss(); caption('🎤 飼育員さん', `ざんねん！正解は「${Q.o[Q.a]}」。${Q.x}`, 4200); }
      setTimeout(() => el.hidden = true, 1800);
    };
    box_.appendChild(b);
  });
  SE.chime();
  setTimeout(() => { el.hidden = true; }, 20000);
}

/* ---------- ラッコのイカミミジャンプ ---------- */
{
  const T = OTTERS.T; let busy = 0;
  const makeSquid = () => { try { if (typeof ANIM.squid === 'function') { const s = ANIM.squid(); return s.g || s; } } catch (e) { } const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 8), new THREE.MeshLambertMaterial({ color: 0xf2e8e0 })); b.rotation.x = Math.PI; g.add(b); return g; };
  addAction({ x: 41, z: -22.6, f: 2, r: 3.4, label: '🦑 イカをガラスにペタッ（イカミミジャンプ）', when: () => busy <= 0, fn: () => {
    const sx = clamp(player.pos.x, T.B.x0 + 0.8, T.B.x1 - 0.8), sy = OTTERS.surfY + 0.75, sz = BZ0 - 0.32;
    const sq = makeSquid(); sq.position.set(sx, sy, sz); sq.rotation.z = 0.2; scene.add(sq);
    let best = null, bd = 1e9; for (const o of OTTERS.list) { const d = Math.abs(o.x - sx); if (d < bd) { bd = d; best = o; } }
    const o = best; o.state = 'jump'; o.jumpT = 0; o.sq = sq; o.sx = sx; o.sz = sz - 0.4; o.x0 = o.x; o.z0 = o.z;
    busy = 5.5; caption('🎤 飼育員さん', `イカをガラスにペタッ！${o.name}、とれるかな？`, 2600); SE.btn();
  } });
  onUpdate((dt, t) => {
    busy -= dt;
    for (const o of OTTERS.list) {
      if (o.state !== 'jump') continue;
      o.jumpT += dt; const c = o.c, j = o.jumpT, S = OTTERS.surfY;
      if (j < 1.3) { const k = ease(j / 1.3); c.setMode && c.setMode('dive'); c.g.position.set(lerp(o.x0, o.sx, k), S - Math.sin(k * Math.PI) * 1.1 - k * 0.4, lerp(o.z0, o.sz - 0.6, k)); c.g.rotation.set(0.6, Math.atan2(o.sx - o.x0, o.sz - o.z0), 0); }
      else if (j < 1.8) { const k = (j - 1.3) / 0.5; c.setMode && c.setMode('swim'); c.g.position.set(o.sx, lerp(S - 0.4, S + 0.62, ease(k)), lerp(o.sz - 0.6, o.sz, k)); c.g.rotation.set(-1.25, Math.PI, 0);
        if (k > 0.5 && !o.splashed) { o.splashed = 1; FX.splash(o.sx, S, o.sz, 0.6); } }
      else if (j < 2.4) { if (!o.got) { o.got = 1; scene.remove(o.sq); SE.good(); FX.stars(o.sx, S + 0.8, o.sz, 6); caption('🎤 飼育員さん', 'とれたー！イカミミジャンプ成功！', 2400); if (!stampGot.otter) getStamp('otter'); }
        const k = (j - 1.8) / 0.6; c.g.position.set(o.sx, lerp(S + 0.62, S - 0.1, k), o.sz - k * 0.6); c.g.rotation.set(-1.25 + k * 1.25, Math.PI, 0); if (k > 0.8 && !o.sp2) { o.sp2 = 1; FX.splash(o.sx, S, o.sz - 0.5, 0.8); } }
      else { o.state = 'float'; o.x = o.sx; o.z = o.sz - 0.8; o.t = 2; o.got = o.splashed = o.sp2 = 0; c.setMode && c.setMode('back'); c.setAction && c.setAction('crack'); }
    }
  }, T.cx, T.cz, 2, 0);
}

/* ---------- セレナの青いカゴにレタスを入れる（写真のとおり、カゴからもぐもぐ。動きは41_zonesのセレナ側） ---------- */
addAction({ x: 24, z: -22.6, f: 2, r: 4.2, label: '🥬 セレナのカゴにレタスを入れる', when: () => !!DUGONG.st && !DUGONG.st.feed, fn: () => {
  DUGONG.giveLettuce();
  caption('🎤 飼育員さん', 'セレナのごはんは海草とロメインレタス。1日に約30kgも食べるよ！', 3200); SE.plop();
} });

/* ---------- クラゲの部屋＝前作の「月夜」（Suno）を流す ---------- */
let bgm = null;
function bgmInit() { if (bgm) return; try { bgm = new Audio(ASSET.base + 'bgm_tsukiyo.mp3'); bgm.loop = true; bgm.volume = 0; bgm.play().catch(() => { }); } catch (e) { bgm = null; } }
onUpdate((dt) => {
  if (!bgm) return;
  const inJ = player.pos.y > 5 && player.pos.x > 14 && player.pos.x < 34 && player.pos.z > 0 && player.pos.z < 24;
  const tgt = (inJ && sndOn) ? 0.45 : 0;
  bgm.volume = clamp(bgm.volume + (tgt - bgm.volume) * Math.min(1, dt * 1.2), 0, 1);
  if (inJ && !JELLY.inside) { JELLY.inside = true; toast('🎵 BGM「月夜」（アクア・トト版から）'); }
  if (!inJ) JELLY.inside = false;
}, 0, 0, 0, 0);
