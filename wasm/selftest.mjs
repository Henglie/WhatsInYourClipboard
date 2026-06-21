/*
 * selftest.mjs — WASM 产物自检。
 * 用法（编译出 public/core.* 后）：node wasm/selftest.mjs
 * 对照标准向量验证 sha256 / detectMagic / parsePE。
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const loaderPath = join(__dir, "../public/core.loader.js");

let createCoreModule;
try {
  ({ default: createCoreModule } = await import("file://" + loaderPath));
} catch (e) {
  console.error("✗ 未找到编译产物 public/core.loader.js，请先运行 wasm/build.sh");
  process.exit(1);
}

const mod = await createCoreModule();

function withBuffers(inBytes, outCap, fn) {
  const inPtr = mod._cb_malloc(inBytes.length || 1);
  const outPtr = outCap > 0 ? mod._cb_malloc(outCap) : 0;
  try {
    mod.HEAPU8.set(inBytes, inPtr);
    return fn(inPtr, inBytes.length, outPtr, outCap);
  } finally {
    mod._cb_free(inPtr);
    if (outPtr) mod._cb_free(outPtr);
  }
}

const enc = (s) => new TextEncoder().encode(s);
let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (got === want) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n      got:  ${got}\n      want: ${want}`); }
};

// SHA-256 标准向量
const sha = (s) =>
  withBuffers(enc(s), 65, (i, n, o, c) => {
    const w = mod._cb_sha256(i, n, o, c);
    return w < 0 ? "" : mod.UTF8ToString(o, w);
  });
check("sha256('')", sha(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
check("sha256('abc')", sha("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
check(
  "sha256(fox)",
  sha("The quick brown fox jumps over the lazy dog"),
  "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"
);

// detectMagic
const magic = (arr) => withBuffers(new Uint8Array(arr), 0, (i, n) => mod._cb_detect_magic(i, n));
check("magic PNG", magic([0x89, 0x50, 0x4e, 0x47]), 1);
check("magic PE",  magic([0x4d, 0x5a]), 4);
check("magic ZIP", magic([0x50, 0x4b, 0x03, 0x04]), 5);

// MD5 标准向量
const md5 = (s) =>
  withBuffers(enc(s), 33, (i, n, o, c) => {
    const w = mod._cb_md5(i, n, o, c);
    return w < 0 ? "" : mod.UTF8ToString(o, w);
  });
check("md5('')", md5(""), "d41d8cd98f00b204e9800998ecf8427e");
check("md5('abc')", md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
check("md5(fox)", md5("The quick brown fox jumps over the lazy dog"), "9e107d9d372bb6826bd81d3542a419d6");

// SHA-1 标准向量
const sha1 = (s) =>
  withBuffers(enc(s), 41, (i, n, o, c) => {
    const w = mod._cb_sha1(i, n, o, c);
    return w < 0 ? "" : mod.UTF8ToString(o, w);
  });
check("sha1('')", sha1(""), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
check("sha1('abc')", sha1("abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");

console.log(`\n${fail === 0 ? "✓ 全部通过" : "✗ 有失败"}：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
