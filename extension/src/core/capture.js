// Captura da página ativa, só quando o usuário clica em "Capturar página".
// extractPageInfo roda DENTRO da página (via chrome.scripting) e só devolve dados; tudo que volta é tratado como texto não confiável.
export function extractPageInfo() {
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
  const emails = [...document.querySelectorAll('a[href^="mailto:"]')]
    .map((a) => decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]).trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  return {
    url: location.href,
    title: document.title || '',
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    siteName: meta('meta[property="og:site_name"]'),
    ogTitle: meta('meta[property="og:title"]'),
    selection: String(window.getSelection?.() || '').trim(),
    emails: [...new Set(emails)].slice(0, 5)
  };
}

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// Normaliza o retorno da página (não confiável) e sugere tipo de registro + valores do formulário.
export function suggestFromPage(raw) {
  const info = {
    url: clip(raw?.url, 2000), title: clip(raw?.title, 200), description: clip(raw?.description, 500),
    siteName: clip(raw?.siteName, 120), ogTitle: clip(raw?.ogTitle, 200), selection: clip(raw?.selection, 500),
    emails: Array.isArray(raw?.emails) ? raw.emails.map((e) => clip(e, 120)).slice(0, 5) : []
  };
  let host = '';
  try { const u = new URL(info.url); if (!/^https?:$/.test(u.protocol)) throw 0; host = u.hostname.replace(/^www\./, ''); } catch { return { ok: false, reason: 'Esta página não pode ser capturada (só sites http/https).' }; }

  const isProfile = /(^|\.)linkedin\.com$/.test(host) && /\/in\//.test(info.url);
  const cleanTitle = (t) => t.split(/\s[|\-–—:·]\s/)[0].trim();
  if (isProfile) {
    const name = cleanTitle(info.ogTitle || info.title).replace(/\s*\(.*\)$/, '');
    const cargo = (info.title.split(/\s[-–—]\s/)[1] || '').trim();
    return { ok: true, info, host, object: 'people', values: { name: info.selection && info.selection.length < 60 ? info.selection : name, cargo, perfil: info.url, email: info.emails[0] || '' } };
  }
  const companyName = info.siteName || cleanTitle(info.ogTitle || info.title) || host;
  return { ok: true, info, host, object: 'companies', values: { name: info.selection && info.selection.length < 60 ? info.selection : companyName, site: `https://${host}` } };
}

export function captureNote(info) {
  const parts = [`Capturado de ${info.url}`];
  if (info.description) parts.push(info.description);
  if (info.emails?.length) parts.push('E-mails na página: ' + info.emails.join(', '));
  return parts.join(' — ');
}
