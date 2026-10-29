import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrigin, callPlatform, buildCapturePayload, sendCapture, todaySummary, PlatformError } from '../../extension/src/core/platform.js';
import { suggestFromPage } from '../../extension/src/core/capture.js';

const json = (status, body) => ({ status, ok: status >= 200 && status < 300, type: 'basic', headers: { get: () => 'application/json' }, json: async () => body });

test('aceita só https em decidaantes.com.br', () => {
  assert.equal(normalizeOrigin('https://decidaantes.com.br/'), 'https://decidaantes.com.br');
  assert.equal(normalizeOrigin('https://app.decidaantes.com.br'), 'https://app.decidaantes.com.br');
  for (const bad of ['http://decidaantes.com.br', 'https://decidaantes.com.br.evil.com', 'https://evil.com', 'https://u:p@decidaantes.com.br', 'https://decidaantes.com.br:8443', '']) assert.equal(normalizeOrigin(bad), null, bad);
});

test('mutação vai por POST com envelope superjson e cookies do navegador', async () => {
  let seen;
  const out = await sendCapture('https://decidaantes.com.br', { url: 'https://a.com/' }, { fetchImpl: async (url, init) => { seen = { url, init }; return json(200, { result: { data: { json: { status: 'processed', signalId: 9 } } } }); } });
  assert.deepEqual(out, { status: 'processed', signalId: 9 });
  assert.equal(seen.url, 'https://decidaantes.com.br/api/trpc/integrations.captureFromExtension');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.credentials, 'include');
  assert.equal(seen.init.redirect, 'manual');
  assert.deepEqual(JSON.parse(seen.init.body), { json: { url: 'https://a.com/' } });
});

test('query sem entrada vai por GET sem parâmetro input', async () => {
  let seen;
  await callPlatform('https://decidaantes.com.br', 'integrations.status', undefined, { method: 'GET', fetchImpl: async (url, init) => { seen = { url, init }; return json(200, { result: { data: { json: {} } } }); } });
  assert.equal(seen.url, 'https://decidaantes.com.br/api/trpc/integrations.status');
  assert.equal(seen.init.body, undefined);
});

test('sessão do Access expirada vira erro de login, nunca sucesso silencioso', async () => {
  const cases = [
    { status: 0, ok: false, type: 'opaqueredirect', headers: { get: () => '' } },
    { status: 302, ok: false, type: 'basic', headers: { get: () => 'text/html' } },
    { status: 200, ok: true, type: 'basic', headers: { get: () => 'text/html; charset=utf-8' } },
    json(401, { error: { json: { message: 'Identidade necessária', data: { code: 'UNAUTHORIZED' } } } })
  ];
  for (const res of cases) {
    await assert.rejects(callPlatform('https://decidaantes.com.br', 'x', {}, { fetchImpl: async () => res }), (e) => e instanceof PlatformError && e.kind === 'login');
  }
});

test('erros do tRPC e de rede viram mensagens em português', async () => {
  const call = (res) => callPlatform('https://decidaantes.com.br', 'x', {}, { fetchImpl: async () => res });
  await assert.rejects(call(json(403, { error: { json: { message: 'viewer', data: { code: 'FORBIDDEN' } } } })), (e) => e.kind === 'forbidden');
  await assert.rejects(call(json(400, { error: { json: { message: 'zod', data: { code: 'BAD_REQUEST' } } } })), (e) => e.kind === 'invalid');
  await assert.rejects(callPlatform('https://decidaantes.com.br', 'x', {}, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), (e) => e.kind === 'network');
  await assert.rejects(callPlatform('https://evil.com', 'x', {}, { fetchImpl: async () => json(200, {}) }), (e) => e.kind === 'config');
});

test('captura de empresa monta o contrato da plataforma com o nome revisado', () => {
  const sug = suggestFromPage({ url: 'https://www.nuvem.com.br/sobre?utm=1', title: 'Nuvem Crédito | Home', siteName: 'Nuvem Crédito', description: 'Crédito para frotas', selection: '', emails: ['a@nuvem.com.br', 'ruim'] });
  const p = buildCapturePayload(sug, 'companies', { name: 'Nuvem Crédito S.A.' }, '  nota  ');
  assert.deepEqual(p, { url: 'https://www.nuvem.com.br/sobre', title: 'Nuvem Crédito | Home', siteName: 'Nuvem Crédito', description: 'Crédito para frotas', note: 'nota', emails: ['a@nuvem.com.br'], companyName: 'Nuvem Crédito S.A.' });
});

test('captura de perfil envia contato e empresa do formulário', () => {
  const sug = suggestFromPage({ url: 'https://www.linkedin.com/in/ana', title: 'Ana Souza - Diretora - Nuvem | LinkedIn' });
  const p = buildCapturePayload(sug, 'people', { name: 'Ana Souza', cargo: 'Diretora', empresa: 'Nuvem Crédito' }, '');
  assert.deepEqual(p.contact, { name: 'Ana Souza', role: 'Diretora' });
  assert.equal(p.companyName, 'Nuvem Crédito');
  assert.equal(p.note, undefined);
});

test('resumo de hoje usa as métricas do snapshot', () => {
  const t = todaySummary({ organization: { name: 'Operação Campo' }, metrics: { toValidate: 3, overdueActions: 1, actionsToday: 2, openOpportunities: 4 },
    signals: [{ id: 1, status: 'new', title: 'S', companyName: 'A', source: 'extensao-chrome', confidence: 35 }, { id: 2, status: 'validated' }],
    overdueActions: [{ id: 5, note: 'Ligar', companyName: 'B' }], opportunities: [{ id: 7, stage: 'won' }, { id: 8, stage: 'new', title: 'O', companyName: 'C', priorityScore: 80 }] });
  assert.equal(t.workspace, 'Operação Campo');
  assert.deepEqual(t.counts, { toValidate: 3, overdue: 1, actionsToday: 2, openOpportunities: 4 });
  assert.deepEqual(t.signals.map((s) => s.id), [1]);
  assert.deepEqual(t.opportunities.map((o) => o.id), [8]);
});
