/**
 * lifeView.js — 生活信息分类器：收货地址、坐标、数学表达式、ISBN、快递单号。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { DataPack } from "../DataPack.js";
import { renderMap } from "../../ui/mapLoader.js";
import {
  parseAddress,
  looksLikeAddress,
  parseCoord,
  wgs84ToGcj02,
  gcj02ToBd09,
  isMathExpr,
  evalMath,
  isISBN,
  validateISBN,
} from "../life.js";
import { looksLikePath, parsePath } from "../path.js";
import { t } from "../../i18n/i18n.js";

// ---------- 收货地址 ----------
export class AddressClassifier extends BaseClassifier {
  static priority = 40;

  match(item) {
    return item.isText && looksLikeAddress(item.text);
  }

  async parse(item) {
    const info = parseAddress(item.text.trim());
    return {
      actionKey: "life_address",
      subtitle: t("cls.address"),
      tplVars: { query: info.detail || item.text.trim() },
      render: (el) => {
        const rows = [];
        if (info.name) rows.push([t("cardRow.lifeRecipient"), info.name]);
        if (info.phoneMasked) rows.push([t("cardRow.lifePhone"), info.phoneMasked]);
        if (info.province) rows.push([t("cardRow.lifeProvince"), info.province]);
        rows.push([t("cardRow.lifeDetailAddress"), info.detail]);
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.address"),
            note: info.hasPhone
              ? t("cardRow.lifeAddressNotePhone")
              : t("cardRow.lifeAddressNoteNoPhone"),
          })
        );
      },
    };
  }
}

// ---------- 经纬度坐标 ----------
export class CoordClassifier extends BaseClassifier {
  static priority = 45;

  match(item) {
    return item.isText && parseCoord(item.text) !== null;
  }

  async parse(item) {
    const { lat, lng } = parseCoord(item.text);
    const gcj = wgs84ToGcj02(lat, lng);
    const bd = gcj02ToBd09(gcj.lat, gcj.lng);
    const f = (n) => n.toFixed(6);
    return {
      actionKey: "life_coord",
      subtitle: t("cls.coord"),
      tplVars: {
        wgs: `${f(lat)},${f(lng)}`,
        gcj: `${f(gcj.lat)},${f(gcj.lng)}`,
      },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              ["WGS84（GPS）", `${f(lat)}, ${f(lng)}`],
              ["GCJ02", `${f(gcj.lat)}, ${f(gcj.lng)}`],
              ["BD09", `${f(bd.lat)}, ${f(bd.lng)}`],
            ],
            {
              title: t("cardTitle.coord"),
              note: t("cardNote.coord"),
            }
          )
        );

        // 隐私铁律：地图默认不加载，点击才向 OSM 请求
        const mapBtn = document.createElement("button");
        mapBtn.className = "map-load-btn";
        mapBtn.textContent = t("cardRow.lifeLoadMap");
        const mapBox = document.createElement("div");
        mapBox.className = "map-box";
        mapBox.style.display = "none";
        mapBtn.addEventListener("click", () => {
          mapBtn.remove();
          mapBox.style.display = "block";
          renderMap(mapBox, lat, lng, `${f(lat)}, ${f(lng)}`);
        });
        el.append(mapBtn, mapBox);
      },
    };
  }
}

// ---------- 数学表达式 ----------
export class MathClassifier extends BaseClassifier {
  static priority = 42;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    return isMathExpr(t) && evalMath(t) !== null;
  }

  async parse(item) {
    const t = item.text.trim();
    const result = evalMath(t);
    return {
      actionKey: "life_math",
      subtitle: t("cls.math"),
      tplVars: { result: String(result) },
      render: (el) => {
        const big = document.createElement("div");
        big.className = "bigtext";
        big.textContent = `${t} = ${result}`;
        el.appendChild(big);
      },
    };
  }
}

// ---------- ISBN ----------
export class IsbnClassifier extends BaseClassifier {
  static priority = 41;

  match(item) {
    return item.isText && isISBN(item.text);
  }

  async parse(item) {
    const raw = item.text.trim();
    const isbn = raw.replace(/[-\s]/g, "");
    const valid = validateISBN(raw);
    return {
      actionKey: "life_isbn",
      subtitle: t("cls.isbn"),
      tplVars: { isbn },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              ["ISBN", raw],
              [t("cardRow.numPrecision"), isbn.length === 13 ? t("cardRow.lifeIsbn13") : t("cardRow.lifeIsbn10")],
              [t("cardRow.idCheck"), valid ? t("cardRow.lifeIsbnValid") : t("cardRow.lifeIsbnInvalid")],
            ],
            { title: t("cardTitle.isbn"), note: t("cardNote.isbn") }
          )
        );
      },
    };
  }
}

// ---------- 快递单号 ----------
export class ExpressClassifier extends BaseClassifier {
  static priority = 39;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    // 含字母前缀的运单号，或 12-15 位纯数字
    return /^[A-Z]{2,4}\d{9,16}$/i.test(t) || /^\d{12,15}$/.test(t);
  }

  async parse(item) {
    const code = item.text.trim().toUpperCase();
    const data = await DataPack.load("express-companies");
    let company = t("cardRow.lifeUnknownCarrier");
    if (data) {
      for (const [prefix, name] of Object.entries(data.prefixes)) {
        if (code.startsWith(prefix)) {
          company = name;
          break;
        }
      }
    }
    return {
      actionKey: "life_express",
      subtitle: t("cls.express"),
      tplVars: { code: item.text.trim() },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.lifeTrackingNumber"), item.text.trim()],
              [t("cardRow.lifePossibleCarrier"), company],
            ],
            {
              title: t("cardTitle.express"),
              note: t("cardNote.express"),
            }
          )
        );
      },
    };
  }
}

// ---------- 文件系统路径 ----------
// 剪贴板里复制一条路径很常见（资源管理器地址栏、终端、报错堆栈）。
// 旧逻辑只当「一段文本」，这里识别并拆出根/层级/文件名/扩展名/类型。
export class PathClassifier extends BaseClassifier {
  static priority = 38; // 低于快递(39)，高于纯文本兜底；保守判定避免误吞

  match(item) {
    return item.isText && looksLikePath(item.text);
  }

  async parse(item) {
    const p = parsePath(item.text);
    const kindLabel = {
      windows: t("cardRow.pathWindows"),
      unc: t("cardRow.pathUnc"),
      unix: t("cardRow.pathUnix"),
    }[p.kind];

    const rows = [[t("cardRow.pathType"), kindLabel]];
    if (p.root) rows.push([t("cardRow.pathRoot"), p.root]);
    if (p.fileName) {
      rows.push([t("cardRow.pathFileName"), p.fileName]);
      if (p.ext) {
        const extKindLabel = p.extKind ? t("cardRow.pathKind_" + p.extKind) : t("cardRow.pathKind_other");
        rows.push([t("cardRow.pathExt"), "." + p.ext + (p.extKind ? `（${extKindLabel}）` : "")]);
      }
    } else if (p.isDir) {
      rows.push([t("cardRow.pathFileName"), t("cardRow.pathIsDir")]);
    }
    rows.push([t("cardRow.pathDepth"), `${p.depth} ${t("cardRow.pathDepthUnit")}`]);

    // 父目录：去掉最后一段后用原分隔符重组（带上根）。无可去段则留空。
    let parent = "";
    if (p.segments.length > (p.isDir ? 0 : 1)) {
      const keep = p.segments.slice(0, p.isDir ? -1 : -1);
      parent = (p.root || "") + keep.join(p.sep);
    } else if (p.root) {
      parent = p.root;
    }

    return {
      actionKey: "life_path",
      subtitle: t("cls.path"),
      tplVars: {
        path: item.text.trim(),
        fileName: p.fileName || "",
        parent,
        winExplorer: `explorer "${item.text.trim()}"`,
      },
      render: (el) => {
        el.appendChild(
          buildInfoCard(rows, { title: t("cardTitle.path"), note: t("cardNote.path") })
        );
        // 路径分段「面包屑」可视化
        if (p.segments.length) {
          const crumb = document.createElement("div");
          crumb.className = "path-crumbs";
          const mk = (txt, cls) => {
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = txt;
            return span;
          };
          if (p.root) crumb.appendChild(mk(p.root, "path-crumbs__root"));
          p.segments.forEach((seg, i) => {
            crumb.appendChild(mk(p.sep, "path-crumbs__sep"));
            const isLast = i === p.segments.length - 1 && !p.isDir;
            crumb.appendChild(mk(seg, isLast ? "path-crumbs__file" : "path-crumbs__seg"));
          });
          el.appendChild(crumb);
        }
      },
    };
  }
}
