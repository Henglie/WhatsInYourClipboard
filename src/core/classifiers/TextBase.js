/**
 * TextBase — 文本类分类器。
 * 覆盖：URL、敏感信息（打码）、JSON（美化高亮）、代码（高亮）、
 *       短文本（验证码巨大化）、纯文本（兜底）。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { scanSensitive } from "../sensitive.js";
import {
  isJSON,
  renderJSON,
  looksLikeCode,
  renderCode,
} from "../../views/renderers/highlight.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { blurReveal } from "../../views/renderers/blurReveal.js";
import { extractUrl, stripLabel } from "../normalize.js";
import { t } from "../../i18n/i18n.js";

export class TextClassifier extends BaseClassifier {
  static priority = 10;

  match(item) {
    return item.isText;
  }

  async parse(item) {
    const text = item.text.trim();

    // 1. URL —— 容忍「链接：https://… 。」这类标签前缀与尾部句读：
    //    先剥字段标签，再抽取首个 URL；若剥掉该 URL 后只剩零星标点/空白，
    //    判定整串本质就是个链接（而非一段夹了链接的正文）。
    const labelStripped = stripLabel(text);
    const ex = extractUrl(labelStripped);
    if (ex) {
      const remainder = labelStripped.replace(ex.url, "").replace(/[\s　.,;!?。，、；！？)）」】]/g, "");
      if (remainder === "") {
        return {
          actionKey: "text_url",
          subtitle: t("cls.url"),
          tplVars: { url: ex.url },
          render: (el) => {
            const a = document.createElement("a");
            a.href = ex.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = ex.url;
            el.appendChild(a);
          },
        };
      }
    }

    // 2. 敏感信息（只标类型 + 打码，不显明文）
    const sensitive = scanSensitive(text);
    if (sensitive.length) {
      return {
        actionKey: "text_sensitive",
        subtitle: t("cls.sensitive"),
        tplVars: {},
        // 信号：内容敏感。SplitView 据此给左侧 Hex「骨相」整块蒙磨砂，
        // 否则右侧打了码、左侧 Hex 把原始字节全摊开 = 明文泄露。
        sensitive: true,
        render: (el) => {
          el.appendChild(
            buildInfoCard(
              sensitive.map((s) => [
                t(s.type) + (s.count > 1 ? ` ×${s.count}` : ""),
                // 打码值再覆一层模糊玻璃：点击解除、移开恢复，避免旁人扫到
                blurReveal(s.masked),
              ]),
              {
                title: t("cardTitle.sensitive"),
                note: t("cardNote.sensitive"),
              }
            )
          );
        },
      };
    }

    // 3. JSON
    if (isJSON(text)) {
      return {
        actionKey: "text_json",
        subtitle: t("cls.json"),
        tplVars: { text },
        render: (el) => {
          el.appendChild(renderJSON(text));
        },
      };
    }

    // 4. 代码
    if (looksLikeCode(text)) {
      return {
        actionKey: "text_code",
        subtitle: t("cls.code"),
        tplVars: { text },
        render: (el) => {
          el.appendChild(renderCode(text));
        },
      };
    }

    // 5. 短文本（疑似验证码）
    if (text.length <= 8 && /^[a-z0-9]+$/i.test(text)) {
      return {
        actionKey: "text_short",
        subtitle: t("cls.shortText"),
        tplVars: { text },
        render: (el) => {
          const div = document.createElement("div");
          div.className = "bigtext";
          div.textContent = text;
          el.appendChild(div);
        },
      };
    }

    // 6. 兜底纯文本
    return {
      actionKey: "text_plain",
      subtitle: t("cls.plain"),
      tplVars: { text, raw: text },
      render: (el) => {
        const pre = document.createElement("pre");
        pre.textContent = item.text;
        el.appendChild(pre);
      },
    };
  }
}
