// Abre o Chromium com a extensão carregada (perfil temporário) e devolve contexto + id da extensão.
import { chromium } from 'playwright-core';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromiumPath } from './browser.mjs';

// extraHosts: origens concedidas só na cópia de teste do manifesto (evita o diálogo de permissão, que não pode ser clicado em automação).
export async function launchWithExtension({ extensionDir = 'extension', extraHosts = [], colorScheme = 'light' } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'crm-ext-'));
  const ext = join(work, 'ext');
  cpSync(extensionDir, ext, { recursive: true });
  if (extraHosts.length) {
    const mf = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
    mf.host_permissions = extraHosts;
    writeFileSync(join(ext, 'manifest.json'), JSON.stringify(mf, null, 2));
  }
  const context = await chromium.launchPersistentContext(join(work, 'profile'), {
    executablePath: chromiumPath(), headless: true, colorScheme,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-first-run', '--lang=pt-BR']
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(sw.url()).host;
  return { context, sw, id, url: (q) => `chrome-extension://${id}/src/app.html${q || ''}` };
}
