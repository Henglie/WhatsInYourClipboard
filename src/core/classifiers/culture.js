/**
 * culture.js — 文化与语言分类器。
 *   - 古诗词智能识别（结构分析 + 词牌/诗人提权，本地准确）
 *   - emoji 含义
 *   - 中文文本 → 权威站点查询按钮
 *   - 外语检测 + 翻译按钮（联网，点击触发）
 * 内容查询遵守隐私铁律：仅提供按钮，不自动外发。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { DataPack } from "../DataPack.js";
import { detectLang } from "../lang.js";
import { asPureUrl } from "../normalize.js";
import { analyzePoetry } from "../poetry.js";
import { t } from "../../i18n/i18n.js";

/** 词牌分类数据键（与 cipai.json 键名一致） */
const CIPAI_CATEGORIES = ["小令", "中调", "长调"];

/** 同步取数据上下文（词牌库 + 诗人库） */
function poetryCtx() {
  return {
    cipai: DataPack.getCached("cipai"),
    poets: DataPack.getCached("poets"),
  };
}

// ---------- 古诗词智能识别 ----------
export class PoetryClassifier extends BaseClassifier {
  static priority = 35;

  match(item) {
    if (!item.isText) return false;
    return analyzePoetry(item.text, poetryCtx()) !== null;
  }

  async parse(item) {
    const info = analyzePoetry(item.text, poetryCtx());
    const author = info.poetHit ? info.poetHit.name : "";
    return {
      actionKey: "culture_poetry",
      subtitle: t("cls.poetry", { form: info.form }),
      tplVars: {
        q: info.cipaiHit ? info.cipaiHit.name : info.verses[0],
        full: info.verses.join("，"),
        author,
      },
      render: (el) => {
        // 优雅逐句陈列
        const poem = document.createElement("div");
        poem.className = "poem";
        for (const v of info.verses) {
          const line = document.createElement("div");
          line.className = "poem__line";
          line.textContent = v;
          poem.appendChild(line);
        }
        el.appendChild(poem);

        const rows = [[t("cardRow.cultForm"), info.form]];
        if (info.cipaiHit) {
          rows.push([t("cardRow.cultCipai"), `${info.cipaiHit.name}（${info.cipaiHit.category}，${info.cipaiHit.count}字）`]);
        }
        if (info.poetHit) {
          rows.push([t("cardRow.cultSuspectedAuthor"), `${info.poetHit.name}（${info.poetHit.dynasty}）`]);
        }
        rows.push([t("cardRow.cultVerseCount"), `${info.verses.length} 句`]);
        if (info.rhymes.length) {
          rows.push([t("cardRow.cultRhyme"), info.rhymes.join(" / ")]);
        }
        rows.push([t("cardRow.cultBasis"), info.signals.join("、")]);

        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.poetry"),
            note: t("cardNote.poetry"),
          })
        );
      },
    };
  }
}

// ---------- 词牌名（单独一个词牌名，非整首） ----------
export class CipaiClassifier extends BaseClassifier {
  static priority = 53;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    if (t.length < 2 || t.length > 8) return false;
    const data = DataPack.getCached("cipai");
    if (!data) return false;
    return CIPAI_CATEGORIES.some((c) => data[c] && t in data[c]);
  }

  async parse(item) {
    const text = item.text.trim();
    const data = DataPack.getCached("cipai") || {};
    let count = "?", category = "?";
    for (const cat of CIPAI_CATEGORIES) {
      if (data[cat] && text in data[cat]) { count = data[cat][text]; category = cat; break; }
    }
    return {
      actionKey: "culture_cipai",
      subtitle: t("cls.cipai", { name: text }),
      tplVars: { q: text },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.cultCipaiName"), text],
              [t("cardRow.cultCipaiCategory"), category],
              [t("cardRow.cultCipaiCharCount"), count + t("cardRow.cultCharSuffix")],
            ],
            {
              title: t("cardTitle.cipai"),
              note: t("cardNote.cipai"),
            }
          )
        );
      },
    };
  }
}

// ---------- emoji 含义 ----------
export class EmojiClassifier extends BaseClassifier {
  static priority = 55;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    return (
      t.length > 0 &&
      t.length <= 16 &&
      /\p{Extended_Pictographic}/u.test(t) &&
      /^[\p{Extended_Pictographic}‍️\s]+$/u.test(t)
    );
  }

  async parse(item) {
    const text = item.text.trim();
    const codepoints = [...text]
      .filter((c) => /\p{Extended_Pictographic}/u.test(c))
      .map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase());
    return {
      actionKey: "culture_emoji",
      subtitle: t("cls.emoji"),
      tplVars: { q: encodeURIComponent(text) },
      render: (el) => {
        const big = document.createElement("div");
        big.className = "bigtext";
        big.textContent = text;
        el.appendChild(big);
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.cultEmoji"), text],
              [t("cardRow.cultCodepoint"), codepoints.join(" ")],
              [t("cardRow.cultCount"), `${codepoints.length} 个`],
            ],
            { title: t("cardTitle.emoji"), note: t("cardNote.emoji") }
          )
        );
      },
    };
  }
}

// ---------- 中文文本 → 权威查询入口（低优先级，纯文本之上） ----------
export class ChineseTextClassifier extends BaseClassifier {
  static priority = 11;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    if (t.length < 2 || t.length > 100) return false;
    // 主要由汉字组成
    const han = (t.match(/[一-鿿]/g) || []).length;
    return han / t.length > 0.6;
  }

  async parse(item) {
    const text = item.text.trim();
    return {
      actionKey: "culture_zh_query",
      subtitle: t("cls.chinese"),
      tplVars: { q: text },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.cultTextContent"), text.length > 30 ? text.slice(0, 30) + "…" : text],
              [t("cardRow.cultCharCount"), `${text.length} 字`],
            ],
            {
              title: t("cardTitle.chinese"),
              note: t("cardNote.chinese"),
            }
          )
        );
      },
    };
  }
}

// ---------- 外语检测 + 翻译 ----------
export class ForeignLangClassifier extends BaseClassifier {
  static priority = 12;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    if (t.length < 2 || t.length > 5000) return false;
    // 纯 URL 全是拉丁字母会被 detectLang 误判为「英语」，抢在 URL 识别（TextClassifier）
    // 前头。整串本质是链接时让路给 URL，不当外语处理。
    if (asPureUrl(t)) return false;
    return detectLang(t).isForeign;
  }

  async parse(item) {
    const text = item.text.trim();
    const { label } = detectLang(text);
    return {
      actionKey: "culture_translate",
      subtitle: t("cls.foreign", { label }),
      tplVars: { text },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.cultDetectedLang"), label],
              [t("cardRow.cultCharCount"), `${text.length}`],
            ],
            {
              title: t("cardTitle.foreign"),
              note: t("cardNote.foreign"),
            }
          )
        );
        const pre = document.createElement("pre");
        pre.className = "code";
        pre.textContent = text.length > 1000 ? text.slice(0, 1000) + "…" : text;
        el.appendChild(pre);
      },
    };
  }
}
