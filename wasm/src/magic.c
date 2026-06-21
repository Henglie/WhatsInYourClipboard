/*
 * magic.c — 文件特征码（magic bytes）探测。
 */
#include "api.h"

static int starts_with(const uint8_t *in, size_t in_len,
                       const uint8_t *sig, size_t sig_len) {
  if (in_len < sig_len) return 0;
  for (size_t i = 0; i < sig_len; i++) {
    if (in[i] != sig[i]) return 0;
  }
  return 1;
}

int cb_detect_magic(const uint8_t *in, size_t in_len) {
  static const uint8_t PNG[] = {0x89, 0x50, 0x4e, 0x47};
  static const uint8_t JPEG[] = {0xff, 0xd8, 0xff};
  static const uint8_t GIF[] = {0x47, 0x49, 0x46, 0x38};
  static const uint8_t MZ[] = {0x4d, 0x5a};
  static const uint8_t ZIP[] = {0x50, 0x4b, 0x03, 0x04};
  static const uint8_t PDF[] = {0x25, 0x50, 0x44, 0x46};

  if (starts_with(in, in_len, PNG, sizeof PNG)) return CB_TYPE_PNG;
  if (starts_with(in, in_len, JPEG, sizeof JPEG)) return CB_TYPE_JPEG;
  if (starts_with(in, in_len, GIF, sizeof GIF)) return CB_TYPE_GIF;
  if (starts_with(in, in_len, MZ, sizeof MZ)) return CB_TYPE_PE;
  if (starts_with(in, in_len, ZIP, sizeof ZIP)) return CB_TYPE_ZIP;
  if (starts_with(in, in_len, PDF, sizeof PDF)) return CB_TYPE_PDF;
  return CB_TYPE_UNKNOWN;
}
