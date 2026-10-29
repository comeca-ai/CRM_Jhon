// Service worker: prepara o painel, os dados de exemplo e o item "Capturar no Decida Antes" do menu de contexto.
// O menu de contexto concede activeTab só para aquela aba e aquele momento, sem acesso permanente ao site.
import { ensureSeeded } from './core/store.js';
import { extractPageInfo } from './core/capture.js';

const MENU_ID = 'crm-capture';

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSeeded();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.create({ id: MENU_ID, title: 'Capturar no Decida Antes', contexts: ['page', 'selection'] }, () => void chrome.runtime.lastError);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// Lê a página e deixa o resultado em storage.session; o painel consome e abre o formulário.
export async function captureTab(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageInfo });
    await chrome.storage.session.set({ 'crm.pendingCapture': { at: Date.now(), result: res?.result ?? null } });
  } catch {
    await chrome.storage.session.set({ 'crm.pendingCapture': { at: Date.now(), error: 'Esta página não permite leitura por extensões.' } });
  }
}
globalThis.crmCaptureTab = captureTab; // usado pelo teste de ponta a ponta (o menu de contexto não é clicável por automação)

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {}); // precisa ocorrer ainda dentro do gesto do usuário
  captureTab(tab.id);
});
