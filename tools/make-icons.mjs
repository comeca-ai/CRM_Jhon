// Gera os ícones PNG da extensão a partir de um SVG, renderizado no Chromium.
import { chromium } from 'playwright-core';
import { chromiumPath } from './browser.mjs';
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128">
<rect x="4" y="4" width="120" height="120" rx="28" fill="#123638"/>
<g transform="rotate(-8 64 64)"><rect x="30" y="30" width="68" height="68" rx="20" ry="20" fill="none" stroke="#baf36d" stroke-width="9"/>
<g transform="rotate(8 64 64)" stroke="#baf36d" stroke-width="8" stroke-linecap="round"><line x1="47" y1="50" x2="81" y2="50"/><line x1="47" y1="64" x2="71" y2="64"/><line x1="47" y1="78" x2="81" y2="78"/></g></g></svg>`;
const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage();
for (const s of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(s)}</body></html>`);
  await page.screenshot({ path: `extension/icons/icon${s}.png`, omitBackground: true });
}
await browser.close();
console.log('ícones gerados');
