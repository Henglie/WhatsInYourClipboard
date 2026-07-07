/**
 * baseExtra.js — base 变体增补（移植 ToolsFx[ISC]，已鸣谢 Leon406）。
 *
 * radix 系列（radix10 / radix64）= 大整数或位打包配不同码表；
 * base58check = radixN + 双 SHA-256 校验（含本文件自带的同步 SHA-256）；
 * utf7 = base64(UTF-16BE) 变体（RFC 2152）。
 * 全部 encode/decode 往返验证。
 */

const td = (bytes) => new TextDecoder("utf-8").decode(new Uint8Array(bytes));
const te = (str) => [...new TextEncoder().encode(str)];

// ==================== 同步 SHA-256（base58check 校验用）====================
// 标准 FIPS 180-4，纯整数实现，无外部依赖；仅用于短校验和。
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function sha256Bytes(bytes) {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length;
  const withOne = l + 1;
  const k = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + k + 8;
  const msg = new Uint8Array(total);
  msg.set(bytes, 0);
  msg[l] = 0x80;
  const bitLen = l * 8;
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  msg[total - 8] = (hi >>> 24) & 0xff; msg[total - 7] = (hi >>> 16) & 0xff;
  msg[total - 6] = (hi >>> 8) & 0xff;  msg[total - 5] = hi & 0xff;
  msg[total - 4] = (lo >>> 24) & 0xff; msg[total - 3] = (lo >>> 16) & 0xff;
  msg[total - 2] = (lo >>> 8) & 0xff;  msg[total - 1] = lo & 0xff;
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (h[i] >>> 24) & 0xff; out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (h[i] >>> 8) & 0xff; out[i * 4 + 3] = h[i] & 0xff;
  }
  return out;
}

// ==================== radixN 大整数编解码（BigInt）====================
const B58_DICT = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function radixNEncodeBytes(bytes, dict) {
  const radix = BigInt(dict.length);
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = "";
  while (num > 0n) { out = dict[Number(num % radix)] + out; num /= radix; }
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) { out = dict[0] + out; i++; }
  return out;
}

function radixNDecodeBytes(text, dict) {
  const s = text.trim();
  if (s === "") return [];
  const radix = BigInt(dict.length);
  let num = 0n;
  for (const ch of s) {
    const idx = dict.indexOf(ch);
    if (idx === -1) throw new Error("radixN: 非法字符 " + ch);
    num = num * radix + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  let i = 0;
  while (i < s.length && s[i] === dict[0]) { bytes.unshift(0); i++; }
  return bytes;
}

// radix10：十进制大整数
const RADIX10_DICT = "0123456789";
export const radix10Decode = (t) => td(radixNDecodeBytes(t, RADIX10_DICT));
export const radix10Encode = (t) => radixNEncodeBytes(te(t), RADIX10_DICT);

// radix64：自定义码表 base64（无 padding，位打包）
const RADIX64_DICT = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function base64WithDict(bytes, dict) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const c0 = bytes[i], c1 = bytes[i + 1], c2 = bytes[i + 2];
    const n = (c0 << 16) | ((c1 || 0) << 8) | (c2 || 0);
    out += dict[(n >> 18) & 63] + dict[(n >> 12) & 63];
    if (c1 !== undefined) out += dict[(n >> 6) & 63];
    if (c2 !== undefined) out += dict[n & 63];
  }
  return out;
}
function base64DecodeWithDict(text, dict) {
  const s = text.replace(/[^\x21-\x7e]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of s) {
    const idx = dict.indexOf(ch);
    if (idx === -1) throw new Error("radix64: 非法字符 " + ch);
    val = (val << 6) | idx; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff); }
  }
  return out;
}
export const radix64Decode = (t) => td(base64DecodeWithDict(t, RADIX64_DICT));
export const radix64Encode = (t) => base64WithDict(te(t), RADIX64_DICT);

// ==================== base58check（radixN + 双 SHA-256 校验 4 字节）====================
export function base58CheckEncode(text, dict = B58_DICT) {
  const D = dict || B58_DICT;
  const payload = te(text);
  const hash = sha256Bytes(sha256Bytes(payload));
  const full = [...payload, ...hash.slice(0, 4)];
  return radixNEncodeBytes(full, D);
}
export function base58CheckDecode(text, dict = B58_DICT) {
  const D = dict || B58_DICT;
  const full = radixNDecodeBytes(text, D);
  if (full.length < 4) throw new Error("base58check: 数据过短");
  const payload = full.slice(0, full.length - 4);
  const checksum = full.slice(full.length - 4);
  const expect = sha256Bytes(sha256Bytes(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) if (checksum[i] !== expect[i]) throw new Error("base58check: 校验失败");
  return td(payload);
}

// ==================== UTF-7（RFC 2152）====================
// 直接可打印集其余走 +...- 的修改 base64（UTF-16BE，无 padding）。
const UTF7_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function utf16beBytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out.push((code >> 8) & 0xff, code & 0xff);
  }
  return out;
}
function bytesToUtf16be(bytes) {
  let s = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return s;
}
function mb64Encode(bytes, dict) {
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 6) { bits -= 6; out += dict[(val >> bits) & 63]; }
  }
  if (bits > 0) out += dict[(val << (6 - bits)) & 63];
  return out;
}
function mb64Decode(str, dict) {
  let bits = 0, val = 0;
  const out = [];
  for (const ch of str) {
    const idx = dict.indexOf(ch);
    if (idx === -1) continue;
    val = (val << 6) | idx; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff); }
  }
  return out;
}

// 直接字符集 = RFC 2152 SET_D ∪ SET_O ∪ SET_W（与 ToolsFx SET_ALL 取反一致）。
// SET_O 含 ! " # $ % & * ; < = > @ _ ^ { | } 反斜杠，保持字面不编码。
const UTF7_DIRECT_RE = /[A-Za-z0-9'(),\-.\/:?!"#$%&*;<=>@_^{|}\\ \r\n\t]/;
export function utf7Encode(text) {
  let out = "";
  let buf = "";
  const flush = () => {
    if (buf) { out += "+" + mb64Encode(utf16beBytes(buf), UTF7_B64) + "-"; buf = ""; }
  };
  for (const ch of text) {
    if (ch === "+") { flush(); out += "+-"; }
    else if (UTF7_DIRECT_RE.test(ch)) { flush(); out += ch; }
    else buf += ch;
  }
  flush();
  return out;
}
export function utf7Decode(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "+") {
      const end = text.indexOf("-", i + 1);
      const seg = end === -1 ? text.slice(i + 1) : text.slice(i + 1, end);
      if (seg === "") out += "+";
      else out += bytesToUtf16be(mb64Decode(seg, UTF7_B64));
      i = end === -1 ? text.length : end + 1;
    } else { out += text[i]; i++; }
  }
  return out;
}
