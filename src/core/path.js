/**
 * path.js — 文件系统路径识别与拆解。
 *
 * 剪贴板里很常见一条路径，但旧逻辑只当「一段文本」。这里识别三类：
 *   - Windows 盘符路径：C:\Users\me\a.txt        （含正斜杠变体 C:/Users/...）
 *   - UNC 网络路径：     \\server\share\file
 *   - Unix/类 Unix 路径：/usr/local/bin/node、~/.config/app
 * 并拆出：根 / 目录段 / 文件名 / 扩展名 / 推断类型。
 *
 * 纯本地字符串解析，零外发。判定保守：要求有足够的「路径形态」证据，
 * 避免把普通带斜杠的句子（如日期 2026/06/24、分数 1/2）误判成路径。
 */

const WIN_DRIVE = /^[a-z]:[\\/]/i;       // C:\ 或 C:/
const UNC = /^\\\\[^\\/]+[\\/]/;          // \\server\
const UNIX_ABS = /^\/[^/\s]/;             // /usr...（排除单独的 / 和 //）
const HOME = /^~[\\/]/;                   // ~/...

// 常见扩展名 → 大类（用于「这是个什么文件」的直觉提示）
const EXT_KIND = {
  // 文档
  txt: "text", md: "text", log: "text", rtf: "text", pdf: "doc",
  doc: "doc", docx: "doc", xls: "doc", xlsx: "doc", ppt: "doc", pptx: "doc",
  // 图片
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  bmp: "image", svg: "image", ico: "image", tiff: "image", heic: "image",
  // 音视频
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio", m4a: "audio",
  mp4: "video", mov: "video", mkv: "video", avi: "video", webm: "video", flv: "video",
  // 压缩
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive", xz: "archive",
  // 代码 / 配置
  js: "code", ts: "code", jsx: "code", tsx: "code", py: "code", java: "code",
  c: "code", cpp: "code", h: "code", cs: "code", go: "code", rs: "code",
  rb: "code", php: "code", swift: "code", kt: "code", sh: "code", bat: "code",
  json: "config", yaml: "config", yml: "config", toml: "config", ini: "config",
  xml: "config", html: "code", css: "code",
  // 可执行 / 系统
  exe: "exec", dll: "exec", so: "exec", dylib: "exec", app: "exec", msi: "exec",
  apk: "exec", deb: "exec", rpm: "exec", dmg: "exec",
  // 数据
  sqlite: "data", db: "data", csv: "data", sql: "data",
};

/** 是否像一条文件系统路径（保守判定）。 */
export function looksLikePath(text) {
  const s = text.trim();
  if (!s || s.length > 4096 || /\n/.test(s)) return false; // 单行
  // http(s):// 等 URL 交给 URL 分类器
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false;

  if (WIN_DRIVE.test(s)) return true;
  if (UNC.test(s)) return true;
  if (HOME.test(s)) return true;
  if (UNIX_ABS.test(s)) {
    // Unix 绝对路径：至少有一个分隔的段，且不像日期/分数
    // 要求 ≥2 段或带扩展名，降低「/ 开头随手一句」的误判
    const segs = s.split("/").filter(Boolean);
    if (segs.length >= 2) return true;
    if (segs.length === 1 && /\.[a-z0-9]{1,8}$/i.test(segs[0])) return true;
  }
  return false;
}

/**
 * 拆解路径。
 * @returns {{
 *   kind:'windows'|'unc'|'unix', sep:string, root:string|null,
 *   segments:string[], fileName:string|null, ext:string|null,
 *   extKind:string|null, depth:number, isDir:boolean
 * }}
 */
export function parsePath(text) {
  const s = text.trim();
  let kind, sep, root = null, rest = s;

  if (WIN_DRIVE.test(s)) {
    kind = "windows";
    sep = s.includes("\\") ? "\\" : "/";
    root = s.slice(0, 2); // "C:"
    rest = s.slice(2).replace(/^[\\/]+/, "");
  } else if (UNC.test(s)) {
    kind = "unc";
    sep = "\\";
    const m = s.match(/^\\\\([^\\/]+)[\\/]+([^\\/]+)?/);
    root = m ? `\\\\${m[1]}` + (m[2] ? `\\${m[2]}` : "") : "\\\\";
    rest = s.replace(/^\\\\[^\\/]+[\\/]+([^\\/]+[\\/]+)?/, "");
  } else if (HOME.test(s)) {
    kind = "unix";
    sep = "/";
    root = "~";
    rest = s.slice(1).replace(/^[\\/]+/, "");
  } else {
    kind = "unix";
    sep = "/";
    root = "/";
    rest = s.replace(/^\/+/, "");
  }

  const segments = rest.split(/[\\/]+/).filter(Boolean);
  const isDir = /[\\/]\s*$/.test(s) || segments.length === 0;
  const last = isDir ? null : segments[segments.length - 1];
  let fileName = null, ext = null, extKind = null;
  if (last) {
    fileName = last;
    const dot = last.lastIndexOf(".");
    if (dot > 0 && dot < last.length - 1) {
      ext = last.slice(dot + 1).toLowerCase();
      extKind = EXT_KIND[ext] || null;
    }
  }

  return {
    kind, sep, root, segments, fileName, ext, extKind,
    depth: segments.length, isDir,
  };
}
