/**
 * ClassifierFactory — 分类器工厂 / 调度器。
 * 注册所有分类器，按 priority 降序做瀑布流判定，返回首个命中者的解析结果。
 */
import { TextClassifier } from "./classifiers/TextBase.js";
import { MediaClassifier, SvgClassifier, AudioVideoClassifier } from "./classifiers/MediaBase.js";
import { FileClassifier } from "./classifiers/FileBase.js";
import { EncodedScriptClassifier } from "./classifiers/EncodedScript.js";
import {
  JwtClassifier,
  UuidClassifier,
  CryptoAddressClassifier,
} from "./classifiers/token.js";
import {
  TimestampClassifier,
  ColorClassifier,
  NumberBaseClassifier,
} from "./classifiers/numeric.js";
import {
  UrlEncodingClassifier,
  HtmlEntityClassifier,
  UnicodeEscapeClassifier,
  MorseClassifier,
} from "./classifiers/encodedText.js";
import {
  IdCardClassifier,
  PhoneClassifier,
  BankCardClassifier,
  IpClassifier,
  Ipv6Classifier,
  MacClassifier,
  PlateClassifier,
} from "./classifiers/identity.js";
import {
  CsvClassifier,
  CronClassifier,
  UserAgentClassifier,
  SqlClassifier,
} from "./classifiers/structuredView.js";
import { MarkdownClassifier } from "./classifiers/markdown.js";
import {
  CodeClassifier,
  HtmlClassifier,
  XmlClassifier,
} from "./classifiers/codeView.js";
import {
  AddressClassifier,
  CoordClassifier,
  MathClassifier,
  IsbnClassifier,
  ExpressClassifier,
  PathClassifier,
} from "./classifiers/lifeView.js";
import {
  CipaiClassifier,
  PoetryClassifier,
  EmojiClassifier,
  ChineseTextClassifier,
  ForeignLangClassifier,
} from "./classifiers/culture.js";
import {
  BarcodeClassifier,
  ShareCodeClassifier,
  DeltaCodeClassifier,
} from "./classifiers/vertical.js";
import {
  ExtendedFileClassifier,
  PemClassifier,
} from "./classifiers/fileExtra.js";
import {
  BinaryClassifier,
  Ascii85Classifier,
  QuotedPrintableClassifier,
  UuencodeClassifier,
  Base32Classifier,
} from "./classifiers/codecAuto.js";

const REGISTRY = [
  // 身份信息（最高优先级，结构特异）
  IdCardClassifier,
  PhoneClassifier,
  BankCardClassifier,
  IpClassifier,
  Ipv6Classifier,
  MacClassifier,
  PlateClassifier,
  // 高特异性令牌/数值
  JwtClassifier,
  CryptoAddressClassifier,
  UuidClassifier,
  PemClassifier,
  ColorClassifier,
  UnicodeEscapeClassifier,
  NumberBaseClassifier,
  CronClassifier,
  MorseClassifier,
  // 编解码族（可直接识别解码）
  UuencodeClassifier,
  BinaryClassifier,
  Ascii85Classifier,
  QuotedPrintableClassifier,
  Base32Classifier,
  EmojiClassifier,
  CipaiClassifier,
  UserAgentClassifier,
  TimestampClassifier,
  UrlEncodingClassifier,
  HtmlEntityClassifier,
  // 生活信息
  CoordClassifier,
  MathClassifier,
  IsbnClassifier,
  BarcodeClassifier,
  AddressClassifier,
  ExpressClassifier,
  PathClassifier,
  // 垂直领域（分享码注册表）
  ShareCodeClassifier,
  DeltaCodeClassifier,
  // 既有
  MediaClassifier,
  SvgClassifier,
  AudioVideoClassifier,
  FileClassifier,
  ExtendedFileClassifier,
  EncodedScriptClassifier,
  // 文化（古诗词智能识别，优先于通用结构/文本）
  PoetryClassifier,
  // 结构化（优先级低于具体令牌，高于纯文本兜底）
  CsvClassifier,
  HtmlClassifier,
  MarkdownClassifier,
  XmlClassifier,
  SqlClassifier,
  CodeClassifier,
  // 文化语言（低优先级兜底）
  ForeignLangClassifier,
  ChineseTextClassifier,
  TextClassifier,
].sort((a, b) => b.priority - a.priority);

export class ClassifierFactory {
  /**
   * 返回首个命中者的解析结果（兼容旧调用）。
   * @param {import("./ClipboardItem.js").ClipItem} item
   * @returns {Promise<object|null>}
   */
  static async classify(item) {
    for (const Cls of REGISTRY) {
      const c = new Cls();
      if (c.match(item)) {
        return c.parse(item);
      }
    }
    return null;
  }

  /**
   * 多重解读：收集所有命中的分类器，按优先级（置信度代理）降序。
   * 主结果为首个，其余作为「也可能是」候选。
   * @param {import("./ClipboardItem.js").ClipItem} item
   * @returns {Promise<Array<{result:object, priority:number}>>}
   */
  static async classifyAll(item) {
    const hits = [];
    for (const Cls of REGISTRY) {
      const c = new Cls();
      try {
        if (c.match(item)) hits.push(Cls);
      } catch {
        /* 单个分类器异常不影响整体 */
      }
    }
    // 已按 REGISTRY 的优先级降序排列
    const results = [];
    for (const Cls of hits) {
      try {
        const r = await new Cls().parse(item);
        if (r) results.push({ result: r, priority: Cls.priority });
      } catch {
        /* 解析失败跳过 */
      }
    }
    return results;
  }
}
