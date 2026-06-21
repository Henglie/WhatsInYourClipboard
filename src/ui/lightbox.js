/**
 * lightbox.js — 图片双击放大查看。
 * 全屏遮罩 + 居中大图，点击遮罩 / Esc 关闭。单例复用。
 */

import { t } from "../i18n/i18n.js";

let _overlay = null;

function ensureOverlay() {
  if (_overlay) return _overlay;
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.innerHTML = `<img class="lightbox__img" alt="${t("lightbox.alt")}" />`;
  overlay.addEventListener("click", close);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  _overlay = overlay;
  return overlay;
}

function close() {
  if (_overlay) _overlay.classList.remove("is-open");
}

/** 打开放大查看 */
export function openLightbox(src) {
  const overlay = ensureOverlay();
  overlay.querySelector(".lightbox__img").src = src;
  overlay.classList.add("is-open");
}

/** 让一个 img 元素支持双击放大 */
export function enableZoom(img, src) {
  img.classList.add("zoomable");
  img.title = t("lightbox.title");
  img.addEventListener("dblclick", () => openLightbox(src));
}
