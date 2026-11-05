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
   資料獲取與快取邏輯 (Data Fetching & Cache)
---------------------------------------------------- */
export async function fetchLatestData() {
  const dotEl = document.getElementById('sync-dot');
  const textEl = document.getElementById('sync-text');

  // 1. 優先讀取 localStorage 快取實現「秒開」
  const cachedJSON = localStorage.getItem(CONFIG.CACHE_KEY || 'travel_app_cache');
  if (cachedJSON) {
    try {
      currentData = JSON.parse(cachedJSON);
      renderApp();
      if (dotEl) dotEl.className = "w-3 h-3 rounded-full bg-emerald-400";
      if (textEl) textEl.textContent = "已從快取載入";
    } catch (e) {
      console.error("解析本地快取失敗", e);
    }
  } else {
    if (dotEl) dotEl.className = "w-3 h-3 rounded-full bg-amber-400 animate-ping";
    if (textEl) textEl.textContent = "讀取中...";
  }

  // 2. 背景非同步請求更新最新資料
  try {
    const res = await fetch(CONFIG.GAS_API_URL);
    const json = await res.json();
    if (json.status === 'success') {
      currentData = json;
      // 將最新資料存入 localStorage
      localStorage.setItem(CONFIG.CACHE_KEY || 'travel_app_cache', JSON.stringify(json));
      if (dotEl) dotEl.className = "w-3 h-3 rounded-full bg-emerald-400";
      if (textEl) textEl.textContent = "已同步";
      renderApp();
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    if (!cachedJSON) {
      if (dotEl) dotEl.className = "w-3 h-3 rounded-full bg-rose-500";
      if (textEl) textEl.textContent = "同步失敗";
    } else {
      if (textEl) textEl.textContent = "離線模式 (顯示快取)";
    }
    console.error(err);
  }
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

// 頁面初始化載入
window.addEventListener('DOMContentLoaded', fetchLatestData);
