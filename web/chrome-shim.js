// Demonstração web: imita as APIs do Chrome que o CRM usa, para rodar a mesma interface num site comum.
// Dados ficam no localStorage deste navegador. A captura de página usa uma página de exemplo fixa.
(function () {
  if (globalThis.chrome?.runtime?.id) return; // dentro da extensão de verdade, não faz nada
  globalThis.__CRM_WEB_DEMO = true;
  const PREFIX = 'crm-demo:';
  const listeners = { local: [], session: [] };
  const sessionMem = {};
  const read = (k) => { try { const v = localStorage.getItem(PREFIX + k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };
  const allKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
  const emit = (area, changes) => { if (Object.keys(changes).length) setTimeout(() => listeners[area].forEach((fn) => fn(changes, area)), 0); };
  const pick = (keys, getter, all) => {
    const list = keys == null ? all() : typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out = {};
    for (const k of list) { const v = getter(k); if (v !== undefined) out[k] = structuredClone(v); }
    return Promise.resolve(out);
  };
  const local = {
    get: (keys) => pick(keys, read, allKeys),
    set: (obj) => { const ch = {}; for (const [k, v] of Object.entries(obj)) { ch[k] = { oldValue: read(k), newValue: v }; localStorage.setItem(PREFIX + k, JSON.stringify(v)); } emit('local', ch); return Promise.resolve(); },
    remove: (keys) => { const ch = {}; for (const k of [].concat(keys)) { ch[k] = { oldValue: read(k) }; localStorage.removeItem(PREFIX + k); } emit('local', ch); return Promise.resolve(); },
    clear: () => local.remove(allKeys()),
    onChanged: { addListener: (fn) => listeners.local.push(fn) }
  };
  const session = {
    get: (keys) => pick(keys, (k) => sessionMem[k], () => Object.keys(sessionMem)),
    set: (obj) => { const ch = {}; for (const [k, v] of Object.entries(obj)) { ch[k] = { oldValue: sessionMem[k], newValue: v }; sessionMem[k] = v; } emit('session', ch); return Promise.resolve(); },
    remove: (keys) => { const ch = {}; for (const k of [].concat(keys)) { ch[k] = { oldValue: sessionMem[k] }; delete sessionMem[k]; } emit('session', ch); return Promise.resolve(); },
    onChanged: { addListener: (fn) => listeners.session.push(fn) }
  };
  // outras abas da demo: reflete mudanças feitas lá
  addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const k = e.key.slice(PREFIX.length);
    emit('local', { [k]: { oldValue: e.oldValue && JSON.parse(e.oldValue), newValue: e.newValue && JSON.parse(e.newValue) } });
  });
  const DEMO_PAGE = {
    url: 'https://nuvemcredito.example/sobre', title: 'Sobre nós | Nuvem Crédito', siteName: 'Nuvem Crédito', ogTitle: '',
    description: 'Plataforma de crédito para pequenas empresas com análise de risco em tempo real.', selection: '',
    emails: ['comercial@nuvemcredito.example']
  };
  const granted = new Set();
  globalThis.chrome = {
    storage: { local, session, onChanged: { addListener: (fn) => listeners.local.push(fn) } },
    runtime: { getURL: (p) => new URL(p.replace(/^src\//, ''), location.href).href },
    tabs: {
      query: async () => [{ id: 1, url: DEMO_PAGE.url }],
      create: async ({ url }) => { open(url, '_blank', 'noopener'); }
    },
    scripting: { executeScript: async () => [{ result: structuredClone(DEMO_PAGE) }] },
    permissions: {
      contains: async ({ origins = [] }) => origins.every((o) => granted.has(o)),
      request: async ({ origins = [] }) => { origins.forEach((o) => granted.add(o)); return true; },
      getAll: async () => ({ origins: [...granted] }),
      remove: async ({ origins = [] }) => { origins.forEach((o) => granted.delete(o)); return true; }
    },
    sidePanel: { setPanelBehavior: async () => {} }
  };
})();
