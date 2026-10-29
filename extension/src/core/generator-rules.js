// Gerador de telas por regras: entende pedidos comuns em português e devolve uma spec
// (o mesmo formato que o gerador Claude devolve). A saída ainda passa por validateSpec.
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function parseNumber(raw, unit) {
  let n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  if (unit && /^(mil|k)$/.test(unit)) n *= 1000;
  else if (unit && /^(mi|milhao|milhoes)$/.test(unit)) n *= 1e6;
  return n;
}

export function generateWithRules(prompt, schema) {
  const p = norm(prompt);
  const objects = Object.keys(schema);
  const spec = { generated: true, generator: 'rules', prompt };

  const byWord = [
    ['deals', /negocio|deal|pipeline|oportunidad|venda|proposta/],
    ['people', /contato|pessoa|gente|decisor/],
    ['companies', /empresa|conta|cliente|organiza/]
  ];
  spec.object = (byWord.find(([o, re]) => objects.includes(o) && re.test(p)) || [])[0];
  if (!spec.object) {
    // objetos criados pelo usuário: casa pelo rótulo
    spec.object = objects.find((o) => p.includes(norm(schema[o].label).slice(0, 5))) || (objects.includes('deals') ? 'deals' : objects[0]);
  }
  const fields = schema[spec.object].fields;
  const fieldByWord = (txt) => fields.find((f) => f.id !== 'name' && (txt.includes(norm(f.label).split(/[\s(]/)[0]) || txt.includes(f.id)));

  spec.type = /kanban|quadro|board|colunas por|funil/.test(p) || (/pipeline/.test(p) && !/tabela|lista/.test(p)) ? 'kanban' : 'table';

  const porMatch = p.match(/\bpor\s+([a-z]+)/);
  const porField = porMatch ? fieldByWord(porMatch[1]) : null;
  if (spec.type === 'kanban') {
    if (/responsavel|analista|dono|vendedor/.test(p)) spec.groupBy = 'owner';
    else if (porField) spec.groupBy = porField.id;
    else spec.groupBy = (fields.find((f) => f.type === 'stage') || fields.find((f) => f.type === 'status') || {}).id || 'owner';
  } else {
    const mentioned = fields.filter((f) => f.id !== 'name' && p.includes(norm(f.label).split(/[\s(]/)[0])).map((f) => f.id);
    spec.columns = ['name', ...(mentioned.length >= 2 ? mentioned : fields.slice(1, 6).map((f) => f.id))];
  }

  const num = p.match(/(acima|mais|maior(?:es)?|superior(?:es)?)\s+(?:de|que|a)?\s*(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|mi|k)?/);
  const numBelow = p.match(/(abaixo|menos|menor(?:es)?|ate)\s+(?:de|que|a)?\s*(?:r\$\s*)?([\d.,]+)\s*(milhoes|milhao|mil|mi|k)?/);
  const moneyField = fields.find((f) => f.type === 'money');
  const stageField = fields.find((f) => f.type === 'stage');
  const statusField = fields.find((f) => f.type === 'status');
  const lastStage = stageField?.options?.[stageField.options.length - 1];

  const filters = [];
  if (num && moneyField) filters.push({ field: moneyField.id, op: '>=', value: parseNumber(num[2], num[3]) });
  else if (numBelow && moneyField) filters.push({ field: moneyField.id, op: '<=', value: parseNumber(numBelow[2], numBelow[3]) });
  if (/abert|em andamento|ativo/.test(p) && stageField && lastStage) filters.push({ field: stageField.id, op: '!=', value: lastStage });
  else if (/fechad|ganho/.test(p) && stageField && lastStage) filters.push({ field: stageField.id, op: '=', value: lastStage });
  // valor de opção citado no texto: "empresas clientes", "setor bancos"
  for (const f of fields) {
    if (f.type === 'stage' && filters.some((x) => x.field === f.id)) continue;
    const opt = (f.options || []).find((o) => new RegExp('\\b' + norm(o).replace(/s$/, '') + 's?\\b').test(p));
    if (opt) { filters.push({ field: f.id, op: '=', value: opt }); break; }
  }
  const owner = p.match(/\b(?:do|da|de)\s+([a-z]{3,})\b/);
  if (owner && ['jhonata', 'marina', 'rafael'].includes(owner[1]) && fields.some((f) => f.id === 'owner'))
    filters.push({ field: 'owner', op: '=', value: owner[1][0].toUpperCase() + owner[1].slice(1) });
  if (filters.length) spec.filters = filters.slice(0, 3);
  if (/acima|maior valor|mais valios|por valor|ranking/.test(p) && moneyField && spec.type === 'table') spec.sort = { field: moneyField.id, dir: 'desc' };
  if (spec.type === 'kanban' && moneyField) spec.card = ['name', fields.find((f) => f.type === 'ref')?.id, moneyField.id].filter(Boolean);
  if (statusField && spec.type === 'table' && spec.filters?.some((x) => x.field === statusField.id) && !spec.columns.includes(statusField.id)) spec.columns.push(statusField.id);

  const t = prompt.trim();
  spec.title = (t.length > 48 ? t.slice(0, 46) + '…' : t).replace(/^./, (c) => c.toUpperCase());
  return spec;
}
