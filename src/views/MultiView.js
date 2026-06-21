/**
 * MultiView — 多内容识别视图。
 * 当剪贴板含多条独立内容时，逐条卡片陈列：每条有类型副标题 + 渲染 + 动作。
 */
import { ClipItem } from "../core/ClipboardItem.js";
import { ClassifierFactory } from "../core/ClassifierFactory.js";
import { renderActions } from "../actions/ActionEngine.js";
import { t } from "../i18n/i18n.js";

/**
 * @param {HTMLElement} root  stage
 * @param {object} opts
 * @param {string[]} opts.segments  分段后的文本数组
 * @param {string} opts.reason      分段判定说明
 * @param {Function} opts.onReset
 */
export async function renderMulti(root, { segments, reason, onReset }) {
  root.innerHTML = "";

  const result = document.createElement("section");
  result.className = "result";

  // 头部
  const header = document.createElement("div");
  header.className = "result__header";
  const h = document.createElement("h2");
  h.className = "result__title";
  h.textContent = t("view.splitTitle");
  const sub = document.createElement("p");
  sub.className = "result__subtitle";
  sub.textContent = t("view.answerPrefix") + t("view.multiDetected", { count: segments.length, reason });
  const reset = document.createElement("button");
  reset.className = "action-chip";
  reset.setAttribute("data-glass", "chip");
  reset.textContent = t("view.resetBtn");
  reset.addEventListener("click", () => onReset());
  header.append(reset, h, sub);
  result.appendChild(header);

  // 多条卡片
  const list = document.createElement("div");
  list.className = "multi";
  result.appendChild(list);
  root.appendChild(result);

  const enc = new TextEncoder();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const item = new ClipItem({ bytes: enc.encode(seg), mime: "text/plain", text: seg });
    const r = await ClassifierFactory.classify(item);

    const card = document.createElement("div");
    card.className = "multi__card card";
    card.setAttribute("data-glass", "panel");

    const idx = document.createElement("div");
    idx.className = "multi__idx";
    idx.textContent = `#${i + 1}`;

    const body = document.createElement("div");
    body.className = "multi__body";

    const tag = document.createElement("div");
    tag.className = "multi__tag";
    tag.textContent = t("view.answerPrefix") + (r ? r.subtitle : t("view.plainText"));
    body.appendChild(tag);

    const content = document.createElement("div");
    content.className = "multi__content render";
    if (r) {
      r.render(content);
    } else {
      const pre = document.createElement("pre");
      pre.className = "code";
      pre.textContent = seg;
      content.appendChild(pre);
    }
    body.appendChild(content);

    if (r) {
      const actions = document.createElement("div");
      actions.className = "actions__list multi__actions";
      body.appendChild(actions);
      await renderActions(actions, r.actionKey, r.tplVars || {});
    }

    card.append(idx, body);
    list.appendChild(card);
  }

  return { list };
}
