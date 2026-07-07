/*
 * crypto_sym.c — 对称加解密 WASM 导出（移植自 mbedTLS 2.28.10，Apache-2.0）。
 *
 * 统一入口 cb_sym_crypt 覆盖 AES / DES / 3DES / RC4 / ChaCha20。
 * 字节进字节出，key/iv 由 JS 侧封送。块密码支持 ECB/CBC/CTR + 可选 PKCS7。
 *
 * 约定：返回 >=0 为写入 out 的字节数，返回负值为 CB_CRYPT_ERR_*。
 */
#include <string.h>
#include <stdint.h>
#include <stddef.h>
#include "mbedtls/aes.h"
#include "mbedtls/des.h"
#include "mbedtls/arc4.h"
#include "mbedtls/chacha20.h"

/* 算法 id，与 JS 侧对齐 */
enum {
  CB_ALGO_AES = 1,
  CB_ALGO_DES = 2,
  CB_ALGO_DES3 = 3,
  CB_ALGO_RC4 = 4,
  CB_ALGO_CHACHA20 = 5
};

/* 块模式 */
enum {
  CB_MODE_ECB = 0,
  CB_MODE_CBC = 1,
  CB_MODE_CTR = 2
};

/* enc/dec（JS 侧对齐） */
enum {
  CB_ENC = 0,
  CB_DEC = 1
};

/* 错误码 */
enum {
  CB_CRYPT_ERR_ALGO = -1,     /* 算法/模式不支持 */
  CB_CRYPT_ERR_KEYLEN = -2,   /* 密钥长度非法 */
  CB_CRYPT_ERR_IVLEN = -3,    /* IV 长度非法 */
  CB_CRYPT_ERR_INLEN = -4,    /* 输入长度非法（未对齐等） */
  CB_CRYPT_ERR_BUFFER = -5,   /* 输出缓冲不足 */
  CB_CRYPT_ERR_PAD = -6,      /* PKCS7 去填充失败 */
  CB_CRYPT_ERR_LIB = -7       /* 底层库返回错误 */
};

/* PKCS7 填充：在 buf(容量 cap) 里把 len 字节补到 block 的整数倍，返回补后长度 */
static int pkcs7_pad(uint8_t *buf, size_t len, size_t cap, size_t block) {
  size_t pad = block - (len % block);
  if (pad == 0) pad = block; /* 已对齐也补一整块，符合 PKCS7 */
  if (len + pad > cap) return CB_CRYPT_ERR_BUFFER;
  for (size_t i = 0; i < pad; i++) buf[len + i] = (uint8_t)pad;
  return (int)(len + pad);
}

/* PKCS7 去填充：校验并返回去填充后的长度 */
static int pkcs7_unpad(const uint8_t *buf, size_t len, size_t block) {
  if (len == 0 || (len % block) != 0) return CB_CRYPT_ERR_PAD;
  uint8_t pad = buf[len - 1];
  if (pad == 0 || pad > block) return CB_CRYPT_ERR_PAD;
  for (size_t i = 0; i < pad; i++)
    if (buf[len - 1 - i] != pad) return CB_CRYPT_ERR_PAD;
  return (int)(len - pad);
}

/*
 * 块密码原地运算：对 buf[0..len) 就地加/解密，len 必须已块对齐。
 * @param mbed_mode  MBEDTLS_*_ENCRYPT(1) / MBEDTLS_*_DECRYPT(0)
 * @param iv         CBC/CTR 用；函数内部拷贝，不改调用方数据
 * 返回 0 成功，否则 CB_CRYPT_ERR_LIB。
 */
static int cb_block_run(int algo, int mbed_mode, int mode,
                        const uint8_t *key, size_t keylen,
                        const uint8_t *iv,
                        uint8_t *buf, size_t len, size_t block) {
  int ret = CB_CRYPT_ERR_LIB;
  uint8_t iv_work[16];       /* CBC 会被 mbedtls 更新，需可写副本 */
  if (iv && block <= sizeof(iv_work)) memcpy(iv_work, iv, block);

  if (algo == CB_ALGO_AES) {
    mbedtls_aes_context ctx;
    mbedtls_aes_init(&ctx);
    if (mode == CB_MODE_CTR) {
      /* CTR 加解密同一路径，key 恒用 enc schedule */
      if (mbedtls_aes_setkey_enc(&ctx, key, (unsigned)(keylen * 8)) == 0) {
        size_t nc_off = 0;
        uint8_t stream_block[16];
        memset(stream_block, 0, sizeof(stream_block));
        ret = mbedtls_aes_crypt_ctr(&ctx, len, &nc_off, iv_work,
                                    stream_block, buf, buf);
      }
    } else {
      int ks = (mbed_mode == MBEDTLS_AES_ENCRYPT)
                   ? mbedtls_aes_setkey_enc(&ctx, key, (unsigned)(keylen * 8))
                   : mbedtls_aes_setkey_dec(&ctx, key, (unsigned)(keylen * 8));
      if (ks == 0) {
        if (mode == CB_MODE_CBC) {
          ret = mbedtls_aes_crypt_cbc(&ctx, mbed_mode, len, iv_work, buf, buf);
        } else { /* ECB 逐块 */
          ret = 0;
          for (size_t off = 0; off < len && ret == 0; off += 16)
            ret = mbedtls_aes_crypt_ecb(&ctx, mbed_mode, buf + off, buf + off);
        }
      }
    }
    mbedtls_aes_free(&ctx);
  } else if (algo == CB_ALGO_DES) {
    mbedtls_des_context ctx;
    mbedtls_des_init(&ctx);
    int ks = (mbed_mode == MBEDTLS_DES_ENCRYPT)
                 ? mbedtls_des_setkey_enc(&ctx, key)
                 : mbedtls_des_setkey_dec(&ctx, key);
    if (ks == 0) {
      if (mode == CB_MODE_CBC) {
        ret = mbedtls_des_crypt_cbc(&ctx, mbed_mode, len, iv_work, buf, buf);
      } else {
        ret = 0;
        for (size_t off = 0; off < len && ret == 0; off += 8)
          ret = mbedtls_des_crypt_ecb(&ctx, buf + off, buf + off);
      }
    }
    mbedtls_des_free(&ctx);
  } else if (algo == CB_ALGO_DES3) {
    mbedtls_des3_context ctx;
    mbedtls_des3_init(&ctx);
    int ks;
    if (keylen == 16)
      ks = (mbed_mode == MBEDTLS_DES_ENCRYPT)
               ? mbedtls_des3_set2key_enc(&ctx, key)
               : mbedtls_des3_set2key_dec(&ctx, key);
    else
      ks = (mbed_mode == MBEDTLS_DES_ENCRYPT)
               ? mbedtls_des3_set3key_enc(&ctx, key)
               : mbedtls_des3_set3key_dec(&ctx, key);
    if (ks == 0) {
      if (mode == CB_MODE_CBC) {
        ret = mbedtls_des3_crypt_cbc(&ctx, mbed_mode, len, iv_work, buf, buf);
      } else {
        ret = 0;
        for (size_t off = 0; off < len && ret == 0; off += 8)
          ret = mbedtls_des3_crypt_ecb(&ctx, buf + off, buf + off);
      }
    }
    mbedtls_des3_free(&ctx);
  }
  return ret == 0 ? 0 : CB_CRYPT_ERR_LIB;
}

/*
 * 统一对称加解密。
 * @param algo    CB_ALGO_*
 * @param encdec  CB_ENC / CB_DEC
 * @param key     密钥字节
 * @param keylen  密钥长度（AES:16/24/32, DES:8, DES3:16/24, RC4:1..256, ChaCha:32）
 * @param iv      IV/nonce（CBC/CTR 用；ChaCha20 需 12 字节 nonce；ECB/RC4 传 NULL）
 * @param ivlen   IV 长度
 * @param mode    CB_MODE_*（块密码用；流密码忽略）
 * @param counter ChaCha20 初始计数器（其他算法忽略）
 * @param do_pad  是否 PKCS7（仅 ECB/CBC 有效；1=启用）
 * @param in/inlen 输入
 * @param out/outcap 输出缓冲
 * @return 写入字节数或负错误码
 */
int cb_sym_crypt(int algo, int encdec,
                 const uint8_t *key, size_t keylen,
                 const uint8_t *iv, size_t ivlen,
                 int mode, uint32_t counter, int do_pad,
                 const uint8_t *in, size_t inlen,
                 uint8_t *out, size_t outcap) {
  /* ---- 流密码：RC4 ---- */
  if (algo == CB_ALGO_RC4) {
    if (keylen < 1 || keylen > 256) return CB_CRYPT_ERR_KEYLEN;
    if (inlen > outcap) return CB_CRYPT_ERR_BUFFER;
    mbedtls_arc4_context ctx;
    mbedtls_arc4_init(&ctx);
    mbedtls_arc4_setup(&ctx, key, (unsigned int)keylen);
    int ret = mbedtls_arc4_crypt(&ctx, inlen, in, out);
    mbedtls_arc4_free(&ctx);
    return ret != 0 ? CB_CRYPT_ERR_LIB : (int)inlen;
  }

  /* ---- 流密码：ChaCha20 ---- */
  if (algo == CB_ALGO_CHACHA20) {
    if (keylen != 32) return CB_CRYPT_ERR_KEYLEN;
    if (ivlen != 12) return CB_CRYPT_ERR_IVLEN;
    if (inlen > outcap) return CB_CRYPT_ERR_BUFFER;
    int ret = mbedtls_chacha20_crypt(key, iv, counter, inlen, in, out);
    return ret != 0 ? CB_CRYPT_ERR_LIB : (int)inlen;
  }

  /* ---- 块密码：AES / DES / 3DES ---- */
  size_t block;
  if (algo == CB_ALGO_AES) {
    if (keylen != 16 && keylen != 24 && keylen != 32) return CB_CRYPT_ERR_KEYLEN;
    block = 16;
  } else if (algo == CB_ALGO_DES) {
    if (keylen != 8) return CB_CRYPT_ERR_KEYLEN;
    block = 8;
  } else if (algo == CB_ALGO_DES3) {
    if (keylen != 16 && keylen != 24) return CB_CRYPT_ERR_KEYLEN;
    block = 8;
  } else {
    return CB_CRYPT_ERR_ALGO;
  }

  if (mode != CB_MODE_ECB && mode != CB_MODE_CBC && mode != CB_MODE_CTR)
    return CB_CRYPT_ERR_ALGO;
  /* CTR 仅 AES 支持（mbedtls 裸 API 只有 aes_crypt_ctr） */
  if (mode == CB_MODE_CTR && algo != CB_ALGO_AES) return CB_CRYPT_ERR_ALGO;
  if ((mode == CB_MODE_CBC || mode == CB_MODE_CTR) && ivlen != block)
    return CB_CRYPT_ERR_IVLEN;

  /* PKCS7 只对 ECB/CBC 有意义；CTR 是流式不填充 */
  int pad_on = do_pad && (mode == CB_MODE_ECB || mode == CB_MODE_CBC);
  /* mbedtls 的 ENCRYPT 宏值：AES 与 DES 都是 1=加密 0=解密 */
  int mbed_mode = (encdec == CB_ENC) ? MBEDTLS_AES_ENCRYPT : MBEDTLS_AES_DECRYPT;

  /* 加密路径 ------------------------------------------------------ */
  if (encdec == CB_ENC) {
    size_t work_len = inlen;
    if (inlen > outcap) return CB_CRYPT_ERR_BUFFER;
    memcpy(out, in, inlen);
    if (pad_on) {
      int p = pkcs7_pad(out, inlen, outcap, block);
      if (p < 0) return p;
      work_len = (size_t)p;
    } else if (mode == CB_MODE_ECB || mode == CB_MODE_CBC) {
      if ((work_len % block) != 0) return CB_CRYPT_ERR_INLEN; /* 无填充须对齐 */
    }
    int r = cb_block_run(algo, mbed_mode, mode, key, keylen, iv, out, work_len, block);
    return r < 0 ? r : (int)work_len;
  }

  /* 解密路径 ------------------------------------------------------ */
  if ((mode == CB_MODE_ECB || mode == CB_MODE_CBC) && (inlen % block) != 0)
    return CB_CRYPT_ERR_INLEN;
  if (inlen > outcap) return CB_CRYPT_ERR_BUFFER;
  memcpy(out, in, inlen);
  int r = cb_block_run(algo, mbed_mode, mode, key, keylen, iv, out, inlen, block);
  if (r < 0) return r;
  if (pad_on) return pkcs7_unpad(out, inlen, block);
  return (int)inlen;
}
