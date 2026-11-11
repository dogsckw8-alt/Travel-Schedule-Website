import { WEEK_DAYS, WEEK_KEYS } from './config.js';
import { currentData, selectedDayIndex, modalHistory, currentModalItem, setSelectedDayIndex, setCurrentModalItem } from './app.js';
import { 
  getCleanSpotName, 
  parseDurationMins, 
  getSpotRestType,
  parseAvgCost,
  parseRatingInfo,
  getBetweenSpotsTransport,
  formatMins, 
  formatFeeDisplay, 
  formatHoursDisplay,
  parseSingleDayHours,
  extractTargetClass, 
  parseTimetableList, 
  parseSubSpots, 
  getSubspotCheckKey,
  toggleSubspotCheck,
  buildContinuousMapUrl, 
  calcMultiLegTime, 
  calcMultiLegFee,
  timeToMins, 
  getBestOpenTime, 
  parseCellContent, 
  getCardStatusBadge,
  calcDepartureTime 
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
          <span class="text-base font-black" style="font-variant-numeric: tabular-nums;">${dateShort} ${weekDay}</span>
        </button>
      `;
    }).join('');
  }

  renderTimeline(days[selectedDayIndex]);
}

/* ----------------------------------------------------
   第一層：時間軸卡片渲染 (Apple 雙軌優先級 Focus & Bento Grid v3.1)
---------------------------------------------------- */
export function renderTimeline(currentDayKey) {
  console.log('正在渲染 Day:', currentDayKey);
  const container = document.getElementById('timeline-container');
  if (!container) return;

  const timeline = currentData.schedule.timeline;
  let dayItems = [];
  let fitnessInfo = null;

  if (timeline && timeline[currentDayKey]) {
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

  // 💡 每日體能與步數預警看板 HTML
  let fitnessBannerHTML = '';
  if (fitnessInfo && fitnessInfo.summaryText) {
    let cardStyle = 'bg-emerald-950/50 border-emerald-700 text-emerald-200';
    if (fitnessInfo.status && fitnessInfo.status.includes('🔴')) {
      cardStyle = 'bg-rose-950/50 border-rose-700 text-rose-200';
    } else if (fitnessInfo.status && fitnessInfo.status.includes('🟡')) {
      cardStyle = 'bg-amber-950/50 border-amber-700 text-amber-200';
    }

    fitnessBannerHTML = `
      <div class="mb-5 p-4 rounded-2xl border ${cardStyle} shadow-lg flex items-center justify-between gap-3 backdrop-blur-sm relative z-20">
        <div class="flex items-center gap-3">
          <span class="text-3xl">🏃‍♂️</span>
          <div>
            <div class="text-xs font-black uppercase tracking-wider opacity-90">每日體能與步數預警看板</div>
            <div class="text-base font-black mt-0.5" style="font-variant-numeric: tabular-nums;">${fitnessInfo.summaryText}</div>
          </div>
        </div>
      </div>
    `;
  }

  const dateObj = new Date(currentDayKey);
  const weekKey = WEEK_KEYS[dateObj.getDay()] || '';

  // 💡 Apple 雙軌優先級 Focus 判定邏輯
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  let activeFocusIndex = -1;

  for (let i = 0; i < dayItems.length; i++) {
    const slot = dayItems[i];
    const startTimeStr = slot.time ? slot.time.split(/→|➔/)[0].trim() : '00:00';
    const startMins = timeToMins(startTimeStr);
    
    let endMins = startMins;
    if (slot.departure) {
      endMins = timeToMins(slot.departure);
    } else if (slot.duration) {
      endMins = startMins + Number(slot.duration);
    } else {
      endMins = startMins + 30;
    }

    if (currentMins >= startMins && currentMins <= endMins) {
      activeFocusIndex = i;
      break;
    }
  }

  if (activeFocusIndex === -1) {
    for (let i = 0; i < dayItems.length; i++) {
      const slot = dayItems[i];
      const startTimeStr = slot.time ? slot.time.split(/→|➔/)[0].trim() : '00:00';
      const startMins = timeToMins(startTimeStr);
      if (startMins > currentMins) {
        activeFocusIndex = i;
        break;
      }
    }
  }

  if (activeFocusIndex === -1 && dayItems.length > 0) {
    activeFocusIndex = dayItems.length - 1;
  }

  container.innerHTML = fitnessBannerHTML + dayItems.map((slot, idx) => {
    const rawName = slot.name || ''; 
    const isTransport = rawName.includes('→') || rawName.includes('➔');
    const isFocus = idx === activeFocusIndex;

    // 🚌 交通路線卡片渲染
    if (isTransport) {
      const cleanRoute = getCleanSpotName(rawName);
      const routeParts = cleanRoute.split(/→|➔/).map(p => p.trim());
      const isMultiLeg = routeParts.length > 2;

      const transInfo = findTransportInfo(cleanRoute, routeParts);

      let durationStr = isMultiLeg ? calcMultiLegTime(routeParts, findTransportInfo) : null;
      if (!durationStr) {
        durationStr = formatMins(transInfo.Time || transInfo.Duration);
      }

      let feeVal = transInfo.Fee;
      if (isMultiLeg) {
        const multiFee = calcMultiLegFee(routeParts, findTransportInfo);
        if (multiFee !== null) feeVal = multiFee;
      }

      const feeBadge = formatFeeDisplay(feeVal);
      const timetableRaw = transInfo.Timetable || transInfo['特定班次'] || transInfo.TimeTable || '';
      const targetTime = extractTargetClass(timetableRaw);
      const transTimes = slot.time.split(/→|➔/).map(t => t.trim());
      const transStart = transTimes[0] || slot.time;
      const transEnd = transTimes[1] || slot.departure || '';

      const targetBadge = targetTime
        ? `<span class="bg-rose-950/90 text-rose-300 border border-rose-600 px-3 py-1 rounded-lg text-sm font-black flex items-center gap-1 shadow-sm" style="font-variant-numeric: tabular-nums;">🎯 目標班次 ${targetTime}</span>`
        : '';

      const transportCardClasses = isFocus
        ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-400/10'
        : 'bg-slate-900 border-amber-500/40';

      return `
        <div class="flex items-start gap-3 relative z-10 my-2">
          <div class="w-14 pt-1 flex flex-col items-center flex-shrink-0 relative">
            <span class="text-lg font-black text-amber-400 bg-slate-900 px-1 py-0.5 rounded border border-amber-500/30 w-full text-center" style="font-variant-numeric: tabular-nums;">${transStart}</span>
            <span class="text-xl font-bold text-amber-400/90 my-0.5 inline-flex items-center justify-center w-full leading-none">↓</span>
            ${transEnd ? `<span class="text-lg font-black text-amber-400 bg-slate-900 px-1 py-0.5 rounded border border-amber-500/30 w-full text-center" style="font-variant-numeric: tabular-nums;">${transEnd}</span>` : ''}
          </div>
          
          <div onclick="openTransportModal('${cleanRoute}')" class="touch-card flex-1 ${transportCardClasses} p-4 rounded-2xl shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98]">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🚌</span>
                <div>
                  <h3 class="text-lg font-black text-amber-300 leading-snug">
                    ${routeParts.join(' ➔ ')}
                  </h3>
                  ${isMultiLeg ? `<span class="inline-block bg-indigo-950 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded mt-1 border border-indigo-800">轉乘路線</span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-800 text-sm font-bold text-slate-200">
              ${targetBadge}
              <span class="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-lg" style="font-variant-numeric: tabular-nums;">⏱️ ${durationStr}</span>
              ${feeBadge}
              ${transInfo.Line ? `<span class="bg-slate-800 text-slate-200 px-3 py-1 rounded-lg">🚇 ${transInfo.Line}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // ⛩️ 景點/餐廳/飯店卡片渲染 (雙時間點與精簡 Bento Grid)
    const cleanSpotName = getCleanSpotName(rawName);
    const parsedNotice = parseCellContent(slot);
    const { subTitle } = parsedNotice;

    const dbItem = (currentData.restaurants && currentData.restaurants[cleanSpotName]) || 
                   (currentData.attractions && currentData.attractions[cleanSpotName]) || {};

    const displayTime = parsedNotice.queueTime || slot.time;
    const statusBadge = getCardStatusBadge({ slotTime: slot.time, dbItem, parsedNotice, weekKey });

    const nextSlot = dayItems[idx + 1];
    const nextRawName = nextSlot ? nextSlot.name : null;
    const nextIsTransport = nextRawName ? (nextRawName.includes('→') || nextRawName.includes('➔')) : false;
    const isShortWalkToNext = nextSlot && !nextIsTransport;

    let shortWalkHTML = '';
    if (isShortWalkToNext) {
      const nextClean = getCleanSpotName(nextRawName);
      const matchedTrans = getBetweenSpotsTransport(currentData, cleanSpotName, nextClean);

      if (matchedTrans) {
        const durationStr = formatMins(matchedTrans.Time || matchedTrans.Duration);
        const lineInfo = matchedTrans.Line ? ` (${matchedTrans.Line})` : '';

        shortWalkHTML = `
          <div onclick="openTransportModal('${cleanSpotName}➔${nextClean}')" class="flex items-center justify-between bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 px-3.5 py-2.5 rounded-xl cursor-pointer transition my-1.5">
            <div class="flex items-center gap-2 text-slate-200 font-bold text-sm">
              <span class="text-amber-400 text-base">🚶</span>
              <span>移動至 <strong class="text-amber-300 font-extrabold text-sm">${nextClean}</strong>${lineInfo}</span>
            </div>
            <div class="flex items-center gap-2 font-bold flex-shrink-0">
              <span class="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg text-sm" style="font-variant-numeric: tabular-nums;">⏱️ 約 ${durationStr}</span>
            </div>
          </div>
        `;
      } else {
        shortWalkHTML = `
          <div class="flex items-center gap-2 pl-2 text-sm font-bold text-slate-400 py-1">
            <span class="w-2 h-2 rounded-full bg-slate-600 animate-ping"></span>
            <span>🚶 短程移動 / 徒步前往下一站（約 3 - 8 分鐘）</span>
          </div>
        `;
      }
    }

    const icon = getItemIcon(dbItem.Type || dbItem['Rest.Type'], cleanSpotName);
    const reservationBadge = getReservationBadge(dbItem.Res_Mode || dbItem.reservation || dbItem.BookingStatus);
    const subSpotsList = parseSubSpots(dbItem.SubSpots);
    
    const durationMins = slot.duration || parseDurationMins(dbItem.Duration);
    const departureTime = slot.departure || calcDepartureTime(slot.time, durationMins);

    // v3.1 新 Helper 取值
    const spotRestType = getSpotRestType(dbItem);
    const avgCostDisplay = parseAvgCost(dbItem);
    const ratingInfo = parseRatingInfo(dbItem);

    const spotCardClasses = isFocus
      ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-400/10'
      : 'bg-slate-900 border-slate-800';

    return `
      <div class="flex items-start gap-3 relative z-10 my-2">
        <div class="w-14 pt-1 flex flex-col items-center flex-shrink-0 relative">
          <span class="text-lg font-black text-amber-400 bg-slate-900 px-1 py-0.5 rounded border border-amber-500/30 w-full text-center" style="font-variant-numeric: tabular-nums;">${displayTime}</span>
          <span class="text-xl font-bold text-amber-400/90 my-0.5 inline-flex items-center justify-center w-full leading-none">↓</span>
          <span class="text-lg font-black text-amber-400 bg-slate-900 px-1 py-0.5 rounded border border-amber-500/30 w-full text-center" style="font-variant-numeric: tabular-nums;">${departureTime || '--:--'}</span>
        </div>

        <div class="flex-1 space-y-3">
          <div onclick="openDetailModal('${cleanSpotName}', '${displayTime}')" class="touch-card ${spotCardClasses} p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 active:scale-[0.98]">
            
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="text-lg md:text-xl font-black text-white leading-snug flex items-center gap-1.5">
                  <span>${icon}</span>
                  <span>${cleanSpotName}</span>
                </h2>
                ${subTitle ? `<p class="text-sm text-slate-300 mt-1 font-medium">${subTitle}</p>` : ''}
              </div>
            </div>

            <!-- Bento Grid 聚焦於預估消費與料理屬性 (v3.1) -->
            <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80">
              <div class="flex items-center gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <span class="text-lg">💰</span>
                <div>
                  <span class="text-xs text-slate-400 block font-bold">預估消費</span>
                  <span class="text-emerald-400 font-black text-sm block" style="font-variant-numeric: tabular-nums;">${avgCostDisplay}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <span class="text-lg">🏷️</span>
                <div>
                  <span class="text-xs text-slate-400 block font-bold">屬性 / 類型</span>
                  <span class="text-amber-400 font-black text-sm block">${spotRestType}</span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-slate-800/60">
              ${statusBadge}
              ${reservationBadge}
              ${subSpotsList.length > 0 ? `<span class="bg-indigo-950/90 border border-indigo-700/60 text-indigo-300 text-sm font-bold px-2.5 py-1 rounded-lg">🍡 包含 ${subSpotsList.length} 個子站點</span>` : ''}
            </div>

          </div>

          ${shortWalkHTML}
        </div>
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------
   順遊下一站小模組
---------------------------------------------------- */
export function renderNextStepModule(itemName, currentDayKey) {
  const timeline = currentData.schedule.timeline || {};
  let dayItems = [];

  if (timeline && timeline[currentDayKey]) {
    const dayContent = timeline[currentDayKey];
    if (Array.isArray(dayContent)) {
      dayItems = dayContent;
    } else if (dayContent && typeof dayContent === 'object') {
      dayItems = dayContent.items || [];
    }
  }

  const cleanTargetName = getCleanSpotName(itemName);
  const currentIdx = dayItems.findIndex(slot => getCleanSpotName(slot.name) === cleanTargetName);

  if (currentIdx === -1 || currentIdx >= dayItems.length - 1) {
    return `
      <div class="bg-slate-800/50 p-3.5 rounded-xl border border-slate-800 text-center text-sm text-slate-400 font-bold">
        🏁 此站為本日行程最終站
      </div>
    `;
  }

  const nextSlot = dayItems[currentIdx + 1];
  const nextRawName = nextSlot.name; 
  const isNextTransport = nextRawName.includes('→') || nextRawName.includes('➔');

  if (isNextTransport) {
    const cleanRoute = getCleanSpotName(nextRawName);
    return `
      <div class="bg-amber-950/30 border border-amber-800/60 p-4 rounded-2xl space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-amber-400 uppercase tracking-wider">⏭️ 順遊下一站（交通接駁）</span>
          <span class="text-xs font-bold text-slate-300" style="font-variant-numeric: tabular-nums;">⏰ ${nextSlot.time} 出發</span>
        </div>
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="font-black text-white text-base">🚌 ${cleanRoute}</div>
          <button onclick="openTransportModal('${cleanRoute}')" class="bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl shadow active:scale-95 transition">
            查看路線 ➔
          </button>
        </div>
      </div>
    `;
  } else {
    const nextCleanName = getCleanSpotName(nextRawName);
    const nextDbItem = (currentData.restaurants && currentData.restaurants[nextCleanName]) || 
                       (currentData.attractions && currentData.attractions[nextCleanName]) || {};
    const icon = getItemIcon(nextDbItem.Type || nextDbItem['Rest.Type'], nextCleanName);

    return `
      <div class="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-amber-400 uppercase tracking-wider">⏭️ 順遊下一站</span>
          <span class="text-xs font-bold text-slate-300" style="font-variant-numeric: tabular-nums;">⏰ ${nextSlot.time} 到達</span>
        </div>
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${icon}</span>
            <div>
              <div class="font-black text-white text-base leading-snug">${nextCleanName}</div>
              ${nextDbItem.District ? `<span class="text-xs font-bold text-slate-400">📍 ${nextDbItem.District}</span>` : ''}
            </div>
          </div>
          <button onclick="openDetailModal('${nextCleanName}', '${nextSlot.time}')" class="bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/30 text-xs font-black px-3.5 py-2 rounded-xl active:scale-95 transition">
            開啟卡片 ➔
          </button>
        </div>
      </div>
    `;
  }
}

/* ----------------------------------------------------
   第二層：景點/餐廳 Modal 彈窗
---------------------------------------------------- */
export function openDetailModal(itemName, slotTime = '', isBackNavigation = false) {
  const cleanName = getCleanSpotName(itemName);
  if (!isBackNavigation && currentModalItem && currentModalItem !== cleanName) {
    modalHistory.push({ name: currentModalItem, slotTime });
  }
  setCurrentModalItem(cleanName);

  const dbItem = (currentData.restaurants && currentData.restaurants[cleanName]) || 
                 (currentData.attractions && currentData.attractions[cleanName]) || {};

  const titles = parseTitles(cleanName, dbItem);
  const icon = getItemIcon(dbItem.Type || dbItem['Rest.Type'], cleanName);

  const currentDateStr = currentData.schedule.days[selectedDayIndex];
  const dateObj = new Date(currentDateStr);
  const weekKey = WEEK_KEYS[dateObj.getDay()]; // 例如 "週一" 或 "一"
  
  // 取得原始營業時間並透過 parser 過濾出當天營業時間
  const rawHours = dbItem[weekKey] || dbItem.Hours_summary || dbItem.Hours || '請參考官方說明';
  const todayHours = parseSingleDayHours(rawHours, weekKey);

  const itemType = (dbItem.Type || dbItem['Rest.Type'] || '').toLowerCase();
  const isRestaurant = itemType.includes('餐廳') || itemType.includes('燒肉') || itemType.includes('壽司') || itemType.includes('拉麵') || dbItem.Rating;
  const isHotel = itemType.includes('hotel') || itemType.includes('飯店') || itemType.includes('住宿') || cleanName.includes('HOTEL') || cleanName.includes('飯店');

  const durationMins = parseDurationMins(dbItem.Duration);
  const departureTime = calcDepartureTime(slotTime, durationMins);

  const backBtnContainer = document.getElementById('modal-back-btn-container');
  if (backBtnContainer) {
    if (modalHistory.length > 0) {
      const prev = modalHistory[modalHistory.length - 1];
      backBtnContainer.innerHTML = `
        <button onclick="popModalHistory()" class="text-sm text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition flex items-center gap-1">
          ⬅️ 返回 ${prev.name}
        </button>
      `;
    } else {
      backBtnContainer.innerHTML = '';
    }
  }

  const transitStepsEl = document.getElementById('modal-transit-steps');
  if (transitStepsEl) transitStepsEl.classList.add('hidden');

  const imageUrl = dbItem.ImageURL || dbItem.ImgURL || dbItem.ImgUrl || dbItem.imageUrl || dbItem.imgUrl || dbItem.Photo || dbItem.Pic || dbItem.Picture;

  const modalHeaderEl = document.getElementById('modal-header');
  if (modalHeaderEl) {
    modalHeaderEl.innerHTML = `
      ${imageUrl ? `
        <div class="overflow-hidden rounded-2xl mb-3 border border-slate-700 max-h-48 relative group cursor-pointer" onclick="openLightbox('${imageUrl}', '${titles.mainTitle}')">
          <img src="${imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${titles.mainTitle}" onerror="this.parentElement.style.display='none'">
          <div class="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-sm text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 font-bold">
            🔍 點擊全螢幕預覽
          </div>
        </div>
      ` : ''}
      <div class="flex items-center gap-2.5">
        <span class="text-3xl">${icon}</span>
        <div>
          <h2 class="text-2xl font-black text-white leading-tight">${titles.mainTitle}</h2>
          ${titles.subTitle ? `<p class="text-sm text-slate-300 font-medium mt-0.5">${titles.subTitle}</p>` : ''}
        </div>
      </div>
    `;
  }

  let gridHTML = `
    <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
      <p class="text-xs text-slate-400 font-bold">📍 所屬地區</p>
      <p class="text-base font-black text-white mt-0.5">${dbItem.District || '東京'}</p>
    </div>
    <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
      <p class="text-xs text-slate-400 font-bold">⏱️ 停留與預計離開</p>
      <p class="text-base font-black text-amber-300 mt-0.5" style="font-variant-numeric: tabular-nums;">${durationMins} mins ${departureTime ? `(${departureTime} 離開)` : ''}</p>
    </div>
  `;

  if (isHotel) {
    gridHTML += `
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🏨 類型</p>
        <p class="text-base font-black text-amber-300 mt-0.5">飯店 / 住宿</p>
      </div>
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 col-span-2">
        <p class="text-xs text-slate-400 font-bold">📌 預訂 / 入住狀態</p>
        <p class="text-base font-black text-emerald-400 mt-0.5">${dbItem.Res_Mode || dbItem.reservation || dbItem.BookingStatus || '已確認訂房'}</p>
      </div>
    `;
  } else if (isRestaurant) {
    const ratingInfo = parseRatingInfo(dbItem);
    gridHTML += `
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🕒 今日營業時間 (${weekKey})</p>
        <p class="text-base font-black text-amber-300 mt-0.5 whitespace-pre-line" style="font-variant-numeric: tabular-nums;">${formatHoursDisplay(todayHours)}</p>
      </div>
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🍳 料理類型</p>
        <p class="text-base font-black text-white mt-0.5">${getSpotRestType(dbItem)}</p>
      </div>
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">💰 平均消費</p>
        <p class="text-base font-black text-emerald-400 mt-0.5" style="font-variant-numeric: tabular-nums;">${parseAvgCost(dbItem)}</p>
      </div>
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 col-span-2">
        <p class="text-xs text-slate-400 font-bold">⭐ 評分資訊</p>
        <p class="text-base font-black text-amber-400 mt-0.5" style="font-variant-numeric: tabular-nums;">${ratingInfo.rating ? `評分: ${ratingInfo.rating}` : '高評價推薦'} ${ratingInfo.count ? `(評論數: ${ratingInfo.count})` : ''}</p>
      </div>
    `;
  } else {
    gridHTML += `
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🕒 開放 / 營業時間 (${weekKey})</p>
        <p class="text-base font-black text-amber-300 mt-0.5 whitespace-pre-line" style="font-variant-numeric: tabular-nums;">${formatHoursDisplay(todayHours)}</p>
      </div>
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🏷️ 類別</p>
        <p class="text-base font-black text-white mt-0.5">${dbItem.Type || '觀光景點'}</p>
      </div>
      <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 col-span-2">
        <p class="text-xs text-slate-400 font-bold">💰 預估費用</p>
        <p class="text-base font-black text-emerald-400 mt-0.5" style="font-variant-numeric: tabular-nums;">${parseAvgCost(dbItem)}</p>
      </div>
    `;
  }

  const modalGridEl = document.getElementById('modal-grid');
  if (modalGridEl) modalGridEl.innerHTML = gridHTML;

  const criticalTime = dbItem.CriticalTime;
  const queueLevel = dbItem.Queue_Level || dbItem.Level_of_Que;
  const planB = dbItem.Plan_B;
  const comment = dbItem.Comment;
  const storyText = dbItem.Story;
  const subSpots = parseSubSpots(dbItem.SubSpots);

  let alertHTML = '';

  if (criticalTime || queueLevel) {
    alertHTML += `
      <div class="bg-amber-500/10 border-l-4 border-amber-500 p-3.5 rounded-r-xl">
        <p class="text-xs font-bold text-amber-400 uppercase tracking-wider">⚠️ 關鍵時間與提醒</p>
        <p class="text-sm font-black text-amber-200 mt-1 whitespace-pre-line leading-relaxed">${criticalTime || ''} ${queueLevel ? `\n(排隊狀況: ${queueLevel})` : ''}</p>
      </div>
    `;
  }

  if (subSpots.length > 0) {
    alertHTML += `
      <div class="bg-indigo-950/40 border border-indigo-800/80 p-4 rounded-2xl space-y-3">
        <div class="flex items-center justify-between border-b border-indigo-800/60 pb-2">
          <p class="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>🗺️</span>
            <span>包含景點 / 散步路線微型時間軸 (${subSpots.length} 處)</span>
          </p>
          <span class="text-xs text-slate-400 font-bold">可勾選踩點進度</span>
        </div>
        
        <div class="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-500/40">
          ${subSpots.map((spot, i) => {
            const subDb = (currentData.restaurants && currentData.restaurants[spot.name]) || 
                          (currentData.attractions && currentData.attractions[spot.name]) || {};
            
            const hasDbData = Object.keys(subDb).length > 0;
            const subMapUrl = subDb.Gmap_URL || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name)}`;
            const subImgUrl = subDb.ImageURL;
            const isChecked = localStorage.getItem(getSubspotCheckKey(cleanName, spot.name)) === 'true';

            return `
              <div class="relative flex items-start justify-between gap-2 bg-slate-900/90 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition">
                <div class="absolute -left-[21px] top-3.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-slate-950"></div>

                <div class="flex items-start gap-2.5 flex-1">
                  <input type="checkbox" id="spot-chk-${i}" ${isChecked ? 'checked' : ''} onchange="toggleSubspotCheck('${cleanName}', '${spot.name}', this)" class="w-4 h-4 mt-1 accent-amber-400 rounded cursor-pointer flex-shrink-0">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      ${spot.time ? `<span class="text-xs font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30" style="font-variant-numeric: tabular-nums;">${spot.time}</span>` : ''}
                      <label id="subspot-label-${cleanName}-${spot.name}" for="spot-chk-${i}" class="text-sm font-black cursor-pointer leading-snug ${isChecked ? 'line-through text-slate-500' : 'text-slate-100'}">
                        ${spot.name}
                      </label>
                    </div>

                    ${spot.badges.length > 0 ? `
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        ${spot.badges.map(b => `<span class="bg-indigo-900/80 text-indigo-200 border border-indigo-700/60 text-xs font-bold px-2 py-0.5 rounded">${b}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
                
                <div class="flex items-center gap-1 flex-shrink-0">
                  <a href="${subMapUrl}" target="_blank" class="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md hover:bg-amber-500/20 transition flex items-center gap-0.5">📍 導航</a>
                  ${subImgUrl ? `<button onclick="openLightbox('${subImgUrl}', '${spot.name}')" class="text-xs text-sky-300 font-bold bg-sky-950/80 border border-sky-800 px-2.5 py-1 rounded-md flex items-center gap-0.5">🖼️ 看圖</button>` : ''}
                  ${hasDbData ? `<button onclick="openDetailModal('${spot.name}')" class="text-xs text-slate-300 font-bold bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md flex items-center gap-0.5">🔍 詳情</button>` : ''}
                </div>
              </div>
            `;
          }).join('')}

        </div>
      </div>
    `;
  }

  if (storyText) {
    alertHTML += `
      <div class="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-1">
        <p class="text-xs font-bold text-amber-400 flex items-center gap-1 uppercase tracking-wider">
          <span>📖</span> 景點背景與故事導覽
        </p>
        <p class="text-sm font-medium text-slate-200 leading-relaxed pt-1 whitespace-pre-line">${storyText}</p>
      </div>
    `;
  }

  if (comment) {
    alertHTML += `
      <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">📝 備註與說明</p>
        <p class="text-sm font-bold text-slate-200 mt-1 leading-relaxed whitespace-pre-line">${comment}</p>
      </div>
    `;
  }

  if (planB) {
    alertHTML += `
      <div class="bg-indigo-950/50 border border-indigo-800/80 p-4 rounded-xl">
        <p class="text-xs font-bold text-indigo-300 uppercase tracking-wider">💡 備案 (Plan B)</p>
        <p class="text-sm font-bold text-indigo-200 mt-1 whitespace-pre-line">${planB}</p>
      </div>
    `;
  }

  const nextStepHTML = renderNextStepModule(cleanName, currentDateStr);
  const modalAlertsEl = document.getElementById('modal-alerts');
  if (modalAlertsEl) modalAlertsEl.innerHTML = alertHTML + nextStepHTML;

  const mapUrl = dbItem.Gmap_URL || buildContinuousMapUrl(cleanName, subSpots);
  const menuUrl = dbItem.Menu_URL;

  const actionsEl = document.getElementById('modal-actions');
  if (actionsEl) {
    actionsEl.classList.remove('hidden');
    actionsEl.innerHTML = `
      <a href="${mapUrl}" target="_blank" class="flex-1 h-12 bg-amber-400 text-slate-950 font-black text-base rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition">
        <span>📍</span>
        <span>Google 地圖導航</span>
      </a>
      ${menuUrl ? `
        <a href="${menuUrl}" target="_blank" class="w-1/3 h-12 bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm rounded-xl flex items-center justify-center gap-1 active:scale-95 transition">
          <span>📖</span>
          <span>菜單</span>
        </a>
      ` : ''}
    `;
  }

  showModal();
}

export function popModalHistory() {
  if (modalHistory.length > 0) {
    const prev = modalHistory.pop();
    openDetailModal(prev.name, prev.slotTime, true);
  }
}

/* ----------------------------------------------------
   第二層：交通 Modal 彈窗
---------------------------------------------------- */
export function openTransportModal(fullRoute) {
  const routeParts = fullRoute.split(/→|➔/).map(p => p.trim());
  const isMultiLeg = routeParts.length > 2;

  const modalHeaderEl = document.getElementById('modal-header');
  if (modalHeaderEl) {
    modalHeaderEl.innerHTML = `
      <h2 class="text-2xl font-black text-white flex items-center gap-2">
        <span>🚌</span> 路線指南
      </h2>
      <p class="text-lg text-amber-400 font-extrabold mt-1">${routeParts.join(' ➔ ')}</p>
    `;
  }

  let segments = [];
  if (isMultiLeg) {
    for (let i = 0; i < routeParts.length - 1; i++) {
      const from = routeParts[i];
      const to = routeParts[i + 1];
      const info = findTransportInfo(`${from}➔${to}`, [from, to]);
      segments.push({ from, to, info });
    }
  } else {
    const from = routeParts[0];
    const to = routeParts[1] || '';
    const info = findTransportInfo(fullRoute, routeParts);
    segments.push({ from, to, info });
  }

  const stepsContainer = document.getElementById('modal-transit-steps');
  if (stepsContainer) {
    stepsContainer.classList.remove('hidden');
    stepsContainer.innerHTML = segments.map((seg, idx) => {
      const info = seg.info || {};
      const timeFormatted = formatMins(info.Time || info.Duration);
      const timetableRaw = info.Timetable || info['特定班次'] || info.TimeTable || '';
      const parsedTimetables = parseTimetableList(timetableRaw);

      const liveUrl = info.LiveUrl || info.Link2 || info['實時位置連結'];
      const routeTips = info.RouteTips || info['路線提示'];
      const videoUrl = info.VideoURL || info.Video;

      const timetablePic = info.timeTable_pic_url || info.TimeTable_Pic_URL;
      const timetableLink = info.TimeTable;

      let feeBadge = '';
      if (info.Fee !== undefined && info.Fee !== null && String(info.Fee).trim() !== '') {
        const feeStr = String(info.Fee).trim();
        if (feeStr === '0' || feeStr.toLowerCase().includes('pass') || feeStr.includes('免')) {
          feeBadge = `<span class="bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">🎫 Pass涵蓋 (¥0)</span>`;
        } else {
          const numMatch = feeStr.match(/\d+/);
          const val = numMatch ? numMatch[0] : feeStr;
          feeBadge = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1" style="font-variant-numeric: tabular-nums;">💰 ¥${val}</span>`;
        }
      }

      const defaultSegNav = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(seg.from)}&destination=${encodeURIComponent(seg.to)}`;
      const segNavUrl = info.Shortcut || defaultSegNav;

      return `
        <div class="space-y-3">
          <div class="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-3">
            <div class="flex justify-between items-center border-b border-slate-700/80 pb-2">
              <span class="text-xs font-black bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-md">第 ${idx + 1} 段移動</span>
              <div class="flex items-center gap-2">
                ${feeBadge}
                <span class="text-xs font-bold text-slate-300" style="font-variant-numeric: tabular-nums;">⏱️ ${timeFormatted}</span>
              </div>
            </div>

            <div class="text-lg font-black text-white mt-1">
              ${seg.from} <span class="text-amber-400">➔</span> ${seg.to}
            </div>

            ${info.Platform ? `
              <div class="text-sm text-amber-200 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg font-bold">
                🏣 乘車處/月台：${info.Platform}
              </div>
            ` : ''}

            ${info.Line ? `
              <div class="text-sm text-slate-200 font-bold">
                🚇 搭乘路線：<span class="text-white">${info.Line}</span>
              </div>
            ` : ''}

            ${parsedTimetables.length > 0 ? `
              <div class="pt-1">
                <p class="text-xs font-black text-slate-300 mb-2 flex items-center gap-1">⏰ 班次時刻對照表：</p>
                <div class="flex flex-wrap gap-2 items-center">
                  ${parsedTimetables.map(t => {
                    if (t.isTarget) {
                      return `<span class="bg-rose-950/90 border-2 border-rose-500 text-rose-300 text-sm font-black px-3 py-1 rounded-xl shadow-lg flex items-center gap-1 scale-105" style="font-variant-numeric: tabular-nums;">🎯 ${t.time}</span>`;
                    } else {
                      return `<span class="bg-slate-900/60 border border-slate-800 text-slate-400 opacity-60 text-xs font-semibold px-2.5 py-1 rounded-lg" style="font-variant-numeric: tabular-nums;">${t.time}</span>`;
                    }
                  }).join('')}
                </div>
              </div>
            ` : ''}

            ${(info.Remarks) ? `
              <div class="bg-rose-950/40 border-l-4 border-rose-500 p-3.5 rounded-r-xl">
                <p class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-0.5">⚠️ 乘車與票券注意事項</p>
                <p class="text-sm font-bold text-rose-200 leading-relaxed whitespace-pre-line">${info.Remarks}</p>
              </div>
            ` : ''}

            ${routeTips ? `
              <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700/80">
                <p class="text-sm font-black text-amber-400 mb-1 flex items-center gap-1">🚶 步行/防迷路文字指引</p>
                <p class="text-sm text-slate-100 leading-relaxed font-medium whitespace-pre-line">${routeTips}</p>
              </div>
            ` : ''}

            ${timetablePic ? `
              <div class="pt-1">
                <button onclick="openLightbox('${timetablePic}', '${seg.from} ➔ ${seg.to} 官方時刻表')" class="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-sm font-black rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow">
                  <span>📄</span>
                  <span>查看官方時刻表 (圖片)</span>
                </button>
              </div>
            ` : (timetableLink ? `
              <div class="pt-1">
                <a href="${timetableLink}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-sm font-black rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow">
                  <span>📄</span>
                  <span>開啟官方時刻表 (PDF / 官網)</span>
                </a>
              </div>
            ` : '')}

            ${videoUrl ? `
              <div class="pt-1">
                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 bg-sky-950/90 hover:bg-sky-900 border border-sky-700 text-sky-200 text-sm font-black rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow">
                  <span>🎬</span>
                  <span>觀看實景走法影片 (YouTube)</span>
                </a>
              </div>
            ` : ''}
          </div>

          <a href="${segNavUrl}" target="_blank" class="w-full h-12 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition shadow-lg my-2">
            <span>🗺️</span>
            <span>開啟 Google 路線導航</span>
          </a>
        </div>
      `;
    }).join('');
  }

  const modalGridEl = document.getElementById('modal-grid');
  const modalAlertsEl = document.getElementById('modal-alerts');
  const actionsEl = document.getElementById('modal-actions');

  if (modalGridEl) modalGridEl.innerHTML = '';
  if (modalAlertsEl) modalAlertsEl.innerHTML = '';
  if (actionsEl) {
    actionsEl.innerHTML = '';
    actionsEl.classList.add('hidden');
  }

  showModal();
}

/* ----------------------------------------------------
   Lightbox 全螢幕預覽控制
---------------------------------------------------- */
export function openLightbox(src, caption = '') {
  if (!src) return;
  const overlay = document.getElementById('lightbox-overlay');
  const img = document.getElementById('lightbox-img');
  const captionEl = document.getElementById('lightbox-caption');

  if (img) img.src = src;
  if (captionEl) captionEl.textContent = caption || '圖片預覽';

  if (overlay) {
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.remove('opacity-0');
      if (img) {
        img.classList.remove('scale-95');
        img.classList.add('scale-100');
      }
    }, 10);
  }
}

export function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  const img = document.getElementById('lightbox-img');

  if (overlay) overlay.classList.add('opacity-0');
  if (img) {
    img.classList.remove('scale-100');
    img.classList.add('scale-95');
  }

  setTimeout(() => {
    if (overlay) overlay.classList.add('hidden');
    if (img) img.src = '';
  }, 200);
}

/* ----------------------------------------------------
   Modal 彈窗顯示/關閉控制
---------------------------------------------------- */
export function showModal() {
  const overlay = document.getElementById('modal-overlay');
  const sheet = document.getElementById('modal-sheet');
  if (overlay && sheet) {
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.remove('opacity-0');
      sheet.classList.remove('translate-y-full');
    }, 10);
  }
}

export function closeModal(e) {
  if (e && e.target && e.target.id === 'modal-overlay') {
    closeModalDirect();
  }
}

export function closeModalDirect() {
  modalHistory.length = 0;
  setCurrentModalItem(null);
  
  const overlay = document.getElementById('modal-overlay');
  const sheet = document.getElementById('modal-sheet');
  
  if (sheet) sheet.classList.add('translate-y-full');
  if (overlay) overlay.classList.add('opacity-0');
  
  setTimeout(() => {
    if (overlay) overlay.classList.add('hidden');
  }, 200);
}

/* ----------------------------------------------------
   內部輔助小工具 (Helpers)
---------------------------------------------------- */
function findTransportInfo(fullRoute, routeParts) {
  if (!currentData || !currentData.transport) {
    console.warn("⚠️ 警告：currentData.transport 資料不存在或尚未載入！");
    return {};
  }
  const tMap = currentData.transport;

  if (tMap[fullRoute]) return tMap[fullRoute];

  const from = routeParts[0] ? routeParts[0].trim() : '';
  const to = routeParts[routeParts.length - 1] ? routeParts[routeParts.length - 1].trim() : '';

  if (tMap[`${from}➔${to}`]) return tMap[`${from}➔${to}`];
  if (tMap[`${from}→${to}`]) return tMap[`${from}→${to}`];

  for (const key in tMap) {
    const item = tMap[key];
    if (item && item.From && item.To) {
      if (item.From.trim() === from && item.To.trim() === to) {
        return item;
      }
    }
  }
  console.warn("❌ 找不到對應的交通資料:", fullRoute);
  return {};
}

function parseTitles(cleanName, dbItem) {
  let main = cleanName;
  let sub = dbItem.Name || dbItem.Local_Name || '';

  if (dbItem.Rest_Type || dbItem['Rest.Type']) {
    const type = dbItem.Rest_Type || dbItem['Rest.Type'];
    if (type && !cleanName.includes(type)) sub = `${type} · ${sub}`;
  }

  if (main === sub) sub = '';
  return { mainTitle: main, subTitle: sub };
}

function getItemIcon(type, name) {
  if (!type) {
    if (name.includes('機場')) return '✈️';
    if (name.includes('酒店') || name.includes('飯店') || name.includes('HOTEL') || name.includes('Guesthouse')) return '🏨';
    return '📍';
  }
  if (type.includes('Hotel') || type.includes('飯店') || type.includes('住宿')) return '🏨';
  if (type.includes('餐廳') || type.includes('燒肉') || type.includes('壽司') || type.includes('美食')) return '🍴';
  if (type.includes('面包') || type.includes('甜點') || type.includes('咖啡')) return '☕';
  if (type.includes('Spot') || type.includes('觀光') || type.includes('景點') || type.includes('神社') || type.includes('商店街') || type.includes('公園')) return '⛩️';
  if (type.includes('Mall') || type.includes('購物') || type.includes('outlet')) return '🛍';
  return '📍';
}

function getReservationBadge(status) {
  if (!status) return '';
  if (status.includes('排隊') || status.includes('現場')) {
    return `<span class="bg-rose-950/80 border border-rose-800 text-rose-300 text-sm font-bold px-2.5 py-1 rounded-lg">🔴 現場排隊</span>`;
  }
  if (status.includes('預約') || status.includes('不用排') || status.includes('可預約')) {
    return `<span class="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-sm font-bold px-2.5 py-1 rounded-lg">🟢 ${status}</span>`;
  }
  return `<span class="bg-amber-950/80 border border-amber-800 text-amber-300 text-sm font-bold px-2.5 py-1 rounded-lg">🟡 ${status}</span>`;
}

