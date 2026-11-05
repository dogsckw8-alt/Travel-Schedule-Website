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

// 提供給外部 (如 renderer) 修改與獲取 State 的 Setter/Getter 介面
export function setSelectedDayIndex(index) {
  selectedDayIndex = index;
}

export function setCurrentModalItem(item) {
  currentModalItem = item;
}

/* ----------------------------------------------------
   資料初始化與載入邏輯 (Data Initialization)
---------------------------------------------------- */
export async function fetchLatestData() {
  const dotEl = document.getElementById('sync-dot');
  const textEl = document.getElementById('sync-text');

  // 1. 開發階段：優先讀取 HTML 內嵌的 window.mockTravelData 進行本地測試
  if (window.mockTravelData) {
    currentData = window.mockTravelData;
    renderApp();
    if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
    if (textEl) textEl.textContent = "Mock 測試模式";
    console.log("✅ 成功載入 Mock Travel Data:", currentData);
    return;
  }

  // 2. 正式環境快取與 API 請求邏輯
  const cachedJSON = localStorage.getItem('travel_app_cache');
  if (cachedJSON) {
    try {
      currentData = JSON.parse(cachedJSON);
      renderApp();
      if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
      if (textEl) textEl.textContent = "已從快取載入";
    } catch (e) {
      console.error("解析本地快取失敗", e);
    }
  } else {
    if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping";
    if (textEl) textEl.textContent = "讀取中...";
  }

  // 若有設定真實 API URL 可在此處發起 fetch
}

function initTravelApp() {
  // 檢查是否有掛載 Mock Data，若無則啟用 Fallback 保護
  const data = window.mockTravelData || getDefaultFallbackData();
  
  if (!data) {
    console.error('[App Error] 找不到有效的旅遊資料，請確認 Mock Data 載入順序。');
    return;
  }

  // 執行首次渲染
  renderApp(data);
  console.log('[App Success] 應用程式初始化完成，可執行 runParserCheckpoint() 進行測試。');
}

function getDefaultFallbackData() {
  // 提供基本的結構化預設值，避免畫面完全卡死
  return { days: [], meta: { title: "Default Travel Data" } };
}

/* ----------------------------------------------------
   用戶操作事件 (Controllers)
---------------------------------------------------- */
export function selectDay(index) {
  selectedDayIndex = index;
  renderApp();
}

/* ----------------------------------------------------
   暴露給全域 (HTML onclick 綁定)
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
// 頁面初始化載入
window.addEventListener('DOMContentLoaded', fetchLatestData);
