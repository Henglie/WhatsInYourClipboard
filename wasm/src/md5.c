/*
 * md5.c — MD5 自包含实现，输出十六进制摘要。
 */
#include "api.h"

typedef struct { uint32_t a, b, c, d; uint64_t len; uint8_t buf[64]; uint32_t n; } md5_ctx;

static uint32_t rol(uint32_t x, int c) { return (x << c) | (x >> (32 - c)); }

static const uint32_t K[64] = {
  0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
  0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
  0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
  0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
  0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
  0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
  0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
  0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391};
static const int S[64] = {
  7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
  5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
  4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
  6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21};

static void md5_block(md5_ctx *c, const uint8_t *p) {
  uint32_t m[16];
  for (int i = 0; i < 16; i++)
    m[i] = p[i*4] | (p[i*4+1]<<8) | (p[i*4+2]<<16) | ((uint32_t)p[i*4+3]<<24);
  uint32_t a=c->a,b=c->b,cc=c->c,d=c->d;
  for (int i = 0; i < 64; i++) {
    uint32_t f; int g;
    if (i<16){f=(b&cc)|(~b&d);g=i;}
    else if(i<32){f=(d&b)|(~d&cc);g=(5*i+1)&15;}
    else if(i<48){f=b^cc^d;g=(3*i+5)&15;}
    else{f=cc^(b|~d);g=(7*i)&15;}
    uint32_t tmp=d; d=cc; cc=b;
    b=b+rol(a+f+K[i]+m[g],S[i]);
    a=tmp;
  }
  c->a+=a;c->b+=b;c->c+=cc;c->d+=d;
}

int cb_md5(const uint8_t *in, size_t len, char *out, size_t cap) {
  static const char HC[]="0123456789abcdef";
  if (cap < 33) return CB_ERR_BUFFER;
  md5_ctx c={0x67452301,0xefcdab89,0x98badcfe,0x10325476,0,{0},0};
  c.len = (uint64_t)len * 8;
  size_t i = 0;
  while (i + 64 <= len) { md5_block(&c, in+i); i += 64; }
  uint8_t tail[128]; size_t t = len - i;
  for (size_t k = 0; k < t; k++) tail[k] = in[i+k];
  tail[t++] = 0x80;
  size_t pad = (t <= 56) ? 56 : 120;
  while (t < pad) tail[t++] = 0;
  for (int k = 0; k < 8; k++) tail[t++] = (uint8_t)(c.len >> (k*8));
  for (size_t k = 0; k < t; k += 64) md5_block(&c, tail+k);
  uint32_t v[4]={c.a,c.b,c.c,c.d};
  for (int w = 0; w < 4; w++)
    for (int k = 0; k < 4; k++) {
      uint8_t byte = (v[w] >> (k*8)) & 0xff;
      out[(w*4+k)*2] = HC[byte>>4];
      out[(w*4+k)*2+1] = HC[byte&0xf];
    }
  out[32]='\0';
  return 32;
}
