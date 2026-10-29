// Monta dist/web: a interface da extensão + camada que imita as APIs do Chrome, para a demonstração web.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
const out = 'dist/web';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('extension/src', out, { recursive: true, filter: (p) => !p.endsWith('sw.js') });
cpSync('extension/icons', `${out}/icons`, { recursive: true });
cpSync('extension/fonts', `${out}/fonts`, { recursive: true }); // app.css usa ../fonts, que na raiz da demo resolve para /fonts
for (const f of ['chrome-shim.js', 'demo-banner.css', 'index.html']) cpSync(`web/${f}`, `${out}/${f}`);
let html = readFileSync(`${out}/app.html`, 'utf8');
html = html.replace('<link rel="stylesheet" href="app.css">',
  '<link rel="stylesheet" href="app.css">\n<link rel="stylesheet" href="demo-banner.css">\n<link rel="icon" href="icons/icon32.png">\n<script src="chrome-shim.js"></script>');
html = html.replace('<a class="skip"', '<div id="demo-banner" role="note">Demonstração web: dados só neste navegador; a captura usa uma página de exemplo. <a href="index.html">Instalar a extensão</a></div>\n<a class="skip"');
writeFileSync(`${out}/app.html`, html);
const { version } = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
const zip = `dist/decida-antes-chrome-${version}.zip`;
if (existsSync(zip)) cpSync(zip, `${out}/decida-antes-chrome.zip`);
else console.warn('aviso: rode npm run package antes para incluir o .zip');
console.log('demo web em', out);
