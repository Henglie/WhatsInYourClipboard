/*
 * sha1.c — SHA-1 自包含实现，输出十六进制摘要。
 */
#include "api.h"

static uint32_t rol(uint32_t x, int c) { return (x << c) | (x >> (32 - c)); }

static void sha1_block(uint32_t *h, const uint8_t *p) {
  uint32_t w[80];
  for (int i = 0; i < 16; i++)
    w[i] = ((uint32_t)p[i*4]<<24) | (p[i*4+1]<<16) | (p[i*4+2]<<8) | p[i*4+3];
  for (int i = 16; i < 80; i++)
    w[i] = rol(w[i-3]^w[i-8]^w[i-14]^w[i-16], 1);
  uint32_t a=h[0],b=h[1],c=h[2],d=h[3],e=h[4];
  for (int i = 0; i < 80; i++) {
    uint32_t f, k;
    if (i<20){f=(b&c)|(~b&d);k=0x5a827999;}
    else if(i<40){f=b^c^d;k=0x6ed9eba1;}
    else if(i<60){f=(b&c)|(b&d)|(c&d);k=0x8f1bbcdc;}
    else{f=b^c^d;k=0xca62c1d6;}
    uint32_t tmp=rol(a,5)+f+e+k+w[i];
    e=d;d=c;c=rol(b,30);b=a;a=tmp;
  }
  h[0]+=a;h[1]+=b;h[2]+=c;h[3]+=d;h[4]+=e;
}

int cb_sha1(const uint8_t *in, size_t len, char *out, size_t cap) {
  static const char HC[]="0123456789abcdef";
  if (cap < 41) return CB_ERR_BUFFER;
  uint32_t h[5]={0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0};
  uint64_t bits = (uint64_t)len * 8;
  size_t i = 0;
  while (i + 64 <= len) { sha1_block(h, in+i); i += 64; }
  uint8_t tail[128]; size_t t = len - i;
  for (size_t k = 0; k < t; k++) tail[k] = in[i+k];
  tail[t++] = 0x80;
  size_t pad = (t <= 56) ? 56 : 120;
  while (t < pad) tail[t++] = 0;
  for (int k = 7; k >= 0; k--) tail[t++] = (uint8_t)(bits >> (k*8));
  for (size_t k = 0; k < t; k += 64) sha1_block(h, tail+k);
  for (int w = 0; w < 5; w++)
    for (int k = 0; k < 4; k++) {
      uint8_t byte = (h[w] >> (24 - k*8)) & 0xff;
      out[(w*4+k)*2] = HC[byte>>4];
      out[(w*4+k)*2+1] = HC[byte&0xf];
    }
  out[40]='\0';
  return 40;
}
