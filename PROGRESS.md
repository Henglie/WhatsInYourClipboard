# PROGRESS · WhatsInYourClipboard（剪贴板里有什么？）

> 项目进度与 AI 接管文档。**人看的介绍在 [README.md](./README.md)，本文件只给接手的 AI / 开发者。**
> 最后更新：2026-07-04（v1.0 发布）

---

## ▍本文档规范（四个项目统一，接手前先读这一段）

作者把 FairyGlass / FairySave / WhatsInYourClipboard / ElegantHLK 四个项目纳入统一管理，
每个项目固定两份 md，文件名、结构完全一致：

| 文件 | 给谁看 | 写什么 |
|---|---|---|
| `README.md` | 人（使用者） | 项目介绍、功能、安装使用 |
| `PROGRESS.md` | AI / 开发者 | 进度、结构、踩坑、待办（**就是本文件**） |

**AI 接管流程（任意 AI 接手任意一个项目，照做即可）：**
1. 读本文件「技术栈红线」+「踩坑记录」两节 —— 这是别人用时间换来的，不要重新踩。
2. 看「项目结构」定位代码，看「已完成 / 待办」找当前进度。
3. 动手前确认「用户偏好」（提交署名、emoji、语言等硬约束）。
4. 干完活**只更新本文件的状态行**：把做完的 `[ ]` 改 `[x]`，新坑补进「踩坑记录」。

**写作规范（省 token，不许跑偏）：**
- 任务用 `[x]` 已完成 / `[ ]` 待办 / `[~]` 进行中 三种标记，一眼可扫。
- **不写流水账、不留历史快照式日志**。完成的任务并进「已完成」一句话带过，别堆每轮对话。
- 踩坑记录 = 结论 + 为什么 + 怎么绕开，三句以内。不要贴长堆栈。
- 写「关键文件:行号」让人能直接跳，不要大段粘代码。
- 中文书写（作者中文交流）。

---

## ▍一句话定位

纯前端 + WASM 剪贴板透视工具。绝对隐私（零上传），液态玻璃 UI（皮肤即 FairyGlass 母本）。
核心是「娱乐网页」——让用户惊喜地发现网页能认出剪贴板内容、正确显示、并给出「下一步」。作者 Henglie，MIT。

---

## ▍技术栈红线

- **纯前端**：HTML + 原生 ES6 模块 JS，无构建步骤、无框架。
- **计算层 WASM**：C 编译（emscripten），承载 hexdump/sha256/md5/sha1/magic/PE 解析等重计算。
- **UI**：FairyGlass 液态玻璃（`css/` 是 FairyGlass 的原始母本，在此打磨记得回灌）。FairyGlass 已独立成开发库：<https://github.com/Henglie/FairyGlass>。
- **识别永远本地、零外发**。联网功能只做「下一步」按钮，点击才出去。
- 中式/特殊编码算法**必须查证源码或权威实现，不许编造**；所有解码用权威向量或往返测试验证后才算完成。
- 不用彩色 emoji（保留 ● ✓ ← 等黑白几何符号）。

---

## ▍项目结构

```
WhatsInYourClipboard/
  start.py                  一键启动脚本（零依赖 Python 静态服务器，正确 MIME + no-cache + 自动开 Chrome/Edge）
  启动.bat                   Windows 双击入口，转调 start.py
  start.command             macOS 双击入口，转调 start.py
  start.sh                  Linux/终端启动入口，转调 start.py
  index.html                入口页
  css/                      FairyGlass 母本：base/layout/theme
  public/core.loader.{js,wasm}  编译产物（WASM 加载器）
  src/
    main.js                 入口 + 状态机（EMPTY→READING→READY）
    clipboard/reader.js     读剪贴板
    core/
      ClassifierFactory.js  分类器注册表（REGISTRY，按 priority 降序瀑布判定）
      classifiers/          40+ 分类器，继承 BaseClassifier，实现 match()/parse()
      codec.js              CODECS 注册表（编解码器，23 项）
      ciphers.js            CIPHERS 注册表（密码工具，40 项）
      cnCiphers.js          中式编码（当铺/天干地支/百家姓/元素周期表/ROT8000）
      classicalCiphers.js   古典密码（Polybius/Beaufort/Gronsfeld/Porta）
      classicalGrid.js      古典密码网格族（Bifid/Trifid/PlayFair/ADFGX/ADFGVX/Nihilist/TapCode/FourSquare/GrayCode）
      ctfCiphers.js         CTF 编码（DNA/Braille/Cetacean）
      ctfExtra.js           CTF 编码（莫尔斯/六十四卦/兽音/QWE/TwinHex/CaesarBox/FracMorse）
      segment.js            多内容智能分段
      data/                 静态数据 JSON（bank-bins/cipai/poets/region-codes 等，不国际化）
    i18n/                   i18n.js(t()/setLang()) + zh.js(基准) + en.js（结构必须镜像）
    views/                  AppShell/ToolMenu/SplitView/LandingView/capabilities
    ui/                     liquidGlass.js（引擎）+ stepper.js
    wasm/                   C → WASM 源
  wasm/build.sh             编译脚本；wasm/selftest.mjs 自检（11 项）
  临时/                     已 clone 的第三方源码（ToolsFx/CyberChef），搬运参考，用完可删
```

---

## ▍踩坑记录

- **必须 http 协议，不能 `file://`**：ES module 会被 CORS 拦、`.wasm` 需 `application/wasm` 流式加载。起服务器：`python3 start.py`（零依赖，标准库，自带正确 MIME + no-cache + 自动开 Chrome/Edge）或任意静态服务器。液态玻璃走 `filter:url()`（非 backdrop-filter），Chromium（Chrome/Edge）表现最佳。
- **【Firefox 液态玻璃首帧错乱 · 真根因，2026-07-04 定案】**：`feImage` 的位移贴图是 `canvas.toDataURL()` 生成的 PNG data URL，**Firefox 对它异步解码**——首帧 PNG 未解码完，`feDisplacementMap` 取到空图 → 折射层渲染错乱、连带同帧 `background-clip:text` 标题一起崩。**铁证**：点任意链接跳走再点浏览器「返回」（bfcache 恢复已解码快照）立刻正常。Chromium 对 feImage data URL 同步就绪，故只有 Firefox 暴露；**服务器部署环境时序不同，Firefox 也正常，只有本地脚本启动 + Firefox 触发**。走过的弯路（均已排除、勿重试）：MIME 头、缓存头、CSS 加载时序（`whenStylesReady` 试过无效已撤回）、`background-clip:text` 回退——都不是根因。**最终方案**：本地启动脚本（start.py）默认用 Chrome/Edge 打开规避（作者拍板，不再为 Firefox 首帧单独 hack）。曾试的 feImage 预解码+抖动 filter 也已撤回（对 Chromium 无收益、对 Firefox 本地场景不稳）。
- **i18n 变量遮蔽 bug（踩过多次）**：分类器里 `const t = ...` 会遮蔽 i18n 的 `t()` 翻译函数 → `t is not a function`。局部变量改名 `text`。culture.js / ToolMenu.js 都中过招。
- **zh.js 与 en.js 结构必须镜像**：新增翻译两文件同步加键值对，缺键会显示原始 key。
- **领域中文不国际化**：古诗词/词牌名/诗人名/分类名（小令/中调/长调）/计数后缀（字/句/个）/`data/*.json` 数据**保留原中文**——它们是中文文化内容本身，不是 UI 文案。这是正确设计，别去翻译。
- **WASM 编译**：emcc 路径 `~/emsdk/upstream/emscripten/emcc`，需 `EXPORT_ES6=1`。改 C 后 `bash wasm/build.sh` 重编，再 `node wasm/selftest.mjs` 自检。
- **`prefers-reduced-motion` 别关停功能性动画**：遮罩动画（现为液态水纹）是「这是受保护内容」的核心视觉信号，不是装饰。曾用该偏好整段关掉 rAF，结果 Windows 11 默认开启此设置的机器上动画全静止（作者反馈「没有动画」）。功能性动画要恒动，该偏好只该弱化纯装饰过渡。
- **CDP headless 默认 `prefers-reduced-motion: reduce`**：用 chrome-headless-shell 验证动画时，不显式 `Emulation.setEmulatedMedia({features:[{name:'prefers-reduced-motion',value:'no-preference'}]})` 就采不到动画帧，会误判「粒子没动」。
- **MP4 tkhd 宽高偏移**：宽高是 tkhd payload（version+flags 之后）末尾两个 16.16 定点数，v0 在 payload 偏移 76、v1 在 88（即 box 头后再 +76/+88）。曾多算 8 字节取不到分辨率。
- **【最高优先】本会话工具链严重不可靠，必须用绝对路径 + 同进程读回**：根因疑为 `cd 中文路径` 后 cwd 被重置，导致相对路径的读/写落到错误位置；Edit/Write 多次报“成功”但磁盘未变，grep/bash/CDP 回显是旧值或别处文件，甚至启了 serving 旧目录的僵尸 http 服务器，据此一度误判“已提交/已完成”（实际 git 历史只到 `985b0af`，我汇报的多个 commit 根本不存在）。**铁律：①一切文件操作用绝对路径，不用 `cd`、不用相对路径；②改完立刻在同一条 node 命令里用绝对路径读回比对；③验证服务器先 curl 确认返回的就是磁盘最新内容；④git 状态以 `git -C <绝对路径> log/status` 为准。**
- **工具回显偶发错乱（接手务必知道）**：本会话多次出现 Edit 报“成功”但实际没落盘、grep/bash 回显与磁盘不符、CDP 输出是旧值的情况，一度据此误判“已完成”。**唯一可信的真相源是 `node -e` 直接读文件**；改完关键文件（尤其 JSON/i18n）后用 node 读回确认，别信工具的成功回显。
- **覆盖层遮罩别拦截底层指针**：Hex 整块遮罩 `.hex-mask`（`z-index:2`）曾绑自身 hover 揭示、且为防闪烁让揭示态也吃指针，结果它永久拦截底层 Hex 的滚动与字节 hover 联动（作者反馈「没法互动 hex 面板」）。正解：覆盖层恒 `pointer-events:none`（纯视觉层），hover 检测改挂外部宿主（`.pane--hex` 的 mouseenter/leave + focusin/out），遮罩从不吃事件，底层全程可交互。
- **强结构识别别当兜底、优先级别输给弱推断**：纯 URL 曾被默认识别成「一段外语」——因为 URL 识别埋在兜底 `TextClassifier`（priority 10）的 parse 里，而 `ForeignLangClassifier`（priority 12）靠 `detectLang` 判「全是拉丁字母 → 英语」抢先命中（URL 的 latinRatio=1.0）。强结构、高置信的识别（URL/邮箱/IP）反被优先级更高的弱推断（一堆拉丁字母=外语）压过。正解：在 `normalize.js` 抽共享 `asPureUrl()`，URL 识别与「外语排除纯 URL」共用同一判断（`ForeignLangClassifier.match` 里 `if (asPureUrl(t)) return false`），避免逻辑分叉。新增邮箱/IP 等强结构分类器时同理，务必给足优先级或在外语/纯文本处让路。

---

## ▍启动与验证

```bash
cd WhatsInYourClipboard
python -m http.server 8123    # 浏览器开 http://localhost:8123（Chromium 内核）
node wasm/selftest.mjs        # WASM 自检 11 项
bash wasm/build.sh            # 重编 WASM
```
测试语言切换：复制内容 → 识别 → 点 中/EN 切换 → 确认编解码工具仍可用、不跳回主页。

---

## ▍已完成

- [x] 应用外壳、状态机、FairyGlass 液态玻璃 UI（含着陆页能力看板）。
- [x] **分类器 40+ 个**：身份(身份证/手机/银行卡/IP/车牌)、结构化(JSON/CSV/Markdown/SQL/Cron/UA)、生活(地址/坐标/数学/ISBN/快递)、文化(古诗词/词牌/外语/emoji)、垂直(条码/分享码/三角洲改枪码)、文件(PE/ZIP/PDF/ELF/PEM)、媒体(图片/SVG)。
- [x] **编码工具箱 46 项全部验证通过**：CODECS 23 项 + CIPHERS 40 项（ROT 系列/Atbash/Caesar/Vigenere/古典网格族/中式编码/CTF 编码等），支持编码/解码方向，菜单自动从注册表生成、按 cat 折叠。
- [x] OllyDbg 风格自适应 Hex 表格（竖向滚动不横溢）+ 多内容智能分段。
- [x] WASM 计算层：hexdump/sha256/md5/sha1/magic/PE 解析，selftest 11 项全过。
- [x] **i18n 国际化全部完成**：行标签/动作标签/错误信息/参数标签全接入；语言切换不跳回主页；中/EN 顶栏切换；能力看板+hashPanel 已译。修复了 ToolMenu/culture 等多处变量遮蔽 bug。
- [x] **移动端 + 文件入口（2026-06-23）**：除 `Ctrl+V` / `clipboard.read()` 外，新增 `paste` 事件（移动端长按粘贴，无需读权限）与**文件拖放**（页面任意处，隐形入口不改着陆页外观）。拖放是获取 .exe/二进制真实字节的唯一可靠途径（复制文件进剪贴板只有路径）。关键文件：`clipboard/reader.js` 新增 `itemsFromDataTransfer()`；`main.js` 新增 `ingestItems()` + paste/drop 监听。
- [x] **控制字符显形（2026-06-23）**：解码结果含 `\0` 等控制符时不再被浏览器吞掉，渲染成 Unicode Control Pictures 字形（`␀ ␊ ␡`）。关键文件：`views/renderers/visibleText.js`，已接入 `ToolMenu.js` 与 `ActionEngine.js` 两个解码出口；CSS `.ctrl-char`（layout.css）。
- [x] **PE 解析增强（2026-06-23）**：WASM 与 JS 回退两路径统一输出 i18n 键（修了英文模式 WASM 路径显示中文 arch 的 bug）；PE 卡片补 类型(EXE/DLL)/节区数/编译时间。关键文件：`wasm/bridge.js` parsePE、`classifiers/FileBase.js`。
- [x] **车牌识别重写（2026-06-23）**：宽容识别 `贵A12345`/`贵 A12345`/`贵·A12345`/`贵-A 12345`（先 `normalizePlate()` 剥分隔符再严格匹配）；卡片显示**归属地**(城市上一级：直辖市=北京/上海，普通省=省份全称) + **发牌机关**(城市本身，京A→北京、琼B→三亚，拿不准的字母留空不瞎写)；支持新能源/教练/警车/挂车/港澳/使领馆/武警。**已去掉冗余的"省份简称"行**。关键文件：新增 `core/plate.js`（省份表+城市对照表 CITY），`classifiers/identity.js` PlateClassifier。注意正则坑见踩坑记录。
- [x] **敏感信息遮罩 — 液态水纹（2026-06-23，2026-06-24 改水纹）**：打码值之外再蒙一层缓缓扩散的微蓝水纹涟漪（随机点冒起同心细环 + 内侧拖尾环，ease-out 扩散、sin 渐隐渐现，低透明度若隐若现，贴合液态玻璃质感），底下垫薄磨砂兜底。交互：**鼠标移上 / 键盘聚焦透出明文，移开 / 失焦立即恢复**（纯 hover，**无点击粘性**），带淡出过渡。关键文件：`views/renderers/blurReveal.js`（`makeRippleVeil` 水纹引擎，所有活跃层共用一条 rAF，脱离 DOM 自动注销，揭示态暂停省电），接入 `TextBase.js` 敏感分支；`infoCard.js` 支持值传 DOM 节点；CSS `.blur-reveal*`（layout.css:502）。水纹是功能性视觉，**恒动不被 `prefers-reduced-motion` 关停**（见踩坑）。
- [x] **骨相 Hex 整块遮罩 — 同款液态水纹（2026-06-23，2026-06-24 改水纹）**：检出敏感信息时左侧 Hex「骨相」把原始字节摊开 = 明文泄露，故给整块蒙同款水纹遮罩（与右侧 blurReveal 共用 `makeRippleVeil` 引擎，纯 hover 揭示、移开立即恢复）。块级组件 `frostOverlay`（`blurReveal.js`），挂在 `.pane--hex`（relative）上盖住 `pane__body`（top:2rem 以下），自身不随内容滚动。**遮罩恒 `pointer-events:none`（纯视觉层），hover 检测挂在 `.pane--hex` host 上**——曾因遮罩吃指针导致 Hex 完全无法滚动/字节联动（见踩坑）。信号链：`result.sensitive=true`（TextBase 敏感分支 + identity 的身份证/手机/银行卡，IP/车牌不算个人隐私跳过）→ `main.js` 传 renderSplit；切候选用 `view.setHexMask(on)` 句柄按需挂摘。CSS `.hex-mask*`（layout.css:558）。CDP headless（强制 reduce）验证全过：水纹逐帧在画 + 纯 hover 揭示 + 移开立即恢复 + 零 JS 错误。
- [x] **文本空白/分隔耐性（2026-06-24）**：真实剪贴常被空格/连字符/标签/全角污染（`138 1234 5678`、`身份证：1101...`、`链接：https://x 。`），严格 `^...$` 一律落空。新建 `core/normalize.js`（`stripSpacesDashes`/`toHalfWidth`/`stripLabel`/`extractUrl`），身份证/手机/银行卡 match 前先 `digitId()` 归一（手机额外剥 `+86`/`86`），URL 改抽取式（容忍标签前缀+尾部句读，维基括号保留）。关键文件：`classifiers/identity.js`、`TextBase.js`。22 项 node 自测全过。
- [x] **媒体深挖 — EXIF/音频/视频（2026-06-24）**：新建 `core/mediaMeta.js` 纯字节解析（不解码整文件）：图片 JPEG EXIF（相机厂商型号/拍摄时间/光圈快门 ISO 焦距/**GPS 经纬度→接「在地图查看」**）、MP3 ID3v2 标签+帧头估比特率时长、WAV/FLAC 采样率声道位深时长、MP4/MOV box 解析（mvhd 时长+tkhd 分辨率）。MediaBase 图片卡补 EXIF 卡；新增 `AudioVideoClassifier`（priority 28，内嵌 `<audio>/<video>` 本地预览 + 参数卡 + ID3 标签卡）。CSS `.media-video/.media-audio`。23 项 node 自测全过（含修 tkhd 宽高偏移 bug：v0 应为 payload+76 而非 +84）。
- [x] **识别面扩展 — MAC/IPv6/文件路径（2026-06-24）**：identity 新增 MAC 地址（冒号/连字符/点分，OUI/广播/组播/本地管理判定）、IPv6（含压缩 `::`、回环、链路本地、唯一本地、文档段判定）；新建 `core/path.js` + lifeView `PathClassifier`，识别 Windows(`C:\`)/UNC(`\\srv\`)/Unix(`/usr/`) 路径，拆盘符/层级/文件名/扩展名/类型推断——补上「剪贴板是路径时只识别成纯文本」的缺口。i18n 中英已镜像。CDP 验证四类识别全过。
- [x] **遮罩动画恒动 + 改液态水纹（2026-06-24，作者反馈两轮）**：① 之前看不到动画的根因——`blurReveal.js` 在 `prefers-reduced-motion: reduce` 时**完全关停 rAF**（Windows 11 该系统设置常默认开启），动画彻底静止。改为**始终运行**，不被该偏好关停；CSS 层去掉对应的静态回退块。② 视觉从「TG 粒子噪点」改为**液态水纹涟漪**（作者要优雅、符合液态玻璃质感）：`makeSparkleVeil`→`makeRippleVeil`，随机点冒起同心细环、ease-out 扩散、sin 渐隐、低透明度若隐若现。CDP 强制 reduce 验证水纹逐帧在画（帧间 58932→61204）。
- [x] **Hex 遮罩不挡交互修复（2026-06-24，作者反馈「没法互动 Hex 面板」）**：根因——`hex-mask` 遮罩 `z-index:2` 且曾为防 mouseleave 闪烁刻意「揭示态也捕获指针」，结果永久拦截左栏 Hex 的滚动与字节 hover 联动。改为遮罩**恒 `pointer-events:none`**（纯视觉层），hover/聚焦检测改挂宿主 `.pane--hex`（`frostOverlay({host})`，mouseenter/leave + focusin/out）。这样 Hex 全程可滚动可联动，移上 pane 遮罩淡出露字节。CDP 验证：`pe=none` + hover 联动可用 + 可滚动 + 移上揭示/移开恢复 + 零错误。
- [x] **坐标识别放宽 + 图片深挖（2026-06-24）**：① `life.js` parseCoord 重写——容忍空格分隔（`39.9 116.4`）、方向前后缀（`N39.9 E116.4`）、度分秒 DMS（`39°54'30"N 116°23'30"E`），并收紧误报（纯整数对/单数字不再误判成坐标：要么带逗号/小数点/方向/度符号才认）；15 项 node 自测全过。② `imageInfo.js` 新增 `readImageDetail`——PNG 位深/色彩类型/透明/隔行/APNG 帧数、GIF 帧数+动图+透明、WebP 模式(有损/无损/扩展)+alpha+动画、JPEG 精度/分量(YCbCr/CMYK)/渐进；色彩类型/模式返回 i18n key（技术术语英文模式可译），MediaBase 图片卡补这些行。10 项 node 自测全过。
- [x] **示例展示页（2026-06-23，进行中收尾）**：`examples/index.html` + `examples/data.js` + `examples/assets/`（FairyGlass 母本 tokens/glass/liquidGlass 拷贝）。按 7 大类侧栏导航，每类每种可识别类型举一个真实样例（身份证/银行卡/ISBN/EAN13 都是带正确校验位的真数据），点样例即复制。敏感信息卡已演示磨砂遮罩。用 Playwright 截图迭代过外观。
- [x] **「下一步做什么」第一层落地（2026-06-24）**：actions.json 补齐 `media_audio`(复制曲名/搜网易云/复制时长)、`media_video`(复制分辨率/时长)、`id_mac`(查 OUI 厂商 macvendors/复制)、`id_ipv6`(ipinfo+ip138)、`life_path`(复制路径/文件名/父目录/explorer 命令)、`struct_csv`(复制为 Markdown 表格/原文)、`struct_ua`(在线解析/复制)、`id_plate`(复制号牌)、`file_pem`(复制完整 PEM) 共 62 个 actionKey；对应分类器补 tplVars（音视频 songQuery/dims/duration、path parent/winExplorer、csv markdown、ua、pem）；新增 14 个 actionLabel i18n 键（中英镜像）。隐私铁律照旧：id_card/id_phone/id_bankcard 仍空。CDP 真实浏览器验证 MAC/IPv6/路径/CSV/音频/PEM 动作全部正确渲染+插值无误+零错误。注：file_extended 的 hash 动作留给第三层动态注入（hash 异步算），暂空。
- [x] **一键启动 + 示例直达 + 移动端粘贴 + 随机数据（2026-07-04）**：一次做完四件，一条主线串起——三个「喂文本」入口最终都汇入 `main.js` 的 `ingestText(text)` → 复用 `ingestItems` 识别链路，零重复逻辑。
  - **一键启动脚本（最终为 Python 版）**：`start.py`（零依赖，仅标准库 http.server）——正确 MIME（`.wasm`→`application/wasm`、`.js/.mjs`→JS MIME，否则 ES module/WASM 加载失败）、no-cache 头（与 Go Live 一致，免缓存旧文件）、端口占用自动 +1、**强制探测 Chrome/Edge（Chromium）打开**（规避 Firefox 首帧现象，见踩坑），找不到提示装。三平台入口：`启动.bat`（Win，试 py→python）、`start.command`（macOS 双击）、`start.sh`（Linux/终端）。曾先做过 Node 版 `start.js`，因最终用 Python 且更好用而弃用删除。README 补「快速开始」+「浏览器兼容性」段。
  - **示例页一键直达（任务1）**：`examples/index.html` 每张非拖放卡加「用它试试 →」（`.ex-try`），跳 `../index.html#try=<Base64url(UTF-8)>`；主 app 新增 `tryFromHash()` 解出文本直接走识别、并 `history.replaceState` 清 hash（防刷新重触发/泄露到历史）。编码解码对应（examples `b64urlEncode` 编 `-_`去`=` ↔ 主 app 解 `-_`→`+/` atob）。46 个链接（恰好排除 4 张 drop 卡），含中文车牌 UTF-8。
  - **移动端粘贴弹框（任务2）**：新增 `ui/pasteSheet.js`。`main.js` 加 `IS_MOBILE` 判定（无 `clipboard.read` 或 `(hover:none)&&(pointer:coarse)&&窄屏`）→ 命中时「点我查看」不读系统剪贴板（手机拿不到），改弹 textarea + 「长按→粘贴」提示，提交走 `ingestText`。**不改着陆页大 UI**，仅按需弹出。
  - **随机数据按钮（任务3）**：新增 `core/demoData.js`（22 条真实样例池 + `pickRandomSample` 连点不重复）。LandingView 加 `landing__tryrow`——放在 hero（`min-height:calc(100vh-120px)` 占满首屏）**之下**，需下滑才见，不喧宾夺主；「复制随机数据」随机取一条写剪贴板并识别（复制失败不影响识别），旁附「看它能识别什么 →」链到示例页。
  - i18n 中英镜像新增 `landing.{tryHint,randomBtn,examplesLink}` + `mobile.*`（5 键）。主 app 无 `fg-btn`（那是 examples 的 glass.css），随机区/弹框按钮自带 `.landing__trybtn` 一套，配色走玻璃变量。
  - 验证：全部改动 JS `node --check` 全过、zh/en landing+mobile 键完全镜像、`start.py` curl 验证 MIME/no-cache、Edge headless 截图验证发布态渲染正常（随机区 + 标题 + 玻璃折射）+ `#try=` 手机号直达 split 视图（未停着陆页）+ 弹框结构文案完整。

## ▍待办

- [ ] **P1 本地测试验证**：逐个分类器渲染正常、英文翻译准确（启服务器人工过一遍）。

- [x] **P2 「下一步做什么」动作引擎广度扩展（第一、二、三、四层 ✓ 全部完成，均 CDP 真机验证通过）**

> **【进度 · 2026-06-26】** 第一、二层均**已完成、提交（`4b1fa64`）并 CDP 真机验证通过**。
> 接手复核：磁盘 + git 已含全部第二层改动（main.js 透传 ctx、`.qr-canvas` 样式、`renderQRCanvas` 签名修复、download/qr 双分支、i18n 镜像），独立 CDP 验证二维码像素零失配 + 下载 blob 触发 + 零 JS 错误，无遗留缺口。
> 第三层**核心已落地、CDP 真机验证通过**（机制 + URL 站点动作 + 图片 EXIF GPS 动作），见下方第三层块；BIN 客服电话、异步哈希注入两项故意延后（原因见块内）。
> 第四层**已完成、CDP 真机验证通过**（动作按意图分组「查证/转换/导出/复制」、外链 ↗ 标记、超阈值折叠「更多」），见下方第四层块。**P2 至此整体收口**。
> 下一步可开工 **P3 解码工具箱智能嗅探**。
> **铁律仍然有效**：本仓库改完任何文件用 `node` 以**绝对路径**读回确认，别信 Edit/Write/grep 的成功回显；起服务器先杀旧 python 进程，确认端口返回的是新内容（本会话仍多次见 cwd 漂移、僵尸服务器、curl 走代理 503）。


  > 目标：识别只是上半场，「认出来之后能顺手做点什么」才是这个娱乐网页的爽点。当前动作面偏薄——动作类型只有 `link`/`copy` 两种，本轮新增的分类器（音视频 / MAC / IPv6 / 路径）和一批旧分类器（CSV/UA/PEM/扩展文件等）还没有任何动作。下面分四层推进，从“补齐空缺”到“引入新动作能力”。

  **隐私铁律（先写在前面，做之前必读）**：
  - 敏感个人信息（身份证 `id_card` / 手机 `id_phone` / 银行卡 `id_bankcard`）的动作集**故意留空**，绝不提供“拿这个号去外部网站查”的链接——那等于把明文送出去，违背“零外发”立身之本。这三个保持 `[]`，要做也只能做**纯本地**动作（如本地校验位说明、复制脱敏值），不得加外链。
  - 一切外链仍遵循“点击才出去”，识别阶段零请求。

  **第一层 · 补齐空动作 ✓ 已完成（2026-06-24，纯配置 + 补 tplVars）**
  给本轮新分类器和现有空 `[]` 补 actions.json 条目 + i18n labelKey（中英镜像）。实际落地：
  - `media_audio`：复制曲名、（有 ID3）网易云搜歌名、复制时长。
  - `media_video`：复制分辨率、复制时长。
  - `id_mac`：复制规范化 MAC、查 OUI 厂商（api.macvendors.com）。
  - `id_ipv6`：ip138 / ipinfo.io 查询（与 `id_ip` 对齐）。
  - `life_path`：复制路径 / 文件名 / 父目录 / `explorer "路径"` 命令（parent 在分类器内就地算）。
  - `struct_csv`：复制为 Markdown 表格（分类器内生成 `markdown` 串）、复制原文。
  - `struct_ua`：跳 useragentstring.com 解析、复制 UA。
  - `file_pem`：复制整段 PEM（安全动作）。`id_plate`：复制号牌 + 复制归属地（纯本地）。
  - 配套补的 tplVars：MediaBase 音视频(title/artist/duration/resolution)、identity 车牌(region)、
    structuredView CSV(markdown/rows/cols)+UA(ua)、fileExtra PEM(pem)、lifeView 路径(parent/fileName)。
  - **与策划的出入**：`file_extended` 的「复制哈希」**未做**——哈希是 `buildHashPanel` 异步算的，
    应由第三层动态注入（`dynamicActions`），第一层留空；PEM 私钥的「复制 Base64 体」也留到有
    `reveal-action`（二次确认）再做，第一层只给安全的「复制整段」。
  - 验证：CDP 实跑 MAC/IPv6/路径/CSV/WAV，动作按钮齐全、link href 正确插值（无 `{{}}` 残留）、零 JS 错误。

  **第二层 · 新动作类型 ✓ 已完成（2026-06-26，CDP 真机验证通过）**
  在 `link`/`copy` 之外新增并落地了：
  - `download`：把字节/文本存成文件（`Blob`+`a.download`）。`source:"bytes"` 走 ctx（图片/PE/音视频原样另存），文本类走 tplVars（SVG 存 `.svg`）。
  - `qr`：纯本地零依赖二维码（`core/qrcode.js` 的 `makeQR`/`renderQRCanvas`），覆盖 URL/坐标/文本，手机扫一扫即用。
  - `transform-copy` / `reveal-action`：暂未做，留到后续按需补（非本轮验收目标）。
  实际落地与验证：
  - `ActionEngine.js` 的 `download`/`qr` 两分支 + `ctx` 形参 + import 均已落盘；`actions.json` 条目、zh/en i18n（`showQr/downloadFile/downloadVideo/downloadAudio/downloadSvg`+`action.qrResult`）镜像一致。
  - 补完两个交接缺口：① `main.js` 的 `showCandidate` 加第 4 形参 `ctx`，`renderActions` 透传，两个调用点补 `{bytes,mime,fileName}`；② `css/layout.css` 补 `.qr-canvas`（白底/12px 留白/10px 圆角/居中）。
  - **修了一个潜伏 bug**：`renderQRCanvas` 旧签名只收数字 `scale`，但 ActionEngine 传的是 `{scale,margin}` 对象 → `dim=NaN`、canvas 尺寸为 0，二维码画不出来。上会话「验证过」走的是 `makeQR` 直绘 OffscreenCanvas，绕过了这个包装函数，所以 bug 一直没暴露。已改成兼收对象与数字。
  - CDP 真机验证（完整 chromium-1200 + chrome-headless-shell）：paste(URL) 切到 URL 候选→点「生成二维码」→canvas 正确生成（246×246=（33+8）×6）、样式正确；drop(PNG)→「下载文件」按钮点击触发 download（blob href + `download="dot.png"`）；全程零 JS 错误。Windows 桌面 Chrome 不带 BarcodeDetector（Shape Detection API 仅 Android/Mac/ChromeOS），故改用**像素级自校验**：canvas 1089 个模块像素与 `makeQR` 布尔矩阵逐一比对 0 处不一致、安静区纯白——等价于扫码可解（编码器正确性上会话已用 BarcodeDetector 单独验过）。

  **第三层 · 上下文感知动作 ✓ 核心已落地（2026-06-26，CDP 真机验证通过）**
  机制打通：分类器 `parse()` 可回传 `result.dynamicActions`（与 actions.json 同构的 def 数组，
  `url`/`template` 一般已是算好的最终串，无 `{{}}`；文案优先 `labelKey`，无 i18n 键时用 `label` 直给），
  在 ActionEngine 里接到静态动作**之后**渲染。落点已实现：
  - `ActionEngine.renderActions(listEl, actionKey, tplVars, ctx, extraActions=[])` 第 5 入参；
    单 def 渲染抽成 `renderDef()`，新增 `labelOf()`（labelKey 优先、回退 label）。
  - `main.js` `showCandidate` 透传 `result.dynamicActions || []`。
  本轮落地的两类动态动作（纯同步、零新外发风险）：
  - **URL 已知站点专属动作**：新建 `core/siteActions.js`（纯函数 `siteActions(url)`）——
    GitHub 仓库(看 Issues/Releases/复制 git clone，排除 settings 等保留路径)、npm 包(复制 npm install)、
    YouTube(youtube.com/watch?v= 与 youtu.be，复制视频 ID)、B 站(复制 BV 号)。接入 TextBase URL 分支。
  - **图片 EXIF GPS**：MediaBase 图片 parse 有 GPS 时回传「复制拍摄坐标」+「在地图查看拍摄地」
    （OSM `openstreetmap.org/?mlat=&mlon=`，EXIF 即 WGS84 直喂，无需坐标系转换）。
  - i18n 新增 8 个 actionLabel 键（站点 6 + GPS 2，中英镜像，站点品牌名写进文案不翻译、动词走键）。
  - **未做（留后续，均有依赖未就绪）**：银行卡 BIN→发卡行客服电话（`bank-bins.json` 现仅 `bank`/`type`
    两字段，缺权威电话数据，不编造）；文件哈希算完动态注入 VirusTotal/微步（hash 由 `buildHashPanel`
    异步算，需动作区「算完回调重渲染」机制，本轮未引入）。
  - 验证：siteActions 纯函数 node 单测（GitHub/.git 去重/settings 排除/npm scoped/youtu.be/BV/www 剥离/
    非站点空集）全过；CDP 真机 4 URL（github/npm/youtube/普通）站点动作按条件正确出现/缺席、href 插值无误；
    CDP drop 带 GPS EXIF 的 JPEG → 两个 GPS 动作出现、OSM href 经纬度正确；全程零 JS 错误。

  **第四层 · 动作分组与可发现性 ✓ 已完成（2026-06-26，CDP 真机验证通过）**
  动作多了防“一排按钮糊脸”，全在 `ActionEngine.renderActions` + CSS + i18n 内完成：
  - **按意图分组**：四组固定序「查证(link)→转换(decode)→导出(download/qr)→复制(copy)」，
    由 def 类型派生（`GROUPS`/`TYPE_GROUP`/`groupOf`，可被 `def.group` 显式覆盖）。空组丢弃；
    **只有一组时平铺不显小标题**，多组时每组带小标题（`.action-group__title`）。
  - **外链视觉区分**：`link` 动作加 `.action-chip--external`，纯 CSS `::after` 缀 `↗` 离站标记
    （不污染 textContent），贴合「点击才出去」立场。
  - **过多折叠**：动作总数 > `FOLD_THRESHOLD`(6) 且组数 > `VISIBLE_GROUPS`(2) 时，前 2 组常显，
    其余折进「更多 N 项 ▾」开关（`.action-more`，默认 `hidden`，点击切换 `aria-expanded` + 文案）。
  - CSS：`.actions__list:has(.action-group)` 切纵向堆叠；`.action-group__row` 组内仍横向 wrap。
    i18n 新增 `actionGroup.{verify,transform,export,copy}` + `action.more/less`（中英镜像）。
  - 验证：CDP 真机 github(7 动作→查证 4+导出 1 常显、复制 2 折进「更多 2 项」、点开展开/收起切换正常、
    所有 link 带 ↗)、example.com(4 动作→三组平铺、低于阈值不折叠)；全程零 JS 错误。

  **交接备注**：P2 四层全部完成。后续新增动作只需在 actions.json / dynamicActions 里给对类型（或显式
  `def.group`），分组/外链标记/折叠会自动生效。所有外链动作新增时都要过一遍隐私铁律。

- [ ] **P3 解码工具箱智能嗅探**：粘贴后后台跑所有可逆解码器，只浮出「能解出有意义结果」的（判定 = 可打印比例 + 有效 UTF-8 + 命中已知模式加权）+ 搜索框过滤。
- [ ] **P4 继续搬运 ToolsFx 编码**（低优先，参考 `临时/ToolsFx/`）：
  - 古典密码 Hill/AutoKey/Manchester/Type7
  - CTF：BauDot/BrainFuck/Ook/BubbleBabble/EmojiSubstitution/Zero1248/零宽字符
  - base 变体：base58check/base65536/base2048/ecoji/radix 系列/utf7
  - 重型加密（**接审计过的 C 密码库编 WASM，不手抄**）：AES/DES/3DES/SM4/RSA/SM2/ChaCha/RC4

---

## ▍参考：注册表新增工具（自动出现在工具箱菜单）

```javascript
// codec.js 或 ciphers.js
newTool: {
  label: "中文名",                 // 硬编码回退
  labelKey: "codec.newTool",       // i18n 键（优先）
  cat: "ctf",                      // 分类：base/radix/web/fun/classic/modern/ctf
  fn: decodeFn,                    // 解码函数
  encode: encodeFn,                // 编码函数（可选，有则标 ⇄）
  params: [{ name:"key", label:"密钥", type:"text", default:"" }], // 可选，有则标 ⚙
}
```
分类器：继承 `BaseClassifier` 实现 `match()/parse()`，行标签用 `t("cardRow.xxx")`，注册到 REGISTRY 即生效。

---

## ▍git 约定 + 用户偏好（硬约束，四项目通用）

- **git：按作者指令提交/推送**。早期曾要求「吃掉 ToolsFx 前不提交」，该约束已解除——2026-06-24 作者明确「可以 git 上去了」，已提交并推送到 `origin/main`（本地 master → 远程 main）。此后照常按作者指令提交，不必再等。
- 第三方源码：`临时/ToolsFx/`（Kotlin 密码学，ISC）+ `临时/CyberChef/`（GCHQ，Apache-2.0），搬运参考，用完可删，署名见 README/NOTICE。
- 作者：恒烈 / Henglie。中文交流。**反感 emoji**。
- git 提交用 `Henglie <ebhenglie@gmail.com>` 身份，**绝不出现 Claude 署名 / Co-Authored-By / AI 痕迹**。