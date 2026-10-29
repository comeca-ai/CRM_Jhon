// Validação estrita de um estado inteiro do CRM (backup importado ou armazenamento corrompido).
// Nada é gravado antes de passar por aqui; o resultado é um objeto novo, só com o que é permitido.
import { FIELD_TYPES, validateSpec } from './spec.js';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const OBJ_KEY = /^[a-z][a-z0-9_]{0,30}$/;
const FIELD_ID = /^[a-z0-9_]{1,30}$/;
const isPlain = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const str = (v, max) => typeof v === 'string' && v.length <= max;

export function validateSchema(schema) {
  if (!isPlain(schema)) throw new Error('Schema inválido.');
  const keys = Object.keys(schema);
  if (!keys.length || keys.length > 10) throw new Error('O schema precisa ter de 1 a 10 objetos.');
  const out = {};
  for (const k of keys) {
    const o = schema[k];
    if (!OBJ_KEY.test(k) || !isPlain(o)) throw new Error(`Objeto inválido no schema: ${k.slice(0, 30)}`);
    if (!str(o.label, 40) || !o.label.trim()) throw new Error(`Objeto ${k} sem rótulo válido.`);
    if (!Array.isArray(o.fields) || o.fields.length < 1 || o.fields.length > 40) throw new Error(`Objeto ${k} precisa ter de 1 a 40 campos.`);
    const ids = new Set();
    const fields = o.fields.map((f) => {
      if (!isPlain(f) || !FIELD_ID.test(f.id) || ids.has(f.id) || !str(f.label, 40) || !FIELD_TYPES.includes(f.type)) throw new Error(`Campo inválido em ${k}.`);
      ids.add(f.id);
      const nf = { id: f.id, label: f.label, type: f.type };
      if (f.options !== undefined) {
        if (!Array.isArray(f.options) || f.options.length > 30 || !f.options.every((x) => str(x, 60))) throw new Error(`Opções inválidas em ${k}.${f.id}.`);
        nf.options = [...f.options];
      }
      if (f.ref !== undefined) { if (!str(f.ref, 31)) throw new Error(`Referência inválida em ${k}.${f.id}.`); nf.ref = f.ref; }
      if (f.custom === true) nf.custom = true;
      return nf;
    });
    if (!ids.has('name')) throw new Error(`Objeto ${k} precisa de um campo "name".`);
    out[k] = { label: o.label, singular: str(o.singular, 40) ? o.singular : o.label, icon: str(o.icon, 2) ? o.icon : '•', fields };
  }
  for (const [k, o] of Object.entries(out)) for (const f of o.fields) if (f.ref && !Object.hasOwn(out, f.ref)) delete f.ref;
  return out;
}

function validateRecord(r, fields) {
  if (!isPlain(r) || !str(r.id, 60) || !r.id) throw new Error('Registro sem id válido.');
  const out = { id: r.id };
  for (const k of ['createdAt', 'updatedAt']) out[k] = Number.isFinite(r[k]) ? r[k] : Date.now();
  if (r.sample === true) out.sample = true;
  for (const f of fields) {
    const v = r[f.id];
    if (v == null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[f.id] = v;
    else if (str(v, 2000)) out[f.id] = v;
    else throw new Error(`Valor inválido em ${f.id}.`);
  }
  if (typeof out.name !== 'string' || !out.name) throw new Error('Registro sem nome.');
  const tl = Array.isArray(r.timeline) ? r.timeline.slice(-500) : [];
  out.timeline = tl.map((e) => {
    if (!isPlain(e) || !Number.isFinite(e.t) || !str(e.kind, 20) || !str(e.text, 4000)) throw new Error('Linha do tempo inválida.');
    return { t: e.t, kind: e.kind, text: e.text };
  });
  return out;
}

export function validateState(data) {
  const schema = validateSchema(data.schema);
  if (!isPlain(data.records)) throw new Error('Registros inválidos.');
  const records = {};
  for (const k of Object.keys(schema)) {
    const list = data.records[k] ?? [];
    if (!Array.isArray(list) || list.length > 20000) throw new Error(`Registros inválidos em ${k}.`);
    const seen = new Set();
    records[k] = list.map((r) => validateRecord(r, schema[k].fields)).filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
  }
  const views = [];
  const ids = new Set();
  for (const v of Array.isArray(data.views) ? data.views.slice(0, 200) : []) {
    const res = validateSpec(v, schema);
    if (!res.ok) continue;
    if (ids.has(res.spec.id)) res.spec.id = 'v-imp-' + Math.random().toString(36).slice(2, 10);
    ids.add(res.spec.id);
    views.push(res.spec);
  }
  if (!views.length) {
    for (const k of Object.keys(schema)) views.push(validateSpec({ id: 'v-' + k, title: schema[k].label, object: k, type: 'table', columns: schema[k].fields.slice(0, 5).map((f) => f.id) }, schema).spec);
  }
  const usage = {};
  if (isPlain(data.usage)) for (const [k, n] of Object.entries(data.usage).slice(0, 2000)) {
    const [o, f] = k.split('.');
    if (Object.hasOwn(schema, o) && Number.isFinite(n) && n >= 0) usage[`${o}.${f}`] = Math.min(Math.floor(n), 1e6);
  }
  return { schema, records, views, usage };
}
