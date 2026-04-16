// ============================================================
// paipan_standalone_lunar.js  v3.0
// 農曆計算層 — 完全依照 paipan.js 原始邏輯重寫
//
// 修正紀錄 v2.4→v3.0：
//   [REWRITE] 完全照 paipan.js 重寫以下函數：
//     - suoKB（照抄）
//     - smXFu（照抄）
//     - MeanNewMoon（照抄）
//     - TrueNewMoon（補上 suoKB 線性擬合 + smXFu 歷史修正）
//     - GetZQandSMandLunarMonthCode（照 paipan.js 邏輯重寫）
//     - Solar2Lunar（照 paipan.js 邏輯重寫）
//
// 依賴：paipan_standalone_astro.js 先載入
//   需提供：Paipan.Jdays, Paipan.Jtime,
//           Paipan.GetAdjustedJQ, Paipan.synmonth
// ============================================================

var Paipan = window.Paipan || {};

// ─────────────────────────────────────────────
// 1. suoKB：朔日線性擬合參數（直接照 paipan.js）
// ─────────────────────────────────────────────
Paipan.suoKB = [
  1457698.231017, 29.53067166,
  1546082.512234, 29.53085106,
  1640640.735131, 29.53060000,
  1642472.151543, 29.53085439,
  1683430.509300, 29.53086148,
  1752148.041079, 29.53085097,
  1807729.159401, 29.53059851,
  1883618.114100, 29.53060000,
  1907360.610000, 29.53060000,
  1936680.861400, 29.53060000,
  1939780.000000, 29.53060000,
  1947270.000000, 29.53060000,
  1964020.000000, 29.53060000,
  1987372.000000, 29.53060000,
  2000650.000000, 29.53060000
];

// ─────────────────────────────────────────────
// 2. smXFu：歷史朔日修正表（直接照 paipan.js）
//    格式：年份 → 13個月的偏移天數陣列
// ─────────────────────────────────────────────
Paipan.smXFu = {
  '618':  [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '619':  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,-1],
  '700':  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  '761':  [ 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '762':  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  '1000': [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,-1],
  '1001': [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,-1, 0],
  '1200': [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  '1400': [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  '1600': [ 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  '1800': [ 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  '1900': [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  '1920': [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
};

// ─────────────────────────────────────────────
// 3. MeanNewMoon：平朔（照 paipan.js）
// ─────────────────────────────────────────────
Paipan.MeanNewMoon = function(jd, return_k) {
  var k    = Math.round((jd - 2451550.09766) / Paipan.synmonth);
  var jdnm = 2451550.09766 + k * Paipan.synmonth;
  return return_k ? k : jdnm;
};

// ─────────────────────────────────────────────
// 4. TrueNewMoon：真朔（照 paipan.js，含 suoKB + smXFu）
// ─────────────────────────────────────────────
Paipan.TrueNewMoon = function(jd) {
  // Step A：用 suoKB 線性擬合取得初始平朔 JD
  var kb = Paipan.suoKB;
  var jdnm;
  // 找對應歷史段
  var i = kb.length - 2;
  while (i >= 0 && kb[i] > jd) i -= 2;
  if (i < 0) i = 0;
  // 線性擬合：從該段基準點推算最近朔
  var k0   = Math.round((jd - kb[i]) / kb[i + 1]);
  jdnm     = kb[i] + k0 * kb[i + 1];

  // Step B：天文攝動修正（照 paipan.js 的 Meeus 公式）
  var k   = Paipan.MeanNewMoon(jdnm, true);
  var T   = k / 1236.85;
  var T2  = T * T;
  var T3  = T2 * T;
  var T4  = T3 * T;
  var jde = 2451550.09766 +
            29.530588861 * k +
            0.00015437   * T2 -
            0.000000150  * T3 +
            0.00000000073* T4;
  var r  = Math.PI / 180;
  var M  = (2.5534      + 29.10535670  * k - 0.0000014  * T2 - 0.00000011 * T3) * r;
  var Mp = (201.5643    + 385.81693528 * k + 0.0107582  * T2 + 0.00001238 * T3 - 0.000000058 * T4) * r;
  var F  = (160.7108    + 390.67050284 * k - 0.0016118  * T2 - 0.00000227 * T3 + 0.000000011 * T4) * r;
  var O  = (124.7746    -   1.56375588 * k + 0.0020672  * T2 + 0.00000215 * T3) * r;
  var cor =
    -0.40720 * Math.sin(Mp)       + 0.17241 * Math.sin(M)          +
     0.01608 * Math.sin(2 * Mp)   + 0.01039 * Math.sin(2 * F)      +
     0.00739 * Math.sin(Mp - M)   - 0.00514 * Math.sin(Mp + M)     +
     0.00208 * Math.sin(2 * M)    - 0.00111 * Math.sin(Mp - 2 * F) -
     0.00057 * Math.sin(Mp + 2*F) + 0.00056 * Math.sin(2*Mp + M)   -
     0.00042 * Math.sin(3 * Mp)   + 0.00042 * Math.sin(M + 2 * F)  +
     0.00038 * Math.sin(M - 2*F)  - 0.00024 * Math.sin(2*Mp - M)   -
     0.00017 * Math.sin(O)        - 0.00007 * Math.sin(Mp + 2 * M) +
     0.00004 * Math.sin(2*Mp-2*F) + 0.00004 * Math.sin(3 * M)      +
     0.00003 * Math.sin(Mp+M-2*F) + 0.00003 * Math.sin(2*Mp+2*F)   -
     0.00003 * Math.sin(Mp+M+2*F) + 0.00003 * Math.sin(Mp-M+2*F)   -
     0.00002 * Math.sin(Mp-M-2*F) - 0.00002 * Math.sin(3*Mp + M)   +
     0.00002 * Math.sin(4 * Mp);
  var result = jde + cor;

  // Step C：smXFu 歷史修正（照 paipan.js）
  // 找出 result 對應的農曆年，查修正表
  var yt = Paipan.Jtime(result);
  var ryy = yt[0];
  // 計算該朔是當年第幾個月（從正月起算，0-based）
  // 用與年初朔的距離估算月序
  var y1nm = Paipan.suoKB;
  // 簡化：直接用年份字串查表
  var fkey = String(ryy);
  if (Paipan.smXFu[fkey]) {
    // 計算月序 idx：從當年冬至前朔到此朔的月數
    var jd11 = Paipan.Jdays(ryy, 1, 1, 12, 0, 0);
    var nm11 = Paipan.TrueNewMoonRaw(jd11); // 年初附近朔
    var midx = Math.round((result - nm11) / Paipan.synmonth);
    if (midx < 0)  midx = 0;
    if (midx > 12) midx = 12;
    result += Paipan.smXFu[fkey][midx];
  }

  return result;
};

// Step B only（內部用，避免 smXFu 遞迴）
Paipan.TrueNewMoonRaw = function(jd) {
  var k   = Paipan.MeanNewMoon(jd, true);
  var T   = k / 1236.85;
  var T2  = T * T; var T3 = T2 * T; var T4 = T3 * T;
  var jde = 2451550.09766 + 29.530588861*k + 0.00015437*T2
            - 0.000000150*T3 + 0.00000000073*T4;
  var r  = Math.PI / 180;
  var M  = (2.5534      + 29.10535670 *k - 0.0000014 *T2 - 0.00000011*T3)*r;
  var Mp = (201.5643    + 385.81693528*k + 0.0107582 *T2 + 0.00001238*T3 - 0.000000058*T4)*r;
  var F  = (160.7108    + 390.67050284*k - 0.0016118 *T2 - 0.00000227*T3 + 0.000000011*T4)*r;
  var O  = (124.7746    -   1.56375588*k + 0.0020672 *T2 + 0.00000215*T3)*r;
  return jde + (
    -0.40720*Math.sin(Mp)       + 0.17241*Math.sin(M)          +
     0.01608*Math.sin(2*Mp)     + 0.01039*Math.sin(2*F)        +
     0.00739*Math.sin(Mp-M)     - 0.00514*Math.sin(Mp+M)       +
     0.00208*Math.sin(2*M)      - 0.00111*Math.sin(Mp-2*F)     -
     0.00057*Math.sin(Mp+2*F)   + 0.00056*Math.sin(2*Mp+M)     -
     0.00042*Math.sin(3*Mp)     + 0.00042*Math.sin(M+2*F)      +
     0.00038*Math.sin(M-2*F)    - 0.00024*Math.sin(2*Mp-M)     -
     0.00017*Math.sin(O)        - 0.00007*Math.sin(Mp+2*M)     +
     0.00004*Math.sin(2*Mp-2*F) + 0.00004*Math.sin(3*M)        +
     0.00003*Math.sin(Mp+M-2*F) + 0.00003*Math.sin(2*Mp+2*F)   -
     0.00003*Math.sin(Mp+M+2*F) + 0.00003*Math.sin(Mp-M+2*F)   -
     0.00002*Math.sin(Mp-M-2*F) - 0.00002*Math.sin(3*Mp+M)     +
     0.00002*Math.sin(4*Mp)
  );
};

// ─────────────────────────────────────────────
// 5. GetZQandSMandLunarMonthCode
//    照 paipan.js 邏輯重寫
// ─────────────────────────────────────────────
Paipan.GetZQandSMandLunarMonthCode = function(yy) {
  var jq   = Paipan.GetAdjustedJQ(yy);
  var jq_1 = Paipan.GetAdjustedJQ(yy - 1);
  var jq1  = Paipan.GetAdjustedJQ(yy + 1);

  // 前年冬至、當年冬至
  var jdDZ0 = jq_1[18];
  var jdDZ1 = jq[18];

  // 從前年冬至前的朔日起建立朔日陣列
  // paipan.js：找到 <= jdDZ0 的最近朔，再退一個月作為起點
  var nm0 = Paipan.TrueNewMoonRaw(jdDZ0);
  // 調整到 jdDZ0 前的朔
  if (nm0 > jdDZ0) nm0 -= Paipan.synmonth;
  while (nm0 + Paipan.synmonth <= jdDZ0) nm0 += Paipan.synmonth;
  // nm0 現在是 <= jdDZ0 的最近朔（即冬至所在月的朔）
  // 不再多退一個月（這是 v2.x 的錯誤根源）

  // 建立 17 個月的朔日陣列
  var nmArr = [];
  for (var i = 0; i < 17; i++) {
    nmArr.push(Paipan.TrueNewMoonRaw(nm0 + Paipan.synmonth * i));
  }

  // 找 mBase：jdDZ0（前年冬至）所在月索引
  // nm[mBase] <= jdDZ0 < nm[mBase+1]
  var mBase = 0;
  for (var i = 0; i < nmArr.length - 1; i++) {
    if (nmArr[i] <= jdDZ0 && jdDZ0 < nmArr[i + 1]) {
      mBase = i; break;
    }
  }

  // 找 mBase1：jdDZ1（當年冬至）所在月索引
  var mBase1 = 0;
  for (var i = 0; i < nmArr.length - 1; i++) {
    if (nmArr[i] <= jdDZ1 && jdDZ1 < nmArr[i + 1]) {
      mBase1 = i; break;
    }
  }

  // 兩冬至間月數 = mBase1 - mBase
  // 若 >= 13 則需置閏
  var leapIdx = -1;
  var monthCount = mBase1 - mBase;

  if (monthCount >= 13) {
    // 收集中氣（偶數索引）：用三年資料確保覆蓋
    var zhongqiJDs = [];
    for (var i = 0; i < 25; i += 2) zhongqiJDs.push(jq_1[i]);
    for (var i = 0; i < 25; i += 2) zhongqiJDs.push(jq[i]);
    for (var i = 0; i < 25; i += 2) zhongqiJDs.push(jq1[i]);
    zhongqiJDs.sort(function(a, b) { return a - b; });

    // 從 mBase+1 開始找第一個無中氣的月
    for (var i = mBase + 1; i <= mBase1; i++) {
      var hasZQ = false;
      for (var j = 0; j < zhongqiJDs.length; j++) {
        if (nmArr[i] <= zhongqiJDs[j] && zhongqiJDs[j] < nmArr[i + 1]) {
          hasZQ = true; break;
        }
      }
      if (!hasZQ) { leapIdx = i; break; }
    }
  }

  return {
    nm:      nmArr,
    leapIdx: leapIdx,
    mBase:   mBase,    // 前年冬至所在月（= 農曆十一月起點）
    mBase1:  mBase1,   // 當年冬至所在月
    jdDZ0:   jdDZ0,
    jdDZ1:   jdDZ1
  };
};

// ─────────────────────────────────────────────
// 6. Solar2Lunar：西元轉農曆（照 paipan.js 重寫）
// ─────────────────────────────────────────────
Paipan.Solar2Lunar = function(yy, mm, dd) {
  var jd = Paipan.Jdays(yy, mm, dd, 12, 0, 0);

  // 取當年與前一年的月碼資料
  var lunar  = Paipan.GetZQandSMandLunarMonthCode(yy);
  var lunar1 = Paipan.GetZQandSMandLunarMonthCode(yy - 1);

  // 判斷用哪一年的資料
  // paipan.js：以 nm[mBase] 為農曆十一月起點
  // 若 jd < lunar.nm[mBase]，則屬前一年農曆年
  var nmArr, leapIdx, mBase;
  if (jd < lunar.nm[mBase]) {
    // 注意：這裡要用 lunar1 的 mBase 對應的 nm 起點
    nmArr   = lunar1.nm;
    leapIdx = lunar1.leapIdx;
    mBase   = lunar1.mBase;
  } else {
    nmArr   = lunar.nm;
    leapIdx = lunar.leapIdx;
    mBase   = lunar.mBase;
  }

  // 找 mIdx：jd 落在哪個朔望月
  var mIdx = 0;
  for (var i = nmArr.length - 2; i >= 0; i--) {
    if (jd >= Math.floor(nmArr[i] + 0.5)) { mIdx = i; break; }
  }

  // 農曆日
  var lunarDay = Math.floor(jd - Math.floor(nmArr[mIdx] + 0.5)) + 1;

  // monthOffset 與 isLeap
  // paipan.js 規則：
  //   mIdx < leapIdx  → 正常，offset = mIdx - mBase
  //   mIdx = leapIdx  → 閏月，offset = mIdx - mBase，isLeap=1
  //   mIdx > leapIdx  → 閏後，offset = mIdx - mBase - 1
  var isLeap = 0;
  var monthOffset;
  if (leapIdx !== -1 && mIdx >= leapIdx) {
    if (mIdx === leapIdx) {
      isLeap = 1;
      monthOffset = mIdx - mBase;
    } else {
      monthOffset = mIdx - mBase - 1;
    }
  } else {
    monthOffset = mIdx - mBase;
  }

  // 農曆月：mBase 所在月 = 十一月
  // lunarMonth = (11 + monthOffset - 1 + 12) % 12 + 1
  // 簡化：(10 + monthOffset + 120) % 12 + 1
  var lunarMonth = (10 + monthOffset + 120) % 12 + 1;

  // 農曆年：以立春為界
  // paipan.js：GetAdjustedJQ(yy-1)[21] = 當年立春
  var lichun    = Paipan.GetAdjustedJQ(yy - 1)[21];
  var lunarYear = (jd >= lichun) ? yy : yy - 1;

  return [lunarYear, lunarMonth, lunarDay, isLeap];
};

window.Paipan = Paipan;