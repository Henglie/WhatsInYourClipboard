#!/usr/bin/env bash
# build.sh — 用 emscripten 把 C 源码编译为 WASM。
# 前置：先激活 emsdk，使 emcc 进入 PATH：
#   source ~/emsdk/emsdk_env.sh   （或直接用 emcc 绝对路径）
# 产物：public/core.loader.js（ESM 工厂）+ public/core.loader.wasm。
# 验证：node wasm/selftest.mjs
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT/../public"
mkdir -p "$OUT_DIR"

EXPORTED_FUNCS='["_cb_malloc","_cb_free","_cb_detect_magic","_cb_hexdump","_cb_sha256","_cb_md5","_cb_sha1","_cb_parse_pe"]'
RUNTIME_METHODS='["HEAPU8","UTF8ToString","stringToUTF8"]'

emcc \
  "$ROOT/src/api.c" \
  "$ROOT/src/magic.c" \
  "$ROOT/src/hexdump.c" \
  "$ROOT/src/hash.c" \
  "$ROOT/src/md5.c" \
  "$ROOT/src/sha1.c" \
  "$ROOT/src/pe_parser.c" \
  -I "$ROOT/include" \
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
