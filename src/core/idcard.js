/**
 * idcard.js — 中国大陆身份证号解析（纯本地推导）。
 * 校验位验证 + 生日/性别/星座/属相，省份由 region-codes 数据包补充。
 */

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CODES = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

const ZODIAC = [
  "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪",
];

// 星座按月日边界
const CONSTELLATIONS = [
  [20, "水瓶座"], [19, "双鱼座"], [21, "白羊座"], [20, "金牛座"],
  [21, "双子座"], [22, "巨蟹座"], [23, "狮子座"], [23, "处女座"],
  [23, "天秤座"], [24, "天蝎座"], [23, "射手座"], [22, "摩羯座"],
];

/** 验证 18 位身份证校验位是否正确 */
export function validateIdCard(id) {
  if (!/^\d{17}[\dXx]$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * WEIGHTS[i];
  return CHECK_CODES[sum % 11] === id[17].toUpperCase();
}

function getConstellation(month, day) {
  const idx = day < CONSTELLATIONS[month - 1][0] ? (month + 10) % 12 : month - 1;
  return CONSTELLATIONS[idx][1];
}

/**
 * 解析身份证，返回推导信息。
 * @param {string} id 18 位身份证
 * @param {object|null} regionMap 省级行政区映射（DataPack）
 */
export function parseIdCard(id, regionMap) {
  const valid = validateIdCard(id);
  const year = Number(id.slice(6, 10));
  const month = Number(id.slice(10, 12));
  const day = Number(id.slice(12, 14));
  const genderDigit = Number(id[16]);
  const gender = genderDigit % 2 === 1 ? "男" : "女";
  const provinceCode = id.slice(0, 2);
  const province = regionMap ? regionMap[provinceCode] || "未知地区" : "需加载地区库";

  // 属相：以 1900 为鼠年基准
  const zodiac = ZODIAC[(year - 1900) % 12 < 0 ? 0 : (year - 1900) % 12];
  const constellation =
    month >= 1 && month <= 12 && day >= 1 && day <= 31
      ? getConstellation(month, day)
      : "未知";

  const age = new Date().getFullYear() - year;

  return {
    valid,
    birthday: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    age,
    gender,
    province,
    zodiac,
    constellation,
  };
}

/** 身份证号打码：保留前4后4，中间脱敏 */
export function maskIdCard(id) {
  return id.slice(0, 4) + "**********" + id.slice(14);
}
