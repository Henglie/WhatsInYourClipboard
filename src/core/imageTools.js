/**
 * imageTools.js — 纯本地图片处理（canvas，零外发）。
 *
 * 转格式（PNG / JPEG / WebP）、质量压缩、等比缩放、旋转 / 翻转。
 * 全程在浏览器内存里用 canvas 重绘 + 重编码，字节不出本机——
 * 契合项目「零外发」铁律：识别之后的加工也绝不上传。
 */

const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
export const IMAGE_FORMATS = ["png", "jpeg", "webp"];

/** 把字节解码成可绘制对象（优先 ImageBitmap，回退 <img>）。返回 { img, url }。 */
async function decodeToDrawable(bytes, mime) {
  const blob = new Blob([bytes], { type: mime || "image/png" });
  if (typeof createImageBitmap === "function") {
    try {
      return { img: await createImageBitmap(blob), url: null };
    } catch {
      /* 个别格式/浏览器 createImageBitmap 失败 → 回退 <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image decode failed"));
    el.src = url;
  });
  return { img, url };
}

function dimsOf(img) {
  return { w: img.width || img.naturalWidth, h: img.height || img.naturalHeight };
}

/**
 * 处理图片，返回 { blob, width, height, mime }。全部本地完成。
 * @param {Uint8Array} bytes 原始字节
 * @param {string} srcMime 原始 MIME
 * @param {object} opts
 *   format 'png'|'jpeg'|'webp'（默认 png）
 *   quality 0..1（jpeg/webp 有损质量，默认 0.85；png 忽略）
 *   maxDim  最长边像素上限，超过则等比缩小；0/空 = 不缩放
 *   rotate  0|90|180|270 顺时针旋转
 *   flipH / flipV 水平 / 垂直翻转
 */
export async function processImage(bytes, srcMime, opts = {}) {
  const {
    format = "png",
    quality = 0.85,
    maxDim = 0,
    rotate = 0,
    flipH = false,
    flipV = false,
  } = opts;

  const { img, url } = await decodeToDrawable(bytes, srcMime);
  try {
    const { w, h } = dimsOf(img);
    // 等比缩放
    let scale = 1;
    if (maxDim && Math.max(w, h) > maxDim) scale = maxDim / Math.max(w, h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));

    // 旋转 90/270 时画布宽高互换
    const rot = ((rotate % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? dh : dw;
    canvas.height = swap ? dw : dh;

    const cx = canvas.getContext("2d");
    cx.save();
    cx.translate(canvas.width / 2, canvas.height / 2);
    cx.rotate((rot * Math.PI) / 180);
    cx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    cx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    cx.restore();

    const outMime = MIME[format] || "image/png";
    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outMime, format === "png" ? undefined : quality),
    );
    if (!blob) throw new Error("encode failed");
    return { blob, width: canvas.width, height: canvas.height, mime: outMime };
  } finally {
    if (url) URL.revokeObjectURL(url);
    if (img.close) img.close(); // 释放 ImageBitmap
  }
}
