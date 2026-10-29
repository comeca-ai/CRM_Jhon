"""Empacota extension/ em um ZIP reprodutível (ordem e datas fixas) e grava o SHA-256.

Antes de empacotar: valida o manifesto, confere que os arquivos citados existem e procura
código dinâmico/remoto com regras sensíveis a maiúsculas (eval, new Function, import de URL,
setTimeout com string). O verificador genérico do construtor marca qualquer "function(" do
bundle do SDK como suspeito; aqui a regra é a exata.
"""
import hashlib, json, re, sys, zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
ext = root / 'extension'
mf = json.loads((ext / 'manifest.json').read_text(encoding='utf-8'))
errors = []
refs = [mf['background']['service_worker'], mf['side_panel']['default_path'], *mf['icons'].values(), *mf['action']['default_icon'].values()]
for r in refs:
    if not (ext / r.split('?')[0]).is_file(): errors.append(f'arquivo citado não existe: {r}')
patterns = [
    re.compile(r'(?<![\w.$])eval\s*\('),
    re.compile(r'(?<![\w.$])(?:new\s+)?Function\s*\('),
    re.compile(r'\b(?:import|importScripts)\s*\(\s*["\'`](?:https?:)?//'),
    re.compile(r'\b(?:import|export)\s+(?:[^;]*?\bfrom\s*)?["\'](?:https?:)?//'),
    re.compile(r'\b(?:setTimeout|setInterval)\s*\(\s*["\'`]'),
]
files = sorted(p for p in ext.rglob('*') if p.is_file() and not p.name.startswith('.'))
for p in files:
    if p.suffix in {'.js', '.mjs', '.html'}:
        src = p.read_text(encoding='utf-8')
        for pat in patterns:
            if pat.search(src): errors.append(f'código dinâmico/remoto em {p.relative_to(ext)}: {pat.pattern}')
if errors:
    print('\n'.join(errors)); sys.exit(1)

out = root / 'dist' / f"decida-antes-chrome-{mf['version']}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in files:
        info = zipfile.ZipInfo(str(p.relative_to(ext)).replace('\\', '/'), date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, p.read_bytes())
digest = hashlib.sha256(out.read_bytes()).hexdigest()
(out.with_suffix('.zip.sha256')).write_text(f'{digest}  {out.name}\n')
print(f'{out.relative_to(root)}  {out.stat().st_size} bytes  {len(files)} arquivos\nsha256 {digest}')
