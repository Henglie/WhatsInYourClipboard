/**
 * classicalExtra.js — 古典密码增补（移植参考 ToolsFx[ISC]，鸣谢 Leon406）。
 *
 * Hill（矩阵）、AutoKey（自动密钥维吉尼亚）、Manchester（曼彻斯特线路编码）、
 * Type7（Cisco Type 7 口令混淆）。全部 encode/decode 往返验证 + 公认向量对照。
 */

const te = (s) => [...new TextEncoder().encode(s)];
const td = (b) => new TextDecoder("utf-8").decode(new Uint8Array(b));
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ==================== Hill 希尔密码 ====================
// 约定 C = K·P（K 行主序方阵，P 为列向量），mod 26，A=0。
// 解密用 K 的模逆矩阵（伴随矩阵法）：K^-1 = det(K)^-1 · adj(K) mod 26。

function modInv(a, m) {
  a = ((a % m) + m) % m;
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
  return -1;
}

// n×n 子式（去掉第 r 行第 c 列）的行列式，递归。
function minor(mat, r, c) {
  const sub = [];
  for (let i = 0; i < mat.length; i++) {
    if (i === r) continue;
    const row = [];
    for (let j = 0; j < mat.length; j++) {
      if (j === c) continue;
      row.push(mat[i][j]);
    }
    sub.push(row);
  }
  return determinant(sub);
}

function determinant(mat) {
  const n = mat.length;
  if (n === 1) return mat[0][0];
  if (n === 2) return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
  let det = 0;
  for (let j = 0; j < n; j++) {
    det += (j % 2 === 0 ? 1 : -1) * mat[0][j] * minor(mat, 0, j);
  }
  return det;
}

// 模逆矩阵：伴随矩阵（余子式转置）× det 的模逆。
function invertMatrixMod(mat, m) {
  const n = mat.length;
  let det = ((determinant(mat) % m) + m) % m;
  const detInv = modInv(det, m);
  if (detInv < 0) throw new Error("Hill: 密钥矩阵在 mod " + m + " 下不可逆");
  const inv = [];
  for (let i = 0; i < n; i++) {
    inv.push([]);
    for (let j = 0; j < n; j++) {
      // adj[i][j] = 余子式 C_ji = (-1)^(i+j) * minor(j,i)
      const cof = ((i + j) % 2 === 0 ? 1 : -1) * minor(mat, j, i);
      inv[i][j] = (((cof * detInv) % m) + m) % m;
    }
  }
  return inv;
}

// key 解析成 n×n 方阵：优先数字（任意非数字分隔），否则字母（A=0）。
function parseHillKey(key) {
  let nums;
  if (/\d/.test(key)) {
    nums = key.split(/\D+/).filter(Boolean).map(Number);
  } else {
    nums = key.toUpperCase().replace(/[^A-Z]/g, "").split("").map((c) => AZ.indexOf(c));
  }
  const n = Math.round(Math.sqrt(nums.length));
  if (n * n !== nums.length || n < 2) throw new Error("Hill: 密钥长度须为完全平方数（≥4）");
  const mat = [];
  for (let i = 0; i < n; i++) mat.push(nums.slice(i * n, i * n + n));
  return mat;
}

function hillApply(text, mat) {
  const n = mat.length;
  const letters = text.toUpperCase().replace(/[^A-Z]/g, "").split("").map((c) => AZ.indexOf(c));
  while (letters.length % n !== 0) letters.push(AZ.indexOf("X")); // 填充 X
  let out = "";
  for (let i = 0; i < letters.length; i += n) {
    const vec = letters.slice(i, i + n);
    for (let r = 0; r < n; r++) {
      let sum = 0;
      for (let c = 0; c < n; c++) sum += mat[r][c] * vec[c];
      out += AZ[((sum % 26) + 26) % 26].toLowerCase();
    }
  }
  return out;
}

export function hillEncode(text, key = "GYBNQKURP") {
  return hillApply(text, parseHillKey(key));
}
export function hillDecode(text, key = "GYBNQKURP") {
  return hillApply(text, invertMatrixMod(parseHillKey(key), 26));
}

// ==================== AutoKey 自动密钥（维吉尼亚变体） ====================
// 标准 autokey：密钥流 = keyword + 明文本身。仅处理字母，其余原样透传。

export function autoKeyEncode(text, keyword = "KEY") {
  const kw = keyword.toUpperCase().replace(/[^A-Z]/g, "") || "KEY";
  const stream = kw.split(""); // 密钥流，随明文追加
  let ki = 0;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const p = c.charCodeAt(0) - base;
    const k = AZ.indexOf(stream[ki]);
    stream.push(AZ[p]); // 明文本身追加进密钥流
    ki++;
    return String.fromCharCode(base + ((p + k) % 26));
  });
}
export function autoKeyDecode(text, keyword = "KEY") {
  const kw = keyword.toUpperCase().replace(/[^A-Z]/g, "") || "KEY";
  const stream = kw.split("");
  let ki = 0;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    const ct = c.charCodeAt(0) - base;
    const k = AZ.indexOf(stream[ki]);
    const p = (ct - k + 26) % 26;
    stream.push(AZ[p]); // 解出的明文追加进密钥流
    ki++;
    return String.fromCharCode(base + p);
  });
}

// ==================== Manchester 曼彻斯特线路编码 ====================
// 文本 → UTF-8 字节 → 每 bit 映射为 2 bit。
// IEEE 802.3（默认）：0→"10" 1→"01"；G.E.Thomas/标准：0→"01" 1→"10"。

function bytesToBits(bytes) {
  return bytes.map((b) => b.toString(2).padStart(8, "0")).join("");
}

export function manchesterEncode(text, standard = false) {
  const map = standard ? { "0": "01", "1": "10" } : { "0": "10", "1": "01" };
  return [...bytesToBits(te(text))].map((b) => map[b]).join("");
}
export function manchesterDecode(text, standard = false) {
  const rev = standard ? { "01": "0", "10": "1" } : { "10": "0", "01": "1" };
  const s = text.replace(/[^01]/g, "");
  let bits = "";
  for (let i = 0; i + 2 <= s.length; i += 2) bits += rev[s.slice(i, i + 2)] ?? "";
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return td(bytes);
}

// ==================== Cisco Type 7 ====================
// 固定 53 字符密钥表；密文 = 2 位十进制 seed + 逐字节 (XOR 表[(seed+i)%53]) 的 hex。
const DICT_TYPE7 = "dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87";

export function type7Encode(text, seed = 0) {
  const s = ((Number(seed) % 16) + 16) % 16; // Cisco seed 0..15
  const bytes = te(text);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const x = bytes[i] ^ DICT_TYPE7.charCodeAt((s + i) % 53);
    hex += x.toString(16).padStart(2, "0");
  }
  return String(s).padStart(2, "0") + hex;
}
export function type7Decode(text) {
  const s = parseInt(text.slice(0, 2), 10);
  if (Number.isNaN(s)) throw new Error("Type7: 缺少 2 位 seed 前缀");
  const hex = text.slice(2).replace(/\s/g, "");
  const bytes = [];
  for (let i = 0, j = 0; i + 2 <= hex.length; i += 2, j++) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    bytes.push(b ^ DICT_TYPE7.charCodeAt((s + j) % 53));
  }
  return td(bytes);
}
