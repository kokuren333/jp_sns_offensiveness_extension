import createSentencePiece from './vendor/sentencepiece/index.js';

let sp = null;
let pieceToId = null;
let cfg = null;

function normalizeBeforeMecab(text) {
  return String(text ?? '').normalize('NFKC');
}

function spPreprocess(text) {
  let s = String(text ?? '');
  s = s.trim().split(/\s+/u).filter(Boolean).join(' ');
  s = s.replace(/``|''/g, '"');
  return s.toLowerCase();
}

function applyCommaRule(pieces) {
  const out = [];
  for (const piece of pieces) {
    if (piece.length > 1 && piece.endsWith(',') && /[0-9]/.test(piece[piece.length - 2])) {
      let base = piece.slice(0, -1).replaceAll('▁', '');
      let cur = sp.encodeWithOffsets(base).pieces;
      if (!piece.startsWith('▁') && cur.length && cur[0].startsWith('▁')) {
        if (cur[0] === '▁') cur = cur.slice(1);
        else cur[0] = cur[0].slice(1);
      }
      out.push(...cur, ',');
    } else {
      out.push(piece);
    }
  }
  return out;
}

export async function initTokenizer() {
  if (sp && pieceToId && cfg) return;
  const [b64, map, conf] = await Promise.all([
    fetch(chrome.runtime.getURL('assets/tokenizer/spiece.model.b64')).then(r => {
      if (!r.ok) throw new Error('spiece.model.b64 missing; run prepare_standalone');
      return r.text();
    }),
    fetch(chrome.runtime.getURL('assets/tokenizer/piece_to_id.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('assets/tokenizer/tokenizer_config.json')).then(r => r.json())
  ]);
  const mod = await createSentencePiece();
  sp = new mod.SentencePieceProcessor();
  const bin = Uint8Array.from(atob(b64.trim()), c => c.charCodeAt(0));
  const status = sp.loadFromSerializedProto(bin);
  if (status) throw new Error(`SentencePiece初期化失敗: ${status}`);
  pieceToId = map;
  cfg = conf;
}

export async function tokenize(text, maxLength = 192) {
  await initTokenizer();
  const normalized = normalizeBeforeMecab(text);
  const words = [normalized];
  const pieces = applyCommaRule(sp.encodeWithOffsets(spPreprocess(normalized)).pieces);
  const unk = Number(pieceToId['<unk>'] ?? 0);
  const cls = Number(pieceToId['[CLS]']);
  const sep = Number(pieceToId['[SEP]']);
  if (!Number.isFinite(cls) || !Number.isFinite(sep)) throw new Error('CLS/SEP IDs missing from SentencePiece vocabulary');
  const ids = pieces.map(p => Number(pieceToId[p] ?? unk));
  const capped = ids.slice(0, Math.max(0, Number(maxLength) - 2));
  const input_ids = [cls, ...capped, sep];
  return { input_ids, attention_mask: new Array(input_ids.length).fill(1), pieces, words };
}

export async function runTokenizerSelfTest() {
  await initTokenizer();
  const refs = await fetch(chrome.runtime.getURL('assets/tokenizer/tokenizer_reference.json')).then(r => r.json());
  const failures = [];
  for (const test of refs.tests || []) {
    const got = await tokenize(test.text, test.max_length || refs.max_length || 192);
    const exp = test.input_ids || [];
    if (got.input_ids.length !== exp.length || got.input_ids.some((v, i) => v !== exp[i])) {
      let idx = 0;
      while (idx < got.input_ids.length && idx < exp.length && got.input_ids[idx] === exp[idx]) idx++;
      failures.push({ text: test.text, index: idx, expected: exp, got: got.input_ids, words: got.words, pieces: got.pieces });
      if (failures.length >= 3) break;
    }
  }
  return { ok: failures.length === 0, total: (refs.tests || []).length, failures };
}
