import LoadMecab from './libmecab.js';

let libPromise = null;
let lib = null;
let instance = 0;

function locateFile(name) {
  return new URL(name, import.meta.url).toString();
}

async function mountUnidic(module) {
  const manifestUrl = chrome.runtime.getURL('assets/unidic/manifest.json');
  const manifest = await (await fetch(manifestUrl)).json();
  if (!Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('UniDic Lite manifest is empty. Run prepare_standalone first.');
  }
  try { module.FS_createPath('/', 'unidic', true, true); } catch (_) {}
  let done = 0;
  for (const entry of manifest.files) {
    const rel = typeof entry === 'string' ? entry : entry.path;
    const parts = rel.split('/').filter(Boolean);
    const name = parts.pop();
    let parent = '/unidic';
    for (const part of parts) {
      try { module.FS_createPath(parent, part, true, true); } catch (_) {}
      parent += '/' + part;
    }
    const url = chrome.runtime.getURL('assets/unidic/' + rel);
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    module.FS_createDataFile(parent, name, bytes, true, false, false);
    done++;
    globalThis.__DOKU_MECAB_PROGRESS__ = done / manifest.files.length;
  }
}

async function ensure() {
  if (instance && lib) return;
  if (!libPromise) {
    libPromise = (async () => {
      const m = await LoadMecab({ locateFile });
      await mountUnidic(m);
      const args = '-r /unidic/mecabrc -d /unidic';
      const tagger = m.ccall('mecab_new2', 'number', ['string'], [args]);
      if (!tagger) throw new Error('MeCab failed to initialize with UniDic Lite');
      lib = m;
      instance = tagger;
      return m;
    })();
  }
  await libPromise;
}

export async function mecabSurfaces(text) {
  await ensure();
  const input = String(text ?? '');
  if (!input) return [];
  let outLength = Math.max(65536, lib.lengthBytesUTF8(input) * 2048);
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = lib._malloc(outLength);
    try {
      const retPtr = lib.ccall(
        'mecab_sparse_tostr3', 'number',
        ['number', 'string', 'number', 'number', 'number'],
        [instance, input, lib.lengthBytesUTF8(input) + 1, out, outLength]
      );
      if (retPtr) {
        const raw = lib.UTF8ToString(retPtr);
        const words = [];
        for (const line of raw.split('\n')) {
          if (!line || line === 'EOS') continue;
          const tab = line.indexOf('\t');
          if (tab > 0) words.push(line.slice(0, tab));
        }
        return words;
      }
    } finally {
      lib._free(out);
    }
    outLength *= 2;
  }
  throw new Error('MeCab output buffer overflow');
}

export async function mecabReady() { await ensure(); return true; }
