#!/usr/bin/env python3
"""src/ を1枚のHTMLに組み立てる。
  three.js と GLTFLoader もいっしょに esbuild で1本のふつうの<script>にまとめて、ページの中に入れる
  （import map や外部CDNに頼らない＝スマホのアプリ内表示や電波が弱い所でも動きやすい）。

  dist/toba3d.html      : Claude の公開ページ用（外側の html/head/body はClaude側が付ける）
  test.html             : ローカル確認用（↑と同じ中身に最低限の doctype を付けたもの）
  dist/github/          : GitHub Pages 用（ちゃんとした1枚のHTML＋assets）
                          ※ 他の人の作品かもしれない物（シアターの動画）と、出どころを確かめきれていない
                            リクガメのモデルは入れない。代わりに手作りのCGアニメ・手作りのリクガメを使う（__PUBLIC__）
  build/app*.js.map     : エラー位置を調べる用（公開しない）
"""
import os, sys, subprocess, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
ORDER = ['10_core.js', '20_animals_a.js', '21_animals_b.js', '30_sealion.js', '40_world.js', '41_zones.js', '42_stadium.js',
         '50_show.js', '60_events.js', '70_player.js']
STUB = {'20_animals_a.js': 'const ANIM_A = {};\n', '21_animals_b.js': 'const ANIM_B = {};\n'}
PUBLIC_SKIP = {'theater.mp4', 'tortoise.gltf'}          # GitHub（だれでも見られる所）には置かない素材


def bundle():
    parts = []
    for name in ORDER:
        p = os.path.join(ROOT, 'src', name)
        if os.path.exists(p):
            parts.append(f'/* ===== {name} ===== */\n' + open(p, encoding='utf-8').read())
        elif name in STUB:
            parts.append(f'/* ===== {name} (stub) ===== */\n' + STUB[name])
        else:
            print('missing', name, file=sys.stderr)
    return '\n'.join(parts)


def esbuild(js, public):
    bd = os.path.join(ROOT, 'build'); os.makedirs(bd, exist_ok=True)
    entry = os.path.join(bd, '_entry.js'); open(entry, 'w', encoding='utf-8').write(js)
    out = os.path.join(bd, 'app_pub.js' if public else 'app.js')
    cmd = [os.path.join(ROOT, 'node_modules', '.bin', 'esbuild'), entry, '--bundle', '--format=iife', '--target=es2019',
           '--minify', '--legal-comments=none', '--charset=utf8', '--sourcemap=external', '--banner:js="use strict";',
           '--define:__PUBLIC__=' + ('true' if public else 'false'), '--outfile=' + out]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr); sys.exit(1)
    app = open(out, encoding='utf-8').read()
    # インラインの<script>の中で HTML として誤読されないように
    app = app.replace('</script', '<\\/script').replace('<!--', '<\\!--')
    app = '\n'.join(l for l in app.split('\n') if not l.startswith('//# sourceMappingURL='))
    # すぐには動かさず関数にしまう → タイトル画面を先に描いてから組み立てる（ページ側の起動コードが呼ぶ）
    return 'window.__tobaApp=function(){' + app + '\n};'


def build():
    head = open(os.path.join(ROOT, 'src', '00_head.html'), encoding='utf-8').read()
    js = bundle()
    # ---- Claude の公開ページ（＋ローカル確認用） ----
    page = head.replace('/*__APP__*/', esbuild(js, False))
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    open(os.path.join(ROOT, 'dist', 'toba3d.html'), 'w', encoding='utf-8').write(page)
    test = '<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body>\n' + page + '\n</body></html>'
    open(os.path.join(ROOT, 'test.html'), 'w', encoding='utf-8').write(test)
    print('built dist/toba3d.html', len(page.encode('utf-8')), 'bytes;', js.count('\n'), 'src lines')
    # ---- GitHub Pages 用（ちゃんとした html/head/body に分ける） ----
    pub = head.replace('/*__APP__*/', esbuild(js, True))
    cut = pub.index('<canvas id="gl"')
    doc = ('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n' + pub[:cut].strip() + '\n</head>\n<body>\n'
           + pub[cut:].strip() + '\n</body>\n</html>\n')
    gd = os.path.join(ROOT, 'dist', 'github')
    if os.path.isdir(gd): shutil.rmtree(gd)
    os.makedirs(gd)
    open(os.path.join(gd, 'index.html'), 'w', encoding='utf-8').write(doc)
    n = 0
    for dp, dn, fn in os.walk(os.path.join(ROOT, 'assets')):
        for f in fn:
            if f in PUBLIC_SKIP or f.endswith('.glb'): continue
            src = os.path.join(dp, f); rel = os.path.relpath(src, ROOT)
            dst = os.path.join(gd, rel); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(src, dst); n += 1
    print('built dist/github/index.html', len(doc.encode('utf-8')), 'bytes +', n, 'asset files')


if __name__ == '__main__':
    build()
