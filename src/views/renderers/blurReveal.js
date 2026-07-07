/**
 * blurReveal.js — 敏感内容遮罩（液态水纹）。
 *
 * 即便右侧已打码，底层文字 / Hex 字节仍是明文，故蒙一层缓缓扩散的水纹涟漪
 * （贴合 FairyGlass 液态玻璃质感）：随机点冒起同心圆环，柔和扩散后渐隐，
 * 若隐若现、低调优雅。交互：鼠标移上 / 键盘聚焦即透出明文，移开 / 失焦立即
 * 恢复水纹 —— 不做点击粘性。纯本地呈现，不涉及任何外发。
 *
 * 性能：所有活跃水纹层共用一条 rAF 主循环；元素一旦脱离 DOM 自动注销，
 * 揭示态暂停绘制省电。水纹是遮罩的核心视觉（功能性，非装饰），始终运行，
 * 不被 prefers-reduced-motion 关停；该偏好只在 CSS 层弱化 transition。
 */

// ---- 共享调度：一条 rAF 驱动所有活跃水纹层 ----
const veils = new Set();
let rafId = 0;

function tick() {
  for (const v of veils) v.draw();
  rafId = veils.size ? requestAnimationFrame(tick) : 0;
}
function activate(v) {
  veils.add(v);
  if (!rafId) rafId = requestAnimationFrame(tick);
}
function deactivate(v) {
  veils.delete(v);
}

/**
 * 造一个液态水纹 canvas，自带尺寸自适应与生命周期托管。
 * 视觉：随机位置冒起涟漪，缓慢扩散的细同心圆环 + 一层淡核高光，整体
 * 低透明度、慢节奏，营造「水面被轻触」的若隐若现感。
 * @param {string} cls  canvas 的 className
 * @returns {{ canvas: HTMLCanvasElement, pause(): void, resume(): void }}
 */
function makeRippleVeil(cls) {
  const canvas = document.createElement("canvas");
  canvas.className = cls;
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let ripples = [];
  let cw = 0, ch = 0;
  let paused = false;

  // 一道涟漪：在 (x,y) 冒起，age 0→1 期间半径从 0 扩到 maxR，透明度 sin 渐隐渐现。
  // staggered=true 时把 age 随机错开，避免初始所有涟漪同时冒起。
  const spawn = (w, h, staggered = false) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    age: staggered ? Math.random() : 0,
    grow: 0.0035 + Math.random() * 0.0045,  // age 推进（越小扩得越慢，约 4~7s 一轮）
    maxR: 16 + Math.random() * 30,          // 最大半径（px）
    width: 0.8 + Math.random() * 0.7,       // 环线宽（px）
    peak: 0.18 + Math.random() * 0.16,      // 透明度峰值，压低保持若隐若现
  });

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === cw && h === ch) return;
    cw = w; ch = h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    // 涟漪稀疏：按面积给少量并发，封顶低，保持优雅而非满屏
    const count = Math.min(14, Math.max(3, Math.floor(w * h * 0.0006)));
    ripples = Array.from({ length: count }, () => spawn(w, h, true));
  };

  const ro = new ResizeObserver(resize);

  // 缓动：先快后慢的扩散（ease-out），更像真实水波
  const easeOut = (t) => 1 - Math.pow(1 - t, 2.2);

  const inst = {
    canvas,
    draw() {
      if (!canvas.isConnected) { deactivate(inst); ro.disconnect(); return; }
      if (paused || !cw) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const rp of ripples) {
        rp.age += rp.grow;
        if (rp.age >= 1) { Object.assign(rp, spawn(cw, ch, false)); continue; }
        // 透明度：sin 生命曲线，冒起渐显、扩散末尾渐隐
        const a = Math.sin(rp.age * Math.PI) * rp.peak;
        if (a <= 0.008) continue;
        const r = easeOut(rp.age) * rp.maxR * dpr;
        if (r < 0.5) continue;
        const px = rp.x * dpr, py = rp.y * dpr;
        // 主环：细线同心圆，微蓝白
        ctx.globalAlpha = a;
        ctx.lineWidth = rp.width * dpr;
        ctx.strokeStyle = "#dbe8ff";
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
        // 内侧拖尾环：半径略小、更淡，增强水波层次
        const r2 = r * 0.62;
        if (r2 > 0.5) {
          ctx.globalAlpha = a * 0.5;
          ctx.beginPath();
          ctx.arc(px, py, r2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    pause() { paused = true; deactivate(inst); },
    resume() { paused = false; activate(inst); },
    // 显式注销：停转 + 断开 canvas 尺寸监听。用于宿主主动销毁（重渲染），
    // 不依赖 draw 循环里的 isConnected 兜底（若 canvas 从未进入 draw 循环则永不触发）。
    destroy() { deactivate(inst); ro.disconnect(); },
  };

  // 入 DOM 后量好尺寸再起转（rAF 内首帧 isConnected 已为真）
  requestAnimationFrame(() => {
    resize();
    ro.observe(canvas);
    activate(inst);
  });

  return inst;
}

/**
 * 把一段文本包进可揭示的噪点遮罩（inline）。
 * @param {string} text  要遮挡的（已打码的）文本
 * @returns {HTMLElement} 一个 inline 容器，挂进 infoCard 的 dd 即可
 */
export function blurReveal(text) {
  const wrap = document.createElement("span");
  wrap.className = "blur-reveal";
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "button");
  wrap.setAttribute("aria-label", "鼠标移上或聚焦查看被保护的内容");

  const content = document.createElement("span");
  content.className = "blur-reveal__text";
  content.textContent = text;

  const veil = makeRippleVeil("blur-reveal__veil");

  wrap.append(content, veil.canvas);

  // 纯悬停 / 聚焦揭示，移开 / 失焦立即恢复。揭示时暂停水纹省电。
  const reveal = () => { wrap.classList.add("is-revealed"); veil.pause(); };
  const hide = () => { wrap.classList.remove("is-revealed"); veil.resume(); };
  wrap.addEventListener("mouseenter", reveal);
  wrap.addEventListener("mouseleave", hide);
  wrap.addEventListener("focus", reveal);
  wrap.addEventListener("blur", hide);

  return wrap;
}

/**
 * 块级噪点覆盖层 —— 给整块区域（如 Hex「骨相」视图）蒙一层 TG spoiler 噪点。
 *
 * 与 blurReveal 同套揭示交互（悬停 / 聚焦透出，移开 / 失焦立即恢复），但本体是
 * 绝对定位的覆盖层，盖在滚动容器之上而自身不随内容滚动 —— 由调用方挂进一个
 * position:relative 的祖先（这里是 .pane--hex）。这样揭示后滚动 Hex 不会让遮罩错位。
 *
 * 关键：遮罩自身 **始终 `pointer-events:none`**（纯视觉层），绝不拦截指针 ——
 * 否则会吃掉底层 Hex 的滚动与字节 hover 联动（曾因此导致 Hex 完全无法交互）。
 * hover 检测改挂到外部 host（`.pane--hex`）上：移上 host → 遮罩淡出露出 Hex，
 * 移开 → 恢复。键盘可达性走一个独立的聚焦钮（tabIndex 不受 pointer-events 影响）。
 *
 * @param {object} [opts]
 * @param {string} [opts.hint]  覆盖层上的居中提示文案
 * @param {HTMLElement} [opts.host]  绑定 hover 的宿主（通常是 .pane--hex）
 * @returns {{ el: HTMLElement, destroy(): void }} 覆盖层元素 + 注销句柄。
 *   destroy 一次性摘掉挂在 host 上的 4 个监听器（AbortController）并停转水纹。
 *   host 上的监听器不会随 mask.remove() 自动清除，必须显式注销，否则宿主
 *   （leftPane）虽被 innerHTML="" 剥离，其监听器闭包 + veil 的 ResizeObserver
 *   仍持有 canvas 引用 → 视图无法回收（M2 泄漏根因）。
 */
export function frostOverlay({ hint, host } = {}) {
  const mask = document.createElement("div");
  mask.className = "hex-mask";
  mask.setAttribute("aria-hidden", "true"); // 纯视觉，无障碍走 host 上的钮

  const veil = makeRippleVeil("hex-mask__veil");
  mask.appendChild(veil.canvas);

  if (hint) {
    const label = document.createElement("span");
    label.className = "hex-mask__hint";
    label.textContent = hint;
    mask.appendChild(label);
  }

  const reveal = () => { mask.classList.add("is-revealed"); veil.pause(); };
  const hide = () => { mask.classList.remove("is-revealed"); veil.resume(); };

  // hover / 聚焦检测挂在 host 上（遮罩本身不吃事件）。host 进入即揭示，
  // 离开即恢复；host 内的 Hex 滚动、字节联动一切照常。
  // 监听器统一挂到 AbortController.signal，destroy 时一次性摘除。
  const ac = new AbortController();
  if (host) {
    const o = { signal: ac.signal };
    host.addEventListener("mouseenter", reveal, o);
    host.addEventListener("mouseleave", hide, o);
    host.addEventListener("focusin", reveal, o);
    host.addEventListener("focusout", hide, o);
  }

  return {
    el: mask,
    destroy() {
      ac.abort();       // 摘 host 上 4 个监听器
      veil.destroy();   // 停转水纹 + 断开 canvas 尺寸监听
      mask.remove();
    },
  };
}
