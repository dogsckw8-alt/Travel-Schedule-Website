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

// 取得全域設定，若 window.CONFIG 不存在則給予預設空物件
const config = window.CONFIG || { GAS_API_URL: "" };

function initTravelApp() {
  if (!config.GAS_API_URL) {
    console.warn("[App Notice] 偵測到尚未設定 GAS_API_URL，已自動切換為本地 Mock Data 模式。");
    
    // 直接使用您在 index.html 宣告的 window.mockTravelData
    if (window.mockTravelData) {
      renderApp(window.mockTravelData);
    } else {
      console.error("[App Error] 找不到 window.mockTravelData 資料！");
    }
    return;
  }

  // 如果有填寫 GAS_API_URL，才去遠端 Fetch 資料
  fetchDataFromGAS(config.GAS_API_URL);
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
