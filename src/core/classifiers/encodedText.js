/**
 * encodedText.js — 文本编码类分类器：URL编码、HTML实体、Unicode转义、摩斯电码。
 * 识别后提供解码预览。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { t } from "../../i18n/i18n.js";

function decodePreview(el, title, original, decoded) {
  el.appendChild(
    buildInfoCard(
      [
        [t("cardRow.encoding"), title],
        [t("cardRow.rawLength"), `${original.length} ${t("cardRow.charCount")}`],
      ],
      { title: title }
    )
  );
  const lbl = document.createElement("div");
  lbl.className = "infocard__title";
  lbl.textContent = t("cardRow.decodeResult");
  const pre = document.createElement("pre");
  pre.className = "code";
  pre.textContent = decoded;
  el.append(lbl, pre);
}

// ---- URL 百分号编码：含 %XX 序列 ----
export class UrlEncodingClassifier extends BaseClassifier {
  static priority = 44;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    return /%[0-9a-f]{2}/i.test(t) && /^[\x20-\x7e]+$/.test(t);
  }

  async parse(item) {
    const t = item.text.trim();
    let decoded;
    try {
      decoded = decodeURIComponent(t);
    } catch {
      decoded = t("cardRow.undecodable");
    }
    return {
      actionKey: "enc_url",
      subtitle: t("cls.urlEnc"),
      tplVars: { decoded },
      render: (el) => decodePreview(el, t("cardTitle.urlEnc"), t, decoded),
    };
  }
}

// ---- HTML 实体：含 &xxx; 或 &#nnn; ----
const HTML_ENTITY_RE = /&(#\d+|#x[0-9a-f]+|[a-z]+);/i;
export class HtmlEntityClassifier extends BaseClassifier {
  static priority = 43;

  match(item) {
    return item.isText && HTML_ENTITY_RE.test(item.text.trim());
  }

  async parse(item) {
    const t = item.text.trim();
    const ta = document.createElement("textarea");
    ta.innerHTML = t;
    const decoded = ta.value;
    return {
      actionKey: "enc_html",
      subtitle: t("cls.htmlEntity"),
      tplVars: { decoded },
      render: (el) => decodePreview(el, t("cardTitle.htmlEntity"), t, decoded),
    };
  }
}

// ---- Unicode 转义：含 \uXXXX ----
const UNICODE_RE = /\\u[0-9a-f]{4}/i;
export class UnicodeEscapeClassifier extends BaseClassifier {
  static priority = 52;

  match(item) {
    return item.isText && UNICODE_RE.test(item.text.trim());
  }

  async parse(item) {
    const t = item.text.trim();
    const decoded = t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
    return {
      actionKey: "enc_unicode",
      subtitle: t("cls.unicode"),
      tplVars: { decoded },
      render: (el) => decodePreview(el, t("cardTitle.unicodeEscape"), t, decoded),
    };
  }
}

// ---- 摩斯电码：仅 . - / 空格，且含足够长度 ----
const MORSE = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F",
  "--.": "G", "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L",
  "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R",
  "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X",
  "-.--": "Y", "--..": "Z", "-----": "0", ".----": "1", "..---": "2",
  "...--": "3", "....-": "4", ".....": "5", "-....": "6", "--...": "7",
  "---..": "8", "----.": "9",
};
export class MorseClassifier extends BaseClassifier {
  static priority = 48;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    return /^[.\-/\s]+$/.test(t) && /[.-]/.test(t) && t.length >= 5;
  }

  async parse(item) {
    const t = item.text.trim();
    const decoded = t
      .split(/\s*\/\s*/)
      .map((word) =>
        word
          .trim()
          .split(/\s+/)
          .map((c) => MORSE[c] || "?")
          .join("")
      )
      .join(" ");
    return {
      actionKey: "enc_morse",
      subtitle: t("cls.morse"),
      tplVars: { decoded },
      render: (el) => decodePreview(el, t("cardTitle.morse"), t, decoded),
    };
  }
}
