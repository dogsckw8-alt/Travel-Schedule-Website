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
  // 🧪 模擬測試資料 (Mock Data for Checkpoint 1 & UI Validation)
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
    },
    "restaurants": {
      "鳥貴族 秋葉原店": {
        "Type": "餐廳",
        "Rest.Type": "居酒屋",
        "District": "秋葉原",
        "AvgCost": "3000",
        "Tabelog評分": "3.45",
        "Hours": "17:00 - 05:00",
        "Comment": "平價美味的均一價居酒屋，人氣很高。",
        "Gmap_URL": "https://maps.google.com/?q=Torikizoku+Akihabara"
      }
    },
    "attractions": {
      "淺草寺 | 雷門與仲見世通": {
        "Type": "觀光景點",
        "District": "台東區",
        "AvgCost": "0",
        "Hours": "06:00 - 17:00",
        "Story": "東京最古老的寺廟，以巨大的紅燈籠「雷門」聞名於世。",
        "SubSpots": "09:00 雷門拍紀念照 [拍照熱點] | 09:30 仲見世通商店街吃人形燒 [美食,伴手禮] | 10:15 本堂參拜與求籤",
        "Gmap_URL": "https://maps.google.com/?q=Senso-ji"
      },
      "上野恩賜公園": {
        "Type": "觀光景點",
        "District": "台東區",
        "AvgCost": "0",
        "Hours": "05:00 - 23:00",
        "Story": "日本第一座公園，文化氣息濃厚，四季景色優美。",
        "Gmap_URL": "https://maps.google.com/?q=Ueno+Park"
      },
      "築地場外市場": {
        "Type": "美食景點",
        "District": "中央區",
        "AvgCost": "2500",
        "Hours": "05:00 - 14:00",
        "Story": "雖批發市場已搬遷，但場外市場依然保留了熱鬧的美食與海鮮小吃文化。",
        "Gmap_URL": "https://maps.google.com/?q=Tsukiji+Outer+Market"
      },
      "銀座商圈散策": {
        "Type": "購物休閒",
        "District": "中央區",
        "AvgCost": "5000",
        "Hours": "10:00 - 20:00",
        "Gmap_URL": "https://maps.google.com/?q=Ginza"
      },
      "箱根湯本溫泉旅館": {
        "Type": "住宿",
        "District": "箱根",
        "AvgCost": "18000",
        "BookingStatus": "已確認訂房",
        "Gmap_URL": "https://maps.google.com/?q=Hakone-Yumoto"
      }
    },
    "transport": {
      "淺草➔上野": {
        "From": "淺草",
        "To": "上野",
        "Line": "東京地鐵銀座線",
        "Time": "5 mins",
        "Fee": "¥180",
        "RouteTips": "搭乘銀座線直達，無需轉車。",
        "Timetable": "09:12, 09:18, **09:25**, 09:32"
      },
      "上野➔秋葉原": {
        "From": "上野",
        "To": "秋葉原",
        "Line": "JR山手線",
        "Time": "3 mins",
        "Fee": "¥150",
        "Timetable": "12:50, **12:58**, 13:05"
      },
      "築地➔銀座": {
        "From": "築地",
        "To": "銀座",
        "Line": "東京地鐵日比谷線",
        "Time": "3 mins",
        "Fee": "¥170",
        "Timetable": "11:45, **11:52**, 12:00"
      }
    }
  };

// 頁面初始化載入
window.addEventListener('DOMContentLoaded', fetchLatestData);
