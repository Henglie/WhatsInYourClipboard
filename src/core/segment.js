/**
 * segment.js — 剪贴板多内容智能分段。
 *
 * 难点：区分「该拆的多条结构化内容」与「不该拆的整段文本/小说」。
 * 策略：
 *   1. 先按行切分。
 *   2. 统计有多少行是"结构化条目"（URL/邮箱/IP/哈希/手机号等，短且自成一体）。
 *   3. 若多数行是结构化条目 → 判定为多内容，逐行返回。
 *   4. 否则视为整段自然文本（小说/段落），不拆，返回单段。
 */

// 结构化条目的快速特征（不求全，只为判断"是否成行的独立条目"）
const STRUCT_PATTERNS = [
  /^https?:\/\/\S+$/i, // URL
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, // 邮箱
  /^(?:\d{1,3}\.){3}\d{1,3}$/, // IPv4
  /^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$/i, // 哈希
  /^1[3-9]\d{9}$/, // 手机号
  /^\d{17}[\dXx]$/, // 身份证
  /^0x[0-9a-fA-F]{40}$/, // ETH 地址
  /^[\w.+-]+:\/\/\S+$/, // 通用协议链接
  /^\S+\.(zip|exe|dll|pdf|png|jpg|jpeg|gif|mp4|doc|docx|xlsx)$/i, // 文件名
];

function isStructuredLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 200) return false; // 太长更像句子
  return STRUCT_PATTERNS.some((re) => re.test(t));
}

/** 一行是否像自然语言句子（含中文标点或较长且有空格分词） */
function isProseLine(line) {
  const t = line.trim();
  if (/[，。！？；：""''、]/.test(t)) return true; // 中文标点
  if (t.length > 60) return true; // 长行
  return false;
}

/**
 * 分析文本是否为多条内容。
 * @param {string} text
 * @returns {{ multi: boolean, segments: string[], reason: string }}
 */
export function segmentText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 单行或空 → 不拆
  if (lines.length < 2) {
    return { multi: false, segments: [text.trim()], reason: "单行内容" };
  }

  const structCount = lines.filter(isStructuredLine).length;
  const proseCount = lines.filter(isProseLine).length;
  const structRatio = structCount / lines.length;

  // 多数行是结构化条目 → 多内容
  if (structCount >= 2 && structRatio >= 0.6 && proseCount === 0) {
    return {
      multi: true,
      segments: lines,
      reason: `检测到 ${lines.length} 行结构化条目`,
    };
  }

  // 含散文行 → 整段文本，不拆
  if (proseCount > 0) {
    return { multi: false, segments: [text.trim()], reason: "含自然语言段落，按整体处理" };
  }

  // 全是短行但非明显结构化：保守起见，若行数不多且都很短才拆
  if (lines.length >= 2 && lines.length <= 20 && lines.every((l) => l.length <= 40)) {
    return {
      multi: true,
      segments: lines,
      reason: `检测到 ${lines.length} 行短文本条目`,
    };
  }

  return { multi: false, segments: [text.trim()], reason: "按整体文本处理" };
}
