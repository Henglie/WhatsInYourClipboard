/**
 * imageInfo.js — 图片尺寸解析（从字节头读取，无需解码整图）。
 * 支持 PNG / JPEG / GIF / BMP / WebP。
 */

/** 从字节读取图片宽高，返回 {width, height} 或 null */
export function readImageSize(bytes) {
  const b = bytes;
  // PNG: IHDR 在偏移 16 起，宽高各 4 字节大端
  if (b[0] === 0x89 && b[1] === 0x50) {
    const w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
    const h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
    return { width: w >>> 0, height: h >>> 0 };
  }
  // GIF: 偏移 6 起，宽高各 2 字节小端
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  }
  // BMP: 偏移 18 起，宽高各 4 字节小端
  if (b[0] === 0x42 && b[1] === 0x4d) {
    const w = b[18] | (b[19] << 8) | (b[20] << 16) | (b[21] << 24);
    const h = b[22] | (b[23] << 8) | (b[24] << 16) | (b[25] << 24);
    return { width: w, height: h };
  }
  // JPEG: 扫描 SOF0/SOF2 标记
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 8) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const h = (b[i + 5] << 8) | b[i + 6];
        const w = (b[i + 7] << 8) | b[i + 8];
        return { width: w, height: h };
      }
      const len = (b[i + 2] << 8) | b[i + 3];
      i += 2 + len;
    }
  }
  // WebP: 'RIFF'....'WEBP'，VP8X/VP8/VP8L
  if (b[0] === 0x52 && b[8] === 0x57 && b[9] === 0x45) {
    const fmt = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (fmt === "VP8X") {
      const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
      const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
      return { width: w, height: h };
    }
    if (fmt === "VP8 ") {
      return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    }
  }
  return null;
}

// PNG 色彩类型 → i18n key（含是否带 alpha）。返回 key 而非中文，
// 让色彩类型这类技术术语在英文模式下也能翻译。
const PNG_COLOR_TYPE = {
  0: { key: "cardRow.imgCtGray", alpha: false },
  2: { key: "cardRow.imgCtRgb", alpha: false },
  3: { key: "cardRow.imgCtPalette", alpha: false },
  4: { key: "cardRow.imgCtGrayA", alpha: true },
  6: { key: "cardRow.imgCtRgba", alpha: true },
};

/**
 * 深挖图片元信息（纯字节，不解码整图）：位深、色彩类型、透明通道、
 * 动图帧数等。返回的字段按格式而定，拿不到的不出现。
 * @returns {object|null} { bitDepth?, colorType?, hasAlpha?, frames?, animated?, interlaced? }
 */
export function readImageDetail(bytes) {
  const b = bytes;
  if (!b || b.length < 24) return null;

  // —— PNG：IHDR 在偏移 8 处的块，数据起于偏移 16 ——
  // 宽4 高4 位深1 色彩类型1 压缩1 滤波1 隔行1
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const out = { format: "PNG" };
    out.bitDepth = b[24];
    const ct = PNG_COLOR_TYPE[b[25]];
    if (ct) { out.colorTypeKey = ct.key; out.hasAlpha = ct.alpha; }
    out.interlaced = b[28] === 1;
    // 扫描块：tRNS（调色板/灰度透明）、acTL（APNG 动图，含帧数）
    let i = 8;
    while (i + 8 <= b.length) {
      const len = (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
      const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      if (type === "tRNS") out.hasAlpha = true;
      if (type === "acTL") {
        out.animated = true;
        out.frames = (b[i + 8] << 24 | b[i + 9] << 16 | b[i + 10] << 8 | b[i + 11]) >>> 0;
      }
      if (type === "IDAT" || type === "IEND") break; // 图像数据开始，元信息块已过
      i += 12 + len; // 长度4 + 类型4 + 数据 + CRC4
    }
    return out;
  }

  // —— GIF：调色板信息在偏移 10；动图需数全部图像块 ——
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    const out = { format: "GIF" };
    const packed = b[10];
    out.bitDepth = (packed & 0x07) + 1; // 全局色表位数 → 每像素位
    out.colorTypeKey = "cardRow.imgColorPalette";
    // 帧数：数 0x21,0xF9 图形控制扩展（每帧一个）或 0x2C 图像描述符
    let frames = 0, transparent = false;
    for (let i = 13; i + 1 < b.length; i++) {
      if (b[i] === 0x2c) frames++;            // 图像描述符 = 一帧
      if (b[i] === 0x21 && b[i + 1] === 0xf9 && (b[i + 3] & 0x01)) transparent = true;
    }
    out.frames = frames || 1;
    out.animated = frames > 1;
    out.hasAlpha = transparent;
    return out;
  }

  // —— WebP：VP8X 标志位带 alpha / animation ——
  if (b[0] === 0x52 && b[8] === 0x57 && b[9] === 0x45) {
    const fmt = String.fromCharCode(b[12], b[13], b[14], b[15]);
    const out = { format: "WebP" };
    if (fmt === "VP8X") {
      const flags = b[20];
      out.hasAlpha = !!(flags & 0x10);
      out.animated = !!(flags & 0x02);
      out.modeKey = "cardRow.imgModeExtended";
    } else if (fmt === "VP8L") {
      out.modeKey = "cardRow.imgModeLossless"; out.hasAlpha = true;
    } else if (fmt === "VP8 ") {
      out.modeKey = "cardRow.imgModeLossy"; out.hasAlpha = false;
    }
    return out;
  }

  // —— JPEG：SOF 标记里有精度与分量数 ——
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 8) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        const precision = b[i + 4];
        const components = b[i + 9];
        return {
          format: "JPEG",
          bitDepth: precision,
          colorTypeKey: components === 1 ? "cardRow.imgCtGray" : components === 3 ? "cardRow.imgCtYcbcr" : components === 4 ? "cardRow.imgCtCmyk" : null,
          colorTypeRaw: components === 1 || components === 3 || components === 4 ? null : `${components} 分量`,
          hasAlpha: false,
          progressive: marker === 0xc2,
        };
      }
      const len = (b[i + 2] << 8) | b[i + 3];
      i += 2 + len;
    }
  }
  return null;
}

/**
 * 用 canvas 提取主色调（异步，需 Image 加载）。
 * @param {string} url object URL
 * @param {number} k 取色数量
 * @returns {Promise<string[]>} hex 颜色数组
 */
export function extractColors(url, k = 5) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 48; // 缩小采样
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      let data;
      try {
        data = ctx.getImageData(0, 0, size, size).data;
      } catch {
        resolve([]);
        return;
      }
      // 量化到 4 位/通道，统计频次
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // 跳过透明
        const r = data[i] & 0xf0, g = data[i + 1] & 0xf0, b = data[i + 2] & 0xf0;
        const key = (r << 16) | (g << 8) | b;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      const top = [...buckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([key]) => {
          const r = (key >> 16) & 0xff, g = (key >> 8) & 0xff, b = key & 0xff;
          return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        });
      resolve(top);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}
