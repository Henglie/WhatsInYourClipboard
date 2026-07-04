#!/usr/bin/env bash
# start.sh — Linux / macOS 终端启动入口，转调 start.py。
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 start.py
elif command -v python >/dev/null 2>&1; then
  exec python start.py
fi
echo "未检测到 Python 3，请先安装：https://www.python.org"
exit 1
