/**
 * cryptoTool.js — 重型加密工具箱接入层（AES/DES/3DES/RC4/ChaCha20/RSA）。
 * 把 WasmBridge 的字节级 symCrypt/rsaCrypt 包成工具箱要的「字符串进字符串出」同步 fn。
 * 密钥/IV/输入/输出的字节↔文本解释走可选编码（utf8/hex/base64），CTF 与日常习惯都覆盖。
 * 前提：WASM 必须已 ready（识别流程 await 过，进工具箱时已就绪）。
 */
import { WasmBridge } from "../wasm/bridge.js";
import { t } from "../i18n/i18n.js";

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

/* ---- 字节 ↔ 文本编码解释 ---- */
function bytesFromText(text, coding) {
  if (coding === "hex") {
    const h = text.replace(/[\s:]/g, "");
    if (h.length % 2 !== 0 || /[^0-9a-fA-F]/.test(h)) throw new Error(t("cryptoTool.errHex"));
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  if (coding === "base64") {
    const bin = atob(text.replace(/\s/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return enc.encode(text); // utf8
}

function textFromBytes(bytes, coding) {
  if (coding === "hex") {
    let s = "";
    for (const b of bytes) s += b.toString(16).padStart(2, "0");
    return s;
  }
  if (coding === "base64") {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return dec.decode(bytes); // utf8
}

/* ---- 错误码 → i18n 文案 ---- */
function mapErr(code) {
  const M = {
    "-1": "cryptoTool.errAlgo", "-2": "cryptoTool.errKeyLen", "-3": "cryptoTool.errIvLen",
    "-4": "cryptoTool.errInLen", "-5": "cryptoTool.errBuffer", "-6": "cryptoTool.errPad",
    "-7": "cryptoTool.errLib",
  };
  return t(M[String(code)] || "cryptoTool.errLib");
}

/* ---- 对称：构造一个注册项 fn/encode ---- */
function symRun(algo, dir, text, params) {
  const keyCoding = params.keyCoding || "utf8";
  const ivCoding = params.ivCoding || "utf8";
  const inCoding = dir === "encode" ? "utf8" : (params.ctCoding || "base64");
  const outCoding = dir === "encode" ? (params.ctCoding || "base64") : "utf8";

  const key = bytesFromText(params.key || "", keyCoding);
  const iv = params.iv ? bytesFromText(params.iv, ivCoding) : new Uint8Array(0);
  const data = bytesFromText(text, inCoding);

  const algoName = typeof algo === "number"
    ? ["", "aes", "des", "des3", "rc4", "chacha20"][algo]
    : algo;
  const r = WasmBridge.symCrypt({
    algo: algoName, op: dir === "encode" ? "enc" : "dec",
    key, iv, mode: params.mode || "cbc",
    counter: 0, pad: params.pad !== "0",
    data,
  });
  if (r == null) throw new Error(t("cryptoTool.errNoWasm"));
  if (r.error !== undefined) throw new Error(mapErr(r.error));
  return textFromBytes(r, outCoding);
}

/* ---- SM4：走独立 sm4Crypt 桥（国密对称）---- */
function sm4Run(dir, text, params) {
  const keyCoding = params.keyCoding || "utf8";
  const ivCoding = params.ivCoding || "utf8";
  const inCoding = dir === "encode" ? "utf8" : (params.ctCoding || "base64");
  const outCoding = dir === "encode" ? (params.ctCoding || "base64") : "utf8";

  const key = bytesFromText(params.key || "", keyCoding);
  const iv = params.iv ? bytesFromText(params.iv, ivCoding) : new Uint8Array(0);
  const data = bytesFromText(text, inCoding);

  const r = WasmBridge.sm4Crypt({
    op: dir === "encode" ? "enc" : "dec",
    key, iv, mode: params.mode || "cbc",
    pad: params.pad !== "0",
    data,
  });
  if (r == null) throw new Error(t("cryptoTool.errNoWasm"));
  if (r.error !== undefined) throw new Error(mapErr(r.error));
  return textFromBytes(r, outCoding);
}

/* ---- RSA：构造注册项 ---- */
function rsaRun(dir, text, params) {
  const inCoding = dir === "encode" ? "utf8" : (params.ctCoding || "base64");
  const outCoding = dir === "encode" ? (params.ctCoding || "base64") : "utf8";
  const key = enc.encode(params.key || ""); // PEM 文本原样字节
  const data = bytesFromText(text, inCoding);
  const r = WasmBridge.rsaCrypt({
    op: dir === "encode" ? "enc" : "dec",
    oaep: params.padding === "oaep",
    key, data,
  });
  if (r == null) throw new Error(t("cryptoTool.errNoWasm"));
  if (r.error !== undefined) throw new Error(mapErr(r.error));
  return textFromBytes(r, outCoding);
}

/* ---- SM2 国密公钥加解密：密钥走 hex（公钥 64/65B、私钥 32B） ---- */
function sm2Run(dir, text, params) {
  const inCoding = dir === "encode" ? "utf8" : (params.ctCoding || "base64");
  const outCoding = dir === "encode" ? (params.ctCoding || "base64") : "utf8";
  // 加密用公钥、解密用私钥，均按 hex 解释
  const key = bytesFromText((params.key || "").trim(), "hex");
  const data = bytesFromText(text, inCoding);
  const r = WasmBridge.sm2Crypt({
    op: dir === "encode" ? "enc" : "dec",
    key, data,
  });
  if (r == null) throw new Error(t("cryptoTool.errNoWasm"));
  if (r.error !== undefined) throw new Error(mapErr(r.error));
  return textFromBytes(r, outCoding);
}

/* ---- 参数定义（复用） ---- */
const codingOpts = [
  { value: "utf8", labelKey: "cryptoParam.utf8" },
  { value: "hex", labelKey: "cryptoParam.hex" },
  { value: "base64", labelKey: "cryptoParam.base64" },
];
const keyCodingParam = { name: "keyCoding", labelKey: "cryptoParam.keyCoding", type: "select", options: codingOpts, default: "utf8" };
const ivCodingParam = { name: "ivCoding", labelKey: "cryptoParam.ivCoding", type: "select", options: codingOpts, default: "utf8" };
const ctCodingParam = { name: "ctCoding", labelKey: "cryptoParam.ctCoding", type: "select", options: codingOpts, default: "base64" };

const modeParam = {
  name: "mode", labelKey: "cryptoParam.mode", type: "select",
  options: [
    { value: "cbc", label: "CBC" }, { value: "ecb", label: "ECB" }, { value: "ctr", label: "CTR" },
  ], default: "cbc",
};
const keyParam = { name: "key", labelKey: "cryptoParam.key", type: "text", default: "" };
const ivParam = { name: "iv", labelKey: "cryptoParam.iv", type: "text", default: "" };
const padParam = {
  name: "pad", labelKey: "cryptoParam.pad", type: "select",
  options: [{ value: "1", labelKey: "cryptoParam.padOn" }, { value: "0", labelKey: "cryptoParam.padOff" }],
  default: "1",
};

/* ---- 对称注册项工厂 ---- */
function symDef(algo, labelKey, cat, extraParams = []) {
  return {
    labelKey, cat,
    params: [keyParam, keyCodingParam, ivParam, ivCodingParam, modeParam, padParam, ctCodingParam, ...extraParams],
    fn: (text, p) => symRun(algo, "decode", text, p),
    encode: (text, p) => symRun(algo, "encode", text, p),
  };
}

function sm4Def(labelKey) {
  return {
    labelKey, cat: "modern",
    params: [keyParam, keyCodingParam, ivParam, ivCodingParam, modeParam, padParam, ctCodingParam],
    fn: (text, p) => sm4Run("decode", text, p),
    encode: (text, p) => sm4Run("encode", text, p),
  };
}

/* ---- 导出：给 ciphers.js 注册用的定义表 ---- */
export const CRYPTO_CIPHERS = {
  aes: symDef(1, "cipher.aes", "modern"),
  des: symDef(2, "cipher.des", "modern"),
  des3: symDef(3, "cipher.des3", "modern"),
  rc4: {
    labelKey: "cipher.rc4", cat: "modern",
    params: [keyParam, keyCodingParam, ctCodingParam],
    fn: (text, p) => symRun(4, "decode", text, p),
    encode: (text, p) => symRun(4, "encode", text, p),
  },
  chacha20: {
    labelKey: "cipher.chacha20", cat: "modern",
    params: [keyParam, keyCodingParam, ivParam, ivCodingParam, ctCodingParam],
    fn: (text, p) => symRun(5, "decode", text, p),
    encode: (text, p) => symRun(5, "encode", text, p),
  },
  sm4: sm4Def("cipher.sm4"),
  rsa: {
    labelKey: "cipher.rsa", cat: "modern",
    params: [
      { name: "key", labelKey: "cryptoParam.rsaKey", type: "textarea", default: "" },
      { name: "padding", labelKey: "cryptoParam.rsaPad", type: "select",
        options: [{ value: "pkcs1", label: "PKCS#1 v1.5" }, { value: "oaep", label: "OAEP" }], default: "pkcs1" },
      ctCodingParam,
    ],
    fn: (text, p) => rsaRun("decode", text, p),
    encode: (text, p) => rsaRun("encode", text, p),
  },
  sm2: {
    labelKey: "cipher.sm2", cat: "modern",
    params: [
      { name: "key", labelKey: "cryptoParam.sm2Key", type: "textarea", default: "" },
      ctCodingParam,
    ],
    fn: (text, p) => sm2Run("decode", text, p),
    encode: (text, p) => sm2Run("encode", text, p),
  },
};
