/**
 * zeroWidth.js — 不可见字符 / 零宽隐写侦测与解码。
 *
 * 「剪贴板透视」的暗面：一段看起来普普通通的文字，字里行间可能藏着
 * 肉眼看不见的字符——用来隐写消息、追踪泄密源、或做视觉欺骗攻击。
 * 本模块把这些不可见字符揪出来、分类、并尽力还原藏进去的内容。
 * 覆盖四类：
 *   (1) 零宽字符隐写：U+200B/200C/200D/FEFF 等编码二进制或文本
 *   (2) Unicode Tag 走私：U+E0000-E007F（ASCII 的「幽灵」镜像，
 *       近年 LLM prompt 注入常用，把指令藏进不可见 tag 字符）
 *   (3) 变体选择器隐写：U+FE00-FE0F / U+E0100-E01EF 附加数据
 *   (4) 双向控制欺骗：U+202A-202E/2066-2069（bidi override，
 *       让 "gpj.exe" 显示成 "exe.jpg" 之类的视觉欺骗）
 *
 * 纯本地纯同步。源码内所有不可见字符一律用 \u 转义书写，避免污染文件。
 */

// — 各类不可见 / 危险字符表（码点 → 人类可读名）——
const ZERO_WIDTH = {
  0x200b: "ZERO WIDTH SPACE",
  0x200c: "ZERO WIDTH NON-JOINER",
  0x200d: "ZERO WIDTH JOINER",
  0xfeff: "ZERO WIDTH NO-BREAK SPACE (BOM)",
  0x2060: "WORD JOINER",
  0x180e: "MONGOLIAN VOWEL SEPARATOR",
};
const BIDI = {
  0x202a: "LEFT-TO-RIGHT EMBEDDING",
  0x202b: "RIGHT-TO-LEFT EMBEDDING",
  0x202c: "POP DIRECTIONAL FORMATTING",
  0x202d: "LEFT-TO-RIGHT OVERRIDE",
  0x202e: "RIGHT-TO-LEFT OVERRIDE",
  0x2066: "LEFT-TO-RIGHT ISOLATE",
  0x2067: "RIGHT-TO-LEFT ISOLATE",
  0x2068: "FIRST STRONG ISOLATE",
  0x2069: "POP DIRECTIONAL ISOLATE",
};
// 会造成视觉重排（真正危险）的 bidi 覆盖/隔离子集，用于 isStego 强判定。
const BIDI_OVERRIDE = new Set([0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x202a, 0x202b]);

/** 码点是否 Unicode Tag（E0000–E007F）。 */
function isTagChar(cp) {
  return cp >= 0xe0000 && cp <= 0xe007f;
}
/** 码点是否变体选择器。 */
function isVariationSelector(cp) {
  return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
}

/** 分类单个码点，命中返回 { name, cat }，否则 null。 */
function classifyCodePoint(cp) {
  if (ZERO_WIDTH[cp]) return { name: ZERO_WIDTH[cp], cat: "zw" };
  if (BIDI[cp]) return { name: BIDI[cp], cat: "bidi" };
  if (isTagChar(cp)) {
    const name = cp === 0xe0001 ? "TAG LANGUAGE" : "TAG '" + String.fromCharCode(cp - 0xe0000) + "'";
    return { name, cat: "tag" };
  }
  if (isVariationSelector(cp)) return { name: "VARIATION SELECTOR", cat: "vs" };
  return null;
}

/**
 * 检测文本中的不可见字符。
 * @returns {{ visible:string, hidden:Array<{cp,hex,name,cat,index}>, counts:object, raw:string }}
 *   visible : 剥掉所有不可见字符后的肉眼可见文本
 *   hidden  : 命中的不可见字符列表（index = 在 visible 中的插入位）
 *   counts  : { zw, bidi, tag, vs }
 *   raw     : 全部不可见字符按出现序拼成的串（供解码器复用）
 */
export function detect(text) {
  const s = String(text || "");
  const hidden = [];
  const counts = { zw: 0, bidi: 0, tag: 0, vs: 0 };
  let visible = "";
  let raw = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    const info = classifyCodePoint(cp);
    if (info) {
      hidden.push({
        cp,
        hex: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
        name: info.name,
        cat: info.cat,
        index: visible.length,
      });
      counts[info.cat] = (counts[info.cat] || 0) + 1;
      raw += ch;
    } else {
      visible += ch;
    }
  }
  return { visible, hidden, counts, raw };
}

/** 从文本抽出全部指定类别的码点数组（按出现序）。 */
function codePointsOfCat(text, cat) {
  const out = [];
  for (const ch of String(text || "")) {
    const cp = ch.codePointAt(0);
    const info = classifyCodePoint(cp);
    if (info && info.cat === cat) out.push(cp);
  }
  return out;
}

const utf8Decode = (bytes) => new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
const utf8Encode = (str) => [...new TextEncoder().encode(str)];

// —— 方案 A：Unicode Tag（ASCII 走私）——
// 每个 tag 字符码点 = U+E0000 + 字节值。解码即 cp - 0xE0000。
// 这是当前最常见的隐藏文本 / 提示注入载体。
export function decodeTags(text) {
  const cps = codePointsOfCat(text, "tag");
  if (!cps.length) return null;
  const bytes = cps.map((cp) => cp - 0xe0000).filter((b) => b >= 0x20 && b <= 0x7e);
  if (!bytes.length) return null;
  return utf8Decode(bytes);
}

// —— 方案 B：变体选择器隐写（Paul Butler, 2024）——
// 字节 0..15 → U+FE00 + b ；字节 16..255 → U+E0100 + (b-16)。可藏任意字节流。
export function decodeVariationSelectors(text) {
  const bytes = [];
  for (const cp of codePointsOfCat(text, "vs")) {
    if (cp >= 0xfe00 && cp <= 0xfe0f) bytes.push(cp - 0xfe00);
    else if (cp >= 0xe0100 && cp <= 0xe01ef) bytes.push(cp - 0xe0100 + 16);
  }
  if (!bytes.length) return null;
  return utf8Decode(bytes);
}

// —— 方案 C：零宽二进制 —— ZWSP(U+200B)=0，ZWNJ(U+200C)=1，每 8 位一字节。
// 零宽隐写无唯一标准，这是最常见的一种约定；解不出可读结果即说明用了别的方案。
export function decodeZeroWidthBinary(text) {
  let bits = "";
  for (const ch of String(text || "")) {
    const cp = ch.codePointAt(0);
    if (cp === 0x200b) bits += "0";
    else if (cp === 0x200c) bits += "1";
  }
  if (bits.length < 8) return null;
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  if (!bytes.length) return null;
  return utf8Decode(bytes);
}

/** 结果是否「像有意义的文本」：非空、可打印比例够高、无替换符。 */
function looksMeaningful(s) {
  if (!s || !s.length) return false;
  if (s.includes("�")) return false;
  let ok = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp !== 0x7f)) ok++;
  }
  return ok / [...s].length >= 0.8;
}

/**
 * 综合尝试所有解码方案，返回能解出「像样文本」的结果（按方案固定序）。
 * @returns {Array<{scheme:string, message:string}>}
 */
export function decodeAll(text) {
  const out = [];
  const tries = [
    ["tags", decodeTags(text)],
    ["variationSelectors", decodeVariationSelectors(text)],
    ["zeroWidthBinary", decodeZeroWidthBinary(text)],
  ];
  for (const [scheme, msg] of tries) {
    if (msg && looksMeaningful(msg)) out.push({ scheme, message: msg });
  }
  return out;
}

/**
 * 判定一段文本是否值得当「隐写/藏字」看待（分类器 match 用）。
 * 强信号：含 tag 字符 / bidi 覆盖 / 零宽字符≥4 / 变体选择器≥4。
 * 刻意不把单独的 ZWJ(200D) 计入零宽阈值——emoji 连接序列合法使用它。
 */
export function isStego(info) {
  if (info.counts.tag > 0) return true;
  if (info.hidden.some((h) => BIDI_OVERRIDE.has(h.cp))) return true;
  const zwNoJoiner = info.hidden.filter((h) => h.cat === "zw" && h.cp !== 0x200d).length;
  if (zwNoJoiner >= 4) return true;
  if (info.counts.vs >= 4) return true;
  return false;
}
