import { WEEK_DAYS, WEEK_KEYS } from './config.js';
import { currentData, selectedDayIndex, modalHistory, currentModalItem, setSelectedDayIndex, setCurrentModalItem } from './app.js';
import { 
  getCleanSpotName, 
  parseDurationMins, 
  getBetweenSpotsTransport,
  calcDepartureTime, 
  formatMins, 
  formatFeeDisplay, 
  formatHoursDisplay,
  extractTargetClass, 
  parseTimetableList, 
  parseSubSpots, 
  getSubspotCheckKey,
  buildContinuousMapUrl, 
  calcMultiLegTime, 
  calcMultiLegFee,
  timeToMins, 
  getBestOpenTime, 
  parseCellContent, 
  getCardStatusBadge 
} from './parser.js';

/* ----------------------------------------------------
   UI 主渲染函式：渲染上方 Day 分頁標籤與時間軸
---------------------------------------------------- */
export function renderApp() {
  if (!currentData || !currentData.schedule || !currentData.schedule.days.length) {
    const container = document.getElementById('timeline-container');
    if (container) {
      container.innerHTML = '<div class="text-center text-slate-400 py-12 text-lg font-bold">尚無行程資料</div>';
    }
    return;
  }

  const days = currentData.schedule.days;
  const tabsNav = document.getElementById('day-tabs');
  
  if (tabsNav) {
    tabsNav.innerHTML = days.map((dayStr, idx) => {
      const dateObj = new Date(dayStr);
      const dateShort = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
      const weekDay = WEEK_DAYS[dateObj.getDay()] || '';
      const isSelected = idx === selectedDayIndex;

      return `
        <button onclick="selectDay(${idx})" class="flex-shrink-0 px-4 py-2 rounded-2xl flex flex-col items-center transition-all ${
          isSelected 
            ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/20 scale-105' 
            : 'bg-slate-900 border border-slate-800 text-slate-300 font-bold'
        }">
          <span class="text-xs tracking-wider opacity-80" style="font-variant-numeric: tabular-nums;">DAY ${idx + 1}</span>
          <span class="text-base font-black" style="font-variant-numeric: tabular-nums;">${dateShort}${weekDay}</span>
        </button>
      `;
    }).join('');
  }

  renderTimeline(days[selectedDayIndex]);
}

/* ----------------------------------------------------
   第一層：時間軸卡片渲染 (長輩友善 Bento Grid & Apple Wallet 焦點)
---------------------------------------------------- */
export function renderTimeline(currentDayKey) {
  console.log('正在渲染 Day:', currentDayKey);
  const container = document.getElementById('timeline-container');
  if (!container) return;

  const timeline = currentData.schedule.timeline;
  let dayItems = [];
  let fitnessInfo = null;

  if (Array.isArray(timeline)) {
    dayItems = timeline.filter(slot => slot.items && slot.items[currentDayKey]);
  } else if (timeline && typeof timeline === 'object') {
    const dayContent = timeline[currentDayKey];
    if (Array.isArray(dayContent)) {
      dayItems = dayContent;
    } else if (dayContent && typeof dayContent === 'object') {
      dayItems = dayContent.items || [];
      fitnessInfo = dayContent.fitness || null;
    }
  }

  if (dayItems.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-400 py-12 text-lg font-bold">☕ 本日尚無排定行程</div>';
    return;
  }

  // 💡 每日體能與步數預警看板 HTML (字體與高對比優化)
  let fitnessBannerHTML = '';
  if (fitnessInfo && fitnessInfo.summaryText) {
    let cardStyle = 'bg-emerald-950/50 border-emerald-700 text-emerald-200';
    if (fitnessInfo.status && fitnessInfo.status.includes('🔴')) {
      cardStyle = 'bg-rose-950/50 border-rose-700 text-rose-200';
    } else if (fitnessInfo.status && fitnessInfo.status.includes('🟡')) {
      cardStyle = 'bg-amber-950/50 border-amber-700 text-amber-200';
    }

    fitnessBannerHTML = `
      <div class="mb-5 p-4 rounded-
