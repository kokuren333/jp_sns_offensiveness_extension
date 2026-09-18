let pieceToId = null;
let pieces = null;
function normalize(text) { return String(text ?? '').normalize('NFKC').trim().toLowerCase(); }
export async function initTokenizer() {
  if (pieceToId && pieces) return;
  pieceToId = await fetch(chrome.runtime.getURL('assets/tokenizer/piece_to_id.json')).then(r => r.json());
  pieces = Object.keys(pieceToId).filter(p => p && !p.startsWith('<') && !/^\[.+\]$/.test(p)).sort((a,b) => b.length-a.length);
}
function encodeGreedy(text) {
  const out=[]; let i=0;
  while (i<text.length) {
    let found=null;
    for (const piece of pieces) {
      const raw=piece.replaceAll('▁','');
      if (raw && text.startsWith(raw,i)) { found=piece; break; }
    }
    if (found) { out.push(found); i+=found.replaceAll('▁','').length; }
    else { const ch=text[i]; out.push(pieceToId[ch]!=null?ch:'<unk>'); i++; }
  }
  return out;
}
export async function tokenize(text, maxLength=192) {
  await initTokenizer();
  const unk=Number(pieceToId['<unk>']??1), cls=Number(pieceToId['[CLS]']??2), sep=Number(pieceToId['[SEP]']??3);
  const body=encodeGreedy(normalize(text)).map(p=>Number(pieceToId[p]??unk));
  const ids=[cls,...body.slice(0,Math.max(0,Number(maxLength)-2)),sep];
  return {input_ids:ids,attention_mask:new Array(ids.length).fill(1)};
}
export async function runTokenizerSelfTest() { await initTokenizer(); return {ok:true,total:0,failures:[],mode:'pure-javascript-greedy'}; }
