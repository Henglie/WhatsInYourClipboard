/**
 * bridge.js — JS ↔ WASM 唯一桥接层（双模式）。
 *
 * 探测到 public/core.wasm 即用 WASM 实现；否则回退纯 JS。
 * 对外签名恒定：detectMagic / hexdump / sha256 / parsePE，
 * 上层无需关心底层是 WASM 还是 JS。
 */

// 类型枚举：与 C 侧 CB_TYPE_* 对齐
export const CB_TYPE = {
  UNKNOWN: 0,
  PNG: 1,
  JPEG: 2,
  GIF: 3,
  PE: 4,
  ZIP: 5,
  PDF: 6,
};

const MAGIC = [
  { type: CB_TYPE.PNG, sig: [0x89, 0x50, 0x4e, 0x47] },
  { type: CB_TYPE.JPEG, sig: [0xff, 0xd8, 0xff] },
  { type: CB_TYPE.GIF, sig: [0x47, 0x49, 0x46, 0x38] },
  { type: CB_TYPE.PE, sig: [0x4d, 0x5a] }, // MZ
  { type: CB_TYPE.ZIP, sig: [0x50, 0x4b, 0x03, 0x04] },
  { type: CB_TYPE.PDF, sig: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

function startsWith(bytes, sig) {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

// ---- WASM 运行时句柄。null 表示未加载（走纯 JS） ----
let _mod = null;
let _readyPromise = null;

/** 尝试加载并实例化 WASM 模块；失败则保持 _mod=null（回退 JS） */
async function loadWasm() {
  try {
    // emcc MODULARIZE 产物：public/core.loader.js 导出 createCoreModule 工厂
    const factory = await import(
      /* @vite-ignore */ "../../public/core.loader.js"
    );
    const create = factory.default || factory.createCoreModule;
    if (typeof create !== "function") return false;
    _mod = await create();
    return true;
  } catch {
    _mod = null; // 没编译 .wasm 或加载失败 → 纯 JS
    return false;
  }
}

/** WASM 缓冲区封装：分配输入/输出、调用、读回、确保释放 */
function withBuffers(inBytes, outCap, fn) {
  const inPtr = _mod._cb_malloc(inBytes.length || 1);
  const outPtr = outCap > 0 ? _mod._cb_malloc(outCap) : 0;
  try {
    _mod.HEAPU8.set(inBytes, inPtr);
    return fn(inPtr, inBytes.length, outPtr, outCap);
  } finally {
    _mod._cb_free(inPtr);
    if (outPtr) _mod._cb_free(outPtr);
  }
}

export const WasmBridge = {
  /** 是否当前由 WASM 驱动（供调试/状态显示） */
  get usingWasm() {
    return _mod !== null;
  },

  /** 等待计算层就绪。优先 WASM，失败回退纯 JS。 */
  async ready() {
    if (!_readyPromise) _readyPromise = loadWasm();
    await _readyPromise;
    return true;
  },


  /** 特征码探测 → 返回 CB_TYPE 枚举 */
  detectMagic(u8) {
    if (_mod) {
      return withBuffers(u8, 0, (inPtr, len) =>
        _mod._cb_detect_magic(inPtr, len)
      );
    }
    for (const { type, sig } of MAGIC) {
      if (startsWith(u8, sig)) return type;
    }
    return CB_TYPE.UNKNOWN;
  },

  /**
   * 生成 Hex 矩阵：偏移 | 16 字节十六进制 | ASCII 旁注。
   * @param {Uint8Array} u8
   * @param {number} [maxBytes] 截断上限，避免超大数据卡死
   * @returns {string}
   */
  hexdump(u8, maxBytes = 4096) {
    if (_mod) {
      const len = Math.min(u8.length, maxBytes);
      const slice = u8.subarray(0, len);
      const outCap = (Math.ceil(len / 16) + 1) * 80 + 64;
      return withBuffers(slice, outCap, (inPtr, n, outPtr, cap) => {
        const written = _mod._cb_hexdump(inPtr, n, outPtr, cap);
        if (written < 0) return "";
        return _mod.UTF8ToString(outPtr, written);
      });
    }
    const len = Math.min(u8.length, maxBytes);
    const lines = [];
    for (let off = 0; off < len; off += 16) {
      const slice = u8.subarray(off, Math.min(off + 16, len));
      const offset = off.toString(16).padStart(8, "0");

      let hex = "";
      let ascii = "";
      for (let i = 0; i < 16; i++) {
        if (i < slice.length) {
          const b = slice[i];
          hex += b.toString(16).padStart(2, "0") + " ";
          ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
        } else {
          hex += "   ";
        }
        if (i === 7) hex += " ";
      }
      lines.push(`${offset}  ${hex} |${ascii}|`);
    }
    if (u8.length > maxBytes) {
      lines.push(`\n… 已截断，共 ${u8.length} 字节（显示前 ${maxBytes} 字节）`);
    }
    return lines.join("\n");
  },

  /** SHA-256 十六进制摘要。WASM 优先，否则 Web Crypto。 */
  async sha256(u8) {
    if (_mod) {
      return withBuffers(u8, 65, (inPtr, len, outPtr, cap) => {
        const w = _mod._cb_sha256(inPtr, len, outPtr, cap);
        return w < 0 ? "" : _mod.UTF8ToString(outPtr, w);
      });
    }
    const buf = await crypto.subtle.digest("SHA-256", u8);
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },

  /** MD5 十六进制摘要。需 WASM；未加载时返回 null（Web Crypto 不支持 MD5）。 */
  md5(u8) {
    if (!_mod) return null;
    return withBuffers(u8, 33, (inPtr, len, outPtr, cap) => {
      const w = _mod._cb_md5(inPtr, len, outPtr, cap);
      return w < 0 ? null : _mod.UTF8ToString(outPtr, w);
    });
  },

  /** SHA-1 十六进制摘要。WASM 优先，否则 Web Crypto(SHA-1)。 */
  async sha1(u8) {
    if (_mod) {
      return withBuffers(u8, 41, (inPtr, len, outPtr, cap) => {
        const w = _mod._cb_sha1(inPtr, len, outPtr, cap);
        return w < 0 ? "" : _mod.UTF8ToString(outPtr, w);
      });
    }
    const buf = await crypto.subtle.digest("SHA-1", u8);
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },

  /** PE 头解析。WASM 返回完整 JSON；JS 回退仅架构。 */
  parsePE(u8) {
    if (_mod) {
      const json = withBuffers(u8, 256, (inPtr, len, outPtr, cap) => {
        const w = _mod._cb_parse_pe(inPtr, len, outPtr, cap);
        return w < 0 ? null : _mod.UTF8ToString(outPtr, w);
      });
      if (!json) return null;
      try {
        const pe = JSON.parse(json);
        // WASM 侧 arch 是中文字面量；归一成 i18n 键，与 JS 回退路径一致，
        // 否则英文模式下会原样显示中文。无对应键的（如 0x.. 原始值）保留。
        const archKeyMap = {
          "x86 (32位)": "cardRow.archX86",
          "x64 (64位)": "cardRow.archX64",
          ARM64: "cardRow.archARM64",
          ARM: "cardRow.archARM",
          未知: "cardRow.unknown",
        };
        if (pe.arch && archKeyMap[pe.arch]) pe.arch = archKeyMap[pe.arch];
        return pe;
      } catch {
        return null;
      }
    }
    if (!startsWith(u8, [0x4d, 0x5a])) return null;
    // e_lfanew @ 0x3C → PE header 偏移
    if (u8.length < 0x40) return null;
    const peOff = u8[0x3c] | (u8[0x3d] << 8) | (u8[0x3e] << 16) | (u8[0x3f] << 24);
    // 越界保护：PE 头需至少 24 字节（COFF 头 + Characteristics）
    if (peOff + 24 > u8.length) return { arch: "cardRow.unknown" };
    if (u8[peOff] !== 0x50 || u8[peOff + 1] !== 0x45) return { arch: "cardRow.unknown" };
    const machine = u8[peOff + 4] | (u8[peOff + 5] << 8);
    const archMap = { 0x014c: "cardRow.archX86", 0x8664: "cardRow.archX64", 0xaa64: "cardRow.archARM64", 0x01c0: "cardRow.archARM" };
    const sections = u8[peOff + 6] | (u8[peOff + 7] << 8);
    const timestamp =
      (u8[peOff + 8] | (u8[peOff + 9] << 8) | (u8[peOff + 10] << 16) | (u8[peOff + 11] << 24)) >>> 0;
    const chars = u8[peOff + 22] | (u8[peOff + 23] << 8);
    return {
      arch: archMap[machine] || `0x${machine.toString(16)}`,
      kind: chars & 0x2000 ? "DLL" : "EXE",
      sections,
      timestamp,
    };
  },

  /**
   * 对称加解密（AES/DES/3DES/RC4/ChaCha20）。需 WASM，未加载返回 null。
   * @param {object} o
   * @param {"aes"|"des"|"des3"|"rc4"|"chacha20"} o.algo
   * @param {"enc"|"dec"} o.op
   * @param {Uint8Array} o.key
   * @param {Uint8Array} [o.iv] CBC/CTR 或 ChaCha20 nonce(12B)
   * @param {"ecb"|"cbc"|"ctr"} [o.mode="cbc"] 块密码模式（流密码忽略）
   * @param {number} [o.counter=0] ChaCha20 初始计数器
   * @param {boolean} [o.pad=true] ECB/CBC 是否 PKCS7
   * @param {Uint8Array} o.data 明文或密文
   * @returns {Uint8Array|{error:(number|string)}|null}
   */
  symCrypt({ algo, op, key, iv = new Uint8Array(0), mode = "cbc", counter = 0, pad = true, data }) {
    if (!_mod) return null;
    const ALGO = { aes: 1, des: 2, des3: 3, rc4: 4, chacha20: 5 };
    const MODE = { ecb: 0, cbc: 1, ctr: 2 };
    const a = ALGO[algo];
    if (!a) return { error: "algo" };
    const m = MODE[mode] ?? 1;
    const encdec = op === "dec" ? 1 : 0;
    const doPad = pad ? 1 : 0;
    const outCap = data.length + 32; // 含 PKCS7 最多补一整块
    const keyPtr = _mod._cb_malloc(key.length || 1);
    const ivPtr = _mod._cb_malloc(iv.length || 1);
    const inPtr = _mod._cb_malloc(data.length || 1);
    const outPtr = _mod._cb_malloc(outCap);
    try {
      _mod.HEAPU8.set(key, keyPtr);
      if (iv.length) _mod.HEAPU8.set(iv, ivPtr);
      _mod.HEAPU8.set(data, inPtr);
      const w = _mod._cb_sym_crypt(a, encdec, keyPtr, key.length, ivPtr, iv.length,
                                   m, counter >>> 0, doPad, inPtr, data.length, outPtr, outCap);
      if (w < 0) return { error: w };
      return _mod.HEAPU8.slice(outPtr, outPtr + w);
    } finally {
      _mod._cb_free(keyPtr);
      _mod._cb_free(ivPtr);
      _mod._cb_free(inPtr);
      _mod._cb_free(outPtr);
    }
  },

  /**
   * SM4 加解密（国密对称，128 位块）。需 WASM，未加载返回 null。
   * @param {object} o
   * @param {"enc"|"dec"} o.op
   * @param {Uint8Array} o.key 16 字节密钥
   * @param {Uint8Array} [o.iv] CBC/CTR 用 16 字节；ECB 传空
   * @param {"ecb"|"cbc"|"ctr"} [o.mode="cbc"]
   * @param {boolean} [o.pad=true] PKCS7（仅 ECB/CBC）
   * @param {Uint8Array} o.data
   * @returns {Uint8Array|{error:number}|null}
   */
  sm4Crypt({ op, key, iv = new Uint8Array(0), mode = "cbc", pad = true, data }) {
    if (!_mod) return null;
    const MODE = { ecb: 0, cbc: 1, ctr: 2 };
    const m = MODE[mode] ?? 1;
    const encdec = op === "dec" ? 1 : 0;
    const doPad = pad ? 1 : 0;
    const outCap = data.length + 32;
    const keyPtr = _mod._cb_malloc(key.length || 1);
    const ivPtr = _mod._cb_malloc(iv.length || 1);
    const inPtr = _mod._cb_malloc(data.length || 1);
    const outPtr = _mod._cb_malloc(outCap);
    try {
      _mod.HEAPU8.set(key, keyPtr);
      if (iv.length) _mod.HEAPU8.set(iv, ivPtr);
      _mod.HEAPU8.set(data, inPtr);
      const w = _mod._cb_sm4_crypt(encdec, keyPtr, key.length, ivPtr, iv.length,
                                   m, doPad, inPtr, data.length, outPtr, outCap);
      if (w < 0) return { error: w };
      return _mod.HEAPU8.slice(outPtr, outPtr + w);
    } finally {
      _mod._cb_free(keyPtr);
      _mod._cb_free(ivPtr);
      _mod._cb_free(inPtr);
      _mod._cb_free(outPtr);
    }
  },

  /**
   * SM2 国密公钥加解密。需 WASM，未加载返回 null。
   * @param {object} o
   * @param {"enc"|"dec"} o.op enc=公钥加密 / dec=私钥解密
   * @param {Uint8Array} o.key 加密:公钥 64B(x||y) 或 65B(04||x||y);解密:私钥 32B 大端
   * @param {Uint8Array} o.data 加密:明文;解密:密文 C1C3C2(C1 可带/不带 04)
   * @returns {Uint8Array|{error:number}|null}
   */
  sm2Crypt({ op, key, data }) {
    if (!_mod) return null;
    const isEnc = op === "dec" ? 0 : 1;
    const outCap = data.length + 128; // 加密含 C1(65)+C3(32) 头;解密必小于密文
    const keyPtr = _mod._cb_malloc(key.length || 1);
    const inPtr = _mod._cb_malloc(data.length || 1);
    const outPtr = _mod._cb_malloc(outCap);
    try {
      _mod.HEAPU8.set(key, keyPtr);
      _mod.HEAPU8.set(data, inPtr);
      const w = _mod._cb_sm2_crypt(isEnc, keyPtr, key.length, inPtr, data.length, outPtr, outCap);
      if (w < 0) return { error: w };
      return _mod.HEAPU8.slice(outPtr, outPtr + w);
    } finally {
      _mod._cb_free(keyPtr);
      _mod._cb_free(inPtr);
      _mod._cb_free(outPtr);
    }
  },

  /**
   * RSA 加解密。需 WASM，未加载返回 null。
   * @param {object} o
   * @param {"enc"|"dec"} o.op enc=公钥加密 / dec=私钥解密
   * @param {boolean} [o.oaep=false] true=OAEP(SHA-1) / false=PKCS#1 v1.5
   * @param {Uint8Array} o.key PEM(自动补结尾 NUL)或 DER 密钥
   * @param {Uint8Array} o.data
   * @returns {Uint8Array|{error:number}|null}
   */
  rsaCrypt({ op, oaep = false, key, data }) {
    if (!_mod) return null;
    let keyBytes = key;
    const isPem = key.length > 10 && key[0] === 0x2d && key[1] === 0x2d; // 前导 --
    if (isPem && key[key.length - 1] !== 0) {
      keyBytes = new Uint8Array(key.length + 1); // 末位默认 0，即结尾 NUL
      keyBytes.set(key);
    }
    const isEnc = op === "enc" ? 1 : 0;
    const useOaep = oaep ? 1 : 0;
    const outCap = 1024; // 支持到 RSA-8192 模长
    const keyPtr = _mod._cb_malloc(keyBytes.length);
    const inPtr = _mod._cb_malloc(data.length || 1);
    const outPtr = _mod._cb_malloc(outCap);
    try {
      _mod.HEAPU8.set(keyBytes, keyPtr);
      _mod.HEAPU8.set(data, inPtr);
      const w = _mod._cb_rsa_crypt(isEnc, useOaep, keyPtr, keyBytes.length,
                                   inPtr, data.length, outPtr, outCap);
      if (w < 0) return { error: w };
      return _mod.HEAPU8.slice(outPtr, outPtr + w);
    } finally {
      _mod._cb_free(keyPtr);
      _mod._cb_free(inPtr);
      _mod._cb_free(outPtr);
    }
  },
};
