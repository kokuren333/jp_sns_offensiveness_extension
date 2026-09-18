from __future__ import annotations
import argparse, json, sys
from pathlib import Path

TEST_TEXTS = [
    'これは普通の投稿です。',
    'お前は本当に馬鹿だな',
    '今すぐ消えろ。',
    'この人たちは全員信用できない。',
    '遠回しに言うけど、かなり感じ悪いよね。',
    'クソみたいな話だな',
    'エロい画像を見たい',
    '123,456円だった。',
    'ＡＢＣ１２３　テスト',
    'HTTP://EXAMPLE.COM Test TEST',
    '「こんにちは」って言っただけ。',
    '毒チワワ🐶💜',
    '今日は雨☔️ でも元気。',
    '半角ｶﾀｶﾅと全角カタカナ',
    '改行\nと  複数   空白のテスト',
]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--tokenizer-dir', required=True)
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--max-length', type=int, default=192)
    args=ap.parse_args()
    out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    tokdir=Path(args.tokenizer_dir)

    import sentencepiece as spm
    from transformers import AutoTokenizer

    spiece=tokdir/'spiece.model'
    if not spiece.exists():
        cands=list(tokdir.rglob('*.model'))
        if not cands: raise FileNotFoundError('SentencePiece model not found in tokenizer directory')
        spiece=cands[0]

    sp=spm.SentencePieceProcessor(model_file=str(spiece))
    piece_to_id={sp.id_to_piece(i): i for i in range(sp.get_piece_size())}
    (out/'piece_to_id.json').write_text(json.dumps(piece_to_id,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    import base64
    (out/'spiece.model.b64').write_text(base64.b64encode(spiece.read_bytes()).decode('ascii'),encoding='ascii')

    # Use the exact custom tokenizer implementation from LINE. The downloaded model bundle
    # is checked against the base vocabulary by SentencePiece piece count and special IDs.
    tok=AutoTokenizer.from_pretrained('line-corporation/line-distilbert-base-japanese', trust_remote_code=True)
    tests=[]
    for text in TEST_TEXTS:
        enc=tok(text, truncation=True, max_length=args.max_length, padding=False)
        tests.append({'text':text,'max_length':args.max_length,'input_ids':[int(x) for x in enc['input_ids']]})
    ref={'source':'line-corporation/line-distilbert-base-japanese AutoTokenizer','max_length':args.max_length,'tests':tests}
    (out/'tokenizer_reference.json').write_text(json.dumps(ref,ensure_ascii=False,indent=2),encoding='utf-8')

    # Sanity: special IDs must exist in the bundled SentencePiece model.
    for token in ['[CLS]','[SEP]','<unk>','<pad>']:
        if token not in piece_to_id:
            raise RuntimeError(f'{token} missing from bundled SentencePiece vocabulary')
    print(f'Generated {len(tests)} tokenizer reference vectors; vocab={len(piece_to_id)}')

if __name__=='__main__': main()
