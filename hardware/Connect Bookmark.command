#!/bin/zsh
set -eu
APP_ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd -- "$APP_ROOT"
BRIDGE_PYTHON="$APP_ROOT/.tools/bookmark-venv/bin/python"
if [[ ! -x "$BRIDGE_PYTHON" ]]; then
  print '请先按 hardware/README.md 安装书签桥接环境。'
  read '?按 Enter 关闭窗口。'
  exit 1
fi
print '请先在 Remarked 阅读页选择 Connect Smart Bookmark，复制配对码，并退出 Thonny。'
print '输入配对码后会立即开始计时；三击结束后请在 Remarked 保存。'
SESSION_QUEUE=".local/bookmark/reading-$(date +%Y%m%d-%H%M%S)-$$.sqlite3"
"$BRIDGE_PYTHON" hardware/bookmark_bridge.py --run-v2 --state "$SESSION_QUEUE" || {
  print '连接未完成，详情见上方提示。已接收的事件保留在本机。'
}
print "本次队列：$SESSION_QUEUE"
read '?按 Enter 关闭窗口。'
