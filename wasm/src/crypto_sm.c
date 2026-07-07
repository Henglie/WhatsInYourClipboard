/*
 * crypto_sm.c — 国密对称加解密 WASM 导出（SM4；移植自 GmSSL 3.x，Apache-2.0）。
 *
 * 核心轮函数直接用 GmSSL 审计过的 sm4.c（sm4_set_encrypt_key/sm4_set_decrypt_key/
 * sm4_encrypt 单块）。本文件只做标准分组模式包装（ECB/CBC/CTR + 可选 PKCS7），
 * 与 crypto_sym.c 里循环调 mbedtls 单块 ECB 同性质，不手抄密码算法本体。
 *
 * SM2 见 crypto_sm2.c（走独立 EM_JS 随机数桥）。
 *
 * 约定：返回 >=0 为写入 out 的字节数，返回负值为 CB_SM_ERR_*。
 */
#include <string.h>
#include <stdint.h>
#include <stddef.h>
#include "gmssl/sm4.h"

/* 与 crypto_sym.c 的错误码保持同值语义，便于 JS 侧统一映射 */
enum {
  CB_SM_ERR_ALGO = -1,   /* 模式不支持 */
  CB_SM_ERR_KEYLEN = -2, /* 密钥长度非法 */
  CB_SM_ERR_IVLEN = -3,  /* IV 长度非法 */
  CB_SM_ERR_INLEN = -4,  /* 输入长度非法（未对齐等） */
  CB_SM_ERR_BUFFER = -5, /* 输出缓冲不足 */
  CB_SM_ERR_PAD = -6,    /* PKCS7 去填充失败 */
  CB_SM_ERR_LIB = -7     /* 底层库返回错误 */
};

enum { CB_SM_MODE_ECB = 0, CB_SM_MODE_CBC = 1, CB_SM_MODE_CTR = 2 };
enum { CB_SM_ENC = 0, CB_SM_DEC = 1 };

#define SM4_BLK 16

/* PKCS7 补齐：len 字节补到块整数倍，返回补后长度 */
static int sm_pkcs7_pad(uint8_t *buf, size_t len, size_t cap, size_t block) {
  size_t pad = block - (len % block);
  if (pad == 0) pad = block; /* 已对齐也补一整块 */
  if (len + pad > cap) return CB_SM_ERR_BUFFER;
  for (size_t i = 0; i < pad; i++) buf[len + i] = (uint8_t)pad;
  return (int)(len + pad);
}

/* PKCS7 去填充：校验并返回去填充后长度 */
static int sm_pkcs7_unpad(const uint8_t *buf, size_t len, size_t block) {
  if (len == 0 || (len % block) != 0) return CB_SM_ERR_PAD;
  uint8_t pad = buf[len - 1];
  if (pad == 0 || pad > block) return CB_SM_ERR_PAD;
  for (size_t i = 0; i < pad; i++)
    if (buf[len - 1 - i] != pad) return CB_SM_ERR_PAD;
  return (int)(len - pad);
}

/* 16 字节大端计数器 +1（CTR 用） */
static void ctr_inc(uint8_t ctr[SM4_BLK]) {
  for (int i = SM4_BLK - 1; i >= 0; i--) {
    if (++ctr[i] != 0) break;
  }
}

/*
 * SM4 统一加解密。
 * @param encdec  CB_SM_ENC / CB_SM_DEC
 * @param key     16 字节密钥
 * @param keylen  必须 16
 * @param iv      CBC/CTR 用 16 字节；ECB 传 NULL
 * @param ivlen   IV 长度（CBC/CTR 须 16）
 * @param mode    CB_SM_MODE_*
 * @param do_pad  是否 PKCS7（仅 ECB/CBC 有效；1=启用）
 * @param in/inlen 输入
 * @param out/outcap 输出缓冲
 * @return 写入字节数或负错误码
 */
int cb_sm4_crypt(int encdec, const uint8_t *key, size_t keylen,
                 const uint8_t *iv, size_t ivlen, int mode, int do_pad,
                 const uint8_t *in, size_t inlen, uint8_t *out, size_t outcap) {
  if (keylen != SM4_KEY_SIZE) return CB_SM_ERR_KEYLEN;
  if (mode < CB_SM_MODE_ECB || mode > CB_SM_MODE_CTR) return CB_SM_ERR_ALGO;
  if ((mode == CB_SM_MODE_CBC || mode == CB_SM_MODE_CTR) && ivlen != SM4_BLK)
    return CB_SM_ERR_IVLEN;

  /* ---- CTR：流式，加解密对称，恒用 encrypt schedule ---- */
  if (mode == CB_SM_MODE_CTR) {
    if (inlen > outcap) return CB_SM_ERR_BUFFER;
    SM4_KEY sk;
    sm4_set_encrypt_key(&sk, key);
    uint8_t ctr[SM4_BLK], ks[SM4_BLK];
    memcpy(ctr, iv, SM4_BLK);
    size_t off = 0;
    while (off < inlen) {
      sm4_encrypt(&sk, ctr, ks);
      size_t n = inlen - off;
      if (n > SM4_BLK) n = SM4_BLK;
      for (size_t i = 0; i < n; i++) out[off + i] = in[off + i] ^ ks[i];
      ctr_inc(ctr);
      off += n;
    }
    return (int)inlen;
  }

  /* ---- ECB / CBC：块密码 ---- */
  if (encdec == CB_SM_ENC) {
    /* 先把明文拷进 out，必要时就地 PKCS7 补齐 */
    if (inlen > outcap) return CB_SM_ERR_BUFFER;
    memcpy(out, in, inlen);
    size_t len = inlen;
    if (do_pad) {
      int p = sm_pkcs7_pad(out, inlen, outcap, SM4_BLK);
      if (p < 0) return p;
      len = (size_t)p;
    } else if (len % SM4_BLK != 0) {
      return CB_SM_ERR_INLEN;
    }
    SM4_KEY sk;
    sm4_set_encrypt_key(&sk, key);
    if (mode == CB_SM_MODE_ECB) {
      for (size_t off = 0; off < len; off += SM4_BLK)
        sm4_encrypt(&sk, out + off, out + off);
    } else { /* CBC */
      uint8_t prev[SM4_BLK];
      memcpy(prev, iv, SM4_BLK);
      for (size_t off = 0; off < len; off += SM4_BLK) {
        for (size_t i = 0; i < SM4_BLK; i++) out[off + i] ^= prev[i];
        sm4_encrypt(&sk, out + off, out + off);
        memcpy(prev, out + off, SM4_BLK);
      }
    }
    return (int)len;
  } else { /* 解密 */
    if (inlen == 0 || inlen % SM4_BLK != 0) return CB_SM_ERR_INLEN;
    if (inlen > outcap) return CB_SM_ERR_BUFFER;
    SM4_KEY sk;
    sm4_set_decrypt_key(&sk, key);
    if (mode == CB_SM_MODE_ECB) {
      for (size_t off = 0; off < inlen; off += SM4_BLK)
        sm4_encrypt(&sk, in + off, out + off); /* decrypt key 下同一函数即解密 */
    } else { /* CBC */
      uint8_t prev[SM4_BLK], cur[SM4_BLK];
      memcpy(prev, iv, SM4_BLK);
      for (size_t off = 0; off < inlen; off += SM4_BLK) {
        memcpy(cur, in + off, SM4_BLK); /* 保存密文块（in/out 可能同缓冲） */
        sm4_encrypt(&sk, in + off, out + off);
        for (size_t i = 0; i < SM4_BLK; i++) out[off + i] ^= prev[i];
        memcpy(prev, cur, SM4_BLK);
      }
    }
    size_t len = inlen;
    if (do_pad) {
      int u = sm_pkcs7_unpad(out, inlen, SM4_BLK);
      if (u < 0) return u;
      len = (size_t)u;
    }
    return (int)len;
  }
}
