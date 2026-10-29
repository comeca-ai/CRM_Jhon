// Teste da demonstração web (dist/web) servida por HTTP comum, sem a extensão.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumPath } from '../../tools/browser.mjs';

const base = process.env.DEMO_URL;
let server, url = base;
if (!url) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.zip': 'application/zip' };
  server = http.createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let f = join('dist/web', p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/`;
}
const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text() + ' ' + (m.location()?.url || '')));
const check = (c, m) => { if (!c) throw new Error(m); console.log('ok  ', m); };

await page.goto(url);
check(await page.locator('a[download]').count() === 1, 'página inicial com link do .zip');
const zip = await page.request.get(new URL('decida-antes-chrome.zip', url).href);
check(zip.ok() && (await zip.body()).length > 100000, '.zip baixável');
await page.screenshot({ path: 'docs/screenshots/12-demo-web-inicio.png', fullPage: false });

await page.goto(new URL('app.html?surface=tab', url).href);
await page.waitForSelector('body[data-ready="1"]');
check(await page.locator('#demo-banner').isVisible(), 'faixa de demonstração visível');
check(await page.locator('#canvas tbody tr').count() === 6, 'empresas de exemplo');
await page.fill('#cmd-input', 'negócios abertos acima de 150 mil');
await page.press('#cmd-input', 'Enter');
await page.waitForFunction(() => document.querySelector('#vtitle').textContent.startsWith('Negócios abertos'));
check(await page.locator('#canvas tbody tr').count() === 4, 'tela gerada com 4 negócios');
await page.click('#btn-capture');
await page.waitForSelector('#capture-note');
check(await page.inputValue('#f-name') === 'Nuvem Crédito', 'captura da página de exemplo preenche o formulário');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.waitForSelector('.sheet', { state: 'detached' });
await page.reload(); await page.waitForSelector('body[data-ready="1"]');
check(await page.locator('#canvas tbody tr', { hasText: 'Nuvem Crédito' }).count() === 1, 'dados persistem após recarregar');
await page.screenshot({ path: 'docs/screenshots/13-demo-web-app.png' });
check(!errors.length, 'sem erros de JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server?.close();
