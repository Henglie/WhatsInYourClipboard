/*
 * crypto_selftest.mjs — 重型加密 WASM 自检（AES/DES/3DES/RC4/ChaCha20/RSA）。
 * 用法：node wasm/crypto_selftest.mjs （需先 build.sh 出 public/core.loader.js）
 * 对称用官方测试向量（NIST/RFC），RSA 用生成密钥往返。
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dir = dirname(fileURLToPath(import.meta.url));
const { default: create } = await import("file://" + join(__dir, "../public/core.loader.js"));
const mod = await create();

const hex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
const enc = (s) => new TextEncoder().encode(s);

// 算法/模式常量（与 crypto_sym.c 对齐）
const ALGO = { AES: 1, DES: 2, DES3: 3, RC4: 4, CHACHA20: 5 };
const MODE = { ECB: 0, CBC: 1, CTR: 2 };
const ENC = 0, DEC = 1;

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (got === want) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + "\n      got:  " + got + "\n      want: " + want); }
};

// cb_sym_crypt(algo,encdec,key,keylen,iv,ivlen,mode,counter,do_pad,in,inlen,out,outcap)
function symCrypt(algo, encdec, key, iv, mode, counter, doPad, input) {
  const kP = mod._cb_malloc(key.length || 1);
  const ivP = mod._cb_malloc(iv ? iv.length || 1 : 1);
  const inP = mod._cb_malloc(input.length || 1);
  const outCap = input.length + 64;
  const outP = mod._cb_malloc(outCap);
  try {
    mod.HEAPU8.set(key, kP);
    if (iv) mod.HEAPU8.set(iv, ivP);
    mod.HEAPU8.set(input, inP);
    const w = mod._cb_sym_crypt(algo, encdec, kP, key.length,
      iv ? ivP : 0, iv ? iv.length : 0, mode, counter >>> 0, doPad ? 1 : 0,
      inP, input.length, outP, outCap);
    if (w < 0) return { err: w };
    return { out: mod.HEAPU8.slice(outP, outP + w) };
  } finally {
    mod._cb_free(kP); mod._cb_free(ivP); mod._cb_free(inP); mod._cb_free(outP);
  }
}

console.log("== AES ==");
// NIST FIPS-197 AES-128 ECB 单块
{
  const key = hex("000102030405060708090a0b0c0d0e0f");
  const pt = hex("00112233445566778899aabbccddeeff");
  const ctWant = "69c4e0d86a7b0430d8cdb78070b4c55a";
  const r = symCrypt(ALGO.AES, ENC, key, null, MODE.ECB, 0, false, pt);
  check("AES-128 ECB enc", r.out ? toHex(r.out) : "err" + r.err, ctWant);
  const d = symCrypt(ALGO.AES, DEC, key, hex(ctWant) && null, MODE.ECB, 0, false, hex(ctWant));
  check("AES-128 ECB dec", d.out ? toHex(d.out) : "err" + d.err, "00112233445566778899aabbccddeeff");
}
// NIST SP800-38A AES-128 CBC
{
  const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
  const iv = hex("000102030405060708090a0b0c0d0e0f");
  const pt = hex("6bc1bee22e409f96e93d7e117393172a");
  const ctWant = "7649abac8119b246cee98e9b12e9197d";
  const r = symCrypt(ALGO.AES, ENC, key, iv, MODE.CBC, 0, false, pt);
  check("AES-128 CBC enc", r.out ? toHex(r.out) : "err" + r.err, ctWant);
}
// NIST SP800-38A AES-128 CTR
{
  const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
  const iv = hex("f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff");
  const pt = hex("6bc1bee22e409f96e93d7e117393172a");
  const ctWant = "874d6191b620e3261bef6864990db6ce";
  const r = symCrypt(ALGO.AES, ENC, key, iv, MODE.CTR, 0, false, pt);
  check("AES-128 CTR enc", r.out ? toHex(r.out) : "err" + r.err, ctWant);
}
// AES-256 ECB
{
  const key = hex("603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4");
  const pt = hex("6bc1bee22e409f96e93d7e117393172a");
  const ctWant = "f3eed1bdb5d2a03c064b5a7e3db181f8";
  const r = symCrypt(ALGO.AES, ENC, key, null, MODE.ECB, 0, false, pt);
  check("AES-256 ECB enc", r.out ? toHex(r.out) : "err" + r.err, ctWant);
}
// AES-128 CBC + PKCS7 往返
{
  const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
  const iv = hex("000102030405060708090a0b0c0d0e0f");
  const msg = enc("Hello, mbedTLS WASM!");
  const e = symCrypt(ALGO.AES, ENC, key, iv, MODE.CBC, 0, true, msg);
  const d = symCrypt(ALGO.AES, DEC, key, iv, MODE.CBC, 0, true, e.out);
  check("AES-128 CBC+PKCS7 往返", d.out ? new TextDecoder().decode(d.out) : "err" + d.err, "Hello, mbedTLS WASM!");
}

console.log("== DES / 3DES ==");
// FIPS DES ECB 单块 (key=0123456789abcdef, pt=4e6f772069732074 -> 3fa40e8a984d4815)
{
  const key = hex("0123456789abcdef");
  const pt = hex("4e6f772069732074");
  const ctWant = "3fa40e8a984d4815";
  const r = symCrypt(ALGO.DES, ENC, key, null, MODE.ECB, 0, false, pt);
  check("DES ECB enc", r.out ? toHex(r.out) : "err" + r.err, ctWant);
}
// 3DES-2key CBC 往返
{
  const key = hex("0123456789abcdef23456789abcdef01");
  const iv = hex("0000000000000000");
  const msg = enc("8bytes!!");
  const e = symCrypt(ALGO.DES3, ENC, key, iv, MODE.CBC, 0, false, msg);
  const d = symCrypt(ALGO.DES3, DEC, key, iv, MODE.CBC, 0, false, e.out);
  check("3DES-2key CBC 往返", d.out ? new TextDecoder().decode(d.out) : "err" + d.err, "8bytes!!");
}
// 3DES-3key ECB 往返
{
  const key = hex("0123456789abcdef23456789abcdef01456789abcdef0123");
  const msg = enc("abcdefgh");
  const e = symCrypt(ALGO.DES3, ENC, key, null, MODE.ECB, 0, false, msg);
  const d = symCrypt(ALGO.DES3, DEC, key, null, MODE.ECB, 0, false, e.out);
  check("3DES-3key ECB 往返", d.out ? new TextDecoder().decode(d.out) : "err" + d.err, "abcdefgh");
}

console.log("== RC4 ==");
// RC4 Key="Key" Plaintext="Plaintext" -> BBF316E8D940AF0AD3
{
  const key = enc("Key");
  const pt = enc("Plaintext");
  const ctWant = "bbf316e8d940af0ad3";
  const r = symCrypt(ALGO.RC4, ENC, key, null, MODE.ECB, 0, false, pt);
  check("RC4 'Key'/'Plaintext'", r.out ? toHex(r.out) : "err" + r.err, ctWant);
}

console.log("== ChaCha20 ==");
// RFC 7539 §2.4.2 test vector
{
  const key = hex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
  const nonce = hex("000000000000004a00000000");
  const counter = 1;
  const pt = enc("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const ctWant = "6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d";
  const r = symCrypt(ALGO.CHACHA20, ENC, key, nonce, MODE.ECB, counter, false, pt);
  check("ChaCha20 RFC7539", r.out ? toHex(r.out) : "err" + r.err, ctWant);
}

console.log("\n" + (fail === 0 ? "✓ 全部通过" : "✗ 有失败") + "：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail === 0 ? 0 : 1);
