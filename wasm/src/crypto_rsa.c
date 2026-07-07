/*
 * crypto_rsa.c — RSA 加解密 WASM 导出（移植自 mbedTLS 2.28.10，Apache-2.0）。
 *
 * 支持 PEM/DER 公私钥解析、PKCS#1 v1.5 与 OAEP 加解密。
 * 加密需随机填充 → f_rng 回调走 EM_JS 接浏览器 crypto.getRandomValues。
 * 密钥字节串由 JS 侧封送（PEM 需带结尾 NUL，keylen 含该 NUL）。
 *
 * 约定：返回 >=0 为写入 out 的字节数，返回负值为 CB_RSA_ERR_*。
 */
#include <string.h>
#include <stdint.h>
#include <stddef.h>
#include "mbedtls/pk.h"
#include "mbedtls/rsa.h"
#include <emscripten.h>

enum {
  CB_RSA_ERR_PARSE = -1,    /* 密钥解析失败 */
  CB_RSA_ERR_NOTRSA = -2,   /* 不是 RSA 钥 */
  CB_RSA_ERR_CRYPT = -3,    /* 加/解密运算失败 */
  CB_RSA_ERR_BUFFER = -4    /* 输出缓冲不足 */
};

/* 从 JS 拿真随机字节填入 buf。emcc 将其编译为调 crypto.getRandomValues。 */
EM_JS(void, cb_js_random, (uint8_t *buf, size_t len), {
  var g = (typeof crypto !== "undefined") ? crypto
        : (typeof require === "function" ? require("crypto").webcrypto : null);
  var view = HEAPU8.subarray(buf, buf + len);
  if (g && g.getRandomValues) {
    /* getRandomValues 单次上限 65536 字节，分段 */
    for (var off = 0; off < len; off += 65536) {
      g.getRandomValues(view.subarray(off, Math.min(off + 65536, len)));
    }
  } else {
    for (var i = 0; i < len; i++) view[i] = (Math.random() * 256) | 0;
  }
});

/* mbedtls f_rng 回调签名 */
static int cb_rng(void *p, unsigned char *out, size_t len) {
  (void)p;
  cb_js_random(out, len);
  return 0;
}

/*
 * RSA 加/解密。
 * @param is_encrypt 1=加密(用公钥) 0=解密(用私钥)
 * @param use_oaep   1=OAEP(v21,SHA-1) 0=PKCS#1 v1.5
 * @param key/keylen 密钥字节（PEM 需含结尾 NUL 且 keylen 计入；DER 按实长）
 * @param in/inlen   明文或密文
 * @param out/outcap 输出缓冲
 * @return 写入字节数或负错误码
 */
int cb_rsa_crypt(int is_encrypt, int use_oaep,
                 const uint8_t *key, size_t keylen,
                 const uint8_t *in, size_t inlen,
                 uint8_t *out, size_t outcap) {
  mbedtls_pk_context pk;
  mbedtls_pk_init(&pk);
  int rc;
  if (is_encrypt)
    rc = mbedtls_pk_parse_public_key(&pk, key, keylen);
  else
    rc = mbedtls_pk_parse_key(&pk, key, keylen, NULL, 0);
  if (rc != 0) { mbedtls_pk_free(&pk); return CB_RSA_ERR_PARSE; }

  if (mbedtls_pk_get_type(&pk) != MBEDTLS_PK_RSA) {
    mbedtls_pk_free(&pk);
    return CB_RSA_ERR_NOTRSA;
  }
  mbedtls_rsa_context *rsa = mbedtls_pk_rsa(pk);

  int padding = use_oaep ? MBEDTLS_RSA_PKCS_V21 : MBEDTLS_RSA_PKCS_V15;
  int hash_id = use_oaep ? MBEDTLS_MD_SHA1 : MBEDTLS_MD_NONE;
  mbedtls_rsa_set_padding(rsa, padding, hash_id);

  size_t klen = mbedtls_rsa_get_len(rsa);
  int ret;
  if (is_encrypt) {
    if (outcap < klen) { mbedtls_pk_free(&pk); return CB_RSA_ERR_BUFFER; }
    ret = mbedtls_rsa_pkcs1_encrypt(rsa, cb_rng, NULL,
                                    MBEDTLS_RSA_PUBLIC, inlen, in, out);
    mbedtls_pk_free(&pk);
    return ret != 0 ? CB_RSA_ERR_CRYPT : (int)klen;
  } else {
    size_t olen = 0;
    ret = mbedtls_rsa_pkcs1_decrypt(rsa, cb_rng, NULL,
                                    MBEDTLS_RSA_PRIVATE, &olen, in, out, outcap);
    mbedtls_pk_free(&pk);
    return ret != 0 ? CB_RSA_ERR_CRYPT : (int)olen;
  }
}
