/**
 * ActionEngine — 「下一步你要…」动作引擎。
 * 读取 actions.json，按 actionKey 取出按钮配置，做模板插值后渲染。
 *
 * 按钮类型：
 *   link     — 跳转外链（{{var}} 经 encodeURIComponent 插值）
 *   copy     — 复制 template 到剪贴板（{{var}} 原样插值）
 *   decode   — 本地解码（按 codec 解码 {{raw}}，就地显示结果，不联网不跳转）
 *   download — 把字节/文本存成文件（Blob + a.download）
 *   qr       — 纯本地二维码（renderQRCanvas，零依赖、不外发）
 *
 * 动作来源有两路并存：
 *   静态 — actions.json 里 actionKey 对应的固定数组。
 *   动态 — 分类器 parse() 回传的 result.dynamicActions（上下文感知，第三层）。
 *          与静态同构（{type, labelKey|label, url/template, ...}），url/template
 *          一般已是分类器算好的最终串（无需 {{}}）；也可含 {{}} 走 tplVars 插值。
 *          动态动作可用 label 字段直接给文案（站点名等非固定文案，无 i18n 键时）。
 */
import { tryDecode, CODECS } from "../core/codec.js";
import { renderVisibleText } from "../views/renderers/visibleText.js";
import { renderQRCanvas } from "../core/qrcode.js";
import { t } from "../i18n/i18n.js";

let _config = null;

async function loadConfig() {
  if (_config) return _config;
  const res = await fetch("src/actions/actions.json");
  _config = await res.json();
  return _config;
}

/** 模板插值。encode=true 时对值做 URL 编码（用于 link）。无 {{}} 则原样返回。 */
function interpolate(tpl, vars, encode) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key] ?? "";
    return encode ? encodeURIComponent(v) : v;
  });
}

/** 取按钮文案：优先 i18n 键，其次动态动作直给的 label。 */
function labelOf(def) {
  if (def.labelKey) return t(def.labelKey);
  return def.label || "";
}

/**
 * 动作分组（第四层）：按意图把动作归到四组，固定顺序「查证→转换→导出→复制」。
 * 顺序大致是「先探查、再变换、然后存下、最后复制」，复制最次要排末位。
 * 分组只决定视觉归类与折叠优先级，不改动作行为。
 */
const GROUPS = [
  { id: "verify", labelKey: "actionGroup.verify", types: ["link"] },
  { id: "transform", labelKey: "actionGroup.transform", types: ["decode"] },
  { id: "export", labelKey: "actionGroup.export", types: ["download", "qr"] },
  { id: "copy", labelKey: "actionGroup.copy", types: ["copy"] },
];
const TYPE_GROUP = (() => {
  const m = {};
  for (const g of GROUPS) for (const ty of g.types) m[ty] = g.id;
  return m;
})();
/** def 归属的组 id：显式 def.group 优先，否则按类型映射，兜底 copy。 */
function groupOf(def) {
  return def.group || TYPE_GROUP[def.type] || "copy";
}

/**
 * 渲染单个动作 def，返回创建的按钮/链接元素（由调用方放入对应分组容器）。
 * @param {object} def
 * @param {object} env  { listEl, tplVars, ctx, ensureResultBox }
 * @returns {HTMLElement|null}
 */
function renderDef(def, env) {
  const { listEl, tplVars, ctx, ensureResultBox } = env;
  // decode/qr 点击后，清掉其它按钮的 .copied 高亮（跨分组用 listEl 全量查）。
  const clearSiblings = () =>
    listEl.querySelectorAll(".action-chip").forEach((c) => c.classList.remove("copied"));

  if (def.type === "link") {
    const a = document.createElement("a");
    a.className = "action-chip action-chip--external";
    a.setAttribute("data-glass", "chip");
    a.href = interpolate(def.url, tplVars, true);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = labelOf(def);
    return a;
  } else if (def.type === "copy") {
    const btn = document.createElement("button");
    btn.className = "action-chip";
    btn.setAttribute("data-glass", "chip");
    btn.textContent = labelOf(def);
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
    return btn;
  } else if (def.type === "decode") {
    const btn = document.createElement("button");
    btn.className = "action-chip";
    btn.setAttribute("data-glass", "chip");
    const codecLabel = CODECS[def.codec] ? t(CODECS[def.codec].labelKey) : def.codec;
    btn.textContent = labelOf(def) || t("action.decodeWith", { codec: codecLabel });
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
      if (r.ok) {
        // 解码结果可能含 \0 等不可打印字符，渲染成可见字形而非被浏览器吞掉
        renderVisibleText(pre, String(r.result));
      } else {
        pre.textContent = `${t("action.decodeFailed")}${r.error}`;
        pre.classList.add("decode-result__error");
      }
      box.append(title, pre);
      clearSiblings();
      btn.classList.add("copied");
    });
    return btn;
  } else if (def.type === "download") {
    const btn = document.createElement("button");
    btn.className = "action-chip";
    btn.setAttribute("data-glass", "chip");
    btn.textContent = labelOf(def);
    btn.addEventListener("click", () => {
      let blob, fname;
      if (def.source === "bytes" && ctx.bytes) {
        blob = new Blob([ctx.bytes], { type: ctx.mime || "application/octet-stream" });
        fname = ctx.fileName || interpolate(def.filename || "file.bin", tplVars, false);
      } else {
        const text = interpolate(def.template || "{{text}}", tplVars, false);
        blob = new Blob([text], { type: def.mime || "text/plain;charset=utf-8" });
        fname = interpolate(def.filename || "clip.txt", tplVars, false);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return btn;
  } else if (def.type === "qr") {
    const btn = document.createElement("button");
    btn.className = "action-chip";
    btn.setAttribute("data-glass", "chip");
    btn.textContent = labelOf(def);
    btn.addEventListener("click", () => {
      const text = interpolate(def.template || "{{text}}", tplVars, false);
      const box = ensureResultBox();
      box.innerHTML = "";
      if (!text) return;
      const canvas = renderQRCanvas(text, { scale: 6, margin: 4 });
      canvas.className = "qr-canvas";
      const title = document.createElement("div");
      title.className = "decode-result__title";
      title.textContent = t("action.qrResult");
      box.append(title, canvas);
      clearSiblings();
      btn.classList.add("copied");
    });
    return btn;
  }
  return null;
}

/**
 * 渲染动作按钮到容器。
 *
 * 第四层分组：动作按意图归到「查证/转换/导出/复制」四组，组内保持原顺序。
 *  - 只有一组时平铺（不显小标题），多组时每组带小标题。
 *  - 外链（link）动作加 `--external` 视觉标记（离站，贴合「点击才出去」立场）。
 *  - 动作总数超阈值时，把靠后的组折进「更多」开关，默认收起，防一排按钮糊脸。
 *
 * @param {HTMLElement} listEl       .actions__list 容器
 * @param {string} actionKey
 * @param {object} tplVars           约定 raw 为原始文本，供 decode 使用
 * @param {object} ctx               { bytes, mime, fileName } 供 download source:"bytes" 用
 * @param {object[]} extraActions    分类器回传的上下文感知动态动作（接在静态动作之后）
 */
export async function renderActions(listEl, actionKey, tplVars = {}, ctx = {}, extraActions = []) {
  const config = await loadConfig();
  const defs = config[actionKey] || [];
  listEl.innerHTML = "";

  // decode/qr 结果显示区（位于按钮下方）
  let resultBox = null;
  const ensureResultBox = () => {
    if (resultBox) return resultBox;
    resultBox = document.createElement("div");
    resultBox.className = "decode-result";
    listEl.insertAdjacentElement("afterend", resultBox);
    return resultBox;
  };

  const env = { listEl, tplVars, ctx, ensureResultBox };
  const all = [...defs, ...(extraActions || [])];

  if (all.length === 0) {
    const empty = document.createElement("span");
    empty.style.color = "var(--fg-muted)";
    empty.textContent = t("action.empty");
    listEl.appendChild(empty);
    return;
  }

  // 按固定组序归类，组内保持原顺序；空组丢弃。
  const buckets = GROUPS.map((g) => ({ ...g, defs: [] }));
  const byId = Object.fromEntries(buckets.map((b) => [b.id, b]));
  for (const def of all) (byId[groupOf(def)] || byId.copy).defs.push(def);
  const groups = buckets.filter((b) => b.defs.length);

  const multiGroup = groups.length > 1;
  // 动作总数超阈值才折叠；保留前若干组常显，其余折进「更多」。
  const FOLD_THRESHOLD = 6;
  const VISIBLE_GROUPS = 2;
  const shouldFold = all.length > FOLD_THRESHOLD && groups.length > VISIBLE_GROUPS;

  // 渲染一个分组（含可选小标题）到指定父容器。
  const renderGroup = (group, parent) => {
    const wrap = document.createElement("div");
    wrap.className = "action-group";
    if (multiGroup) {
      const title = document.createElement("div");
      title.className = "action-group__title";
      title.textContent = t(group.labelKey);
      wrap.appendChild(title);
    }
    const row = document.createElement("div");
    row.className = "action-group__row";
    for (const def of group.defs) {
      const el = renderDef(def, env);
      if (el) row.appendChild(el);
    }
    wrap.appendChild(row);
    parent.appendChild(wrap);
  };

  const visible = shouldFold ? groups.slice(0, VISIBLE_GROUPS) : groups;
  const folded = shouldFold ? groups.slice(VISIBLE_GROUPS) : [];

  for (const g of visible) renderGroup(g, listEl);

  if (folded.length) {
    const moreCount = folded.reduce((n, g) => n + g.defs.length, 0);
    const toggle = document.createElement("button");
    toggle.className = "action-more-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = t("action.more", { count: moreCount });
    const moreWrap = document.createElement("div");
    moreWrap.className = "action-more";
    moreWrap.hidden = true;
    for (const g of folded) renderGroup(g, moreWrap);
    toggle.addEventListener("click", () => {
      const open = moreWrap.hidden;
      moreWrap.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? t("action.less") : t("action.more", { count: moreCount });
    });
    listEl.append(toggle, moreWrap);
  }
}
