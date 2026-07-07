#!/usr/bin/env bash
# build.sh — 用 emscripten 把 C 源码编译为 WASM。
# 前置：激活 emsdk 使 emcc 进 PATH（source ~/emsdk/emsdk_env.sh）或用绝对路径。
# 产物：public/core.loader.js + core.loader.wasm。验证：node wasm/selftest.mjs
# 重型加密移植自 mbedTLS 2.28.10（Apache-2.0），源码在 临时/mbedtls；国密 SM4 移植自 GmSSL 3.x（Apache-2.0），源码在 临时/gmssl（清理前勿删，见 PROGRESS）。
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT/../public"
MBED="$ROOT/../临时/mbedtls"
MBLIB="$MBED/library"
GMSSL="$ROOT/../临时/gmssl"
GMLIB="$GMSSL/src"
mkdir -p "$OUT_DIR"

EXPORTED_FUNCS='["_cb_malloc","_cb_free","_cb_detect_magic","_cb_hexdump","_cb_sha256","_cb_md5","_cb_sha1","_cb_parse_pe","_cb_sym_crypt","_cb_rsa_crypt","_cb_sm4_crypt","_cb_sm2_crypt"]'
RUNTIME_METHODS='["HEAPU8","UTF8ToString","stringToUTF8"]'
EMCC="${EMCC:-emcc}"

# mbedTLS 精简源闭包（见 wasm/mbedtls_config.h 裁剪的模块）
MBED_SRC=(
  "$MBLIB/aes.c" "$MBLIB/des.c" "$MBLIB/arc4.c" "$MBLIB/chacha20.c"
  "$MBLIB/rsa.c" "$MBLIB/rsa_internal.c" "$MBLIB/bignum.c" "$MBLIB/oid.c"
  "$MBLIB/pk.c" "$MBLIB/pk_wrap.c" "$MBLIB/pkparse.c" "$MBLIB/pem.c"
  "$MBLIB/base64.c" "$MBLIB/asn1parse.c" "$MBLIB/md.c"
  "$MBLIB/sha256.c" "$MBLIB/sha1.c" "$MBLIB/sha512.c" "$MBLIB/md5.c"
  "$MBLIB/constant_time.c" "$MBLIB/platform_util.c"
)

emcc \
  "$ROOT/src/api.c" \
  "$ROOT/src/magic.c" \
  "$ROOT/src/hexdump.c" \
  "$ROOT/src/hash.c" \
  "$ROOT/src/md5.c" \
  "$ROOT/src/sha1.c" \
  "$ROOT/src/pe_parser.c" \
  "$ROOT/src/crypto_sym.c" \
  "$ROOT/src/crypto_rsa.c" \
  "$ROOT/src/crypto_sm.c" \
  "$GMLIB/sm4.c" \
  "$ROOT/src/crypto_sm2.c" \
  "$GMLIB/sm2_enc.c" \
  "$GMLIB/sm2_z256.c" \
  "$GMLIB/sm2_z256_table.c" \
  "$GMLIB/sm3.c" \
  "$GMLIB/hex.c" \
  "${MBED_SRC[@]}" \
  -I "$ROOT/include" \
  -I "$ROOT" \
  -I "$MBED/include" \
  -I "$MBLIB" \
  -I "$GMSSL/include" \
  -DMBEDTLS_CONFIG_FILE='"mbedtls_config.h"' \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createCoreModule \
  -s ENVIRONMENT='web,node' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCS" \
  -s EXPORTED_RUNTIME_METHODS="$RUNTIME_METHODS" \
  -o "$OUT_DIR/core.loader.js"

echo "✓ 已生成 $OUT_DIR/core.loader.js + core.loader.wasm"
echo "  自检：node wasm/selftest.mjs"
