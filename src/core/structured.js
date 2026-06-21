/**
 * structured.js — 结构化数据解析工具：CSV、Cron、User-Agent、SQL 危险检测。
 */

// ---------- CSV/TSV 解析 ----------
export function parseCSV(text) {
  const delim = text.includes("\t") && !text.includes(",") ? "\t" : ",";
  const rows = [];
  let field = "", row = [], inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuote = false;
      else field += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

// ---------- Cron 表达式 → 自然语言 ----------
const CRON_RE = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function isCron(text) {
  const t = text.trim();
  if (!CRON_RE.test(t)) return false;
  // 每段必须是数字/*//,-范围 组合，排除普通5词句子
  return t.split(/\s+/).every((f) => /^[\d*/,\-]+$/.test(f));
}

export function describeCron(text) {
  const m = text.trim().match(CRON_RE);
  if (!m) return "无法解析";
  const [, min, hour, dom, mon, dow] = m;
  const part = (f, unit) => {
    if (f === "*") return `每${unit}`;
    if (f.startsWith("*/")) return `每 ${f.slice(2)} ${unit}`;
    if (f.includes(",")) return `第 ${f} ${unit}`;
    if (f.includes("-")) return `${f} ${unit}`;
    return `第 ${f} ${unit}`;
  };
  let desc = "";
  if (min === "*" && hour === "*") desc = "每分钟";
  else {
    desc = `${part(hour, "时")} ${part(min, "分")}`;
  }
  if (dom !== "*") desc += `，每月 ${dom} 号`;
  if (mon !== "*") desc += `，${mon} 月`;
  if (dow !== "*" && /^\d$/.test(dow)) desc += `，${WEEKDAYS[Number(dow) % 7]}`;
  else if (dow !== "*") desc += `，星期 ${dow}`;
  return desc + " 执行";
}

// ---------- User-Agent 解析 ----------
export function parseUA(ua) {
  const r = { browser: "未知", os: "未知", engine: "未知", device: "桌面" };
  // 操作系统
  if (/Windows NT 10/.test(ua)) r.os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(ua)) r.os = "Windows 8.1";
  else if (/Windows/.test(ua)) r.os = "Windows";
  else if (/Mac OS X ([\d_]+)/.test(ua)) r.os = "macOS " + RegExp.$1.replace(/_/g, ".");
  else if (/Android ([\d.]+)/.test(ua)) { r.os = "Android " + RegExp.$1; r.device = "移动设备"; }
  else if (/iPhone|iPad/.test(ua)) { r.os = "iOS"; r.device = "移动设备"; }
  else if (/Linux/.test(ua)) r.os = "Linux";
  // 浏览器（顺序敏感）
  if (/Edg\//.test(ua)) r.browser = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(ua)) r.browser = "Opera";
  else if (/Firefox\/([\d.]+)/.test(ua)) r.browser = "Firefox " + RegExp.$1;
  else if (/Chrome\/([\d.]+)/.test(ua)) r.browser = "Chrome " + RegExp.$1.split(".")[0];
  else if (/Safari\//.test(ua)) r.browser = "Safari";
  // 引擎
  if (/Gecko\/|rv:/.test(ua) && /Firefox/.test(ua)) r.engine = "Gecko";
  else if (/AppleWebKit/.test(ua)) r.engine = "WebKit/Blink";
  return r;
}

export function isUA(text) {
  const t = text.trim();
  return /Mozilla\/\d/.test(t) && /\(.*\)/.test(t) && t.length < 600;
}

// ---------- SQL 危险操作检测 ----------
const SQL_DANGER = /\b(DROP|DELETE|TRUNCATE|ALTER|UPDATE)\b/i;
export function isSQL(text) {
  const t = text.trim();
  return /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b/i.test(t) &&
    /\b(FROM|INTO|TABLE|WHERE|VALUES|SET)\b/i.test(t);
}
export function sqlDanger(text) {
  const m = text.match(SQL_DANGER);
  return m ? m[1].toUpperCase() : null;
}
