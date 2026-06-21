/**
 * classicalCiphers.js — 古典密码（移植自 ToolsFx，ISC，鸣谢 Leon406）。
 * Polybius、Beaufort、Gronsfeld、Porta。多为需密钥，用 ToolsFx 默认密钥。
 */

const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AZ_NO_J = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // 25 字母，无 J

// ---------- Polybius 方阵（5×5，J→I） ----------
export function polybiusDecode(text, table = AZ_NO_J, encMap = "12345") {
  const t = table.replace(/\s/g, "").toUpperCase();
  const map = {};
  for (let i = 0; i < t.length; i++) {
    const key = `${encMap[Math.floor(i / encMap.length)]}${encMap[i % encMap.length]}`;
    map[key] = t[i];
  }
  let out = "";
  let tmp = "";
  for (const c of text) {
    if (/[0-9a-zA-Z]/.test(c)) {
      if (tmp.length === 1) {
        tmp += c;
        out += map[tmp] || tmp;
        tmp = "";
      } else {
        tmp = c;
      }
    } else {
      out += c;
    }
  }
  return out;
}

// ---------- Beaufort（自反，编解码同形） ----------
export function beaufort(text, key = "FORTIFICATION") {
  const k = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!k) return text;
  let idx = 0;
  let out = "";
  for (const ch of text.toUpperCase()) {
    if (!/[A-Z]/.test(ch)) continue;
    out += AZ[(AZ.indexOf(k[idx % k.length]) - AZ.indexOf(ch) + 26) % 26];
    idx++;
  }
  return out;
}

// ---------- Gronsfeld（数字密钥维吉尼亚，解密） ----------
export function gronsfeldDecode(text, key = "123456") {
  const shifts = key.replace(/\D/g, "").split("").map(Number);
  if (!shifts.length) return text;
  let idx = 0;
  let out = "";
  for (const ch of text.toUpperCase()) {
    if (!/[A-Z]/.test(ch)) continue;
    out += AZ[(AZ.indexOf(ch) + 26 - shifts[idx % shifts.length]) % 26];
    idx++;
  }
  return out;
}

// Gronsfeld 加密（正向 +shift）
export function gronsfeldEncode(text, key = "123456") {
  const shifts = key.replace(/\D/g, "").split("").map(Number);
  if (!shifts.length) return text;
  let idx = 0;
  let out = "";
  for (const ch of text.toUpperCase()) {
    if (!/[A-Z]/.test(ch)) continue;
    out += AZ[(AZ.indexOf(ch) + shifts[idx % shifts.length]) % 26];
    idx++;
  }
  return out;
}

// Polybius 加密（字母 → 坐标对）
export function polybiusEncode(text, table = AZ_NO_J, encMap = "12345") {
  const t = table.replace(/\s/g, "").toUpperCase();
  let out = "";
  for (const ch of text.toUpperCase()) {
    let c = ch;
    if (c === "J") c = "I"; // 5×5 方阵 J→I
    const i = t.indexOf(c);
    if (i === -1) { out += ch; continue; }
    out += `${encMap[Math.floor(i / encMap.length)]}${encMap[i % encMap.length]}`;
  }
  return out;
}

// ---------- Porta（自反，编解码同形） ----------
const PORTA_ROWS = {
  A: "NOPQRSTUVWXYZABCDEFGHIJKLM", B: "NOPQRSTUVWXYZABCDEFGHIJKLM",
  Y: "ZNOPQRSTUVWXYBCDEFGHIJKLMA", Z: "ZNOPQRSTUVWXYBCDEFGHIJKLMA",
  W: "YZNOPQRSTUVWXCDEFGHIJKLMAB", X: "YZNOPQRSTUVWXCDEFGHIJKLMAB",
  U: "XYZNOPQRSTUVWDEFGHIJKLMABC", V: "XYZNOPQRSTUVWDEFGHIJKLMABC",
  S: "WXYZNOPQRSTUVEFGHIJKLMABCD", T: "WXYZNOPQRSTUVEFGHIJKLMABCD",
  Q: "VWXYZNOPQRSTUFGHIJKLMABCDE", R: "VWXYZNOPQRSTUFGHIJKLMABCDE",
  O: "UVWXYZNOPQRSTGHIJKLMABCDEF", P: "UVWXYZNOPQRSTGHIJKLMABCDEF",
  M: "TUVWXYZNOPQRSHIJKLMABCDEFG", N: "TUVWXYZNOPQRSHIJKLMABCDEFG",
  K: "STUVWXYZNOPQRIJKLMABCDEFGH", L: "STUVWXYZNOPQRIJKLMABCDEFGH",
  I: "RSTUVWXYZNOPQJKLMABCDEFGHI", J: "RSTUVWXYZNOPQJKLMABCDEFGHI",
  G: "QRSTUVWXYZNOPKLMABCDEFGHIJ", H: "QRSTUVWXYZNOPKLMABCDEFGHIJ",
  E: "PQRSTUVWXYZNOLMABCDEFGHIJK", F: "PQRSTUVWXYZNOLMABCDEFGHIJK",
  C: "OPQRSTUVWXYZNMABCDEFGHIJKL", D: "OPQRSTUVWXYZNMABCDEFGHIJKL",
};
export function porta(text, key = "FORTIFICATION") {
  const k = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!k) return text;
  let idx = 0;
  let out = "";
  for (const ch of text.toUpperCase()) {
    if (!/[A-Z]/.test(ch)) continue;
    const row = PORTA_ROWS[k[idx % k.length]];
    out += row[AZ.indexOf(ch)];
    idx++;
  }
  return out;
}
