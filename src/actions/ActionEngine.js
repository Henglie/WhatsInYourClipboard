/**
 * ActionEngine — 「下一步你要…」动作引擎。
 * 读取 actions.json，按 actionKey 取出按钮配置，做模板插值后渲染。
 *
 * 按钮类型：
 *   link   — 跳转外链（{{var}} 经 encodeURIComponent 插值）
 *   copy   — 复制 template 到剪贴板（{{var}} 原样插值）
 *   decode — 本地解码（按 codec 解码 {{raw}}，就地显示结果，不联网不跳转）
 */
import { tryDecode, CODECS } from "../core/codec.js";
import { t } from "../i18n/i18n.js";

let _config = null;

async function loadConfig() {
  if (_config) return _config;
  const res = await fetch("src/actions/actions.json");
  _config = await res.json();
  return _config;
}

/** 模板插值。encode=true 时对值做 URL 编码（用于 link）。 */
function interpolate(tpl, vars, encode) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key] ?? "";
    return encode ? encodeURIComponent(v) : v;
  });
}

/**
 * 渲染动作按钮到容器。
 * @param {HTMLElement} listEl  .actions__list 容器
 * @param {string} actionKey
 * @param {object} tplVars      约定 raw 为原始文本，供 decode 使用
 */
export async function renderActions(listEl, actionKey, tplVars = {}) {
  const config = await loadConfig();
  const defs = config[actionKey] || [];
  listEl.innerHTML = "";

  // decode 结果显示区（位于按钮下方）
  let resultBox = null;
  const ensureResultBox = () => {
    if (resultBox) return resultBox;
    resultBox = document.createElement("div");
    resultBox.className = "decode-result";
    listEl.insertAdjacentElement("afterend", resultBox);
    return resultBox;
  };

  for (const def of defs) {
    if (def.type === "link") {
      const a = document.createElement("a");
      a.className = "action-chip";
      a.setAttribute("data-glass", "chip");
      a.href = interpolate(def.url, tplVars, true);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = t(def.labelKey);
      listEl.appendChild(a);
    } else if (def.type === "copy") {
      const btn = document.createElement("button");
      btn.className = "action-chip";
      btn.setAttribute("data-glass", "chip");
      btn.textContent = t(def.labelKey);
      const payload = interpolate(def.template, tplVars, false);
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(payload);
          const orig = btn.textContent;
          btn.textContent = t("action.copied");
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = orig;
            btn.classList.remove("copied");
          }, 1500);
        } catch {
          btn.textContent = t("action.copyFailed");
        }
      });
      listEl.appendChild(btn);
    } else if (def.type === "decode") {
      const btn = document.createElement("button");
      btn.className = "action-chip";
      btn.setAttribute("data-glass", "chip");
      const codecLabel = CODECS[def.codec] ? t(CODECS[def.codec].labelKey) : def.codec;
      btn.textContent = t(def.labelKey) || t("action.decodeWith", { codec: codecLabel });
      btn.addEventListener("click", () => {
        const raw = tplVars.raw ?? tplVars.text ?? "";
        const box = ensureResultBox();
        const r = tryDecode(def.codec, raw);
        box.innerHTML = "";
        const title = document.createElement("div");
        title.className = "decode-result__title";
        title.textContent = `${codecLabel} ${t("action.decodeResult")}`;
        const pre = document.createElement("pre");
        pre.className = "code";
        pre.textContent = r.ok ? r.result : `${t("action.decodeFailed")}${r.error}`;
        if (!r.ok) pre.classList.add("decode-result__error");
        box.append(title, pre);
        listEl.querySelectorAll(".action-chip").forEach((c) => c.classList.remove("copied"));
        btn.classList.add("copied");
      });
      listEl.appendChild(btn);
    }
  }

  if (defs.length === 0) {
    const empty = document.createElement("span");
    empty.style.color = "var(--fg-muted)";
    empty.textContent = t("action.empty");
    listEl.appendChild(empty);
  }
}
