/**
 * identity.js — 身份信息深度解析分类器。
 * 当整串就是单个标识符（身份证/手机/银行卡/IP/MAC/车牌）时深度拆解。
 * 标识符本身仍打码展示，推导属性基于结构而非泄漏明文。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { DataPack } from "../DataPack.js";
import { parseIdCard, validateIdCard, maskIdCard } from "../idcard.js";
import { isPlate, parsePlate } from "../plate.js";
import { stripSpacesDashes, stripLabel, toHalfWidth } from "../normalize.js";
import { t } from "../../i18n/i18n.js";

/** 归一文本里的「数字串标识符」：剥标签 → 全角转半角 → 去空格连字符。 */
function digitId(text) {
  return stripSpacesDashes(toHalfWidth(stripLabel(text)));
}

// ---------- 身份证 ----------
export class IdCardClassifier extends BaseClassifier {
  static priority = 70;

  match(item) {
    return item.isText && /^\d{17}[\dXx]$/.test(digitId(item.text));
  }

  async parse(item) {
    const id = digitId(item.text);
    const regionMap = await DataPack.load("region-codes");
    const info = parseIdCard(id, regionMap);
    return {
      actionKey: "id_card",
      subtitle: t("cls.idCard"),
      tplVars: {},
      sensitive: true, // 卡片打了码，但左侧 Hex 摊开明文同样泄露 → 蒙磨砂
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.idNumber"), maskIdCard(id)],
              [t("cardRow.idCheck"), info.valid ? t("cardRow.idCheckValid") : t("cardRow.idCheckInvalid")],
              [t("cardRow.idHometown"), info.province],
              [t("cardRow.idBirthday"), info.birthday],
              [t("cardRow.idAge"), `${info.age} 岁`],
              [t("cardRow.idGender"), info.gender],
              [t("cardRow.idZodiac"), info.zodiac],
              [t("cardRow.idConstellation"), info.constellation],
            ],
            {
              title: t("cardTitle.idCard"),
              note: t("cardNote.idCard"),
            }
          )
        );
      },
    };
  }
}

// ---------- 手机号 ----------
/** 手机号归一：数字串标识 + 剥国际区号前缀（+86 / 0086 / 86）。 */
function normalizePhone(text) {
  return digitId(text).replace(/^(?:\+?0{0,2}86)(?=1[3-9]\d{9}$)/, "");
}

export class PhoneClassifier extends BaseClassifier {
  static priority = 68;

  match(item) {
    return item.isText && /^1[3-9]\d{9}$/.test(normalizePhone(item.text));
  }

  async parse(item) {
    const phone = normalizePhone(item.text);
    const segMap = await DataPack.load("phone-segments");
    const carrier = segMap ? segMap[phone.slice(0, 3)] || t("cardRow.idUnknownCarrier") : t("cardRow.idNeedSegDb");
    const masked = phone.slice(0, 3) + "****" + phone.slice(7);
    return {
      actionKey: "id_phone",
      subtitle: t("cls.phone"),
      tplVars: {},
      sensitive: true, // 卡片打码，但左侧 Hex 摊明文 → 整块蒙磨砂
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.idNumber"), masked],
              [t("cardRow.idCarrier"), carrier],
              [t("cardRow.idSegment"), phone.slice(0, 3) + t("cardRow.idSegmentPrefix")],
            ],
            {
              title: t("cardTitle.phone"),
              note: t("cardNote.phone"),
            }
          )
        );
      },
    };
  }
}

// ---------- 银行卡（Luhn 校验 + BIN 发卡行） ----------
function luhnValid(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export class BankCardClassifier extends BaseClassifier {
  static priority = 66;

  match(item) {
    return item.isText && /^\d{16,19}$/.test(digitId(item.text));
  }

  async parse(item) {
    const card = digitId(item.text);
    const valid = luhnValid(card);
    const binMap = await DataPack.load("bank-bins");
    let info = null;
    if (binMap) {
      // 最长前缀匹配
      for (let len = 9; len >= 6; len--) {
        const hit = binMap[card.slice(0, len)];
        if (hit) {
          info = hit;
          break;
        }
      }
    }
    const masked = "**** **** **** " + card.slice(-4);
    return {
      actionKey: "id_bankcard",
      subtitle: t("cls.bankCard"),
      tplVars: {},
      sensitive: true, // 卡片打码，但左侧 Hex 摊明文 → 整块蒙磨砂
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.idCardNumber"), masked],
              [t("cardRow.idLuhn"), valid ? t("cardRow.idLuhnValid") : t("cardRow.idLuhnInvalid")],
              [t("cardRow.idIssuer"), info ? info.bank : t("cardRow.idIssuerUnknown")],
              [t("cardRow.idCardType"), info ? info.type : "—"],
            ],
            {
              title: t("cardTitle.bankCard"),
              note: t("cardNote.bankCard"),
            }
          )
        );
      },
    };
  }
}

// ---------- IP 地址 ----------
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function ipClass(ip) {
  const o = ip.split(".").map(Number);
  if (o[0] === 10) return t("cardRow.ipPrivateA");
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return t("cardRow.ipPrivateB");
  if (o[0] === 192 && o[1] === 168) return t("cardRow.ipPrivateC");
  if (o[0] === 127) return t("cardRow.ipLoopback");
  if (o[0] === 169 && o[1] === 254) return t("cardRow.ipLinkLocal");
  return t("cardRow.ipPublic");
}

export class IpClassifier extends BaseClassifier {
  static priority = 64;

  match(item) {
    return item.isText && IPV4_RE.test(item.text.trim());
  }

  async parse(item) {
    const ip = item.text.trim();
    const scope = ipClass(ip);
    return {
      actionKey: "id_ip",
      subtitle: t("cls.ipv4"),
      tplVars: { ip },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.idAddress"), ip],
              [t("cardRow.idType"), scope],
            ],
            {
              title: t("cardTitle.ipAddress"),
              note: t("cardNote.addressLookup"),
            }
          )
        );
      },
    };
  }
}

// ---------- MAC 地址 ----------
// 6 组十六进制，冒号或连字符分隔（AA:BB:CC:DD:EE:FF / aa-bb-cc-dd-ee-ff）。
const MAC_RE = /^([0-9a-f]{2})([:-])(?:[0-9a-f]{2}\2){4}[0-9a-f]{2}$/i;
// Cisco 点分四位（aabb.ccdd.eeff）
const MAC_DOT_RE = /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i;

export class MacClassifier extends BaseClassifier {
  static priority = 63;

  match(item) {
    if (!item.isText) return false;
    const s = item.text.trim();
    return MAC_RE.test(s) || MAC_DOT_RE.test(s);
  }

  async parse(item) {
    const raw = item.text.trim();
    const hex = raw.replace(/[^0-9a-f]/gi, "").toUpperCase(); // 12 位纯 hex
    const oui = hex.slice(0, 6);
    const first = parseInt(hex.slice(0, 2), 16);
    // I/G 位（最低位）：1=组播 0=单播；U/L 位（次低位）：1=本地管理 0=全球唯一
    const isMulticast = (first & 0x01) === 1;
    const isLocal = (first & 0x02) === 2;
    const canonical = hex.match(/../g).join(":");
    return {
      actionKey: "id_mac",
      subtitle: t("cls.mac"),
      tplVars: { mac: canonical },
      render: (el) => {
        const rows = [
          [t("cardRow.macAddress"), canonical],
          [t("cardRow.macOui"), oui.match(/../g).join(":")],
          [t("cardRow.macCast"), isMulticast ? t("cardRow.macMulticast") : t("cardRow.macUnicast")],
          [t("cardRow.macScope"), isLocal ? t("cardRow.macLocal") : t("cardRow.macGlobal")],
        ];
        el.appendChild(
          buildInfoCard(rows, { title: t("cardTitle.mac"), note: t("cardNote.mac") })
        );
      },
    };
  }
}

// ---------- IPv6 地址 ----------
// 容纳全写、压缩（::）、以及内嵌 IPv4 的形式。先粗筛再用内置 URL 解析校验。
function isIpv6(s) {
  if (!/^[0-9a-f:.]+$/i.test(s)) return false;
  if (!s.includes(":")) return false;
  const dc = s.match(/::/g);
  if (dc && dc.length > 1) return false; // 只能有一个 ::
  // 用浏览器/Node 的 URL 解析做权威校验：合法 IPv6 能放进 [..]
  try {
    const u = new URL(`http://[${s}]/`);
    return u.hostname === `[${s.toLowerCase()}]` || /^\[[0-9a-f:.]+\]$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function ipv6Scope(s) {
  const low = s.toLowerCase();
  if (low === "::1") return t("cardRow.ipLoopback");
  if (low === "::") return t("cardRow.ipv6Unspecified");
  if (low.startsWith("fe80")) return t("cardRow.ipLinkLocal");
  if (/^f[cd]/.test(low)) return t("cardRow.ipv6UniqueLocal");
  if (low.startsWith("ff")) return t("cardRow.ipv6Multicast");
  return t("cardRow.ipPublic");
}

export class Ipv6Classifier extends BaseClassifier {
  static priority = 63;

  match(item) {
    if (!item.isText) return false;
    return isIpv6(item.text.trim());
  }

  async parse(item) {
    const ip = item.text.trim();
    const scope = ipv6Scope(ip);
    return {
      actionKey: "id_ipv6",
      subtitle: t("cls.ipv6"),
      tplVars: { ip },
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.idAddress"), ip],
              [t("cardRow.idType"), scope],
            ],
            { title: t("cardTitle.ipv6"), note: t("cardNote.addressLookup") }
          )
        );
      },
    };
  }
}

// ---------- 车牌号 ----------
export class PlateClassifier extends BaseClassifier {
  static priority = 62;

  match(item) {
    if (!item.isText) return false;
    const s = item.text.trim();
    // 长度护栏：车牌规范化后 7~9 位，原始串放宽到 12 以容纳分隔符
    if (s.length > 12 || s.length < 7) return false;
    return isPlate(s);
  }

  async parse(item) {
    const info = parsePlate(item.text);
    if (!info) return null;

    const rows = [
      [t("cardRow.idPlate"), info.plate],
      [t("cardRow.plateRegion"), info.region],
    ];
    // 发牌机关=城市，仅在确知城市时显示（不确定不瞎写）
    if (info.city) rows.push([t("cardRow.idIssuingAuthority"), info.city]);
    rows.push([t("cardRow.idType"), t(info.kindKey)]);
    if (info.isNewEnergy && info.energyType) {
      rows.push([t("cardRow.plateEnergy"), t(info.energyType)]);
    }

    return {
      actionKey: "id_plate",
      subtitle: t("cls.plate"),
      tplVars: { plate: info.plate },
      render: (el) => {
        el.appendChild(buildInfoCard(rows, { title: t("cardTitle.plate") }));
      },
    };
  }
}
