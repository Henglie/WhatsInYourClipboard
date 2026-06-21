/*
 * api.c — 内存管理导出。
 * 处理函数分散在 magic.c / hexdump.c / hash.c / pe_parser.c。
 */
#include "api.h"
#include <stdlib.h>

void *cb_malloc(size_t n) { return malloc(n); }
void cb_free(void *p) { free(p); }
