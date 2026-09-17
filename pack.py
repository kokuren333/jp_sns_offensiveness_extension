
from pathlib import Path
import zipfile
dist=Path("dist")
if not dist.exists():
    raise SystemExit("Run npm run build first")
out=Path("jp_sns_offensiveness_extension_dist.zip")
with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
    for p in dist.rglob("*"):
        if p.is_file():
            z.write(p,p.relative_to(dist))
print(out.resolve())
