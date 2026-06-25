/**
 * infoCard.js — 通用信息卡渲染。
 * 把一组键值元信息渲染成整齐的两列表格，供 PE/Hash/文件等分类器复用。
 */

/**
 * @param {Array<[string, (string|Node)]>} rows  [label, value] 键值对；
 *        value 可为字符串（按文本插入）或 DOM 节点（直接挂入，用于打码模糊层等）
 * @param {object} [opts]
 * @param {string} [opts.title]   卡片标题
 * @param {string} [opts.note]    底部补充说明
 * @returns {HTMLElement}
 */
export function buildInfoCard(rows, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = "infocard";

  if (opts.title) {
    const h = document.createElement("div");
    h.className = "infocard__title";
    h.textContent = opts.title;
    wrap.appendChild(h);
  }

  const dl = document.createElement("dl");
  dl.className = "infocard__grid";
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = value;
    dl.append(dt, dd);
  }
  wrap.appendChild(dl);

  if (opts.note) {
    const n = document.createElement("p");
    n.className = "infocard__note";
    n.textContent = opts.note;
    wrap.appendChild(n);
  }

  return wrap;
}
