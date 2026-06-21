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
