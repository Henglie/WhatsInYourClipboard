/**
 * HexView.js — OllyDbg 风格十六进制表格视图。
 *
 * 设计目标：
 *   - 不横向滚动：根据容器实际宽度动态计算每行字节数（8/16/24/32），
 *     正常看过去就是完整一行，只纵向滚动。
 *   - 三分区：偏移列 | 十六进制字节区 | ASCII 旁注区。
 *   - 字节 ↔ ASCII 悬停联动高亮（鼠标移到某字节，对应 ASCII 同步高亮）。
 */
import { t } from "../i18n/i18n.js";

const HEX = [];
for (let i = 0; i < 256; i++) HEX[i] = i.toString(16).padStart(2, "0");

/** 用 canvas 测量等宽字体单字符宽度 */
function measureCharWidth(el) {
  const cs = getComputedStyle(el);
  const canvas = measureCharWidth._c || (measureCharWidth._c = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText("0").width || 8;
}

/**
 * 根据可用宽度推算每行字节数（取 8 的倍数）。
 * 一行字符数 ≈ 8(偏移) + 2(分隔) + N*3(hex 含尾空格)
 *              + floor(N/8)(组间空格) + 2(分隔) + N(ascii)
 */
function bytesPerRow(availChars) {
  for (const n of [32, 24, 16, 8]) {
    const cols = 8 + 2 + n * 3 + Math.floor(n / 8) + 2 + n;
    if (cols <= availChars) return n;
  }
  return 8;
}

/**
 * 渲染 Hex 表格。
 * @param {HTMLElement} container  滚动容器（.pane__body）
 * @param {Uint8Array} bytes
 * @param {object} [opts]
 * @param {number} [opts.maxBytes]  最大渲染字节，避免超大数据卡死
 */
export function renderHexView(container, bytes, opts = {}) {
  const maxBytes = opts.maxBytes ?? 8192;
  const len = Math.min(bytes.length, maxBytes);

  const root = document.createElement("div");
  root.className = "hexview";
  container.appendChild(root);

  const layout = () => {
    const chW = measureCharWidth(root);
    const avail = Math.floor((container.clientWidth - 32) / chW);
    const perRow = bytesPerRow(Math.max(avail, 40));
    if (root.dataset.perRow === String(perRow)) return; // 无需重排
    root.dataset.perRow = String(perRow);
    draw(root, bytes, len, perRow);
  };

  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(container);

  // 悬停联动：事件委托
  root.addEventListener("mouseover", (e) => {
    const cell = e.target.closest("[data-i]");
    if (!cell) return;
    const i = cell.dataset.i;
    root.querySelectorAll(`[data-i="${i}"]`).forEach((n) => n.classList.add("hl"));
  });
  root.addEventListener("mouseout", (e) => {
    const cell = e.target.closest("[data-i]");
    if (!cell) return;
    const i = cell.dataset.i;
    root.querySelectorAll(`[data-i="${i}"]`).forEach((n) => n.classList.remove("hl"));
  });

  if (bytes.length > maxBytes) {
    const note = document.createElement("div");
    note.className = "hexview__truncated";
    note.textContent = t("view.hexTruncated", { total: bytes.length, shown: maxBytes });
    root.appendChild(note);
  }

  return { destroy: () => ro.disconnect() };
}

/** 实际绘制（重排时整体重画） */
function draw(root, bytes, len, perRow) {
  // 清空（保留 truncated note 由外层重新加）
  root.querySelectorAll(".hexrow, .hexview__head").forEach((n) => n.remove());

  // 表头：列编号
  const head = document.createElement("div");
  head.className = "hexview__head";
  let headHtml = `<span class="hexview__off">${t("view.hexOffset")}</span><span class="hexview__hex">`;
  for (let i = 0; i < perRow; i++) {
    headHtml += HEX[i] + (i % 8 === 7 && i !== perRow - 1 ? "  " : " ");
  }
  headHtml += `</span><span class="hexview__ascii">${t("view.hexAscii")}</span>`;
  head.innerHTML = headHtml;
  root.insertBefore(head, root.firstChild);

  const frag = document.createDocumentFragment();
  for (let off = 0; off < len; off += perRow) {
    const row = document.createElement("div");
    row.className = "hexrow";

    // 偏移列
    const offSpan = document.createElement("span");
    offSpan.className = "hexview__off";
    offSpan.textContent = off.toString(16).padStart(8, "0");
    row.appendChild(offSpan);

    // 十六进制区
    const hexSpan = document.createElement("span");
    hexSpan.className = "hexview__hex";
    // ASCII 区
    const ascSpan = document.createElement("span");
    ascSpan.className = "hexview__ascii";

    for (let i = 0; i < perRow; i++) {
      const idx = off + i;
      if (idx < len) {
        const b = bytes[idx];
        const hb = document.createElement("span");
        hb.className = "hb";
        hb.dataset.i = String(idx);
        hb.textContent = HEX[b];
        hexSpan.appendChild(hb);
        // 组间/字节间空格用文本节点
        hexSpan.appendChild(
          document.createTextNode(i % 8 === 7 && i !== perRow - 1 ? "  " : " ")
        );

        const ac = document.createElement("span");
        ac.className = "ac";
        ac.dataset.i = String(idx);
        ac.textContent = b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
        ascSpan.appendChild(ac);
      } else {
        hexSpan.appendChild(document.createTextNode("   "));
      }
    }

    row.append(hexSpan, ascSpan);
    frag.appendChild(row);
  }
  root.appendChild(frag);
}
