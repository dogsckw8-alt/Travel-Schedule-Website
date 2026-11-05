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
   UI 主渲染函式：渲染上方 Day 分標籤與時間軸
---------------------------------------------------- */
export function renderApp() {
  if (!currentData || !currentData.schedule || !currentData.schedule.days.length) {
    const container = document.getElementById('timeline-container');
    if (container) {
      container.innerHTML = '<div class="text-center text-slate-400 py-12 text-lg">尚無行程資料</div>';
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
          <span class="text-xs tracking-wider opacity-80">DAY ${idx + 1}</span>
          <span class="text-base font-black">${dateShort} ${weekDay}</span>
        </button>
      `;
    }).join('');
  }

  renderTimeline(days[selectedDayIndex]);
}

/* ----------------------------------------------------
   第一層：時間軸卡片渲染 (整合每日體能與步數預警看板)
---------------------------------------------------- */
export function renderTimeline(currentDayKey) {
  console.log('正在渲染 Day:', currentDayKey);
  const container = document.getElementById('timeline-container');
  if (!container) return;

  const timeline = currentData.schedule.timeline;
  let dayItems = [];
  let fitnessInfo = null;

  // 🛡️ 防禦性編程護城河：同時兼容舊陣列格式與新物件格式 ({ items, fitness })
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
    container.innerHTML = '<div class="text-center text-slate-400 py-12 text-lg">☕ 本日尚無排定行程</div>';
    return;
  }

  // 💡 產生每日體能與步數預警看板 HTML
  let fitnessBannerHTML = '';
  if (fitnessInfo && fitnessInfo.summaryText) {
    // 依據燈號狀態自動切換卡片顏色主題
    let cardStyle = 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300';
    if (fitnessInfo.status && fitnessInfo.status.includes('🔴')) {
      cardStyle = 'bg-rose-950/40 border-rose-800/60 text-rose-300';
    } else if (fitnessInfo.status && fitnessInfo.status.includes('🟡')) {
      cardStyle = 'bg-amber-950/40 border-amber-800/60 text-amber-300';
    }

    fitnessBannerHTML = `
      <div class="mb-5 p-4 rounded-2xl border ${cardStyle} shadow-lg flex items-center justify-between gap-2 backdrop-blur-sm relative z-20">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🏃‍♂️</span>
          <div>
            <div class="text-[11px] font-black uppercase tracking-wider opacity-80">每日體能與步數預警看板</div>
            <div class="text-sm md:text-base font-black mt-0.5">${fitnessInfo.summaryText}</div>
          </div>
        </div>
      </div>
    `;
  }

  const dateObj = new Date(currentDayKey);
  const weekKey = WEEK_KEYS[dateObj.getDay()] || '';

  // 將體能看板置於最上方，接著渲染行程列表
  container.innerHTML = fitnessBannerHTML + dayItems.map((slot, idx) => {
    // 💡 修正：新結構中 slot 直接就是單一行程物件 { time, name, duration, departure, notice }
    const rawName = slot.name; 
    const isTransport = rawName.includes('→') || rawName.includes('➔');

    if (isTransport) {
      const cleanRoute = getCleanSpotName(rawName);
      const routeParts = cleanRoute.split(/→|➔/).map(p => p.trim());
      const isMultiLeg = routeParts.length > 2;

      const transInfo = findTransportInfo(cleanRoute, routeParts);

      let durationStr = isMultiLeg ? calcMultiLegTime(routeParts) : null;
      if (!durationStr) {
        durationStr = formatMins(transInfo.Time || transInfo.Duration);
      }

      let feeVal = transInfo.Fee;
      if (isMultiLeg) {
        const multiFee = calcMultiLegFee(routeParts);
        if (multiFee !== null) feeVal = multiFee;
      }

      const feeBadge = formatFeeDisplay(feeVal);
      const timetableRaw = transInfo.Timetable || transInfo['特定班次'] || transInfo.TimeTable || '';
      const targetTime = extractTargetClass(timetableRaw);

      const targetBadge = targetTime
        ? `<span class="bg-rose-950/90 text-rose-300 border border-rose-600/80 px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 shadow-sm">🎯 目標班次 ${targetTime}</span>`
        : '';

      return `
        <div class="flex items-start gap-3 relative z-10">
          <div class="w-12 pt-2 flex-shrink-0 text-right">
            <span class="text-base font-black text-amber-400 bg-slate-900 px-1 py-0.5 rounded border border-amber-500/30">${slot.time}</span>
          </div>
          
          <div onclick="openTransportModal('${cleanRoute}')" class="touch-card flex-1 bg-slate-900/90 border border-amber-500/40 hover:border-amber-400 p-3.5 rounded-2xl shadow-md cursor-pointer transition active:scale-[0.98]">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">🚌</span>
                <div>
                  <h3 class="text-base font-black text-amber-300 leading-snug">
                    ${routeParts.join(' ➔ ')}
                  </h3>
                  ${isMultiLeg ? `<span class="inline-block bg-indigo-950 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded mt-1 border border-indigo-800">轉乘路線</span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-800 text-sm font-bold text-slate-300">
              ${targetBadge}
              <span class="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg">⏱️ ${durationStr}</span>
              ${feeBadge}
              ${transInfo.Line ? `<span class="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">🚇 ${transInfo.Line}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // 傳入帶有 spotName 與 notice 的物件給 parseCellContent
    const parsedNotice = parseCellContent(slot);
    const { spotName, subTitle } = parsedNotice;

    const dbItem = (currentData.restaurants && currentData.restaurants[spotName]) || 
                   (currentData.attractions && currentData.attractions[spotName]) || {};

    const displayTime = parsedNotice.queueTime || slot.time;
    const statusBadge = getCardStatusBadge({ slotTime: slot.time, dbItem, parsedNotice, weekKey });

    const nextSlot = dayItems[idx + 1];
    const nextRawName = nextSlot ? nextSlot.name : null;
    const nextIsTransport = nextRawName ? (nextRawName.includes('→') || nextRawName.includes('➔')) : false;
    const isShortWalkToNext = nextSlot && !nextIsTransport;

    let shortWalkHTML = '';
    if (isShortWalkToNext) {
      const nextClean = getCleanSpotName(nextRawName);
      const matchedTrans = getBetweenSpotsTransport(currentData, spotName, nextClean);

      if (matchedTrans) {
        const durationStr = formatMins(matchedTrans.Time || matchedTrans.Duration);
        const lineInfo = matchedTrans.Line ? ` (${matchedTrans.Line})` : '';

        shortWalkHTML = `
          <div onclick="openTransportModal('${spotName}➔${nextClean}')" class="flex items-center justify-between bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 px-3.5 py-2.5 rounded-xl cursor-pointer transition my-1">
            <div class="flex items-center gap-2 text-slate-200 font-bold text-sm">
              <span class="text-amber-400 text-base">🚶</span>
              <span>移動至 <strong class="text-amber-300 font-extrabold text-sm">${nextClean}</strong>${lineInfo}</span>
            </div>
            <div class="flex items-center gap-2 font-bold flex-shrink-0">
              <span class="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg text-sm">⏱️ 約 ${durationStr}</span>
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

    const icon = getItemIcon(dbItem.Type || dbItem['Rest.Type'], spotName);
    const reservationBadge = getReservationBadge(dbItem.reservation || dbItem.BookingStatus);
    const subSpotsList = parseSubSpots(dbItem.SubSpots);
    
    // 💡 優先使用試算表算好的 duration 與 departure，若無才用 DB 預設
    const durationMins = slot.duration || parseDurationMins(dbItem.Duration);
    const departureTime = slot.departure || calcDepartureTime(displayTime, durationMins);

    return `
      <div class="flex items-start gap-3 relative z-10">
        <div class="w-12 pt-2 flex-shrink-0 text-right">
          <span class="text-lg font-extrabold ${parsedNotice.queueTime ? 'text-amber-300 underline underline-offset-2' : 'text-amber-400'} block">
            ${displayTime}
          </span>
        </div>

        <div class="flex-1 space-y-3">
          <div onclick="openDetailModal('${spotName}', '${displayTime}')" class="touch-card bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl shadow-lg cursor-pointer transition duration-150 active:scale-[0.98]">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="text-xl font-black text-white leading-snug flex items-center gap-1.5">
                  <span>${icon}</span>
                  <span>${spotName}</span>
                </h2>
                ${subTitle ? `<p class="text-sm text-slate-400 mt-0.5 font-medium truncate max-w-[220px]">${subTitle}</p>` : ''}
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
              ${dbItem.District ? `<span class="bg-slate-800 text-slate-200 text-sm font-bold px-2.5 py-1 rounded-lg">📍 ${dbItem.District}</span>` : ''}
              <span class="bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-sm font-bold px-2.5 py-1 rounded-lg">
                ⏱️ 預計停留 ${durationMins} 分${departureTime ? ` (${departureTime} 離開)` : ''}
              </span>
              ${statusBadge}
              ${dbItem.AvgCost ? `<span class="bg-slate-800 text-amber-300 text-sm font-bold px-2.5 py-1 rounded-lg">💰 約 ¥${dbItem.AvgCost}</span>` : ''}
              ${reservationBadge}
              ${subSpotsList.length > 0 ? `<span class="bg-indigo-950/90 border border-indigo-700/60 text-indigo-300 text-sm font-bold px-2.5 py-1 rounded-lg">🍡 包含 ${subSpotsList.length} 個店家/景點</span>` : ''}
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

  // 🛡️ 防禦性編程：完美兼容新舊格式，安全取出當日行程陣列
  if (Array.isArray(timeline)) {
    const foundDay = timeline.find(slot => slot.items && slot.items[currentDayKey]);
    if (foundDay) dayItems = foundDay.items[currentDayKey] || [];
  } else if (timeline && typeof timeline === 'object') {
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
      <div class="bg-slate-800/40 p-3 rounded-xl border border-slate-800 text-center text-xs text-slate-400 font-bold">
        🏁 此站為本日行程最終站
      </div>
    `;
  }

  const nextSlot = dayItems[currentIdx + 1];
  const nextRawName = nextSlot.name; 
  const isNextTransport = nextRawName.includes('→') || nextRawName.includes('➔');

  // 下方保持原本的邏輯不變...
  if (isNextTransport) {
    const cleanRoute = getCleanSpotName(nextRawName);
    return `
      <div class="bg-amber-950/30 border border-amber-800/60 p-3.5 rounded-2xl space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-amber-400 uppercase tracking-wider">⏭️ 順遊下一站（交通接駁）</span>
          <span class="text-xs font-bold text-slate-400">⏰ ${nextSlot.time} 出發</span>
        </div>
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="font-black text-white text-base">🚌 ${cleanRoute}</div>
          <button onclick="openTransportModal('${cleanRoute}')" class="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1.5 rounded-xl shadow active:scale-95 transition">
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
      <div class="bg-slate-800/90 border border-slate-700 p-3.5 rounded-2xl space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-amber-400 uppercase tracking-wider">⏭️ 順遊下一站</span>
          <span class="text-xs font-bold text-slate-400">⏰ ${nextSlot.time} 到達</span>
        </div>
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">${icon}</span>
            <div>
              <div class="font-black text-white text-base leading-snug">${nextCleanName}</div>
              ${nextDbItem.District ? `<span class="text-xs font-bold text-slate-400">📍 ${nextDbItem.District}</span>` : ''}
            </div>
          </div>
          <button onclick="openDetailModal('${nextCleanName}', '${nextSlot.time}')" class="bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/30 text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 transition">
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
  if (!isBackNavigation && currentModalItem && currentModalItem !== itemName) {
    modalHistory.push({ name: currentModalItem, slotTime });
  }
  setCurrentModalItem(itemName);

  const dbItem = (currentData.restaurants && currentData.restaurants[itemName]) || 
                 (currentData.attractions && currentData.attractions[itemName]) || {};

  const titles = parseTitles(itemName, dbItem);
  const icon = getItemIcon(dbItem.Type || dbItem['Rest.Type'], itemName);

  const currentDateStr = currentData.schedule.days[selectedDayIndex];
  const dateObj = new Date(currentDateStr);
  const weekKey = WEEK_KEYS[dateObj.getDay()];
  const todayHours = dbItem[weekKey] || dbItem.Hours || '請參考官方說明';

  const itemType = (dbItem.Type || dbItem['Rest.Type'] || '').toLowerCase();
  const isRestaurant = itemType.includes('餐廳') || itemType.includes('燒肉') || itemType.includes('壽司') || itemType.includes('拉麵') || dbItem.Tabelog評分 || dbItem.Tabelog;
  const isHotel = itemType.includes('hotel') || itemType.includes('飯店') || itemType.includes('住宿') || itemName.includes('HOTEL') || itemName.includes('飯店');

  const durationMins = parseDurationMins(dbItem.Duration);
  const departureTime = calcDepartureTime(slotTime, durationMins);

  const backBtnContainer = document.getElementById('modal-back-btn-container');
  if (backBtnContainer) {
    if (modalHistory.length > 0) {
      const prev = modalHistory[modalHistory.length - 1];
      backBtnContainer.innerHTML = `
        <button onclick="popModalHistory()" class="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg hover:bg-amber-500/20 transition flex items-center gap-1">
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
        <div class="overflow-hidden rounded-2xl mb-2 border border-slate-700 max-h-48 relative group cursor-pointer" onclick="openLightbox('${imageUrl}', '${titles.mainTitle}')">
          <img src="${imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="${titles.mainTitle}" onerror="this.parentElement.style.display='none'">
          <div class="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-sm text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 font-bold">
            🔍 點擊全螢幕預覽
          </div>
        </div>
      ` : ''}
      <div class="flex items-center gap-2">
        <span class="text-3xl">${icon}</span>
        <div>
          <h2 class="text-2xl font-black text-white leading-tight">${titles.mainTitle}</h2>
          ${titles.subTitle ? `<p class="text-sm text-slate-400 font-medium">${titles.subTitle}</p>` : ''}
        </div>
      </div>
    `;
  }

  let gridHTML = `
    <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
      <p class="text-xs text-slate-400 font-bold">📍 所屬地區</p>
      <p class="text-base font-black text-white mt-0.5">${dbItem.District || '東京'}</p>
    </div>
    <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
      <p class="text-xs text-slate-400 font-bold">⏱️ 停留與預計離開</p>
      <p class="text-base font-black text-amber-300 mt-0.5">${durationMins} mins ${departureTime ? `(${departureTime} 離開)` : ''}</p>
    </div>
  `;

  if (isHotel) {
    gridHTML += `
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🏨 類型</p>
        <p class="text-base font-black text-amber-300 mt-0.5">飯店 / 住宿</p>
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700 col-span-2">
        <p class="text-xs text-slate-400 font-bold">📌 預訂 / 入住狀態</p>
        <p class="text-base font-black text-emerald-400 mt-0.5">${dbItem.reservation || dbItem.BookingStatus || '已確認訂房'}</p>
      </div>
    `;
  } else if (isRestaurant) {
    gridHTML += `
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🕒 今日營業時間 (${weekKey})</p>
        <p class="text-base font-black text-amber-300 mt-0.5 whitespace-pre-line">${formatHoursDisplay(todayHours)}</p>
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🍳 料理類型</p>
        <p class="text-base font-black text-white mt-0.5">${dbItem['Rest.Type'] || dbItem.Type || '美食'}</p>
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">💰 平均消費</p>
        <p class="text-base font-black text-emerald-400 mt-0.5">${dbItem.AvgCost ? `¥${dbItem.AvgCost}` : '依現場為準'}</p>
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700 col-span-2">
        <p class="text-xs text-slate-400 font-bold">⭐ Tabelog 評分</p>
        <p class="text-base font-black text-amber-400 mt-0.5">${dbItem.Tabelog評分 || dbItem.Tabelog || '高評價推薦'}</p>
      </div>
    `;
  } else {
    gridHTML += `
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🕒 開放 / 營業時間 (${weekKey})</p>
        <p class="text-base font-black text-amber-300 mt-0.5 whitespace-pre-line">${formatHoursDisplay(todayHours)}</p>
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
        <p class="text-xs text-slate-400 font-bold">🏷️ 類別</p>
        <p class="text-base font-black text-white mt-0.5">${dbItem.Type || '觀光景點'}</p>
      </div>
      <div class="bg-slate-800/80 p-3 rounded-xl border border-slate-700 col-span-2">
        <p class="text-xs text-slate-400 font-bold">💰 預估費用</p>
        <p class="text-base font-black text-emerald-400 mt-0.5">${dbItem.AvgCost ? `¥${dbItem.AvgCost}` : '免費 / 依現場'}</p>
      </div>
    `;
  }

  const modalGridEl = document.getElementById('modal-grid');
  if (modalGridEl) modalGridEl.innerHTML = gridHTML;

  const criticalTime = dbItem['Book/Que_CriticalTime'] || dbItem.CriticalTime;
  const queueLevel = dbItem.Level_of_Que || dbItem.reservation;
  const planB = dbItem.Plan_B || dbItem.PlanB;
  const comment = dbItem.Comment || dbItem.Notes;
  const storyText = dbItem.Story || dbItem.Description;
  const subSpots = parseSubSpots(dbItem.SubSpots);

  let alertHTML = '';

  if (criticalTime || queueLevel) {
    alertHTML += `
      <div class="bg-amber-500/10 border-l-4 border-amber-500 p-3.5 rounded-r-xl">
        <p class="text-xs font-bold text-amber-400 uppercase tracking-wider">⚠️ 關鍵時間與提醒</p>
        <p class="text-sm font-black text-amber-200 mt-1 whitespace-pre-line leading-relaxed">${criticalTime || ''} ${queueLevel ? `\n(${queueLevel})` : ''}</p>
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
          <span class="text-[10px] text-slate-400 font-bold">可勾選踩點進度</span>
        </div>
        
        <div class="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-500/40">
          ${subSpots.map((spot, i) => {
            const subDb = (currentData.restaurants && currentData.restaurants[spot.name]) || 
                          (currentData.attractions && currentData.attractions[spot.name]) || {};
            
            const hasDbData = Object.keys(subDb).length > 0;
            const subMapUrl = subDb.Gmap_URL || subDb.GmapURL || subDb.MapURL || subDb.Website || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name)}`;
            const subImgUrl = subDb.ImageURL || subDb.ImgURL || subDb.ImgUrl || subDb.imageUrl || subDb.imgUrl || subDb.Photo || subDb.Pic || subDb.Picture;
            const isChecked = localStorage.getItem(getSubspotCheckKey(itemName, spot.name)) === 'true';

            return `
              <div class="relative flex items-start justify-between gap-2 bg-slate-900/90 border border-slate-800 p-3 rounded-xl hover:border-slate-700 transition">
                <div class="absolute -left-[21px] top-3.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-slate-950"></div>

                <div class="flex items-start gap-2.5 flex-1">
                  <input type="checkbox" id="spot-chk-${i}" ${isChecked ? 'checked' : ''} onchange="toggleSubspotCheck('${itemName}', '${spot.name}', this)" class="w-4 h-4 mt-1 accent-amber-400 rounded cursor-pointer flex-shrink-0">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      ${spot.time ? `<span class="text-xs font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">${spot.time}</span>` : ''}
                      <label id="subspot-label-${itemName}-${spot.name}" for="spot-chk-${i}" class="text-sm font-black cursor-pointer leading-snug ${isChecked ? 'line-through text-slate-500' : 'text-slate-100'}">
                        ${spot.name}
                      </label>
                    </div>

                    ${spot.badges.length > 0 ? `
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        ${spot.badges.map(b => `<span class="bg-indigo-900/80 text-indigo-200 border border-indigo-700/60 text-[10px] font-bold px-1.5 py-0.5 rounded">${b}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
                
                <div class="flex items-center gap-1 flex-shrink-0">
                  <a href="${subMapUrl}" target="_blank" class="text-[11px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-md hover:bg-amber-500/20 transition flex items-center gap-0.5">📍 導航</a>
                  ${subImgUrl ? `<button onclick="openLightbox('${subImgUrl}', '${spot.name}')" class="text-[11px] text-sky-300 font-bold bg-sky-950/80 border border-sky-800 px-2 py-1 rounded-md flex items-center gap-0.5">🖼️ 看圖</button>` : ''}
                  ${hasDbData ? `<button onclick="openDetailModal('${spot.name}')" class="text-[11px] text-slate-300 font-bold bg-slate-800 border border-slate-700 px-2 py-1 rounded-md flex items-center gap-0.5">🔍 詳情</button>` : ''}
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
      <div class="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-1">
        <p class="text-xs font-bold text-amber-400 flex items-center gap-1">
          <span>📖</span> 景點背景與故事導覽
        </p>
        <p class="text-xs font-medium text-slate-300 leading-relaxed pt-1 whitespace-pre-line">${storyText}</p>
      </div>
    `;
  }

  if (comment) {
    alertHTML += `
      <div class="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80">
        <p class="text-xs font-bold text-slate-400">📝 備註與說明</p>
        <p class="text-sm font-bold text-slate-200 mt-1 leading-relaxed whitespace-pre-line">${comment}</p>
      </div>
    `;
  }

  if (planB) {
    alertHTML += `
      <div class="bg-indigo-950/50 border border-indigo-800/80 p-3.5 rounded-xl">
        <p class="text-xs font-bold text-indigo-300">💡 備案 (Plan B)</p>
        <p class="text-sm font-bold text-indigo-200 mt-1 whitespace-pre-line">${planB}</p>
      </div>
    `;
  }

  const nextStepHTML = renderNextStepModule(itemName, currentDateStr);
  const modalAlertsEl = document.getElementById('modal-alerts');
  if (modalAlertsEl) modalAlertsEl.innerHTML = alertHTML + nextStepHTML;

  const mapUrl = dbItem.Gmap_URL || dbItem.GmapURL || dbItem.MapURL || dbItem.Website || buildContinuousMapUrl(itemName, subSpots);
  const menuUrl = dbItem.Menu || dbItem.MenuImgURL;

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
      console.log(`第 ${idx + 1} 段交通 info 物件內容:`, info);
      const timeFormatted = formatMins(info.Time || info.Duration);
      const timetableRaw = info.Timetable || info['特定班次'] || info.TimeTable || '';
      const parsedTimetables = parseTimetableList(timetableRaw);

      const liveUrl = info.LiveUrl || info.Link2 || info['實時位置連結'] || info.Options;
      const routeTips = info.RouteTips || info.RouteGuide || info.WalkingTips || info['路線提示'];
      const videoUrl = info.VideoURL || info.Video || info.video_url;

      const timetablePic = info.timeTable_pic_url || info.TimeTable_Pic_URL || info.timeTable_pic || info.TimeTable_Pic;
      const timetableLink = info.TimeTable || info.TimeTableURL || info.timetable_url;

      let feeBadge = '';
      if (info.Fee !== undefined && info.Fee !== null && String(info.Fee).trim() !== '') {
        const feeStr = String(info.Fee).trim();
        if (feeStr === '0' || feeStr.toLowerCase().includes('pass') || feeStr.includes('免')) {
          feeBadge = `<span class="bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">🎫 Pass涵蓋 (¥0)</span>`;
        } else {
          const numMatch = feeStr.match(/\d+/);
          const val = numMatch ? numMatch[0] : feeStr;
          feeBadge = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">💰 ¥${val}</span>`;
        }
      }

      const defaultSegNav = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(seg.from)}&destination=${encodeURIComponent(seg.to)}`;
      const segNavUrl = info.Shortcut || info.ShortcutURL || info.Gmap_URL || defaultSegNav;

      return `
        <div class="space-y-3">
          <div class="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-3">
            <div class="flex justify-between items-center border-b border-slate-700/80 pb-2">
              <span class="text-sm font-black bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-md">第 ${idx + 1} 段移動</span>
              <div class="flex items-center gap-2">
                ${feeBadge}
                <span class="text-sm font-bold text-slate-300">⏱️ ${timeFormatted}</span>
              </div>
            </div>

            <div class="text-lg font-black text-white mt-1">
              ${seg.from} <span class="text-amber-400">➔</span> ${seg.to}
            </div>

            ${info.Platform || info.DeparturePlatform ? `
              <div class="text-sm text-amber-200 bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-lg font-bold">
                🏣 乘車處/月台：${info.Platform || info.DeparturePlatform}
              </div>
            ` : ''}

            ${info.Line || info.RouteName ? `
              <div class="text-sm text-slate-200 font-bold">
                🚇 搭乘路線：<span class="text-white">${info.Line || info.RouteName}</span>
              </div>
            ` : ''}

            ${parsedTimetables.length > 0 ? `
              <div class="pt-1">
                <p class="text-xs font-black text-slate-300 mb-2 flex items-center gap-1">⏰ 班次時刻對照表：</p>
                <div class="flex flex-wrap gap-2 items-center">
                  ${parsedTimetables.map(t => {
                    if (t.isTarget) {
                      return `<span class="bg-rose-950/90 border-2 border-rose-500 text-rose-300 text-sm font-black px-3 py-1 rounded-xl shadow-lg shadow-rose-950/50 flex items-center gap-1 scale-105">🎯 ${t.time}</span>`;
                    } else {
                      return `<span class="bg-slate-900/60 border border-slate-800 text-slate-400 opacity-60 text-xs font-semibold px-2.5 py-1 rounded-lg">${t.time}</span>`;
                    }
                  }).join('')}
                </div>
              </div>
            ` : ''}

            ${(info.Remarks || info.Notes) ? `
              <div class="bg-rose-950/40 border-l-4 border-rose-500 p-3.5 rounded-r-xl">
                <p class="text-xs font-bold text-rose-400 uppercase tracking-wider mb-0.5">⚠️ 乘車與票券注意事項</p>
                <p class="text-sm font-bold text-rose-200 leading-relaxed whitespace-pre-line">${info.Remarks || info.Notes}</p>
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
                <button onclick="openLightbox('${timetablePic}', '${seg.from} ➔${seg.to} 官方時刻表')" class="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-sm font-black rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow">
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

            ${liveUrl ? `
              <div class="pt-1">
                <a href="${liveUrl}" target="_blank" class="inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 font-bold underline">
                  🔗 查看實時交通位置 / 相關連結
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
// 🛡️ 修正屬性名稱：確認前端使用的是 currentData.transport
  if (!currentData || !currentData.transport) {
    console.warn("⚠️ 警告：currentData.transport 資料不存在或尚未載入！");
    return {};
  }
  const tMap = currentData.transport;

  if (tMap[fullRoute]) {
    return tMap[fullRoute];
  }

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

function parseTitles(rawName, dbItem) {
  let main = rawName;
  let sub = dbItem.Name || '';

  if (rawName.includes('(') || rawName.includes('（')) {
    main = rawName;
  } else if (dbItem.RestType || dbItem['Rest.Type']) {
    const type = dbItem.RestType || dbItem['Rest.Type'];
    if (type && !rawName.includes(type)) sub = `${type} · ${sub}`;
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
  if (type.includes('餐廳') || type.includes('燒肉') || type.includes('壽司')) return '🍴';
  if (type.includes('面包') || type.includes('甜點') || type.includes('咖啡')) return '☕';
  if (type.includes('Spot') || type.includes('景點') || type.includes('神社') || type.includes('商店街')) return '⛩️';
  if (type.includes('Mall') || type.includes('購物') || type.includes('outlet')) return '🛍';
  return '📍';
}

function getReservationBadge(status) {
  if (!status) return '';
  if (status.includes('排隊') || status.includes('現場')) {
    return `<span class="bg-rose-950/80 border border-rose-800 text-rose-300 text-sm font-bold px-2.5 py-1 rounded-lg">🔴 現場排隊</span>`;
  }
  if (status.includes('預約') || status.includes('不用排')) {
    return `<span class="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-sm font-bold px-2.5 py-1 rounded-lg">🟢 已預約/不用排</span>`;
  }
  return `<span class="bg-amber-950/80 border border-amber-800 text-amber-300 text-sm font-bold px-2.5 py-1 rounded-lg">🟡 ${status}</span>`;
}
