// ============================================================
// paipan_qimen_addon_v9.js  v9.2（命名空間版）
// 奇門基礎方法層
//
// 修正紀錄 v9.1→v9.2：
//   [NEW] 五行對應常數區（供 HTML 顯示顏色使用）
//         Paipan.wuxingColor     — 五行 → CSS 顏色
//         Paipan.starWuxing      — 九星 → 五行
//         Paipan.doorWuxing      — 八門 → 五行
//         Paipan.godWuxing       — 八神 → 五行
//         Paipan.tgWuxing        — 天干 → 五行
//         Paipan.dzWuxing        — 地支 → 五行
//   [NEW] 五行查詢工具函式
//         Paipan.getWuxing(type, name)  — 查詢任意名稱的五行
//         Paipan.getColor(type, name)   — 查詢任意名稱的顏色
//         Paipan.getWuxingColor(wx)     — 五行直接查顏色
//
// 修正紀錄 v9.0→v9.1：
//   [BUG1] _getYearJieqiList 遺漏快取邏輯，改用獨立快取
//          Paipan._jqObjCache（節氣物件陣列）
//          與 astro.js 的 Paipan._jqCache（JD陣列）分開
//   [BUG2] clearCache 補上清除 _jqObjCache
//
// 依賴（需先載入）：
//   paipan_standalone_astro.js  → Paipan.ctg/cdz/Jtime/GetAdjustedJQ
//   paipan_standalone_lunar.js  → Paipan.Solar2Lunar
//   paipan_standalone_gz.js     → Paipan.GetGZ
// ============================================================

var Paipan = window.Paipan || {};

// 快取（與 astro.js 的 _jqCache 分開）
Paipan._jiaziCache        = null;
Paipan._minutesJiaziCache = null;
Paipan._jqObjCache        = {}; // 節氣物件陣列快取（有別於 JD 陣列快取）

// ════════════════════════════════════════════════════════════
// 【五行常數區】v9.2 新增
// 所有對應關係均對照 kinqimen.py / config.py 原版
// ════════════════════════════════════════════════════════════

/**
 * 五行 → CSS 顏色
 * 傳統五行色：木=綠、火=紅、土=黃、金=白（金色）、水=黑（深藍）
 * 可依前端需求直接修改此對照表，不影響任何排盤邏輯
 */
Paipan.wuxingColor = {
  '木': '#4caf50',   // 綠
  '火': '#f44336',   // 紅
  '土': '#ff9800',   // 黃橙
  '金': '#ffc107',   // 金黃
  '水': '#2196f3'    // 藍
};

/**
 * 九星 → 五行
 * 對應 Python: config.star_wuxing
 * 蓬=水星(一白)、芮=土星(二黑)、沖=木星(三碧)、輔=木星(四綠)
 * 禽=土星(五黃)、心=火星(九紫)、柱=金星(六白)、任=土星(八白)、英=火星(九紫)
 */
Paipan.starWuxing = {
  '蓬': '水',
  '芮': '土',
  '沖': '木',
  '輔': '木',
  '禽': '土',
  '心': '金',
  '柱': '金',
  '任': '土',
  '英': '火'
};

/**
 * 八門 → 五行
 * 對應 Python: config.door_wuxing
 * 休=水、生=木、傷=木、杜=木、景=火、死=土、驚=金、開=金
 */
Paipan.doorWuxing = {
  '休': '水',
  '生': '土',
  '傷': '木',
  '杜': '木',
  '景': '火',
  '死': '土',
  '驚': '金',
  '開': '金'
};

/**
 * 八神（簡稱）→ 五行
 * 對應 Python: config.god_wuxing
 * 完整名稱：值符/騰蛇/太陰/六合/白虎/玄武/九天/九地
 * 簡稱：      符  /  蛇 /  陰 /  合 /  虎 /  武 /  天 /  地
 */
Paipan.godWuxing = {
  '符': '土',   // 值符
  '蛇': '火',   // 騰蛇
  '陰': '金',   // 太陰
  '合': '木',   // 六合
  '虎': '金',   // 白虎
  '武': '水',   // 玄武
  '天': '木',   // 九天
  '地': '土'    // 九地
};

/**
 * 天干 → 五行
 * 對應 Python: config.tg_wuxing
 */
Paipan.tgWuxing = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

/**
 * 地支 → 五行
 * 對應 Python: config.dz_wuxing
 */
Paipan.dzWuxing = {
  '子': '水', '丑': '土',
  '寅': '木', '卯': '木',
  '辰': '土', '巳': '火',
  '午': '火', '未': '土',
  '申': '金', '酉': '金',
  '戌': '土', '亥': '水'
};

/**
 * 五行旺衰狀態 → CSS 顏色（可選用，用於長生十二神顯示）
 * 旺相=亮色、休囚死=暗色
 */
Paipan.luckColor = {
  '長生': '#66bb6a',
  '沐浴': '#81c784',
  '冠帶': '#a5d6a7',
  '臨官': '#4caf50',
  '帝旺': '#2e7d32',
  '衰':   '#ffb74d',
  '病':   '#ff9800',
  '死':   '#e53935',
  '墓':   '#b71c1c',
  '絕':   '#9e9e9e',
  '胎':   '#90caf9',
  '養':   '#64b5f6'
};

// ════════════════════════════════════════════════════════════
// 【五行查詢工具】v9.2 新增
// ════════════════════════════════════════════════════════════

/**
 * getWuxing
 * 查詢任意名稱的五行屬性
 *
 * @param  {string} type  類型：'star'|'door'|'god'|'tg'|'dz'
 * @param  {string} name  名稱，如 '蓬'、'休'、'符'、'甲'、'子'
 * @return {string|null}  五行，如 '木'、'火'、'土'、'金'、'水'，查不到回傳 null
 *
 * 使用範例：
 *   Paipan.getWuxing('star', '蓬')  // → '水'
 *   Paipan.getWuxing('door', '休')  // → '水'
 *   Paipan.getWuxing('god',  '符')  // → '土'
 *   Paipan.getWuxing('tg',   '甲')  // → '木'
 *   Paipan.getWuxing('dz',   '子')  // → '水'
 */
Paipan.getWuxing = function(type, name) {
  var map = {
    'star': Paipan.starWuxing,
    'door': Paipan.doorWuxing,
    'god':  Paipan.godWuxing,
    'tg':   Paipan.tgWuxing,
    'dz':   Paipan.dzWuxing
  };
  var table = map[type];
  if (!table) return null;
  return table[name] || null;
};

/**
 * getWuxingColor
 * 五行直接查 CSS 顏色
 *
 * @param  {string} wx  五行，如 '木'
 * @return {string}     CSS 顏色字串，查不到回傳 '#888888'
 *
 * 使用範例：
 *   Paipan.getWuxingColor('木')  // → '#4caf50'
 */
Paipan.getWuxingColor = function(wx) {
  return Paipan.wuxingColor[wx] || '#888888';
};

/**
 * getColor
 * 查詢任意名稱的 CSS 顏色（type + name → 五行 → 顏色，一步到位）
 *
 * @param  {string} type  類型：'star'|'door'|'god'|'tg'|'dz'
 * @param  {string} name  名稱
 * @return {string}       CSS 顏色字串，查不到回傳 '#888888'
 *
 * 使用範例：
 *   Paipan.getColor('star', '蓬')  // → '#2196f3'（水=藍）
 *   Paipan.getColor('tg',   '甲')  // → '#4caf50'（木=綠）
 *   Paipan.getColor('door', '景')  // → '#f44336'（火=紅）
 */
Paipan.getColor = function(type, name) {
  var wx = Paipan.getWuxing(type, name);
  return Paipan.getWuxingColor(wx);
};

// ════════════════════════════════════════════════════════════
// 【工具】字串轉字元陣列
// ════════════════════════════════════════════════════════════

Paipan._toArr = function(s) {
  if (Array.isArray(s)) return s;
  return Array.from ? Array.from(s) : s.split('');
};

// ════════════════════════════════════════════════════════════
// 【區塊 0】基礎工具
// ════════════════════════════════════════════════════════════

Paipan.jiazi = function() {
  if (Paipan._jiaziCache) return Paipan._jiaziCache;
  var tg = Paipan._toArr(Paipan.ctg);
  var dz = Paipan._toArr(Paipan.cdz);
  var r  = [];
  for (var i = 0; i < 60; i++) r.push(tg[i % 10] + dz[i % 12]);
  Paipan._jiaziCache = r;
  return r;
};

Paipan.multiKeyDictGet = function(pairs, k) {
  for (var i = 0; i < pairs.length; i++) {
    if (pairs[i][0].indexOf(k) !== -1) return pairs[i][1];
  }
  return null;
};

Paipan.newList = function(olist, o) {
  var a = olist.indexOf(o);
  if (a === -1) return olist.slice();
  return olist.slice(a).concat(olist.slice(0, a));
};

Paipan.repeatList = function(n, thelist) {
  var r = [];
  for (var i = 0; i < thelist.length; i++)
    for (var j = 0; j < n; j++) r.push(thelist[i]);
  return r;
};

// ════════════════════════════════════════════════════════════
// 【區塊 1】五虎遁 / 五鼠遁 / 五馬遁
// ════════════════════════════════════════════════════════════

Paipan._fiveTigers = [
  [['甲','己'], '丙寅'], [['乙','庚'], '戊寅'],
  [['丙','辛'], '庚寅'], [['丁','壬'], '壬寅'],
  [['戊','癸'], '甲寅']
];
Paipan._fiveRats = [
  [['甲','己'], '甲子'], [['乙','庚'], '丙子'],
  [['丙','辛'], '戊子'], [['丁','壬'], '庚子'],
  [['戊','癸'], '壬子']
];
Paipan._fiveHorses = [
  [['丙','辛'], '甲午'], [['丁','壬'], '丙午'],
  [['戊','癸'], '戊午'], [['甲','己'], '庚午'],
  [['乙','庚'], '壬午']
];

Paipan.findLunarMonth = function(yearGZ) {
  var start = Paipan.multiKeyDictGet(Paipan._fiveTigers, yearGZ[0]);
  if (start === null)
    start = Paipan.multiKeyDictGet(Paipan._fiveTigers, yearGZ[1]);
  if (!start) return null;
  var list = Paipan.newList(Paipan.jiazi(), start).slice(0, 12);
  var r = {};
  for (var i = 0; i < 12; i++) r[i + 1] = list[i];
  return r;
};

Paipan.findLunarHour = function(dayGZ) {
  var start = Paipan.multiKeyDictGet(Paipan._fiveRats, dayGZ[0]);
  if (start === null)
    start = Paipan.multiKeyDictGet(Paipan._fiveRats, dayGZ[1]);
  if (!start) return null;
  var list = Paipan.newList(Paipan.jiazi(), start).slice(0, 12);
  var dz   = Paipan._toArr(Paipan.cdz);
  var r    = {};
  for (var i = 0; i < 12; i++) r[dz[i]] = list[i];
  return r;
};

Paipan.findLunarKe = function(hourGZ) {
  var start = Paipan.multiKeyDictGet(Paipan._fiveHorses, hourGZ[0]);
  if (start === null)
    start = Paipan.multiKeyDictGet(Paipan._fiveHorses, hourGZ[1]);
  if (!start) return null;
  return Paipan.newList(Paipan.jiazi(), start);
};

Paipan.keJiaziDict = function(ziGZ) {
  var keList = Paipan.findLunarKe(ziGZ);
  if (!keList) return {};
  var r = {}, idx = 0;
  for (var h = 0; h < 24; h++)
    for (var m = 0; m < 6; m++) {
      r[h + ':' + m + '0'] = keList[idx % 60];
      idx++;
    }
  return r;
};

Paipan.minutesJiaziDict = function() {
  if (Paipan._minutesJiaziCache) return Paipan._minutesJiaziCache;
  var repeated = Paipan.repeatList(2, Paipan.jiazi());
  var r = {}, idx = 0;
  for (var h = 0; h < 24; h++)
    for (var m = 0; m < 60; m++) {
      r[h + ':' + m] = repeated[idx % 120];
      idx++;
    }
  Paipan._minutesJiaziCache = r;
  return r;
};

// ════════════════════════════════════════════════════════════
// 【區塊 2】農曆查詢
// ════════════════════════════════════════════════════════════

Paipan.getLunarDate = function(year, month, day) {
  var lunarM = ['占位','正月','二月','三月','四月','五月','六月',
                '七月','八月','九月','十月','冬月','腊月'];
  var lunar  = Paipan.Solar2Lunar(year, month, day);
  if (!lunar) return null;
  var lm = parseInt(lunar[1], 10);
  return {
    年:    lunar[0],
    農曆月: lunarM[lm] || (lm + '月'),
    月:    lm,
    日:    lunar[2]
  };
};

// ════════════════════════════════════════════════════════════
// 【區塊 3】四柱 + 五柱干支
// ════════════════════════════════════════════════════════════

Paipan._tgdzToGZ = function(tg, dz) {
  var tgArr = Paipan._toArr(Paipan.ctg);
  var dzArr = Paipan._toArr(Paipan.cdz);
  return [
    tgArr[tg[0]] + dzArr[dz[0]],
    tgArr[tg[1]] + dzArr[dz[1]],
    tgArr[tg[2]] + dzArr[dz[2]],
    tgArr[tg[3]] + dzArr[dz[3]]
  ];
};

Paipan.getGangzhi1 = function(year, month, day, hour, minute) {
  var raw = Paipan.GetGZ(year, month, day, hour, minute, 1);
  if (!raw) return [null, null, null, null];

  var gz  = Paipan._tgdzToGZ(raw[0], raw[1]);
  var yTG = gz[0], mTG = gz[1], dTG = gz[2], hTG = gz[3];

  var mTG1;
  if (year < 1900) {
    var lunarInfo     = Paipan.getLunarDate(year, month, day);
    var lunarMonthNum = lunarInfo ? lunarInfo.月 : null;
    var monthMap      = Paipan.findLunarMonth(yTG);
    mTG1 = (monthMap && lunarMonthNum)
           ? (monthMap[lunarMonthNum] || mTG) : mTG;
  } else {
    mTG1 = mTG;
  }

  var hourMap = Paipan.findLunarHour(dTG);
  var hTG1    = (hourMap && hTG) ? (hourMap[hTG[1]] || hTG) : hTG;

  return [yTG, mTG1, dTG, hTG1];
};

Paipan.getGangzhi = function(year, month, day, hour, minute) {
  var gz4 = Paipan.getGangzhi1(year, month, day, hour, minute);
  var zi  = Paipan.getGangzhi1(year, month, day, 0, 0)[3];

  var reminute;
  if      (minute < 10) reminute = '00';
  else if (minute < 20) reminute = '10';
  else if (minute < 30) reminute = '20';
  else if (minute < 40) reminute = '30';
  else if (minute < 50) reminute = '40';
  else                  reminute = '50';

  var key           = String(hour) + ':' + reminute;
  var gangzhiMinute = zi ? (Paipan.keJiaziDict(zi)[key] || null) : null;

  return [gz4[0], gz4[1], gz4[2], gz4[3], gangzhiMinute];
};

// ════════════════════════════════════════════════════════════
// 【區塊 4】節氣查詢
// ════════════════════════════════════════════════════════════

Paipan._jqNamesFromSpring = [
  '春分','清明','穀雨','立夏','小滿','芒種',
  '夏至','小暑','大暑','立秋','處暑','白露',
  '秋分','寒露','霜降','立冬','小雪','大雪',
  '冬至','小寒','大寒','立春','雨水','驚蟄'
];

/**
 * 取得某年節氣物件陣列（含名稱、時間戳等）
 * 使用獨立的 _jqObjCache，不與 astro.js 的 _jqCache（JD陣列）混用
 */
Paipan._getYearJieqiList = function(yy) {
  if (Paipan._jqObjCache[yy]) return Paipan._jqObjCache[yy];

  var jqJDs  = Paipan.GetAdjustedJQ(yy); // JD陣列（astro.js 已快取）
  var result = [];
  for (var i = 0; i < 24; i++) {
    var dt = Paipan.Jtime(jqJDs[i]);
    result.push({
      名稱:   Paipan._jqNamesFromSpring[i],
      年: dt[0], 月: dt[1], 日: dt[2],
      時: dt[3], 分: dt[4],
      jd:     jqJDs[i],
      時間戳: new Date(dt[0], dt[1]-1, dt[2], dt[3], dt[4])
    });
  }
  result.sort(function(a, b) { return a.jd - b.jd; });

  Paipan._jqObjCache[yy] = result;
  return result;
};

Paipan.getCurrentJieqi = function(year, month, day, hour, minute) {
  var target = new Date(year, month-1, day, hour, minute);
  var allJQ  = Paipan._getYearJieqiList(year-1)
                 .concat(Paipan._getYearJieqiList(year))
                 .concat(Paipan._getYearJieqiList(year+1));
  allJQ.sort(function(a, b) { return a.jd - b.jd; });
  var found = null;
  for (var i = allJQ.length - 1; i >= 0; i--) {
    if (allJQ[i].時間戳 <= target) { found = allJQ[i]; break; }
  }
  return found;
};

Paipan.getNextJieqi = function(year, month, day, hour, minute) {
  var target = new Date(year, month-1, day, hour, minute);
  var allJQ  = Paipan._getYearJieqiList(year)
                 .concat(Paipan._getYearJieqiList(year+1));
  allJQ.sort(function(a, b) { return a.jd - b.jd; });
  for (var i = 0; i < allJQ.length; i++) {
    if (allJQ[i].時間戳 > target) return allJQ[i];
  }
  return null;
};

Paipan.getBeforeJieqi = function(year, month, day, hour, minute) {
  var startDate = new Date(year, month-1, day);
  startDate.setDate(startDate.getDate() - 15);
  var allJQ = Paipan._getYearJieqiList(year-1)
                .concat(Paipan._getYearJieqiList(year));
  allJQ.sort(function(a, b) { return b.jd - a.jd; });
  for (var i = 0; i < allJQ.length; i++) {
    if (allJQ[i].時間戳 < startDate) return allJQ[i];
  }
  return null;
};

Paipan.jq = function(year, month, day, hour, minute) {
  var current = new Date(year, month-1, day, hour, minute);
  var curJQ   = Paipan.getCurrentJieqi(year, month, day, hour, minute);
  var nextJQ  = Paipan.getNextJieqi(year, month, day, hour, minute);
  if (!curJQ || !nextJQ) return null;
  if (curJQ.時間戳 <= current && current < nextJQ.時間戳)
    return curJQ.名稱;
  if (current < curJQ.時間戳) {
    var prevJQ = Paipan.getBeforeJieqi(year, month, day, hour, minute);
    return prevJQ ? prevJQ.名稱 : null;
  }
  return null;
};

// ════════════════════════════════════════════════════════════
// 【區塊 5】統一入口
// ════════════════════════════════════════════════════════════

Paipan.getQimenBaseData = function(year, month, day, hour, minute) {
  var gz5    = Paipan.getGangzhi(year, month, day, hour, minute);
  var lunar  = Paipan.getLunarDate(year, month, day);
  var curJQ  = Paipan.getCurrentJieqi(year, month, day, hour, minute);
  var nextJQ = Paipan.getNextJieqi(year, month, day, hour, minute);
  var prevJQ = Paipan.getBeforeJieqi(year, month, day, hour, minute);
  var jqName = Paipan.jq(year, month, day, hour, minute);
  return {
    年柱: gz5[0], 月柱: gz5[1], 日柱: gz5[2],
    時柱: gz5[3], 刻柱: gz5[4],
    節氣名稱: jqName,
    當前節氣: curJQ, 下一節氣: nextJQ, 上一節氣: prevJQ,
    農曆:     lunar,
    六十甲子: Paipan.jiazi(),
    天干:     Paipan._toArr(Paipan.ctg),
    地支:     Paipan._toArr(Paipan.cdz)
  };
};

/**
 * clearCache
 * 清除所有快取：
 *   _jqCache     — astro.js 的 JD 陣列快取
 *   _jqObjCache  — addon 的節氣物件陣列快取
 *   _jiaziCache / _minutesJiaziCache
 */
Paipan.clearCache = function() {
  Paipan._jqCache           = {};  // astro.js JD快取
  Paipan._jqObjCache        = {};  // addon 節氣物件快取
  Paipan._jiaziCache        = null;
  Paipan._minutesJiaziCache = null;
};

window.Paipan = Paipan;