/**
 * mediaLab.js — 「识别之后能干什么」的本地媒体工坊（零外发）。
 *
 * 两个入口，都把 UI 渲染进给定容器，全程用 canvas 在浏览器内存里处理，
 * 字节不出本机：
 *   openImageLab(box, bytes, mime, srcName)  图片工坊：转格式 / 压缩 / 缩放 / 旋转翻转
 *   openVideoFrameLab(box, bytes, mime)      视频抽帧：拖到某帧，存成 PNG/JPEG
 *
 * 契合隐私铁律：识别只是上半场，这里的加工也绝不上传。
 */
import { processImage, IMAGE_FORMATS } from "../core/imageTools.js";
import { t } from "../i18n/i18n.js";

function fmtBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** 触发浏览器下载一个 Blob。 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 去掉文件名扩展名，拿不到就给个兜底。 */
function baseName(name, fallback) {
  if (!name) return fallback;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * 图片工坊。把控制面板 + 实时预览渲染进 box。
 * @param {HTMLElement} box   结果容器（会被清空）
 * @param {Uint8Array} bytes  原始图片字节
 * @param {string} mime       原始 MIME
 * @param {string} [srcName]  原文件名（用于导出命名）
 */
export function openImageLab(box, bytes, mime, srcName) {
  box.innerHTML = "";
  const wrap = el("div", "medialab");

  const title = el("div", "decode-result__title", t("mediaLab.imageTitle"));
  wrap.appendChild(title);

  // —— 状态 ——
  const state = { format: "png", quality: 0.85, maxDim: 0, rotate: 0, flipH: false, flipV: false };

  // —— 预览 ——
  const preview = el("img", "medialab__preview");
  const info = el("div", "medialab__info");
  wrap.append(preview, info);

  // —— 控制区 ——
  const controls = el("div", "medialab__controls");

  // 格式
  const fmtRow = el("div", "medialab__row");
  fmtRow.appendChild(el("label", "medialab__label", t("mediaLab.format")));
  const fmtSel = el("select", "medialab__select");
  for (const f of IMAGE_FORMATS) {
    const o = el("option", null, f.toUpperCase());
    o.value = f;
    fmtSel.appendChild(o);
  }
  fmtSel.value = state.format;
  fmtRow.appendChild(fmtSel);
  controls.appendChild(fmtRow);

  // 质量（仅有损格式）
  const qRow = el("div", "medialab__row");
  const qLabel = el("label", "medialab__label", t("mediaLab.quality"));
  const qVal = el("span", "medialab__qval", "85%");
  const qInput = el("input", "medialab__slider");
  qInput.type = "range";
  qInput.min = "10";
  qInput.max = "100";
  qInput.step = "1";
  qInput.value = "85";
  qRow.append(qLabel, qInput, qVal);
  controls.appendChild(qRow);

  // 缩放：最长边预设
  const sRow = el("div", "medialab__row");
  sRow.appendChild(el("label", "medialab__label", t("mediaLab.maxDim")));
  const sizeGroup = el("div", "medialab__btngroup");
  const SIZES = [
    { v: 0, k: "mediaLab.original" },
    { v: 1920, label: "1920" },
    { v: 1280, label: "1280" },
    { v: 800, label: "800" },
  ];
  const sizeBtns = [];
  for (const s of SIZES) {
    const b = el("button", "medialab__toggle", s.k ? t(s.k) : s.label);
    b.type = "button";
    b.dataset.v = String(s.v);
    if (s.v === state.maxDim) b.classList.add("active");
    b.addEventListener("click", () => {
      state.maxDim = s.v;
      sizeBtns.forEach((x) => x.classList.toggle("active", x === b));
      schedule();
    });
    sizeBtns.push(b);
    sizeGroup.appendChild(b);
  }
  sRow.appendChild(sizeGroup);
  controls.appendChild(sRow);

  // 旋转 / 翻转
  const tRow = el("div", "medialab__row");
  tRow.appendChild(el("label", "medialab__label", t("mediaLab.transform")));
  const tGroup = el("div", "medialab__btngroup");
  const rotL = el("button", "medialab__toggle", "↺");
  const rotR = el("button", "medialab__toggle", "↻");
  const flipH = el("button", "medialab__toggle", t("mediaLab.flipH"));
  const flipV = el("button", "medialab__toggle", t("mediaLab.flipV"));
  [rotL, rotR, flipH, flipV].forEach((b) => (b.type = "button"));
  rotL.title = t("mediaLab.rotateLeft");
  rotR.title = t("mediaLab.rotateRight");
  rotL.addEventListener("click", () => { state.rotate = (state.rotate + 270) % 360; schedule(); });
  rotR.addEventListener("click", () => { state.rotate = (state.rotate + 90) % 360; schedule(); });
  flipH.addEventListener("click", () => { state.flipH = !state.flipH; flipH.classList.toggle("active", state.flipH); schedule(); });
  flipV.addEventListener("click", () => { state.flipV = !state.flipV; flipV.classList.toggle("active", state.flipV); schedule(); });
  tGroup.append(rotL, rotR, flipH, flipV);
  tRow.appendChild(tGroup);
  controls.appendChild(tRow);

  wrap.appendChild(controls);

  // 下载
  const dlBtn = el("button", "action-chip medialab__download", t("mediaLab.download"));
  dlBtn.type = "button";
  dlBtn.setAttribute("data-glass", "chip");
  wrap.appendChild(dlBtn);

  box.appendChild(wrap);

  // —— 逻辑 ——
  const origSize = bytes.byteLength ?? bytes.length;
  let lastBlob = null;
  let lastUrl = null;
  let timer = null;

  function syncQualityVisibility() {
    const lossy = state.format === "jpeg" || state.format === "webp";
    qRow.style.display = lossy ? "" : "none";
  }

  async function recompute() {
    info.textContent = t("mediaLab.processing");
    try {
      const r = await processImage(bytes, mime, {
        format: state.format,
        quality: state.quality,
        maxDim: state.maxDim,
        rotate: state.rotate,
        flipH: state.flipH,
        flipV: state.flipV,
      });
      lastBlob = r.blob;
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(r.blob);
      preview.src = lastUrl;
      const delta = origSize ? Math.round((1 - r.blob.size / origSize) * 100) : 0;
      const deltaStr = delta > 0
        ? t("mediaLab.smaller", { pct: delta })
        : delta < 0
          ? t("mediaLab.larger", { pct: -delta })
          : t("mediaLab.same");
      info.textContent = `${r.width} × ${r.height} · ${fmtBytes(r.blob.size)} (${t("mediaLab.was", { size: fmtBytes(origSize) })}, ${deltaStr})`;
    } catch (e) {
      info.textContent = t("mediaLab.failed") + (e?.message || "");
      lastBlob = null;
    }
  }

  function schedule() {
    syncQualityVisibility();
    clearTimeout(timer);
    timer = setTimeout(recompute, 220);
  }

  fmtSel.addEventListener("change", () => { state.format = fmtSel.value; schedule(); });
  qInput.addEventListener("input", () => {
    state.quality = Number(qInput.value) / 100;
    qVal.textContent = qInput.value + "%";
    schedule();
  });

  dlBtn.addEventListener("click", () => {
    if (!lastBlob) return;
    downloadBlob(lastBlob, `${baseName(srcName, "image")}.${state.format === "jpeg" ? "jpg" : state.format}`);
  });

  syncQualityVisibility();
  recompute();
}

/**
 * 视频抽帧工坊。内嵌可拖动的 <video>，拖到想要的一帧，存成图片。
 * @param {HTMLElement} box   结果容器（会被清空）
 * @param {Uint8Array} bytes  原始视频字节
 * @param {string} mime       原始 MIME（如 video/mp4）
 */
export function openVideoFrameLab(box, bytes, mime) {
  box.innerHTML = "";
  const wrap = el("div", "medialab");
  wrap.appendChild(el("div", "decode-result__title", t("mediaLab.frameTitle")));
  wrap.appendChild(el("p", "media-hint", t("mediaLab.videoHint")));

  const blob = new Blob([bytes], { type: mime || "video/mp4" });
  const url = URL.createObjectURL(blob);
  const video = el("video", "medialab__video");
  video.src = url;
  video.controls = true;
  video.preload = "metadata";
  video.crossOrigin = "anonymous";
  wrap.appendChild(video);

  const controls = el("div", "medialab__row");
  const fmtSel = el("select", "medialab__select");
  for (const f of ["png", "jpeg"]) {
    const o = el("option", null, f.toUpperCase());
    o.value = f;
    fmtSel.appendChild(o);
  }
  const grabBtn = el("button", "action-chip", t("mediaLab.grabFrame"));
  grabBtn.type = "button";
  grabBtn.setAttribute("data-glass", "chip");
  controls.append(fmtSel, grabBtn);
  wrap.appendChild(controls);

  const info = el("div", "medialab__info");
  wrap.appendChild(info);

  box.appendChild(wrap);

  grabBtn.addEventListener("click", () => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) { info.textContent = t("mediaLab.frameNotReady"); return; }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    try {
      canvas.getContext("2d").drawImage(video, 0, 0, w, h);
      const fmt = fmtSel.value;
      canvas.toBlob(
        (b) => {
          if (!b) { info.textContent = t("mediaLab.failed"); return; }
          const ts = Math.round(video.currentTime * 1000);
          downloadBlob(b, `frame_${ts}ms.${fmt === "jpeg" ? "jpg" : "png"}`);
          info.textContent = `${w} × ${h} · ${fmtBytes(b.size)}`;
        },
        fmt === "jpeg" ? "image/jpeg" : "image/png",
        fmt === "jpeg" ? 0.92 : undefined,
      );
    } catch {
      // 少数带 DRM/跨源的视频会污染 canvas，toBlob 抛错
      info.textContent = t("mediaLab.frameTainted");
    }
  });
}
