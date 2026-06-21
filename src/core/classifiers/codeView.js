/**
 * codeView.js — 代码 / 标记语言分类器。
 *
 * 三个分类器：
 *  - CodeClassifier  : 识别具体编程语言（detectCodeLang），高亮 + 语言标签，
 *                      可在浏览器跑的（JS/CSS）附「运行」按钮。
 *  - HtmlClassifier  : HTML 文档 / 片段。默认渲染「网页原貌」(沙箱 iframe)，
 *                      可切到源码视图。也处理剪贴板带 text/html 的网页复制场景。
 *  - XmlClassifier   : XML 文档，结构化树形预览 + 源码。
 *
 * 隐私铁律：识别、高亮、渲染全部本地；运行走断网沙箱（codeRunner）。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { renderCode } from "../../views/renderers/highlight.js";
import { renderRunner, buildHtmlSrcdoc } from "../../views/renderers/codeRunner.js";
import { detectCodeLang } from "../codeLang.js";
import { t } from "../../i18n/i18n.js";

const HTML_DOC_RE = /<!doctype\s+html|<html[\s>]/i;
const HTML_FRAGMENT_RE = /<(?:div|span|p|a|ul|ol|li|table|tr|td|h[1-6]|img|section|article|header|footer|nav|button|form|input|br|strong|em|b|i)\b[^>]*>/i;

/** 是否像一份「可渲染原貌」的 HTML（文档或带标签的片段） */
function looksLikeHtml(text) {
  const tr = text.trim();
  if (HTML_DOC_RE.test(tr)) return true;
  // 片段：含成对/常见标签，且尖括号标签出现 >=2 次
  const tagCount = (tr.match(/<[a-zA-Z][\w-]*[\s>/]/g) || []).length;
  return tagCount >= 2 && HTML_FRAGMENT_RE.test(tr);
}

/** 是否像 XML（声明 / 命名空间 / 成对标签，且不是 HTML） */
function looksLikeXml(text) {
  const tr = text.trim();
  if (looksLikeHtml(tr)) return false;
  if (/^<\?xml[\s\S]*?\?>/i.test(tr)) return true;
  if (/xmlns(?::\w+)?\s*=/.test(tr) && /<\/[\w:]+>/.test(tr)) return true;
  // 命名空间标签 + 闭合根
  if (/^<([a-zA-Z][\w.:-]*)[^>]*>[\s\S]*<\/\1>\s*$/.test(tr) && /<[\w.:-]+[\s/>]/.test(tr)) {
    const tagCount = (tr.match(/<[a-zA-Z]/g) || []).length;
    return tagCount >= 3;
  }
  return false;
}

// ============ 编程语言 ============
export class CodeClassifier extends BaseClassifier {
  static priority = 14; // 高于纯文本兜底(10)、低于 JSON/CSV/具体令牌

  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    if (text.length < 8) return false;
    // HTML/XML 各有专属分类器，这里只接「程序源码」
    if (looksLikeHtml(text) || looksLikeXml(text)) return false;
    const lang = detectCodeLang(text);
    // json 单独有分类器/渲染；这里跳过让 JSON 分类器接
    if (!lang || lang.id === "json") return false;
    this._lang = lang;
    return true;
  }

  async parse(item) {
    const text = item.text;
    const lang = this._lang || detectCodeLang(text);

    return {
      actionKey: "text_code",
      subtitle: t("cls.codeLang", { lang: lang.label }),
      tplVars: { text },
      render: (el) => {
        const rows = [[t("cardRow.codeLanguage"), lang.label]];
        if (lang.candidates && lang.candidates.length > 1) {
          rows.push([
            t("cardRow.codeAlsoLike"),
            lang.candidates.slice(1).map((c) => c.label).join(" / "),
          ]);
        }
        rows.push([t("cardRow.codeLines"), String(text.split("\n").length)]);
        el.appendChild(buildInfoCard(rows, { title: t("cardTitle.code") }));

        el.appendChild(renderCode(text));

        // 可在浏览器运行的语言（JS / CSS）附本地沙箱运行按钮
        if (lang.runnable) {
          renderRunner(el, text, lang.runnable);
        }
      },
    };
  }
}

// ============ HTML ============
export class HtmlClassifier extends BaseClassifier {
  static priority = 17; // 高于 Markdown(16)、CSV(18) 之下

  match(item) {
    if (!item.isText) return false;
    // 剪贴板带 text/html 原貌，或正文本身就是 HTML
    if (item.meta && item.meta.html) return true;
    return looksLikeHtml(item.text);
  }

  async parse(item) {
    // 渲染原貌优先用剪贴板自带的 text/html（网页复制场景），否则用正文
    const richHtml = item.meta && item.meta.html ? item.meta.html : null;
    const source = richHtml || item.text;
    const fromWebCopy = !!richHtml;

    return {
      actionKey: "struct_html",
      subtitle: fromWebCopy ? t("cls.htmlRich") : t("cls.html"),
      tplVars: { text: source, html: source },
      render: (el) => {
        // —— 视图切换：原貌 / 源码 ——
        const seg = document.createElement("div");
        seg.className = "dir-toggle view-toggle";
        const previewBox = document.createElement("div");
        const sourceBox = document.createElement("div");
        sourceBox.style.display = "none";

        const mkBtn = (label, on) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "dir-toggle__btn" + (on ? " is-on" : "");
          b.textContent = label;
          return b;
        };
        const previewBtn = mkBtn(t("view.renderedLook"), true);
        const sourceBtn = mkBtn(t("view.sourceCode"), false);
        previewBtn.addEventListener("click", () => {
          previewBtn.classList.add("is-on"); sourceBtn.classList.remove("is-on");
          previewBox.style.display = ""; sourceBox.style.display = "none";
        });
        sourceBtn.addEventListener("click", () => {
          sourceBtn.classList.add("is-on"); previewBtn.classList.remove("is-on");
          sourceBox.style.display = ""; previewBox.style.display = "none";
        });
        seg.append(previewBtn, sourceBtn);
        el.appendChild(seg);

        // —— 原貌：断网沙箱 iframe（含内联脚本可执行，但无网络出口） ——
        const note = document.createElement("p");
        note.className = "runner__hint";
        note.textContent = t("cardNote.htmlSandbox");
        previewBox.appendChild(note);
        const frame = document.createElement("iframe");
        frame.className = "runner__frame html-preview";
        frame.setAttribute("sandbox", "allow-scripts");
        frame.setAttribute("title", "html-preview");
        frame.srcdoc = buildHtmlSrcdoc(source);
        previewBox.appendChild(frame);
        el.appendChild(previewBox);

        // —— 源码：高亮 ——
        sourceBox.appendChild(renderCode(source));
        el.appendChild(sourceBox);
      },
    };
  }
}

// ============ XML ============
export class XmlClassifier extends BaseClassifier {
  static priority = 15;

  match(item) {
    return item.isText && looksLikeXml(item.text);
  }

  async parse(item) {
    const text = item.text.trim();
    let doc = null;
    let parseError = null;
    try {
      doc = new DOMParser().parseFromString(text, "application/xml");
      if (doc.querySelector("parsererror")) {
        parseError = doc.querySelector("parsererror").textContent;
        doc = null;
      }
    } catch (e) {
      parseError = e.message;
    }

    const rootName = doc && doc.documentElement ? doc.documentElement.nodeName : null;
    const nodeCount = doc ? doc.getElementsByTagName("*").length : 0;

    return {
      actionKey: "struct_xml",
      subtitle: t("cls.xml"),
      tplVars: { text },
      render: (el) => {
        const rows = [];
        if (rootName) rows.push([t("cardRow.xmlRoot"), rootName]);
        if (doc) rows.push([t("cardRow.xmlNodeCount"), String(nodeCount)]);
        rows.push([t("cardRow.rawLength"), `${text.length}${t("cardRow.charCount")}`]);
        el.appendChild(buildInfoCard(rows, {
          title: t("cardTitle.xml"),
          note: parseError ? t("cardNote.xmlInvalid") : t("cardNote.xmlTree"),
        }));

        // 结构化树（解析成功时），否则退回源码高亮
        if (doc && doc.documentElement) {
          const tree = document.createElement("div");
          tree.className = "xml-tree";
          renderXmlNode(doc.documentElement, tree, 0);
          el.appendChild(tree);
        } else {
          el.appendChild(renderCode(text));
        }
      },
    };
  }
}

/** 递归渲染 XML 节点为缩进树（纯 DOM，无 innerHTML） */
function renderXmlNode(node, parent, depth) {
  if (depth > 40) return;
  const line = document.createElement("div");
  line.className = "xml-tree__node";
  line.style.paddingLeft = depth * 1.1 + "rem";

  const tag = document.createElement("span");
  tag.className = "xml-tree__tag";
  tag.textContent = "<" + node.nodeName;
  line.appendChild(tag);

  for (const attr of node.attributes || []) {
    const a = document.createElement("span");
    a.className = "xml-tree__attr";
    a.textContent = " " + attr.name;
    const eq = document.createElement("span");
    eq.className = "xml-tree__attrval";
    eq.textContent = '="' + attr.value + '"';
    line.append(a, eq);
  }

  // 直接文本子节点
  const directText = Array.from(node.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.nodeValue.trim())
    .filter(Boolean)
    .join(" ");
  const elementChildren = Array.from(node.children || []);

  if (!elementChildren.length && directText) {
    const close = document.createElement("span");
    close.className = "xml-tree__tag";
    close.textContent = ">";
    const val = document.createElement("span");
    val.className = "xml-tree__text";
    val.textContent = directText;
    const end = document.createElement("span");
    end.className = "xml-tree__tag";
    end.textContent = "</" + node.nodeName + ">";
    line.append(close, val, end);
    parent.appendChild(line);
    return;
  }

  const close = document.createElement("span");
  close.className = "xml-tree__tag";
  close.textContent = elementChildren.length ? ">" : "/>";
  line.appendChild(close);
  parent.appendChild(line);

  for (const child of elementChildren) renderXmlNode(child, parent, depth + 1);

  if (elementChildren.length) {
    const endLine = document.createElement("div");
    endLine.className = "xml-tree__node";
    endLine.style.paddingLeft = depth * 1.1 + "rem";
    const end = document.createElement("span");
    end.className = "xml-tree__tag";
    end.textContent = "</" + node.nodeName + ">";
    endLine.appendChild(end);
    parent.appendChild(endLine);
  }
}
