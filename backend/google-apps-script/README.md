# Google Apps Script Backend

GitHub Pages のフォーム投稿を Google Sheets に保存するための Apps Script です。

## Setup

1. Google Sheets を新規作成する
2. `拡張機能` → `Apps Script` を開く
3. `Code.gs` の内容をこのディレクトリの `Code.gs` で置き換える
4. `デプロイ` → `新しいデプロイ`
5. 種類は `ウェブアプリ`
6. 実行ユーザーは `自分`
7. アクセスできるユーザーは `全員`
8. デプロイ後に発行される Web app URL をコピーする
9. `assets/config.js` の `submissionEndpoint` に貼り付ける

```js
window.AI_WORKSHOP_FORM_CONFIG = {
  submissionEndpoint: "https://script.google.com/macros/s/....../exec",
  submissionMode: "no-cors"
};
```

`submissionEndpoint` が空のままだと、フォームは送信完了になりません。
