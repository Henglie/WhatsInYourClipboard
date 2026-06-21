/**
 * fileformats.js — 扩展文件格式特征码探测（JS 侧，补充 WASM magic 之外的格式）。
 * 以及 PDF 元信息解析。
 */

function bytesStartWith(b, sig, offset = 0) {
  if (b.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[offset + i] !== sig[i]) return false;
  return true;
}

const SIGS = [
  { name: "ELF 可执行文件", ext: "ELF", sig: [0x7f, 0x45, 0x4c, 0x46], kind: "Linux/Unix 可执行" },
  { name: "Mach-O 可执行文件", ext: "Mach-O", sig: [0xcf, 0xfa, 0xed, 0xfe], kind: "macOS 64位可执行" },
  { name: "Mach-O 可执行文件", ext: "Mach-O", sig: [0xce, 0xfa, 0xed, 0xfe], kind: "macOS 32位可执行" },
  { name: "RAR 压缩包", ext: "RAR", sig: [0x52, 0x61, 0x72, 0x21], kind: "压缩包" },
  { name: "7-Zip 压缩包", ext: "7Z", sig: [0x37, 0x7a, 0xbc, 0xaf], kind: "压缩包" },
  { name: "GZIP 压缩", ext: "GZ", sig: [0x1f, 0x8b], kind: "压缩流" },
  { name: "BZIP2 压缩", ext: "BZ2", sig: [0x42, 0x5a, 0x68], kind: "压缩流" },
  { name: "XZ 压缩", ext: "XZ", sig: [0xfd, 0x37, 0x7a, 0x58, 0x5a], kind: "压缩流" },
  { name: "BMP 图片", ext: "BMP", sig: [0x42, 0x4d], kind: "位图" },
  { name: "WebP 图片", ext: "WEBP", sig: [0x52, 0x49, 0x46, 0x46], kind: "图片（RIFF）" },
  { name: "TIFF 图片", ext: "TIFF", sig: [0x49, 0x49, 0x2a, 0x00], kind: "图片" },
  { name: "ICO 图标", ext: "ICO", sig: [0x00, 0x00, 0x01, 0x00], kind: "图标" },
  { name: "WAV 音频", ext: "WAV", sig: [0x52, 0x49, 0x46, 0x46], kind: "音频（RIFF）" },
  { name: "MP3 音频", ext: "MP3", sig: [0x49, 0x44, 0x33], kind: "音频（ID3）" },
  { name: "FLAC 音频", ext: "FLAC", sig: [0x66, 0x4c, 0x61, 0x43], kind: "无损音频" },
  { name: "OGG 媒体", ext: "OGG", sig: [0x4f, 0x67, 0x67, 0x53], kind: "音视频" },
  { name: "SQLite 数据库", ext: "SQLITE", sig: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65], kind: "数据库" },
  { name: "Class 字节码", ext: "CLASS", sig: [0xca, 0xfe, 0xba, 0xbe], kind: "Java 字节码" },
  { name: "PDF 文档", ext: "PDF", sig: [0x25, 0x50, 0x44, 0x46], kind: "文档" },
];

/** 探测扩展格式，返回 {name, ext, kind} 或 null */
export function detectExtended(bytes) {
  // MP4/MOV：偏移 4 处为 'ftyp'
  if (bytesStartWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    return { name: "MP4/MOV 视频", ext: "MP4", kind: "视频" };
  }
  for (const s of SIGS) {
    if (bytesStartWith(bytes, s.sig)) {
      // WebP 需进一步确认偏移 8 处 'WEBP'
      if (s.ext === "WEBP" && !bytesStartWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) continue;
      if (s.ext === "WAV" && !bytesStartWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)) continue;
      return { name: s.name, ext: s.ext, kind: s.kind };
    }
  }
  return null;
}

/** 解析 PDF 版本与页数（粗略：统计 /Type /Page） */
export function parsePDF(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  const verMatch = head.match(/%PDF-(\d\.\d)/);
  const version = verMatch ? verMatch[1] : "未知";

  // 统计 /Type /Page（非 /Pages）出现次数作为页数估计
  const full = new TextDecoder("latin1").decode(bytes);
  const pageMatches = full.match(/\/Type\s*\/Page[^s]/g);
  const pages = pageMatches ? pageMatches.length : null;

  // 元信息
  const titleMatch = full.match(/\/Title\s*\(([^)]{0,120})\)/);
  const authorMatch = full.match(/\/Author\s*\(([^)]{0,80})\)/);
  const creatorMatch = full.match(/\/Creator\s*\(([^)]{0,80})\)/);

  return {
    version,
    pages,
    title: titleMatch ? titleMatch[1] : null,
    author: authorMatch ? authorMatch[1] : null,
    creator: creatorMatch ? creatorMatch[1] : null,
  };
}
