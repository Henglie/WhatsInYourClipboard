/**
 * token.js — 令牌/标识符类分类器：JWT、UUID、加密货币地址。
 * 均为格式高度特异的文本，优先级高于通用文本。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { renderJSON } from "../../views/renderers/highlight.js";
import { t } from "../../i18n/i18n.js";

/** base64url 解码为字符串 */
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  try {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

export class JwtClassifier extends BaseClassifier {
  static priority = 60;

  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    if (!JWT_RE.test(text)) return false;
    const head = b64urlDecode(text.split(".")[0]);
    if (!head) return false;
    try {
      const obj = JSON.parse(head);
      return typeof obj === "object" && "alg" in obj;
    } catch {
      return false;
    }
  }

  async parse(item) {
    const text = item.text.trim();
    const [h, p] = text.split(".");
    const header = b64urlDecode(h);
    const payload = b64urlDecode(p);
    let exp = null;
    try {
      const pj = JSON.parse(payload);
      if (pj.exp) exp = new Date(pj.exp * 1000);
    } catch {}

    return {
      actionKey: "token_jwt",
      subtitle: t("cls.jwt"),
      tplVars: { token: text },
      render: (el) => {
        const rows = [[t("cardRow.tokenType"), "JSON Web Token"]];
        if (exp) {
          const expired = exp.getTime() < Date.now();
          rows.push([t("cardRow.tokenExpiry"), exp.toLocaleString() + (expired ? t("cardRow.tokenExpired") : "")]);
        }
        el.appendChild(buildInfoCard(rows, { title: t("cardTitle.jwt") }));

        const ht = document.createElement("div");
        ht.className = "infocard__title";
        ht.textContent = t("cardRow.tokenHeader");
        el.append(ht, header ? renderJSON(header) : document.createTextNode(t("cardRow.undecodable")));

        const pt = document.createElement("div");
        pt.className = "infocard__title";
        pt.textContent = t("cardRow.tokenPayload");
        el.append(pt, payload ? renderJSON(payload) : document.createTextNode(t("cardRow.undecodable")));

        const note = document.createElement("p");
        note.className = "infocard__note";
        note.textContent = t("cardNote.jwt");
        el.appendChild(note);
      },
    };
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UuidClassifier extends BaseClassifier {
  static priority = 56;

  match(item) {
    return item.isText && UUID_RE.test(item.text.trim());
  }

  async parse(item) {
    const text = item.text.trim();
    const version = text[14];
    return {
      actionKey: "token_uuid",
      subtitle: t("cls.uuid", { version }),
      tplVars: { uuid: text },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.tokenType"), "UUID / GUID"],
              [t("cardRow.tokenVersion"), `v${version}`],
              [t("cardRow.tokenValue"), text.toLowerCase()],
            ],
            { title: t("cardTitle.uuid") }
          )
        );
      },
    };
  }
}

const ETH_RE = /^0x[0-9a-fA-F]{40}$/;
const BTC_RE = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

export class CryptoAddressClassifier extends BaseClassifier {
  static priority = 58;

  match(item) {
    if (!item.isText) return false;
    const text = item.text.trim();
    return ETH_RE.test(text) || BTC_RE.test(text);
  }

  async parse(item) {
    const text = item.text.trim();
    const isEth = ETH_RE.test(text);
    const chain = isEth ? t("cardRow.cryptoEth") : t("cardRow.cryptoBtc");
    return {
      actionKey: isEth ? "crypto_eth" : "crypto_btc",
      subtitle: t("cls.cryptoAddr", { chain: isEth ? t("cardRow.cryptoEthShort") : t("cardRow.cryptoBtcShort") }),
      tplVars: { address: text },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.tokenChain"), chain],
              [t("cardRow.tokenAddress"), text],
            ],
            {
              title: t("cardTitle.cryptoAddr"),
              note: t("cardNote.cryptoAddr"),
            }
          )
        );
      },
    };
  }
}
