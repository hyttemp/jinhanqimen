// ============================================================
// paipan_standalone_gz.js  v2.6（命名空間版）
// 四柱干支計算層
//
// 修正紀錄 v2.5→v2.6：
//   [FEATURE] 新增 Paipan.CheckHai(dzName)
//             地支相害查詢，輸入地支字串，輸出相害地支資訊
//
// 修正紀錄 v2.4→v2.5：
//   [CHANGE] GetSanHe / CheckChong / CheckXing
//            輸入改為地支字串（'子'～'亥'），不再使用索引
//
// 修正紀錄 v2.3→v2.4：
//   [FEATURE] 新增地支工具函式
//     - Paipan.GetSanHe(dzName)              地支三合 + 後天八卦方位
//     - Paipan.CheckChong(dzName)            取得相沖地支
//     - Paipan.CheckXing(dzNameA, dzNameB)   判斷兩地支是否構成三刑
//
// 修正紀錄 v2.2→v2.3：
//   [BUG FIX] 日柱 dayBase 錯誤
//     原：var dayBase = 2435552;  （1956-01-24，非甲子日）
//     改：var dayBase = 2451551;  （2000-01-07，確認為甲子日）
//     驗證：(Jdays(2026,4,16,12,0,0) - 2451551) % 60 = 56 → 庚申 ✅
//
// 修正紀錄 v2.1→v2.2：
//   [BUG FIX] 年柱立春基準錯誤
//     原：jq1[21]（下一年立春）→ 改：jq0[21]（當年立春）
//
// 提供：
//   Paipan.GetGZ(yy, mm, dd, hh, mt, ss)
//   Paipan.GetSanHe(dzName)
//   Paipan.CheckChong(dzName)
//   Paipan.CheckXing(dzNameA, dzNameB)
//   Paipan.CheckHai(dzName)
// 依賴：paipan_standalone_astro.js 先載入
//   Paipan.Jdays / Paipan.GetAdjustedJQ / Paipan.zwz
// ============================================================

var Paipan = window.Paipan || {};

// ── 共用常數（模組內部共享）─────────────────────────────────

var _DZ_NAMES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 每個地支對應的後天八卦（index 與 _DZ_NAMES 對齊）
var _DZ_GUA = [
  { gua: '坎', direction: '北'  }, // 0  子
  { gua: '艮', direction: '東北' }, // 1  丑
  { gua: '艮', direction: '東北' }, // 2  寅
  { gua: '震', direction: '東'  }, // 3  卯
  { gua: '巽', direction: '東南' }, // 4  辰
  { gua: '巽', direction: '東南' }, // 5  巳
  { gua: '離', direction: '南'  }, // 6  午
  { gua: '坤', direction: '西南' }, // 7  未
  { gua: '坤', direction: '西南' }, // 8  申
  { gua: '兌', direction: '西'  }, // 9  酉
  { gua: '乾', direction: '西北' }, // 10 戌
  { gua: '乾', direction: '西北' }, // 11 亥
];

// 地支相沖對（索引）：子↔午 丑↔未 寅↔申 卯↔酉 辰↔戌 巳↔亥
var _CHONG_MAP = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5];

// 地支相害對（索引）：子↔未 丑↔午 寅↔巳 卯↔辰 申↔亥 酉↔戌
var _HAI_MAP = [7, 6, 5, 4, 3, 2, 1, 0, 11, 10, 9, 8];
//              子  丑  寅  卯  辰  巳  午  未  申  酉  戌  亥

// 三刑規則（使用地支索引）
var _XING_RULES = [
  { type: 'mutual', name: '子卯相刑',   members: [0, 3],    description: '子卯無禮之刑'  },
  { type: 'triple', name: '寅巳申三刑', members: [2, 5, 8], description: '寅巳申無恩之刑'},
  { type: 'triple', name: '丑未戌三刑', members: [1, 7, 10],description: '丑未戌持勢之刑'},
  { type: 'self',   name: '辰辰自刑',   members: [4, 4],    description: '辰自刑'        },
  { type: 'self',   name: '午午自刑',   members: [6, 6],    description: '午自刑'        },  // ← 補上
  { type: 'self',   name: '酉酉自刑',   members: [9, 9],    description: '酉自刑'        },
  { type: 'self',   name: '亥亥自刑',   members: [11, 11],  description: '亥自刑'        },
];


// 四組三合局（索引）
var _SAN_HE = [
  { group: [8, 0, 4],  ju: '水局' }, // 申子辰
  { group: [11, 3, 7], ju: '木局' }, // 亥卯未
  { group: [2, 6, 10], ju: '火局' }, // 寅午戌
  { group: [5, 9, 1],  ju: '金局' }, // 巳酉丑
];

// ── 私有輔助函式 ─────────────────────────────────────────────

/**
 * 地支字串 → 索引（0–11），無效輸入回傳 -1
 */
function _dzNameToIdx(name) {
  return _DZ_NAMES.indexOf(name);
}

/**
 * 地支索引 → 完整資訊物件
 */
function _dzInfo(idx) {
  return {
    dz       : idx,
    name     : _DZ_NAMES[idx],
    gua      : _DZ_GUA[idx].gua,
    direction: _DZ_GUA[idx].direction
  };
}

// ── GetGZ ────────────────────────────────────────────────────

Paipan.GetGZ = function(yy, mm, dd, hh, mt, ss) {
  hh = hh || 0; mt = mt || 0; ss = ss || 0;
  if (mt + ss === 0) ss = 10;

  var jd  = Paipan.Jdays(yy, mm, dd, hh, mt, ss);
  var jq1 = Paipan.GetAdjustedJQ(yy);
  var jq0 = Paipan.GetAdjustedJQ(yy - 1);

  // ── 年柱（以立春為界）
  var lichunThisYear = jq0[21];
  var yearGZ  = (jd >= lichunThisYear) ? yy : yy - 1;
  var yearIdx = ((yearGZ - 1984) % 60 + 60) % 60;
  var yTG     = yearIdx % 10;
  var yDZ     = yearIdx % 12;

  // ── 月柱
  var jieIdxArr   = [21, 23,  1,  3,  5,  7,  9, 11, 13, 15, 17, 19];
  var jieDZArr    = [ 2,  3,  4,  5,  6,  7,  8,  9, 10, 11,  0,  1];
  var isTransYear = [true, true, false, false, false, false,
                     false, false, false, false, false, true];

  var allJieArr = [];
  for (var ki = 0; ki < jieIdxArr.length; ki++) {
    var idx = jieIdxArr[ki];
    var dz  = jieDZArr[ki];
    if (idx < jq1.length)
      allJieArr.push({ jd: jq1[idx], dz: dz });
    if (isTransYear[ki] && idx < jq0.length)
      allJieArr.push({ jd: jq0[idx], dz: dz });
  }
  allJieArr.sort(function(a, b) { return a.jd - b.jd; });

  var mDZ = 2;
  for (var ki = allJieArr.length - 1; ki >= 0; ki--) {
    if (jd >= allJieArr[ki].jd) { mDZ = allJieArr[ki].dz; break; }
  }

  var mTGStart = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0];
  var mTG      = (mTGStart[yTG] + ((mDZ - 2 + 12) % 12)) % 10;

  // ── 日柱
  var jdNoon  = Math.floor(jd + 0.5);
  var dayBase = 2451551;  // 2000-01-07 甲子日
  var dIdx    = ((jdNoon - dayBase) % 60 + 60) % 60;
  var dTG     = dIdx % 10;
  var dDZ     = dIdx % 12;

  // ── 時柱（含晚子時 zwz 處理）
  var dTGf = dTG, dDZf = dDZ;
  var hh2  = hh;
  if (Paipan.zwz && hh >= 23) {
    var dIdxNext = (dIdx + 1) % 60;
    dTGf = dIdxNext % 10;
    dDZf = dIdxNext % 12;
    hh2  = 0;
  }

  var hDZ      = Math.floor((hh2 + 1) / 2) % 12;
  var hTGStart = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
  var hTG      = (hTGStart[dTGf] + hDZ) % 10;

  return [
    [yTG,  mTG,  dTGf, hTG],
    [yDZ,  mDZ,  dDZf, hDZ],
    { ty: yearGZ, jr: jq1 }
  ];
};

// ── GetSanHe ─────────────────────────────────────────────────
/**
 * 地支三合查詢
 * @param {string} dzName - 地支字串（'子'～'亥'）
 * @returns {object|null}
 *   {
 *     input    : { dz, name, gua, direction },
 *     group    : [number, number, number],
 *     partners : [number, number],
 *     result   : [{ dz, name, gua, direction }, ...],
 *     ju       : string
 *   }
 */
Paipan.GetSanHe = function(dzName) {
  var dz = _dzNameToIdx(dzName);
  if (dz === -1) return null;

  for (var i = 0; i < _SAN_HE.length; i++) {
    var entry = _SAN_HE[i];
    var pos   = entry.group.indexOf(dz);

    if (pos !== -1) {
      var partners = entry.group.filter(function(v) { return v !== dz; });

      return {
        input   : _dzInfo(dz),
        group   : entry.group.slice(),
        partners: partners,
        result  : partners.map(function(v) { return _dzInfo(v); }),
        ju      : entry.ju
      };
    }
  }

  return null;
};

// ── CheckChong ───────────────────────────────────────────────
/**
 * 取得地支的相沖地支
 * @param {string} dzName - 地支字串（'子'～'亥'）
 * @returns {object|null}
 *   {
 *     input  : { dz, name, gua, direction },
 *     chong  : { dz, name, gua, direction },
 *     message: string
 *   }
 */
Paipan.CheckChong = function(dzName) {
  var dz = _dzNameToIdx(dzName);
  if (dz === -1) return null;

  var chongDZ = _CHONG_MAP[dz];

  return {
    input  : _dzInfo(dz),
    chong  : _dzInfo(chongDZ),
    message: _DZ_NAMES[dz] + ' 與 ' + _DZ_NAMES[chongDZ] + ' 相沖'
  };
};

// ── CheckXing ────────────────────────────────────────────────
/**
 * 判斷兩個地支是否構成三刑
 * @param {string} dzNameA - 地支字串A（'子'～'亥'）
 * @param {string} dzNameB - 地支字串B（'子'～'亥'）
 * @returns {object|null}
 *   {
 *     inputA     : { dz, name, gua, direction },
 *     inputB     : { dz, name, gua, direction },
 *     isXing     : boolean,
 *     xingType   : string|null,
 *     xingName   : string|null,
 *     description: string|null,
 *     message    : string
 *   }
 */
Paipan.CheckXing = function(dzNameA, dzNameB) {
  var dzA = _dzNameToIdx(dzNameA);
  var dzB = _dzNameToIdx(dzNameB);
  if (dzA === -1 || dzB === -1) return null;

  for (var i = 0; i < _XING_RULES.length; i++) {
    var rule    = _XING_RULES[i];
    var members = rule.members;
    var matched = false;

    if (rule.type === 'self') {
      matched = (dzA === dzB) && (members[0] === dzA);
    } else {
      matched = (members.indexOf(dzA) !== -1) &&
                (members.indexOf(dzB) !== -1) &&
                (dzA !== dzB);
    }

    if (matched) {
      return {
        inputA     : _dzInfo(dzA),
        inputB     : _dzInfo(dzB),
        isXing     : true,
        xingType   : rule.type,
        xingName   : rule.name,
        description: rule.description,
        message    : _DZ_NAMES[dzA] + ' 與 ' + _DZ_NAMES[dzB] +
                     ' 構成三刑【' + rule.name + '】— ' + rule.description
      };
    }
  }

  return {
    inputA     : _dzInfo(dzA),
    inputB     : _dzInfo(dzB),
    isXing     : false,
    xingType   : null,
    xingName   : null,
    description: null,
    message    : _DZ_NAMES[dzA] + ' 與 ' + _DZ_NAMES[dzB] + ' 不構成三刑'
  };
};

// ── CheckHai ─────────────────────────────────────────────────
/**
 * 取得地支的相害地支
 * @param {string} dzName - 地支字串（'子'～'亥'）
 * @returns {object|null}
 *   {
 *     input  : { dz, name, gua, direction }, // 查詢地支本身
 *     hai    : { dz, name, gua, direction }, // 相害地支
 *     message: string
 *   }
 *   輸入不合法時回傳 null
 */
Paipan.CheckHai = function(dzName) {
  var dz = _dzNameToIdx(dzName);
  if (dz === -1) return null;

  var haiDZ = _HAI_MAP[dz];

  return {
    input  : _dzInfo(dz),
    hai    : _dzInfo(haiDZ),
    message: _DZ_NAMES[dz] + ' 與 ' + _DZ_NAMES[haiDZ] + ' 相害'
  };
};

window.Paipan = Paipan;
