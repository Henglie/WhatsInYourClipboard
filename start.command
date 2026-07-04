#!/usr/bin/env bash
# start.command — macOS 双击入口，转调 start.py。
# 双击时工作目录未必是脚本所在处，先 cd 过去。
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 start.py
elif command -v python >/dev/null 2>&1; then
  exec python start.py
fi
echo "未检测到 Python 3，请先安装：https://www.python.org"
read -r -p "按回车键退出…" _
