/**
 * pasteSheet.js — 移动端粘贴弹框。
 *
 * 手机浏览器多数不支持 navigator.clipboard.read()（无按键、需用户手势且常被拒），
 * 桌面的 Ctrl+V / clipboard.read() 那套在手机上拿不到剪贴板。此弹框是移动端的
 * 兜底进路：弹出一个 textarea，提示用户「长按 → 粘贴」，再点「识别」走通用识别链路。
 * 不改动着陆页大 UI，仅在识别到移动端时按需弹出。
 *
 * @param {(text:string)=>void} onSubmit  用户提交文本后的回调（交给 ingestText）
 */
import { t } from "../i18n/i18n.js";
import { hydrateGlass } from "./liquidGlass.js";

let _overlay = null;

function build(onSubmit) {
  const overlay = document.createElement("div");
  overlay.className = "paste-sheet";
  overlay.innerHTML = `
    <div class="paste-sheet__panel" data-glass="card" role="dialog" aria-modal="true"
         aria-label="${t("mobile.sheetTitle")}">
      <h2 class="paste-sheet__title">${t("mobile.sheetTitle")}</h2>
      <p class="paste-sheet__hint">${t("mobile.sheetHint")}</p>
      <textarea class="paste-sheet__input" rows="4"
        placeholder="${t("mobile.placeholder")}"
        autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
      <div class="paste-sheet__actions">
        <button class="landing__trybtn landing__trybtn--ghost paste-sheet__cancel" type="button">${t("mobile.cancel")}</button>
        <button class="landing__trybtn landing__trybtn--primary paste-sheet__ok" type="button">${t("mobile.recognize")}</button>
      </div>
    </div>
  `;

  const ta = overlay.querySelector(".paste-sheet__input");
  const close = () => {
    overlay.classList.remove("is-open");
    setTimeout(() => overlay.remove(), 220);
    _overlay = null;
  };
  const submit = () => {
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    close();
    onSubmit(text);
  };

  overlay.querySelector(".paste-sheet__cancel").addEventListener("click", close);
  overlay.querySelector(".paste-sheet__ok").addEventListener("click", submit);
  // 点遮罩空白处关闭；点面板内部不关
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  // Esc 关闭
  overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  return { overlay, ta };
}

/** 打开移动端粘贴弹框。 */
export function openPasteSheet(onSubmit) {
  if (_overlay) return;
  const { overlay, ta } = build(onSubmit);
  document.body.appendChild(overlay);
  _overlay = overlay;
  hydrateGlass(overlay);
  // 触发进场动画 + 聚焦（延一帧，让 CSS 过渡生效）
  requestAnimationFrame(() => {
    overlay.classList.add("is-open");
    ta.focus();
  });
}
