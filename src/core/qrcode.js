/**
 * qrcode.js — 极简二维码生成器（纯本地、零依赖、零外发）。
 *
 * 支持字节模式（UTF-8），自动选最小版本（1~10，最多约 271 字节，足够 URL/坐标/
 * 短文本）。纠错级别固定 M。输出布尔矩阵，由调用方画到 canvas。
 *
 * 这是「下一步做什么」里 qr 动作的引擎：把文本/URL/坐标本地变成二维码，
 * 手机扫一扫即用，全程不联网。实现参考 QR Code 规范 ISO/IEC 18004。
 */

// ---- Galois Field GF(256) 表（生成多项式 0x11d）----
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** 生成 Reed-Solomon 纠错码字 */
function rsEncode(data, ecLen) {
  const gen = [1];
  for (let i = 0; i < ecLen; i++) {
    gen.push(0);
    for (let j = gen.length - 1; j > 0; j--) {
      gen[j] = gen[j - 1] ^ gfMul(gen[j], EXP[i]);
    }
    gen[0] = gfMul(gen[0], EXP[i]);
  }
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return res.slice(data.length);
}

// ---- 版本参数（纠错级别 M）：total=总码字数, ec=每块纠错码字数, blocks=块数 ----
// 仅列版本 1~10（容量足够 URL/坐标/短文本）。
const VERSIONS_M = {
  1: { total: 26, ec: 10, nBlocks: 1 },
  2: { total: 44, ec: 16, nBlocks: 1 },
  3: { total: 70, ec: 26, nBlocks: 1 },
  4: { total: 100, ec: 18, nBlocks: 2 },
  5: { total: 134, ec: 24, nBlocks: 2 },
  6: { total: 172, ec: 16, nBlocks: 4 },
  7: { total: 196, ec: 18, nBlocks: 4 },
  8: { total: 242, ec: 22, nBlocks: 4 },
  9: { total: 292, ec: 22, nBlocks: 5 },
  10: { total: 346, ec: 26, nBlocks: 5 },
};

/** 模块尺寸：版本 v → 21 + (v-1)*4 */
const sizeOf = (v) => 17 + v * 4;

/** UTF-8 编码 */
function utf8Bytes(str) {
  return Array.from(new TextEncoder().encode(str));
}

/** 选能装下 dataLen 字节（字节模式）的最小版本 */
function pickVersion(dataLen) {
  for (let v = 1; v <= 10; v++) {
    const info = VERSIONS_M[v];
    const dataCw = info.total - info.ec * info.nBlocks;
    const lenBits = v <= 9 ? 8 : 16;
    const headerBits = 4 + lenBits;
    const capacity = dataCw * 8 - headerBits;
    if (dataLen * 8 <= capacity) return v;
  }
  return null;
}

/** 构造数据码字（含模式、长度、终止符、填充）*/
function buildDataCodewords(bytes, v) {
  const info = VERSIONS_M[v];
  const dataCw = info.total - info.ec * info.nBlocks;
  const lenBits = v <= 9 ? 8 : 16;

  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, lenBits);
  for (const b of bytes) push(b, 8);
  const cap = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const pads = [0xec, 0x11];
  let pi = 0;
  while (codewords.length < dataCw) codewords.push(pads[pi++ % 2]);
  return codewords;
}

/** 交错数据块 + 纠错块 */
function interleave(dataCodewords, v) {
  const info = VERSIONS_M[v];
  const nBlocks = info.nBlocks;
  const dataCw = info.total - info.ec * nBlocks;
  const base = Math.floor(dataCw / nBlocks);
  const extra = dataCw % nBlocks;
  const blocks = [];
  let pos = 0;
  for (let i = 0; i < nBlocks; i++) {
    const len = base + (i >= nBlocks - extra ? 1 : 0);
    const data = dataCodewords.slice(pos, pos + len);
    pos += len;
    blocks.push({ data, ec: rsEncode(data, info.ec) });
  }
  const result = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) result.push(b.data[i]);
  }
  for (let i = 0; i < info.ec; i++) {
    for (const b of blocks) result.push(b.ec[i]);
  }
  return result;
}

// ---- 矩阵构造 ----
function newMatrix(size) {
  const m = [];
  for (let i = 0; i < size; i++) m.push(new Array(size).fill(null));
  return m;
}

function placeFinder(m, r, c) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const inRing =
        dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6);
      const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      m[rr][cc] = inRing || inCore ? 1 : 0;
    }
  }
}

function alignPositions(v) {
  const TABLE = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  return TABLE[v] || [];
}

function placeAlign(m, r, c) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      m[r + dr][c + dc] = ring === 1 ? 0 : 1;
    }
  }
}

function placeFunctionPatterns(m, v) {
  const size = m.length;
  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (m[6][i] === null) m[6][i] = bit;
    if (m[i][6] === null) m[i][6] = bit;
  }
  m[size - 8][8] = 1;
  if (v >= 2) {
    const pos = alignPositions(v);
    for (const r of pos) {
      for (const c of pos) {
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
        placeAlign(m, r, c);
      }
    }
  }
}

/** 预留格式信息区（先占位，后填）*/
function reserveFormat(m) {
  const size = m.length;
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0;
  }
}

/** 把数据比特按 zigzag 填入矩阵（跳过功能模块）*/
function placeData(m, codewords) {
  const size = m.length;
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  let bi = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (m[row][c] === null) {
          m[row][c] = bi < bits.length ? bits[bi] : 0;
          bi++;
        }
      }
    }
    up = !up;
  }
}

// 掩码函数 0~7
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 标记功能模块（不参与掩码）*/
function functionMask(v) {
  const size = sizeOf(v);
  const fm = newMatrix(size);
  placeFunctionPatterns(fm, v);
  reserveFormat(fm);
  const isFunc = [];
  for (let r = 0; r < size; r++) {
    isFunc.push([]);
    for (let c = 0; c < size; c++) isFunc[r][c] = fm[r][c] !== null;
  }
  return isFunc;
}

function applyMask(m, maskIdx, isFunc) {
  const fn = MASKS[maskIdx];
  const size = m.length;
  const out = m.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunc[r][c] && fn(r, c)) out[r][c] ^= 1;
    }
  }
  return out;
}

/** 格式信息（纠错级 M=0b00 + 掩码），15 bit，含 BCH */
function formatBits(maskIdx) {
  const ecBits = 0b00; // M
  const data = (ecBits << 3) | maskIdx;
  let rem = data << 10;
  const g = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= g << (i - 10);
  }
  const bits = ((data << 10) | rem) ^ 0b101010000010010;
  return bits & 0x7fff;
}

function placeFormat(m, maskIdx) {
  const size = m.length;
  const bits = formatBits(maskIdx);
  const get = (i) => (bits >> i) & 1;
  const coords1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = coords1[i];
    m[r][c] = get(i);
  }
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = get(i);
  for (let i = 0; i < 7; i++) m[size - 7 + i][8] = get(8 + i);
}

/** 惩罚分（掩码评分，选最低）*/
function penalty(m) {
  const size = m.length;
  let score = 0;
  for (let r = 0; r < size; r++) {
    for (const line of [m[r], m.map((row) => row[r])]) {
      let run = 1;
      for (let i = 1; i < size; i++) {
        if (line[i] === line[i - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const ratio = (dark / (size * size)) * 100;
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/**
 * 生成二维码矩阵。
 * @param {string} text  要编码的文本（UTF-8）
 * @returns {{ size:number, modules:boolean[][] }|null} null 表示超容量
 */
export function makeQR(text) {
  const bytes = utf8Bytes(text);
  const v = pickVersion(bytes.length);
  if (!v) return null;

  const dataCw = buildDataCodewords(bytes, v);
  const finalCw = interleave(dataCw, v);

  const isFunc = functionMask(v);
  const base = newMatrix(sizeOf(v));
  placeFunctionPatterns(base, v);
  reserveFormat(base);
  placeData(base, finalCw);

  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(base, mask, isFunc);
    placeFormat(masked, mask);
    const s = penalty(masked);
    if (s < bestScore) { bestScore = s; best = masked; }
  }

  const modules = best.map((row) => row.map((val) => val === 1));
  return { size: best.length, modules };
}

/**
 * 把二维码画到 canvas。白底黑点 + 安静区。
 * @param {string} text
 * @param {number|{scale?:number,margin?:number}} [opts]
 *        每模块像素（数字）或 { scale, margin } 选项对象（margin = 安静区模块数）
 * @returns {HTMLCanvasElement|null}
 */
export function renderQRCanvas(text, opts = 4) {
  const { scale, margin } = typeof opts === "number"
    ? { scale: opts, margin: 4 }
    : { scale: opts?.scale ?? 4, margin: opts?.margin ?? 4 };
  const qr = makeQR(text);
  if (!qr) return null;
  const quiet = margin;
  const dim = (qr.size + quiet * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) {
        ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }
  return canvas;
}
