/**
 * poetry.js — 古诗词智能结构分析（纯本地，准确）。
 *
 * 思路：结构分析本地做（可准确），平仄/出处交联网权威站点。
 *  1. 智能分句（标点 + 换行）
 *  2. 言数/句数结构 → 判定诗体（绝句/律诗/词/对联）
 *  3. 词牌名 / 诗人名关键词命中 → 提升置信度
 *  4. 韵脚定位（每句末字）
 */

/** 智能分句：按中文标点和换行切，去空白 */
export function splitVerses(text) {
  return text
    .split(/[，。！？；,.!?;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 判断字符是否汉字 */
function isHan(ch) {
  return /[一-鿿]/.test(ch);
}

/** 一句中的汉字数 */
function hanLen(s) {
  return (s.match(/[一-鿿]/g) || []).length;
}

/**
 * 分析诗词结构。
 * @param {string} text
 * @param {object} ctx { cipai: 词牌库, poets: 诗人库 } 已缓存数据
 * @returns {object|null} 结构信息；不像诗词返回 null
 */
export function analyzePoetry(text, ctx = {}) {
  const raw = text.trim();
  if (raw.length < 4 || raw.length > 200) return null;

  const verses = splitVerses(raw);
  if (verses.length < 2) return null;

  const lens = verses.map(hanLen);
  // 句子必须主要由汉字构成
  const totalHan = lens.reduce((a, b) => a + b, 0);
  if (totalHan / raw.replace(/\s/g, "").length < 0.7) return null;

  let score = 0;
  const signals = [];

  // 信号1：等言整齐（绝句/律诗特征）
  const allEqual = lens.every((l) => l === lens[0]);
  const isFiveOrSeven = lens[0] === 5 || lens[0] === 7;
  if (allEqual && isFiveOrSeven) {
    score += 3;
    signals.push("句式整齐");
  }

  // 信号2：词牌名命中（首句可能是词牌名）
  let cipaiHit = null;
  if (ctx.cipai) {
    const first = verses[0];
    for (const cat of ["小令", "中调", "长调"]) {
      if (ctx.cipai[cat] && first in ctx.cipai[cat]) {
        cipaiHit = { name: first, category: cat, count: ctx.cipai[cat][first] };
        score += 4;
        signals.push(`首句是词牌名「${first}」`);
        break;
      }
    }
  }

  // 信号3：诗人名命中
  let poetHit = null;
  if (ctx.poets) {
    for (const name of Object.keys(ctx.poets)) {
      if (name.length >= 2 && raw.includes(name)) {
        poetHit = { name, dynasty: ctx.poets[name] };
        score += 2;
        signals.push(`含诗人「${name}」`);
        break;
      }
    }
  }

  // 信号4：偶数句（律诗8句/绝句4句/词上下阕对称）
  if (verses.length % 2 === 0 && verses.length >= 2) {
    score += 1;
  }

  // 信号5：长短句交替且较多句 → 词的特征
  const varied = new Set(lens).size > 1;
  if (varied && verses.length >= 4 && cipaiHit) {
    score += 1;
  }

  if (score < 3) return null; // 不够像诗词

  // 推定诗体
  let form = "古诗词";
  if (cipaiHit) form = `词 · ${cipaiHit.name}`;
  else if (allEqual && lens[0] === 5 && verses.length === 4) form = "五言绝句";
  else if (allEqual && lens[0] === 7 && verses.length === 4) form = "七言绝句";
  else if (allEqual && lens[0] === 5 && verses.length === 8) form = "五言律诗";
  else if (allEqual && lens[0] === 7 && verses.length === 8) form = "七言律诗";
  else if (verses.length === 2 && allEqual) form = "对联 / 联句";
  else if (allEqual && isFiveOrSeven) form = `${lens[0] === 5 ? "五" : "七"}言${verses.length}句`;

  // 韵脚：偶数句末字（古诗多偶句押韵）
  const rhymes = verses
    .map((v, i) => ({ idx: i + 1, last: v[v.length - 1] }))
    .filter((_, i) => (i + 1) % 2 === 0)
    .map((r) => r.last);

  return {
    verses,
    lens,
    form,
    score,
    signals,
    cipaiHit,
    poetHit,
    rhymes: [...new Set(rhymes)],
  };
}
