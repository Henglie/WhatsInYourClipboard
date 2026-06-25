/**
 * SplitView — 就绪态视图。
 * 副标题 + 左右分栏（左 Hex / 右渲染）+ 底部动作区。
 * 返回各区域的句柄，交由 main 填充。
 */
import { renderHexView } from "./HexView.js";
import { frostOverlay } from "./renderers/blurReveal.js";
import { t } from "../i18n/i18n.js";

export function renderSplit(root, { subtitle, bytes, candidates = [], sensitive = false, onSwitch, onReset }) {
  root.innerHTML = "";

  const result = document.createElement("section");
  result.className = "result lg-fade";

  // 头部
  const header = document.createElement("div");
  header.className = "result__header";
  const h = document.createElement("h2");
  h.className = "result__title";
  h.textContent = t("view.splitTitle");
  const sub = document.createElement("p");
  sub.className = "result__subtitle";
  sub.textContent = t("view.answerPrefix") + subtitle;
  const reset = document.createElement("button");
  reset.className = "action-chip";
  reset.setAttribute("data-glass", "chip");
  reset.textContent = t("view.resetBtn");
  reset.addEventListener("click", () => onReset());
  header.append(reset, h, sub);

  // 多重解读候选切换条（>1 时显示）
  let candBar = null;
  if (candidates.length > 1) {
    candBar = document.createElement("div");
    candBar.className = "candidates";
    const lbl = document.createElement("span");
    lbl.className = "candidates__label";
    lbl.textContent = t("view.alsoCouldBe");
    candBar.appendChild(lbl);
    candidates.forEach((c, i) => {
      const chip = document.createElement("button");
      chip.className = "candidates__chip" + (i === 0 ? " is-active" : "");
      chip.textContent = c.result.subtitle;
      chip.addEventListener("click", () => {
        candBar.querySelectorAll(".candidates__chip").forEach((n) => n.classList.remove("is-active"));
        chip.classList.add("is-active");
        onSwitch && onSwitch(i);
      });
      candBar.appendChild(chip);
    });
  }

  // 分栏
  const split = document.createElement("div");
  split.className = "split lg-stagger";

  // 左：Hex（骨相）
  const leftPane = document.createElement("div");
  leftPane.className = "pane pane--hex";
  const leftLabel = document.createElement("div");
  leftLabel.className = "pane__label";
  leftLabel.textContent = t("view.bonePhase");
  const leftBody = document.createElement("div");
  leftBody.className = "pane__body card";
  leftBody.setAttribute("data-glass", "panel");
  leftPane.append(leftLabel, leftBody);
  // Hex 表格延迟到容器入 DOM 后渲染（需要 clientWidth）
  requestAnimationFrame(() => renderHexView(leftBody, bytes));

  // 敏感内容：右侧打了码，左侧 Hex 把原始字节全摊开 = 明文泄露。给整块
  // 「骨相」蒙一层无缝磨砂玻璃（点击解除、移开恢复），与右侧 blurReveal 一致。
  // 覆盖层挂在 leftPane（relative），盖住 leftBody（top:2rem 以下），本身不随内容滚动。
  // 切候选时可能从敏感↔不敏感，按需挂/摘覆盖层（句柄 setHexMask）。
  let hexMask = null;
  const setHexMask = (on) => {
    if (on && !hexMask) {
      hexMask = frostOverlay({ hint: t("view.hexMasked"), host: leftPane });
      leftPane.appendChild(hexMask);
    } else if (!on && hexMask) {
      hexMask.remove();
      hexMask = null;
    }
  };
  setHexMask(sensitive);

  // 右：渲染（皮相）
  const rightPane = document.createElement("div");
  rightPane.className = "pane pane--render";
  const rightLabel = document.createElement("div");
  rightLabel.className = "pane__label";
  rightLabel.textContent = t("view.skinPhase");
  const rightBody = document.createElement("div");
  rightBody.className = "pane__body card render";
  rightBody.setAttribute("data-glass", "panel");
  rightPane.append(rightLabel, rightBody);

  split.append(leftPane, rightPane);

  // 底部动作区
  const actions = document.createElement("div");
  actions.className = "actions";
  const actionsTitle = document.createElement("h3");
  actionsTitle.className = "actions__title";
  actionsTitle.textContent = t("view.nextAction");
  const actionsList = document.createElement("div");
  actionsList.className = "actions__list lg-stagger";
  actions.append(actionsTitle, actionsList);

  result.append(header);
  if (candBar) result.append(candBar);
  result.append(split, actions);
  root.appendChild(result);

  return {
    renderTarget: rightBody,
    actionsList,
    setSubtitle: (s) => { sub.textContent = t("view.answerPrefix") + s; },
    setHexMask,
  };
}
