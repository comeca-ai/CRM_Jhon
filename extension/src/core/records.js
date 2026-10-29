// Operações sobre registros, sempre registrando o que aconteceu na linha do tempo.
import { NUMERIC, displayValue } from './spec.js';

export const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PREFIX = { companies: 'c', people: 'p', deals: 'd' };

export function coerce(field, raw) {
  if (raw == null) return null;
  if (NUMERIC.includes(field.type)) {
    const s = String(raw).trim();
    if (!s) return null;
    const n = Number(s.replace(/[R$\s%]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const s = String(raw).trim().slice(0, 2000);
  if (field.type === 'url' && s && !/^https?:\/\//i.test(s)) return 'https://' + s;
  return s || null;
}

export function createRecord(schema, obj, values, event, now = Date.now()) {
  const rec = { id: newId(PREFIX[obj] || 'r'), createdAt: now, updatedAt: now, timeline: [] };
  for (const f of schema[obj].fields) {
    const v = coerce(f, values[f.id]);
    if (v != null) rec[f.id] = v;
  }
  if (!rec.name) throw new Error('O campo ' + schema[obj].fields[0].label + ' é obrigatório.');
  rec.timeline.push({ t: now, kind: event?.kind || 'created', text: event?.text || 'Registro criado' });
  return rec;
}

export function updateField(schema, obj, rec, fieldId, raw, now = Date.now()) {
  const f = schema[obj].fields.find((x) => x.id === fieldId);
  if (!f) return rec;
  const v = coerce(f, raw);
  if (fieldId === 'name' && !v) throw new Error('O nome não pode ficar vazio.');
  const before = rec[fieldId] ?? null;
  if (before === v) return rec;
  const next = { ...rec, updatedAt: now, timeline: [...(rec.timeline || [])] };
  if (v == null) delete next[fieldId]; else next[fieldId] = v;
  next.timeline.push({ t: now, kind: 'change', text: `${f.label}: ${displayValue(f, before)} → ${displayValue(f, v)}` });
  delete next.sample;
  return next;
}

export function addNote(rec, text, now = Date.now()) {
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return rec;
  return { ...rec, updatedAt: now, timeline: [...(rec.timeline || []), { t: now, kind: 'note', text: t }] };
}

export function relativeTime(t, now = Date.now()) {
  const d = Math.round((now - t) / 1000);
  if (d < 60) return 'agora';
  if (d < 3600) return Math.floor(d / 60) + ' min';
  if (d < 86400) return Math.floor(d / 3600) + ' h';
  if (d < 86400 * 7) return Math.floor(d / 86400) + ' d';
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
