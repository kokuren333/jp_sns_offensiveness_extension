# Doku-Chiwawa standalone版

## Chromeへ読み込むディレクトリ

`standalone-builder/Doku-Chiwawa-ready/` を `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」から選択してください。

## Git管理対象外

以下は実行時に生成される配布用ファイルのため、Gitには含めません。

- `standalone-builder/Doku-Chiwawa-ready/`
- `standalone-builder/Doku-Chiwawa-ready.zip`
- `standalone-builder/extension-template/offscreen.js`
- `node_modules/`

`offscreen.js` は第三者ライブラリをバンドルした生成物で、GitHubのSecret Scanning対象になるため、リポジトリには入れません。配布用ZIPには含まれています。

## 再生成

`standalone-builder/prepare_standalone.cmd` を実行すると、Standalone版の完成フォルダとZIPが生成されます。
