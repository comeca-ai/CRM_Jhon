import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_SCHEMA, SEED_RECORDS } from '../../extension/src/core/seed.js';
import { validateSpec, applySpec, groupValues } from '../../extension/src/core/spec.js';
import { generateWithRules } from '../../extension/src/core/generator-rules.js';
import { track, suggestion, proposedColumns, SUGGEST_AFTER } from '../../extension/src/core/learning.js';
import { createRecord, updateField, addNote, coerce } from '../../extension/src/core/records.js';
import { suggestFromPage, captureNote } from '../../extension/src/core/capture.js';
import { generateWithClaude, specJsonSchema, ClaudeGeneratorError } from '../../extension/src/core/generator-claude.js';

const schema = structuredClone(SEED_SCHEMA);
const gen = (p) => validateSpec(generateWithRules(p, schema), schema);

test('validador recusa objeto e tipo inexistentes', () => {
  assert.equal(validateSpec({ object: 'tarefas', type: 'table' }, schema).ok, false);
  assert.equal(validateSpec({ object: 'deals', type: 'grafico' }, schema).ok, false);
});

test('validador remove chaves desconhecidas, colunas falsas e filtro inválido', () => {
  const r = validateSpec({ object: 'deals', type: 'table', columns: ['valor', 'hack', 'estagio'], filter: { field: 'valor', op: 'eval', value: 1 }, html: '<script>', onload: 'x' }, schema);
  assert.ok(r.ok);
  assert.deepEqual(r.spec.columns, ['name', 'valor', 'estagio']);
  assert.equal(r.spec.filters, undefined);
  assert.equal(r.spec.html, undefined);
  assert.equal(r.spec.onload, undefined);
  assert.ok(r.errors.length >= 2);
});

test('validador aceita filtro legado e limita a 3 filtros', () => {
  assert.deepEqual(validateSpec({ object: 'deals', type: 'table', filter: { field: 'prob', op: '>', value: 10 } }, schema).spec.filters, [{ field: 'prob', op: '>', value: 10 }]);
  const many = Array.from({ length: 5 }, () => ({ field: 'prob', op: '>', value: 1 }));
  assert.equal(validateSpec({ object: 'deals', type: 'table', filters: many }, schema).spec.filters.length, 3);
});

test('validador converte valor monetário em texto e recusa "contém" em número', () => {
  assert.equal(validateSpec({ object: 'deals', type: 'table', filter: { field: 'valor', op: '>=', value: '150.000' } }, schema).spec.filters[0].value, 150000);
  assert.equal(validateSpec({ object: 'deals', type: 'table', filter: { field: 'valor', op: 'contains', value: 1 } }, schema).spec.filters, undefined);
});

test('kanban com agrupamento inválido cai para o campo de estágio', () => {
  const r = validateSpec({ object: 'deals', type: 'kanban', groupBy: 'valor' }, schema);
  assert.equal(r.spec.groupBy, 'estagio');
});

test('regras: "negócios abertos acima de 150 mil" vira tabela filtrada e ordenada', () => {
  const { spec } = gen('negócios abertos acima de 150 mil');
  assert.equal(spec.object, 'deals');
  assert.equal(spec.type, 'table');
  assert.deepEqual(spec.filters, [{ field: 'valor', op: '>=', value: 150000 }, { field: 'estagio', op: '!=', value: 'Fechado' }]);
  assert.deepEqual(spec.sort, { field: 'valor', dir: 'desc' });
  const rows = applySpec(SEED_RECORDS.deals, spec);
  assert.deepEqual(rows.map((r) => r.valor), [420000, 310000, 220000, 160000]);
  assert.equal(gen('negócios acima de 1,5 milhão').spec.filters[0].value, 1500000);
});

test('regras: kanban por responsável', () => {
  const { spec } = gen('kanban de negócios por responsável');
  assert.equal(spec.type, 'kanban');
  assert.equal(spec.groupBy, 'owner');
  assert.deepEqual(groupValues(schema, spec, SEED_RECORDS.deals), ['Jhonata', 'Rafael', 'Marina']);
});

test('regras: empresas clientes filtra por status', () => {
  const { spec } = gen('empresas clientes');
  assert.equal(spec.object, 'companies');
  assert.deepEqual(spec.filters, [{ field: 'status', op: '=', value: 'Cliente' }]);
  assert.equal(applySpec(SEED_RECORDS.companies, spec).length, 2);
});

test('regras: negócios fechados e abertos', () => {
  assert.deepEqual(gen('negócios fechados').spec.filters, [{ field: 'estagio', op: '=', value: 'Fechado' }]);
  assert.deepEqual(gen('pipeline em aberto').spec.filters, [{ field: 'estagio', op: '!=', value: 'Fechado' }]);
});

test('regras: contatos do Rafael', () => {
  const { spec } = gen('contatos do rafael');
  assert.equal(spec.object, 'people');
  assert.deepEqual(spec.filters, [{ field: 'owner', op: '=', value: 'Rafael' }]);
});

test('aprendizado só sugere após sinais suficientes e respeita dispensa', () => {
  const view = { id: 'v-emp', object: 'companies', type: 'table', columns: ['name', 'setor', 'porte', 'status', 'owner'] };
  let u = {};
  for (let i = 0; i < SUGGEST_AFTER - 1; i++) u = track(u, 'companies', 'owner');
  assert.equal(suggestion(view, u), null);
  u = track(u, 'companies', 'owner');
  const s = suggestion(view, u);
  assert.deepEqual(s.columns, ['name', 'owner', 'setor', 'porte', 'status']);
  assert.equal(suggestion(view, u, { 'v-emp': s.total }), null);
  assert.deepEqual(proposedColumns(s.columns, u, 'companies'), s.columns);
});

test('registros: cria com linha do tempo, edita e anota', () => {
  const rec = createRecord(schema, 'deals', { name: 'Novo', valor: 'R$ 1.250.000', prob: '35%' }, null, 1000);
  assert.equal(rec.valor, 1250000);
  assert.equal(rec.prob, 35);
  const r2 = updateField(schema, 'deals', rec, 'estagio', 'Proposta', 2000);
  assert.match(r2.timeline.at(-1).text, /Estágio: — → Proposta/);
  assert.equal(updateField(schema, 'deals', r2, 'estagio', 'Proposta'), r2);
  assert.equal(addNote(r2, 'ligar amanhã', 3000).timeline.at(-1).kind, 'note');
  assert.throws(() => createRecord(schema, 'deals', { valor: 1 }), /obrigatório/);
  assert.equal(coerce({ type: 'url' }, 'exemplo.com'), 'https://exemplo.com');
});

test('captura: site vira empresa; LinkedIn vira contato; chrome:// é recusado', () => {
  const c = suggestFromPage({ url: 'https://www.acme.com.br/sobre', title: 'Sobre nós | Acme Dados', siteName: 'Acme Dados', description: 'Dados para crédito', emails: ['contato@acme.com.br'] });
  assert.equal(c.object, 'companies');
  assert.deepEqual(c.values, { name: 'Acme Dados', site: 'https://acme.com.br' });
  assert.match(captureNote(c.info), /contato@acme.com.br/);
  const p = suggestFromPage({ url: 'https://www.linkedin.com/in/ana-ribeiro', title: 'Ana Ribeiro - Head de Crédito - Banco X | LinkedIn' });
  assert.equal(p.object, 'people');
  assert.equal(p.values.name, 'Ana Ribeiro');
  assert.equal(p.values.cargo, 'Head de Crédito');
  assert.equal(suggestFromPage({ url: 'chrome://extensions' }).ok, false);
});

test('captura trata retorno da página como texto e limita tamanho', () => {
  const r = suggestFromPage({ url: 'https://x.io', title: '<img src=x onerror=alert(1)>' + 'a'.repeat(500) });
  assert.ok(r.info.title.length <= 200);
  assert.equal(typeof r.values.name, 'string');
});

test('Claude: monta pedido com saída estruturada e devolve spec que o validador aceita', async () => {
  let sent;
  const fake = () => ({ beta: { messages: { create: async (body) => { sent = body; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ title: 'Negócios grandes', object: 'deals', type: 'table', columns: ['name', 'valor'], groupBy: null, card: [], filters: [{ field: 'valor', op: '>=', value: 200000 }], sort: null }) }] }; } } } });
  const spec = await generateWithClaude('negócios grandes', schema, { apiKey: 'chave-de-teste', model: 'claude-opus-5-5' }, fake);
  assert.equal(sent.output_config.format.type, 'json_schema');
  assert.equal(sent.fallbacks, 'default');
  assert.ok(!('tool_choice' in sent));
  assert.deepEqual(sent.output_config.format.schema.properties.object.enum, ['companies', 'people', 'deals']);
  const v = validateSpec(spec, schema);
  assert.ok(v.ok);
  assert.equal(v.spec.generator, 'claude');
  assert.equal(applySpec(SEED_RECORDS.deals, v.spec).length, 3);
});

test('Claude: erros viram mensagens tratáveis', async () => {
  const failing = (status) => () => ({ beta: { messages: { create: async () => { const e = new Error('x'); e.status = status; throw e; } } } });
  await assert.rejects(generateWithClaude('x', schema, { apiKey: 'k' }, failing(401)), (e) => e instanceof ClaudeGeneratorError && e.kind === 'auth');
  await assert.rejects(generateWithClaude('x', schema, { apiKey: '' }), (e) => e.kind === 'config');
  const refusal = () => ({ beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } });
  await assert.rejects(generateWithClaude('x', schema, { apiKey: 'k' }, refusal), (e) => e.kind === 'refusal');
});

test('JSON Schema enviado ao modelo é estrito', () => {
  const js = specJsonSchema(schema);
  assert.equal(js.additionalProperties, false);
  assert.deepEqual(js.required.sort(), Object.keys(js.properties).sort());
});
