/**
 * visibleText.js — 把含不可打印字符的文本「显形」渲染。
 *
 * 一个剪贴板透视工具，结果里的 \0、\x01、退格、删除符等控制字符若直接塞进
 * textContent，浏览器会把它们渲染成零宽不可见——用户看到的是「\0 后面内容
 * 没了/错位」。这里把控制字符替换成 Unicode Control Pictures 区（U+2400–U+2421）
 * 的可见字形（如 ␀ ␁ ␊ ␡），并加样式弱化，让用户一眼看出「这里有个空字节」。
 *
 * 复制：填进真实控制字符到 dataset，复制时取真实值（显形仅作视觉呈现）。
 */

/** 是否需要显形（含 C0 控制符或 DEL，换行/制表除外——它们本身可见可排版） */
export function hasControlChars(str) {
  // eslint-disable-next-line no-control-regex
  return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(str);
}

/** 单个码点 → 可见字形（控制符用 Control Pictures，其余原样） */
function glyphFor(code) {
  if (code === 0x7f) return "␡"; // DEL → ␡
  if (code <= 0x1f) return String.fromCharCode(0x2400 + code); // C0 → ␀..␟
  return null;
}

/**
 * 把字符串渲染进给定元素，控制字符以弱化的可见字形显示。
 * 换行、制表保留原样（不显形，保证排版）。
 * @param {HTMLElement} el  目标元素（通常是 <pre>）
 * @param {string} str
 * @returns {HTMLElement} 填充好的元素
 */
export function renderVisibleText(el, str) {
  const pre = el || document.createElement("pre");
  pre.textContent = "";
  let buf = "";
  const flush = () => {
    if (buf) { pre.appendChild(document.createTextNode(buf)); buf = ""; }
  };
  for (const ch of str) {
    const code = ch.codePointAt(0);
    // 换行/制表保留原样，其余控制符显形
    if (code === 0x09 || code === 0x0a || code === 0x0d) { buf += ch; continue; }
    const glyph = glyphFor(code);
    if (glyph !== null) {
      flush();
      const span = document.createElement("span");
      span.className = "ctrl-char";
      span.textContent = glyph;
      span.title = "U+" + code.toString(16).toUpperCase().padStart(4, "0");
      pre.appendChild(span);
    } else {
      buf += ch;
    }
  }
  flush();
  return pre;
}
