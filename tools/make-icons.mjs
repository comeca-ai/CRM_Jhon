// Gera os ícones PNG da extensão a partir de um SVG, renderizado no Chromium.
import { chromium } from 'playwright-core';
import { chromiumPath } from './browser.mjs';
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128">
<rect x="4" y="4" width="120" height="120" rx="28" fill="#2e5ce6"/>
<rect x="26" y="34" width="34" height="60" rx="8" fill="#fff" opacity=".95"/>
<rect x="68" y="34" width="34" height="38" rx="8" fill="#fff" opacity=".7"/>
<path d="M85 80 l5 10 10 5 -10 5 -5 10 -5 -10 -10 -5 10 -5z" fill="#ffd166"/></svg>`;
const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage();
for (const s of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(s)}</body></html>`);
  await page.screenshot({ path: `extension/icons/icon${s}.png`, omitBackground: true });
}
await browser.close();
console.log('ícones gerados');
