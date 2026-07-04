#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
start.py — 一键启动脚本（Python 版，兼容性最好，只用标准库）。

玩家下载源码后，双击 启动.bat 或 `python start.py` 即可：起一个本地静态
服务器，用正确的 MIME 提供文件，并自动打开浏览器。

为什么必须用服务器、不能直接双击 index.html（file://）：
  - 本项目是 ES module（<script type="module">），file:// 下会被 CORS 拦截。
  - 液态玻璃 SVG 滤镜、WASM 计算层都要求 http(s) 环境。
  - .wasm 必须以 application/wasm 送出，浏览器才肯用流式编译加载。

用法：
  python start.py            # 默认端口 8123，起服务器并自动开浏览器
  python start.py 9000       # 指定端口
  python start.py --no-open  # 不自动开浏览器（远程/无头环境）
"""

import sys
import os
import subprocess
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))

# 液态玻璃的 SVG feImage 位移滤镜在 Firefox 首帧渲染时序上有已知问题（位移图
# 为 PNG data URL，Firefox 异步解码，首帧未就绪 → 折射层错乱）。Chromium 内核
# （Chrome / Edge）同步就绪、渲染稳定，故启动脚本强制用 Chromium 打开。
def find_chromium():
    """按序查找 Chrome / Edge 可执行文件，返回路径；都没有返回 None。"""
    candidates = []
    if sys.platform == "win32":
        pf = os.environ.get("ProgramFiles", r"C:\Program Files")
        pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        local = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            os.path.join(pf, r"Google\Chrome\Application\chrome.exe"),
            os.path.join(pf86, r"Google\Chrome\Application\chrome.exe"),
            os.path.join(local, r"Google\Chrome\Application\chrome.exe") if local else "",
            os.path.join(pf86, r"Microsoft\Edge\Application\msedge.exe"),
            os.path.join(pf, r"Microsoft\Edge\Application\msedge.exe"),
        ]
    elif sys.platform == "darwin":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
    else:  # linux
        import shutil
        for name in ("google-chrome", "google-chrome-stable", "chromium",
                     "chromium-browser", "microsoft-edge"):
            path = shutil.which(name)
            if path:
                return path
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None

# 扩展名 → MIME。.js/.mjs 必须是 JS MIME，否则 ES module 被浏览器拒收；
# .wasm 必须 application/wasm，否则流式编译报错。
EXTRA_MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
}


class Handler(SimpleHTTPRequestHandler):
    """静态文件处理器：修正 MIME + no-cache（与 VS Code Go Live 行为一致）。"""

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTRA_MIME:
            base = EXTRA_MIME[ext]
            # 文本类补 charset，二进制不补
            if base.startswith("text/") or base == "application/json" or base == "image/svg+xml":
                return base + "; charset=utf-8"
            return base
        return super().guess_type(path)

    def end_headers(self):
        # no-cache：每次都取最新文件，避免反复调试时浏览器（尤其 Firefox）
        # 复用旧 CSS/JS 缓存导致「改了没效果 / 显示异常」。
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 静默访问日志，终端只留启动信息


def main():
    args = sys.argv[1:]
    no_open = "--no-open" in args
    port = 8123
    for a in args:
        if a.isdigit():
            port = int(a)
            break

    handler = functools.partial(Handler, directory=ROOT)

    # 端口被占用则自动 +1 重试（最多 20 次），省得玩家手动改端口。
    httpd = None
    for _ in range(20):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
            break
        except OSError:
            port += 1
    if httpd is None:
        print("启动失败：找不到可用端口（8123~8142 都被占用）")
        sys.exit(1)

    url = "http://localhost:%d/" % port
    print("")
    print("  剪贴板里有什么？ 已启动")
    print("  " + url)
    print("")
    print("  按 Ctrl+C 停止。")
    print("")

    if not no_open:
        browser = find_chromium()
        if browser:
            try:
                subprocess.Popen([browser, url])
            except Exception:
                print("  自动打开失败，请手动在 Chrome / Edge 打开上面的地址。")
        else:
            print("  未找到 Chrome / Edge。液态玻璃在 Chromium 内核浏览器上显示最佳，")
            print("  请安装其一后手动打开上面的地址：")
            print("    Chrome：https://www.google.cn/chrome/")
            print("    Edge：  https://www.microsoft.com/edge")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        httpd.server_close()


if __name__ == "__main__":
    main()
