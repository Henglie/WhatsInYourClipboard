/**
 * lang.js — 语种检测（纯本地，基于 Unicode 区间统计）。
 * 只判断"是什么语言"，翻译交给联网按钮（隐私铁律）。
 */

const RANGES = {
  han: /[一-鿿]/,
  kana: /[぀-ヿ]/, // 日文平假名/片假名
  hangul: /[가-힯]/, // 韩文
  cyrillic: /[Ѐ-ӿ]/, // 西里尔（俄语等）
  latin: /[a-zA-Z]/,
  arabic: /[؀-ۿ]/,
  thai: /[฀-๿]/,
};

/** 统计各脚本字符占比，返回主要语种 */
export function detectLang(text) {
  const counts = {};
  let total = 0;
  for (const ch of text) {
    for (const [name, re] of Object.entries(RANGES)) {
      if (re.test(ch)) {
        counts[name] = (counts[name] || 0) + 1;
        total++;
        break;
      }
    }
  }
  if (total === 0) return { lang: "unknown", label: "未知", isForeign: false };

  // 含假名 → 日语；含谚文 → 韩语（优先，因日韩夹用汉字）
  if (counts.kana) return { lang: "ja", label: "日语", isForeign: true };
  if (counts.hangul) return { lang: "ko", label: "韩语", isForeign: true };
  if (counts.cyrillic && counts.cyrillic / total > 0.3)
    return { lang: "ru", label: "俄语（西里尔字母）", isForeign: true };
  if (counts.arabic && counts.arabic / total > 0.3)
    return { lang: "ar", label: "阿拉伯语", isForeign: true };
  if (counts.thai && counts.thai / total > 0.3)
    return { lang: "th", label: "泰语", isForeign: true };

  const hanRatio = (counts.han || 0) / total;
  const latinRatio = (counts.latin || 0) / total;

  if (hanRatio > 0.5) return { lang: "zh", label: "中文", isForeign: false };
  if (latinRatio > 0.6) return { lang: "en", label: "英语（或拉丁字母语言）", isForeign: true };

  return { lang: "unknown", label: "混合/未知", isForeign: false };
}
