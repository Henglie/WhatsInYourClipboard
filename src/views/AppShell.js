/**
 * AppShell — 应用外壳框架。
 * 持久存在的顶栏 + 中央舞台 + 底部状态栏。
 * 着陆页 / 就绪态都渲染进 .stage，外壳不重建。
 *
 * i18n：本文件是国际化接入「样板」。所有 UI 文案走 t()，
 * 顶栏含语言切换钮（中/EN），切换后广播 i18n:change，main.js 重渲染。
 */
import { t, getLang, setLang } from "../i18n/i18n.js";

export function renderShell(root) {
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "shell";

  // ---------- 顶栏 ----------
  const topbar = document.createElement("header");
  topbar.className = "topbar";
  topbar.setAttribute("data-glass", "bar");
  topbar.innerHTML = `
    <div class="topbar__brand">
      <span class="topbar__logo">◧</span>
      <span class="topbar__name">${t("shell.brand")}</span>
    </div>
    <nav class="topbar__nav">
      <span class="badge badge--privacy">${t("shell.privacy")}</span>
      <button class="lang-toggle" data-role="lang" type="button"
        aria-label="${t("shell.langLabel")}" title="${t("shell.langLabel")}">
        <span class="lang-toggle__seg${getLang() === "zh" ? " is-on" : ""}">中</span>
        <span class="lang-toggle__seg${getLang() === "en" ? " is-on" : ""}">EN</span>
      </button>
    </nav>
  `;
  // 整条单击即切换（zh↔en），无需对准某一段；setLang 广播事件给 main.js 重渲染
  topbar.querySelector('[data-role="lang"]').addEventListener("click", () => {
    setLang(getLang() === "zh" ? "en" : "zh");
  });

  // ---------- 中央舞台 ----------
  const stage = document.createElement("main");
  stage.className = "stage";

  // ---------- 底部状态栏 ----------
  const statusbar = document.createElement("footer");
  statusbar.className = "statusbar";
  statusbar.setAttribute("data-glass", "bar");
  statusbar.innerHTML = `
    <span class="statusbar__item" data-role="state">${t("status.idle")}</span>
    <span class="statusbar__sep"></span>
    <span class="statusbar__item" data-role="type">—</span>
    <span class="statusbar__item statusbar__item--right" data-role="size"></span>
  `;

  shell.append(topbar, stage, statusbar);
  root.appendChild(shell);

  return {
    stage,
    /** 更新底部状态栏 */
    setStatus({ state, type, size } = {}) {
      if (state !== undefined) {
        statusbar.querySelector('[data-role="state"]').textContent = state;
      }
      if (type !== undefined) {
        statusbar.querySelector('[data-role="type"]').textContent = type;
      }
      if (size !== undefined) {
        statusbar.querySelector('[data-role="size"]').textContent = size;
      }
    },
  };
}
