/**
 * --------------------------------------------------------------------
 * 🛠️ 模組 C：完整前端資料解析與運算核心 (parser.js)
 * 嚴格對齊後端 A~AJ 欄位與資料合約（包含所有舊版核心與新版邏輯）
 * --------------------------------------------------------------------
 */

// 清洗含管線符號的原始名稱 (例: "淺草寺 | 雷門" -> "淺草寺")
export function getCleanSpotName(rawName) {
  if (!rawName) return '';
  return rawName.split('|')[0].trim();
}

// 解析停留分鐘數
export function parseDurationMins(durationVal) {
  if (!durationVal) return 60;
  const str = String(durationVal).trim();
  if (!str) return 60;
  
  if (str.includes('h') || str.includes('時')) {
    const num = parseFloat(str);
    return isNaN(num) ? 60 : Math.round(num * 60);
  }
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 60;
}

// 取得兩點之間的交通資訊（兼容新舊鍵值格式）
export function getBetweenSpotsTransport(currentData, fromSpot, toSpot) {
  if (!currentData || !currentData.transport || !fromSpot || !toSpot) return null;
  
  const cleanFrom = getCleanSpotName(fromSpot);
  const cleanTo = getCleanSpotName(toSpot);
  const tMap = currentData.transport;

  if (tMap[`${cleanFrom}➔${cleanTo}`]) return tMap[`${cleanFrom}➔${cleanTo}`];
  if (tMap[`${cleanFrom}→${cleanTo}`]) return tMap[`${cleanFrom}→${cleanTo}`];

  for (const key in tMap) {
    const item = tMap[key];
    if (item && item.From && item.To) {
      if (item.From.trim() === cleanFrom && item.To.trim() === cleanTo) {
        return item;
      }
    }
  }
  return null;
}

// 計算離開時間
export function calcDepartureTime(startTimeStr, durationMins) {
  if (!startTimeStr || !startTimeStr.includes(':')) return null;
  const [h, m] = startTimeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  
  const totalMins = h * 60 + m + durationMins;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  
  const pad = n => String(n).padStart(2, '0');
  return `${pad(endH)}:${pad(endM)}`;
}

// 格式化移動時間
export function formatMins(rawVal) {
  if (!rawVal && rawVal !== 0) return '移動中';
  const str = String(rawVal).trim();
  if (!str) return '移動中';
  if (str.toLowerCase().includes('min')) return str;
  return `${str} mins`;
}

// 格式化費用顯示
export function formatFeeDisplay(rawFee) {
  if (!rawFee && rawFee !== 0) return '';
  const str = String(rawFee).trim();
  if (str === '0' || str.toLowerCase().includes('pass') || str.includes('免')) {
    return '<span class="bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded-lg text-sm font-bold">🎫 Pass涵蓋 (¥0)</span>';
  }
  const numMatch = str.match(/\d+/);
  const val = numMatch ? numMatch[0] : str;
  return `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg text-sm font-bold">💰 交通票/IC卡 ¥${val}</span>`;
}

// 格式化營業時間換行
export function formatHoursDisplay(hoursStr) {
  if (!hoursStr) return '請參考官方說明';
  const str = String(hoursStr).trim();
  if (!str) return '請參考官方說明';
  return str.replace(/(\d{1,2}:\d{2}\s*[-~～]\s*\d{1,2}:\d{2})[\s,;/]+(\d{1,2}:\d{2}\s*[-~～]\s*\d{1,2}:\d{2})/g, '$1\n$2');
}

/* ----------------------------------------------------
   班次提取與高亮解析輔助函數
---------------------------------------------------- */
export function extractTargetClass(timetableStr) {
  if (!timetableStr) return null;
  const match = String(timetableStr).match(/\*\*(.*?)\*\*/);
  return match ? match[1].trim() : null;
}

export function parseTimetableList(timetableStr) {
  if (!timetableStr) return [];
  const items = String(timetableStr).split(/[,，/\n]/).map(s => s.trim()).filter(Boolean);
  return items.map(item => {
    const isTarget = item.includes('**');
    const cleanTime = item.replace(/\*\*/g, '').trim();
    return { time: cleanTime, isTarget };
  });
}

/* ----------------------------------------------------
   SubSpots 動態解析器 (支援時間戳記 + 特色標籤)
---------------------------------------------------- */
export function parseSubSpots(subSpotsStr) {
  if (!subSpotsStr) return [];
  const rawList = String(subSpotsStr).split(/\||\n/).map(s => s.trim()).filter(Boolean);

  return rawList.map(itemStr => {
    let time = '';
    let name = itemStr;
    let badges = [];

    const timeMatch = name.match(/^(\d{1,2}:\d{2}(?:\s*[-~～]\s*\d{1,2}:\d{2})?)\s+/);
    if (timeMatch) {
      time = timeMatch[1];
      name = name.replace(timeMatch[0], '').trim();
    }

    const badgeMatch = name.match(/\[(.*?)\]/);
    if (badgeMatch) {
      badges = badgeMatch[1].split(/[,，/]/).map(b => b.trim()).filter(Boolean);
      name = name.replace(/\[.*?\]/, '').trim();
    }

    return { time, name, badges, raw: itemStr };
  });
}

export function getSubspotCheckKey(parentSpot, subspotName) {
  return `subspot_check_${parentSpot}_${subspotName}`;
}

export function toggleSubspotCheck(parentSpot, subspotName, checkboxEl) {
  const isChecked = checkboxEl.checked;
  const key = getSubspotCheckKey(parentSpot, subspotName);
  localStorage.setItem(key, isChecked ? 'true' : 'false');

  const labelEl = document.getElementById(`subspot-label-${parentSpot}-${subspotName}`);
  if (labelEl) {
    if (isChecked) {
      labelEl.classList.add('line-through', 'text-slate-500');
      labelEl.classList.remove('text-slate-100');
    } else {
      labelEl.classList.remove('line-through', 'text-slate-500');
      labelEl.classList.add('text-slate-100');
    }
  }
}

// 建立連續地圖導航 URL
export function buildContinuousMapUrl(parentSpot, subSpots) {
  if (!subSpots || subSpots.length === 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parentSpot)}`;
  }
  const names = subSpots.map(s => s.name);
  if (names.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(names[0])}`;
  }
  const origin = encodeURIComponent(names[0]);
  const destination = encodeURIComponent(names[names.length - 1]);
  const waypoints = names.slice(1, -1).map(n => encodeURIComponent(n)).join('%7C');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  return url;
}

// 計算多段轉乘總時間
export function calcMultiLegTime(routeParts, findTransportInfoFn) {
  let total = 0;
  let legTimes = [];
  let hasValid = false;

  for (let i = 0; i < routeParts.length - 1; i++) {
    const from = routeParts[i];
    const to = routeParts[i + 1];
    const info = findTransportInfoFn ? findTransportInfoFn(`${from}➔${to}`, [from, to]) : {};
    const num = parseInt(info && (info.Time || info.Duration) ? (info.Time || info.Duration) : 0, 10);
    if (!isNaN(num) && num > 0) {
      total += num;
      legTimes.push(num);
      hasValid = true;
    }
  }

  if (hasValid && routeParts.length > 2) {
    return `${total} mins (${legTimes.join('+')})`;
  } else if (hasValid) {
    return `${total} mins`;
  }
  return null;
}

// 計算多段轉乘總費用
export function calcMultiLegFee(routeParts, findTransportInfoFn) {
  let totalFee = 0;
  let hasValidFee = false;

  for (let i = 0; i < routeParts.length - 1; i++) {
    const from = routeParts[i];
    const to = routeParts[i + 1];
    const info = findTransportInfoFn ? findTransportInfoFn(`${from}➔${to}`, [from, to]) : {};
    
    if (info && info.Fee !== undefined && info.Fee !== null && String(info.Fee).trim() !== '') {
      const feeStr = String(info.Fee).trim();
      const numMatch = feeStr.match(/\d+/);
      if (numMatch) {
        totalFee += parseInt(numMatch[0], 10);
        hasValidFee = true;
      }
    }
  }

  return hasValidFee ? totalFee : null;
}

export function timeToMins(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function getBestOpenTime(dbHoursStr, referenceTime) {
  if (!dbHoursStr) return null;
  const matches = [...dbHoursStr.matchAll(/(\d{1,2}:\d{2})\s*-[^, ]+/g)].map(m => m[1]);
  
  if (matches.length === 0) {
    const simple = dbHoursStr.match(/(\d{1,2}:\d{2})/);
    return simple ? simple[1] : null;
  }
  
  if (matches.length === 1 || !referenceTime) return matches[0];

  const refMins = timeToMins(referenceTime);
  if (refMins === null) return matches[0];

  let closestTime = matches[0];
  let minDiff = Infinity;

  matches.forEach(t => {
    const tMins = timeToMins(t);
    if (tMins !== null) {
      const diff = Math.abs(tMins - refMins);
      if (diff < minDiff) {
        minDiff = diff;
        closestTime = t;
      }
    }
  });

  return closestTime;
}

// 解析儲存格或物件內容
export function parseCellContent(rawInput) {
  if (rawInput && typeof rawInput === 'object') {
    const spotName = rawInput.name || '';
    const notice = rawInput.notice || '';
    const subTitle = ''; 
    
    const openMatch = notice.match(/(\d{1,2}:\d{2})\s*(?:營業|開店|開門)|(?:營業|開店|開門)\s*(\d{1,2}:\d{2})/);
    const openTime = openMatch ? (openMatch[1] || openMatch[2]) : null;

    const leaveMatch = notice.match(/(\d{1,2}:\d{2})\s*(?:前)?(?:必須)?離開|(?:前|必須)?離開\s*(\d{1,2}:\d{2})/);
    const leaveTime = leaveMatch ? (leaveMatch[1] || leaveMatch[2]) : null;

    const queueMatch = notice.match(/(\d{1,2}:\d{2})\s*(?:排隊|抵達|集合)|(?:排隊|抵達|集合|建議)\s*(\d{1,2}:\d{2})/);
    let queueTime = queueMatch ? (queueMatch[1] || queueMatch[2]) : null;

    if (!queueTime && !openTime && !leaveTime) {
      const simpleTimeMatch = notice.match(/(\d{1,2}:\d{2})/);
      if (simpleTimeMatch) queueTime = simpleTimeMatch[1];
    }

    return { spotName, subTitle, notice, openTime, queueTime, leaveTime };
  }

  if (!rawInput) return { spotName: '', subTitle: '', notice: '', openTime: null, queueTime: null, leaveTime: null };
  
  const parts = String(rawInput).split('|').map(s => s.trim());
  const spotName = parts[0] || '';
  const subTitle = parts[1] || '';
  const notice = parts.slice(2).join(' ') || '';
  
  return { spotName, subTitle, notice, openTime: null, queueTime: null, leaveTime: null };
}

// 取得卡片狀態標籤
export function getCardStatusBadge({ slotTime, dbItem, parsedNotice, weekKey }) {
  const { notice, openTime, queueTime, leaveTime } = parsedNotice;
  const slotMins = timeToMins(slotTime);

  const dbHoursStr = dbItem ? (dbItem[weekKey] || dbItem.Hours || dbItem.OpenTime || '') : '';
  const dbOpenTime = getBestOpenTime(dbHoursStr, queueTime || slotTime);
  const finalOpenTime = openTime || dbOpenTime;

  if (leaveTime) {
    return `
      <span class="bg-rose-950/80 text-rose-300 border border-rose-800/60 text-sm font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
        ⚠️ ${leaveTime} 前須離開
      </span>
    `;
  }

  if (queueTime) {
    return `
      <span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
        🔥 ${finalOpenTime ? finalOpenTime + '開店 ' : ''}(建議 ${queueTime} 排隊)
      </span>
    `;
  }

  const dbOpenMins = timeToMins(finalOpenTime);
  if (slotMins !== null && dbOpenMins !== null) {
    const diffMins = dbOpenMins - slotMins;

    if (diffMins >= 0 && diffMins <= 30) {
      return `
        <span class="bg-blue-950/80 text-blue-300 border border-blue-800/60 text-sm font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
          ℹ️ ${finalOpenTime} 開店
        </span>
      `;
    }

    if (diffMins > 30) {
      return `
        <span class="bg-rose-950/80 text-rose-300 border border-rose-800/60 text-sm font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
          ⚠️ ${finalOpenTime} 才開店
        </span>
      `;
    }
  }

  if (notice) {
    return `
      <span class="bg-slate-800 text-amber-300 text-sm font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
        💡 ${notice}
      </span>
    `;
  }

  return '';
}

/* ----------------------------------------------------
   🧪 Checkpoint 2 (CP2): TDD 診斷驗證腳本
---------------------------------------------------- */
export function runParserCheckpoint() {
  console.group("🧪 [CP2 TDD Diagnostic] Parser & Logic Checkpoint");
  
  // 1. 測試 SubSpots 解析
  const testSubSpotsStr = "09:00 雷門拍紀念照 [拍照熱點] | 09:30 仲見世通商店街吃人形燒 [美食,伴手禮]";
  const parsedSubs = parseSubSpots(testSubSpotsStr);
  console.log("👉 SubSpots 解析結果:", parsedSubs);

  // 2. 測試目標班次提取
  const testTimetable = "11:45, **11:52**, 12:00";
  const targetClass = extractTargetClass(testTimetable);
  const timetableList = parseTimetableList(testTimetable);
  console.log(`👉 提取目標班次 (${targetClass}):`, timetableList);

  // 3. 測試離開時間計算
  const depTime = calcDepartureTime("09:00", 120);
  console.log("👉 預計離開時間計算 (09:00 + 120m):", depTime);

  console.groupEnd();
  return { status: "success", parsedSubs, targetClass, depTime };
}
