/**
 * highlight.js — 轻量语法高亮（JSON + 通用代码）。
 * 纯 DOM 构建，避免 innerHTML 注入风险。
 */

/** 判断文本是否为合法 JSON */
export function isJSON(text) {
  const t = text.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/** 把 JSON 美化并高亮，返回 <pre> 元素 */
export function renderJSON(text) {
  const pretty = JSON.stringify(JSON.parse(text), null, 2);
  const pre = document.createElement("pre");
  pre.className = "code code--json";

  // 按 token 切分：字符串/数字/布尔/null/标点
  const re = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],])/g;
  let last = 0;
  let m;
  while ((m = re.exec(pretty)) !== null) {
    if (m.index > last) {
      pre.appendChild(document.createTextNode(pretty.slice(last, m.index)));
    }
    const span = document.createElement("span");
    if (m[1]) span.className = "tok-key";
    else if (m[2]) span.className = "tok-str";
    else if (m[3]) span.className = "tok-num";
    else if (m[4]) span.className = "tok-kw";
    else span.className = "tok-punc";
    span.textContent = m[0];
    pre.appendChild(span);
    last = re.lastIndex;
  }
  if (last < pretty.length) {
    pre.appendChild(document.createTextNode(pretty.slice(last)));
  }
  return pre;
}

/** 通用代码高亮：关键字 + 字符串 + 注释 + 数字 */
const KEYWORDS = new RegExp(
  "\\b(" +
    [
      "function", "return", "const", "let", "var", "if", "else", "for", "while",
      "class", "import", "export", "from", "async", "await", "new", "this",
      "def", "print", "import", "as", "True", "False", "None", "elif", "lambda",
      "public", "private", "static", "void", "int", "string", "bool", "null",
      "package", "func", "type", "struct", "interface", "map", "range",
    ].join("|") +
    ")\\b",
  "g"
);

/** 极简启发式：是否像代码（含分号/花括号/常见关键字密度） */
export function looksLikeCode(text) {
  const lines = text.split("\n");
  if (lines.length < 2) return false;
  let signals = 0;
  if (/[{};]/.test(text)) signals++;
  if (KEYWORDS.test(text)) signals++;
  KEYWORDS.lastIndex = 0;
  if (/^\s{2,}\S/m.test(text)) signals++; // 缩进
  if (/[=(){}[\]<>]/.test(text)) signals++;
  return signals >= 3;
}

/** 渲染通用代码（保守高亮：字符串/注释/关键字/数字） */
export function renderCode(text) {
  const pre = document.createElement("pre");
  pre.className = "code";

  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+\.?\d*\b)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      appendWithKeywords(pre, text.slice(last, m.index));
    }
    const span = document.createElement("span");
    if (m[1]) span.className = "tok-comment";
    else if (m[2]) span.className = "tok-str";
    else span.className = "tok-num";
    span.textContent = m[0];
    pre.appendChild(span);
    last = re.lastIndex;
  }
  if (last < text.length) appendWithKeywords(pre, text.slice(last));
  return pre;
}

/** 在普通文本片段里再高亮关键字 */
function appendWithKeywords(pre, chunk) {
  let last = 0;
  let m;
  KEYWORDS.lastIndex = 0;
  while ((m = KEYWORDS.exec(chunk)) !== null) {
    if (m.index > last) pre.appendChild(document.createTextNode(chunk.slice(last, m.index)));
    const span = document.createElement("span");
    span.className = "tok-kw";
    span.textContent = m[0];
    pre.appendChild(span);
    last = KEYWORDS.lastIndex;
  }
  if (last < chunk.length) pre.appendChild(document.createTextNode(chunk.slice(last)));
}
