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
import { t } from "../../i18n/i18n.js";

const URL_RE = /^https?:\/\/[^\s]+$/i;

export class TextClassifier extends BaseClassifier {
  static priority = 10;

  match(item) {
    return item.isText;
  }

  async parse(item) {
    const text = item.text.trim();

    // 1. URL
    if (URL_RE.test(text)) {
      return {
        actionKey: "text_url",
        subtitle: t("cls.url"),
        tplVars: { url: text },
        render: (el) => {
          const a = document.createElement("a");
          a.href = text;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = text;
          el.appendChild(a);
        },
      };
    }

    // 2. 敏感信息（只标类型 + 打码，不显明文）
    const sensitive = scanSensitive(text);
    if (sensitive.length) {
      return {
        actionKey: "text_sensitive",
        subtitle: t("cls.sensitive"),
        tplVars: {},
        render: (el) => {
          el.appendChild(
            buildInfoCard(
              sensitive.map((s) => [
                t(s.type) + (s.count > 1 ? ` ×${s.count}` : ""),
                s.masked,
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
