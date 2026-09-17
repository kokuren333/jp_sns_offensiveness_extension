# JP SNS Offensiveness Estimator

日本語 SNS 投稿の攻撃性を、ブラウザ内で推定する Chrome 拡張機能です。投稿本文を外部の推論 API へ送信せず、ONNX Runtime Web によるローカル推論を行います。

## 主な仕様

- Manifest V3、CPU 向け INT8 ONNX モデル
- 入力中の投稿前チェック（350ms デバウンス）とクリップボードへのコピー
- 通常の Web ページで選択した文字列の評価
- X / Twitter のポストホバー評価（ホバーのみ X 限定）
- `NOT` / `REVIEW` / `OFFENSIVE` の3段階表示
- モデル、Tokenizer、評価設定は初回利用時に Hugging Face から取得し、Cache Storage に保存

## 使用モデル

モデルカード: https://huggingface.co/kokuren/jp-sns-offensiveness-estimator

推定結果は必ずしも倫理的・法的・社会的な判断を下すものではありません。特定の人物、思想、属性、投稿者全体を断定するものでもありません。皮肉、自虐、引用、文脈、スラングなどにより誤判定する可能性があるため、人間による確認を前提としてください。

## セットアップ

```bash
npm install
npm run build
```

`chrome://extensions` で Developer mode を有効にし、「Load unpacked」から生成された `dist/` を選択します。配布用 ZIP は `npm run pack` で作成できます。

### Chrome への取り込み

1. `npm install` を実行します。
2. `npm run build` を実行します。
3. Chrome で `chrome://extensions` を開きます。
4. 右上の **Developer mode** を有効にします。
5. **Load unpacked** をクリックし、このプロジェクト内の `dist/` フォルダを選択します。
6. ツールバーの拡張機能メニューから本拡張機能をピン留めすると、すぐに開けます。

コードを変更した場合は、`npm run build` の後に拡張機能ページの再読み込みボタンを押してください。Content Script の変更を反映するには、対象のWebページも再読み込みします。

公式ガイド:

- [Chrome: Hello World extension / Load unpacked](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
- [Chrome: 拡張機能のテストと Load unpacked](https://support.google.com/chrome/a/answer/2714278)

初回利用時は、28MB のモデル本体だけでなく Tokenizer の取得、ONNX Runtime WASM の初期化、モデル展開も行われます。

## プライバシーと制限

評価対象の文章はローカルで処理し、推論 API へ送信しません。Hugging Face への通信はモデル関連ファイルの取得に限られます。

ページへのアクセス権限を使用しますが、`chrome://`、Chrome ウェブストア、PDF ビューアなど Chrome が注入を禁止するページでは利用できません。

### Microsoft Edge など Chromium 系ブラウザ

Edge では `edge://extensions` を開き、**Developer mode** を有効にして **Load unpacked** から同じ `dist/` フォルダを選択します。インストール後、対象ページを再読み込みしてください。

- [Microsoft Edge: Sideload an extension to install and test it locally](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

## ライセンス

この拡張機能のソースコードは [MIT License](LICENSE) で公開します。依存ライブラリと Hugging Face 上のモデルには別のライセンスや利用条件が適用されます。モデルを再配布する場合は、モデルカードの条件を確認してください。
