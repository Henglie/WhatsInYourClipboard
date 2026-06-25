/**
 * mediaMeta.js — 多媒体深度元信息（纯字节解析，不解码整文件）。
 *
 * 目标：让图片 / 音频 / 视频不再只显示「一个名字」，而是从字节头里抠出
 * 真正有价值的信息：
 *   - 图片 EXIF：拍摄时间 / 相机厂商型号 / GPS 经纬度（接「在地图查看」）
 *   - 音频 MP3：ID3v2 标签（曲名/艺术家/专辑）+ 帧头估比特率/时长
 *   - 音频 WAV：采样率 / 声道 / 位深 / 时长
 *   - 音频 FLAC：STREAMINFO（采样率/声道/位深/总样本→时长）
 *   - 视频 MP4/MOV：mvhd 时长 + tkhd 分辨率
 *
 * 纯本地解析，零外发。所有函数容错：拿不到就返回 null / 缺字段，不抛。
 */

// ============ 通用字节读取 ============
function u16be(b, o) { return (b[o] << 8) | b[o + 1]; }
function u32be(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function u16le(b, o) { return b[o] | (b[o + 1] << 8); }
function u32le(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function ascii(b, o, n) {
  let s = "";
  for (let i = 0; i < n && o + i < b.length; i++) {
    const c = b[o + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** 秒 → "1:23" / "1:02:03" */
export function fmtDuration(sec) {
  if (!isFinite(sec) || sec < 0) return null;
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ============ EXIF（JPEG APP1 / TIFF）============
// EXIF IFD tag → 关心的字段
const EXIF_TAGS = {
  0x0112: "orientation",
  0x010f: "make",
  0x0110: "model",
  0x0132: "dateTime",
  0x9003: "dateTimeOriginal",
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8827: "iso",
  0x920a: "focalLength",
  0x8825: "gpsIFD", // 指向 GPS 子 IFD 的偏移
};
const GPS_TAGS = {
  0x0001: "latRef",
  0x0002: "lat",
  0x0003: "lngRef",
  0x0004: "lng",
  0x0006: "altitude",
};
// TIFF 类型字节宽度
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/**
 * 解析 EXIF。输入整张图片字节（JPEG）。
 * @returns {object|null} { make, model, dateTime, gps:{lat,lng}, ... }
 */
export function parseExif(bytes) {
  const b = bytes;
  // 仅处理 JPEG（FF D8）。扫描 APP1（FF E1）找 "Exif\0\0"
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  let tiffStart = -1;
  while (i < b.length - 4) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI：图像数据开始
    const len = u16be(b, i + 2);
    if (marker === 0xe1 &&
        ascii(b, i + 4, 4) === "Exif" && b[i + 8] === 0) {
      tiffStart = i + 10; // 跳过 "Exif\0\0"
      break;
    }
    i += 2 + len;
  }
  if (tiffStart < 0) return null;

  // TIFF 头：字节序 + 0x002A + IFD0 偏移
  const ts = tiffStart;
  let le;
  if (b[ts] === 0x49 && b[ts + 1] === 0x49) le = true;       // "II" little
  else if (b[ts] === 0x4d && b[ts + 1] === 0x4d) le = false; // "MM" big
  else return null;
  const rd16 = (o) => (le ? u16le(b, o) : u16be(b, o));
  const rd32 = (o) => (le ? u32le(b, o) : u32be(b, o));

  const ifd0 = ts + rd32(ts + 4);
  const out = {};

  const readIfd = (ifdOff, tagMap, store) => {
    if (ifdOff < ts || ifdOff + 2 > b.length) return;
    const n = rd16(ifdOff);
    for (let e = 0; e < n; e++) {
      const eo = ifdOff + 2 + e * 12;
      if (eo + 12 > b.length) break;
      const tag = rd16(eo);
      const name = tagMap[tag];
      if (!name) continue;
      const type = rd16(eo + 2);
      const count = rd32(eo + 4);
      const size = (TYPE_SIZE[type] || 1) * count;
      // 值 ≤4 字节内联，否则是偏移
      const valOff = size <= 4 ? eo + 8 : ts + rd32(eo + 8);
      store(name, type, count, valOff, rd16, rd32, b, ts);
    }
  };

  // IFD0：相机信息 + 指向 GPS IFD
  let gpsIfdOff = -1;
  readIfd(ifd0, { ...EXIF_TAGS }, (name, type, count, valOff) => {
    if (name === "gpsIFD") { gpsIfdOff = ts + rd32(valOff); return; }
    if (type === 2) out[name] = ascii(b, valOff, count).trim(); // ASCII 串
    else if (type === 3) out[name] = rd16(valOff);
    else if (type === 4) out[name] = rd32(valOff);
    else if (type === 5) {
      // RATIONAL：分子/分母
      const num = rd32(valOff), den = rd32(valOff + 4);
      out[name] = den ? num / den : num;
    }
  });

  // GPS IFD
  if (gpsIfdOff > ts) {
    const gps = {};
    readIfd(gpsIfdOff, { ...GPS_TAGS }, (name, type, count, valOff) => {
      if (type === 2) gps[name] = ascii(b, valOff, count).trim();
      else if (type === 5) {
        // GPS 经纬度是 3 个 RATIONAL：度/分/秒
        if (name === "lat" || name === "lng") {
          const dms = [];
          for (let k = 0; k < 3; k++) {
            const num = rd32(valOff + k * 8), den = rd32(valOff + k * 8 + 4);
            dms.push(den ? num / den : 0);
          }
          gps[name] = dms[0] + dms[1] / 60 + dms[2] / 3600;
        } else {
          const num = rd32(valOff), den = rd32(valOff + 4);
          gps[name] = den ? num / den : num;
        }
      }
    });
    if (gps.lat != null && gps.lng != null) {
      let lat = gps.lat, lng = gps.lng;
      if (/S/i.test(gps.latRef || "")) lat = -lat;
      if (/W/i.test(gps.lngRef || "")) lng = -lng;
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        out.gps = { lat, lng };
        if (gps.altitude != null) out.gps.altitude = gps.altitude;
      }
    }
  }

  return Object.keys(out).length ? out : null;
}

// ============ MP3（ID3v2 + 帧头）============
const ID3_GENRES = null; // 不展开 ID3v1 流派表，按需

/** 读 ID3v2 同步安全整数（每字节高位为 0） */
function id3SyncSafe(b, o) {
  return (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
}

/** 解析 MP3：ID3v2 标签 + 首帧头估比特率/采样率，粗算时长。 */
export function parseMp3(bytes) {
  const b = bytes;
  const out = { format: "MP3" };
  let pos = 0;

  // ID3v2 头："ID3" + 版本2 + flags1 + size4(syncsafe)
  if (ascii(b, 0, 3) === "ID3") {
    const tagSize = id3SyncSafe(b, 6);
    out.id3 = "v2." + b[3];
    const end = Math.min(10 + tagSize, b.length);
    let p = 10;
    const verMajor = b[3];
    while (p + 10 <= end) {
      const frameId = ascii(b, p, 4);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
      // v2.3/2.4 帧头：ID4 + size4 + flags2
      const fsize = verMajor >= 3 ? u32be(b, p + 4) : 0;
      if (fsize <= 0 || p + 10 + fsize > end) { p += 10; if (fsize <= 0) break; continue; }
      const textStart = p + 10;
      const map = { TIT2: "title", TPE1: "artist", TALB: "album", TYER: "year", TDRC: "year", TCON: "genre" };
      const field = map[frameId];
      if (field) {
        // 首字节是编码：0=Latin1 1=UTF16 2=UTF16BE 3=UTF8
        const enc = b[textStart];
        const raw = b.subarray(textStart + 1, textStart + fsize);
        out[field] = decodeId3Text(enc, raw);
      }
      p += 10 + fsize;
    }
    pos = end;
  }

  // 找首个帧同步字 0xFFE
  const frame = findMp3Frame(b, pos);
  if (frame) {
    out.bitrate = frame.bitrate;       // kbps
    out.sampleRate = frame.sampleRate; // Hz
    out.channels = frame.channels;
    // VBR 不准，按 CBR 粗估：(文件字节 - 标签) * 8 / 比特率
    if (frame.bitrate > 0) {
      const audioBytes = b.length - pos;
      out.duration = (audioBytes * 8) / (frame.bitrate * 1000);
    }
  }
  return out.title || out.bitrate ? out : null;
}

function decodeId3Text(enc, raw) {
  try {
    if (enc === 1 || enc === 2) {
      // UTF-16（带 BOM 或 BE）
      const label = enc === 2 ? "utf-16be" : "utf-16";
      return new TextDecoder(label).decode(raw).replace(/\0+$/, "").trim();
    }
    if (enc === 3) return new TextDecoder("utf-8").decode(raw).replace(/\0+$/, "").trim();
    return new TextDecoder("latin1").decode(raw).replace(/\0+$/, "").trim();
  } catch {
    return ascii(raw, 0, raw.length);
  }
}

// MPEG1 Layer3 比特率表（kbps）
const MP3_BITRATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_SAMPLERATE = { 0: 44100, 1: 48000, 2: 32000 };

function findMp3Frame(b, start) {
  for (let i = start; i < b.length - 4 && i < start + 200000; i++) {
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
    const verBits = (b[i + 1] >> 3) & 0x03;   // MPEG 版本
    const layer = (b[i + 1] >> 1) & 0x03;
    if (layer === 0 || verBits === 1) continue; // 保留值
    const brIndex = (b[i + 2] >> 4) & 0x0f;
    const srIndex = (b[i + 2] >> 2) & 0x03;
    if (brIndex === 0 || brIndex === 15 || srIndex === 3) continue;
    const channelMode = (b[i + 3] >> 6) & 0x03;
    return {
      bitrate: MP3_BITRATE[brIndex],
      sampleRate: MP3_SAMPLERATE[srIndex] || 44100,
      channels: channelMode === 3 ? 1 : 2,
    };
  }
  return null;
}

// ============ WAV（RIFF/fmt）============
export function parseWav(bytes) {
  const b = bytes;
  if (ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WAVE") return null;
  const out = { format: "WAV" };
  let p = 12, dataBytes = 0;
  while (p + 8 <= b.length) {
    const id = ascii(b, p, 4);
    const sz = u32le(b, p + 4);
    if (id === "fmt ") {
      out.channels = u16le(b, p + 10);
      out.sampleRate = u32le(b, p + 12);
      out.bitsPerSample = u16le(b, p + 22);
    } else if (id === "data") {
      dataBytes = sz;
    }
    p += 8 + sz + (sz & 1); // 块按偶数对齐
  }
  if (out.sampleRate && out.channels && out.bitsPerSample) {
    const byteRate = out.sampleRate * out.channels * (out.bitsPerSample / 8);
    if (byteRate > 0 && dataBytes > 0) out.duration = dataBytes / byteRate;
  }
  return out.sampleRate ? out : null;
}

// ============ FLAC（STREAMINFO）============
export function parseFlac(bytes) {
  const b = bytes;
  if (ascii(b, 0, 4) !== "fLaC") return null;
  // 首个 metadata block 应为 STREAMINFO（type 0），头 4 字节后是 34 字节数据
  const p = 4;
  const dataStart = p + 4;
  if (dataStart + 18 > b.length) return null;
  // STREAMINFO 关键字段在偏移 10 起：
  //   采样率 20bit + 声道 3bit + 位深 5bit + 总样本 36bit
  const o = dataStart + 10;
  const sampleRate = (b[o] << 12) | (b[o + 1] << 4) | (b[o + 2] >> 4);
  const channels = ((b[o + 2] >> 1) & 0x07) + 1;
  const bits = (((b[o + 2] & 0x01) << 4) | (b[o + 3] >> 4)) + 1;
  // 总样本 36bit：低 4bit 在 b[o+3]，其后 4 字节
  const totalSamples =
    ((b[o + 3] & 0x0f) * 2 ** 32) +
    (u32be(b, o + 4));
  const out = { format: "FLAC", sampleRate, channels, bitsPerSample: bits };
  if (sampleRate > 0 && totalSamples > 0) out.duration = totalSamples / sampleRate;
  return out;
}

// ============ MP4 / MOV（box 解析）============
/**
 * 解析 MP4/MOV：递归找 mvhd（时长）与 tkhd（视频轨分辨率）。
 * 只在容器顶层与 moov/trak/mdia 等已知容器内递归，避免扫到媒体数据。
 */
export function parseMp4(bytes) {
  const b = bytes;
  const out = { format: "MP4" };
  const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "udta"]);

  const walk = (start, end) => {
    let p = start;
    while (p + 8 <= end) {
      let size = u32be(b, p);
      const type = ascii(b, p + 4, 4);
      let headced = 8;
      if (size === 1) { // 64bit size
        size = u32be(b, p + 8) * 2 ** 32 + u32be(b, p + 12);
        headced = 16;
      } else if (size === 0) {
        size = end - p; // 到末尾
      }
      if (size < 8 || p + size > end + 8) break;

      if (type === "mvhd") {
        const ver = b[p + headced];
        if (ver === 1) {
          const timescale = u32be(b, p + headced + 20);
          const dur = u32be(b, p + headced + 24) * 2 ** 32 + u32be(b, p + headced + 28);
          if (timescale) out.duration = dur / timescale;
        } else {
          const timescale = u32be(b, p + headced + 12);
          const dur = u32be(b, p + headced + 16);
          if (timescale) out.duration = dur / timescale;
        }
      } else if (type === "tkhd") {
        const ver = b[p + headced];
        // 宽高是 tkhd 末尾两个 32bit 定点数（16.16）。
        // v0 头部到宽高前共 76 字节，v1 时间字段各多 4 字节 → 88。
        const base = p + headced + (ver === 1 ? 88 : 76);
        if (base + 8 <= p + size) {
          const w = u32be(b, base) / 65536;
          const h = u32be(b, base + 4) / 65536;
          if (w > 0 && h > 0 && (!out.width || w > out.width)) {
            out.width = Math.round(w);
            out.height = Math.round(h);
          }
        }
      } else if (type === "ftyp") {
        out.brand = ascii(b, p + headced, 4);
      } else if (CONTAINERS.has(type)) {
        walk(p + headced, p + size);
      }
      p += size;
    }
  };

  // 顶层从 0 开始
  walk(0, b.length);
  return out.duration != null || out.width ? out : null;
}

// ============ 统一入口 ============
/**
 * 按 MIME / 字节特征选解析器，返回归一的媒体元信息或 null。
 * @returns {object|null} { kind:'image'|'audio'|'video', ...字段 }
 */
export function parseMediaMeta(bytes, mime = "") {
  const b = bytes;
  if (!b || b.length < 12) return null;

  // 图片 EXIF（仅 JPEG 带）
  if (mime.startsWith("image/") || (b[0] === 0xff && b[1] === 0xd8)) {
    const exif = parseExif(b);
    if (exif) return { kind: "image", ...exif };
    return null;
  }
  // 音频
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) {
    const m = parseMp3(b);
    if (m) return { kind: "audio", ...m };
  }
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") {
    const m = parseWav(b);
    if (m) return { kind: "audio", ...m };
  }
  if (ascii(b, 0, 4) === "fLaC") {
    const m = parseFlac(b);
    if (m) return { kind: "audio", ...m };
  }
  // 视频/容器 MP4/MOV：偏移 4 处 'ftyp'
  if (ascii(b, 4, 4) === "ftyp") {
    const m = parseMp4(b);
    if (m) {
      // 有视频轨宽高→video，否则按 audio（m4a）
      m.kind = m.width ? "video" : "audio";
      return m;
    }
  }
  return null;
}
