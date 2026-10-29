// Service worker: só prepara o painel e os dados de exemplo. Nenhuma lógica de negócio mora aqui.
import { ensureSeeded } from './core/store.js';

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSeeded();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
