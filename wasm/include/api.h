/*
 * api.h — WASM 计算层对外导出接口。
 * 约定：所有处理函数 (in_ptr, in_len, out_ptr, out_cap) -> written_len。
 *       返回 >=0 为写入字节数；返回负值为错误码 CB_ERR_*。
 *       字节进、字节/JSON 出，不直接传字符串，规避字符集错乱。
 */
#ifndef CB_API_H
#define CB_API_H

#include <stddef.h>
#include <stdint.h>

/* 类型枚举：与 JS 侧 CB_TYPE 对齐 */
enum {
  CB_TYPE_UNKNOWN = 0,
  CB_TYPE_PNG = 1,
  CB_TYPE_JPEG = 2,
  CB_TYPE_GIF = 3,
  CB_TYPE_PE = 4,
  CB_TYPE_ZIP = 5,
  CB_TYPE_PDF = 6
};

/* 错误码 */
enum {
  CB_ERR_BUFFER = -1, /* 输出缓冲不足 */
  CB_ERR_FORMAT = -2  /* 输入格式非法 */
};

/* 内存管理：供 JS 分配/释放 WASM 堆 */
void *cb_malloc(size_t n);
void cb_free(void *p);

/* 特征码探测 -> 返回 CB_TYPE_* */
int cb_detect_magic(const uint8_t *in, size_t in_len);

/* Hex 矩阵：偏移 | 16字节十六进制 | ASCII，写入 out，返回写入长度 */
int cb_hexdump(const uint8_t *in, size_t in_len, char *out, size_t out_cap);

/* SHA-256 十六进制摘要，out 需 >= 65 字节，返回 64 */
int cb_sha256(const uint8_t *in, size_t in_len, char *out, size_t out_cap);

/* MD5 十六进制摘要，out 需 >= 33，返回 32 */
int cb_md5(const uint8_t *in, size_t len, char *out, size_t cap);

/* SHA-1 十六进制摘要，out 需 >= 41，返回 40 */
int cb_sha1(const uint8_t *in, size_t len, char *out, size_t cap);

/* PE 头解析 -> JSON 字符串写入 out_json，返回写入长度 */
int cb_parse_pe(const uint8_t *in, size_t in_len, char *out_json, size_t out_cap);

#endif /* CB_API_H */
