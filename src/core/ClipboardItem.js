/**
 * ClipboardItem — 统一数据模型。
 * 不论文本还是二进制，最终都规整为 { bytes, mime, text, meta }。
 */
export class ClipItem {
  /**
   * @param {object} init
   * @param {Uint8Array} init.bytes  原始字节（文本经 UTF-8 编码后的字节）
   * @param {string} init.mime       MIME 类型，如 "text/plain"、"image/png"
   * @param {string} [init.text]     若为文本，保留解码后的字符串
   * @param {object} [init.meta]     分类器补充的元信息
   */
  constructor({ bytes, mime, text = null, meta = {} }) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.mime = mime || "application/octet-stream";
    this.text = text;
    this.meta = meta;
  }

  get size() {
    return this.bytes.length;
  }

  get isText() {
    return this.text !== null;
  }
}
