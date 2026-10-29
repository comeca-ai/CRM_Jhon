// Contrato da spec de tela. validateSpec é a única porta de entrada para qualquer tela:
// gerador por regras, gerador Claude ou importação. A IA compõe dados; nunca código.
export const VIEW_TYPES = ['table', 'kanban'];
export const OPS = ['=', '!=', '>=', '<=', '>', '<', 'contains'];
export const GROUPABLE = ['select', 'status', 'stage', 'user', 'ref'];
export const NUMERIC = ['money', 'number', 'percent'];
export const FIELD_TYPES = ['text', 'number', 'money', 'percent', 'select', 'status', 'stage', 'user', 'ref', 'email', 'url', 'date'];

const isStr = (v) => typeof v === 'string';
const fieldOf = (schema, obj, id) => schema[obj]?.fields.find((f) => f.id === id);

export function validateSpec(input, schema) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['spec ausente'] };
  const obj = input.object;
  if (!isStr(obj) || !schema[obj]) return { ok: false, errors: [`objeto inexistente: ${String(obj)}`] };
  const type = VIEW_TYPES.includes(input.type) ? input.type : null;
  if (!type) return { ok: false, errors: [`tipo de tela inválido: ${String(input.type)}`] };
  const known = (id) => isStr(id) && !!fieldOf(schema, obj, id);

  const out = {
    id: isStr(input.id) && /^v-[\w-]{1,60}$/.test(input.id) ? input.id : 'v-gen-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: (isStr(input.title) && input.title.trim() ? input.title.trim() : schema[obj].label).slice(0, 80),
    object: obj, type,
    generated: !!input.generated
  };
  if (isStr(input.generator) && ['rules', 'claude', 'user'].includes(input.generator)) out.generator = input.generator;
  if (isStr(input.prompt)) out.prompt = input.prompt.slice(0, 300);

  if (type === 'table') {
    const cols = Array.isArray(input.columns) ? input.columns : [];
    const bad = cols.filter((c) => !known(c));
    if (bad.length) errors.push(`colunas ignoradas (não existem): ${bad.join(', ')}`);
    let good = [...new Set(cols.filter(known))];
    if (!good.includes('name')) good.unshift('name');
    out.columns = good.slice(0, 8);
  } else {
    const g = input.groupBy;
    const gf = known(g) ? fieldOf(schema, obj, g) : null;
    if (!gf || !GROUPABLE.includes(gf.type)) {
      const fallback = schema[obj].fields.find((f) => f.type === 'stage') || schema[obj].fields.find((f) => GROUPABLE.includes(f.type));
      if (!fallback) return { ok: false, errors: ['nenhum campo agrupável para kanban'] };
      if (g != null) errors.push(`agrupamento inválido (${String(g)}), usado ${fallback.id}`);
      out.groupBy = fallback.id;
    } else out.groupBy = g;
    const card = Array.isArray(input.card) ? input.card.filter(known) : [];
    out.card = card.length ? [...new Set(card)].slice(0, 4) : ['name', ...schema[obj].fields.filter((f) => f.id !== 'name' && f.id !== out.groupBy).slice(0, 2).map((f) => f.id)];
  }

  const rawFilters = Array.isArray(input.filters) ? input.filters : input.filter != null ? [input.filter] : [];
  const filters = [];
  for (const f of rawFilters.slice(0, 5)) {
    const ff = f && known(f.field) ? fieldOf(schema, obj, f.field) : null;
    if (!ff || !OPS.includes(f.op)) { errors.push('filtro descartado (campo ou operador inválido)'); continue; }
    let value = f.value;
    if (NUMERIC.includes(ff.type)) value = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.'));
    else value = value == null ? '' : String(value).slice(0, 120);
    if (NUMERIC.includes(ff.type) && !Number.isFinite(value)) errors.push('filtro descartado (valor não numérico)');
    else if (f.op === 'contains' && NUMERIC.includes(ff.type)) errors.push('filtro descartado ("contém" em campo numérico)');
    else if (filters.length < 3) filters.push({ field: ff.id, op: f.op, value });
  }
  if (filters.length) out.filters = filters;
  if (input.sort != null) {
    const s = input.sort;
    if (s && known(s.field) && ['asc', 'desc'].includes(s.dir)) out.sort = { field: s.field, dir: s.dir };
    else errors.push('ordenação descartada');
  }
  return { ok: true, spec: out, errors };
}

export function matchFilter(row, filter) {
  if (!filter) return true;
  const v = row[filter.field];
  const x = filter.value;
  switch (filter.op) {
    case '=': return String(v ?? '').toLowerCase() === String(x).toLowerCase();
    case '!=': return String(v ?? '').toLowerCase() !== String(x).toLowerCase();
    case '>=': return Number(v) >= x;
    case '<=': return Number(v) <= x;
    case '>': return Number(v) > x;
    case '<': return Number(v) < x;
    case 'contains': return String(v ?? '').toLowerCase().includes(String(x).toLowerCase());
    default: return true;
  }
}

export function applySpec(rows, spec) {
  const fs = spec.filters || (spec.filter ? [spec.filter] : []);
  let out = rows.filter((r) => fs.every((f) => matchFilter(r, f)));
  if (spec.sort) {
    const { field, dir } = spec.sort;
    const k = dir === 'desc' ? -1 : 1;
    out = [...out].sort((a, b) => {
      const x = a[field], y = b[field];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * k;
    });
  }
  return out;
}

export function groupValues(schema, spec, rows) {
  const f = fieldOf(schema, spec.object, spec.groupBy);
  const fromData = [...new Set(rows.map((r) => r[spec.groupBy]).filter((v) => v != null && v !== ''))];
  const base = f?.options?.length ? [...f.options] : [];
  for (const v of fromData) if (!base.includes(v)) base.push(v);
  return base;
}

export function describeFilter(schema, spec) {
  const fs = spec.filters || (spec.filter ? [spec.filter] : []);
  return fs.map((x) => {
    const f = fieldOf(schema, spec.object, x.field);
    const v = f && f.type === 'money' ? formatMoney(x.value) : x.value;
    const op = x.op === 'contains' ? 'contém' : x.op === '!=' ? '≠' : x.op;
    return `${f ? f.label : x.field} ${op} ${v}`;
  }).join(' e ');
}

export const formatMoney = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function displayValue(field, v) {
  if (v == null || v === '') return '—';
  if (field.type === 'money') return formatMoney(v);
  if (field.type === 'percent') return v + '%';
  if (field.type === 'url') return String(v).replace(/^https?:\/\//, '').replace(/\/$/, '');
  return String(v);
}
