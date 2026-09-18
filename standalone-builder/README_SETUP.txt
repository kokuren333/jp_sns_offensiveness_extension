Doku-Chiwawa standalone builder v0.3
===================================

目的
----
最終的な Doku-Chiwawa-ready は、推論時に外部API/Hugging Faceへ通信せず、
MeCab WASM + UniDic Lite + SentencePiece WASM + INT8 ONNX をすべてローカル実行します。

準備（1回だけ）
----------------
1. このZIPを展開する。
2. prepare_standalone.cmd をダブルクリックする。
   - Python 3 が必要です。
   - 初回準備中だけインターネット接続を使います。
   - npm install は不要です。
3. 完了すると以下が生成されます。
   - Doku-Chiwawa-ready\       Chromeへ読み込む完成フォルダ
   - Doku-Chiwawa-ready.zip    配布・提出用ZIP
4. Chromeで chrome://extensions を開き、デベロッパーモードをON。
5. 「パッケージ化されていない拡張機能を読み込む」で Doku-Chiwawa-ready を選ぶ。
6. 拡張の「ローカルモデルを準備」を押す。
   初回メモリ読込時にPython版Tokenizerの正解ベクトルと完全一致テストを行います。

設計
----
入力
 -> Unicode NFKC
 -> MeCab WASM（辞書: UniDic Lite 1.0.8）
 -> surface列
 -> lowercase / LINE tokenizer相当の前処理
 -> SentencePiece WASM（モデル同梱）
 -> piece-to-id
 -> [CLS] ... [SEP]
 -> ONNX Runtime Web
 -> 7軸出力
 -> targetednessを除いた6軸をUI表示

分類閾値は現在0.5:
- 攻撃4軸: insult / threat / identity_attack / indirect_hostility
- コンテンツ2軸: obscene / sexual_explicit
- 攻撃のみ: 毒チワワ
- コンテンツのみ: エロチワワ
- 両方: 毒エロチワワ
- どちらでもない: ただのチワワ

注意
----
既存の mecab-wasm npm配布物はIPADICデータをプリロードしています。
本拡張はそれにUniDic Liteを追加マウントし、-d でUniDic Liteを明示選択します。
そのため完成版サイズとメモリ使用量は大きめです。
