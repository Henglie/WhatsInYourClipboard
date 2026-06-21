/**
 * liquidGlass.js — 液态玻璃折射效果（全浏览器统一）。
 *
 * 原理（区别于普通毛玻璃）：
 *   普通毛玻璃 = backdrop-filter: blur，把背景模糊掉。
 *   液态玻璃   = 用一张「位移贴图」描述每个像素的折射方向，
 *                通过 SVG <feDisplacementMap> 让玻璃边缘把背后的光斑
 *                真实弯曲/放大，几乎不靠模糊。
 *
 * 跨浏览器关键（本版核心）：
 *   折射走 `filter: url()` 而非 `backdrop-filter: url()`。
 *   - backdrop-filter:url() 折射「元素背后已渲染的像素」→ 仅 Chromium 支持，
 *     Firefox 永远没折射。
 *   - filter:url() 作用于「元素自身内容」→ 所有引擎都支持 feDisplacementMap。
 *   做法：给玻璃元素注入一个 .lg-refract 子层，该层用 background-attachment:fixed
 *   画一份与页面背景（body::before / --glow-field）按视口对齐的【拷贝】，再对这层
 *   施加位移图。于是「透过玻璃看到的光斑」与真实背景严丝合缝，仅边缘被弯曲 →
 *   Firefox / Chrome / Edge / 国产魔改内核跑的是同一份代码，像素级一致。
 *
 * 位移贴图编码（color-interpolation-filters=sRGB 下）：
 *   R 通道 = X 位移，G 通道 = Y 位移，128 = 不位移（中性）。
 *   仅在距边缘 bezel 像素内的「斜面带」编码向量，中心保持 128 通透。
 *
 * 取舍：折射的是页面背景的拷贝，而非紧贴玻璃之后的任意内容（如重叠的卡片）。
 *       本应用玻璃浮于背景之上，视觉等价；换来的是全引擎一致 + 不卡。
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";
let _host = null;
let _uid = 0;

/** 创建/复用承载所有 SVG 滤镜的隐藏容器 */
function ensureHost() {
  if (_host) return _host;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, {
    position: "absolute",
    width: "0",
    height: "0",
    overflow: "hidden",
    pointerEvents: "none",
  });
  document.body.appendChild(svg);
  _host = svg;
  return svg;
}

/** 圆角矩形有符号距离场：内部为负，外部为正，边缘为 0 */
function sdRoundRect(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * 生成位移贴图 data URL。
 * 画布比元素大一圈（四周各留 bleed 边距）：折射层同样外扩 bleed 并被宿主圆角裁切，
 * 于是边缘往外位移时采样到的是真实光斑（来自 bleed 边距），而非层外空白 →
 * 消除「内圈黑边」。元素形状在画布中居中（偏移 bleed）。
 * @param {number} w 元素像素宽
 * @param {number} h 元素像素高
 * @param {number} radius 圆角
 * @param {number} bezel 斜面带宽度（折射作用区）
 * @param {number} bleed 四周外扩量（像素）
 */
function buildDisplacementMap(w, h, radius, bezel, bleed) {
  const cw = w + bleed * 2;
  const ch = h + bleed * 2;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(cw, ch);
  const data = img.data;
  const eps = 1;
  // 形状在画布中居中：坐标减 bleed 再喂给以 w×h 为界的 SDF
  const sd = (px, py) => sdRoundRect(px - bleed, py - bleed, w, h, radius);

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      const dist = -sd(x, y); // 距边缘的内部深度
      let r = 128;
      let g = 128;

      if (dist >= 0 && dist < bezel) {
        // SDF 梯度 = 边缘外法线方向
        const gx = sd(x + eps, y) - sd(x - eps, y);
        const gy = sd(x, y + eps) - sd(x, y - eps);
        const len = Math.hypot(gx, gy) || 1;
        const nx = gx / len;
        const ny = gy / len;

        // 斜面折射强度：贴边最强，向内衰减到 0（凸面玻璃轮廓）
        const t = dist / bezel; // 0=边缘 1=斜面内沿
        const mag = Math.pow(1 - t, 1.6);

        r = 128 + nx * mag * 127;
        g = 128 + ny * mag * 127;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/**
 * 给元素应用液态玻璃折射。
 * @param {HTMLElement} el
 * @param {object} [opts]
 * @param {number} [opts.radius]  圆角（默认读元素 border-radius）
 * @param {number} [opts.bezel]   斜面带宽度，越大折射区越宽
 * @param {number} [opts.scale]   折射强度（位移像素），越大弯曲越猛
 * @param {number} [opts.blur]    轻微模糊，液态玻璃应很小
 * @param {number} [opts.dispersion] 色散强度（边缘彩虹镶边），0=关闭
 */
export function applyLiquidGlass(el, opts = {}) {
  const { bezel = 18, scale = 64, blur = 1.5, dispersion = 2.2 } = opts;
  ensureHost();

  const id = `lg-${_uid++}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  // 滤镜区域留足余量，避免边缘被裁
  filter.setAttribute("x", "-20%");
  filter.setAttribute("y", "-20%");
  filter.setAttribute("width", "140%");
  filter.setAttribute("height", "140%");

  const feImage = document.createElementNS(SVG_NS, "feImage");
  feImage.setAttribute("result", "map");
  feImage.setAttribute("preserveAspectRatio", "none");
  filter.appendChild(feImage);

  // —— 色散：RGB 三通道按不同强度折射 ——
  // 物理上短波（蓝）折射率更高、弯曲更多；长波（红）最少。
  // 三次位移 → 各取一个通道 → 相加重组，边缘便透出极淡彩虹镶边。
  const mkDisp = (sc, result) => {
    const d = document.createElementNS(SVG_NS, "feDisplacementMap");
    d.setAttribute("in", "SourceGraphic");
    d.setAttribute("in2", "map");
    d.setAttribute("xChannelSelector", "R");
    d.setAttribute("yChannelSelector", "G");
    d.setAttribute("scale", String(sc));
    d.setAttribute("result", result);
    return d;
  };
  // 仅保留单一通道，alpha 一律设为 1。
  // 注意：SVG 滤镜用预乘 alpha，若让 alpha=0 则该通道颜色会被乘没，
  // 故三通道都保留 alpha=1，再用 screen 混合重组（绕开预乘陷阱）。
  const mkPick = (input, keep, result) => {
    const m = document.createElementNS(SVG_NS, "feColorMatrix");
    m.setAttribute("in", input);
    m.setAttribute("type", "matrix");
    const r = keep === "R" ? 1 : 0;
    const g = keep === "G" ? 1 : 0;
    const b = keep === "B" ? 1 : 0;
    m.setAttribute(
      "values",
      `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`
    );
    m.setAttribute("result", result);
    return m;
  };
  // screen 混合：通道不重叠时等价于相加，且 alpha 恒为 1
  const mkScreen = (a, b, result) => {
    const c = document.createElementNS(SVG_NS, "feBlend");
    c.setAttribute("in", a);
    c.setAttribute("in2", b);
    c.setAttribute("mode", "screen");
    c.setAttribute("result", result);
    return c;
  };

  if (dispersion > 0) {
    filter.append(
      mkDisp(scale + dispersion, "dR"), // 红：折射偏移量 +
      mkDisp(scale, "dG"),
      mkDisp(scale - dispersion, "dB"), // 蓝：折射偏移量 -
      mkPick("dR", "R", "pR"),
      mkPick("dG", "G", "pG"),
      mkPick("dB", "B", "pB"),
      mkScreen("pR", "pG", "rg"),
      mkScreen("rg", "pB", "out")
    );
  } else {
    filter.appendChild(mkDisp(scale, "out"));
  }
  _host.appendChild(filter);

  // 折射子层：承载背景拷贝，filter 施加于它（而非元素的 backdrop）
  let layer = el.querySelector(":scope > .lg-refract");
  if (!layer) {
    layer = document.createElement("span");
    layer.className = "lg-refract";
    el.insertBefore(layer, el.firstChild);
  }
  // 元素需有定位上下文，子层 inset 才贴合；lg-host 提供 overflow:hidden 按圆角裁掉外扩
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.classList.add("lg-host");

  const update = () => {
    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 2 || h < 2) return;

    // 圆角：优先用元素实际 border-radius
    const cssR = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18;
    const radius = Math.min(opts.radius ?? cssR, w / 2, h / 2);
    const bz = Math.min(bezel, w / 2, h / 2);
    // bleed：足够容纳最大位移(≈scale/2)与模糊外溢，留余量。折射层与位移图同步外扩这么多，
    // 宿主 overflow:hidden 再按圆角裁回 → 边缘有真实光斑可采，无黑边。
    const bleed = Math.ceil(scale / 2 + blur + 4);

    const url = buildDisplacementMap(w, h, radius, bz, bleed);
    feImage.setAttribute("href", url);
    feImage.setAttributeNS(XLINK, "href", url);
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    feImage.setAttribute("width", String(w + bleed * 2));
    feImage.setAttribute("height", String(h + bleed * 2));

    // 折射层外扩 bleed（负 inset），background-attachment:fixed 仍按视口对齐
    layer.style.inset = `-${bleed}px`;
    // filter:url() 全引擎通用；轻模糊给磨砂、高饱和提色、位移图弯曲边缘光斑
    layer.style.filter = `blur(${blur}px) saturate(180%) url(#${id})`;
  };

  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return {
    update,
    destroy: () => {
      ro.disconnect();
      filter.remove();
      layer.remove();
      el.classList.remove("lg-host");
    },
  };
}

/** 是否支持 SVG 滤镜作为 filter（所有现代引擎，含 Firefox） */
export function supportsLiquidGlass() {
  return CSS.supports("filter", "url(#x)");
}

/** 扫描带 data-glass 的元素批量应用（幂等：已处理的元素跳过） */
export function hydrateGlass(root = document, opts = {}) {
  if (!supportsLiquidGlass()) return; // 极老浏览器降级：保留 theme.css 毛玻璃
  root.querySelectorAll("[data-glass]").forEach((el) => {
    if (el.dataset.lgInit === "1") return; // 已注入折射层，避免重复
    const preset = el.getAttribute("data-glass");
    // 贴视口边缘的长条（顶/底栏）跳过折射：background-attachment:fixed 的光斑图只在
    // 视口内，贴边那侧会采到视口外的纯深色 → 黑边。这类元素保留 theme.css 的
    // backdrop 磨砂（Firefox 同样支持），全宽长条上透镜折射本就几乎不可见，视觉仍统一。
    if (preset === "bar") {
      el.dataset.lgInit = "skip";
      return;
    }
    // 滚动容器跳过：inset 的折射层会随内容滚走且引发重绘。
    const ov = getComputedStyle(el).overflowY;
    if (ov === "auto" || ov === "scroll") {
      el.dataset.lgInit = "skip";
      return;
    }
    el.dataset.lgInit = "1";
    const presetOpts =
      preset === "button"
        ? { bezel: 22, scale: 72, dispersion: 3 }
        : preset === "chip"
        ? { bezel: 12, scale: 44, blur: 1, dispersion: 1.6 }
        : { bezel: 18, scale: 60, dispersion: 2.4 };
    applyLiquidGlass(el, { ...presetOpts, ...opts });
  });
}
