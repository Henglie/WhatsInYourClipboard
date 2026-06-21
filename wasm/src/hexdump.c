/*
 * hexdump.c — Hex 矩阵格式化。
 * 每行：8位偏移 两空格 16字节十六进制(第8字节后多一空格) 两空格 |ASCII|
 */
#include "api.h"

static const char HEXCHARS[] = "0123456789abcdef";

int cb_hexdump(const uint8_t *in, size_t in_len, char *out, size_t out_cap) {
  size_t w = 0;

#define PUT(c)                       \
  do {                               \
    if (w + 1 >= out_cap) return CB_ERR_BUFFER; \
    out[w++] = (char)(c);            \
  } while (0)

  for (size_t off = 0; off < in_len; off += 16) {
    /* 偏移：8 位十六进制 */
    for (int s = 28; s >= 0; s -= 4) {
      PUT(HEXCHARS[(off >> s) & 0xf]);
    }
    PUT(' ');
    PUT(' ');

    /* 十六进制区 */
    for (int i = 0; i < 16; i++) {
      size_t idx = off + i;
      if (idx < in_len) {
        uint8_t b = in[idx];
        PUT(HEXCHARS[b >> 4]);
        PUT(HEXCHARS[b & 0xf]);
        PUT(' ');
      } else {
        PUT(' ');
        PUT(' ');
        PUT(' ');
      }
      if (i == 7) PUT(' ');
    }

    PUT(' ');
    PUT('|');
    /* ASCII 区 */
    for (int i = 0; i < 16; i++) {
      size_t idx = off + i;
      if (idx >= in_len) break;
      uint8_t b = in[idx];
      PUT((b >= 0x20 && b <= 0x7e) ? b : '.');
    }
    PUT('|');
    PUT('\n');
  }

#undef PUT
  out[w] = '\0';
  return (int)w;
}
