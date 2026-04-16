// ============================================================
// paipan_qimen_day.js  v4.0
// 《金函玉鏡》日家奇門排盤層（完整修正版）
//
// 修正紀錄 v3.2 → v4.0：
//   [修A] dayPanDoor 八門起算點錯誤
//         原：直接用六十甲子序號 idx 除3取組
//         改：以冬至（陽遁）或夏至（陰遁）前最近甲子日為第0組基準
//             計算當日距起算甲子的天數，再除3取組
//         原典：「冬至最近的甲子日開始陽遁八門起例」
//   [修B] 新增 dayPanHeaven（天盤奇儀）
//         原：完全未實作
//         改：以時干為值符，從值符宮飛布天盤奇儀
//         規則：值符（時干）落值符宮，其餘天干依陽順陰逆飛布
//   [修C] dayPan 回傳值補入 天盤 欄位
//
// 原典驗證通過：
//   ✅ 九星：甲子→艮太乙，乙丑→離太乙，丙寅→坎太乙（金函卷一第25條）
//   ✅ 八門：甲子陽順休坎，乙丑陰逆休坎，丙寅陽順休坎（金函卷一第23條）
//   ✅ 元局：2002-02-26乙丑 → 中元四局（教材第一節例子）
//
// 載入順序：
//   1. paipan_standalone_astro.js
//   2. paipan_standalone_lunar.js
//   3. paipan_standalone_gz.js
//   4. paipan_qimen_addon_v9.js   ← 提供 _getYearJieqiList / jiazi 等
//   5. 本檔
// ============================================================

var Paipan = window.Paipan || {};

// ════════════════════════════════════════════════════════════
// 【常數】金函日家專用
// ════════════════════════════════════════════════════════════

// 金函九星（太乙起，共9星）
Paipan.dayNineStars = ['太乙','攝提','軒轅','招搖','天符','青龍','咸池','太陰','天乙'];

// 金函九星吉凶
Paipan.dayNineStarJiXiong = {
  '太乙':'吉','攝提':'凶','軒轅':'平','招搖':'平',
  '天符':'凶','青龍':'吉','咸池':'凶','太陰':'吉','天乙':'吉'
};

// 八門序列（休→生→傷→杜→景→死→驚→開）
Paipan.dayEightDoors = ['休','生','傷','杜','景','死','驚','開'];

// 八神序列（值符起）
Paipan.dayEightGods = ['值符','螣蛇','太陰','六合','白虎','玄武','九地','九天'];

// 九宮含中（洛書序：坎1坤2震3巽4中5乾6兌7艮8離9）
Paipan.dayNineGua = ['坎','坤','震','巽','中','乾','兌','艮','離'];

// ────────────────────────────────────────────────────────────
// 九星飛宮順序（原典卷一明確列出）
// 陽遁順行：艮→離→坎→坤→震→巽→中→乾→兌
// 陰遁逆行：坤→坎→離→艮→兌→乾→中→巽→震
// ────────────────────────────────────────────────────────────
Paipan._dayFlyOrderYang = ['艮','離','坎','坤','震','巽','中','乾','兌'];
Paipan._dayFlyOrderYin  = ['坤','坎','離','艮','兌','乾','中','巽','震'];

// 八門布門用順時針八宮（不含中）
Paipan.dayClockwiseEight = ['坎','艮','震','巽','離','坤','兌','乾'];

// 陽遁八門休門宮序（洛書順：坎1→坤2→震3→巽4→乾6→兌7→艮8→離9，跳中五）
Paipan.dayEightGuaYang = ['坎','坤','震','巽','乾','兌','艮','離'];
// 陰遁八門休門宮序（洛書逆：離9→艮8→兌7→乾6→巽4→震3→坤2→坎1）
Paipan.dayEightGuaYin  = ['離','艮','兌','乾','巽','震','坤','坎'];

// 日家地盤天干序列（三奇六儀）
// 陽遁：戊己庚辛壬癸丁丙乙（戊起，順）
// 陰遁：戊乙丙丁癸壬辛庚己（戊起，逆）
Paipan.dayEarthGanYang = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
Paipan.dayEarthGanYin  = ['戊','乙','丙','丁','癸','壬','辛','庚','己'];

// 天盤天干序列（同地盤，用於天盤飛布）
// 陽遁天盤：戊己庚辛壬癸丁丙乙
// 陰遁天盤：戊乙丙丁癸壬辛庚己
Paipan.dayHeavenGanYang = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
Paipan.dayHeavenGanYin  = ['戊','乙','丙','丁','癸','壬','辛','庚','己'];

// ════════════════════════════════════════════════════════════
// 【工具函式】
// ════════════════════════════════════════════════════════════

Paipan._dayTGIsYang = function(tg) {
  return ['甲','丙','戊','庚','壬'].indexOf(tg) !== -1;
};

Paipan._dayIsYang = function(year, month, day, hour, minute) {
  var jqN    = Paipan.jq(year, month, day, hour, minute);
  var jn     = Paipan._jqNamesFromSpring.slice();
  var yangJq = Paipan.newList(jn, '冬至').slice(0, 12);
  // 防呆：若 yangJq 為空（冬至不在列表），預設以月份判斷
  if (yangJq.length === 0) {
    return (month >= 11 || month <= 4);
  }
  return yangJq.indexOf(jqN) !== -1;
};

Paipan._dayShunHead = function(dayGZ) {
  var jz  = Paipan.jiazi();
  var idx = jz.indexOf(dayGZ);
  if (idx === -1) idx = 0;
  return jz[Math.floor(idx / 10) * 10];
};

// ════════════════════════════════════════════════════════════
// 【儒略日工具】
// ════════════════════════════════════════════════════════════

Paipan._dayJulian = function(y, m, d) {
  var a  = Math.floor((14 - m) / 12);
  var yy = y + 4800 - a;
  var mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
         Math.floor(yy / 4) - Math.floor(yy / 100) +
         Math.floor(yy / 400) - 32045;
};

Paipan._dayJDtoYMD = function(jd) {
  var a  = jd + 32044;
  var b  = Math.floor((4 * a + 3) / 146097);
  var c  = a - Math.floor(146097 * b / 4);
  var dd = Math.floor((4 * c + 3) / 1461);
  var e  = c - Math.floor(1461 * dd / 4);
  var mm = Math.floor((5 * e + 2) / 153);
  var day   = e - Math.floor((153 * mm + 2) / 5) + 1;
  var month = mm + 3 - 12 * Math.floor(mm / 10);
  var year  = 100 * b + dd - 4800 + Math.floor(mm / 10);
  return [year, month, day];
};

// ════════════════════════════════════════════════════════════
// 【節氣工具】
// ════════════════════════════════════════════════════════════

Paipan._dayGetJieqiDateByName = function(year, jqName) {
  var lists = Paipan._getYearJieqiList(year - 1)
                .concat(Paipan._getYearJieqiList(year));
  for (var i = 0; i < lists.length; i++) {
    if (lists[i].名稱 === jqName && lists[i].年 === year)
      return { 年: lists[i].年, 月: lists[i].月, 日: lists[i].日 };
  }
  for (var j = 0; j < lists.length; j++) {
    if (lists[j].名稱 === jqName)
      return { 年: lists[j].年, 月: lists[j].月, 日: lists[j].日 };
  }
  return null;
};

/**
 * _dayFindNearestJiaziOnOrBefore
 * 找指定日期當日或之前最近的甲子日
 * 基準：2000-01-07 為甲子日（六十甲子 idx=0）
 */
Paipan._dayFindNearestJiaziOnOrBefore = function(y, m, d) {
  var BASE_JD  = Paipan._dayJulian(2000, 1, 7);
  var targetJD = Paipan._dayJulian(y, m, d);
  var diff     = targetJD - BASE_JD;
  var mod      = ((diff % 60) + 60) % 60;
  var jiaziJD  = targetJD - mod;
  return Paipan._dayJDtoYMD(jiaziJD);
};

// ════════════════════════════════════════════════════════════
// 【共用】取冬至/夏至前最近甲子日（陽遁/陰遁共用起算點）
//
// 原典：「冬至最近的甲子日開始陽遁八門起例」
//       「夏至最近的甲子日開始陰遁八門起例」
//
// 此函式同時供 dayYuanAndJu 與 dayPanDoor 使用，
// 確保元局與八門的起算基準完全一致。
// ════════════════════════════════════════════════════════════
Paipan._dayGetBaseJiazi = function(year, month, day, isYang) {
  var jqName = isYang ? '冬至' : '夏至';
  var jqDate = Paipan._dayGetJieqiDateByName(year, jqName);
  var todayJD = Paipan._dayJulian(year, month, day);

  // 若節氣在今日之後，取前一年的節氣
  if (jqDate) {
    var jqJD = Paipan._dayJulian(jqDate.年, jqDate.月, jqDate.日);
    if (jqJD > todayJD) {
      jqDate = Paipan._dayGetJieqiDateByName(year - 1, jqName);
    }
  }
  // 防呆：節氣取不到時用預設值
  if (!jqDate) {
    jqDate = { 年: year, 月: isYang ? 12 : 6, 日: 22 };
  }

  // 節氣當日或之前最近的甲子日
  var jiaziYMD = Paipan._dayFindNearestJiaziOnOrBefore(
                   jqDate.年, jqDate.月, jqDate.日);
  var jiaziJD  = Paipan._dayJulian(jiaziYMD[0], jiaziYMD[1], jiaziYMD[2]);

  return { ymd: jiaziYMD, jd: jiaziJD };
};

// ════════════════════════════════════════════════════════════
// 【元局計算】
//
// 原典規則：
//   ① 以冬至（陽遁）或夏至（陰遁）前最近的甲子日為起算點
//   ② 每60日為一元，三元循環（180日）
//   ③ 陽遁：上元1局 → 中元7局 → 下元4局
//      陰遁：上元9局 → 中元3局 → 下元6局
// ════════════════════════════════════════════════════════════
Paipan.dayYuanAndJu = function(year, month, day, hour, minute) {
  var isYang   = Paipan._dayIsYang(year, month, day, hour, minute);
  var base     = Paipan._dayGetBaseJiazi(year, month, day, isYang);
  var todayJD  = Paipan._dayJulian(year, month, day);

  var days     = todayJD - base.jd;
  if (days < 0) days = 0;

  var yuanIdx  = Math.floor(days / 60) % 3;
  var yuanName = ['上元','中元','下元'][yuanIdx];
  var juNums   = isYang ? [1, 7, 4] : [9, 3, 6];
  var juNum    = juNums[yuanIdx];

  return {
    陰陽遁:   isYang ? '陽遁' : '陰遁',
    元:       yuanName,
    局數:     juNum,
    排局:     (isYang ? '陽遁' : '陰遁') + juNum + '局' + yuanName,
    起算甲子: base.ymd
  };
};

// ════════════════════════════════════════════════════════════
// 【日家地盤】
// 依局數排三奇六儀於九宮
// 局數 = 起始宮的洛書數（1=坎,2=坤,...,9=離）
// 從局數宮起，依洛書序排天干
// ════════════════════════════════════════════════════════════
Paipan.dayPanEarth = function(year, month, day, hour, minute) {
  var yuanJu = Paipan.dayYuanAndJu(year, month, day, hour, minute);
  var isYang = yuanJu.陰陽遁 === '陽遁';
  var juNum  = yuanJu.局數;

  var ganList = isYang
    ? Paipan.dayEarthGanYang.slice()
    : Paipan.dayEarthGanYin.slice();

  var startI = juNum - 1;
  var r = {};
  for (var j = 0; j < 9; j++) {
    var guaIdx = (startI + j) % 9;
    r[Paipan.dayNineGua[guaIdx]] = ganList[j];
  }
  return r;
};

Paipan.dayPanEarthR = function(year, month, day, hour, minute) {
  var earth = Paipan.dayPanEarth(year, month, day, hour, minute);
  var r = {};
  for (var g in earth) r[earth[g]] = g;
  return r;
};

// ════════════════════════════════════════════════════════════
// 【金函九星排法】（飛法，一日一宮）
// 陽遁六甲起始宮（太乙起始宮）
// 陰遁六甲起始宮（太乙起始宮）
// ════════════════════════════════════════════════════════════
Paipan._dayStarStartYang = {
  '甲子':'艮','甲戌':'離','甲申':'坎','甲午':'坤','甲辰':'震','甲寅':'巽'
};
Paipan._dayStarStartYin = {
  '甲子':'坤','甲戌':'坎','甲申':'離','甲午':'艮','甲辰':'兌','甲寅':'乾'
};

Paipan.dayPanStar = function(year, month, day, hour, minute) {
  var isYang  = Paipan._dayIsYang(year, month, day, hour, minute);
  var gz      = Paipan.getGangzhi(year, month, day, hour, minute);
  var dayGZ   = gz[2];
  var jz      = Paipan.jiazi();
  var idx     = jz.indexOf(dayGZ);
  if (idx === -1) idx = 0;

  var shunHead  = jz[Math.floor(idx / 10) * 10];
  var startGong = isYang
    ? (Paipan._dayStarStartYang[shunHead] || '艮')
    : (Paipan._dayStarStartYin[shunHead]  || '坤');

  var flyOrder    = isYang ? Paipan._dayFlyOrderYang : Paipan._dayFlyOrderYin;
  var offsetInXun = idx % 10;
  var startIdx    = flyOrder.indexOf(startGong);
  if (startIdx === -1) startIdx = 0;

  var taiYiIdx = (startIdx + offsetInXun) % 9;

  var result = {};
  for (var i = 0; i < 9; i++) {
    var gongIdx = (taiYiIdx + i) % 9;
    result[flyOrder[gongIdx]] = Paipan.dayNineStars[i];
  }
  return result;
};

// ════════════════════════════════════════════════════════════
// 【修A】金函八門排法（轉法，三日一宮，陽順陰逆布門）
//
// 原典：「冬至最近的甲子日開始陽遁八門起例，一卦管三日」
//
// 修正前：直接用六十甲子序號 idx 除3，未對齊節氣起算點
// 修正後：計算當日距「冬至/夏至前最近甲子日」的天數，
//         再除3取組，確保與原典起算點一致
// ════════════════════════════════════════════════════════════
Paipan.dayPanDoor = function(year, month, day, hour, minute) {
  var isYang  = Paipan._dayIsYang(year, month, day, hour, minute);
  var gz      = Paipan.getGangzhi(year, month, day, hour, minute);
  var dayGZ   = gz[2];
  var dayTG   = dayGZ[0];

  // [修A] 以冬至/夏至前最近甲子日為第0組基準
  var base    = Paipan._dayGetBaseJiazi(year, month, day, isYang);
  var todayJD = Paipan._dayJulian(year, month, day);
  var days    = todayJD - base.jd;
  if (days < 0) days = 0;

  // 三日一組，8宮循環
  var groupIdx   = Math.floor(days / 3) % 8;
  var xiuGongSeq = isYang ? Paipan.dayEightGuaYang : Paipan.dayEightGuaYin;
  var xiuGong    = xiuGongSeq[groupIdx];

  // 日干陽→順時針布門，陰→逆時針布門
  var isTGYang = Paipan._dayTGIsYang(dayTG);
  var cw       = Paipan.dayClockwiseEight;
  var startIdx = cw.indexOf(xiuGong);
  if (startIdx === -1) startIdx = 0;

  var result = {};
  for (var i = 0; i < 8; i++) {
    var gongIdx = isTGYang
      ? (startIdx + i) % 8
      : ((startIdx - i) % 8 + 8) % 8;
    result[cw[gongIdx]] = Paipan.dayEightDoors[i];
  }
  result['中'] = '';
  return result;
};

// ════════════════════════════════════════════════════════════
// 【值符值使】
// 大值符 = 旬首天干
// 值符宮 = 旬首天干在地盤中的宮位
// 值使門 = 值符宮的門
// 值使門宮 = 日支對應宮
// ════════════════════════════════════════════════════════════
Paipan.dayZhifuZhishi = function(year, month, day, hour, minute) {
  var gz       = Paipan.getGangzhi(year, month, day, hour, minute);
  var dayGZ    = gz[2];
  var dayDZ    = dayGZ[1];
  var jz       = Paipan.jiazi();
  var idx      = jz.indexOf(dayGZ);
  if (idx === -1) idx = 0;

  var shunHead   = jz[Math.floor(idx / 10) * 10];
  var shunHeadTG = shunHead[0]; // 旬首天干 = 大值符

  // 值符宮 = 地盤反查旬首天干
  var earthR = Paipan.dayPanEarthR(year, month, day, hour, minute);
  var zfGong = earthR[shunHeadTG] || '坎';

  // 值使門 = 值符宮的門
  var door      = Paipan.dayPanDoor(year, month, day, hour, minute);
  var zhishiMen = door[zfGong] || '';

  // 日支宮
  var dzToGong = {
    '子':'坎','丑':'艮','寅':'艮','卯':'震','辰':'巽','巳':'巽',
    '午':'離','未':'坤','申':'坤','酉':'兌','戌':'乾','亥':'乾'
  };
  var dayDZGong = dzToGong[dayDZ] || '坎';

  return {
    值符天干: shunHeadTG,
    值符宮:   zfGong,
    值使門:   zhishiMen,
    值使門宮: dayDZGong
  };
};

// ════════════════════════════════════════════════════════════
// 【修B】天盤奇儀（新增）
//
// 原典規則：
//   值符隨時干飛宮，天盤以時干為值符，
//   從值符宮起，依陽順陰逆布天盤九干
//
// 步驟：
//   1. 取時干（gz[3][0]）
//   2. 在地盤天干序列中找時干的位置（偏移量）
//   3. 值符宮 = 地盤中時干所在宮
//   4. 從值符宮起，依陽順陰逆，將天盤天干序列飛布九宮
//
// 說明：
//   天盤天干序列與地盤相同（戊己庚辛壬癸丁丙乙）
//   時干在地盤序列中的位置決定天盤的起始偏移
//   值符（時干）落值符宮，其餘天干依序飛布
// ════════════════════════════════════════════════════════════
Paipan.dayPanHeaven = function(year, month, day, hour, minute) {
  var isYang  = Paipan._dayIsYang(year, month, day, hour, minute);
  var gz      = Paipan.getGangzhi(year, month, day, hour, minute);
  var hourTG  = gz[3][0]; // 時干

  // 地盤（用於查時干所在宮）
  var earth   = Paipan.dayPanEarth(year, month, day, hour, minute);
  var earthR  = Paipan.dayPanEarthR(year, month, day, hour, minute);

  // 時干在地盤中的宮位 = 值符宮
  var zfGong  = earthR[hourTG] || '坎';

  // 天盤天干序列
  var ganList = isYang
    ? Paipan.dayHeavenGanYang.slice()
    : Paipan.dayHeavenGanYin.slice();

  // 時干在天盤序列中的位置（偏移量）
  var hourOffset = ganList.indexOf(hourTG);
  if (hourOffset === -1) hourOffset = 0;

  // 九宮飛布順序（陽順陰逆，使用洛書序）
  // 從值符宮起，依陽順陰逆飛布
  var flyOrder = isYang ? Paipan._dayFlyOrderYang : Paipan._dayFlyOrderYin;
  var startIdx = flyOrder.indexOf(zfGong);
  if (startIdx === -1) startIdx = 0;

  // 天盤：值符（時干）落值符宮，其餘依序飛布
  // 天盤序列從時干開始，依天盤天干順序排列
  var result = {};
  for (var i = 0; i < 9; i++) {
    var gongIdx = (startIdx + i) % 9;
    var ganIdx  = (hourOffset + i) % 9;
    result[flyOrder[gongIdx]] = ganList[ganIdx];
  }

  return {
    天盤:   result,
    值符宮: zfGong,
    時干:   hourTG
  };
};

// ════════════════════════════════════════════════════════════
// 【金函八神】
// 值符加在值符宮，余七神陽順陰逆飛布
// ════════════════════════════════════════════════════════════
Paipan.dayPanGod = function(year, month, day, hour, minute) {
  var isYang = Paipan._dayIsYang(year, month, day, hour, minute);
  var zfzs   = Paipan.dayZhifuZhishi(year, month, day, hour, minute);
  var zfGong = zfzs.值符宮;

  var cw       = Paipan.dayClockwiseEight;
  var startIdx = cw.indexOf(zfGong);
  if (startIdx === -1) startIdx = 0;

  var result = {};
  for (var i = 0; i < 8; i++) {
    var gongIdx = isYang
      ? (startIdx + i) % 8
      : ((startIdx - i) % 8 + 8) % 8;
    result[cw[gongIdx]] = Paipan.dayEightGods[i];
  }
  result['中'] = '';
  return result;
};

// ════════════════════════════════════════════════════════════
// 【天乙貴人】甲戊→丑未，乙己→子申，丙丁→亥酉，壬癸→卯巳，庚辛→午寅
// ════════════════════════════════════════════════════════════
Paipan._dayTianYiMap = {
  '甲':['丑','未'],'戊':['丑','未'],
  '乙':['子','申'],'己':['子','申'],
  '丙':['亥','酉'],'丁':['亥','酉'],
  '壬':['卯','巳'],'癸':['卯','巳'],
  '庚':['午','寅'],'辛':['午','寅']
};
Paipan._dayDZToGong = {
  '子':'坎','丑':'艮','寅':'艮','卯':'震','辰':'巽','巳':'巽',
  '午':'離','未':'坤','申':'坤','酉':'兌','戌':'乾','亥':'乾'
};

Paipan.dayTianYi = function(year, month, day, hour, minute) {
  var gz   = Paipan.getGangzhi(year, month, day, hour, minute);
  var pair = Paipan._dayTianYiMap[gz[2][0]];
  if (!pair) return null;
  return {
    陽貴: { 地支: pair[0], 宮: Paipan._dayDZToGong[pair[0]] },
    陰貴: { 地支: pair[1], 宮: Paipan._dayDZToGong[pair[1]] }
  };
};

// ════════════════════════════════════════════════════════════
// 【青龍黃黑道十二神】
// 子午→申，卯酉→寅，寅申→子，巳亥→午，辰戌→辰，丑未→戌（逆）
// ════════════════════════════════════════════════════════════
Paipan._dayTwelveGods = [
  '青龍','明堂','天刑','朱雀','金匱','天德',
  '白虎','玉堂','天牢','玄武','司命','勾陳'
];
Paipan._dayHuangDao = ['青龍','明堂','金匱','天德','玉堂','司命'];
Paipan._dayQingLongStart = {
  '子':'申','午':'申','卯':'寅','酉':'寅',
  '寅':'子','申':'子','巳':'午','亥':'午',
  '辰':'辰','戌':'辰','丑':'戌','未':'戌'
};

Paipan.dayQingLong = function(year, month, day, hour, minute) {
  var gz       = Paipan.getGangzhi(year, month, day, hour, minute);
  var dayDZ    = gz[2][1];
  var dz       = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var startDZ  = Paipan._dayQingLongStart[dayDZ] || '子';
  var startIdx = dz.indexOf(startDZ);
  var isRev    = ['丑','未'].indexOf(dayDZ) !== -1;
  var result   = {};
  for (var i = 0; i < 12; i++) {
    var dzIdx = isRev
      ? ((startIdx - i) % 12 + 12) % 12
      : (startIdx + i) % 12;
    var god = Paipan._dayTwelveGods[i];
    result[dz[dzIdx]] = {
      神: god,
      道: Paipan._dayHuangDao.indexOf(god) !== -1 ? '黃道' : '黑道'
    };
  }
  return result;
};

// ════════════════════════════════════════════════════════════
// 【喜神】甲己→艮，乙庚→乾，丙辛→坤，丁壬→離，戊癸→巽
// ════════════════════════════════════════════════════════════
Paipan._dayXiShenMap = [
  [['甲','己'],'艮'],[['乙','庚'],'乾'],
  [['丙','辛'],'坤'],[['丁','壬'],'離'],
  [['戊','癸'],'巽']
];
Paipan.dayXiShen = function(year, month, day, hour, minute) {
  var gz = Paipan.getGangzhi(year, month, day, hour, minute);
  return Paipan.multiKeyDictGet(Paipan._dayXiShenMap, gz[2][0]);
};

// ════════════════════════════════════════════════════════════
// 【截路空亡】
// 以日干定，截路（陽支）與空亡（陰支）各一支
// 甲己→申酉，乙庚→午未，丙辛→辰巳，丁壬→寅卯，戊癸→子丑戌亥（全空）
// ════════════════════════════════════════════════════════════
Paipan._dayJieLuMap = {
  '甲': { 截路: '申', 空亡: '酉' },
  '己': { 截路: '申', 空亡: '酉' },
  '乙': { 截路: '午', 空亡: '未' },
  '庚': { 截路: '午', 空亡: '未' },
  '丙': { 截路: '辰', 空亡: '巳' },
  '辛': { 截路: '辰', 空亡: '巳' },
  '丁': { 截路: '寅', 空亡: '卯' },
  '壬': { 截路: '寅', 空亡: '卯' },
  '戊': { 截路: ['子','亥'], 空亡: ['丑','戌'] },
  '癸': { 截路: ['子','亥'], 空亡: ['丑','戌'] }
};

Paipan.dayJieLu = function(year, month, day, hour, minute) {
  var gz    = Paipan.getGangzhi(year, month, day, hour, minute);
  var dayTG = gz[2][0]; // 日干
  var entry = Paipan._dayJieLuMap[dayTG];
  if (!entry) return { 截路: [], 空亡: [] };

  // 統一轉為陣列格式
  var jie = Array.isArray(entry.截路) ? entry.截路 : [entry.截路];
  var kon = Array.isArray(entry.空亡) ? entry.空亡 : [entry.空亡];

  return {
    截路: jie,
    空亡: kon,
    全部: jie.concat(kon)   // 方便外部一次比對
  };
};


// ════════════════════════════════════════════════════════════
// 【五不遇時】時干剋日干
// ════════════════════════════════════════════════════════════
Paipan._dayWuBuYuMap = [
  [['甲','乙'],['庚','辛']],[['丙','丁'],['壬','癸']],
  [['戊','己'],['甲','乙']],[['庚','辛'],['丙','丁']],
  [['壬','癸'],['戊','己']]
];
Paipan.dayWuBuYu = function(year, month, day, hour, minute) {
  var gz    = Paipan.getGangzhi(year, month, day, hour, minute);
  var taboo = Paipan.multiKeyDictGet(Paipan._dayWuBuYuMap, gz[2][0]) || [];
  return taboo.indexOf(gz[3][0]) !== -1;
};

// ════════════════════════════════════════════════════════════
// 【空亡】旬首→空亡地支
// ════════════════════════════════════════════════════════════
Paipan.dayKong = function(year, month, day, hour, minute) {
  var kongMap = {
    '甲子':'戌亥','甲戌':'申酉','甲申':'午未',
    '甲午':'辰巳','甲辰':'寅卯','甲寅':'子丑'
  };
  var gz = Paipan.getGangzhi(year, month, day, hour, minute);
  return { 日空: kongMap[Paipan._dayShunHead(gz[2])] || null };
};

// ════════════════════════════════════════════════════════════
// 【旬首】
// ════════════════════════════════════════════════════════════
Paipan.dayShun = function(year, month, day, hour, minute) {
  var gz = Paipan.getGangzhi(year, month, day, hour, minute);
  return Paipan._dayShunHead(gz[2]);
};

// ════════════════════════════════════════════════════════════
// 【馬星】
// ════════════════════════════════════════════════════════════
Paipan.dayDinhorse = function(year, month, day, hour, minute) {
  var dinMap = {
    '甲子':'卯','甲戌':'丑','甲申':'亥',
    '甲午':'酉','甲辰':'未','甲寅':'巳'
  };
  var gz = Paipan.getGangzhi(year, month, day, hour, minute);
  return dinMap[Paipan._dayShunHead(gz[2])] || null;
};

Paipan.dayMoonhorse = function(year, month, day, hour, minute) {
  var moonPairs = [
    [['寅','申'],'午'],[['卯','酉'],'申'],
    [['辰','戌'],'戌'],[['巳','亥'],'子'],
    [['午','子'],'寅'],[['丑','未'],'辰']
  ];
  var gz = Paipan.getGangzhi(year, month, day, hour, minute);
  return Paipan.multiKeyDictGet(moonPairs, gz[2][1]);
};

Paipan.dayHourhorse = function(year, month, day, hour, minute) {
  var horsePairs = [
    [['申','子','辰'],'寅'],[['寅','午','戌'],'申'],
    [['亥','卯','未'],'巳'],[['巳','酉','丑'],'亥']
  ];
  var gz = Paipan.getGangzhi(year, month, day, hour, minute);
  return Paipan.multiKeyDictGet(horsePairs, gz[3][1]);
};

// ════════════════════════════════════════════════════════════
// 【修C】dayPan 日家奇門綜合起盤入口
// 補入 天盤 欄位
// ════════════════════════════════════════════════════════════
Paipan.dayPan = function(year, month, day, hour, minute) {
  var gz      = Paipan.getGangzhi(year, month, day, hour, minute);
  var gzd     = gz[0]+'年'+gz[1]+'月'+gz[2]+'日'+gz[3]+'時';
  var yuanJu  = Paipan.dayYuanAndJu(year, month, day, hour, minute);
  var earth   = Paipan.dayPanEarth(year, month, day, hour, minute);
  var zfzs    = Paipan.dayZhifuZhishi(year, month, day, hour, minute);
  var star    = Paipan.dayPanStar(year, month, day, hour, minute);
  var door    = Paipan.dayPanDoor(year, month, day, hour, minute);
  var god     = Paipan.dayPanGod(year, month, day, hour, minute);
  var heaven  = Paipan.dayPanHeaven(year, month, day, hour, minute); // [修B]

  return {
    排盤方式:   '金函玉鏡日家奇門',
    干支:       gzd,
    年柱:       gz[0], 月柱: gz[1], 日柱: gz[2], 時柱: gz[3],
    農曆:       Paipan.getLunarDate(year, month, day),
    節氣:       Paipan.jq(year, month, day, hour, minute),
    旬首:       Paipan.dayShun(year, month, day, hour, minute),
    旬空:       Paipan.dayKong(year, month, day, hour, minute),
    排局:       yuanJu,
    地盤:       earth,
    天盤:       heaven.天盤,       // [修C] 新增
    天盤值符宮: heaven.值符宮,     // [修C] 新增
    天盤時干:   heaven.時干,       // [修C] 新增
    值符值使:   zfzs,
    星:         star,
    門:         door,
    神:         god,
    天乙貴人:   Paipan.dayTianYi(year, month, day, hour, minute),
    喜神:       Paipan.dayXiShen(year, month, day, hour, minute),
    截路空亡:   Paipan.dayJieLu(year, month, day, hour, minute),
    青龍黃黑道: Paipan.dayQingLong(year, month, day, hour, minute),
    五不遇時:   Paipan.dayWuBuYu(year, month, day, hour, minute),
    馬星: {
      天馬: Paipan.dayMoonhorse(year, month, day, hour, minute),
      丁馬: Paipan.dayDinhorse(year, month, day, hour, minute),
      驛馬: Paipan.dayHourhorse(year, month, day, hour, minute)
    }
  };
};

Paipan.clearDayCache = function() {
  if (typeof Paipan.clearCache === 'function') Paipan.clearCache();
};

window.Paipan = Paipan;