/**
 * --------------------------------------------------------------------
 * 🛠️ 模組 C：全新前端資料解析與運算核心 (parser.js)
 * 嚴格對齊後端 A~AJ 欄位與資料合約
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
    return '<span class="bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-bold">🎫 Pass涵蓋 (¥0)</span>';
  }
  const numMatch = str.match(/\d+/);
  const val = numMatch ? numMatch[0] : str;
  return `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg text-xs font-bold">💰 交通/IC卡 ¥${val}</span>`;
}

// 格式化營業時間換行
export function formatHoursDisplay(hoursStr) {
  if (!hoursStr) return '請參考官方說明';
  const str = String(hoursStr).trim();
  if (!str) return '請參考官方說明';
  return str.replace(/(\d{1,2}:\d{2}\s*[-~～]\s*\d{1,2}:\d{2})[\s,;/]+(\d{1,2}:\d{2}\s*[-~～]\s*\d{1,2}:\d{2})/g, '$1\n$2');
}

/* ----------------------------------------------------
   🎯 班次提取與高亮解析 (Target Class & Timetable)
---------------------------------------------------- */
// 提取用 ** 包裹的目標班次 (例: 11:55,**13:30**,13:55 -> 13:30)
export function extractTargetClass(timetableStr) {
  if (!timetableStr) return null;
  const match = String(timetableStr).match(/\*\*(.*?)\*\*/);
  return match ? match[1].trim() : null;
}

// 解析完整的班次清單，傳回包含 isTarget 標記的陣列
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
   🍡 SubSpots 動態解析器 (支援時間戳記 + 特色標籤)
---------------------------------------------------- */
export function parseSubSpots(subSpotsStr) {
  if (!subSpotsStr) return [];
  const rawList = String(subSpotsStr).split(/\||\n/).map(s => s.trim()).filter(Boolean);

  return rawList.map(itemStr => {
    let time = '';
    let name = itemStr;
    let badges = [];

    // 1. 解析時間戳記
    const timeMatch = name.match(/^(\d{1,2}:\d{2}(?:\s*[-~～]\s*\d{1,2}:\d{2})?)\s+/);
    if (timeMatch) {
      time = timeMatch[1];
      name = name.replace(timeMatch[0], '').trim();
    }

    // 2. 解析特色標籤 [ ]
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

// LocalStorage 踩點狀態切換與樣式聯動
export function toggleSubspotCheck(parentSpot, subspotName, checkboxEl) {
  const isChecked = checkboxEl.checked;
  const key = getSubspotCheckKey(parentSpot, subspotName);
  localStorage.setItem(key, isChecked ? 'true' : 'false');

  const labelEl = document.getElementById(`subspot-label-${parentSpot}-${subspotName}`);
  if (labelEl) {
    if (isChecked) {
      labelEl.classList.add('line-through', 'text-slate-500');
      labelEl.classList.remove('text-brand-text');
    } else {
      labelEl.classList.remove('line-through', 'text-slate-500');
      labelEl.classList.add('text-brand-text');
    }
  }
}
/* ----------------------------------------------------
   🗺️ 生成連續地圖導航 URL 輔助函式
---------------------------------------------------- */
export function buildContinuousMapUrl(mainSpot, subSpots) {
  if (!subSpots || subSpots.length === 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mainSpot)}`;
  }
  // 將主景點與子景點串接為多點導航路徑
  const waypoints = subSpots.map(s => s.name).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(mainSpot)}&destination=${encodeURIComponent(subSpots[subSpots.length - 1].name)}&waypoints=${encodeURIComponent(waypoints)}`;
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
