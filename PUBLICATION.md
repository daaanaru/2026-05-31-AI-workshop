# Publication Rules

このリポジトリは公開用です。プライベートな作業情報や参加者情報は含めません。

## Repository Boundary

- Public repository: `https://github.com/daaanaru/2026-05-31-AI-workshop`
- Public site: `https://daaanaru.github.io/2026-05-31-AI-workshop/`
- Private/internal materials must stay outside this repository history.

## Source Import Rule

ローカルの受け取り素材から反映する場合、このフォームでは以下を正とします。

- HTML source: `inbox/AI-workshop-form (2)/AI勉強会 事前フォーム.html`
- JavaScript source: `inbox/AI-workshop-form (2)/assets/app.js`
- CSS source: `inbox/AI-workshop-form (2)/assets/styles.css`

`uploads/index.html` や `uploads/README.md` は公開用の正本として扱いません。

## Public Files Only

コミット対象は原則として以下に限定します。

- `index.html`
- `assets/config.js`
- `assets/app.js`
- `assets/styles.css`
- `backend/google-apps-script/Code.gs`
- `backend/google-apps-script/README.md`
- `README.md`
- `PUBLICATION.md`
- `.gitignore`
- `scripts/prepublish-check.sh`

以下は公開リポジトリにコミットしません。

- `inbox/`
- フォーム回答
- 参加者名や個人情報
- 内部メモ
- APIキー、トークン、秘密情報
- 生成元の下書きファイル
- `.napkin` files

## Required Check

公開前に必ず実行します。

```sh
./scripts/prepublish-check.sh
```

GitHub Pages 反映後は、配信HTMLも確認します。

```sh
curl -fsSL https://daaanaru.github.io/2026-05-31-AI-workshop/ | rg 'placeholder="なまえ"|例:'
```

## Submission Backend

フォーム回答は `assets/config.js` の `submissionEndpoint` に送信する。

- Google Sheets保存の場合は `backend/google-apps-script/Code.gs` をApps Scriptに貼り付けてWebアプリとしてデプロイする
- 発行されたWeb app URLを `assets/config.js` に設定する
- `submissionEndpoint` が空の状態では送信完了にしない
