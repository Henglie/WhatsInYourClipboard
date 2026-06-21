/**
 * zip.js — 纯 JS 解析 ZIP 中央目录，列出包内文件清单。
 *
 * ZIP 结构（从尾部解析，无需解压数据）：
 *   [本地文件头 + 数据]...  [中央目录记录]...  [EOCD]
 *   EOCD 签名 0x06054b50，记录中央目录起始偏移与条目数。
 *   中央目录每条签名 0x02014b50，含文件名/大小/压缩方法。
 */

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_EOCD64_LOC = 0x07064b50;

const COMPRESSION = {
  0: "Stored（未压缩）",
  8: "Deflate",
  12: "BZIP2",
  14: "LZMA",
  93: "Zstandard",
  99: "AES 加密",
};

/** 在尾部反向查找 EOCD 签名（注释最长 65535 字节） */
function findEOCD(dv, len) {
  const min = Math.max(0, len - 22 - 0xffff);
  for (let i = len - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 解析 ZIP 字节，返回文件清单。
 * @param {Uint8Array} bytes
 * @returns {{entries:Array, totalUncomp:number, totalComp:number, count:number, encrypted:boolean}|null}
 */
export function parseZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.byteLength;

  const eocd = findEOCD(dv, len);
  if (eocd < 0) return null;

  let count = dv.getUint16(eocd + 10, true);
  let cenOffset = dv.getUint32(eocd + 16, true);

  // ZIP64：偏移为 0xFFFFFFFF 时需读 ZIP64 EOCD
  if (cenOffset === 0xffffffff || count === 0xffff) {
    const locOff = eocd - 20;
    if (locOff >= 0 && dv.getUint32(locOff, true) === SIG_EOCD64_LOC) {
      const z64 = Number(dv.getBigUint64(locOff + 8, true));
      if (z64 >= 0 && z64 + 56 <= len) {
        count = Number(dv.getBigUint64(z64 + 32, true));
        cenOffset = Number(dv.getBigUint64(z64 + 48, true));
      }
    }
  }

  const entries = [];
  let p = cenOffset;
  let totalUncomp = 0;
  let totalComp = 0;
  let encrypted = false;
  const decoder = new TextDecoder("utf-8");
  const decoderGBK =
    typeof TextDecoder !== "undefined" ? safeDecoder("gbk") : null;

  for (let i = 0; i < count && p + 46 <= len; i++) {
    if (dv.getUint32(p, true) !== SIG_CEN) break;

    const flag = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);

    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    // bit 11 = UTF-8 文件名；否则常见为 GBK（中文 ZIP）
    const name =
      flag & 0x800
        ? decoder.decode(nameBytes)
        : (decoderGBK ? decoderGBK.decode(nameBytes) : decoder.decode(nameBytes));

    if (flag & 0x1) encrypted = true;

    const isDir = name.endsWith("/");
    if (!isDir) {
      totalComp += compSize;
      totalUncomp += uncompSize;
    }

    entries.push({
      name,
      isDir,
      method: COMPRESSION[method] || `方法 ${method}`,
      compSize,
      uncompSize,
      sizeText: isDir ? "—" : fmtSize(uncompSize),
    });

    p += 46 + nameLen + extraLen + commentLen;
  }

  return {
    entries,
    count: entries.length,
    totalUncomp,
    totalComp,
    ratio: totalUncomp > 0 ? totalComp / totalUncomp : 0,
    encrypted,
  };
}

/** 安全创建解码器，不支持的编码返回 null */
function safeDecoder(label) {
  try {
    return new TextDecoder(label);
  } catch {
    return null;
  }
}
