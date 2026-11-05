export const CONFIG = {
    // GAS  Web App URL(dev1.0行程表大改測試版)  -  2026/10/19
    GAS_API_URL:""
};
    
    export const WEEK_DAYS = ['(日)', '(一)', '(二)', '(三)', '(四)', '(五)', '(六)'];
    export const WEEK_KEYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 📋 核心資料結構合約 (Data Contract Schema Reference)
 * 供前後端與 AI 協作時對齊欄位名稱使用，嚴禁任意更改拼寫：
 * 
 * 1. 根目錄 API 回傳結構 (Result JSON):
 *    - status: 'success' | 'error'
 *    - updatedAt: 字串 (更新時間)
 *    - schedule: { days: Array, timeline: Object }
 *    - restaurants: Object (key 為店家名稱)
 *    - attractions: Object (key 為景點名稱)
 *    - transport: Object (key 為 Route_Key，例如 "A站➔B站") 👉 注意是單數 transport！
 * 
 * 2. 每日行程細節物件 (Day Item Slot):
 *    - time: 字串 (到達時間，例 "09:00")
 *    - name: 字串 (景點或交通路由名稱)
 *    - duration: 數字 (停留分鐘數)
 *    - departure: 字串 (離開時間)
 *    - notice: 字串 (備註或管道提醒)
 * 
 * 3. 每日體能與步數預警看板 (Fitness Info):
 *    - totalSteps: 數字 (預估步數)
 *    - totalWalkMin: 數字 (總步行分鐘)
 *    - totalDistM: 數字 (總距離公尺)
 *    - status: 字串 (燈號狀態，含 🟢、🟡、🔴)
 *    - summaryText: 字串 (完整預警摘要)
 * 
 * 4. 交通資料庫欄位 (Transport Table):
 *    - From: 出發地
 *    - To: 目的地
 *    - Route_Key: 路由鍵 ("From➔To")
 *    - walk_dist_m: 步行距離 (公尺)
 *    - walk_time_min: 步行時間 (分鐘)
 *    - difficulty_load: 難度系數
 *    - Fee: 費用
 *    - Time / Duration: 行車時間
 *    - Timetable / TimeTable: 班次時刻表
 *    - Shortcut / ShortcutURL / Gmap_URL: 導航捷徑網址
 */