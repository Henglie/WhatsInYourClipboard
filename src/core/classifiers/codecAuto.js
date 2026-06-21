/**
 * codecAuto.js — 可直接识别并解码的编码分类器（图2 编解码族中"能直接解码"的部分）。
 * 这些编码有明确的格式特征，可自动识别；解码后直接显示。
 * 模糊的（base58/62/85 等任意串）不在此自动识别，改由「增强功能」按钮本地解码。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { t } from "../../i18n/i18n.js";
import {
  binaryDecode,
  ascii85Decode,
  quotedPrintableDecode,
  uuDecode,
  base32Decode,
} from "../codec.js";

function decodeCard(el, title, raw, decoded, note) {
  el.appendChild(
    buildInfoCard(
      [
        [t("cardRow.encoding"), title],
        [t("cardRow.rawLength"), `${raw.length} ${t("cardRow.charCount")}`],
      ],
      { title, note }
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

// ---------- 二进制（仅 0/1 与分隔，8 位对齐） ----------
export class BinaryClassifier extends BaseClassifier {
  static priority = 51;
  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    const bits = text.replace(/[\s]/g, "");
    return /^[01]+$/.test(bits) && bits.length >= 8 && bits.length % 8 === 0;
  }
  async parse(item) {
    const raw = item.text.trim();
    let decoded = "";
    try { decoded = binaryDecode(raw); } catch { decoded = t("cardRow.undecodable"); }
    return {
      actionKey: "codec_binary",
      subtitle: t("cls.binary"),
      tplVars: { raw, decoded },
      render: (el) => decodeCard(el, t("cardTitle.binary"), raw, decoded),
    };
  }
}

// ---------- ASCII85（<~ ~> 包裹） ----------
export class Ascii85Classifier extends BaseClassifier {
  static priority = 50;
  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    return /^<~[\s\S]*~>$/.test(text);
  }
  async parse(item) {
    const raw = item.text.trim();
    let decoded = "";
    try { decoded = ascii85Decode(raw); } catch { decoded = t("cardRow.undecodable"); }
    return {
      actionKey: "codec_ascii85",
      subtitle: t("cls.ascii85"),
      tplVars: { raw, decoded },
      render: (el) => decodeCard(el, "ASCII85", raw, decoded),
    };
  }
}

// ---------- Quoted-Printable（含 =XX 序列） ----------
export class QuotedPrintableClassifier extends BaseClassifier {
  static priority = 42;
  match(item) {
    if (!item.isText) return false;
    const text = item.text;
    // 至少 2 处 =XX 十六进制，且整体是可打印 ASCII
    const matches = text.match(/=[0-9A-F]{2}/g);
    return matches && matches.length >= 2 && /^[\x20-\x7e\r\n=]+$/.test(text);
  }
  async parse(item) {
    const raw = item.text;
    let decoded = "";
    try { decoded = quotedPrintableDecode(raw); } catch { decoded = t("cardRow.undecodable"); }
    return {
      actionKey: "codec_qp",
      subtitle: t("cls.qp"),
      tplVars: { raw, decoded },
      render: (el) => decodeCard(el, "Quoted-Printable", raw, decoded),
    };
  }
}

// ---------- uuencode（begin … end） ----------
export class UuencodeClassifier extends BaseClassifier {
  static priority = 52;
  match(item) {
    if (!item.isText) return false;
    return /^begin\s+\d{3}\s+\S/m.test(item.text);
  }
  async parse(item) {
    const raw = item.text;
    let decoded = "";
    try { decoded = uuDecode(raw); } catch { decoded = t("cardRow.undecodable"); }
    return {
      actionKey: "codec_uu",
      subtitle: t("cls.uu"),
      tplVars: { raw, decoded },
      render: (el) => decodeCard(el, "uuencode", raw, decoded),
    };
  }
}

// ---------- Base32（A-Z2-7，可有 = 填充，全大写） ----------
export class Base32Classifier extends BaseClassifier {
  static priority = 19;
  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim().replace(/\s/g, "");
    if (text.length < 8 || text.length % 8 !== 0) return false;
    return /^[A-Z2-7]+=*$/.test(text);
  }
  async parse(item) {
    const raw = item.text.trim();
    let decoded = "";
    try { decoded = base32Decode(raw); } catch { decoded = t("cardRow.undecodable"); }
    return {
      actionKey: "codec_base32",
      subtitle: t("cls.base32"),
      tplVars: { raw, decoded },
      render: (el) => decodeCard(el, "Base32", raw, decoded, t("cardNote.base32")),
    };
  }
}
