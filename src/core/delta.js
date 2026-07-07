/**
 * delta.js — 三角洲行动改枪码解析。
 *
 * 格式（据真实样本）：枪械名类别-游戏模式-改枪码串
 *   例：M7战斗步枪-全面战场-6H7LTPC08VDRT86E2T096
 *
 * 说明：改枪码逐位对应的配件为官方私有编码，未公开，本地不做逐位解析；
 *       本地准确拆解枪名/类别/模式/码串，配件清单交攻略站查询。
 */

// 改枪码串：较长的大写字母+数字（≥12 位，区别于普通短码）
const CODE_SEG = /^[A-Z0-9]{12,}$/;

/**
 * 解析改枪码。
 * @param {string} text
 * @param {object|null} cfg delta-weapons 数据包
 * @returns {object|null}
 */
export function parseDeltaCode(text, cfg) {
  const t = text.trim();
  const parts = t.split("-");
  if (parts.length < 3) return null;

  // 末段为改枪码串
  const code = parts[parts.length - 1];
  if (!CODE_SEG.test(code)) return null;

  const modes = cfg ? cfg.modes : ["全面战场", "烽火地带"];
  const cats = cfg ? cfg.weaponCategories : ["步枪", "冲锋枪", "狙击步枪"];

  // 中间段含已知模式关键词
  const modeSeg = parts.slice(1, -1).join("-");
  const mode = modes.find((m) => modeSeg.includes(m));
  if (!mode) return null; // 没有合法模式段 → 不是改枪码

  // 首段：枪械名 + 类别
  const weaponSeg = parts[0];
  let category = cats.find((c) => weaponSeg.endsWith(c)) || null;
  let weaponName = category ? weaponSeg.slice(0, -category.length) : weaponSeg;

  return {
    weaponName: weaponName || weaponSeg,
    category: category || "未知类别",
    mode,
    code,
    codeLen: code.length,
    raw: t,
  };
}

