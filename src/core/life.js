/**
 * life.js — 生活信息工具：收货地址拆分、坐标互转、数学表达式、ISBN。
 */

// ---------- 收货地址拆分 ----------
const PROVINCE_RE =
  /(北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门)[省市自治区特别行政区]*/;
const PHONE_IN_TEXT = /1[3-9]\d{9}/;
const NAME_RE = /(?:收件人|收货人|姓名)[：:\s]*([一-龥]{2,4})/;

/** 从一段含姓名/电话/地址的文本拆分字段（电话打码） */
export function parseAddress(text) {
  const phoneMatch = text.match(PHONE_IN_TEXT);
  const phone = phoneMatch ? phoneMatch[0] : null;
  const phoneMasked = phone ? phone.slice(0, 3) + "****" + phone.slice(7) : null;

  const provMatch = text.match(PROVINCE_RE);
  const province = provMatch ? provMatch[0] : null;

  let name = null;
  const nameMatch = text.match(NAME_RE);
  if (nameMatch) name = nameMatch[1];

  // 详细地址：去掉姓名/电话标签后的最长含省份的行
  let detail = text;
  if (phone) detail = detail.replace(phone, "").trim();
  detail = detail.replace(/(收件人|收货人|姓名|电话|手机)[：:\s]*/g, "").trim();
  detail = detail.replace(/\s+/g, " ");

  return { name, phoneMasked, province, detail, hasPhone: !!phone };
}

/** 判断是否像收货地址：含省份 + (电话 或 区/路/号 等地址词) */
export function looksLikeAddress(text) {
  if (text.length > 200) return false;
  const hasProvince = PROVINCE_RE.test(text);
  const hasAddrWord = /[市区县镇乡村路街道号栋单元室楼]/.test(text);
  const hasPhone = PHONE_IN_TEXT.test(text);
  return hasProvince && hasAddrWord && (hasPhone || text.length > 10);
}

// ---------- 经纬度坐标 ----------
// 支持多种写法：
//   "39.9,116.4" / "39.9, 116.4" / "39.9 116.4"（逗号或空格分隔）
//   "39.9N,116.4E" / "N39.9 E116.4"（带方向字母）
//   "39°54'30\"N 116°23'30\"E"（度分秒 DMS）
// 收紧误报：纯整数空格对（如 "12 34"）不算坐标——要么带小数点、
// 要么带逗号、要么带方向/度符号，才认。
const DECIMAL_PAIR =
  /^([NSEW]?)\s*(-?\d{1,3}(?:\.\d+)?)°?\s*([NSEW]?)\s*([,，]|\s+)\s*([NSEW]?)\s*(-?\d{1,3}(?:\.\d+)?)°?\s*([NSEW]?)$/i;
// 一个 DMS 分量：度°[分'[秒"]] + 方向（可前可后）。度符号必需，避免误吞普通数字。
const DMS_COMPONENT =
  "([NSEW])?\\s*(\\d{1,3})\\s*[°度]\\s*(?:(\\d{1,2})\\s*['′分])?\\s*(?:(\\d{1,2}(?:\\.\\d+)?)\\s*[\"″秒])?\\s*([NSEW])?";

function applyDir(value, dir) {
  if (!dir) return value;
  dir = dir.toUpperCase();
  // S / W 为负向；N / E 为正
  return dir === "S" || dir === "W" ? -Math.abs(value) : Math.abs(value);
}

function dmsToDecimal(deg, min, sec) {
  return (deg || 0) + (min || 0) / 60 + (sec || 0) / 3600;
}

// 拿到两个数 + 各自方向字母后，判定经纬归属并范围校验。
function assemble(a, b, dirA, dirB) {
  const aIsLat = /[NS]/i.test(dirA || "");
  const bIsLng = /[EW]/i.test(dirB || "");
  const aIsLng = /[EW]/i.test(dirA || "");
  const bIsLat = /[NS]/i.test(dirB || "");
  let lat, lng;
  if (aIsLat || bIsLng) { lat = a; lng = b; }
  else if (aIsLng || bIsLat) { lat = b; lng = a; }
  else {
    // 无方向：启发式，|≤90| 视作纬度
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) { lat = a; lng = b; }
    else if (Math.abs(b) <= 90 && Math.abs(a) <= 180) { lat = b; lng = a; }
    else return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parseCoord(text) {
  const raw = text.trim();

  // —— 1) 度分秒 DMS（优先，特征最明确）——
  const dmsRe = new RegExp(
    "^" + DMS_COMPONENT + "\\s*[,，]?\\s+" + DMS_COMPONENT + "$",
    "i"
  );
  const dms = raw.match(dmsRe);
  if (dms) {
    const g = dms.slice(1);
    const c1 = g.slice(0, 5), c2 = g.slice(5, 10);
    const v1 = applyDir(dmsToDecimal(+c1[1], +c1[2] || 0, +c1[3] || 0), c1[0] || c1[4]);
    const v2 = applyDir(dmsToDecimal(+c2[1], +c2[2] || 0, +c2[3] || 0), c2[0] || c2[4]);
    return assemble(v1, v2, c1[0] || c1[4], c2[0] || c2[4]);
  }

  // —— 2) 十进制度（逗号或空格分隔，可带方向）——
  const dm = raw.match(DECIMAL_PAIR);
  if (dm) {
    const [, d1a, v1, d1b, sep, d2a, v2, d2b] = dm;
    const dirA = d1a || d1b;
    const dirB = d2a || d2b;
    // 误报收紧：空格分隔（非逗号）且两边都无方向、无小数点时，
    // 是普通数字对（如 "12 34"），不当坐标。
    const isComma = /[,，]/.test(sep);
    const hasDot = v1.includes(".") || v2.includes(".");
    const hasDir = !!(dirA || dirB);
    if (!isComma && !hasDot && !hasDir) return null;
    return assemble(applyDir(parseFloat(v1), dirA), applyDir(parseFloat(v2), dirB), dirA, dirB);
  }

  return null;
}

// WGS84 → GCJ02（火星坐标，国测局加密，国内地图用）
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return ret;
}
function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return ret;
}

export function wgs84ToGcj02(lat, lng) {
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

// GCJ02 → BD09（百度坐标）
export function gcj02ToBd09(lat, lng) {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * PI * 3000.0 / 180.0);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * PI * 3000.0 / 180.0);
  return { lat: z * Math.sin(theta) + 0.006, lng: z * Math.cos(theta) + 0.0065 };
}

// ---------- 数学表达式（安全求值，仅数字与运算符） ----------
const MATH_RE = /^[\d\s+\-*/().%^]+$/;
export function isMathExpr(text) {
  const t = text.trim();
  if (!MATH_RE.test(t)) return false;
  if (!/[+\-*/^%]/.test(t)) return false; // 必须含运算符
  if (!/\d/.test(t)) return false;
  return true;
}
export function evalMath(text) {
  const t = text.trim().replace(/\^/g, "**");
  if (!/^[\d\s+\-*/().%]+(\*\*[\d\s+\-*/().%]+)*$/.test(t.replace(/\*\*/g, "^").replace(/\^/g, "**"))) {
    // 二次确认仅安全字符
  }
  if (!/^[\d\s+\-*/().%]+$/.test(t.replace(/\*\*/g, ""))) return null;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict";return(${t})`)();
    return typeof val === "number" && isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

// ---------- ISBN ----------
export function isISBN(text) {
  const t = text.trim().replace(/[-\s]/g, "");
  return /^(97[89]\d{10}|\d{9}[\dX])$/.test(t);
}
export function validateISBN(text) {
  const t = text.trim().replace(/[-\s]/g, "");
  if (t.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(t[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === Number(t[12]);
  }
  if (t.length === 10) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(t[i]) * (10 - i);
    const check = t[9].toUpperCase() === "X" ? 10 : Number(t[9]);
    return (sum + check * 1) % 11 === 0;
  }
  return false;
}
