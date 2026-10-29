// Persistência local. Toda leitura/escrita do CRM passa por aqui (chrome.storage.local).
import { SEED_SCHEMA, SEED_RECORDS, SEED_VIEWS, DEFAULT_SETTINGS } from './seed.js';
import { validateState, MAX_IMPORT_BYTES } from './validate-state.js';

export const KEYS = { schema: 'crm.schema', records: 'crm.records', views: 'crm.views', usage: 'crm.usage', settings: 'crm.settings' };
const clone = (x) => structuredClone(x);

export async function ensureSeeded() {
  const cur = await chrome.storage.local.get(KEYS.schema);
  const sc = cur[KEYS.schema];
  if (sc && typeof sc === 'object' && Object.keys(sc).length) return false;
  await chrome.storage.local.set({
    [KEYS.schema]: clone(SEED_SCHEMA), [KEYS.records]: clone(SEED_RECORDS), [KEYS.views]: clone(SEED_VIEWS),
    [KEYS.usage]: {}, [KEYS.settings]: clone(DEFAULT_SETTINGS)
  });
  return true;
}

export async function loadAll() {
  await ensureSeeded();
  const s = await chrome.storage.local.get(Object.values(KEYS));
  return {
    schema: s[KEYS.schema], records: s[KEYS.records] || { companies: [], people: [], deals: [] },
    views: s[KEYS.views] || [], usage: s[KEYS.usage] || {}, settings: { ...DEFAULT_SETTINGS, ...(s[KEYS.settings] || {}) }
  };
}

export async function save(part, value) {
  if (!KEYS[part]) throw new Error('Parte desconhecida: ' + part);
  await chrome.storage.local.set({ [KEYS[part]]: value });
}

export function exportPayload(state) {
  const { apiKey, ...settings } = state.settings; // a chave nunca sai no backup
  return { app: 'crm-generativo', version: 1, exportedAt: new Date().toISOString(),
    schema: state.schema, records: state.records, views: state.views, usage: state.usage, settings };
}

export function parseImport(text) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) throw new Error('Arquivo grande demais (limite de 5 MB).');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Arquivo não é um JSON válido.'); }
  if (!data || data.app !== 'crm-generativo') throw new Error('Arquivo não é um backup da extensão Decida Antes.');
  try { return validateState(data); } catch (e) { throw new Error('Backup recusado: ' + e.message); }
}

export async function resetAll() {
  await chrome.storage.local.remove(Object.values(KEYS));
  await ensureSeeded();
}
