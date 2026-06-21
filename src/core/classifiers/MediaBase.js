/**
 * MediaBase — 多媒体类分类器。
 * 位图图片预览（双击放大）+ 尺寸/主色调分析。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { enableZoom } from "../../ui/lightbox.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { readImageSize, extractColors } from "../imageInfo.js";
import { t } from "../../i18n/i18n.js";

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export class MediaClassifier extends BaseClassifier {
  static priority = 30;

  match(item) {
    return item.mime.startsWith("image/") && item.mime !== "image/svg+xml";
  }

  async parse(item) {
    const blob = new Blob([item.bytes], { type: item.mime });
    const url = URL.createObjectURL(blob);
    const dim = readImageSize(item.bytes);

    return {
      actionKey: "media_image",
      subtitle: t("cls.image"),
      tplVars: { mime: item.mime, size: String(item.size) },
      render: (el) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = t("cls.image");
        enableZoom(img, url);
        el.appendChild(img);

        const hint = document.createElement("p");
        hint.className = "media-hint";
        hint.textContent = t("cardNote.imageZoom");
        el.appendChild(hint);

        const rows = [
          [t("cardRow.mediaFormat"), item.mime],
          [t("cardRow.mediaSize"), fmtSize(item.size)],
        ];
        if (dim) rows.push([t("cardRow.mediaDimensions"), `${dim.width} × ${dim.height} 像素`]);
        const card = buildInfoCard(rows, { title: t("cardTitle.imageInfo") });
        el.appendChild(card);

        // 主色调（异步）
        const palette = document.createElement("div");
        palette.className = "palette";
        el.appendChild(palette);
        extractColors(url, 5).then((colors) => {
          if (!colors.length) return;
          const label = document.createElement("div");
          label.className = "infocard__title";
          label.textContent = t("cardRow.mediaDominantColor");
          palette.appendChild(label);
          const swatches = document.createElement("div");
          swatches.className = "palette__row";
          for (const c of colors) {
            const sw = document.createElement("div");
            sw.className = "palette__chip";
            sw.style.background = c;
            sw.title = c;
            const lbl = document.createElement("span");
            lbl.textContent = c.toUpperCase();
            sw.appendChild(lbl);
            swatches.appendChild(sw);
          }
          palette.appendChild(swatches);
        });
      },
    };
  }
}

// ---------- SVG（识别 + 安全渲染 + 源码） ----------
export class SvgClassifier extends BaseClassifier {
  static priority = 34;

  match(item) {
    if (item.mime === "image/svg+xml") return true;
    if (!item.isText) return false;
    const text = item.text.trim();
    return /^<\?xml[^>]*\?>\s*<svg[\s>]/i.test(text) || /^<svg[\s>][\s\S]*<\/svg>\s*$/i.test(text);
  }

  async parse(item) {
    const src = item.isText
      ? item.text
      : new TextDecoder("utf-8").decode(item.bytes);

    // 安全渲染：剥离 script/事件处理器，用 Blob 通过 <img> 加载（img 不执行脚本）
    const blob = new Blob([src], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    // 尝试读 viewBox/宽高
    const wMatch = src.match(/width\s*=\s*["']([\d.]+)/i);
    const hMatch = src.match(/height\s*=\s*["']([\d.]+)/i);
    const vbMatch = src.match(/viewBox\s*=\s*["']([^"']+)["']/i);

    return {
      actionKey: "media_svg",
      subtitle: t("cls.svg"),
      tplVars: { svg: src },
      render: (el) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = t("cls.svg");
        img.className = "svg-preview";
        enableZoom(img, url);
        el.appendChild(img);

        const rows = [[t("cardRow.mediaFormat"), t("cardRow.formatSvg")]];
        if (wMatch && hMatch) rows.push([t("cardRow.mediaDimensions"), `${wMatch[1]} × ${hMatch[1]}`]);
        if (vbMatch) rows.push(["viewBox", vbMatch[1]]);
        rows.push([t("cardRow.mediaSourceLength"), `${src.length} 字符`]);
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.svg"),
            note: t("cardNote.svgSafe"),
          })
        );

        const lbl = document.createElement("div");
        lbl.className = "infocard__title";
        lbl.textContent = t("cardRow.mediaSource");
        const pre = document.createElement("pre");
        pre.className = "code";
        pre.textContent = src.length > 3000 ? src.slice(0, 3000) + "\n…" : src;
        el.append(lbl, pre);
      },
    };
  }
}
