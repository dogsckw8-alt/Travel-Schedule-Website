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
window.mockTravelData = {
      "status": "success",
      "updatedAt": "2026/12/13 下午 2:00:00",
      "schedule": {
        "days": ["2026-12-13", "2026-12-14", "2026-12-15"],
        "timeline": {
          "2026-12-13": {
            "items": [
              { "time": "09:00", "name": "淺草寺 | 雷門與仲見世通", "duration": 120, "departure": "11:00", "notice": "09:00開店 | 建議早訪避開人潮" },
              { "time": "11:00➔11:15", "name": "淺草➔上野", "duration": 15, "departure": "11:15", "notice": "" },
              { "time": "11:15", "name": "上野恩賜公園", "duration": 90, "departure": "12:45", "notice": "賞景散步" },
              { "time": "12:45➔13:00", "name": "上野➔秋葉原", "duration": 15, "departure": "13:00", "notice": "" },
              { "time": "13:00", "name": "鳥貴族 秋葉原店", "duration": 90, "departure": "14:30", "notice": "已預約午餐" }
            ],
            "fitness": {
              "status": "🟢",
              "summaryText": "🟢 輕鬆漫遊 | 預估步數: 5,420 步 | 總步行: 38 分鐘 (2.6 km)"
            }
          },
          "2026-12-14": {
            "items": [
              { "time": "10:00", "name": "築地場外市場", "duration": 100, "departure": "11:40", "notice": "🔥 建議 10:00 排隊品嚐海鮮丼" },
              { "time": "11:40➔12:00", "name": "築地➔銀座", "duration": 20, "departure": "12:00", "notice": "" },
              { "time": "12:00", "name": "銀座商圈散策", "duration": 150, "departure": "14:30", "notice": "步行購物" }
            ],
            "fitness": {
              "status": "🟡",
              "summaryText": "🟡 中度負荷 | 預估步數: 8,900 步 | 總步行: 65 分鐘 (4.5 km)"
            }
          },
          "2026-12-15": {
            "items": [
              { "time": "08:30", "name": "箱根湯本溫泉旅館", "duration": 120, "departure": "10:30", "notice": "退房並寄放行李" }
            ],
            "fitness": {
              "status": "🟢",
              "summaryText": "🟢 輕鬆漫遊 | 預估步數: 2,100 步 | 總步行: 15 分鐘 (1.0 km)"
            }
          }
        }
      }
    };

// 頁面初始化載入
window.addEventListener('DOMContentLoaded', fetchLatestData);
