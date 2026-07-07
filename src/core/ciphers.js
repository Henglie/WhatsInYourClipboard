/**
 * ciphers.js — 古典密码 / CTF 编码（纯本地，参考 ToolsFx 的 CTF 工具清单）。
 * 鸣谢：算法清单参考 Leon406/ToolsFx（ISC License）。
 *
 * 以"解码/还原"为主，部分自反密码编解码同形。需要密钥的（维吉尼亚/仿射）
 * 走暴力或默认参数并注明。
 */

import {
  pawnshopDecode,
  stemBranchDecode,
  baiJiaXingDecode,
  elementPeriodDecode,
  rot8000,
} from "./cnCiphers.js";
import { t } from "../i18n/i18n.js";
import {
  polybiusDecode,
  polybiusEncode,
  beaufort,
  gronsfeldDecode,
  gronsfeldEncode,
  porta,
} from "./classicalCiphers.js";
import { dnaDecode, brailleDecode, cetaceanDecode } from "./ctfCiphers.js";
import {
  morseDecode, morseEncode,
  eightDiagramDecode, eightDiagramEncode,
  yygqDecode, yygqEncode,
  qweDecode, qweEncode,
  twinHexDecode, twinHexEncode,
  caesarBoxDecode, caesarBoxEncode,
  fracMorseDecode, fracMorseEncode,
} from "./ctfExtra.js";
import {
  bifidEncode, bifidDecode,
  trifidEncode, trifidDecode,
  playfairEncode, playfairDecode,
  adfgxEnc, adfgxDec, adfgvxEnc, adfgvxDec,
  nihilistEncode, nihilistDecode,
  tapCodeEncode, tapCodeDecode,
  fourSquareEncode, fourSquareDecode,
  grayEncode, grayDecode,
  TABLE_AZ_NO_J, TABLE_ADFGVX,
} from "./classicalGrid.js";
import {
  hillEncode, hillDecode,
  autoKeyEncode, autoKeyDecode,
  manchesterEncode, manchesterDecode,
  type7Encode, type7Decode,
} from "./classicalExtra.js";
import {
  baudotEncode, baudotDecode,
  bubbleBabbleEncode, bubbleBabbleDecode,
  emojiSubstEncode, emojiSubstDecode,
  zero1248Encode, zero1248Decode,
} from "./ctfEncodings.js";
import { CRYPTO_CIPHERS } from "./cryptoTool.js";

const A = "abcdefghijklmnopqrstuvwxyz";

// ---------- ROT 系列 ----------
export function rot13(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function rot5(text) {
  return text.replace(/[0-9]/g, (c) => String((+c + 5) % 10));
}

export function rot18(text) {
  return rot5(rot13(text));
}

export function rot47(text) {
  return text.replace(/[!-~]/g, (c) => {
    const code = c.charCodeAt(0);
    return String.fromCharCode(33 + ((code - 33 + 47) % 94));
  });
}

// ---------- Atbash（自反） ----------
export function atbash(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

// ---------- 凯撒：指定位移 ----------
export function caesarShift(text, shift) {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

// ---------- 凯撒：列出全部 25 种位移（CTF 最常用） ----------
export function caesarAll(text) {
  const lines = [];
  for (let s = 1; s <= 25; s++) {
    const shifted = text.replace(/[a-z]/gi, (c) => {
      const base = c <= "Z" ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
    });
    lines.push(`位移 ${String(s).padStart(2)}: ${shifted}`);
  }
  return lines.join("\n");
}

// ---------- A1Z26（数字↔字母） ----------
export function a1z26Decode(text) {
  return text
    .trim()
    .split(/[\s,.\-]+/)
    .filter(Boolean)
    .map((n) => {
      const i = parseInt(n, 10);
      return i >= 1 && i <= 26 ? A[i - 1] : "?";
    })
    .join("");
}

// ---------- 培根密码（26 字母版） ----------
const BACON = {};
for (let i = 0; i < 26; i++) {
  BACON[i.toString(2).padStart(5, "0")] = A[i];
}
export function baconDecode(text) {
  // 归一：把 a/A=0、b/B=1，或 0/1 直接用
  const norm = text
    .replace(/[^abAB01]/g, "")
    .replace(/[aA0]/g, "0")
    .replace(/[bB1]/g, "1");
  let out = "";
  for (let i = 0; i + 5 <= norm.length; i += 5) {
    out += BACON[norm.slice(i, i + 5)] || "?";
  }
  return out;
}

// ---------- 栅栏密码（尝试 2-8 栏，列出结果） ----------
function railDecode(cipher, rails) {
  if (rails < 2) return cipher;
  const len = cipher.length;
  const pattern = [];
  let r = 0, dir = 1;
  for (let i = 0; i < len; i++) {
    pattern.push(r);
    if (r === 0) dir = 1;
    else if (r === rails - 1) dir = -1;
    r += dir;
  }
  // 每行字符数
  const counts = new Array(rails).fill(0);
  pattern.forEach((row) => counts[row]++);
  const rows = [];
  let idx = 0;
  for (let i = 0; i < rails; i++) {
    rows.push(cipher.slice(idx, idx + counts[i]).split(""));
    idx += counts[i];
  }
  let out = "";
  const ptr = new Array(rails).fill(0);
  for (let i = 0; i < len; i++) {
    const row = pattern[i];
    out += rows[row][ptr[row]++];
  }
  return out;
}
export function railFenceAll(text) {
  const clean = text.replace(/\s/g, "");
  const lines = [];
  for (let rails = 2; rails <= Math.min(8, clean.length - 1); rails++) {
    lines.push(`${rails} 栏: ${railDecode(clean, rails)}`);
  }
  return lines.join("\n");
}

// ---------- 维吉尼亚（需密钥，默认 key 可改） ----------
export function vigenereDecode(text, key = "key") {
  if (!key) return text;
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return text;
  let ki = 0;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const shift = k.charCodeAt(ki % k.length) - 97;
    ki++;
    return String.fromCharCode(((c.charCodeAt(0) - base - shift + 26) % 26) + base);
  });
}

// ---------- 仿射密码 a*x+b（默认 a=5,b=8，列出常见） ----------
function modInverse(a, m) {
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
  return -1;
}
export function affineDecode(text, a = 5, b = 8) {
  const aInv = modInverse(a, 26);
  if (aInv < 0) return t("cipherError.affineNotCoprime");
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const y = c.charCodeAt(0) - base;
    return String.fromCharCode(((aInv * (y - b + 26 * 10)) % 26) + base);
  });
}

// ---------- 编码方向（非自反密码的正向变换） ----------
// 凯撒：正向 +shift（decode 用 -shift），与 encode 互逆
export function caesarEncode(text, shift) {
  return caesarShift(text, shift);
}
// A1Z26：字母 → 数字
export function a1z26Encode(text) {
  return text
    .toLowerCase()
    .split("")
    .filter((c) => /[a-z]/.test(c))
    .map((c) => c.charCodeAt(0) - 96)
    .join(" ");
}
// 培根：字母 → 5 位 a/b
export function baconEncode(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .split("")
    .map((c) => (c.charCodeAt(0) - 97).toString(2).padStart(5, "0").replace(/0/g, "a").replace(/1/g, "b"))
    .join(" ");
}
// 维吉尼亚：正向加密（decode 减，encode 加）
export function vigenereEncode(text, key = "key") {
  const k = (key || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return text;
  let ki = 0;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const shift = k.charCodeAt(ki % k.length) - 97;
    ki++;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}
// 仿射：正向 a*x+b
export function affineEncode(text, a = 5, b = 8) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const x = c.charCodeAt(0) - base;
    return String.fromCharCode(((a * x + b) % 26) + base);
  });
}

// ---------- 注册表 ----------
// 每项可含 cat 分类、encode（正向编码）、params。fn=解码/还原，encode=编码。
// cat：classic=知名古典密码 / modern=新型·中式趣味 / ctf=CTF 常见编码。
// labelKey 用于 i18n，对应字典 cipher.* 分区。
export const CIPHERS = {
  // —— 知名古典密码 ——
  caesar: { label: "凯撒（全位移）", labelKey: "cipher.caesar", cat: "classic", fn: caesarAll, enumerated: true },
  caesarN: {
    label: "凯撒（指定位移）", labelKey: "cipher.caesarN", cat: "classic",
    params: [{ name: "shift", label: "cipherParam.shift", type: "number", default: 3 }],
    fn: (t, p) => caesarShift(t, -(Number(p.shift) || 0)),
    encode: (t, p) => caesarEncode(t, Number(p.shift) || 0),
  },
  rot13: { label: "ROT13", labelKey: "cipher.rot13", cat: "classic", fn: rot13, encode: rot13 },
  rot5: { label: "ROT5（数字）", labelKey: "cipher.rot5", cat: "classic", fn: rot5, encode: rot5 },
  rot18: { label: "ROT18", labelKey: "cipher.rot18", cat: "classic", fn: rot18, encode: rot18 },
  rot47: { label: "ROT47", labelKey: "cipher.rot47", cat: "classic", fn: rot47, encode: rot47 },
  atbash: { label: "Atbash", labelKey: "cipher.atbash", cat: "classic", fn: atbash, encode: atbash },
  vigenere: {
    label: "维吉尼亚", labelKey: "cipher.vigenere", cat: "classic",
    params: [{ name: "key", label: "cipherParam.key", type: "text", default: "key" }],
    fn: (t, p) => vigenereDecode(t, p.key || "key"),
    encode: (t, p) => vigenereEncode(t, p.key || "key"),
  },
  affine: {
    label: "仿射", labelKey: "cipher.affine", cat: "classic",
    params: [
      { name: "a", label: "a", type: "number", default: 5 },
      { name: "b", label: "b", type: "number", default: 8 },
    ],
    fn: (t, p) => affineDecode(t, Number(p.a) || 1, Number(p.b) || 0),
    encode: (t, p) => affineEncode(t, Number(p.a) || 1, Number(p.b) || 0),
  },
  beaufort: {
    label: "Beaufort", labelKey: "cipher.beaufort", cat: "classic",
    params: [{ name: "key", label: "cipherParam.key", type: "text", default: "FORTIFICATION" }],
    fn: (t, p) => beaufort(t, p.key || "FORTIFICATION"),
    encode: (t, p) => beaufort(t, p.key || "FORTIFICATION"),
  },
  gronsfeld: {
    label: "Gronsfeld", labelKey: "cipher.gronsfeld", cat: "classic",
    params: [{ name: "key", label: "cipherParam.numKey", type: "text", default: "123456" }],
    fn: (t, p) => gronsfeldDecode(t, p.key || "123456"),
    encode: (t, p) => gronsfeldEncode(t, p.key || "123456"),
  },
  porta: {
    label: "Porta", labelKey: "cipher.porta", cat: "classic",
    params: [{ name: "key", label: "cipherParam.key", type: "text", default: "FORTIFICATION" }],
    fn: (t, p) => porta(t, p.key || "FORTIFICATION"),
    encode: (t, p) => porta(t, p.key || "FORTIFICATION"),
  },
  polybius: {
    label: "Polybius 方阵", labelKey: "cipher.polybius", cat: "classic",
    params: [{ name: "table", label: "cipherParam.table25", type: "text", default: "ABCDEFGHIKLMNOPQRSTUVWXYZ" }],
    fn: (t, p) => polybiusDecode(t, p.table || undefined),
    encode: (t, p) => polybiusEncode(t, p.table || undefined),
  },
  bacon: { label: "培根密码", labelKey: "cipher.bacon", cat: "classic", fn: baconDecode, encode: baconEncode },
  railfence: { label: "栅栏密码（全栏数）", labelKey: "cipher.railfence", cat: "classic", fn: railFenceAll, enumerated: true },
  a1z26: { label: "A1Z26", labelKey: "cipher.a1z26", cat: "classic", fn: a1z26Decode, encode: a1z26Encode },
  bifid: {
    label: "Bifid 双分", labelKey: "cipher.bifid", cat: "classic",
    params: [
      { name: "key", label: "cipherParam.table25", type: "text", default: TABLE_AZ_NO_J },
      { name: "period", label: "cipherParam.period", type: "number", default: 5 },
    ],
    fn: (t, p) => bifidDecode(t, p.key || TABLE_AZ_NO_J, Number(p.period) || 1),
    encode: (t, p) => bifidEncode(t, p.key || TABLE_AZ_NO_J, Number(p.period) || 1),
  },
  trifid: {
    label: "Trifid 三分", labelKey: "cipher.trifid", cat: "classic",
    params: [
      { name: "key", label: "cipherParam.keyTable27", type: "text", default: "ABCDEFGHIJKLMNOPQRSTUVWXYZ." },
      { name: "period", label: "cipherParam.period", type: "number", default: 5 },
    ],
    fn: (t, p) => trifidDecode(t, p.key || "ABCDEFGHIJKLMNOPQRSTUVWXYZ.", Number(p.period) || 1),
    encode: (t, p) => trifidEncode(t, p.key || "ABCDEFGHIJKLMNOPQRSTUVWXYZ.", Number(p.period) || 1),
  },
  playfair: {
    label: "PlayFair", labelKey: "cipher.playfair", cat: "classic",
    params: [{ name: "key", label: "cipherParam.keyword", type: "text", default: "MONARCHY" }],
    fn: (t, p) => playfairDecode(t, p.key || ""),
    encode: (t, p) => playfairEncode(t, p.key || ""),
  },
  adfgx: {
    label: "ADFGX", labelKey: "cipher.adfgx", cat: "classic",
    params: [
      { name: "table", label: "cipherParam.table25", type: "text", default: TABLE_AZ_NO_J },
      { name: "key", label: "cipherParam.shiftKey", type: "text", default: "BATTLE" },
    ],
    fn: (t, p) => adfgxDec(t, p.table || TABLE_AZ_NO_J, p.key || "BATTLE"),
    encode: (t, p) => adfgxEnc(t, p.table || TABLE_AZ_NO_J, p.key || "BATTLE"),
  },
  adfgvx: {
    label: "ADFGVX", labelKey: "cipher.adfgvx", cat: "classic",
    params: [
      { name: "table", label: "cipherParam.table36", type: "text", default: TABLE_ADFGVX },
      { name: "key", label: "cipherParam.shiftKey", type: "text", default: "BATTLE" },
    ],
    fn: (t, p) => adfgvxDec(t, p.table || TABLE_ADFGVX, p.key || "BATTLE"),
    encode: (t, p) => adfgvxEnc(t, p.table || TABLE_ADFGVX, p.key || "BATTLE"),
  },
  nihilist: {
    label: "Nihilist 虚无党", labelKey: "cipher.nihilist", cat: "classic",
    params: [{ name: "key", label: "cipherParam.keyword", type: "text", default: "KEY" }],
    fn: (t, p) => nihilistDecode(t, p.key || "KEY"),
    encode: (t, p) => nihilistEncode(t, p.key || "KEY"),
  },
  tapcode: { label: "TapCode 敲击码", labelKey: "cipher.tapcode", cat: "classic", fn: tapCodeDecode, encode: tapCodeEncode },
  foursquare: {
    label: "FourSquare 四方", labelKey: "cipher.foursquare", cat: "classic",
    params: [
      { name: "key1", label: "cipherParam.key1", type: "text", default: "ZGPTFOIHMUWDRCNYKEQAXVSBL" },
      { name: "key2", label: "cipherParam.key2", type: "text", default: "MFNBDCRHSAXYOGVITUEWLQZKP" },
    ],
    fn: (t, p) => fourSquareDecode(t, p.key1 || "ZGPTFOIHMUWDRCNYKEQAXVSBL", p.key2 || "MFNBDCRHSAXYOGVITUEWLQZKP"),
    encode: (t, p) => fourSquareEncode(t, p.key1 || "ZGPTFOIHMUWDRCNYKEQAXVSBL", p.key2 || "MFNBDCRHSAXYOGVITUEWLQZKP"),
  },
  graycode: { label: "格雷码 GrayCode", labelKey: "cipher.graycode", cat: "classic", fn: grayDecode, encode: grayEncode },
  hill: {
    label: "Hill 希尔", labelKey: "cipher.hill", cat: "classic",
    params: [{ name: "key", label: "cipherParam.keyMatrix", type: "text", default: "GYBNQKURP" }],
    fn: (t, p) => hillDecode(t, p.key || "GYBNQKURP"),
    encode: (t, p) => hillEncode(t, p.key || "GYBNQKURP"),
  },
  autokey: {
    label: "AutoKey 自动密钥", labelKey: "cipher.autokey", cat: "classic",
    params: [{ name: "key", label: "cipherParam.keyword", type: "text", default: "SECRET" }],
    fn: (t, p) => autoKeyDecode(t, p.key || "SECRET"),
    encode: (t, p) => autoKeyEncode(t, p.key || "SECRET"),
  },

  // —— 新型 / 中式趣味编码 ——
  rot8000: { label: "ROT8000", labelKey: "cipher.rot8000", cat: "modern", fn: rot8000, encode: rot8000 },
  pawnshop: { label: "当铺密码", labelKey: "cipher.pawnshop", cat: "modern", fn: pawnshopDecode },
  stembranch: { label: "天干地支", labelKey: "cipher.stembranch", cat: "modern", fn: stemBranchDecode },
  baijiaxing: { label: "百家姓", labelKey: "cipher.baijiaxing", cat: "modern", fn: baiJiaXingDecode },
  element: { label: "元素周期表", labelKey: "cipher.element", cat: "modern", fn: elementPeriodDecode },

  // —— CTF 常见编码 ——
  dna: { label: "DNA 密码", labelKey: "cipher.dna", cat: "ctf", fn: dnaDecode },
  braille: { label: "盲文 Braille", labelKey: "cipher.braille", cat: "ctf", fn: brailleDecode },
  cetacean: { label: "鲸语 Cetacean", labelKey: "cipher.cetacean", cat: "ctf", fn: cetaceanDecode },
  morse: { label: "莫尔斯电码", labelKey: "cipher.morse", cat: "ctf", fn: morseDecode, encode: morseEncode },
  eightDiagram: { label: "六十四卦", labelKey: "cipher.eightDiagram", cat: "ctf", fn: eightDiagramDecode, encode: eightDiagramEncode },
  yygq: { label: "兽音/阴阳怪气", labelKey: "cipher.yygq", cat: "ctf", fn: yygqDecode, encode: yygqEncode },
  qwe: { label: "QWE 键盘", labelKey: "cipher.qwe", cat: "ctf", fn: qweDecode, encode: qweEncode },
  twinHex: { label: "TwinHex 双子", labelKey: "cipher.twinHex", cat: "ctf", fn: twinHexDecode, encode: twinHexEncode },
  caesarBox: {
    label: "凯撒盒 CaesarBox", labelKey: "cipher.caesarBox", cat: "ctf",
    params: [{ name: "height", label: "cipherParam.height", type: "number", default: 3 }],
    fn: (t, p) => caesarBoxDecode(t, Number(p.height) || 1),
    encode: (t, p) => caesarBoxEncode(t, Number(p.height) || 1),
  },
  fracMorse: {
    label: "分数莫尔斯", labelKey: "cipher.fracMorse", cat: "ctf",
    params: [{ name: "key", label: "cipherParam.key26", type: "text", default: "ROUNDTABLECFGHIJKMPQSVWXYZ" }],
    fn: (t, p) => fracMorseDecode(t, p.key || "ROUNDTABLECFGHIJKMPQSVWXYZ"),
    encode: (t, p) => fracMorseEncode(t, p.key || "ROUNDTABLECFGHIJKMPQSVWXYZ"),
  },
  baudot: { label: "博多码 Baudot", labelKey: "cipher.baudot", cat: "ctf", fn: baudotDecode, encode: baudotEncode },
  bubbleBabble: { label: "Bubble Babble", labelKey: "cipher.bubbleBabble", cat: "ctf", fn: bubbleBabbleDecode, encode: bubbleBabbleEncode },
  emojiSubst: {
    label: "Emoji 替换（emoji-aes）", labelKey: "cipher.emojiSubst", cat: "ctf",
    params: [{ name: "shift", label: "cipherParam.shift", type: "number", default: 0 }],
    fn: (t, p) => emojiSubstDecode(t, Number(p.shift) || 0),
    encode: (t, p) => emojiSubstEncode(t, Number(p.shift) || 0),
  },
  zero1248: { label: "Zero1248", labelKey: "cipher.zero1248", cat: "ctf", fn: zero1248Decode, encode: zero1248Encode },
  manchester: {
    label: "曼彻斯特编码", labelKey: "cipher.manchester", cat: "ctf",
    params: [{ name: "standard", label: "cipherParam.manchesterStd", type: "number", default: 0 }],
    fn: (t, p) => manchesterDecode(t, Number(p.standard) === 1),
    encode: (t, p) => manchesterEncode(t, Number(p.standard) === 1),
  },
  type7: { label: "Cisco Type 7", labelKey: "cipher.type7", cat: "ctf", fn: type7Decode, encode: (t) => type7Encode(t, 0) },


  // —— 重型加密（WASM：mbedTLS）——
  ...CRYPTO_CIPHERS,
};

export function tryCipher(id, text, params = {}) {
  const c = CIPHERS[id];
  if (!c) return { ok: false, error: t("cipherError.unknownCipher") };
  const times = Math.max(1, Math.min(Number(params._times) || 1, 20));
  try {
    let result = text;
    for (let i = 0; i < times; i++) result = c.fn(result, params);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** 编码方向（仅含 encode 的密码项有效）。 */
export function tryCipherEncode(id, text, params = {}) {
  const c = CIPHERS[id];
  if (!c) return { ok: false, error: t("cipherError.unknownCipher") };
  if (!c.encode) return { ok: false, error: t("cipherError.encodeNotSupported") };
  const times = Math.max(1, Math.min(Number(params._times) || 1, 20));
  try {
    let result = text;
    for (let i = 0; i < times; i++) result = c.encode(result, params);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
