// Aprendizado de uso: cada interação com um campo vira sinal. O sistema só PROPÕE mudanças.
export const SUGGEST_AFTER = 5;

export function track(usage, obj, field) {
  const k = obj + '.' + field;
  return { ...usage, [k]: (usage[k] || 0) + 1 };
}

export function ranking(usage, obj) {
  return Object.entries(usage)
    .filter(([k]) => k.startsWith(obj + '.'))
    .map(([k, n]) => ({ field: k.slice(obj.length + 1), n }))
    .sort((a, b) => b.n - a.n);
}

export function totalSignals(usage, obj) {
  return ranking(usage, obj).reduce((s, x) => s + x.n, 0);
}

// Ordem proposta: "name" fixo primeiro, depois os campos por uso; campos sem uso mantêm a ordem atual.
export function proposedColumns(columns, usage, obj) {
  const rank = ranking(usage, obj).map((x) => x.field);
  const rest = columns.filter((c) => c !== 'name');
  const sorted = [...rest].sort((a, b) => {
    const ia = rank.indexOf(a), ib = rank.indexOf(b);
    return (ia === -1 ? 999 + rest.indexOf(a) : ia) - (ib === -1 ? 999 + rest.indexOf(b) : ib);
  });
  return columns.includes('name') ? ['name', ...sorted] : sorted;
}

// Sugestão só aparece com sinais suficientes, quando muda algo, e se não foi dispensada nesse patamar.
export function suggestion(view, usage, dismissed = {}) {
  if (view.type !== 'table') return null;
  const total = totalSignals(usage, view.object);
  if (total < SUGGEST_AFTER) return null;
  if (dismissed[view.id] != null && total < dismissed[view.id] + SUGGEST_AFTER) return null;
  const next = proposedColumns(view.columns, usage, view.object);
  if (next.join() === view.columns.join()) return null;
  const top = ranking(usage, view.object)[0];
  return { columns: next, topField: top.field, total };
}
