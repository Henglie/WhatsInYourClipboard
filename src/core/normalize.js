/**
 * normalize.js — 文本归一化工具。
 *
 * 很多标识符在真实剪贴场景里被空格 / 连字符 / 标签 / 全角标点「污染」：
 *   「138 1234 5678」「6222 0212 3456 7890」「身份证：11010519491231002X」
 *   「链接：https://example.com 。」
 * 严格的 `^...$` 正则一律落空。这里集中提供「先剥噪声再判定」的小工具，
 * 各分类器复用，避免各写一套又互相不一致。
 *
 * 纯本地字符串处理，不涉及任何外发。
 */

/** 去掉所有空白（含全角空格）与连字符，用于数字串类标识符归一。 */
export function stripSpacesDashes(s) {
  return String(s).replace(/[\s　\-]+/g, "");
}

/** 全角数字/字母/标点 → 半角。剪贴常带全角，归一后正则才稳。 */
export function toHalfWidth(s) {
  return String(s)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/**
 * 剥掉常见「字段标签」前缀，取冒号后的实际值。
 * 命中「身份证号：xxx」「手机号: xxx」「卡号 xxx」「链接：xxx」等场景。
 * 没有标签时原样返回（trim 过）。
 * @param {string} s
 * @param {RegExp} [labelRe] 自定义标签词；默认覆盖常见中文/英文标签
 */
export function stripLabel(s, labelRe) {
  const text = String(s).trim();
  const re =
    labelRe ||
    /^(?:身份证号?|身份证号码|证件号码?|手机号?|手机号码|电话号?码?|联系电话|银行卡号?|卡号|账号|链接|网址|地址|坐标|经纬度|tel|phone|mobile|url|link|addr|address)\s*[:：]\s*/i;
  return text.replace(re, "").trim();
}

/**
 * 从一段文本里「抽取」首个 http(s) URL（容忍前后中文/标签/句读）。
 * 返回 { url, hasContext } —— hasContext 表示 URL 外还有别的字符
 * （即不是纯 URL 串，提示调用方这是「文本中夹了个链接」）。
 * 末尾成对/中文标点（。，、；！？)）」】> 等）不计入 URL。
 * @returns {{url:string, hasContext:boolean}|null}
 */
export function extractUrl(s) {
  const text = String(s);
  const m = text.match(/https?:\/\/[^\s　，。、；！？）」】]+/i);
  if (!m) return null;
  let url = m[0];
  // 剥掉 URL 尾部紧贴的西文句读（. , ; ! ? ' " 及多余的右括号）。
  // 右括号特殊：维基类链接合法含 )，仅当左括号不少于右括号时才保留。
  while (url.length > 1) {
    const last = url[url.length - 1];
    if (/[.,;!?'"]/.test(last)) { url = url.slice(0, -1); continue; }
    if (last === ")") {
      const opens = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (closes > opens) { url = url.slice(0, -1); continue; }
    }
    break;
  }
  const hasContext = text.trim() !== url;
  return { url, hasContext };
}
