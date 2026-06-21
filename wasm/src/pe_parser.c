/*
 * pe_parser.c — PE 头解析，输出 JSON。
 */
#include "api.h"

static uint16_t rd16(const uint8_t *p) { return p[0] | (p[1] << 8); }
static uint32_t rd32(const uint8_t *p) {
  return p[0] | (p[1] << 8) | (p[2] << 16) | ((uint32_t)p[3] << 24);
}

/* 朴素 strcpy，返回写入长度 */
static size_t emit(char *out, size_t cap, size_t w, const char *s) {
  while (*s) {
    if (w + 1 >= cap) return w;
    out[w++] = *s++;
  }
  return w;
}

int cb_parse_pe(const uint8_t *in, size_t in_len, char *out, size_t cap) {
  if (in_len < 0x40 || in[0] != 'M' || in[1] != 'Z') return CB_ERR_FORMAT;

  uint32_t pe_off = rd32(in + 0x3c);
  if (pe_off + 24 > in_len) return CB_ERR_FORMAT;
  if (in[pe_off] != 'P' || in[pe_off + 1] != 'E') return CB_ERR_FORMAT;

  uint16_t machine = rd16(in + pe_off + 4);
  uint16_t nsec = rd16(in + pe_off + 6);
  uint32_t timestamp = rd32(in + pe_off + 8);

  const char *arch;
  switch (machine) {
    case 0x014c: arch = "x86 (32位)"; break;
    case 0x8664: arch = "x64 (64位)"; break;
    case 0xaa64: arch = "ARM64"; break;
    case 0x01c0: arch = "ARM"; break;
    default: arch = "未知"; break;
  }

  /* 是否 DLL：Characteristics bit 0x2000 */
  uint16_t chars = rd16(in + pe_off + 22);
  const char *kind = (chars & 0x2000) ? "DLL" : "EXE";

  /* 拼 JSON：{"arch":"..","kind":"..","sections":N,"timestamp":T} */
  size_t w = 0;
  char num[24];
  w = emit(out, cap, w, "{\"arch\":\"");
  w = emit(out, cap, w, arch);
  w = emit(out, cap, w, "\",\"kind\":\"");
  w = emit(out, cap, w, kind);
  w = emit(out, cap, w, "\",\"sections\":");
  /* 整数转字符串 */
  {
    int n = nsec, len = 0;
    if (n == 0) num[len++] = '0';
    char tmp[12]; int t = 0;
    while (n > 0) { tmp[t++] = '0' + n % 10; n /= 10; }
    while (t > 0) num[len++] = tmp[--t];
    num[len] = '\0';
  }
  w = emit(out, cap, w, num);
  w = emit(out, cap, w, ",\"timestamp\":");
  {
    uint32_t n = timestamp; int len = 0;
    if (n == 0) num[len++] = '0';
    char tmp[12]; int t = 0;
    while (n > 0) { tmp[t++] = '0' + n % 10; n /= 10; }
    while (t > 0) num[len++] = tmp[--t];
    num[len] = '\0';
  }
  w = emit(out, cap, w, num);
  w = emit(out, cap, w, "}");
  if (w + 1 >= cap) return CB_ERR_BUFFER;
  out[w] = '\0';
  return (int)w;
}
