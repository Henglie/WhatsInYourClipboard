/**
 * InvisibleStego.js — 不可见字符 / 零宽隐写分类器。
 *
 * 「剪贴板透视」的暗面：一段看起来平平无奇的文字，字里行间可能藏着
 * 肉眼看不见的字符——隐写消息、追踪水印、或 bidi 视觉欺骗、LLM 提示注入。
 * 命中即把这些字符揪出来展示，并尽力还原藏进去的内容 + 给出净化后文本。
 *
 * 识别永远本地、零外发（core/zeroWidth.js 纯同步）。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { detect, decodeAll, isStego } from "../zeroWidth.js";
import { t } from "../../i18n/i18n.js";

const SCHEME_KEY = {
  tags: "stego.schemeTags",
  variationSelectors: "stego.schemeVs",
  zeroWidthBinary: "stego.schemeZwBinary",
};

export class InvisibleStegoClassifier extends BaseClassifier {
  // 高于文化/文本兜底（ForeignLang 20 / ChineseText 15 / Text 10），
  // 低于强结构令牌。隐藏字符是强信号，但载体常是普通文本，故不抢身份类。
  static priority = 48;

  match(item) {
    if (!item.isText) return false;
    const info = detect(item.text);
    return isStego(info);
  }

  async parse(item) {
    const info = detect(item.text);
    const decoded = decodeAll(item.text);

    // tplVars：净化文本 + （若解出）首条隐藏消息，供动作复制。
    const firstMsg = decoded.length ? decoded[0].message : "";
    const report = info.hidden
      .map((h) => `${h.hex}\t${h.name}\t@${h.index}`)
      .join("\n");

    return {
      actionKey: "stego_invisible",
      subtitle: t("cls.invisibleStego"),
      tplVars: {
        visible: info.visible,
        hiddenMessage: firstMsg,
        report,
      },
      render: (el) => this.#render(el, info, decoded),
    };
  }

  #render(el, info, decoded) {
    // ① 概览卡：各类不可见字符计数 + 可见文本长度
    const parts = [];
    if (info.counts.tag) parts.push(`${t("stego.catTag")} ×${info.counts.tag}`);
    if (info.counts.bidi) parts.push(`${t("stego.catBidi")} ×${info.counts.bidi}`);
    if (info.counts.zw) parts.push(`${t("stego.catZeroWidth")} ×${info.counts.zw}`);
    if (info.counts.vs) parts.push(`${t("stego.catVs")} ×${info.counts.vs}`);

    el.appendChild(
      buildInfoCard(
        [
          [t("stego.hiddenCount"), `${info.hidden.length} ${t("cardRow.charCount")}`],
          [t("stego.categories"), parts.join("，") || "—"],
          [t("stego.visibleLen"), `${info.visible.length} ${t("cardRow.charCount")}`],
        ],
        { title: t("stego.cardTitle"), note: t("stego.warnNote") }
      )
    );

    // ② 解出的隐藏消息（若有）
    if (decoded.length) {
      const lbl = document.createElement("div");
      lbl.className = "infocard__title";
      lbl.textContent = t("stego.decodedTitle");
      el.appendChild(lbl);
      for (const d of decoded) {
        const row = document.createElement("div");
        row.className = "stego-decoded";
        const tag = document.createElement("span");
        tag.className = "stego-decoded__scheme";
        tag.textContent = t(SCHEME_KEY[d.scheme] || d.scheme);
        const msg = document.createElement("pre");
        msg.className = "code";
        msg.textContent = d.message; // textContent 防注入
        row.append(tag, msg);
        el.appendChild(row);
      }
    }

    // ③ 净化后的可见文本
    const vlbl = document.createElement("div");
    vlbl.className = "infocard__title";
    vlbl.textContent = t("stego.cleanTitle");
    const vpre = document.createElement("pre");
    vpre.className = "code";
    vpre.textContent = info.visible;
    el.append(vlbl, vpre);

    // ④ 逐字符明细（最多 40 条，避免刷屏）
    const dlbl = document.createElement("div");
    dlbl.className = "infocard__title";
    dlbl.textContent = t("stego.detailTitle");
    el.appendChild(dlbl);
    const list = document.createElement("div");
    list.className = "stego-charlist";
    const shown = info.hidden.slice(0, 40);
    for (const h of shown) {
      const chip = document.createElement("span");
      chip.className = "stego-char stego-char--" + h.cat;
      chip.textContent = h.hex;
      chip.title = h.name + "  @" + h.index;
      list.appendChild(chip);
    }
    el.appendChild(list);
    if (info.hidden.length > shown.length) {
      const more = document.createElement("p");
      more.className = "infocard__note";
      more.textContent = t("stego.moreChars", { n: String(info.hidden.length - shown.length) });
      el.appendChild(more);
    }
  }
}
