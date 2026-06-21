/**
 * markdown.js — 轻量 Markdown 识别与安全渲染（纯 DOM，无 innerHTML 注入）。
 * 支持：标题、粗斜体、行内代码、代码块、列表、引用、链接、分割线。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { t } from "../../i18n/i18n.js";

const MD_SIGNALS = [
  /^#{1,6}\s+\S/m, // 标题
  /^[-*+]\s+\S/m, // 无序列表
  /^\d+\.\s+\S/m, // 有序列表
  /^>\s+\S/m, // 引用
  /```[\s\S]*```/, // 代码块
  /\[[^\]]+\]\([^)]+\)/, // 链接
  /\*\*[^*]+\*\*/, // 粗体
];

function looksLikeMarkdown(text) {
  const hits = MD_SIGNALS.filter((re) => re.test(text)).length;
  return text.includes("\n") && hits >= 2;
}

/** 行内格式 → DOM 片段（粗体/斜体/行内代码/链接） */
function inline(text, parent) {
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (m[2]) { const b = document.createElement("strong"); b.textContent = m[2]; parent.appendChild(b); }
    else if (m[4]) { const i = document.createElement("em"); i.textContent = m[4]; parent.appendChild(i); }
    else if (m[6]) { const c = document.createElement("code"); c.textContent = m[6]; parent.appendChild(c); }
    else if (m[8]) {
      const a = document.createElement("a");
      a.href = m[9]; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = m[8];
      parent.appendChild(a);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

/** 渲染 Markdown 到容器（块级解析） */
function renderMarkdown(text, root) {
  const lines = text.split("\n");
  let i = 0;
  let list = null;
  const flushList = () => { if (list) { root.appendChild(list); list = null; } };

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.trim().startsWith("```")) {
      flushList();
      const pre = document.createElement("pre");
      pre.className = "code";
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
      pre.textContent = buf.join("\n");
      root.appendChild(pre);
      i++;
      continue;
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const el = document.createElement("h" + h[1].length);
      el.className = "md-h";
      inline(h[2], el);
      root.appendChild(el);
      i++;
      continue;
    }
    // 分割线
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      flushList();
      root.appendChild(document.createElement("hr"));
      i++;
      continue;
    }
    // 引用
    if (/^>\s?/.test(line)) {
      flushList();
      const bq = document.createElement("blockquote");
      inline(line.replace(/^>\s?/, ""), bq);
      root.appendChild(bq);
      i++;
      continue;
    }
    // 列表
    const li = line.match(/^\s*[-*+]\s+(.*)$/) || line.match(/^\s*\d+\.\s+(.*)$/);
    if (li) {
      if (!list) { list = document.createElement("ul"); list.className = "md-list"; }
      const item = document.createElement("li");
      inline(li[1], item);
      list.appendChild(item);
      i++;
      continue;
    }
    // 空行
    if (!line.trim()) { flushList(); i++; continue; }
    // 普通段落
    flushList();
    const p = document.createElement("p");
    inline(line, p);
    root.appendChild(p);
    i++;
  }
  flushList();
}

export class MarkdownClassifier extends BaseClassifier {
  static priority = 16;

  match(item) {
    return item.isText && looksLikeMarkdown(item.text);
  }

  async parse(item) {
    const text = item.text;
    return {
      actionKey: "struct_markdown",
      subtitle: t("cls.markdown"),
      tplVars: { text },
      render: (el) => {
        const box = document.createElement("div");
        box.className = "markdown";
        renderMarkdown(text, box);
        el.appendChild(box);
      },
    };
  }
}
