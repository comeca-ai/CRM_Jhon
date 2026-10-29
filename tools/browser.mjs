// Localiza o Chromium do Playwright já baixado nesta máquina.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(homedir(), '.cache', 'ms-playwright');
  const dir = existsSync(base) && readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && join(base, dir, 'chrome-linux', 'chrome');
  if (!exe || !existsSync(exe)) throw new Error('Chromium não encontrado; defina CHROMIUM_PATH.');
  return exe;
}
