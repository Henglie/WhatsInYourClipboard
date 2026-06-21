/**
 * sensitive.js — 敏感信息识别。
 * 只识别「类型」并对明文打码，绝不在界面显示完整敏感内容。
 */

// 各类敏感信息的正则与打码策略
const PATTERNS = [
  {
    type: "cardRow.sensitivePhone",
    re: /(?<![0-9])1[3-9]\d{9}(?![0-9])/g,
    mask: (s) => s.slice(0, 3) + "****" + s.slice(7),
  },
  {
    type: "cardRow.sensitiveEmail",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    mask: (s) => {
      const [name, domain] = s.split("@");
      const head = name.slice(0, Math.min(2, name.length));
      return `${head}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
    },
  },
  {
    type: "cardRow.sensitiveIdCard",
    re: /(?<![0-9Xx])\d{17}[0-9Xx](?![0-9Xx])/g,
    mask: (s) => s.slice(0, 4) + "**********" + s.slice(14),
  },
  {
    type: "cardRow.sensitiveBankCard",
    re: /(?<![0-9])\d{16,19}(?![0-9])/g,
    mask: (s) => "**** **** **** " + s.slice(-4),
  },
  {
    type: "cardRow.sensitiveIpv4",
    re: /(?<![0-9.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![0-9.])/g,
    mask: (s) => {
      const p = s.split(".");
      return `${p[0]}.${p[1]}.*.*`;
    },
  },
];

/**
 * 扫描文本，返回命中的敏感信息（已打码）。
 * @param {string} text
 * @returns {Array<{type:string, masked:string, count:number}>}
 */
export function scanSensitive(text) {
  const found = [];
  for (const { type, re, mask } of PATTERNS) {
    const matches = text.match(re);
    if (matches && matches.length) {
      // 去重后打码，统计出现次数
      const uniq = [...new Set(matches)];
      found.push({
        type,
        masked: uniq.map(mask).join("、"),
        count: matches.length,
      });
    }
  }
  return found;
}
