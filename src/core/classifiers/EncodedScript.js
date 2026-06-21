/**
 * EncodedScript — 高阶解析类分类器。
 * 覆盖：Hash 特征（MD5/SHA-1/SHA-256）、Base64（自动解码预览）。
 * 优先级高于普通文本，因为它们本质也是文本但更具特异性。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { t } from "../../i18n/i18n.js";

const HEX_RE = /^[0-9a-f]+$/i;
// Base64：标准字符集，长度为 4 的倍数，末尾允许 = 填充
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const HASH_BY_LEN = {
  32: "MD5",
  40: "SHA-1",
  64: "SHA-256",
  128: "SHA-512",
};

/** 尝试把 Base64 解码为字节，失败返回 null */
function tryDecodeBase64(text) {
  try {
    const bin = atob(text);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** 字节是否大体可作 UTF-8 文本显示（无过多控制字符） */
function looksTextual(bytes) {
  let printable = 0;
  const n = Math.min(bytes.length, 512);
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 0x20 && b < 0x7f) || b >= 0x80) {
      printable++;
    }
  }
  return n > 0 && printable / n > 0.85;
}

export class EncodedScriptClassifier extends BaseClassifier {
  static priority = 20;

  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    if (text.length < 16) return false;

    // Hash：纯 hex 且长度命中已知摘要长度
    if (HEX_RE.test(text) && HASH_BY_LEN[text.length]) return true;

    // Base64：字符集合规、长度为 4 倍数、且能解码
    if (text.length % 4 === 0 && B64_RE.test(text) && tryDecodeBase64(text)) return true;

    return false;
  }

  async parse(item) {
    const text = item.text.trim();

    // ---- Hash ----
    if (HEX_RE.test(text) && HASH_BY_LEN[text.length]) {
      const algo = HASH_BY_LEN[text.length];
      return {
        actionKey: "encoded_hash",
        subtitle: t("cls.hash", { algo }),
        tplVars: { hash: text.toLowerCase(), algo },
        render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.encodedAlgorithm"), algo],
              [t("cardRow.encodedLength"), `${text.length} 个十六进制字符（${text.length * 4} 位）`],
              [t("cardRow.encodedDigest"), text.toLowerCase()],
            ],
            { title: t("cardTitle.hash"), note: t("cardNote.hash") }
            )
          );
        },
      };
    }

    // ---- Base64 ----
    const decoded = tryDecodeBase64(text);
    const isText = looksTextual(decoded);
    const preview = isText
      ? new TextDecoder("utf-8").decode(decoded.subarray(0, 2048))
      : null;

    return {
      actionKey: "encoded_base64",
      subtitle: isText ? t("cls.base64Text") : t("cls.base64Binary"),
      tplVars: { decoded: preview || "", size: String(decoded.length) },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.encodedAlgorithm"), "Base64"],
              [t("cardRow.encodedLength"), `${text.length} 字符`],
              [t("cardRow.encodedDecodedLength"), `${decoded.length} 字节`],
              [t("cardRow.encodedContent"), isText ? t("cardRow.encodedContentText") : t("cardRow.encodedContentBinary")],
            ],
            { title: t("cardTitle.base64Decode") }
          )
        );
        if (isText) {
          const label = document.createElement("div");
          label.className = "infocard__title";
          label.textContent = t("cardRow.decodePreview");
          const pre = document.createElement("pre");
          pre.textContent = preview;
          el.append(label, pre);
        }
      },
    };
  }
}
