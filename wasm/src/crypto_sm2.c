/*
 * crypto_sm2.c — 国密 SM2 公钥加解密 WASM 导出（移植自 GmSSL 3.x，Apache-2.0）。
 *
 * 核心椭圆曲线运算与 SM2 加解密直接用 GmSSL 审计过的 sm2_enc.c / sm2_z256.c /
 * sm3.c，本文件只做：① 裸密钥装配（绕过 sm2_key.c 的 PEM/DER/x509 重依赖，
 * 直接用 32B 私钥标量 / 64B 公钥点构造 SM2_KEY）② 密文 C1C3C2 字节布局拼装
 * （避开 asn1 DER），不手抄密码算法本体。
 *
 * 随机数：GmSSL 的 rand_bytes 默认读 /dev/urandom，WASM 无此设备，故本文件
 * 提供同签名 rand_bytes 覆盖符号，走 EM_JS 接浏览器 crypto.getRandomValues。
 * 因此构建时不编 GmSSL 的 src/rand.c。
 *
 * 密文格式：C1(04||x||y, 65B) ‖ C3(SM3 摘要, 32B) ‖ C2(密文, 明文等长)，
 * 与 BouncyCastle / 主流国密在线工具默认输出一致。解密兼容 C1 有/无 04 前缀。
 *
 * 约定：返回 >=0 为写入 out 的字节数，返回负值为 CB_SM2_ERR_*。
 */
#include <string.h>
#include <stdint.h>
#include <stddef.h>
#include <emscripten.h>
#include "gmssl/sm2.h"
#include "gmssl/sm2_z256.h"

enum {
  CB_SM2_ERR_KEYLEN = -1,   /* 密钥长度非法 */
  CB_SM2_ERR_INLEN = -2,    /* 输入长度非法 */
  CB_SM2_ERR_CRYPT = -3,    /* 加/解密运算失败（点非法/摘要校验失败等） */
  CB_SM2_ERR_BUFFER = -4    /* 输出缓冲不足 */
};

#define C1_LEN 65   /* 04 || x(32) || y(32) */
#define C3_LEN 32   /* SM3 摘要 */

/* ---- 随机数：复用 crypto_rsa.c 里定义的 EM_JS 桥（浏览器 CSPRNG），
 *      避免重复定义 __em_js_cb_js_random 符号。EM_JS 编出的是普通 C 函数，
 *      跨编译单元 extern 声明即可调用。 ---- */
extern void cb_js_random(uint8_t *buf, size_t len);

int rand_bytes(uint8_t *buf, size_t len) {
  if (!buf) return -1;
  if (len == 0) return 0;
  cb_js_random(buf, len);
  return 1;
}

/*
 * SM2 加解密统一入口。
 * @param is_encrypt 1=公钥加密 / 0=私钥解密
 * @param key   加密：公钥 64B(x||y) 或 65B(04||x||y)；解密：私钥 32B 大端标量
 * @param keylen 密钥字节数
 * @param in    加密：明文；解密：密文 C1C3C2
 * @param inlen 输入长度
 * @param out/outcap 输出缓冲
 * @return 写入字节数或负错误码
 */
int cb_sm2_crypt(int is_encrypt, const uint8_t *key, size_t keylen,
                 const uint8_t *in, size_t inlen, uint8_t *out, size_t outcap) {
  SM2_KEY sm2key;
  memset(&sm2key, 0, sizeof(sm2key));

  if (is_encrypt) {
    /* ---- 公钥加密 ---- */
    if (inlen < SM2_MIN_PLAINTEXT_SIZE || inlen > SM2_MAX_PLAINTEXT_SIZE)
      return CB_SM2_ERR_INLEN;

    const uint8_t *pub = key;
    if (keylen == C1_LEN) {          /* 04 || x || y */
      if (key[0] != 0x04) return CB_SM2_ERR_KEYLEN;
      pub = key + 1;
    } else if (keylen != 64) {
      return CB_SM2_ERR_KEYLEN;
    }
    if (sm2_z256_point_from_bytes(&sm2key.public_key, pub) != 1)
      return CB_SM2_ERR_CRYPT;

    SM2_CIPHERTEXT c;
    if (sm2_do_encrypt(&sm2key, in, inlen, &c) != 1)
      return CB_SM2_ERR_CRYPT;

    /* 拼 C1(04||x||y) ‖ C3 ‖ C2 */
    size_t total = C1_LEN + C3_LEN + c.ciphertext_size;
    if (total > outcap) return CB_SM2_ERR_BUFFER;
    out[0] = 0x04;
    memcpy(out + 1, c.point.x, 32);
    memcpy(out + 33, c.point.y, 32);
    memcpy(out + C1_LEN, c.hash, C3_LEN);
    memcpy(out + C1_LEN + C3_LEN, c.ciphertext, c.ciphertext_size);
    return (int)total;
  } else {
    /* ---- 私钥解密 ---- */
    if (keylen != 32) return CB_SM2_ERR_KEYLEN;

    /* 装配私钥标量并推导公钥（do_decrypt 只用 private_key） */
    sm2_z256_from_bytes(sm2key.private_key, key);

    /* 解析密文：兼容 C1 带/不带 04 前缀 */
    const uint8_t *p = in;
    size_t len = inlen;
    if (len >= 1 && p[0] == 0x04 && len >= C1_LEN + C3_LEN + 1) {
      p += 1; len -= 1;               /* 跳过 04，剩 x||y||C3||C2 */
    }
    /* 此时 p 指向 x(32)||y(32)||C3(32)||C2 */
    if (len < 64 + C3_LEN + 1) return CB_SM2_ERR_INLEN;
    size_t c2len = len - 64 - C3_LEN;
    if (c2len > SM2_MAX_PLAINTEXT_SIZE) return CB_SM2_ERR_INLEN;

    SM2_CIPHERTEXT c;
    memset(&c, 0, sizeof(c));
    memcpy(c.point.x, p, 32);
    memcpy(c.point.y, p + 32, 32);
    memcpy(c.hash, p + 64, C3_LEN);
    c.ciphertext_size = (uint8_t)c2len;
    memcpy(c.ciphertext, p + 64 + C3_LEN, c2len);

    size_t outlen = 0;
    if (sm2_do_decrypt(&sm2key, &c, out, &outlen) != 1)
      return CB_SM2_ERR_CRYPT;
    if (outlen > outcap) return CB_SM2_ERR_BUFFER;
    return (int)outlen;
  }
}
