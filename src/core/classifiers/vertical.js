/**
 * vertical.js — 垂直领域分类器：商品条码、分享码/激活码注册表。
 * 分享码注册表完全由 share-codes.json 驱动，开发者加 JSON 即扩展。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { DataPack } from "../DataPack.js";
import { detectBarcode, ean13Region } from "../barcode.js";
import { parseDeltaCode } from "../delta.js";
import { t } from "../../i18n/i18n.js";

// ---------- 三角洲行动改枪码 ----------
export class DeltaCodeClassifier extends BaseClassifier {
  static priority = 59;

  match(item) {
    if (!item.isText) return false;
    const cfg = DataPack.getCached("delta-weapons");
    return parseDeltaCode(item.text, cfg) !== null;
  }

  async parse(item) {
    const cfg = DataPack.getCached("delta-weapons");
    const d = parseDeltaCode(item.text, cfg);
    const known = cfg && cfg.knownWeapons[d.weaponName];
    return {
      actionKey: "vert_delta",
      subtitle: t("cls.delta", { weapon: d.weaponName }),
      tplVars: { weapon: d.weaponName, code: d.raw },
      render: (el) => {
        const rows = [
          [t("cardRow.vertGame"), t("cardRow.vertGameDelta")],
          [t("cardRow.vertWeapon"), d.weaponName],
          [t("cardRow.vertCategory"), d.category + (known && known !== d.category ? `（${known}）` : "")],
          [t("cardRow.vertGameMode"), d.mode],
          [t("cardRow.vertGunsmithCode"), d.code],
          [t("cardRow.vertCodeLength"), `${d.codeLen} 位`],
        ];
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.delta"),
            note: t("cardNote.delta"),
          })
        );
      },
    };
  }
}

// ---------- 商品条码 ----------
export class BarcodeClassifier extends BaseClassifier {
  static priority = 43;

  match(item) {
    return item.isText && detectBarcode(item.text) !== null;
  }

  async parse(item) {
    const { type, code } = detectBarcode(item.text);
    const rows = [
      [t("cardRow.idType"), type],
      [t("cardRow.encoding"), code],
      [t("cardRow.vertCheck"), t("cardRow.vertCheckValid")],
    ];
    if (type === "EAN-13") {
      rows.push([t("cardRow.vertSourceRegion"), ean13Region(code)]);
    }
    return {
      actionKey: "vert_barcode",
      subtitle: t("cls.barcode", { type }),
      tplVars: { code },
      render: (el) => {
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.barcode"),
            note: t("cardNote.barcode"),
          })
        );
      },
    };
  }
}

// ---------- 分享码 / 激活码注册表（JSON 驱动） ----------
export class ShareCodeClassifier extends BaseClassifier {
  static priority = 33;

  match(item) {
    if (!item.isText) return false;
    const data = DataPack.getCached("share-codes");
    if (!data) return false;
    const text = item.text.trim();
    return data.codes.some((c) => {
      try {
        return new RegExp(c.pattern).test(text);
      } catch {
        return false;
      }
    });
  }

  async parse(item) {
    const text = item.text.trim();
    const data = DataPack.getCached("share-codes") || { codes: [] };
    const hit = data.codes.find((c) => {
      try {
        return new RegExp(c.pattern).test(text);
      } catch {
        return false;
      }
    });

    return {
      actionKey: hit && hit.verify ? "vert_sharecode_verify" : "vert_sharecode",
      subtitle: t("cls.shareCode", { type: hit ? hit.name : t("cardRow.vertShareCode") }),
      tplVars: { code: text, verify: hit ? hit.verify : "" },
      render: (el) => {
        const rows = [
          [t("cardRow.idType"), hit ? hit.name : t("cardRow.vertShareCode")],
          [t("cardRow.vertContent"), text],
        ];
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.shareCode"),
            note: hit && hit.note ? hit.note : t("cardNote.shareCodeDefault"),
          })
        );
      },
    };
  }
}
