from __future__ import annotations
import base64, hashlib, json, os, shutil, subprocess, sys, tarfile, tempfile, urllib.parse, urllib.request, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent
TEMPLATE=ROOT/'extension-template'
READY=ROOT/'Doku-Chiwawa-ready'
ZIPOUT=ROOT/'Doku-Chiwawa-ready.zip'
UA='Doku-Chiwawa-standalone-builder/0.3'


def get(url: str) -> bytes:
    print('GET', url)
    req=urllib.request.Request(url, headers={'User-Agent':UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()

def get_json(url: str): return json.loads(get(url).decode('utf-8'))

def safe_extract_tar_bytes(data: bytes, dest: Path):
    dest=dest.resolve(); dest.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.tgz', delete=False) as f:
        f.write(data); tmp=Path(f.name)
    try:
        with tarfile.open(tmp,'r:*') as tf:
            for m in tf.getmembers():
                target=(dest/m.name).resolve()
                if dest not in target.parents and target!=dest: raise RuntimeError('unsafe tar member')
            tf.extractall(dest)
    finally:
        tmp.unlink(missing_ok=True)

def npm_tarball(pkg: str, version: str) -> bytes:
    key=urllib.parse.quote(pkg, safe='')
    meta=get_json(f'https://registry.npmjs.org/{key}/{version}')
    return get(meta['dist']['tarball'])

def download_hf_file(repo: str, path: str) -> bytes:
    quoted='/'.join(urllib.parse.quote(x) for x in path.split('/'))
    return get(f'https://huggingface.co/{repo}/resolve/main/{quoted}?download=true')

def write_bytes(path: Path, data: bytes):
    path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)

def copy_if(src: Path, dst: Path):
    if src.exists():
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)

def main():
    if not TEMPLATE.exists(): raise SystemExit('extension-template is missing')
    print('\n=== Doku-Chiwawa standalone preparation ===')
    shutil.rmtree(READY,ignore_errors=True)
    shutil.copytree(TEMPLATE,READY)
    work=Path(tempfile.mkdtemp(prefix='doku-chiwawa-'))
    try:
        # 1) MeCab WASM runtime. This package includes its stock data archive; UniDic Lite is mounted separately at runtime.
        print('\n[1/6] MeCab WASM')
        mecab_dir=work/'mecab'
        safe_extract_tar_bytes(npm_tarball('mecab-wasm','1.0.3'),mecab_dir)
        pkg=mecab_dir/'package'
        for name in ['libmecab.js','libmecab.wasm','libmecab.data']:
            src=pkg/'lib'/name
            if not src.exists(): raise FileNotFoundError(src)
            copy_if(src, READY/'vendor/mecab'/name)
        copy_if(pkg/'LICENSE', READY/'licenses/mecab-wasm-LICENSE')

        # 2) SentencePiece WASM browser bundle.
        print('\n[2/6] SentencePiece WASM')
        spjs_dir=work/'spjs'
        safe_extract_tar_bytes(npm_tarball('@sctg/sentencepiece-js','1.3.3'),spjs_dir)
        pkg2=spjs_dir/'package'
        sp_index=pkg2/'dist/index.js'
        if not sp_index.exists(): raise FileNotFoundError(sp_index)
        copy_if(sp_index, READY/'vendor/sentencepiece/index.js')
        copy_if(pkg2/'LICENSE', READY/'licenses/sentencepiece-js-LICENSE')

        # 3) UniDic Lite dictionary.
        print('\n[3/6] UniDic Lite 1.0.8')
        py=get_json('https://pypi.org/pypi/unidic-lite/1.0.8/json')
        sdist=next((x for x in py['urls'] if x.get('packagetype')=='sdist'),None)
        if not sdist: raise RuntimeError('unidic-lite sdist not found')
        ud_dir=work/'unidic'
        safe_extract_tar_bytes(get(sdist['url']),ud_dir)
        roots=list(ud_dir.glob('*/unidic_lite/dicdir'))
        if not roots: raise RuntimeError('unidic_lite/dicdir not found in sdist')
        dicdir=roots[0]
        outdic=READY/'assets/unidic'; outdic.mkdir(parents=True,exist_ok=True)
        files=[]
        for src in sorted(dicdir.rglob('*')):
            if src.is_file():
                rel=src.relative_to(dicdir)
                dst=outdic/rel; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
                files.append({'path':rel.as_posix(),'bytes':src.stat().st_size})
        (outdic/'manifest.json').write_text(json.dumps({'version':'1.0.8','files':files},ensure_ascii=False,indent=2),encoding='utf-8')
        for lic in list(ud_dir.glob('*/LICENSE*'))+list(ud_dir.glob('*/COPYING*')):
            copy_if(lic,READY/'licenses'/('unidic-lite-'+lic.name))
        print(f'UniDic files: {len(files)}, {sum(x["bytes"] for x in files)/2**20:.1f} MiB')

        # 4) Jev7 ONNX model + saved tokenizer folder.
        print('\n[4/6] jp-sns-jev7-estimator')
        repo='kokuren/jp-sns-jev7-estimator'
        info=get_json(f'https://huggingface.co/api/models/{repo}')
        siblings=[x.get('rfilename','') for x in info.get('siblings',[])]
        required=['model_int8.onnx','model_meta.json']
        for path in required:
            if path not in siblings: raise RuntimeError(f'{path} not found in Hugging Face repo')
            write_bytes(READY/'assets'/Path(path).name,download_hf_file(repo,path))
        toks=[p for p in siblings if p.startswith('tokenizer/') and not p.endswith('/')]
        if not toks: raise RuntimeError('tokenizer/ files not found in Hugging Face repo')
        for path in toks:
            write_bytes(READY/'assets/tokenizer'/Path(path).name,download_hf_file(repo,path))
        if 'README.md' in siblings: write_bytes(READY/'licenses/model-card-README.md',download_hf_file(repo,'README.md'))

        # 5) Generate piece->id map and Python reference vectors with exact LINE tokenizer.
        print('\n[5/6] Python tokenizer reference vectors')
        site=work/'pydeps'; site.mkdir()
        cmd=[sys.executable,'-m','pip','install','--disable-pip-version-check','--no-input','--target',str(site),
             'sentencepiece>=0.2.0','fugashi>=1.3.0','unidic-lite==1.0.8','transformers>=4.46,<5']
        subprocess.run(cmd,check=True)
        env=os.environ.copy(); env['PYTHONPATH']=str(site)+os.pathsep+env.get('PYTHONPATH','')
        meta=json.loads((READY/'assets/model_meta.json').read_text(encoding='utf-8'))
        maxlen=int(meta.get('max_length',192))
        subprocess.run([sys.executable,str(ROOT/'generate_reference.py'),'--tokenizer-dir',str(READY/'assets/tokenizer'),
                        '--out-dir',str(READY/'assets/tokenizer'),'--max-length',str(maxlen)],check=True,env=env)

        # 6) Build metadata and final zip.
        print('\n[6/6] Final validation + ZIP')
        must=[
            'manifest.json','offscreen.js','tokenizer.js','vendor/ort-wasm-simd-threaded.wasm',
            'vendor/mecab/libmecab.js','vendor/mecab/libmecab.wasm','vendor/mecab/libmecab.data',
            'vendor/sentencepiece/index.js','assets/model_int8.onnx','assets/model_meta.json',
            'assets/tokenizer/spiece.model.b64','assets/tokenizer/piece_to_id.json','assets/tokenizer/tokenizer_reference.json',
            'assets/unidic/manifest.json'
        ]
        missing=[p for p in must if not (READY/p).exists()]
        if missing: raise RuntimeError('missing final assets: '+', '.join(missing))
        hashes={}
        for rel in must:
            p=READY/rel
            hashes[rel]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        (READY/'assets/build_info.json').write_text(json.dumps({'model':repo,'standalone':True,'critical_assets':hashes},indent=2),encoding='utf-8')
        ZIPOUT.unlink(missing_ok=True)
        with zipfile.ZipFile(ZIPOUT,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
            for p in sorted(READY.rglob('*')):
                if p.is_file(): z.write(p,p.relative_to(READY).as_posix())
        print('\nSUCCESS')
        print('Chrome load folder:',READY)
        print('Shareable ZIP:',ZIPOUT)
        print(f'ZIP size: {ZIPOUT.stat().st_size/2**20:.1f} MiB')
    finally:
        shutil.rmtree(work,ignore_errors=True)

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('\nFAILED:',e,file=sys.stderr)
        raise
