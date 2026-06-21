/**
 * fileExtra.js — 扩展文件分类器：更多二进制格式 + PEM 证书/密钥文本。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { detectExtended } from "../fileformats.js";
import { buildHashPanel } from "../../views/renderers/hashPanel.js";
import { t } from "../../i18n/i18n.js";

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ---------- 扩展二进制格式 ----------
export class ExtendedFileClassifier extends BaseClassifier {
  static priority = 24; // 略低于主 FileClassifier，作补充

  match(item) {
    return !item.isText && detectExtended(item.bytes) !== null;
  }

  async parse(item) {
    const info = detectExtended(item.bytes);
    return {
      actionKey: "file_extended",
      subtitle: t("cls.fileExtended", { name: info.name }),
      tplVars: {},
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.mediaFormat"), info.name],
              [t("cardRow.fileCategory"), info.kind],
              [t("cardRow.mediaSize"), fmtSize(item.size)],
            ],
            { title: t("cardTitle.fileDetect") }
          )
        );
        buildHashPanel(el, item.bytes);
      },
    };
  }
}

// ---------- PEM 证书 / 密钥（文本） ----------
const PEM_RE = /-----BEGIN ([A-Z ]+)-----/;
const PEM_LABELS = {
  CERTIFICATE: "cardRow.pemCert",
  "CERTIFICATE REQUEST": "cardRow.pemCsr",
  "RSA PRIVATE KEY": "cardRow.pemRsaKey",
  "EC PRIVATE KEY": "cardRow.pemEcKey",
  "PRIVATE KEY": "cardRow.pemPrivateKey",
  "PUBLIC KEY": "cardRow.pemPublicKey",
  "OPENSSH PRIVATE KEY": "cardRow.pemSshKey",
  "PGP PUBLIC KEY BLOCK": "cardRow.pemPgpPub",
  "PGP PRIVATE KEY BLOCK": "cardRow.pemPgpPriv",
};

export class PemClassifier extends BaseClassifier {
  static priority = 57;

  match(item) {
    return item.isText && PEM_RE.test(item.text.trim());
  }

  async parse(item) {
    const text = item.text.trim();
    const label = text.match(PEM_RE)[1].trim();
    const humanKey = PEM_LABELS[label] || label;
    const human = PEM_LABELS[label] ? t(humanKey) : label;
    const isPrivate = /PRIVATE KEY/.test(label);
    return {
      actionKey: "file_pem",
      subtitle: t("cls.pem", { type: human }),
      tplVars: {},
      render: (el) => {
        const rows = [
          [t("cardRow.idType"), human],
          [t("cardRow.filePemLabel"), label],
          [t("cardRow.encoding"), "PEM (Base64)"],
        ];
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.pem"),
            note: isPrivate
              ? t("cardNote.certPrivate")
              : t("cardNote.certPublic"),
          })
        );
        if (isPrivate) {
          const warn = document.createElement("div");
          warn.className = "sql-warning";
          warn.textContent = t("cardNote.pemWarn");
          el.insertBefore(warn, el.firstChild);
        }
      },
    };
  }
}
