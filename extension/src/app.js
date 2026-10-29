// CRM Generativo — interface do painel lateral e da aba cheia.
import { h, clear, $ } from './dom.js';
import { loadAll, save, exportPayload, parseImport, resetAll } from './core/store.js';
import { validateSpec, applySpec, groupValues, describeFilter, displayValue, formatMoney, FIELD_TYPES, GROUPABLE } from './core/spec.js';
import { generateWithRules } from './core/generator-rules.js';
import { generateWithClaude, ClaudeGeneratorError, ANTHROPIC_ORIGIN, DEFAULT_MODEL } from './core/generator-claude.js';
import { track, ranking, suggestion } from './core/learning.js';
import { createRecord, updateField, addNote, relativeTime } from './core/records.js';
import { extractPageInfo, suggestFromPage, captureNote } from './core/capture.js';
import { validateState } from './core/validate-state.js';

const surface = new URLSearchParams(location.search).get('surface') || 'panel';
let S; // estado: schema, records, views, usage, settings
let activeId;
let lastFocus = null;
let returnFocus = null; // função que reencontra o elemento de origem se ele foi redesenhado

const field = (obj, id) => S.schema[obj]?.fields.find((f) => f.id === id);
const activeView = () => S.views.find((v) => v.id === activeId) || S.views[0];

// ---------- avisos ----------
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  clear(t, h('span', { text: msg }), action && h('button', { type: 'button', text: action.label, onclick: () => { t.classList.remove('show'); action.run(); } }));
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 7000 : 3800);
}

// ---------- persistência com uso agregado ----------
let usageTimer;
function signal(obj, fid) {
  S.usage = track(S.usage, obj, fid);
  clearTimeout(usageTimer);
  usageTimer = setTimeout(() => save('usage', S.usage), 400);
  renderLearning();
  renderBanners();
}

// ---------- navegação ----------
function setActive(id) {
  activeId = id;
  S.settings.lastView = id;
  save('settings', S.settings);
  render();
}

function removeView(v) {
  const idx = S.views.indexOf(v);
  S.views.splice(idx, 1);
  if (activeId === v.id) activeId = S.views[0]?.id;
  save('views', S.views);
  render();
  toast(`Tela "${v.title}" removida.`, { label: 'Desfazer', run: () => { S.views.splice(idx, 0, v); save('views', S.views); setActive(v.id); } });
}

function renderNav() {
  const base = $('#nav-base'), gen = $('#nav-gen'), chips = $('#chips');
  clear(base); clear(gen); clear(chips);
  const gens = S.views.filter((v) => v.generated);
  if (!gens.length) gen.append(h('div', { class: 'navempty', text: 'Nenhuma ainda. Peça uma na barra abaixo.' }));
  for (const v of S.views) {
    const cur = v.id === activeId;
    const item = h('button', { type: 'button', class: 'navitem', 'aria-current': cur ? 'true' : 'false', onclick: () => setActive(v.id) },
      h('span', { class: 'ic', 'aria-hidden': 'true', text: S.schema[v.object]?.icon || '•' }),
      h('span', { class: 'lbl', text: v.title }), v.generated && h('span', { class: 'tag', text: 'IA' }));
    (v.generated ? gen : base).append(item);
    const chip = h('span', { class: 'chip' + (v.generated ? '' : ' base') + (cur ? ' cur' : '') },
      h('button', { type: 'button', class: 'sel', 'aria-pressed': cur ? 'true' : 'false', onclick: () => setActive(v.id) },
        v.generated && h('span', { class: 'tag', text: 'IA' }), h('span', { text: v.title })),
      v.generated && h('button', { type: 'button', class: 'x', 'aria-label': `Remover tela ${v.title}`, text: '×', onclick: () => removeView(v) }));
    chips.append(chip);
  }
  chips.querySelector('.chip.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ---------- células ----------
function cell(f, v) {
  if (v == null || v === '') return h('span', { class: 'muted-cell', text: '—' });
  if (['status', 'stage'].includes(f.type)) {
    const opts = f.options || [];
    const last = opts[opts.length - 1];
    const cls = v === 'Cliente' || (f.type === 'stage' && v === last) ? 'g' : v === 'Perdido' ? 'b' : /Negocia/.test(v) ? 'w' : 'a';
    return h('span', { class: 'pill ' + cls, text: v });
  }
  if (f.type === 'user') return h('span', { class: 'pill', text: v });
  return document.createTextNode(displayValue(f, v));
}

// ---------- telas ----------
function renderTable(v, rows) {
  const fields = v.columns.map((id) => field(v.object, id)).filter(Boolean);
  const heat = Object.fromEntries(ranking(S.usage, v.object).map((x) => [x.field, x.n]));
  const head = h('tr', {}, fields.map((f) => {
    const sorted = v.sort?.field === f.id ? (v.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return h('th', { scope: 'col', 'aria-sort': sorted },
      h('button', { type: 'button', dataset: { f: f.id }, onclick: () => {
        signal(v.object, f.id);
        v.sort = { field: f.id, dir: v.sort?.field === f.id && v.sort.dir === 'asc' ? 'desc' : 'asc' };
        save('views', S.views); render();
      } }, f.label, sorted !== 'none' && (sorted === 'ascending' ? ' ↑' : ' ↓'), heat[f.id] && h('span', { class: 'heat', title: 'sinais de uso', text: '✦' + heat[f.id] })));
  }));
  const body = rows.map((r) => h('tr', { tabindex: '0', dataset: { id: r.id },
    onclick: (e) => { const td = e.target.closest('td'); if (td) signal(v.object, td.dataset.f); openRecord(v.object, r.id); },
    onkeydown: (e) => { if (e.key === 'Enter') openRecord(v.object, r.id); } },
    fields.map((f) => h('td', { dataset: { f: f.id } }, cell(f, r[f.id])))));
  return h('div', { class: 'tablewrap' }, h('table', {}, h('thead', {}, head), h('tbody', {}, body)));
}

function renderKanban(v, rows) {
  const gf = field(v.object, v.groupBy);
  const groups = groupValues(S.schema, v, rows);
  const money = S.schema[v.object].fields.find((f) => f.type === 'money');
  const wrap = h('div', { class: 'kanban' });
  let dragId = null;
  const cols = [...groups, ...(rows.some((r) => r[v.groupBy] == null || r[v.groupBy] === '') ? [null] : [])];
  for (const g of cols) {
    const items = rows.filter((r) => (g == null ? r[v.groupBy] == null || r[v.groupBy] === '' : r[v.groupBy] === g));
    const total = money ? items.reduce((s, r) => s + (Number(r[money.id]) || 0), 0) : 0;
    const col = h('section', { class: 'kcol', 'aria-label': `${gf.label}: ${g ?? 'sem valor'}` },
      h('h3', {}, h('span', { text: g ?? 'Sem ' + gf.label.toLowerCase() }), h('span', { text: `${items.length}${total ? ' · ' + formatMoney(total) : ''}` })),
      items.map((r) => {
        const fs = (v.card || []).filter((id) => id !== 'name').map((id) => field(v.object, id)).filter(Boolean);
        const sub = fs.filter((f) => f.type !== 'money').map((f) => r[f.id]).filter(Boolean).join(' · ');
        const m = fs.find((f) => f.type === 'money');
        return h('button', { type: 'button', class: 'kcard', draggable: 'true', dataset: { id: r.id },
          'aria-label': `${r.name}. ${gf.label}: ${g ?? 'sem valor'}. Enter abre o registro.`,
          onclick: () => { signal(v.object, v.groupBy); openRecord(v.object, r.id); },
          ondragstart: (e) => { dragId = r.id; e.dataTransfer.setData('text/plain', r.id); e.currentTarget.classList.add('dragging'); },
          ondragend: (e) => e.currentTarget.classList.remove('dragging') },
          h('b', { text: r.name }), sub && h('small', { text: sub }), m && r[m.id] != null && h('div', { class: 'val', text: formatMoney(r[m.id]) }));
      }));
    if (g != null) {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain') || dragId;
        moveRecord(v.object, id, v.groupBy, g);
      });
    }
    wrap.append(col);
  }
  return wrap;
}

async function moveRecord(obj, id, fid, value) {
  const list = S.records[obj];
  const i = list.findIndex((r) => r.id === id);
  if (i < 0 || list[i][fid] === value) return;
  list[i] = updateField(S.schema, obj, list[i], fid, value);
  signal(obj, fid);
  await save('records', S.records);
  render();
  toast(`${list[i].name} → ${value}`);
}

function renderCanvas() {
  const v = activeView();
  const canvas = $('#canvas');
  if (!v) { clear(canvas, h('div', { class: 'empty', text: 'Nenhuma tela. Descreva uma na barra abaixo.' })); return; }
  const all = S.records[v.object] || [];
  const rows = applySpec(all, v);
  $('#vtitle').textContent = v.title;
  $('#vtype').textContent = v.type === 'kanban' ? 'kanban' : 'tabela';
  $('#vgen').hidden = !v.generated;
  $('#vgen').textContent = v.generator === 'claude' ? 'gerada pelo Claude' : 'gerada pela IA';
  $('#vcount').textContent = `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`;
  document.title = `${v.title} · CRM Generativo`;
  if (!all.length) {
    clear(canvas, h('div', { class: 'empty' }, h('p', { text: `Ainda não há ${S.schema[v.object].label.toLowerCase()}.` }),
      h('div', { class: 'row', style: 'justify-content:center' }, h('button', { class: 'btn primary', type: 'button', text: 'Capturar página', onclick: capture }),
        h('button', { class: 'btn', type: 'button', text: 'Novo registro', onclick: () => openNew(v.object) }))));
    return;
  }
  clear(canvas, v.type === 'kanban' ? renderKanban(v, rows) : renderTable(v, rows),
    v.filters?.length && h('p', { class: 'foot', text: `Filtro: ${describeFilter(S.schema, v)} · ${rows.length} de ${all.length}` }),
    !rows.length && h('div', { class: 'empty', text: 'Nenhum registro atende ao filtro desta tela.' }));
}

// ---------- inspetor ----------
function renderSpec() {
  const v = activeView();
  const pre = $('#spec');
  if (!v) { clear(pre); return; }
  const ORDER = ['id', 'title', 'object', 'type', 'columns', 'groupBy', 'card', 'filters', 'sort', 'generator', 'prompt'];
  const shown = {};
  for (const k of ORDER) if (v[k] !== undefined) shown[k] = v[k];
  const json = JSON.stringify(shown, null, 2);
  // colore por tokens criando nós de texto (sem innerHTML)
  clear(pre);
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)/g;
  let last = 0, m;
  while ((m = re.exec(json))) {
    pre.append(json.slice(last, m.index));
    if (m[1]) pre.append(h('span', { class: m[2] ? 'k' : 's', text: m[1] }), m[2] || '');
    else pre.append(h('span', { class: 'n', text: m[3] }));
    last = re.lastIndex;
  }
  pre.append(json.slice(last));
  const w = $('#spec-warn');
  w.hidden = !v._warnings?.length;
  w.textContent = v._warnings?.length ? 'Validador: ' + v._warnings.join('; ') : '';
}

function renderLearning() {
  const v = activeView();
  const box = $('#learnbars');
  if (!v) return;
  const list = ranking(S.usage, v.object);
  if (!list.length) { clear(box, h('p', { class: 'muted', text: 'Sem sinais ainda para ' + S.schema[v.object].label.toLowerCase() + '.' })); return; }
  const max = list[0].n;
  clear(box, list.slice(0, 7).map((x) => h('div', { class: 'learnrow' },
    h('span', { class: 'fname', text: field(v.object, x.field)?.label || x.field }),
    h('span', { class: 'bar', style: `width:${Math.max(6, Math.round((x.n / max) * 120))}px` }),
    h('span', { class: 'cnt', text: String(x.n) }))));
}

// ---------- faixas: dados de exemplo e sugestão de aprendizado ----------
function renderBanners() {
  const box = $('#banners');
  clear(box);
  const v = activeView();
  if (S.settings.sampleData && Object.values(S.records).some((l) => l.some((r) => r.sample))) {
    box.append(h('div', { class: 'banner' }, h('span', { class: 'txt', text: 'Dados de exemplo.' }),
      h('button', { class: 'btn small', type: 'button', text: 'Limpar exemplos', onclick: clearSamples }),
      h('button', { class: 'btn small ghost', type: 'button', text: 'Manter', onclick: () => { S.settings.sampleData = false; save('settings', S.settings); renderBanners(); } })));
  }
  const sug = v && suggestion(v, S.usage, S.settings.dismissed);
  if (sug) {
    const top = field(v.object, sug.topField)?.label || sug.topField;
    box.append(h('div', { class: 'banner learn', role: 'region', 'aria-label': 'Sugestão de aprendizado' },
      h('span', { class: 'txt' }, 'Você usa mais ', h('b', { text: top }), '. Reordenar as colunas desta tela pelo seu uso?'),
      h('button', { class: 'btn small primary', type: 'button', text: 'Aplicar', onclick: () => {
        v.columns = sug.columns; save('views', S.views); render(); toast('Colunas reordenadas pelo seu uso. A spec mudou no inspetor.');
      } }),
      h('button', { class: 'btn small ghost', type: 'button', text: 'Agora não', onclick: () => {
        S.settings.dismissed = { ...S.settings.dismissed, [v.id]: sug.total }; save('settings', S.settings); renderBanners();
      } })));
  }
}

async function clearSamples() {
  for (const k of Object.keys(S.records)) S.records[k] = S.records[k].filter((r) => !r.sample);
  S.usage = {};
  S.settings.sampleData = false;
  await Promise.all([save('records', S.records), save('usage', S.usage), save('settings', S.settings)]);
  render();
  toast('Dados de exemplo removidos. Comece capturando uma página.');
}

function render() {
  if (!S.views.find((v) => v.id === activeId)) activeId = S.views[0]?.id;
  renderNav(); renderCanvas(); renderSpec(); renderLearning(); renderBanners();
}

// ---------- diálogos (gaveta/folhas) ----------
function openSheet(labelText, build, refocus) {
  closeSheet();
  lastFocus = document.activeElement;
  returnFocus = refocus || null;
  const titleId = 'sheet-title';
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) closeSheet(); } }, sheet);
  build(sheet, titleId);
  $('#layer').append(scrim);
  $('#app').inert = true; $('#cmd').inert = true;
  (sheet.querySelector('[autofocus]') || sheet.querySelector('input,select,textarea,button'))?.focus();
}
function closeSheet() {
  const layer = $('#layer');
  if (!layer.firstChild) return;
  clear(layer);
  $('#app').inert = false; $('#cmd').inert = false;
  const target = lastFocus?.isConnected ? lastFocus : returnFocus?.();
  (target || $('#canvas')).focus();
  returnFocus = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#layer').firstChild) { e.preventDefault(); closeSheet(); } });

function sheetHeader(title, titleId, sub) {
  return [h('header', {}, h('h2', { id: titleId, text: title }), h('button', { class: 'btn', type: 'button', 'aria-label': 'Fechar', text: '✕', onclick: closeSheet })),
    sub && h('div', { class: 'sub', text: sub })];
}

function inputFor(obj, f, value, onCommit) {
  const id = 'f-' + f.id;
  let input;
  if (f.options?.length) {
    input = h('select', { id }, h('option', { value: '', text: '—' }), f.options.map((o) => h('option', { value: o, text: o, selected: o === value })));
    if (value && !f.options.includes(value)) input.append(h('option', { value, text: value, selected: true }));
  } else if (f.type === 'ref') {
    const listId = 'dl-' + f.id;
    input = h('input', { id, value: value ?? '', list: listId, maxlength: '200' });
    input._extra = h('datalist', { id: listId }, (S.records[f.ref] || []).map((r) => h('option', { value: r.name })));
  } else {
    const type = { email: 'email', url: 'url', date: 'date', money: 'text', number: 'text', percent: 'text' }[f.type] || 'text';
    const shown = value == null ? '' : f.type === 'money' ? Number(value).toLocaleString('pt-BR') : String(value);
    input = h('input', { id, type, value: shown, maxlength: '2000', inputmode: ['money', 'number', 'percent'].includes(f.type) ? 'decimal' : null });
  }
  if (onCommit) {
    const commit = () => onCommit(input.value);
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.tagName === 'INPUT') { e.preventDefault(); input.blur(); } });
  }
  return h('div', { class: 'field' }, h('label', { for: id, text: f.label }), input, input._extra);
}

const KIND = { created: 'criado', capture: 'captura', change: 'edição', note: 'nota' };

function openRecord(obj, id) {
  const rec = () => S.records[obj].find((r) => r.id === id);
  if (!rec()) return;
  openSheet('', (sheet, titleId) => {
    const draw = () => {
      const r = rec();
      const focusId = document.activeElement?.id;
      clear(sheet,
        sheetHeader(r.name, titleId, `${S.schema[obj].singular} · atualizado ${relativeTime(r.updatedAt)}`),
        S.schema[obj].fields.map((f) => inputFor(obj, f, r[f.id], async (val) => {
          try {
            const i = S.records[obj].findIndex((x) => x.id === id);
            const next = updateField(S.schema, obj, S.records[obj][i], f.id, val);
            if (next === S.records[obj][i]) return;
            S.records[obj][i] = next;
            signal(obj, f.id);
            await save('records', S.records);
            draw(); renderCanvas();
          } catch (e) { toast(e.message); draw(); }
        })),
        h('h3', { text: 'Nota' }),
        (() => {
          const ta = h('textarea', { id: 'note', 'aria-label': 'Nova nota', placeholder: 'Ex.: ligação com o decisor, próximos passos…', maxlength: '2000' });
          return [ta, h('div', { class: 'row end' }, h('button', { class: 'btn primary small', type: 'button', text: 'Adicionar nota', onclick: async () => {
            const i = S.records[obj].findIndex((x) => x.id === id);
            const next = addNote(S.records[obj][i], ta.value);
            if (next === S.records[obj][i]) { ta.focus(); return; }
            S.records[obj][i] = next;
            await save('records', S.records);
            draw(); toast('Nota adicionada à linha do tempo.');
          } }))];
        })(),
        h('h3', { text: 'Linha do tempo' }),
        h('ul', { class: 'tl' }, [...(r.timeline || [])].reverse().map((ev) => h('li', {},
          h('span', { class: 't', text: relativeTime(ev.t) }), h('span', { class: 'txt' }, h('span', { class: 'k', text: KIND[ev.kind] || ev.kind }), ev.text)))),
        h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn danger small', type: 'button', text: 'Excluir registro', onclick: () => deleteRecord(obj, id) })));
      if (focusId) document.getElementById(focusId)?.focus();
    };
    draw();
  }, () => document.querySelector(`#canvas [data-id="${CSS.escape(id)}"]`));
}

async function deleteRecord(obj, id) {
  const list = S.records[obj];
  const i = list.findIndex((r) => r.id === id);
  const [removed] = list.splice(i, 1);
  await save('records', S.records);
  closeSheet(); render();
  toast(`"${removed.name}" excluído.`, { label: 'Desfazer', run: async () => { list.splice(i, 0, removed); await save('records', S.records); render(); } });
}

function openNew(obj, values = {}, opts = {}) {
  openSheet('', (sheet, titleId) => {
    let current = obj;
    let noteText = opts.note || '';
    let noteEl = null;
    const objects = Object.keys(S.schema);
    const draw = () => {
      const vals = {};
      clear(sheet,
        sheetHeader(opts.title || 'Novo registro', titleId, opts.sub),
        h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tipo de registro' }, objects.map((o) => h('label', {},
          h('input', { type: 'radio', name: 'obj', value: o, checked: o === current, onchange: () => { current = o; draw(); } }), S.schema[o].singular || S.schema[o].label))),
        S.schema[current].fields.map((f) => { const row = inputFor(current, f, values[f.id]); vals[f.id] = row.querySelector('input,select'); return row; }),
        opts.capture && [h('h3', { text: 'Nota da captura' }),
          h('p', { class: 'hint', text: 'Entra na linha do tempo. Revise ou apague o que não quiser guardar.' }),
          (noteEl = h('textarea', { id: 'capture-note', 'aria-label': 'Nota da captura', maxlength: '2000', value: noteText, oninput: (e) => { noteText = e.target.value; } }))],
        h('p', { class: 'err', id: 'new-err', role: 'alert' }),
        h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: closeSheet }),
          h('button', { class: 'btn primary', type: 'button', text: 'Salvar', onclick: async () => {
            try {
              const data = Object.fromEntries(Object.entries(vals).map(([k, el]) => [k, el.value]));
              const capNote = noteText.trim().slice(0, 2000);
              const event = opts.capture ? { kind: 'capture', text: capNote || 'Capturado de página' } : { kind: 'created', text: 'Registro criado manualmente' };
              const rec = createRecord(S.schema, current, data, event);
              S.records[current].unshift(rec);
              await save('records', S.records);
              closeSheet();
              const view = S.views.find((v) => v.object === current && !v.filters?.length) || S.views.find((v) => v.object === current);
              if (view) setActive(view.id); else render();
              toast(`${S.schema[current].singular} "${rec.name}" salvo.`, { label: 'Abrir', run: () => openRecord(current, rec.id) });
            } catch (e) { $('#new-err').textContent = e.message; }
          } })));
      vals.name?.setAttribute('autofocus', '');
    };
    draw();
  });
}

// ---------- captura da página ativa ----------
// Ordem: tenta ler a página com o acesso que já existe (activeTab ao abrir o painel pelo ícone, ou site já liberado).
// Só se faltar acesso, pede a origem ao Chrome no próprio clique. O menu de contexto é o caminho sem acesso permanente.
const NO_ACCESS = /permission|Cannot access|cannot be scripted|must request permission/i;
const ALL_SITES = ['https://*/*', 'http://*/*'];

function openCaptureForm(raw, expectedOrigin) {
  const sug = suggestFromPage(raw);
  if (!sug.ok) return toast(sug.reason);
  if (expectedOrigin && !sug.info.url.startsWith(expectedOrigin)) return toast('A aba mudou de página durante a captura. Tente de novo.');
  openNew(sug.object, sug.values, { title: 'Capturar página', sub: sug.host, capture: true, note: captureNote(sug.info) });
}

async function capture() {
  const btn = $('#btn-capture');
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return toast('Nenhuma aba ativa para capturar.');
    if (tab.url && !/^https?:/i.test(tab.url)) return toast('Páginas internas do Chrome não podem ser capturadas. Abra o site da empresa ou o perfil.');
    const run = () => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageInfo });
    let res;
    try { [res] = await run(); }
    catch (e) {
      if (!NO_ACCESS.test(String(e?.message))) throw e;
      // Sem "tabs", o painel não vê o endereço da aba; só dá para pedir acesso aos sites em geral.
      const origins = tab.url ? [new URL(tab.url).origin + '/*'] : ALL_SITES;
      if (await chrome.permissions.contains({ origins })) return toast('Esta página não permite leitura por extensões.');
      return askSiteAccess(origins, tab.url ? new URL(tab.url).hostname : null);
    }
    openCaptureForm(res?.result, tab.url ? new URL(tab.url).origin : null);
  } catch (e) {
    toast(NO_ACCESS.test(String(e?.message)) ? 'Esta página não permite leitura por extensões.' : 'Não foi possível capturar esta página.');
  } finally { btn.disabled = false; }
}

// Pede acesso num clique próprio do usuário: o Chrome só mostra o pedido de permissão durante um gesto.
function askSiteAccess(origins, host) {
  openSheet('', (sheet, titleId) => {
    clear(sheet,
      sheetHeader('Permitir leitura de páginas', titleId),
      h('p', { text: host
        ? `Para capturar, o CRM precisa ler ${host}.`
        : 'Para capturar, o CRM precisa ler os sites que você abrir. O Chrome vai pedir sua confirmação uma vez.' }),
      h('p', { class: 'hint', text: 'A leitura só acontece quando você clica em Capturar: título, descrição, texto selecionado e e-mails da página. Nada sai do seu navegador. Você pode revogar em Configurações.' }),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', type: 'button', text: 'Agora não', onclick: closeSheet }),
        h('button', { class: 'btn primary', type: 'button', id: 'btn-allow-sites', text: 'Permitir e capturar', onclick: () => {
          chrome.permissions.request({ origins }).then((ok) => {
            closeSheet();
            if (!ok) return toast('Sem permissão para ler páginas. Nada foi capturado.');
            toast('Acesso liberado. Você pode revogar em Configurações.');
            capture();
          }, () => { closeSheet(); toast('O Chrome não abriu o pedido de permissão. Tente de novo.'); });
        } })),
      h('p', { class: 'hint', text: 'Prefere não liberar? Clique com o botão direito na página e escolha "Capturar esta página no CRM". Assim o acesso vale só para aquela vez.' }));
  }, () => $('#btn-capture'));
}

// Captura iniciada pelo menu de contexto (o service worker deixa o resultado em storage.session).
async function consumePendingCapture() {
  const { 'crm.pendingCapture': pend } = await chrome.storage.session.get('crm.pendingCapture');
  if (!pend) return;
  await chrome.storage.session.remove('crm.pendingCapture');
  if (Date.now() - pend.at > 120000) return;
  if (pend.error) return toast(pend.error);
  openCaptureForm(pend.result, null);
}

// ---------- geração de telas ----------
async function generate(prompt) {
  const form = $('#cmd'), go = $('#cmd-go');
  form.setAttribute('aria-busy', 'true'); go.disabled = true; go.textContent = 'Gerando…';
  let raw, note = '';
  try {
    if (S.settings.generator === 'claude') {
      try { raw = await generateWithClaude(prompt, S.schema, S.settings); }
      catch (e) {
        if (!(e instanceof ClaudeGeneratorError)) throw e;
        note = ` (${e.message} Usei o gerador por regras.)`;
        raw = generateWithRules(prompt, S.schema);
      }
    } else raw = generateWithRules(prompt, S.schema);
    delete raw.id; // id sempre gerado aqui, nunca vindo do gerador
    const res = validateSpec(raw, S.schema);
    if (!res.ok) { toast('Não consegui montar essa tela: ' + res.errors.join('; ')); return; }
    const spec = res.spec;
    if (res.errors.length) spec._warnings = res.errors;
    S.views.push(spec);
    await save('views', S.views);
    $('#cmd-input').value = '';
    setActive(spec.id);
    const what = spec.type === 'kanban' ? `kanban de ${S.schema[spec.object].label.toLowerCase()} por ${field(spec.object, spec.groupBy)?.label.toLowerCase()}` : `tabela de ${S.schema[spec.object].label.toLowerCase()}`;
    toast(`Tela gerada: ${what}.${note}`);
  } finally {
    form.removeAttribute('aria-busy'); go.disabled = false; go.textContent = 'Gerar tela';
  }
}

// ---------- configurações ----------
function openSettings() {
  openSheet('', (sheet, titleId) => {
    const draw = () => {
      const st = S.settings;
      const key = h('input', { class: 'inp', id: 'api-key', type: 'password', value: st.apiKey || '', autocomplete: 'off', placeholder: 'sk-ant-…', 'aria-describedby': 'key-hint' });
      const model = h('input', { class: 'inp', id: 'model', value: st.model || DEFAULT_MODEL, maxlength: '80' });
      let schemaObj = Object.keys(S.schema)[0];
      const schemaBox = h('div', { class: 'box' });
      const drawSchema = () => {
        const o = S.schema[schemaObj];
        const label = h('input', { class: 'inp', id: 'nf-label', placeholder: 'Ex.: Origem do lead', maxlength: '40' });
        const type = h('select', { class: 'inp', id: 'nf-type' }, FIELD_TYPES.filter((t) => !['ref', 'stage', 'status'].includes(t)).map((t) => h('option', { value: t, text: TYPE_LABEL[t] || t })));
        const opts = h('input', { class: 'inp', id: 'nf-opts', placeholder: 'Opções separadas por vírgula (para lista)', maxlength: '300' });
        const err = h('p', { class: 'err', role: 'alert' });
        clear(schemaBox,
          h('div', { class: 'row' }, h('label', { for: 'schema-obj', class: 'hint', text: 'Objeto' }),
            h('select', { class: 'inp', id: 'schema-obj', style: 'width:auto', onchange: (e) => { schemaObj = e.target.value; drawSchema(); } },
              Object.keys(S.schema).map((k) => h('option', { value: k, text: S.schema[k].label, selected: k === schemaObj })))),
          h('ul', { class: 'fieldlist' }, o.fields.map((f) => h('li', {}, h('span', { text: f.label }), h('span', { class: 'ty', text: TYPE_LABEL[f.type] || f.type }),
            f.custom && h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `Remover campo ${f.label}`, text: '×', onclick: async () => {
              o.fields = o.fields.filter((x) => x !== f);
              S.views = S.views.map((v) => v.object === schemaObj ? (validateSpec(v, S.schema).spec || v) : v);
              await Promise.all([save('schema', S.schema), save('views', S.views)]);
              drawSchema(); render();
            } })))),
          h('h3', { text: 'Novo campo' }),
          h('label', { for: 'nf-label', class: 'sr-only', text: 'Nome do campo' }), label,
          h('label', { for: 'nf-type', class: 'sr-only', text: 'Tipo do campo' }), type,
          h('label', { for: 'nf-opts', class: 'sr-only', text: 'Opções' }), opts, err,
          h('div', { class: 'row end' }, h('button', { class: 'btn primary small', type: 'button', text: 'Adicionar campo', onclick: async () => {
            const name = label.value.trim();
            if (!name) { err.textContent = 'Dê um nome ao campo.'; return; }
            let id = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'campo';
            while (o.fields.some((f) => f.id === id)) id += '_2';
            const f = { id, label: name, type: type.value, custom: true };
            if (type.value === 'select') {
              f.options = opts.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);
              if (!f.options.length) { err.textContent = 'Lista precisa de pelo menos uma opção.'; return; }
            }
            o.fields.push(f);
            for (const v of S.views) if (v.object === schemaObj && v.type === 'table' && v.columns.length < 8) v.columns.push(id);
            await Promise.all([save('schema', S.schema), save('views', S.views)]);
            drawSchema(); render();
            toast(`Campo "${name}" criado em ${o.label}. A IA já pode usá-lo nas telas.`);
          } })));
      };
      drawSchema();
      const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', onchange: async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        e.target.value = '';
        try {
          if (file.size > 5 * 1024 * 1024) throw new Error('Arquivo grande demais (limite de 5 MB).');
          const data = parseImport(await file.text()); // já validado por completo; nada foi gravado ainda
          const before = exportPayload(S);
          Object.assign(S, data); // gerador, modelo e chave continuam os deste navegador
          await Promise.all(['schema', 'records', 'views', 'usage'].map((k) => save(k, S[k])));
          activeId = S.views[0].id;
          closeSheet(); render();
          toast('Backup importado.', { label: 'Desfazer', run: async () => {
            Object.assign(S, { schema: before.schema, records: before.records, views: before.views, usage: before.usage });
            await Promise.all(['schema', 'records', 'views', 'usage'].map((k) => save(k, S[k]))); render();
          } });
        } catch (er) { toast(er.message); }
      } });
      const sitesBox = h('ul', { class: 'fieldlist', id: 'sites' });
      chrome.permissions.getAll().then(({ origins = [] }) => {
        const list = origins.filter((o) => !o.includes('*://*'));
        if (!list.length) return clear(sitesBox, h('li', { class: 'hint', text: 'Nenhum site liberado. A captura pelo menu de contexto não deixa acesso permanente.' }));
        const label = (o) => ({ 'https://*/*': 'Todos os sites (https)', 'http://*/*': 'Todos os sites (http)' })[o] || o.replace(/\/\*$/, '');
        clear(sitesBox, list.map((o) => h('li', {}, h('span', { text: label(o) }),
          h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `Revogar acesso a ${label(o)}`, text: 'Revogar', onclick: async () => {
            const ok = await chrome.permissions.remove({ origins: [o] }).catch(() => false);
            toast(ok ? 'Acesso revogado.' : 'Não foi possível revogar (permissão obrigatória do pacote).');
            draw();
          } }))));
      });
      clear(sheet,
        sheetHeader('Configurações', titleId),
        h('h3', { text: 'Gerador de telas' }),
        h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Gerador de telas' },
          [['rules', 'Regras (local)'], ['claude', 'Claude (sua chave)']].map(([v, l]) => h('label', {}, h('input', { type: 'radio', name: 'gen', value: v, checked: st.generator === v, onchange: async () => {
            if (v === 'claude') {
              const ok = await chrome.permissions.request({ origins: [ANTHROPIC_ORIGIN] }).catch(() => false);
              if (!ok) { toast('Sem permissão para falar com api.anthropic.com. Mantive o gerador por regras.'); draw(); return; }
            }
            st.generator = v; await save('settings', st); draw();
          } }), l))),
        st.generator === 'claude' && h('div', { class: 'box' },
          h('label', { for: 'api-key', class: 'hint', text: 'Chave da API da Anthropic' }), key,
          h('p', { class: 'hint', id: 'key-hint', text: 'Fica só neste navegador (armazenamento local da extensão) e é enviada apenas para api.anthropic.com. Nunca entra no backup.' }),
          h('label', { for: 'model', class: 'hint', text: 'Modelo' }), model,
          h('div', { class: 'row end' }, h('button', { class: 'btn primary small', type: 'button', text: 'Salvar', onclick: async () => {
            st.apiKey = key.value.trim(); st.model = model.value.trim() || DEFAULT_MODEL; await save('settings', st); toast('Configuração do Claude salva.');
          } }))),
        h('p', { class: 'hint', text: 'Qualquer que seja o gerador, a tela nasce como spec JSON e passa pelo validador antes de aparecer.' }),
        h('h3', { text: 'Schema (objetos e campos)' }), schemaBox,
        h('h3', { text: 'Sites com acesso' }), sitesBox,
        h('h3', { text: 'Dados' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', text: 'Exportar JSON', onclick: () => {
            const blob = new Blob([JSON.stringify(exportPayload(S), null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `crm-generativo-${new Date().toISOString().slice(0, 10)}.json` });
            a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          } }),
          h('label', { class: 'btn small', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } }, text: 'Importar JSON' }), fileIn,
          h('button', { class: 'btn small danger', type: 'button', text: 'Restaurar exemplo', onclick: async () => {
            const backup = exportPayload(S);
            await resetAll(); S = await loadAll(); activeId = S.views[0].id; closeSheet(); render();
            toast('Dados restaurados para o exemplo.', { label: 'Desfazer', run: async () => {
              Object.assign(S, { schema: backup.schema, records: backup.records, views: backup.views, usage: backup.usage });
              await Promise.all(['schema', 'records', 'views', 'usage'].map((k) => save(k, S[k]))); render();
            } });
          } })),
        h('p', { class: 'hint', text: 'Tudo fica no armazenamento local deste navegador. Nada é enviado a servidores, exceto o pedido de tela ao Claude quando você liga esse gerador.' }));
    };
    draw();
  });
}
const TYPE_LABEL = { text: 'texto', number: 'número', money: 'dinheiro', percent: 'percentual', select: 'lista', status: 'status', stage: 'estágio', user: 'pessoa', ref: 'referência', email: 'e-mail', url: 'link', date: 'data' };

// ---------- início ----------
function showRecovery(err) {
  clear(document.body, h('main', { class: 'sheet', style: 'width:100%;box-shadow:none', role: 'alert' },
    h('h2', { text: 'Os dados salvos do CRM estão inválidos' }),
    h('p', { class: 'hint', text: String(err?.message || err) }),
    h('p', { text: 'Você pode restaurar os dados de exemplo para voltar a usar o CRM. Os dados atuais serão substituídos.' }),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', text: 'Restaurar exemplo', onclick: async () => { await resetAll(); location.reload(); } }))));
}

async function init() {
  const raw = await loadAll();
  try { S = { ...validateState(raw), settings: raw.settings }; }
  catch (e) { showRecovery(e); return; }
  activeId = S.settings.lastView && S.views.some((v) => v.id === S.settings.lastView) ? S.settings.lastView : S.views[0]?.id;
  if (surface === 'tab') $('#btn-full').hidden = true;
  $('#btn-full').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('src/app.html?surface=tab') }));
  $('#btn-capture').addEventListener('click', capture);
  $('#btn-new').addEventListener('click', () => openNew(activeView()?.object || 'companies'));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#insp-toggle').addEventListener('click', (e) => {
    const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
    e.currentTarget.setAttribute('aria-expanded', String(open));
    $('#inspector').classList.toggle('open', open);
  });
  $('#cmd').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#cmd-input').value.trim(); if (q) generate(q); });
  chrome.storage.session.onChanged.addListener((ch) => { if (ch['crm.pendingCapture']?.newValue) consumePendingCapture(); });
  // mudanças feitas em outra superfície (painel ↔ aba cheia) refletem aqui
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || $('#layer').firstChild) return;
    const keys = Object.keys(changes).filter((k) => k.startsWith('crm.') && k !== 'crm.usage' && k !== 'crm.settings');
    if (!keys.length) return;
    let fresh;
    try { const raw = await loadAll(); fresh = { ...validateState(raw), settings: raw.settings }; } catch { return; }
    const bare = (views) => views.map(({ _warnings, ...v }) => v);
    const same = JSON.stringify(fresh.schema) === JSON.stringify(S.schema) && JSON.stringify(fresh.records) === JSON.stringify(S.records)
      && JSON.stringify(bare(fresh.views)) === JSON.stringify(bare(S.views));
    if (!same) {
      const warn = Object.fromEntries(S.views.filter((v) => v._warnings).map((v) => [v.id, v._warnings]));
      S = { ...fresh, views: fresh.views.map((v) => (warn[v.id] ? { ...v, _warnings: warn[v.id] } : v)), settings: S.settings, usage: S.usage };
      render();
    }
  });
  try { render(); } catch (e) { showRecovery(e); return; }
  document.body.dataset.ready = '1';
  consumePendingCapture();
}
init().catch((e) => showRecovery(e));
