/**
 * classicalGrid.js — Polybius 网格家族古典密码（移植自 ToolsFx，ISC，鸣谢 Leon406）。
 *
 * 共享 ToolsFx 的键控 Polybius（letters↔数字对，默认 J→I、码表 12345），
 * 在其上构建：Bifid、Trifid、ADFGX、ADFGVX、PlayFair、Nihilist、TapCode、FourSquare、GrayCode。
 *
 * 全部含 encode（加密）与 decode（解密/还原），往返测试验证互逆。
 * 算法逐行对照 ToolsFx 源码移植，未凭记忆。
 */

export const TABLE_AZ_NO_J = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // 25，无 J
export const TABLE_AZ_NO_K = "ABCDEFGHIJLMNOPQRSTUVWXYZ"; // 25，无 K
const ADFGX_MAP = "ADFGX";
const ADFGVX_MAP = "ADFGVX";
// ADFGVX 6×6 默认表：A-Z + 0-9（无字母剔除）
export const TABLE_ADFGVX = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const stripSpace = (s) => s.replace(/\s+/g, "");
const onlyLetters = (s) => s.replace(/[^a-zA-Z]/g, "");

// ---------- 键控 Polybius（ToolsFx polybius / polybiusDecrypt） ----------
// 加密：字母 → 数字对（按 table 在网格中的行列）
export function polyEncrypt(text, table = TABLE_AZ_NO_J, encMap = "12345", rep = ["J", "I"]) {
  const t = stripSpace(table).toUpperCase();
  const map = {};
  for (let i = 0; i < t.length; i++) {
    map[t[i]] = encMap[Math.floor(i / encMap.length)] + encMap[i % encMap.length];
  }
  let s = text.toUpperCase();
  if (rep && rep[0]) s = s.split(rep[0]).join(rep[1]);
  return [...s].map((c) => map[c] ?? c).join("");
}
// 解密：数字对 → 字母
export function polyDecrypt(text, table = TABLE_AZ_NO_J, encMap = "12345") {
  const t = stripSpace(table).toUpperCase();
  const map = {};
  for (let i = 0; i < t.length; i++) {
    map[encMap[Math.floor(i / encMap.length)] + encMap[i % encMap.length]] = t[i];
  }
  let sb = "", tmp = "";
  for (const c of text) {
    if (/[0-9a-zA-Z]/.test(c)) {
      if (tmp.length === 1) { tmp += c; sb += map[tmp] ?? tmp; tmp = ""; }
      else tmp = c;
    } else sb += c;
  }
  return sb;
}

// ---------- Bifid（按 period 分组的 Polybius 转置） ----------
export function bifidEncode(text, key = TABLE_AZ_NO_J, period = 1) {
  const poly = polyEncrypt(onlyLetters(text), key);
  let mixed = "";
  for (let i = 0; i < poly.length; i += period * 2) {
    const chunk = poly.slice(i, i + period * 2);
    let even = "", odd = "";
    for (let j = 0; j < chunk.length; j++) (j % 2 === 0 ? (even += chunk[j]) : (odd += chunk[j]));
    mixed += even + odd;
  }
  return polyDecrypt(mixed, key);
}
export function bifidDecode(text, key = TABLE_AZ_NO_J, period = 1) {
  const poly = polyEncrypt(onlyLetters(text), key);
  let mixed = "";
  for (let i = 0; i < poly.length; i += period * 2) {
    const chunk = poly.slice(i, i + period * 2);
    const half = chunk.length / 2;
    const acc = new Array(chunk.length);
    for (let j = 0; j < chunk.length; j++) {
      if (j < half) acc[j * 2] = chunk[j];
      else acc[(j - half) * 2 + 1] = chunk[j];
    }
    mixed += acc.join("");
  }
  return polyDecrypt(mixed, key);
}

// ---------- Trifid（3×3×3，key 长 27） ----------
function trifidSquareIndex(squares, ch) {
  const r = [0, 0, 0];
  squares.forEach((sq, idx) => {
    const p = sq.indexOf(ch);
    if (p !== -1) { r[0] = idx + 1; r[1] = Math.floor(p / 3) + 1; r[2] = (p % 3) + 1; }
  });
  return r.join("");
}
function trifidSquare(squares, sq, row, col) {
  return squares[sq - 1][col - 1 + 3 * (row - 1)];
}
export function trifidEncode(text, key, period = 1) {
  if (!key || key.length !== 27) throw new Error("Trifid 密钥须为 27 字符");
  const squares = [key.slice(0, 9), key.slice(9, 18), key.slice(18, 27)];
  const digits = [...text.toUpperCase()].map((c) => trifidSquareIndex(squares, c)).join("");
  let mixed = "";
  for (let i = 0; i < digits.length; i += period * 3) {
    const chunk = digits.slice(i, i + period * 3);
    let a = "", b = "", c = "";
    for (let j = 0; j < chunk.length; j++) {
      if (j % 3 === 0) a += chunk[j]; else if (j % 3 === 1) b += chunk[j]; else c += chunk[j];
    }
    mixed += a + b + c;
  }
  let out = "";
  for (let i = 0; i + 3 <= mixed.length; i += 3) {
    const p = [+mixed[i], +mixed[i + 1], +mixed[i + 2]];
    out += trifidSquare(squares, p[0], p[1], p[2]);
  }
  return out;
}
export function trifidDecode(text, key, period = 1) {
  if (!key || key.length !== 27) throw new Error("Trifid 密钥须为 27 字符");
  const squares = [key.slice(0, 9), key.slice(9, 18), key.slice(18, 27)];
  const digits = [...text.toUpperCase()].map((c) => trifidSquareIndex(squares, c)).join("");
  let mixed = "";
  for (let i = 0; i < digits.length; i += period * 3) {
    const chunk = digits.slice(i, i + period * 3);
    const third = chunk.length / 3;
    const acc = new Array(chunk.length);
    for (let j = 0; j < chunk.length; j++) {
      const s = Math.floor(j / third);
      const m = j % third;
      acc[m * 3 + s] = chunk[j];
    }
    mixed += acc.join("");
  }
  let out = "";
  for (let i = 0; i + 3 <= mixed.length; i += 3) {
    const p = [+mixed[i], +mixed[i + 1], +mixed[i + 2]];
    out += trifidSquare(squares, p[0], p[1], p[2]);
  }
  return out;
}

// ---------- PlayFair（5×5 键控方阵） ----------
function playfairAlphabet(keyword) {
  const alpha = [...TABLE_AZ_NO_J];
  const key = [...new Set(keyword.replace(/ /g, "").toUpperCase())];
  for (const c of key) { const i = alpha.indexOf(c); if (i !== -1) alpha.splice(i, 1); }
  return key.concat(alpha);
}
const pfCase = (resultChar, srcChar) =>
  /[a-z]/.test(srcChar) ? resultChar.toLowerCase() : resultChar.toUpperCase();
const pfPoint = (i) => [Math.floor(i / 5), i % 5];
export function playfairEncode(text, keyword = "") {
  const alpha = playfairAlphabet(keyword);
  let s = text
    .replace(/ /g, "").replace(/J/g, "I").replace(/j/g, "i")
    .replace(/(\w)\1/g, "$1X$1");
  if (s.length % 2 !== 0) s += "X";
  let out = "";
  for (let i = 0; i < s.length; i += 2) {
    const c1 = s[i], c2 = s[i + 1];
    const [r1, col1] = pfPoint(alpha.indexOf(c1.toUpperCase()));
    const [r2, col2] = pfPoint(alpha.indexOf(c2.toUpperCase()));
    if (r1 === r2) {
      out += pfCase(alpha[5 * r2 + (col1 + 1) % 5], c2);
      out += pfCase(alpha[5 * r1 + (col2 + 1) % 5], c1);
    } else if (col1 === col2) {
      out += pfCase(alpha[5 * ((r1 + 1) % 5) + col2], c1);
      out += pfCase(alpha[5 * ((r2 + 1) % 5) + col1], c2);
    } else {
      out += pfCase(alpha[5 * r1 + col2], c1);
      out += pfCase(alpha[5 * r2 + col1], c2);
    }
  }
  return out;
}
export function playfairDecode(text, keyword = "") {
  const alpha = playfairAlphabet(keyword);
  const s = stripSpace(text);
  let out = "";
  for (let i = 0; i < s.length; i += 2) {
    const c1 = s[i], c2 = s[i + 1];
    if (c2 === undefined) { out += c1; break; }
    const [r1, col1] = pfPoint(alpha.indexOf(c1.toUpperCase()));
    const [r2, col2] = pfPoint(alpha.indexOf(c2.toUpperCase()));
    if (r1 === r2) {
      out += pfCase(alpha[5 * r2 + (col1 + 4) % 5], c2);
      out += pfCase(alpha[5 * r1 + (col2 + 4) % 5], c1);
    } else if (col1 === col2) {
      out += pfCase(alpha[5 * ((r1 + 4) % 5) + col2], c1);
      out += pfCase(alpha[5 * ((r2 + 4) % 5) + col1], c2);
    } else {
      out += pfCase(alpha[5 * r1 + col2], c1);
      out += pfCase(alpha[5 * r2 + col1], c2);
    }
  }
  return out.replace(/(\w)X\1/g, "$1$1");
}

// ---------- ADFGX / ADFGVX（Polybius + 列移位） ----------
function adfgxEncode(text, table, keyword, encMap, rep) {
  const key = [...new Set(keyword)];
  const poly = polyEncrypt(text, table, encMap, rep);
  const cols = key.map(() => []);
  for (let i = 0; i < poly.length; i++) cols[i % key.length].push(poly[i]);
  // 按 key 字符排序后拼接各列
  const order = key.map((c, i) => [c, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return order.map(([, i]) => cols[i].join("")).join("");
}
function adfgxDecode(text, table, keyword, encMap) {
  const key = [...new Set(keyword)];
  const klen = key.length;
  const count = text.length % klen;
  const len = Math.floor(text.length / klen);
  // 每个 key 字符对应列长（前 count 个多 1），按排序后切片
  const order = key.map((c, i) => [c, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const colLenByOrig = key.map((_, i) => len + (i < count ? 1 : 0));
  // 排序后各列依次取片
  const sortedColLens = order.map(([, i]) => colLenByOrig[i]);
  const slices = [];
  let pos = 0;
  for (const L of sortedColLens) { slices.push(text.slice(pos, pos + L)); pos += L; }
  // 列 → 原始 key 字符
  const colByOrig = {};
  order.forEach(([, origI], k) => { colByOrig[origI] = slices[k]; });
  // 逐行重建
  const out = new Array(text.length);
  const ptr = key.map(() => 0);
  for (let i = 0; i < text.length; i++) {
    const k = i % klen;
    out[i] = colByOrig[k][ptr[k]++];
  }
  return polyDecrypt(out.join(""), table, encMap);
}
export const adfgxEnc = (text, table = TABLE_AZ_NO_J, keyword = "KEY") =>
  adfgxEncode(text, table, keyword, ADFGX_MAP, ["J", "I"]);
export const adfgxDec = (text, table = TABLE_AZ_NO_J, keyword = "KEY") =>
  adfgxDecode(text, table, keyword, ADFGX_MAP);
export const adfgvxEnc = (text, table = TABLE_ADFGVX, keyword = "KEY") =>
  adfgxEncode(text, table, keyword, ADFGVX_MAP, ["", ""]);
export const adfgvxDec = (text, table = TABLE_ADFGVX, keyword = "KEY") =>
  adfgxDecode(text, table, keyword, ADFGVX_MAP);

// ---------- Nihilist（键控 Polybius 字母表） ----------
function nihilistTable(keyword) {
  const alpha = [...TABLE_AZ_NO_J];
  const key = [...new Set(stripSpace(keyword).toUpperCase())];
  for (const c of key) { const i = alpha.indexOf(c); if (i !== -1) alpha.splice(i, 1); }
  return key.concat(alpha).join("");
}
export const nihilistEncode = (text, keyword = "KEY") =>
  polyEncrypt(text, nihilistTable(keyword));
export const nihilistDecode = (text, keyword = "KEY") =>
  polyDecrypt(text, nihilistTable(keyword));

// ---------- TapCode（敲击码，无 K，K→C） ----------
export const tapCodeEncode = (text) => polyEncrypt(text, TABLE_AZ_NO_K, "12345", ["K", "C"]);
export const tapCodeDecode = (text) => polyDecrypt(propTapCode(text), TABLE_AZ_NO_K);
function propTapCode(text) {
  if (/[.•]/.test(text)) {
    return text.split(/\s{2,}/).map((it) => {
      const sp = it.split(/\s+/);
      return `${sp[0].length}${sp[1].length}`;
    }).join("");
  }
  return text;
}

// ---------- FourSquare（双 25 字母密钥方阵） ----------
export function fourSquareEncode(text, key1, key2) {
  const k1 = onlyLetters(key1).toUpperCase();
  const k2 = onlyLetters(key2).toUpperCase();
  if (k1.length !== 25 || k2.length !== 25) throw new Error("两个密钥须各为 25 字母");
  let s = onlyLetters(text).toUpperCase();
  if (s.length % 2 !== 0) s += "X";
  let out = "";
  for (let i = 0; i < s.length; i += 2) {
    const a = TABLE_AZ_NO_J.indexOf(s[i]), b = TABLE_AZ_NO_J.indexOf(s[i + 1]);
    const ar = Math.floor(a / 5), ac = a % 5, br = Math.floor(b / 5), bc = b % 5;
    out += k1[ar * 5 + bc] + k2[br * 5 + ac];
  }
  return out;
}
export function fourSquareDecode(text, key1, key2) {
  const k1 = onlyLetters(key1).toUpperCase();
  const k2 = onlyLetters(key2).toUpperCase();
  if (k1.length !== 25 || k2.length !== 25) throw new Error("两个密钥须各为 25 字母");
  let s = onlyLetters(text).toUpperCase();
  if (s.length % 2 !== 0) s += "X";
  let out = "";
  for (let i = 0; i < s.length; i += 2) {
    const a = k1.indexOf(s[i]), b = k2.indexOf(s[i + 1]);
    const ar = Math.floor(a / 5), ac = a % 5, br = Math.floor(b / 5), bc = b % 5;
    out += TABLE_AZ_NO_J[ar * 5 + bc] + TABLE_AZ_NO_J[br * 5 + ac];
  }
  return out;
}

// ---------- GrayCode（格雷码 ↔ 二进制 ↔ ASCII） ----------
const te = (s) => [...new TextEncoder().encode(s)];
const td = (b) => new TextDecoder("utf-8").decode(new Uint8Array(b));
export function grayEncode(text) {
  const bin = te(text).map((b) => b.toString(2).padStart(8, "0")).join("");
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += i === 0 ? bin[0] : String((+bin[i]) ^ (+bin[i - 1]));
  }
  return out;
}
export function grayDecode(text) {
  const bin = text.replace(/[^01]/g, "");
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += i === 0 ? bin[0] : String((+bin[i]) ^ (+out[i - 1]));
  }
  const bytes = [];
  for (let i = 0; i + 8 <= out.length; i += 8) bytes.push(parseInt(out.slice(i, i + 8), 2));
  return td(bytes);
}

