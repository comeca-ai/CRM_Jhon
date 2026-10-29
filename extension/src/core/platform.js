// Cliente mínimo da plataforma Decida Antes (tRPC + superjson), sem dependências.
// Login: a sessão do Cloudflare Access que o usuário já abriu no Chrome (cookies do domínio).
// Sem sessão, o Access responde com redirecionamento ou HTML de login, e isso vira PlatformError('login').
import { clip } from './capture.js';

export const DEFAULT_ORIGIN = 'https://decidaantes.com.br';
// A CSP do manifesto só libera estes hosts; qualquer outro endereço é recusado aqui também.
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*decidaantes\.com\.br$/;

export class PlatformError extends Error {
  constructor(kind, message) { super(message); this.name = 'PlatformError'; this.kind = kind; }
}

const MESSAGES = {
  login: 'Entre em decidaantes.com.br neste Chrome e tente de novo.',
  forbidden: 'Seu acesso ao Decida Antes não permite enviar capturas.',
  network: 'Não foi possível falar com o Decida Antes. Verifique a conexão.',
  server: 'O Decida Antes não conseguiu concluir o envio. Tente de novo em instantes.'
};

/** Aceita só https em decidaantes.com.br ou subdomínios. Devolve a origem ou null. */
export function normalizeOrigin(value) {
  try {
    const u = new URL(String(value || '').trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return ALLOWED_ORIGIN.test(u.origin) ? u.origin : null;
  } catch { return null; }
}

/** Chama uma procedure tRPC. Queries vão por GET; mutações por POST com corpo { json }. */
export async function callPlatform(origin, path, input, { method = 'POST', fetchImpl = globalThis.fetch } = {}) {
  const base = normalizeOrigin(origin);
  if (!base) throw new PlatformError('config', 'Endereço do Decida Antes inválido.');
  let url = `${base}/api/trpc/${path}`;
  const init = { method, credentials: 'include', redirect: 'manual', headers: { accept: 'application/json' } };
  if (method === 'GET') {
    if (input !== undefined) url += `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  } else {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify({ json: input });
  }
  let res;
  try { res = await fetchImpl(url, init); } catch { throw new PlatformError('network', MESSAGES.network); }
  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) throw new PlatformError('login', MESSAGES.login);
  const type = res.headers?.get?.('content-type') || '';
  if (!type.includes('json')) throw new PlatformError(res.ok ? 'login' : 'server', res.ok ? MESSAGES.login : MESSAGES.server);
  const body = await res.json().catch(() => null);
  const error = body?.error?.json ?? body?.error;
  if (error) {
    const code = error.data?.code;
    if (code === 'UNAUTHORIZED') throw new PlatformError('login', MESSAGES.login);
    if (code === 'FORBIDDEN') throw new PlatformError('forbidden', MESSAGES.forbidden);
    if (code === 'BAD_REQUEST') throw new PlatformError('invalid', 'A captura foi recusada pelo Decida Antes: dados incompletos ou inválidos.');
    throw new PlatformError('server', String(error.message || MESSAGES.server).slice(0, 200));
  }
  if (!res.ok) throw new PlatformError('server', MESSAGES.server);
  const data = body?.result?.data;
  return data && typeof data === 'object' && 'json' in data ? data.json : data;
}

const text = (v, max) => clip(v, max) || undefined;

/**
 * Monta a entrada de integrations.captureFromExtension a partir da sugestão da página
 * (suggestFromPage) e do que a pessoa revisou no formulário.
 */
export function buildCapturePayload(sug, object, form = {}, note = '') {
  const info = sug?.info || {};
  const isPerson = object === 'people';
  const contactName = isPerson ? text(form.name, 140) : undefined;
  const payload = {
    url: info.url,
    title: text(info.ogTitle || info.title, 300) || sug?.host || info.url,
    siteName: text(info.siteName, 160),
    description: text(info.description, 1000),
    selection: text(info.selection, 2000),
    note: text(note, 2000),
    emails: info.emails?.length ? info.emails : undefined, // já filtrados por extractPageInfo
    companyName: text(isPerson ? form.empresa : form.name, 180),
    website: isPerson ? undefined : text(form.site, 320), // o site revisado no formulário vale na plataforma
    contact: contactName?.length >= 2 ? { name: contactName, role: text(form.cargo, 120) } : undefined
  };
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  return payload;
}

export const sendCapture = (origin, payload, opts) => callPlatform(origin, 'integrations.captureFromExtension', payload, opts);
export const checkConnection = (origin, opts) => callPlatform(origin, 'integrations.status', undefined, { ...opts, method: 'GET' });
export const fetchSnapshot = (origin, opts) => callPlatform(origin, 'workspace.snapshot', undefined, { ...opts, method: 'GET' });

/** Resumo "Para decidir hoje" a partir do snapshot da plataforma. */
export function todaySummary(snapshot, limit = 5) {
  const s = snapshot || {};
  const metrics = s.metrics || {};
  const signals = (s.signals || []).filter((x) => x.status === 'new').slice(0, limit)
    .map((x) => ({ id: x.id, title: x.title, company: x.companyName, source: x.source, confidence: x.confidence }));
  const overdue = (s.overdueActions || []).slice(0, limit)
    .map((x) => ({ id: x.id, note: x.note, company: x.companyName }));
  const opportunities = (s.opportunities || []).filter((x) => !['won', 'lost'].includes(x.stage)).slice(0, limit)
    .map((x) => ({ id: x.id, title: x.title, company: x.companyName, nextAction: x.nextAction }));
  return {
    workspace: s.organization?.name || 'Decida Antes',
    counts: { toValidate: metrics.toValidate ?? signals.length, overdue: metrics.overdueActions ?? overdue.length, actionsToday: metrics.actionsToday ?? 0, openOpportunities: metrics.openOpportunities ?? opportunities.length },
    signals, overdue, opportunities
  };
}
