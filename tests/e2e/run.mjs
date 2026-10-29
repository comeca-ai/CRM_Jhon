// Teste de ponta a ponta: carrega a extensão real no Chromium e percorre as jornadas de aceite.
// Limites honestos: o painel lateral é exercitado como página da extensão na largura do painel
// (automação não abre o painel nativo), e as origens de teste são concedidas por manifesto de teste.
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launchWithExtension } from '../../tools/launch.mjs';

const SHOTS = 'docs/screenshots';
mkdirSync(SHOTS, { recursive: true });
mkdirSync('docs/quality', { recursive: true });
const results = [];
const errors = [];
async function step(name, fn) {
  const t = Date.now();
  if (process.env.DEBUG_STATE && globalThis.__panel) console.log('   [estado antes]', await globalThis.__panel.evaluate(async () => ((await chrome.storage.local.get('crm.records'))['crm.records']?.companies || []).map((c) => c.name).join(',')).catch(() => '?'));
  try { const detail = await fn(); results.push({ name, ok: true, ms: Date.now() - t, detail }); console.log('ok  ', name); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t, error: String(e?.message || e) }); console.log('FAIL', name, '-', e?.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

const fixture = readFileSync('tests/e2e/fixtures/empresa.html');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fixture); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const site = `http://127.0.0.1:${server.address().port}/sobre`;

const { context, sw, url } = await launchWithExtension({ extensionDir: process.env.EXT_DIR || 'extension', extraHosts: ['http://127.0.0.1/*', 'https://api.anthropic.com/*', 'https://decidaantes.com.br/*'] });
const browserVersion = context.browser()?.version() || (await sw.evaluate(() => navigator.userAgent));

// API da Anthropic simulada: devolve uma spec no formato de saída estruturada.
let apiRequest = null;
await context.route('https://api.anthropic.com/**', async (route) => {
  const req = route.request();
  apiRequest = { method: req.method(), headers: await req.allHeaders(), body: JSON.parse(req.postData() || '{}') };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    id: 'msg_teste', type: 'message', role: 'assistant', model: apiRequest.body.model, stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text: JSON.stringify({ title: 'Kanban de contatos por responsável', object: 'people', type: 'kanban', columns: [], groupBy: 'owner', card: ['name', 'cargo', 'campo_inventado'], filters: [], sort: null }) }]
  }) });
});

const panel = await context.newPage();
panel.on('pageerror', (e) => errors.push('panel: ' + e.message));
// o 401 da API simulada é provocado de propósito no teste de queda para regras
panel.on('console', (m) => { if (m.type() === 'error' && !/^https:\/\/(api\.anthropic\.com|decidaantes\.com\.br)\//.test(m.location()?.url || '')) errors.push('panel console: ' + m.text()); });
await panel.setViewportSize({ width: 400, height: 760 });
globalThis.__panel = panel;
await panel.goto(url('?surface=panel'));
await panel.waitForSelector('body[data-ready="1"]');
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png` });
const chip = (t) => panel.locator('#chips .chip', { hasText: t }).first();

await step('service worker configura abrir painel ao clicar no ícone', async () => {
  const b = await sw.evaluate(() => chrome.sidePanel.getPanelBehavior());
  assert(b.openPanelOnActionClick === true, 'openPanelOnActionClick falso');
  const opts = await sw.evaluate(() => chrome.sidePanel.getOptions({}));
  assert(/src\/app\.html$/.test(opts.path), 'caminho do painel: ' + opts.path);
  return opts;
});

await step('telas base com dados de exemplo', async () => {
  const n = await panel.locator('#canvas tbody tr').count();
  assert(n === 6, 'esperava 6 empresas, veio ' + n);
  await chip('Pipeline').click();
  assert(await panel.locator('.kcol').count() === 5, 'kanban sem 5 estágios');
});

await step('gera tela por linguagem natural (regras)', async () => {
  await panel.fill('#cmd-input', 'negócios abertos acima de 150 mil');
  await panel.press('#cmd-input', 'Enter');
  await panel.waitForFunction(() => document.querySelector('#vtitle').textContent.startsWith('Negócios abertos'));
  const rows = await panel.locator('#canvas tbody tr').count();
  assert(rows === 4, 'esperava 4 negócios, veio ' + rows);
  const stored = await panel.evaluate(async () => (await chrome.storage.local.get('crm.views'))['crm.views'].at(-1));
  assert(stored.filters.length === 2 && stored.generator === 'rules', 'spec salva errada');
  return { filters: stored.filters };
});

await step('kanban: arrastar negócio muda o estágio e registra na linha do tempo', async () => {
  await chip('Pipeline').click();
  const card = panel.locator('.kcard', { hasText: 'Limite pré-aprovado' });
  const target = panel.locator('.kcol', { hasText: 'Qualificado' }).first();
  await card.dragTo(target);
  await panel.waitForFunction(async () => (await chrome.storage.local.get('crm.records'))['crm.records'].deals.find((d) => d.name === 'Limite pré-aprovado').estagio === 'Qualificado');
  const rec = await panel.evaluate(async () => (await chrome.storage.local.get('crm.records'))['crm.records'].deals.find((d) => d.name === 'Limite pré-aprovado'));
  assert(/Estágio: Lead → Qualificado/.test(rec.timeline.at(-1).text), 'linha do tempo sem a mudança');
});

await step('captura a página ativa como empresa (texto da página não vira HTML)', async () => {
  const site_ = await context.newPage();
  await site_.goto(site);
  await panel.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' }); await chrome.tabs.update(t.id, { active: true }); });
  await panel.evaluate(() => document.querySelector('#btn-capture').click());
  await panel.waitForSelector('.sheet [role="radiogroup"]');
  const name = await panel.inputValue('#f-name');
  const siteVal = await panel.inputValue('#f-site');
  assert(name === 'Nuvem Crédito', 'nome sugerido: ' + name);
  assert(siteVal === 'https://127.0.0.1', 'site sugerido: ' + siteVal);
  await panel.selectOption('#f-setor', 'Crédito');
  await shot(panel, '04-painel-captura');
  await panel.getByRole('button', { name: 'Salvar', exact: true }).click();
  await panel.waitForSelector('.sheet', { state: 'detached' });
  const rec = await panel.evaluate(async () => (await chrome.storage.local.get('crm.records'))['crm.records'].companies[0]);
  assert(rec.name === 'Nuvem Crédito' && rec.timeline[0].kind === 'capture', 'registro capturado errado');
  assert(/comercial@nuvemcredito.example/.test(rec.timeline[0].text), 'e-mail da página não entrou na nota');
  assert(!/%E0/.test(rec.timeline[0].text), 'e-mail malformado entrou na nota');
  assert(await site_.evaluate(() => window.__xss) === 1, 'controle: a página de teste executa seu próprio onerror');
  assert(await panel.evaluate(() => !window.__xss), 'conteúdo da página executou no painel');
  await site_.close();
  return { name: rec.name, note: rec.timeline[0].text.slice(0, 80) };
});

// O Chrome real não mostra o endereço da aba ao painel sem permissão, e o pedido de permissão
// não pode ser clicado em automação: simulamos a primeira falha e a resposta do diálogo.
await step('captura sem acesso: explica, pede permissão num clique próprio e captura', async () => {
  const site_ = await context.newPage();
  await site_.goto(site);
  await panel.evaluate(() => {
    const real = { exec: chrome.scripting.executeScript, query: chrome.tabs.query, req: chrome.permissions.request };
    window.__restore = () => { chrome.scripting.executeScript = real.exec; chrome.tabs.query = real.query; chrome.permissions.request = real.req; };
    window.__permCalls = [];
    window.__block = 'site'; // 'internal' simula chrome://newtab; 'site' simula um site comum sem permissão
    chrome.tabs.query = async (q) => (await real.query.call(chrome.tabs, q)).map((t) => (window.__block ? { id: t.id, active: t.active } : t));
    chrome.scripting.executeScript = (a) => {
      if (window.__block === 'internal') return Promise.reject(new Error('Cannot access contents of url "chrome://newtab/". Extension manifest must request permission to access this host.'));
      if (window.__block === 'site') return Promise.reject(new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.'));
      return real.exec.call(chrome.scripting, a);
    };
    chrome.permissions.request = (p) => { window.__permCalls.push({ origins: p.origins, gesture: navigator.userActivation.isActive }); window.__block = null; return Promise.resolve(true); };
  });
  try {
    await panel.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' }); await chrome.tabs.update(t.id, { active: true }); });
    // página interna: nenhuma permissão adianta, então não se pede acesso a todos os sites
    await panel.evaluate(() => { window.__block = 'internal'; });
    await panel.click('#btn-capture');
    await panel.waitForFunction(() => document.querySelector('#toast').textContent.includes('não permite leitura'));
    assert(await panel.locator('#btn-allow-sites').count() === 0, 'pediu acesso para página interna');
    // site comum sem permissão: janela explicativa e pedido só no clique de confirmação
    await panel.evaluate(() => { window.__block = 'site'; });
    await panel.click('#btn-capture');
    await panel.waitForSelector('#btn-allow-sites');
    assert(await panel.evaluate(() => window.__permCalls.length) === 0, 'pediu permissão antes do clique de confirmação');
    await shot(panel, '14-painel-pedido-acesso');
    await panel.dblclick('#btn-allow-sites');
    await panel.waitForSelector('#f-name');
    const calls = await panel.evaluate(() => window.__permCalls);
    assert(calls.length === 1 && calls[0].gesture, 'pedidos de permissão: ' + JSON.stringify(calls));
    assert(JSON.stringify(calls[0].origins) === JSON.stringify(['https://*/*', 'http://*/*']), 'origens pedidas: ' + JSON.stringify(calls[0].origins));
    assert(await panel.inputValue('#f-name') === 'Nuvem Crédito', 'formulário sem a página capturada');
    await panel.keyboard.press('Escape');
    await panel.waitForSelector('.sheet', { state: 'detached' });
    return { origins: calls[0].origins };
  } finally {
    await panel.evaluate(() => window.__restore?.());
    await site_.close();
  }
});

await step('registro: editar campo e adicionar nota entram na linha do tempo', async () => {
  await panel.locator('#canvas tbody tr', { hasText: 'Nuvem Crédito' }).click();
  await panel.waitForSelector('.sheet');
  await panel.selectOption('#f-status', 'Negociação');
  await panel.waitForFunction(() => [...document.querySelectorAll('.tl .txt')].some((e) => e.textContent.includes('Status: — → Negociação')));
  await panel.fill('#note', 'Reunião marcada com o diretor financeiro para terça.');
  await panel.getByRole('button', { name: 'Adicionar nota' }).click();
  await panel.waitForFunction(() => document.querySelector('.tl li .txt')?.textContent.includes('diretor financeiro'));
  await shot(panel, '05-painel-registro');
  await panel.keyboard.press('Escape');
  await panel.waitForSelector('.sheet', { state: 'detached' });
  assert(await panel.evaluate(() => document.activeElement?.tagName) === 'TR', 'foco não voltou para a linha');
});

await step('aprendizado: após cliques, sugere reordenar e só muda com aceite', async () => {
  await chip('Empresas').click();
  for (let i = 0; i < 5; i++) await panel.locator('th button[data-f="owner"]').click();
  await panel.waitForSelector('.banner.learn');
  const before = await panel.locator('th button').allTextContents();
  await shot(panel, '06-painel-sugestao-aprendizado');
  await panel.locator('.banner.learn').getByRole('button', { name: 'Aplicar' }).click();
  const after = await panel.locator('th button').allTextContents();
  assert(/Responsável/.test(after[1]), 'Responsável não subiu: ' + after.join('|'));
  assert(before.join() !== after.join(), 'ordem não mudou');
  return { after: after.map((s) => s.replace(/[↑↓✦\d]/g, '').trim()) };
});

await step('schema dinâmico: novo campo aparece na tabela', async () => {
  await panel.click('#btn-settings');
  await panel.fill('#nf-label', 'Origem do lead');
  await panel.selectOption('#nf-type', 'select');
  await panel.fill('#nf-opts', 'Indicação, Evento, Site');
  await panel.getByRole('button', { name: 'Adicionar campo' }).click();
  await panel.waitForSelector('.fieldlist li:has-text("Origem do lead")');
  await shot(panel, '07-painel-configuracoes');
  await panel.keyboard.press('Escape');
  const heads = await panel.locator('th button').allTextContents();
  assert(heads.some((h) => h.includes('Origem do lead')), 'campo novo não está na tabela');
});

await step('exportar JSON nunca inclui a chave da API', async () => {
  await panel.evaluate(async () => { const s = (await chrome.storage.local.get('crm.settings'))['crm.settings']; s.apiKey = 'chave-sintetica-de-teste'; await chrome.storage.local.set({ 'crm.settings': s }); });
  await panel.reload(); await panel.waitForSelector('body[data-ready="1"]');
  await panel.click('#btn-settings');
  const [dl] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Exportar JSON' }).click()]);
  const text = readFileSync(await dl.path(), 'utf8');
  assert(!text.includes('chave-sintetica-de-teste'), 'chave vazou no backup');
  const data = JSON.parse(text);
  assert(data.app === 'crm-generativo' && data.records.companies.length === 7, 'backup incompleto');
  await panel.keyboard.press('Escape');
});

await step('gerador Claude: pedido estruturado, spec validada e campo inventado descartado', async () => {
  await panel.click('#btn-settings');
  await panel.locator('.seg label', { hasText: 'Claude' }).click();
  await panel.waitForSelector('#api-key');
  await panel.keyboard.press('Escape');
  await panel.fill('#cmd-input', 'kanban de contatos por responsável');
  await panel.click('#cmd-go');
  await panel.waitForFunction(() => document.querySelector('#vgen').textContent === 'gerada pelo Claude');
  assert(apiRequest, 'nenhum pedido à API');
  // o SDK 1.x envia a chave do usuário como Authorization: Bearer
  assert(apiRequest.headers.authorization === 'Bearer chave-sintetica-de-teste', 'chave não enviada no cabeçalho de autorização');
  assert(apiRequest.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'falta cabeçalho de acesso direto');
  assert(/server-side-fallback-2026-07-01/.test(apiRequest.headers['anthropic-beta'] || ''), 'falta beta de fallback');
  assert(apiRequest.body.output_config?.format?.type === 'json_schema' && apiRequest.body.fallbacks === 'default', 'corpo sem saída estruturada');
  assert(!('tool_choice' in apiRequest.body), 'não deveria forçar ferramenta');
  const spec = await panel.evaluate(async () => (await chrome.storage.local.get('crm.views'))['crm.views'].at(-1));
  assert(spec.generator === 'claude' && spec.groupBy === 'owner' && !spec.card.includes('campo_inventado'), 'spec do Claude não validada');
  assert((spec._warnings || []).some((w) => w.includes('campo_inventado')), 'validador não avisou do campo inventado');
  await panel.click('#insp-toggle');
  assert(await panel.locator('#spec-warn').isVisible(), 'aviso do validador não aparece no inspetor');
  await shot(panel, '08-painel-gerado-claude');
  await panel.click('#insp-toggle');
  return { model: apiRequest.body.model, card: spec.card, warnings: spec._warnings };
});

await step('gerador Claude: falha da API cai para regras com aviso', async () => {
  await context.unroute('https://api.anthropic.com/**');
  await context.route('https://api.anthropic.com/**', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}' }));
  await panel.fill('#cmd-input', 'empresas clientes');
  await panel.click('#cmd-go');
  await panel.waitForFunction(() => document.querySelector('#toast').textContent.includes('Usei o gerador por regras'));
  const spec = await panel.evaluate(async () => (await chrome.storage.local.get('crm.views'))['crm.views'].at(-1));
  assert(spec.generator === 'rules' && spec.filters[0].value === 'Cliente', 'fallback não gerou por regras');
});

await step('menu de contexto: captura sem botão do painel abre o formulário', async () => {
  const pg = await context.newPage();
  await pg.goto(site);
  const tabId = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0].id);
  await sw.evaluate((id) => globalThis.crmCaptureTab(id), tabId);
  await panel.waitForSelector('#capture-note');
  const note = await panel.inputValue('#capture-note');
  assert(/Capturado de http:\/\/127\.0\.0\.1:\d+\/sobre/.test(note), 'nota sem a URL limpa: ' + note);
  assert(await panel.inputValue('#f-name') === 'Nuvem Crédito', 'nome não sugerido');
  await panel.keyboard.press('Escape');
  await pg.close();
  return { note: note.slice(0, 90) };
});

await step('configurações listam os sites com acesso', async () => {
  await panel.click('#btn-settings');
  await panel.waitForSelector('#sites li');
  const items = await panel.locator('#sites li').allTextContents();
  assert(items.some((t) => t.includes('127.0.0.1')), 'lista de sites: ' + items.join('|'));
  await panel.keyboard.press('Escape');
  return items;
});

await step('backup malicioso é recusado e o armazenamento fica intacto', async () => {
  const before = await panel.evaluate(async () => JSON.stringify(await chrome.storage.local.get(['crm.schema', 'crm.records', 'crm.views'])));
  await panel.click('#btn-settings');
  for (const bad of [{ app: 'crm-generativo', schema: {}, records: {} },
                     { app: 'crm-generativo', schema: { deals: { label: 'X', fields: [{ id: 'name', label: 'N', type: 'text' }] } }, records: { deals: [] }, views: [{ object: 'constructor', type: 'table' }] , usage: {} }]) {
    await panel.setInputFiles('#import-file', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await panel.waitForTimeout(300);
    if (Object.keys(bad.schema).length === 0) {
      const t = await panel.textContent('#toast');
      assert(/Backup recusado/.test(t), 'mensagem de recusa ausente: ' + t);
      const after = await panel.evaluate(async () => JSON.stringify(await chrome.storage.local.get(['crm.schema', 'crm.records', 'crm.views'])));
      assert(after === before, 'armazenamento mudou após backup recusado');
    } else {
      // schema mínimo é válido; a tela com objeto herdado é descartada e o app segue funcionando
      await panel.waitForSelector('body[data-ready="1"]');
      assert(await panel.locator('#canvas').count() === 1, 'app quebrou');
      const views = await panel.evaluate(async () => (await chrome.storage.local.get('crm.views'))['crm.views']);
      assert(views.every((v) => v.object === 'deals'), 'tela com objeto herdado foi gravada');
      await panel.locator('#toast button', { hasText: 'Desfazer' }).click();
      await panel.waitForFunction(async () => Object.keys((await chrome.storage.local.get('crm.schema'))['crm.schema']).length === 3);
      await panel.click('#btn-settings');
    }
  }
  await panel.keyboard.press('Escape');
});

await step('estado corrompido mostra recuperação e restaura o exemplo', async () => {
  const p = await context.newPage();
  await p.setViewportSize({ width: 400, height: 760 });
  await p.goto(url());
  await p.waitForSelector('body[data-ready="1"]');
  const backup = await p.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
  await p.evaluate(async () => chrome.storage.local.set({ 'crm.schema': { deals: { label: 'Quebrado', fields: 'x' } } }));
  await p.reload();
  await p.waitForSelector('text=Os dados salvos na extensão estão inválidos');
  await p.screenshot({ path: `${SHOTS}/11-painel-recuperacao.png` });
  await p.getByRole('button', { name: 'Restaurar exemplo' }).click();
  await p.waitForSelector('body[data-ready="1"]');
  assert(await p.locator('#chips .chip').count() === 3, 'exemplo não restaurado');
  await p.evaluate(async (b) => { await chrome.storage.local.set(JSON.parse(b)); }, backup); // sem clear(): outro painel aberto recriaria o exemplo no intervalo
  await p.close();
  await panel.reload(); await panel.waitForSelector('body[data-ready="1"]');
});

await step('aba cheia reflete o mesmo estado', async () => {
  const full = await context.newPage();
  full.on('pageerror', (e) => errors.push('tab: ' + e.message));
  await full.setViewportSize({ width: 1280, height: 800 });
  await full.goto(url('?surface=tab'));
  await full.waitForSelector('body[data-ready="1"]');
  await full.locator('#nav-base .navitem', { hasText: 'Empresas' }).click();
  assert(await full.locator('#canvas tbody tr', { hasText: 'Nuvem Crédito' }).count() === 1, 'empresa capturada ausente na aba cheia');
  assert(await full.locator('#nav-gen .navitem').count() >= 3, 'telas geradas ausentes');
  await full.screenshot({ path: `${SHOTS}/09-tela-cheia.png` });
  await full.close();
});

// Plataforma Decida Antes simulada no formato do tRPC (superjson). O login real do Cloudflare Access
// só pode ser verificado no Chrome do usuário; aqui conferimos o contrato e os três desfechos.
await step('Decida Antes: conecta, envia captura como sinal, trata duplicata e login expirado', async () => {
  const sent = [];
  let mode = 'ok';
  await context.route('https://decidaantes.com.br/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const ok = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { data: { json: data } } }) });
    if (mode === 'login') return route.fulfill({ status: 302, headers: { location: 'https://jhonata-emerick.cloudflareaccess.com/cdn-cgi/access/login/decidaantes.com.br' } });
    if (path.endsWith('/integrations.status')) return ok({ integrations: [] });
    if (path.endsWith('/workspace.snapshot')) return ok({ organization: { name: 'Operação Campo' }, metrics: { toValidate: 2, overdueActions: 1, actionsToday: 0, openOpportunities: 1 },
      signals: [{ id: 1, status: 'new', title: 'Captura: Nuvem Crédito', companyName: 'Nuvem Crédito', source: 'extensao-chrome', confidence: 35 }],
      overdueActions: [{ id: 3, note: 'Ligar para o financeiro', companyName: 'Frota Sul' }], opportunities: [{ id: 4, stage: 'qualified', title: 'Reembolsa', companyName: 'Frota Sul', priorityScore: 80, nextAction: 'Demonstração' }] });
    if (path.endsWith('/integrations.captureFromExtension')) {
      const body = JSON.parse(req.postData() || '{}');
      sent.push({ body, credentials: req.headers()['content-type'] });
      return ok({ status: sent.length === 1 ? 'processed' : 'duplicate', companyId: 11, companyName: body.json.companyName, companyCreated: sent.length === 1, signalId: 501 });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  try {
    await panel.click('#btn-settings');
    await panel.click('#platform-on');
    await panel.waitForSelector('#platform-test');
    await panel.click('#platform-test');
    await panel.waitForFunction(() => document.querySelector('#platform-status').textContent.includes('Conectado'));
    const st = await panel.evaluate(async () => (await chrome.storage.local.get('crm.settings'))['crm.settings'].platform);
    assert(st.enabled && st.origin === 'https://decidaantes.com.br', 'configuração: ' + JSON.stringify(st));
    await shot(panel, '15-painel-decida-antes-config');
    await panel.keyboard.press('Escape');
    assert(await panel.isVisible('#btn-today'), 'botão Hoje não apareceu');

    const site_ = await context.newPage();
    await site_.goto(site);
    const captureAndSave = async (name) => {
      await panel.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' }); await chrome.tabs.update(t.id, { active: true }); });
      await panel.click('#btn-capture');
      await panel.waitForSelector('#btn-save-new');
      await panel.fill('#f-name', name);
      assert((await panel.textContent('#btn-save-new')).includes('enviar ao Decida Antes'), 'botão sem envio');
      await panel.click('#btn-save-new');
      await panel.waitForSelector('.sheet', { state: 'detached' });
    };
    await captureAndSave('Nuvem Crédito (plataforma)');
    await panel.waitForFunction(() => document.querySelector('#toast').textContent.includes('Sinal novo no Decida Antes'));
    const first = sent[0].body.json;
    assert(first.companyName === 'Nuvem Crédito (plataforma)' && /^http:\/\/127\.0\.0\.1:\d+\/sobre$/.test(first.url), 'payload: ' + JSON.stringify(first));
    assert(first.title && first.note && first.emails?.includes('comercial@nuvemcredito.example'), 'payload incompleto: ' + JSON.stringify(first));
    await captureAndSave('Nuvem Crédito (de novo)');
    await panel.waitForFunction(() => document.querySelector('#toast').textContent.includes('já foi enviada hoje'));
    mode = 'login';
    await captureAndSave('Nuvem Crédito (sem login)');
    await panel.waitForFunction(() => document.querySelector('#toast').textContent.includes('Entre em decidaantes.com.br'));
    assert(await panel.locator('#toast button', { hasText: 'Entrar' }).count() === 1, 'sem botão Entrar');
    const local = await panel.evaluate(async () => (await chrome.storage.local.get('crm.records'))['crm.records'].companies.map((c) => c.name));
    assert(local.includes('Nuvem Crédito (sem login)'), 'registro local não foi salvo quando a plataforma falhou');
    await site_.close();

    mode = 'ok';
    await panel.click('#btn-today');
    await panel.waitForFunction(() => document.querySelector('#today')?.textContent.includes('Ligar para o financeiro'));
    const today = await panel.textContent('#today');
    assert(today.includes('Sinais a validar: 2') && today.includes('Operação Campo') && today.includes('Demonstração'), 'resumo de hoje: ' + today);
    await shot(panel, '16-painel-hoje-decida-antes');
    await panel.keyboard.press('Escape');
    return { sent: sent.length, firstPayloadKeys: Object.keys(first) };
  } finally {
    await context.unroute('https://decidaantes.com.br/**');
  }
});

await step('acessibilidade (axe-core, WCAG 2.1 A/AA) no painel, registro e configurações', async () => {
  const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
  const run = async (label) => {
    await panel.evaluate(axe);
    const r = await panel.evaluate(async () => { const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }); return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') })); });
    return { label, violations: r };
  };
  const out = [await run('painel')];
  await panel.locator('#canvas tbody tr').first().click(); await panel.waitForSelector('.sheet');
  out.push(await run('registro'));
  await panel.keyboard.press('Escape');
  await panel.click('#btn-settings'); await panel.waitForSelector('.sheet');
  out.push(await run('configurações'));
  await panel.keyboard.press('Escape');
  const serious = out.flatMap((o) => o.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${o.label}:${v.id}(${v.sample})`));
  assert(!serious.length, 'violações graves: ' + serious.join(', '));
  return out;
});

await step('tema escuro renderiza', async () => {
  const dark = await context.newPage();
  await dark.emulateMedia({ colorScheme: 'dark' });
  await dark.setViewportSize({ width: 400, height: 760 });
  await dark.goto(url('?surface=panel'));
  await dark.waitForSelector('body[data-ready="1"]');
  await dark.locator('#chips .chip', { hasText: 'Pipeline' }).click();
  const bg = await dark.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(bg === 'rgb(12, 31, 32)', 'fundo escuro não aplicado: ' + bg);
  await dark.screenshot({ path: `${SHOTS}/10-painel-escuro.png` });
  await dark.close();
});

await step('desempenho: abertura do painel e geração de tela', async () => {
  const p = await context.newPage();
  await p.setViewportSize({ width: 400, height: 760 });
  const t0 = Date.now();
  await p.goto(url('?surface=panel'));
  await p.waitForSelector('body[data-ready="1"]');
  const open = Date.now() - t0;
  const gen = await p.evaluate(async () => {
    const t = performance.now();
    document.querySelector('#cmd-input').value = 'contatos do rafael';
    document.querySelector('#cmd').requestSubmit();
    await new Promise((r) => { const iv = setInterval(() => { if (document.querySelector('#vtitle').textContent.startsWith('Contatos do')) { clearInterval(iv); r(); } }, 5); });
    return Math.round(performance.now() - t);
  });
  const vendorLoaded = await p.evaluate(() => performance.getEntriesByType('resource').some((e) => e.name.includes('vendor/anthropic.js')));
  await p.close();
  assert(open < 1500, 'abertura lenta: ' + open + ' ms');
  return { panelOpenMs: open, rulesGenerateMs: gen, sdkLoadedWithRulesGenerator: vendorLoaded };
});

await step('sem erros de JavaScript nas páginas da extensão', async () => { assert(!errors.length, errors.join(' | ')); });

await context.close();
server.close();
const report = { date: new Date().toISOString(), artifact: process.env.EXT_DIR || 'extension/', browser: browserVersion, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results,
  limits: ['Painel lateral exercitado como página da extensão a 400 px; o painel nativo do Chrome não é aberto por automação.',
    'Origens http://127.0.0.1 e api.anthropic.com concedidas por manifesto de teste; o diálogo de permissão real não foi clicado.',
    'API da Anthropic simulada; nenhuma chamada real foi feita.'] };
writeFileSync('docs/quality/e2e-results.json', JSON.stringify(report, null, 2));
console.log(`\n${report.passed} passaram, ${report.failed} falharam · ${browserVersion}`);
process.exit(report.failed ? 1 : 0);
