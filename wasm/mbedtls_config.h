/*
 * mbedtls_config.h — WhatsInYourClipboard 专用精简 mbedTLS 2.28 配置。
 * 只开启工具箱重型加密所需算法：AES / DES / 3DES / RC4 / ChaCha20 / RSA(+PK 解析)。
 * 关闭一切平台依赖（socket/fs/entropy/threading/x509/ssl/psa），适配 WASM。
 * RNG 由 JS 侧注入回调（见 crypto_rsa.c 的 EM_JS cb_js_random），不编 entropy/ctr_drbg。
 * 用法：emcc -DMBEDTLS_CONFIG_FILE='"mbedtls_config.h"'
 */
#ifndef WIYC_MBEDTLS_CONFIG_H
#define WIYC_MBEDTLS_CONFIG_H

/* ---- 对称密码 ---- */
#define MBEDTLS_AES_C
#define MBEDTLS_CIPHER_MODE_CBC
#define MBEDTLS_CIPHER_MODE_CTR
#define MBEDTLS_CIPHER_MODE_CFB
#define MBEDTLS_CIPHER_MODE_OFB
#define MBEDTLS_DES_C
#define MBEDTLS_ARC4_C
#define MBEDTLS_CHACHA20_C

/* ---- RSA + 公私钥解析 ---- */
#define MBEDTLS_RSA_C
#define MBEDTLS_BIGNUM_C
#define MBEDTLS_OID_C
#define MBEDTLS_PKCS1_V15
#define MBEDTLS_PKCS1_V21
#define MBEDTLS_PK_C
#define MBEDTLS_PK_PARSE_C
#define MBEDTLS_ASN1_PARSE_C
#define MBEDTLS_ASN1_WRITE_C
#define MBEDTLS_PEM_PARSE_C
#define MBEDTLS_BASE64_C

/* ---- 摘要（RSA 签名/OAEP/PEM 派生用） ---- */
#define MBEDTLS_MD_C
#define MBEDTLS_SHA256_C
#define MBEDTLS_SHA1_C
#define MBEDTLS_SHA512_C
#define MBEDTLS_MD5_C

/* ---- 平台适配：WASM 无系统资源，全部关闭 ---- */
/* 不定义 MBEDTLS_PLATFORM_C：退化用标准库 malloc/free/snprintf */
/* 不定义 MBEDTLS_ENTROPY_C / CTR_DRBG_C / HMAC_DRBG_C：RNG 走 JS 注入 */
/* 不定义 MBEDTLS_NET_C / FS_IO / TIMING_C / THREADING_C */
/* 不定义 MBEDTLS_SELF_TEST：省体积、避免 self-test 拉依赖 */
/* 不定义 MBEDTLS_AESNI_C / PADLOCK_C：非 x86 */
/* 不定义任何 X509 / SSL / PSA */

#include "mbedtls/check_config.h"

#endif /* WIYC_MBEDTLS_CONFIG_H */
