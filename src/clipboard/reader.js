/**
 * reader.js — navigator.clipboard 读取封装。
 * 统一产出 ClipItem[]，屏蔽 read() / readText() 的差异。
 */
import { ClipItem } from "../core/ClipboardItem.js";

async function blobToBytes(blob) {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * 读取剪贴板，返回 ClipItem 数组（可能多项，取首项展示）。
 * 优先用 read() 拿到富类型（图片等）；失败再降级 readText()。
 *
 * 网页复制场景：一个剪贴板项常同时带 text/plain 与 text/html
 * （纯文本是可见文字，HTML 是带格式的原始标记）。此时以纯文本为
 * 主体（text），把 HTML 原文存进 meta.html，供分类器渲染「原貌」。
 * @throws 权限/不支持时抛出，交由上层提示
 */
export async function readClipboard() {
  const items = [];

  if (navigator.clipboard && navigator.clipboard.read) {
    const clipItems = await navigator.clipboard.read();
    for (const ci of clipItems) {
      const types = ci.types;

      // 富类型（图片等）优先单独成项
      const binaryType = types.find((t) => !t.startsWith("text/"));
      if (binaryType) {
        const blob = await ci.getType(binaryType);
        const bytes = await blobToBytes(blob);
        items.push(new ClipItem({ bytes, mime: binaryType }));
        continue;
      }

      // 文本项：同时取 plain 与 html
      let plain = null;
      let html = null;
      if (types.includes("text/plain")) {
        plain = await (await ci.getType("text/plain")).text();
      }
      if (types.includes("text/html")) {
        html = await (await ci.getType("text/html")).text();
      }

      // 主体文本：优先纯文本；没有纯文本才退回 html 原文
      const primary = plain != null ? plain : html;
      if (primary == null) continue;

      const bytes = new TextEncoder().encode(primary);
      const meta = {};
      // 仅当 html 与纯文本不同（即确有富格式）才作为「原貌」附上
      if (html && html.trim() && html.trim() !== (plain || "").trim()) {
        meta.html = html;
      }
      items.push(new ClipItem({ bytes, mime: "text/plain", text: primary, meta }));
    }
  }

  // 富类型读不到内容时，兜底读纯文本
  if (items.length === 0 && navigator.clipboard?.readText) {
    const text = await navigator.clipboard.readText();
    if (text) {
      const bytes = new TextEncoder().encode(text);
      items.push(new ClipItem({ bytes, mime: "text/plain", text }));
    }
  }

  return items;
}

/**
 * 从 DataTransfer / ClipboardData 构造 ClipItem[]。
 *
 * 这是 read()/readText() 之外的第二条进路，覆盖：
 *  - 移动端「长按粘贴」触发的 paste 事件（无需读权限、几乎全平台支持）。
 *  - 桌面把 .exe / 图片等文件「拖放」到页面（系统复制文件时剪贴板里只有
 *    文件路径而非内容，clipboard.read() 永远拿不到字节，拖放才有真实字节）。
 *
 * 与 readClipboard() 同样的优先级：先取文件（二进制），无文件再取文本。
 * @param {DataTransfer} dt  e.clipboardData（paste）或 e.dataTransfer（drop）
 * @returns {Promise<ClipItem[]>}
 */
export async function itemsFromDataTransfer(dt) {
  const items = [];
  if (!dt) return items;

  // 文件优先（图片 / 可执行文件 / 压缩包等二进制）
  const files = dt.files && dt.files.length ? Array.from(dt.files) : [];
  for (const file of files) {
    const bytes = await blobToBytes(file);
    // 文本类文件按文本处理，便于走文本分类器；其余按二进制
    if (file.type.startsWith("text/") || /\.(txt|json|csv|md|log|xml|svg)$/i.test(file.name)) {
      const text = new TextDecoder("utf-8").decode(bytes);
      items.push(new ClipItem({ bytes, mime: file.type || "text/plain", text, meta: { fileName: file.name } }));
    } else {
      items.push(new ClipItem({ bytes, mime: file.type || "application/octet-stream", meta: { fileName: file.name } }));
    }
  }
  if (items.length) return items;

  // 无文件：取文本（同时取 plain 与 html，与 readClipboard 一致）
  const plain = dt.getData ? dt.getData("text/plain") : "";
  const html = dt.getData ? dt.getData("text/html") : "";
  const primary = plain || html;
  if (primary) {
    const bytes = new TextEncoder().encode(primary);
    const meta = {};
    if (html && html.trim() && html.trim() !== (plain || "").trim()) meta.html = html;
    items.push(new ClipItem({ bytes, mime: "text/plain", text: primary, meta }));
  }
  return items;
}
