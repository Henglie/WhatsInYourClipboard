/**
 * barcode.js — 商品条码（EAN-13 / UPC-A / EAN-8）识别与校验。
 * 国际标准 GS1，校验位算法确定，可本地准确验证。
 */

// EAN-13 国家/地区前缀（GS1 前缀段，节选常见）
const GS1_PREFIX = [
  { range: [690, 699], region: "中国大陆" },
  { range: [0, 19], region: "美国/加拿大" },
  { range: [30, 39], region: "美国（药品）" },
  { range: [300, 379], region: "法国" },
  { range: [400, 440], region: "德国" },
  { range: [450, 459], region: "日本" },
  { range: [490, 499], region: "日本" },
  { range: [471, 471], region: "中国台湾" },
  { range: [489, 489], region: "中国香港" },
  { range: [880, 880], region: "韩国" },
  { range: [885, 885], region: "泰国" },
  { range: [888, 888], region: "新加坡" },
  { range: [93, 93], region: "澳大利亚" },
  { range: [500, 509], region: "英国" },
  { range: [80, 83], region: "意大利" },
];

/** EAN-13 校验位验证 */
export function validateEAN13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** EAN-8 校验位验证 */
export function validateEAN8(code) {
  if (!/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += Number(code[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(code[7]);
}

/** UPC-A（12位）校验 */
export function validateUPCA(code) {
  if (!/^\d{12}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += Number(code[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(code[11]);
}

/** 按 EAN-13 前缀判定来源地区 */
export function ean13Region(code) {
  const p3 = Number(code.slice(0, 3));
  const p2 = Number(code.slice(0, 2));
  for (const { range, region } of GS1_PREFIX) {
    if (p3 >= range[0] && p3 <= range[1]) return region;
    if (p2 >= range[0] && p2 <= range[1] && range[1] < 100) return region;
  }
  return "未知地区";
}

/** 识别条码类型 */
export function detectBarcode(text) {
  const t = text.trim();
  if (/^\d{13}$/.test(t) && validateEAN13(t)) return { type: "EAN-13", code: t };
  if (/^\d{12}$/.test(t) && validateUPCA(t)) return { type: "UPC-A", code: t };
  if (/^\d{8}$/.test(t) && validateEAN8(t)) return { type: "EAN-8", code: t };
  return null;
}
