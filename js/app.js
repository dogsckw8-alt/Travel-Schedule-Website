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
   資料初始化與載入邏輯 (Data Initialization - 支援遠端安全驗證與自動降級)
---------------------------------------------------- */
export async function fetchLatestData() {
  const dotEl = document.getElementById('sync-dot');
  const textEl = document.getElementById('sync-text');

  // 1. 解析當前網址的 Query Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const trip = urlParams.get('trip');
  const key = urlParams.get('key');

  // 2. 如果網址沒有帶 trip 或 key，直接安全降級至 Mock 模式（方便本機開發測試）
  if (!trip || !key) {
    console.log("ℹ️ 網址未帶 trip 或 key 參數，自動切換至 Mock 測試模式。");
    loadMockDataMode("Mock 測試模式 (未帶授權參數)");
    return;
  }

  // 3. 顯示連線中狀態
  if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping";
  if (textEl) textEl.textContent = "遠端驗證中...";

  try {
    // ⚠️ 請將此處替換為你實際部署的 GAS 網關網址 (/exec)
    const GAS_WEB_APP_URL = `https://script.google.com/macros/s/AKfycbyFlwIFCfcbA3yj2NzoL7B0aC1AG3PKZiktkXRYXD1-Z0q_0vFFt1TA2CJFfHjVfjHG/exec?trip=${trip}&key=${key}`;
    
    const response = await fetch(GAS_WEB_APP_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const jsonResult = await response.json();
    
    // 4. 檢查 GAS 是否驗證成功並回傳資料
    if (jsonResult && (jsonResult.status === 'SUCCESS' || jsonResult.status === 'success')) {
      // 支援包裝在 jsonResult.data 或直接回傳的結構
      currentData = jsonResult.data || jsonResult;
      
      if (typeof renderApp === 'function') {
        renderApp(currentData);
      }
      
      if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
      if (textEl) textEl.textContent = `已同步 (${trip})`;
      console.log(`🌐 成功透過遠端安全驗證載入行程 [${trip}]:`, currentData);
      return;
    } else {
      // 驗證失敗（例如 key 錯誤或 trip 不對）
      throw new Error(jsonResult.message || "GAS 遠端驗證拒絕存取");
    }

  } catch (error) {
    console.warn("⚠️ 遠端 GAS 驗證失敗或連線異常，自動降級至 Mock 模式：", error.message);
    
    // 5. 發生錯誤時的降級防呆：轉成 Mock data 並在畫面上給予提示
    loadMockDataMode("授權失效/連線失敗 (已降級 Mock 模式)");
  }
}

/**
 * 內部輔助：載入 Mock 測試模式的統一函式
 */
function loadMockDataMode(statusLabel) {
  const dotEl = document.getElementById('sync-dot');
  const textEl = document.getElementById('sync-text');

  if (window.mockTravelData) {
    currentData = window.mockTravelData;
    if (typeof renderApp === 'function') {
      renderApp(currentData);
    }
    if (dotEl) dotEl.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
    if (textEl) textEl.textContent = statusLabel;
    console.log("✅ 成功載入 Mock Travel Data (Fallback Mode):", currentData);
  } else {
    console.error("❌ [App Error] 找不到 window.mockTravelData");
    if (textEl) textEl.textContent = "資料載入失敗";
  }
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
