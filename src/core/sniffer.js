/**
 * sniffer.js — 解码工具箱「智能嗅探」。
 *
 * 粘贴一段看不懂的串，进工具箱时后台把所有「无参可逆解码器」都跑一遍，
 * 只把「解出了有意义结果」的浮出来，省得用户一个个手点试。
 *
 * 判定「有意义」= 三项加权：
 *   ① 可打印比例（闸门：结果里可读字符占比过低直接淘汰）
 *   ② UTF-8 有效性（含替换字符 U+FFFD → 非法字节 → 淘汰）
 *   ③ 已知模式命中（URL / 邮箱 / JSON / flag{} / 常见英文词等，加权主导得分）
 *
 * 纯可打印≠有意义（rot 系列很容易把明文换成另一堆可打印乱码），
 * 所以纯可打印只当闸门，真正的得分靠模式命中；codec 能干净解码给点小先验。
 *
 * 纯本地纯同步，不联网、不改注册表。ToolMenu 调 sniff() 拿排序结果。
 */
import { CODECS, tryDecode } from "./codec.js";
import { CIPHERS, tryCipher } from "./ciphers.js";

/** 该工具是否适合无参嗅探。全列举型 / 需必填参数的排除。 */
function isSniffable(def) {
  if (def.enumerated) return false; // 全列举型结果非单一解
  const params = def.params || [];
  // 有参数的：仅当每个参数都有可用 default（如码表默认标准表）才跑，
  // 用默认值等价于「标准解码」；需要用户必填 key/shift 的排除。
  for (const p of params) {
    if (p.default === undefined || p.default === null || p.default === "") return false;
  }
  return true;
}

// 可打印：ASCII 可见区 + U+00A1 以上（跳过 Latin-1 控制区，避免高位乱码被当可读）。
const printableRe = /[ -~¡-￿]/;
const controlRe = /[\x00-\x08\x0e-\x1f\x7f]/; // 明确控制字符（放行 \t\n\r）

/** 可打印字符比例 0..1。空串记 0。 */
function printableRatio(s) {
  const chars = [...s];
  if (!chars.length) return 0;
  let ok = 0;
  for (const ch of chars) {
    if (ch === "\t" || ch === "\n" || ch === "\r") { ok++; continue; }
    if (printableRe.test(ch) && !controlRe.test(ch)) ok++;
  }
  return ok / chars.length;
}

/** 含 U+FFFD（非法字节的替换符）→ UTF-8 无效信号。 */
function hasReplacementChar(s) {
  return s.includes("�");
}

const WORD_RE = /[a-z]{3,}/gi;
// 常见英文词，命中几个就大概率「真的解出了英文」。
const COMMON_WORDS = new Set([
  "the", "and", "for", "you", "this", "that", "with", "from", "have",
  "are", "was", "not", "but", "all", "can", "flag", "http", "https",
  "hello", "world", "test", "true", "false", "null", "name", "password",
  "user", "admin", "secret", "key", "data", "code", "your",
]);

/**
 * 模式命中分 0..1。强结构（URL/邮箱/JSON/flag）权重最高，常见英文词次之。
 * 这是嗅探得分的主体——纯可打印但零命中的乱码在这里拿 0，被阈值淘汰。
 */
function patternScore(s) {
  const t = s.trim();
  if (!t) return 0;
  let score = 0;

  // 强结构
  if (/^https?:\/\/\S+$/i.test(t)) score += 0.7;
  else if (/https?:\/\/\S+/i.test(t)) score += 0.35;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) score += 0.6;
  if (/^[\[{][\s\S]*[\]}]$/.test(t)) {
    try { JSON.parse(t); score += 0.7; } catch { /* 非合法 JSON，不加 */ }
  }
  if (/flag\{[^}]+\}/i.test(t)) score += 0.7; // CTF flag 格式

  // 常见英文词命中
  const words = t.toLowerCase().match(WORD_RE) || [];
  let hit = 0;
  for (const w of words) if (COMMON_WORDS.has(w)) hit++;
  if (hit) score += Math.min(0.5, hit * 0.2);

  // 纯 ASCII 可读句 + 至少命中 1 个常见词 → 给句式分（拦「可打印乱码」白拿分）
  if (hit >= 1 && words.length >= 2 && /^[\x20-\x7e\s]+$/.test(t)) score += 0.2;

  return Math.min(1, score);
}

/**
 * 综合评分 0..1。可打印比例与 UTF-8 是闸门，得分主体是模式命中；
 * codec 能干净解码本身是信号（base 系列），给 0.15 小先验，cipher 不给
 * （替换密码太容易把任意输入换成可打印串）。
 */
function scoreResult(result, kind) {
  if (typeof result !== "string" || result.length === 0) return 0;
  if (printableRatio(result) < 0.8) return 0;   // 乱码闸门
  if (hasReplacementChar(result)) return 0;      // UTF-8 非法闸门
  let s = patternScore(result);
  if (kind === "codec") s += 0.15;
  return Math.min(1, s);
}

const SCORE_THRESHOLD = 0.35;

/**
 * 对一段原文跑全部可嗅探解码器，返回按分降序的有意义候选。
 * @param {string} raw 剪贴板原文
 * @param {number} [limit=8] 最多返回几条
 * @returns {Array<{kind:'codec'|'cipher', id:string, def:object, result:string, score:number, preview:string}>}
 */
export function sniff(raw, limit = 8) {
  const text = String(raw || "");
  if (text.trim().length === 0) return [];
  const out = [];

  const run = (kind, registry, tryFn) => {
    for (const [id, def] of Object.entries(registry)) {
      if (!isSniffable(def)) continue;
      let r;
      try { r = tryFn(id, text, {}); } catch { continue; }
      if (!r || !r.ok || typeof r.result !== "string") continue;
      const result = r.result;
      if (result.trim() === text.trim()) continue;      // 等于没解
      const score = scoreResult(result, kind);
      if (score < SCORE_THRESHOLD) continue;
      out.push({
        kind, id, def, result, score,
        preview: result.length > 120 ? result.slice(0, 120) + "…" : result,
      });
    }
  };

  run("codec", CODECS, tryDecode);
  run("cipher", CIPHERS, tryCipher);

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
