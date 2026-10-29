// Gerador de telas com Claude (opcional, chave do próprio usuário).
// O modelo devolve uma spec JSON via saída estruturada; a spec ainda passa por validateSpec no chamador.
import { VIEW_TYPES, OPS } from './spec.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const ANTHROPIC_ORIGIN = 'https://api.anthropic.com/*';

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });

export function specJsonSchema(schema) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'object', 'type', 'columns', 'groupBy', 'card', 'filters', 'sort'],
    properties: {
      title: { type: 'string', description: 'Título curto da tela, em português' },
      object: { type: 'string', enum: Object.keys(schema) },
      type: { type: 'string', enum: VIEW_TYPES },
      columns: { type: 'array', items: { type: 'string' }, description: 'IDs de campos (tabela). Vazio para kanban.' },
      groupBy: nullable({ type: 'string' }),
      card: { type: 'array', items: { type: 'string' }, description: 'IDs de campos mostrados no cartão (kanban). Vazio para tabela.' },
      filters: {
        type: 'array', description: 'Até 3 filtros combinados com E. Vazio quando não há filtro.',
        items: {
          type: 'object', additionalProperties: false, required: ['field', 'op', 'value'],
          properties: { field: { type: 'string' }, op: { type: 'string', enum: OPS }, value: { anyOf: [{ type: 'string' }, { type: 'number' }] } }
        }
      },
      sort: nullable({
        type: 'object', additionalProperties: false, required: ['field', 'dir'],
        properties: { field: { type: 'string' }, dir: { type: 'string', enum: ['asc', 'desc'] } }
      })
    }
  };
}

export function buildSystemPrompt(schema) {
  const objs = Object.entries(schema).map(([id, o]) => ({
    object: id, label: o.label,
    fields: o.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, ...(f.options ? { options: f.options } : {}) }))
  }));
  return [
    'Você compõe telas de um CRM. Responda só com a spec JSON pedida, usando apenas objetos e IDs de campo que existem no schema abaixo.',
    'Tipos de tela: "table" (usa columns, sempre começando por "name") e "kanban" (usa groupBy com um campo do tipo select, status, stage, user ou ref, e card).',
    'Filtros: lista de até 3 {field, op, value}, combinados com E. Valores monetários em reais como número (150 mil = 150000). Para "abertos", use o estágio diferente do último estágio.',
    'Use null em groupBy ou sort quando não se aplicam, e [] em columns, card ou filters quando não se aplicam.',
    'Schema: ' + JSON.stringify(objs)
  ].join('\n');
}

export class ClaudeGeneratorError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

// clientFactory permite injetar um cliente falso nos testes; em produção carrega o SDK empacotado.
export async function generateWithClaude(prompt, schema, settings, clientFactory) {
  if (!settings.apiKey) throw new ClaudeGeneratorError('Informe sua chave da API da Anthropic nas configurações.', 'config');
  const client = clientFactory
    ? clientFactory(settings)
    : new (await import('../vendor/anthropic.js')).default({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60_000 });

  let res;
  try {
    res = await client.beta.messages.create({
      model: settings.model || DEFAULT_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: specJsonSchema(schema) } },
      system: buildSystemPrompt(schema),
      messages: [{ role: 'user', content: prompt }]
    });
  } catch (e) {
    const status = e?.status;
    if (status === 401) throw new ClaudeGeneratorError('Chave da API recusada (401). Confira nas configurações.', 'auth');
    if (status === 429) throw new ClaudeGeneratorError('Limite de uso da API atingido (429). Tente de novo em instantes.', 'rate');
    if (status && status >= 500) throw new ClaudeGeneratorError('A API da Anthropic está instável agora.', 'server');
    if (status) throw new ClaudeGeneratorError(`A API recusou o pedido (${status}).`, 'request');
    throw new ClaudeGeneratorError('Sem conexão com a API da Anthropic.', 'network');
  }
  if (res.stop_reason === 'refusal') throw new ClaudeGeneratorError('O modelo recusou este pedido.', 'refusal');
  if (res.stop_reason === 'max_tokens') throw new ClaudeGeneratorError('Resposta incompleta do modelo.', 'truncated');
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let spec;
  try { spec = JSON.parse(text); } catch { throw new ClaudeGeneratorError('O modelo não devolveu um JSON válido.', 'parse'); }
  return { ...spec, generated: true, generator: 'claude', prompt };
}
