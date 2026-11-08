# Remarked 智能书签（Pico W / V2）

现有纸质书阅读计时页中的 **Smart bookmark** 接收真实 USB 数据，显示当前页、净阅读页数、有效时长、平均每次停留、阅读速度与起始页。三击结束后进入 **Finish & log**；保存后更新书籍进度和 Insights，单次阅读洞察有逐次停留柱状图，回翻保留为独立访问。

## 数据流

实体按钮 → Pico W 的 V2 → USB 串口 JSON → 本机 Python 桥接 → 现有 Cloud Run → 用户私有 Firestore → 网页 / 手机。

不需要新增数据库、GitHub Pages 服务或在浏览器连接 USB。电脑必须连接书签并运行桥接程序；手机可以打开同一账号查看。Pico 的 Wi-Fi 本版没有启用，不能脱离电脑独立上传。

## 首次安装

在项目根目录执行（Mac / Linux，Python 3.10+）：

```sh
python3 -m venv .tools/bookmark-venv
.tools/bookmark-venv/bin/python -m pip install -r hardware/requirements.txt
.tools/bookmark-venv/bin/python hardware/bookmark_bridge.py --list-ports
```

Windows 使用虚拟环境的 `Scripts/python.exe` 和对应的 `COM` 端口。

## 每次阅读

1. 在 Remarked 登录，打开 Library 中按页记录的纸质书条目，开始普通阅读计时。电子书内置阅读器使用自身的翻页记录，不接此 USB 卡片。
2. 在 **Smart bookmark** 填写 **Starting page**，选择 **Connect Smart Bookmark**。这会开始一段新的硬件计时，之前普通计时器的时间不合并。复制 10 分钟有效的一次性配对码。
3. 保存并退出 Thonny，避免两个程序占用同一串口。
4. 在这台已配置好的 Mac 上，可以直接双击 **`hardware/Connect Bookmark.command`**，在终端粘贴配对码并回车；它会自动选择唯一连接的 Pico 并使用新的本地队列。也可以从项目根目录运行下列命令。每次阅读使用新的 `--state` 文件；按提示输入配对码（终端不回显）：

```sh
.tools/bookmark-venv/bin/python hardware/bookmark_bridge.py \
  --port /dev/cu.usbmodem3101 \
  --run-v2 \
  --state .local/bookmark/reading-001.sqlite3
```

端口以 `--list-ports` 的结果为准。`--run-v2` 将保存的原始 V2 通过 MicroPython raw REPL **运行在 RAM**，停止设备当前程序，但不写入或覆盖 Pico 中任何文件。V2 一运行就发出 `reading_started`，不是等第一次点击才开始计时。若省略 `--run-v2`，须用已有方式在桥接连接后启动 V2；Thonny 不可同时占用端口。

5. 单击前翻、双击回翻、长按至少 1.5 秒并松开暂停/恢复、三击结束。结束后在网页填写地点和感受并保存。界面约每 2.5 秒同步一次。
6. 下一次阅读重新配对、换一个 `--state` 文件并再次运行 V2。原 V2 在三击后退出循环。

配对码关联当前用户、书籍和阅读记录，勿公开。桥接不需要 Firebase 密码或服务账号文件。电脑生成的设备令牌仅能向这一条阅读上传，24 小时过期；云端只存令牌摘要。本地队列及串口日志位于忽略提交的 `.local/`，权限为仅本人可读写。

## 断网与恢复

网络暂时断开时，串口事件先写入 SQLite 队列并自动重试。同一序号重传不会重复记账。停止桥接后，用原文件续传：

```sh
.tools/bookmark-venv/bin/python hardware/bookmark_bridge.py \
  --port /dev/cu.usbmodem3101 \
  --state .local/bookmark/reading-001.sqlite3 --resume
```

只补传已保存事件、不再连接 USB：

```sh
.tools/bookmark-venv/bin/python hardware/bookmark_bridge.py \
  --state .local/bookmark/reading-001.sqlite3 --resume --upload-only
```

恢复时不要加 `--run-v2`；重启固件会开启新的计时原点，需要新配对。USB 拔掉或桥接退出期间从未收到的事件不能恢复。断开超过 15 秒页面显示断连；必要时可选择 **Finish with received data**，仅保存最后已确认的数据，并停止接收该次阅读的后续事件。未开始的配对可直接取消。

## 计时与页码口径

- **Pages read / Reading pace**：当前页减起始页的净前进量，不把回翻重复算成新进度。
- **Average / page**：已完成访问的平均有效停留；重读算新的一次访问。
- **Reading duration**：排除暂停的设备时间。页面在正常连接时延续显示计时；最终保存采用设备事件的确认值。
- V2 的设备页 1 映射到用户填写的起始页。例如填写 42，第一次单击后为 43。原固件的回翻下限仍是本次起始页，不能回到 41。
- 原 V2 的普通事件累计时长不含尚未暂停的区间，接收端用总时长减暂停时长还原。未暂停就结束时，V2 会把最后一页的最后区间累计两次；接收端以会话总有效时长减已完成页时长校正。原始串口日志与校正前页时长均保留。
- 这里测量按钮之间的停留，不判断视线、理解程度，也不会自动翻动 Kindle / Apple Books 页面。

## 开发与验证

- 固件原件：`firmware/bookmark_v2.py`（不修改）。
- 桥接：`bookmark_bridge.py`；`--api` 可指向本地后台，远端仅允许 HTTPS。
- Python 测试：在 `hardware` 下运行 `../.tools/bookmark-venv/bin/python -m unittest test_bridge`。
- 协议/计时测试：`backend/test/bookmark.test.ts`。
- 页面使用原有认证，书签数据与访问记录位于用户私有子集合。配对和设备集合不能由客户端直接读取。
- 发布顺序：后台 → 前端导出 → Hosting；详细部署流程见 `docs/HANDOFF-V1.8.md`。

## 本次验证结果

2026-11-08：原 Pico W 通过真实按钮完成前翻、回翻、暂停、恢复、三击结束，两次阅读均完成云端同步、Finish & log 保存和逐页停留图展示。首次会话的有效时间为 60.6 秒、暂停 30.2 秒、5 次前翻；第二次为 36.3 秒、1 次前翻与 1 次回翻，同页第二次访问独立保留。临时 QA 用户和云端数据在验证后清理。后台 88 项测试、Python 2 项队列/解析测试、前后端 TypeScript、前端 ESLint 与网页构建通过；浏览器覆盖 320/390/1280 像素。真实手机端仍需使用者自行试用，这不是原生 iOS 二进制测试。
