/**
 * numeric.js — 数值类分类器：时间戳、颜色值、进制转换。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { t } from "../../i18n/i18n.js";

// ---- 时间戳：10 位(秒)或 13 位(毫秒)，限合理年份范围避免误判普通数字 ----
const TS_MIN = 9.5e8; // ~2000-01
const TS_MAX = 2.6e9; // ~2052
export class TimestampClassifier extends BaseClassifier {
  static priority = 46;

  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    if (!/^\d{10}$|^\d{13}$/.test(text)) return false;
    const sec = text.length === 13 ? Number(text) / 1000 : Number(text);
    return sec >= TS_MIN && sec <= TS_MAX;
  }

  async parse(item) {
    const text = item.text.trim();
    const ms = text.length === 13 ? Number(text) : Number(text) * 1000;
    const d = new Date(ms);
    return {
      actionKey: "num_timestamp",
      subtitle: t("cls.timestamp"),
      tplVars: { iso: d.toISOString() },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.numPrecision"), text.length === 13 ? t("cardRow.numMs") : t("cardRow.numSec")],
              [t("cardRow.numLocalTime"), d.toLocaleString()],
              ["UTC", d.toUTCString()],
              ["ISO 8601", d.toISOString()],
            ],
            { title: t("cardTitle.timestamp") }
          )
        );
      },
    };
  }
}

// ---- 颜色值：#hex / rgb() / hsl() ----
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i;
const HSL_COLOR = /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+\s*)?\)$/i;

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export class ColorClassifier extends BaseClassifier {
  static priority = 54;

  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    return HEX_COLOR.test(text) || RGB_COLOR.test(text) || HSL_COLOR.test(text);
  }

  async parse(item) {
    const text = item.text.trim();
    let rgb = null;
    if (HEX_COLOR.test(text)) rgb = hexToRgb(text);
    else if (RGB_COLOR.test(text)) {
      rgb = text.match(/\d+/g).slice(0, 3).map(Number);
    }
    // hsl 仅展示原值，互转从略

    return {
      actionKey: "num_color",
      subtitle: t("cls.color"),
      tplVars: { color: text },
      render: (el) => {
        const swatch = document.createElement("div");
        swatch.className = "color-swatch";
        swatch.style.background = text;
        el.appendChild(swatch);

        const rows = [[t("cardRow.numInput"), text]];
        if (rgb) {
          const hex =
            "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
          const hsl = rgbToHsl(...rgb);
          rows.push(["HEX", hex.toUpperCase()]);
          rows.push(["RGB", `rgb(${rgb.join(", ")})`]);
          rows.push(["HSL", `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`]);
        }
        el.appendChild(buildInfoCard(rows, { title: t("cardTitle.color") }));
      },
    };
  }
}

// ---- 进制转换：仅认带前缀的 0x/0b/0o，绝不抢裸十进制数字 ----
const RADIX_RE = /^(0x[0-9a-f]+|0b[01]+|0o[0-7]+)$/i;
export class NumberBaseClassifier extends BaseClassifier {
  static priority = 50;

  match(item) {
    return item.isText && RADIX_RE.test(item.text.trim());
  }

  async parse(item) {
    const text = item.text.trim().toLowerCase();
    let val;
    if (text.startsWith("0x")) val = parseInt(text.slice(2), 16);
    else if (text.startsWith("0b")) val = parseInt(text.slice(2), 2);
    else val = parseInt(text.slice(2), 8);

    return {
      actionKey: "num_base",
      subtitle: t("cls.numberBase"),
      tplVars: { dec: String(val) },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.numDecimal"), String(val)],
              [t("cardRow.numHex"), "0x" + val.toString(16)],
              [t("cardRow.numOctal"), "0o" + val.toString(8)],
              [t("cardRow.numBinary"), "0b" + val.toString(2)],
            ],
            { title: t("cardTitle.base") }
          )
        );
      },
    };
  }
}
