# AI Workshop Pre-Event Form

2026年5月31日開催のAI勉強会に向けた、参加者向け事前入力フォームの公開用リポジトリです。

## Public Site

https://daaanaru.github.io/2026-05-31-AI-workshop/

## Repository Role

このリポジトリは GitHub Pages で公開する静的ファイル専用です。

- 公開してよいフォーム画面のみを管理する
- 参加者名、申込内容、内部メモ、運営用メモは置かない
- 作業用・内部管理用の情報はプライベートリポジトリで扱う

## Files

- `index.html`: 公開フォーム
- `assets/app.js`: フォームの動作
- `assets/styles.css`: フォームの見た目
- `PUBLICATION.md`: 公開作業ルール
- `scripts/prepublish-check.sh`: 公開前チェック

## Publish Check

公開前に以下を実行します。

```sh
./scripts/prepublish-check.sh
```
