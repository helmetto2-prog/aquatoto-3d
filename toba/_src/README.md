# 鳥羽 3D たんけん水族館 — ソース

公開ページ: https://helmetto2-prog.github.io/aquatoto-3d/toba/

鳥羽水族館（三重県鳥羽市）に行った思い出をもとにした個人のファン作品です。鳥羽水族館の公式とは関係ありません。

## 組み立て方

```sh
cd toba/_src
npm install
mkdir -p assets && cp -r ../assets/. assets/   # 素材（GitHub版にある物）
python3 build.py                               # dist/github/ に公開用ができる
```

- `src/` を順番につないで、three.js といっしょに esbuild で1本の `<script>` にまとめ、`00_head.html` に入れる。
- `__PUBLIC__`（GitHub版）では、シアターは手描きのCGアニメ、リクガメは手作りの形を使う。
  Claude のページ版だけ、いただいたシアター動画（theater.mp4）と読みこみのリクガメ（tortoise.gltf）を使う
  （この2つはだれでも見られる所には置かない）。
