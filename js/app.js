import { CONFIG } from './config.js';
import { 
  renderApp, 
  renderTimeline, 
  openDetailModal, 
  popModalHistory, 
  openTransportModal, 
  openLightbox, 
  closeLightbox, 
  closeModal, 
  closeModalDirect 
} from './renderer.js';
import { runParserCheckpoint } from './parser.js';

/* ----------------------------------------------------
   全域應用狀態 (App State)
---------------------------------------------------- */
export let currentData = null;
export let selectedDayIndex = 0;
export let modalHistory = [];
export let currentModalItem = null;

export function setSelectedDayIndex(index) {
  selectedDayIndex = index;
}

export function setCurrentModalItem(item) {
  currentModalItem = item;
}

/* ----------------------------------------------------
   資料初始化與載入邏輯 (Data Initialization)
---------------------------------------------------- */
export function fetchLatestData() {
  const dotEl = document.getElementById('sync-dot');
  const textEl = document.getElementById('sync-text');

  // 1. 優先讀取 HTML 內嵌的 window.mockTravelData
  if (window.mockTravelData) {
    currentData = window.mockTravelData;
    // 確保 renderApp 存在再調用
    if (typeof renderApp === 'function') {
      renderApp(currentData);
    }
    if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
    if (textEl) textEl.textContent = "Mock 測試模式";
    console.log("✅ 成功載入 Mock Travel Data:", currentData);
    return;
  }

  console.warn("[App Warning] 找不到 window.mockTravelData");
}

/* ----------------------------------------------------
   用戶操作事件 (Controllers)
---------------------------------------------------- */
export function selectDay(index) {
  selectedDayIndex = index;
  if (typeof renderApp === 'function') {
    renderApp(currentData);
  }
}

/* ----------------------------------------------------
   安全地暴露給全域 (HTML onclick 綁定)
---------------------------------------------------- */
window.selectDay = selectDay;
window.openDetailModal = openDetailModal;
window.openTransportModal = openTransportModal;
window.closeModal = closeModal;
window.closeModalDirect = closeModalDirect;
window.popModalHistory = popModalHistory;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.fetchLatestData = fetchLatestData;
window.runParserCheckpoint = runParserCheckpoint;

// 頁面載入時執行
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', fetchLatestData);
} else {
  fetchLatestData();
}