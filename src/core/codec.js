/**
 * codec.js — 编解码库（参考 ToolsFx 的编码族，纯本地实现）。
 * 每个编码提供 decode（必要时 encode）。供「增强功能」本地解码按钮调用。
 *
 * 鸣谢：编码清单参考 Leon406/ToolsFx（ISC License）。
 */

const td = (bytes) => new TextDecoder("utf-8").decode(new Uint8Array(bytes));
const te = (str) => [...new TextEncoder().encode(str)];

import { t } from "../i18n/i18n.js";

// ---------- 二进制 / 八进制 / 十进制（ASCII 码序列） ----------
export function binaryDecode(text) {
  const bits = text.replace(/[^01]/g, "");
  if (bits.length === 0 || bits.length % 8 !== 0) throw new Error(t("codecError.binaryNot8Aligned"));
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return td(bytes);
}

export function octalDecode(text) {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  return td(parts.map((p) => parseInt(p, 8)));
}

export function decimalDecode(text) {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  return td(parts.map((p) => parseInt(p, 10)));
}

// ---------- Base32 (RFC 4648) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Decode(text, dict = B32) {
  const D = dict || B32;
  const s = text.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s) {
    const idx = D.indexOf(ch);
    if (idx === -1) throw new Error(t("codecError.illegalBase32"));
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return td(out);
}

// ---------- Base58 (Bitcoin) ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Decode(text, dict = B58) {
  const D = dict || B58;
  const s = text.trim();
  let num = 0n;
  const radix = BigInt(D.length);
  for (const ch of s) {
    const idx = D.indexOf(ch);
    if (idx === -1) throw new Error(t("codecError.illegalBase58"));
    num = num * radix + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  // 前导首字符 → 前导 0 字节
  for (const ch of s) {
    if (ch === D[0]) bytes.unshift(0);
    else break;
  }
  return td(bytes);
}

// ---------- Base62 ----------
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export function base62Decode(text, dict = B62) {
  const D = dict || B62;
  const s = text.trim();
  let num = 0n;
  const radix = BigInt(D.length);
  for (const ch of s) {
    const idx = D.indexOf(ch);
    if (idx === -1) throw new Error(t("codecError.illegalBase62"));
    num = num * radix + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  return td(bytes);
}

// ---------- Base85 / ASCII85 ----------
export function ascii85Decode(text) {
  let s = text.trim().replace(/^<~/, "").replace(/~>$/, "").replace(/\s/g, "");
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "z") { out.push(0, 0, 0, 0); i++; continue; }
    let chunk = s.slice(i, i + 5);
    const pad = 5 - chunk.length;
    chunk = chunk + "u".repeat(pad);
    let num = 0;
    for (const ch of chunk) {
      const v = ch.charCodeAt(0) - 33;
      if (v < 0 || v > 84) throw new Error(t("codecError.illegalAscii85"));
      num = num * 85 + v;
    }
    const b = [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff];
    for (let k = 0; k < 4 - pad; k++) out.push(b[k]);
    i += 5;
  }
  return td(out);
}

// ---------- Base45 (RFC 9285) ----------
const B45 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
export function base45Decode(text, dict = B45) {
  const D = dict || B45;
  // 注意：空格在 Base45 码表中是合法符号(索引36)，不能 trim，仅去换行
  const s = text.replace(/[\r\n]/g, "");
  const out = [];
  for (let i = 0; i < s.length; i += 3) {
    const chunk = s.slice(i, i + 3);
    let val = 0;
    for (let k = 0; k < chunk.length; k++) {
      const idx = D.indexOf(chunk[k]);
      if (idx === -1) throw new Error(t("codecError.illegalBase45"));
      val += idx * Math.pow(45, k);
    }
    if (chunk.length === 3) {
      out.push((val >> 8) & 0xff, val & 0xff);
    } else if (chunk.length === 2) {
      out.push(val & 0xff);
    }
  }
  return td(out);
}

// ---------- Quoted-Printable ----------
export function quotedPrintableDecode(text) {
  const s = text.replace(/=\r?\n/g, ""); // 软换行
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && i + 2 < s.length) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  return td(bytes);
}

// ---------- uuencode ----------
export function uuDecode(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let line of lines) {
    if (!line || /^begin\s/i.test(line) || /^end\s*$/i.test(line) || line === "`") continue;
    const count = line.charCodeAt(0) - 32;
    if (count <= 0 || count > 45) continue;
    let n = 0;
    for (let i = 1; i < line.length && n < count; i += 4) {
      const c = [0, 1, 2, 3].map((k) => (line.charCodeAt(i + k) - 32) & 63);
      const b = [
        (c[0] << 2) | (c[1] >> 4),
        ((c[1] & 15) << 4) | (c[2] >> 2),
        ((c[2] & 3) << 6) | c[3],
      ];
      for (const v of b) { if (n++ < count) out.push(v); }
    }
  }
  return td(out);
}

// ---------- Punycode (decode xn--) ----------
export function punycodeDecode(text) {
  // 借助浏览器 URL/IDN：用 URL 解析 host 中的 xn--，回退手写
  const t = text.trim().replace(/^xn--/, "");
  // 简化：用内置 decodeURIComponent 不行，手写 RFC 3492
  const base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128;
  let output = [];
  let idx = t.lastIndexOf("-");
  for (let i = 0; i < (idx < 0 ? 0 : idx); i++) output.push(t.charCodeAt(i));
  let i = 0, n = initialN, bias = initialBias;
  let pos = idx < 0 ? 0 : idx + 1;
  while (pos < t.length) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      const c = t.charCodeAt(pos++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97;
      i += digit * w;
      const tt = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias;
      if (digit < tt) break;
      w *= base - tt;
    }
    const out = output.length + 1;
    let delta = oldi === 0 ? Math.floor((i - oldi) / damp) : Math.floor((i - oldi) / 2);
    delta += Math.floor(delta / out);
    let kk = 0;
    for (; delta > Math.floor(((base - tmin) * tmax) / 2); kk += base) {
      delta = Math.floor(delta / (base - tmin));
    }
    bias = kk + Math.floor(((base - tmin + 1) * delta) / (delta + skew));
    n += Math.floor(i / out);
    i %= out;
    output.splice(i, 0, n);
    i++;
  }
  return String.fromCodePoint(...output);
}

// ---------- Base16 / Hex ----------
export function hexDecode(text) {
  const s = text.trim().replace(/0x/gi, "").replace(/[\s,]/g, "");
  if (s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) throw new Error(t("codecError.illegalHex"));
  const bytes = [];
  for (let i = 0; i < s.length; i += 2) bytes.push(parseInt(s.slice(i, i + 2), 16));
  return td(bytes);
}

// ---------- Base36（大整数） ----------
export function base36Decode(text) {
  const s = text.trim();
  let num = 0n;
  for (const ch of s.toLowerCase()) {
    const v = "0123456789abcdefghijklmnopqrstuvwxyz".indexOf(ch);
    if (v === -1) throw new Error(t("codecError.illegalBase36"));
    num = num * 36n + BigInt(v);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  return td(bytes);
}

// ---------- Base91 ----------
const B91 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~\"";
export function base91Decode(text, dict = B91) {
  const D = dict || B91;
  let v = -1, b = 0, n = 0;
  const out = [];
  for (const ch of text) {
    const c = D.indexOf(ch);
    if (c === -1) continue;
    if (v < 0) { v = c; }
    else {
      v += c * 91;
      b |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      do { out.push(b & 0xff); b >>= 8; n -= 8; } while (n > 7);
      v = -1;
    }
  }
  if (v >= 0) out.push((b | (v << n)) & 0xff);
  return td(out);
}
export function base91Encode(text, dict = B91) {
  const D = dict || B91;
  const bytes = te(text);
  let b = 0, n = 0, out = "";
  for (const byte of bytes) {
    b |= byte << n;
    n += 8;
    if (n > 13) {
      let v = b & 8191;
      if (v > 88) { b >>= 13; n -= 13; }
      else { v = b & 16383; b >>= 14; n -= 14; }
      out += D[v % 91] + D[Math.floor(v / 91)];
    }
  }
  if (n) {
    out += D[b % 91];
    if (n > 7 || b > 90) out += D[Math.floor(b / 91)];
  }
  return out;
}

// ---------- Base16（自定义码表；移植 ToolsFx，会过滤零字节） ----------
// 标准 Hex 见 hexDecode；本函数用于非标准 4-bit 码表，行为对齐 ToolsFx。
const B16 = "0123456789ABCDEF";
export function base16Decode(text, dict = B16) {
  const D = dict || B16;
  const s = text.trim().replace(/\s/g, "");
  let bin = "";
  for (const ch of s) {
    const idx = D.indexOf(ch);
    if (idx === -1) throw new Error(t("codecError.illegalBase16"));
    bin += idx.toString(2).padStart(4, "0");
  }
  const out = [];
  for (let i = 0; i + 8 <= bin.length; i += 8) {
    const byte = parseInt(bin.slice(i, i + 8), 2);
    if (byte !== 0) out.push(byte); // ToolsFx 过滤零字节
  }
  return td(out);
}
export function base16Encode(text, dict = B16) {
  const D = dict || B16;
  const bin = te(text).map((b) => b.toString(2).padStart(8, "0")).join("");
  let out = "";
  for (let i = 0; i < bin.length; i += 4) out += D[parseInt(bin.slice(i, i + 4).padEnd(4, "0"), 2)];
  return out;
}

// ---------- hexReverse（每字节两位 Hex 互换，魔改） ----------
export function hexReverseDecode(text) {
  const s = text.trim().replace(/\s/g, "");
  if (s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) throw new Error(t("codecError.illegalHex"));
  const out = [];
  for (let i = 0; i < s.length; i += 2) out.push(parseInt(s[i + 1] + s[i], 16));
  return td(out);
}

// ---------- Base69（pshihn.github.io/base69，移植 ToolsFx） ----------
const B69 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-*<>|";
const B69_CHUNK = 7;
function byteToBase69Char(byte, D) {
  return D[((byte % 69) + 69) % 69] + D[Math.floor(byte / 69)];
}
export function base69Encode(text, dict = B69) {
  const D = dict || B69;
  const bytes = te(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += B69_CHUNK) {
    const chunk = bytes.slice(i, i + B69_CHUNK);
    const bin = chunk.map((b) => b.toString(2).padStart(8, "0")).join("");
    for (let j = 0; j < bin.length; j += B69_CHUNK) {
      out += byteToBase69Char(parseInt(bin.slice(j, j + B69_CHUNK).padEnd(B69_CHUNK, "0"), 2), D);
    }
  }
  const pad = B69_CHUNK - (bytes.length % B69_CHUNK); // 1..7，恒 >0，对齐 ToolsFx
  out += "AA".repeat(pad - 1) + pad + "=";
  return out;
}
export function base69Decode(text, dict = B69) {
  const D = dict || B69;
  const s = text.trim();
  let bin = "";
  for (let i = 0; i + 2 <= s.length; i += 2) {
    const pair = s.slice(i, i + 2);
    if (pair.includes("=")) continue;
    const val = 69 * D.indexOf(pair[1]) + D.indexOf(pair[0]);
    bin += val.toString(2).padStart(B69_CHUNK, "0");
  }
  bin = bin.replace(/(?:00000000)*$/, "");
  bin = bin.slice(0, Math.floor(bin.length / 8) * 8);
  const out = [];
  for (let i = 0; i + 8 <= bin.length; i += 8) out.push(parseInt(bin.slice(i, i + 8), 2));
  return td(out);
}

// ---------- Base92（移植 ToolsFx） ----------
const B92 =
  "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_abcdefghijklmnopqrstuvwxyz{|}";
const B92_BLOCK = 13;
const B92_BLOCK_HALF = 6;
export function base92Encode(text, dict = B92) {
  const D = dict || B92;
  if (text === "") return "~";
  const bin = te(text).map((b) => b.toString(2).padStart(8, "0")).join("");
  let out = "";
  for (let i = 0; i < bin.length; i += B92_BLOCK) {
    const seg = bin.slice(i, i + B92_BLOCK);
    if (seg.length < 7) {
      out += D[parseInt(seg.padEnd(B92_BLOCK_HALF, "0"), 2)];
    } else {
      const v = parseInt(seg.padEnd(B92_BLOCK, "0"), 2);
      out += D[Math.floor(v / 91)] + D[v % 91];
    }
  }
  return out;
}
export function base92Decode(text, dict = B92) {
  const D = dict || B92;
  const s = text.trim();
  if (s === "~") return "";
  let bin = "";
  for (let i = 0; i < s.length; i += 2) {
    const pair = s.slice(i, i + 2);
    if (pair.length > 1) {
      bin += (D.indexOf(pair[0]) * 91 + D.indexOf(pair[1])).toString(2).padStart(B92_BLOCK, "0");
    } else {
      // 单字符尾块代表 6 bit（含尾部补零），须补足前导零方能正确还原
      bin += D.indexOf(pair[0]).toString(2).padStart(B92_BLOCK_HALF, "0");
    }
  }
  const out = [];
  for (let i = 0; i + 8 <= bin.length; i += 8) out.push(parseInt(bin.slice(i, i + 8), 2));
  return td(out);
}

// ---------- xxencode ----------
const XX = "+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export function xxDecode(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (!line || /^begin/i.test(line) || /^end/i.test(line)) continue;
    const count = XX.indexOf(line[0]);
    if (count <= 0) continue;
    let n = 0;
    for (let i = 1; i < line.length && n < count; i += 4) {
      const c = [0, 1, 2, 3].map((k) => Math.max(0, XX.indexOf(line[i + k] || "+")));
      const b = [
        (c[0] << 2) | (c[1] >> 4),
        ((c[1] & 15) << 4) | (c[2] >> 2),
        ((c[2] & 3) << 6) | c[3],
      ];
      for (const x of b) { if (n++ < count) out.push(x); }
    }
  }
  return td(out);
}

// ---------- escape / unescape（JS escape 序列） ----------
export function unescapeDecode(text) {
  return unescape(text.trim());
}

// ---------- jsHex (\xXX) ----------
export function jsHexDecode(text) {
  // 收集 \xXX 字节后按 UTF-8 重组（支持多字节字符）
  const bytes = [];
  let last = 0;
  const re = /\\x([0-9a-fA-F]{2})/g;
  let m, hasEsc = false;
  while ((m = re.exec(text)) !== null) {
    hasEsc = true;
    // 转义之间的普通字符按原样保留
    for (const ch of text.slice(last, m.index)) bytes.push(...te(ch));
    bytes.push(parseInt(m[1], 16));
    last = re.lastIndex;
  }
  if (!hasEsc) return text;
  for (const ch of text.slice(last)) bytes.push(...te(ch));
  return td(bytes);
}

// ---------- 社会主义核心价值观编码 ----------
// 算法源：gist.github.com/inwikipedia/5efc97813734fa420e7a4b6ee7045e5d
const CORE_VALUES = "富强民主文明和谐自由平等公正法治爱国敬业诚信友善";

export function coreValuesEncode(text) {
  const notEncoded = /[A-Za-z0-9\-_.!~*'()]/g;
  const str1 = text.replace(notEncoded, (c) => c.codePointAt(0).toString(16));
  const utfs = encodeURIComponent(str1).replace(/%/g, "").toUpperCase();
  const duo = [];
  for (const c of utfs) {
    const n = parseInt(c, 16);
    if (n < 10) duo.push(n);
    else if (Math.random() >= 0.5) { duo.push(10); duo.push(n - 10); }
    else { duo.push(11); duo.push(n - 6); }
  }
  return duo.map((d) => CORE_VALUES[2 * d] + CORE_VALUES[2 * d + 1]).join("");
}

export function coreValuesDecode(text) {
  const duo = [];
  for (const c of text) {
    const i = CORE_VALUES.indexOf(c);
    if (i === -1 || i & 1) continue;
    duo.push(i >> 1);
  }
  const hex = [];
  let i = 0;
  while (i < duo.length) {
    if (duo[i] < 10) hex.push(duo[i]);
    else if (duo[i] === 10) { i++; hex.push(duo[i] + 10); }
    else { i++; hex.push(duo[i] + 6); }
    i++;
  }
  const hexs = hex.map((v) => v.toString(16).toUpperCase()).join("");
  if (hexs.length & 1) throw new Error(t("codecError.coreValuesIncomplete"));
  const parts = [];
  for (let j = 0; j < hexs.length; j++) {
    if ((j & 1) === 0) parts.push("%");
    parts.push(hexs[j]);
  }
  return decodeURIComponent(parts.join(""));
}

// ---------- Base100（emoji 编码） ----------
// 每字节 → 4 字节 UTF-8: 0xF0 0x9F XX YY，移植自 ToolsFx
export function base100Decode(text) {
  const u8 = new TextEncoder().encode(text);
  const out = [];
  for (let i = 0; i + 4 <= u8.length; i += 4) {
    if (u8[i] === 0xf0 && u8[i + 1] === 0x9f) {
      out.push(((u8[i + 2] - 143) * 64 + u8[i + 3] - 128 - 55) & 0xff);
    }
  }
  return td(out);
}

// ---------- MixHexOctBin（0x/0b/0o 混合，每字节随机一种） ----------
export function mixHexOctBinDecode(text) {
  const trimmed = text.trim();
  // 每字节定宽：0x+2hex / 0b+8bit / 0o+3oct
  const tokens = trimmed.match(/0[xX][0-9a-fA-F]{2}|0[bB][01]{8}|0[oO][0-7]{3}/g);
  if (!tokens) throw new Error(t("codecError.invalidMixHexOctBin"));
  const out = tokens.map((tk) => {
    const pfx = tk.slice(0, 2).toLowerCase();
    const body = tk.slice(2);
    if (pfx === "0x") return parseInt(body, 16) & 0xff;
    if (pfx === "0b") return parseInt(body, 2) & 0xff;
    return parseInt(body, 8) & 0xff;
  });
  return td(out);
}

// ---------- 字典式 Base85（无分隔符；标准/Z85/IPv6 变体） ----------
const B85_STD = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstu";
const B85_Z85 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";
const B85_IPV6 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~";

function base85DictDecode(text, dict) {
  const s = text.trim().replace(/\s/g, "");
  const out = [];
  for (let i = 0; i < s.length; i += 5) {
    const chunk = s.slice(i, i + 5);
    const size = chunk.length;
    const count = size === 2 ? 1 : size === 3 ? 2 : size === 4 ? 3 : 4;
    let num = 0n;
    for (let k = 0; k < 5; k++) {
      const v = k < size ? dict.indexOf(chunk[k]) : 84;
      if (k < size && v === -1) throw new Error(t("codecError.illegalBase85"));
      num = num * 85n + BigInt(v);
    }
    const b = [
      Number((num >> 24n) & 0xffn),
      Number((num >> 16n) & 0xffn),
      Number((num >> 8n) & 0xffn),
      Number(num & 0xffn),
    ];
    for (let k = 0; k < count; k++) out.push(b[k]);
  }
  return td(out);
}

export const base85StdDecode = (t, dict) => base85DictDecode(t, (dict && dict.length === 85 ? dict : B85_STD));
export const z85Decode = (t, dict) => base85DictDecode(t, (dict && dict.length === 85 ? dict : B85_Z85));
export const base85IPv6Decode = (t, dict) => base85DictDecode(t, (dict && dict.length === 85 ? dict : B85_IPV6));

// 字典式 Base85 编码（4 字节一组，含 padding 截断），与 base85DictDecode 互逆
function base85DictEncode(text, dict) {
  const bytes = te(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.slice(i, i + 4);
    const size = chunk.length;
    let num = 0n;
    for (let k = 0; k < 4; k++) num = num * 256n + BigInt(k < size ? chunk[k] : 0);
    const enc = [];
    for (let k = 0; k < 5; k++) { enc.unshift(dict[Number(num % 85n)]); num /= 85n; }
    out += enc.slice(0, size + 1).join("");
  }
  return out;
}
export const base85StdEncode = (t) => base85DictEncode(t, B85_STD);
export const z85Encode = (t) => base85DictEncode(t, B85_Z85);
export const base85IPv6Encode = (t) => base85DictEncode(t, B85_IPV6);

// ---------- Base64（支持自定义码表） ----------
const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64Decode(text, dict = B64_STD) {
  const D = (dict || B64_STD).slice(0, 64);
  const s = text.replace(/[^A-Za-z0-9+/=\-_]/g, (c) => (D.includes(c) ? c : ""));
  // 标准表用 atob 快路径
  if (D === B64_STD) {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return td([...bytes]);
  }
  // 自定义表：手工解码
  const clean = s.replace(/=+$/, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of clean) {
    const idx = D.indexOf(ch);
    if (idx === -1) throw new Error(t("codecError.illegalBase64Char", { ch }));
    val = (val << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((val >> bits) & 0xff);
    }
  }
  return td(out);
}
export function base64Encode(text, dict = B64_STD) {
  const D = (dict || B64_STD).slice(0, 64);
  const bytes = te(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = bytes.slice(i, i + 3);
    const n = (chunk[0] << 16) | ((chunk[1] || 0) << 8) | (chunk[2] || 0);
    out += D[(n >> 18) & 63] + D[(n >> 12) & 63];
    out += chunk.length > 1 ? D[(n >> 6) & 63] : "=";
    out += chunk.length > 2 ? D[n & 63] : "=";
  }
  return out;
}

// ---------- 编码方向：基础进制 / 传输编码 ----------
export const binaryEncode = (t) => te(t).map((b) => b.toString(2).padStart(8, "0")).join(" ");
export const octalEncode = (t) => te(t).map((b) => b.toString(8)).join(" ");
export const decimalEncode = (t) => te(t).map((b) => String(b)).join(" ");
export const hexEncode = (t) => te(t).map((b) => b.toString(16).padStart(2, "0")).join("");
export const hexReverseEncode = (t) =>
  te(t).map((b) => { const h = b.toString(16).padStart(2, "0"); return h[1] + h[0]; }).join("");

// radixN 大整数编码（base32/36/58/62 通用），与 radix 风格 decode 互逆
function radixNEncode(text, dict) {
  const bytes = te(text);
  const radix = BigInt(dict.length);
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = "";
  if (num === 0n) out = dict[0];
  while (num > 0n) { out = dict[Number(num % radix)] + out; num /= radix; }
  // 前导零字节 → 前导首字符
  for (const b of bytes) { if (b === 0) out = dict[0] + out; else break; }
  return out;
}
export const base36Encode = (t) => radixNEncode(t, "0123456789abcdefghijklmnopqrstuvwxyz");
export const base58Encode = (t, dict = B58) => radixNEncode(t, dict || B58);
export const base62Encode = (t, dict = B62) => radixNEncode(t, dict || B62);

// Base32（RFC 4648，5 bit 分组 + = 补齐）
export function base32Encode(text, dict = B32) {
  const D = dict || B32;
  const bytes = te(text);
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += D[(val >> bits) & 31]; }
  }
  if (bits > 0) out += D[(val << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += "=";
  return out;
}

// Base45（RFC 9285，2 字节 → 3 字符小端）
export function base45Encode(text, dict = B45) {
  const D = dict || B45;
  const bytes = te(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let n = bytes[i] * 256 + bytes[i + 1];
      out += D[n % 45]; n = Math.floor(n / 45);
      out += D[n % 45]; out += D[Math.floor(n / 45)];
    } else {
      let n = bytes[i];
      out += D[n % 45]; out += D[Math.floor(n / 45)];
    }
  }
  return out;
}

// ASCII85（<~ ~>，z 压缩零组）
export function ascii85Encode(text) {
  const bytes = te(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.slice(i, i + 4);
    const size = chunk.length;
    let num = 0;
    for (let k = 0; k < 4; k++) num = (num * 256 + (k < size ? chunk[k] : 0)) >>> 0;
    if (size === 4 && num === 0) { out += "z"; continue; }
    const enc = [];
    let n = num;
    for (let k = 0; k < 5; k++) { enc.unshift(String.fromCharCode((n % 85) + 33)); n = Math.floor(n / 85); }
    out += enc.slice(0, size + 1).join("");
  }
  return "<~" + out + "~>";
}

// Quoted-Printable
export function quotedPrintableEncode(text) {
  return te(text).map((b) => {
    if ((b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 9)
      return String.fromCharCode(b);
    return "=" + b.toString(16).toUpperCase().padStart(2, "0");
  }).join("");
}

// jsHex (\xXX)
export const jsHexEncode = (t) => te(t).map((b) => "\\x" + b.toString(16).padStart(2, "0")).join("");
// JS escape
export const escapeEncode = (t) => escape(t);

// ---------- 编码族注册表：id → {label, labelKey, cat, decode, [encode], [params]} ----------
// cat 分类：base=Base 家族 / radix=进制数字 / web=Web 传输转义 / fun=趣味编码。
// 有 encode 者，工具箱显示「编码/解码」切换；params 为自定义码表等参数。
// labelKey 用于 i18n，对应字典 codec.* 分区。
export const CODECS = {
  base64: {
    label: "Base64", labelKey: "codec.base64", cat: "base",
    params: [{ name: "dict", label: "customDict64", type: "text", default: B64_STD }],
    decode: (t, p) => base64Decode(t, (p && p.dict) || B64_STD),
    encode: (t, p) => base64Encode(t, (p && p.dict) || B64_STD),
  },
  hex: { label: "Hex / Base16", labelKey: "codec.hex", cat: "base", decode: hexDecode, encode: hexEncode },
  base16x: {
    label: "Base16（自定义表）", labelKey: "codec.base16x", cat: "base",
    params: [{ name: "dict", label: "customDict16", type: "text", default: B16 }],
    decode: (t, p) => base16Decode(t, (p && p.dict) || B16),
    encode: (t, p) => base16Encode(t, (p && p.dict) || B16),
  },
  base32: {
    label: "Base32", labelKey: "codec.base32", cat: "base",
    params: [{ name: "dict", label: "customDict32", type: "text", default: B32 }],
    decode: (t, p) => base32Decode(t, (p && p.dict) || B32),
    encode: (t, p) => base32Encode(t, (p && p.dict) || B32),
  },
  base36: { label: "Base36", labelKey: "codec.base36", cat: "base", decode: base36Decode, encode: base36Encode },
  base45: {
    label: "Base45", labelKey: "codec.base45", cat: "base",
    params: [{ name: "dict", label: "customDict45", type: "text", default: B45 }],
    decode: (t, p) => base45Decode(t, (p && p.dict) || B45),
    encode: (t, p) => base45Encode(t, (p && p.dict) || B45),
  },
  base58: {
    label: "Base58", labelKey: "codec.base58", cat: "base",
    params: [{ name: "dict", label: "customDict58", type: "text", default: B58 }],
    decode: (t, p) => base58Decode(t, (p && p.dict) || B58),
    encode: (t, p) => base58Encode(t, (p && p.dict) || B58),
  },
  base62: {
    label: "Base62", labelKey: "codec.base62", cat: "base",
    params: [{ name: "dict", label: "customDict62", type: "text", default: B62 }],
    decode: (t, p) => base62Decode(t, (p && p.dict) || B62),
    encode: (t, p) => base62Encode(t, (p && p.dict) || B62),
  },
  base69: {
    label: "Base69", labelKey: "codec.base69", cat: "base",
    params: [{ name: "dict", label: "customDict69", type: "text", default: B69 }],
    decode: (t, p) => base69Decode(t, (p && p.dict) || B69),
    encode: (t, p) => base69Encode(t, (p && p.dict) || B69),
  },
  base91: {
    label: "Base91", labelKey: "codec.base91", cat: "base",
    params: [{ name: "dict", label: "customDict91", type: "text", default: B91 }],
    decode: (t, p) => base91Decode(t, (p && p.dict) || B91),
    encode: (t, p) => base91Encode(t, (p && p.dict) || B91),
  },
  base92: {
    label: "Base92", labelKey: "codec.base92", cat: "base",
    params: [{ name: "dict", label: "customDict92", type: "text", default: B92 }],
    decode: (t, p) => base92Decode(t, (p && p.dict) || B92),
    encode: (t, p) => base92Encode(t, (p && p.dict) || B92),
  },
  ascii85: { label: "Base85 / ASCII85", labelKey: "codec.ascii85", cat: "base", decode: ascii85Decode, encode: ascii85Encode },
  base85std: {
    label: "Base85（字典式）", labelKey: "codec.base85std", cat: "base",
    params: [{ name: "dict", label: "customDict85", type: "text", default: B85_STD }],
    decode: (t, p) => base85StdDecode(t, (p && p.dict) || undefined),
    encode: base85StdEncode,
  },
  z85: {
    label: "Z85（ZeroMQ）", labelKey: "codec.z85", cat: "base",
    params: [{ name: "dict", label: "customDict85", type: "text", default: B85_Z85 }],
    decode: (t, p) => z85Decode(t, (p && p.dict) || undefined),
    encode: z85Encode,
  },
  base85ipv6: {
    label: "Base85 IPv6", labelKey: "codec.base85ipv6", cat: "base",
    params: [{ name: "dict", label: "customDict85", type: "text", default: B85_IPV6 }],
    decode: (t, p) => base85IPv6Decode(t, (p && p.dict) || undefined),
    encode: base85IPv6Encode,
  },
  base100: { label: "Base100（emoji）", labelKey: "codec.base100", cat: "base", decode: base100Decode },

  binary: { label: "二进制", labelKey: "codec.binary", cat: "radix", decode: binaryDecode, encode: binaryEncode },
  octal: { label: "八进制", labelKey: "codec.octal", cat: "radix", decode: octalDecode, encode: octalEncode },
  decimal: { label: "十进制 ASCII", labelKey: "codec.decimal", cat: "radix", decode: decimalDecode, encode: decimalEncode },
  mixHexOctBin: { label: "Hex/Oct/Bin 混合", labelKey: "codec.mixHexOctBin", cat: "radix", decode: mixHexOctBinDecode },
  hexReverse: { label: "hexReverse（字节内翻转）", labelKey: "codec.hexReverse", cat: "radix", decode: hexReverseDecode, encode: hexReverseEncode },

  quotedPrintable: { label: "Quoted-Printable", labelKey: "codec.quotedPrintable", cat: "web", decode: quotedPrintableDecode, encode: quotedPrintableEncode },
  uu: { label: "uuencode", labelKey: "codec.uu", cat: "web", decode: uuDecode },
  xx: { label: "xxencode", labelKey: "codec.xx", cat: "web", decode: xxDecode },
  punycode: { label: "Punycode", labelKey: "codec.punycode", cat: "web", decode: punycodeDecode },
  unescape: { label: "JS unescape", labelKey: "codec.unescape", cat: "web", decode: unescapeDecode, encode: escapeEncode },
  jsHex: { label: "jsHex (\\xXX)", labelKey: "codec.jsHex", cat: "web", decode: jsHexDecode, encode: jsHexEncode },

  coreValues: { label: "社会主义核心价值观", labelKey: "codec.coreValues", cat: "fun", decode: coreValuesDecode, encode: coreValuesEncode },
};

/**
 * 安全解码。支持参数与多次解码。
 * @param {string} codecId
 * @param {string} text
 * @param {object} [params]  含编码自定义参数 + 可选 _times（解码次数，默认1）
 */
export function tryDecode(codecId, text, params = {}) {
  const c = CODECS[codecId];
  if (!c) return { ok: false, error: t("codecError.unknownEncoding") };
  const times = Math.max(1, Math.min(Number(params._times) || 1, 20));
  try {
    let result = text;
    for (let i = 0; i < times; i++) {
      result = c.decode(result, params);
    }
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 安全编码。仅对含 encode 的编码项有效。支持 _times 多次编码。
 */
export function tryEncode(codecId, text, params = {}) {
  const c = CODECS[codecId];
  if (!c) return { ok: false, error: t("codecError.unknownEncoding") };
  if (!c.encode) return { ok: false, error: t("codecError.encodeNotSupported") };
  const times = Math.max(1, Math.min(Number(params._times) || 1, 20));
  try {
    let result = text;
    for (let i = 0; i < times; i++) result = c.encode(result, params);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
