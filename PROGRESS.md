# PROGRESS · WhatsInYourClipboard（剪贴板里有什么？）

> 项目进度与 AI 接管文档。**人看的介绍在 [README.md](./README.md)，本文件只给接手的 AI / 开发者。**
> 最后更新：2026-07-05（v1.0 发布 + GitHub Pages 上线）

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
- **punycode 对纯 base36 数字串死循环**：`punycodeDecode` 无 `xn--` 前缀、纯数字(如 `1234567890123456`)时，内层解码循环 `pos` 越界后 `charCodeAt` 返 NaN → `digit<tt` 恒 false 永不 break。孤立看无害，但 sniffer 会把 punycode 纳入无参嗅探，用户粘纯数字进工具箱→整页卡死。正解：读字符前判 `pos>=t.length` 就抛「输入意外结束」，交给 sniffer 的 try/catch 吞掉。`codec.js:194`。

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

> 说明：以下每条 = 功能结论 + 关键文件（行号可跳）。过程细节、验证记录不留（踩坑经验见「踩坑记录」节）。

- [x] 应用外壳、状态机（EMPTY→READING→READY）、FairyGlass 液态玻璃 UI + 着陆页能力看板。
- [x] **分类器 40+ 个**：身份(身份证/手机/银行卡/IP/IPv6/MAC/车牌)、结构化(JSON/CSV/Markdown/SQL/Cron/UA)、生活(地址/坐标/数学/ISBN/快递/文件路径)、文化(古诗词/词牌/外语/emoji)、垂直(条码/分享码/三角洲改枪码)、文件(PE/ZIP/PDF/ELF/PEM)、媒体(图片/SVG/音频/视频)。`classifiers/`。
- [x] **编码工具箱 46 项**：CODECS 23 + CIPHERS 40（ROT 族/Atbash/Caesar/Vigenere/古典网格族/中式编码/CTF 编码），编解码双向，菜单从注册表自动生成、按 cat 折叠。`codec.js`/`ciphers.js`。
- [x] OllyDbg 风格自适应 Hex 表格（竖向滚动不横溢）+ 多内容智能分段（`core/segment.js`）。
- [x] WASM 计算层：hexdump/sha256/md5/sha1/magic/PE 解析，`selftest.mjs` 11 项全过。`wasm/`、`wasm/bridge.js`。
- [x] **i18n 全量**：行标签/动作/错误/参数全接入，切换语言不跳回主页，中/EN 顶栏切换，能力看板+hashPanel 已译。`i18n/`。
- [x] **多入口喂数据**：`Ctrl+V` / `clipboard.read()` + `paste` 事件（移动端长按，免权限）+ 文件拖放（页面任意处，隐形入口；拖放是拿二进制真实字节的唯一途径）。`clipboard/reader.js` `itemsFromDataTransfer()`、`main.js` `ingestItems()`。
- [x] 控制字符显形：解码结果里 `\0` 等渲染成 Control Pictures 字形（`␀␊␡`）。`views/renderers/visibleText.js`。
- [x] PE 解析：WASM/JS 双路径统一输出 i18n 键，卡片含类型(EXE/DLL)/节区数/编译时间。`wasm/bridge.js`、`classifiers/FileBase.js`。
- [x] 车牌识别：宽容剥分隔符(`贵·A12345`/`贵-A 12345`)后严格匹配，显示归属地+发牌机关，支持新能源/教练/警车/挂车/港澳/使领馆/武警。`core/plate.js`、`classifiers/identity.js`。
- [x] **敏感信息双层遮罩 — 液态水纹**：右侧值 + 左侧 Hex 骨相同蒙缓扩散水纹涟漪（`makeRippleVeil` 引擎，共用一条 rAF）。hover/聚焦透出明文、移开即恢复，无点击粘性。遮罩恒 `pointer-events:none`，hover 检测挂宿主。水纹是功能性视觉，恒动不被 `prefers-reduced-motion` 关停。`views/renderers/blurReveal.js`、layout.css:502/558。信号链见 `TextBase.js` 敏感分支 + identity。
- [x] 文本污染耐性：空格/连字符/标签/全角一律先归一再匹配。`core/normalize.js`（`stripSpacesDashes`/`toHalfWidth`/`stripLabel`/`extractUrl`/`asPureUrl`）；身份证/手机/银行卡 `digitId()` 归一，URL 抽取式。
- [x] 媒体深挖：纯字节解析(不解码整文件)——JPEG EXIF(相机/时间/光圈快门ISO焦距/GPS→地图)、MP3 ID3v2+比特率时长、WAV/FLAC 参数、MP4/MOV box(时长+分辨率)。`core/mediaMeta.js`、`AudioVideoClassifier`(priority 28) 内嵌预览。
- [x] 识别面扩展 MAC/IPv6/文件路径：MAC(OUI/广播/组播判定)、IPv6(压缩`::`/回环/链路本地判定)、路径(Win/UNC/Unix 拆盘符层级文件名)。`core/path.js`、`PathClassifier`。
- [x] 图片深挖：PNG 位深/色彩类型/APNG 帧、GIF 动图、WebP 模式/alpha、JPEG 精度/分量/渐进。`imageInfo.js` `readImageDetail`。
- [x] 坐标识别放宽：空格分隔/方向前后缀/度分秒 DMS，收紧误报(纯整数对不认)。`life.js` parseCoord。
- [x] 示例展示页：7 大类侧栏，每类举真实样例(校验位真实)，点即复制，演示遮罩。`examples/`。
- [x] **「下一步做什么」动作引擎（P2 四层全完成）**——见「待办 P2」块存档。四类动作 `link`/`copy`/`download`/`qr`(纯本地零依赖二维码 `core/qrcode.js`)；上下文感知动态动作(`result.dynamicActions`：URL 站点专属 `core/siteActions.js`、图片 GPS→地图)；按意图分组(查证/转换/导出/复制)+外链 ↗ 标记+超阈值折叠。`ActionEngine.js`、`actions.json`。隐私铁律：id_card/id_phone/id_bankcard 动作永远空。
- [x] **一键启动 + 示例直达 + 移动端粘贴 + 随机数据（2026-07-04）**：三个喂文本入口都汇入 `main.js` `ingestText()` → 复用识别链路。
  - `start.py`（零依赖标准库 http.server）：正确 MIME(`.wasm`/`.js`)、no-cache、端口占用 +1、强制开 Chrome/Edge（规避 Firefox 首帧，见踩坑）。三平台入口 `启动.bat`/`start.command`/`start.sh`。
  - 示例直达：示例卡「用它试试 →」跳 `#try=<Base64url>`，主 app `tryFromHash()` 解出即识别并 `replaceState` 清 hash。
  - 移动端：`ui/pasteSheet.js`，`IS_MOBILE` 命中时弹 textarea 手动粘贴（手机拿不到系统剪贴板），不改着陆页 UI。
  - 随机数据：`core/demoData.js`（22 条样例池，连点不重复），LandingView 放 hero 之下需下滑才见。
- [x] **GitHub Pages 部署上线（2026-07-05）**：`https://henglie.github.io/WhatsInYourClipboard/`。全相对路径，子路径部署零改动；legacy 构建器 `Deployment failed` → 改用 GitHub Actions 部署（`.github/workflows/deploy-pages.yml`，push main 自动重发），`.nojekyll` 防吞 `src/`。README 顶部加在线体验入口。
- [x] **本地媒体工坊 — 深度动作（2026-07-05）**：识别之后能就地加工，全程 canvas 内存处理、零外发、零新依赖/体积。图片工坊 `imagelab`：转格式(PNG/JPEG/WebP)、有损质量滑块、最长边等比缩放(1920/1280/800)、旋转 90°/翻转，实时预览+输出体积增减对比、一键下载。视频抽帧 `videoframe`：内嵌 `<video>` 拖到某帧抓当前帧存 PNG/JPEG。`core/imageTools.js` `processImage()`、`ui/mediaLab.js`(按需 `import()`)；ActionEngine 加 `imagelab`/`videoframe` 两动作类型(归 export 组，无 `ctx.bytes` 不渲染)；接入 media_image/media_video。i18n `mediaLab.*` 22 键中英镜像。CDP 真机验证：PNG→JPEG+缩放/旋转宽高互换/全链路 drop→识别→开工坊 全过、零 JS 错误。**未引 ffmpeg.wasm**：32MB 违背零依赖，且 GitHub Pages 无法设 COOP/COEP 头→多线程版跑不起来(见踩坑)。

- [x] **隐写透视 — 不可见字符侦测（2026-07-05）**：「剪贴板透视」的暗面。粘一段看似普通的文字，揪出肉眼看不见的隐藏字符并还原藏进去的内容。覆盖四类：① Unicode Tag 走私(U+E0000–E007F，LLM 提示注入常用)② 变体选择器隐写(Paul Butler 2024，U+FE00–FE0F/E0100–E01EF 藏任意字节)③ 零宽二进制(U+200B=0/U+200C=1)④ bidi 双向覆盖视觉欺骗(U+202A–202E 等，让 gpj.exe 显示成 exe.jpg)。输出：净化后可见文本、解出的隐藏消息、逐字符明细(hex+名称+位置)。三动作全纯本地(复制隐藏消息/净化文本/明细报告)，零外链契合隐私铁律。core/zeroWidth.js(detect/decodeAll/isStego，源码内不可见字符全用转义书写)、classifiers/InvisibleStego.js(priority 48，抢在文化/文本兜底前、不抢身份类)。isStego 阈值：tag>0 或 bidi 或 零宽≥4(排除 emoji ZWJ)或 变体选择器≥4。i18n stego.* 16 键+cls.invisibleStego+3 actionLabel 中英镜像。CDP 真机验证：Tag 走私解出明文/bidi/零宽二进制/变体选择器四场景全过、普通中英文/emoji ZWJ/URL/零星零宽 四类零误报、零 JS 错误。（补记：stego_invisible 动作曾因工具回显假成功一度未真正落盘，全量体检 actions 键数比对才发现，已补齐并 CDP 复验 3 动作渲染点击生效；教训——批量改 JSON 后必须核键数，别信回显。）- [x] **BrainFuck / Ook! 解释器（2026-07-05，P4 CTF 编码搬运）**：CTF 高频。同一个解释器覆盖两种（Ook! 是 BrainFuck 的三词方言，Ook./Ook?/Ook! 组合映射 8 指令）。规范明确 8 指令（`><+-.,[]`），30000 单元磁带、字节回绕、死循环守卫（步数上限）、括号不配对报错。经典 `Hello World!` 程序解码正确、往返验证多组（含 `flag{...}`）通过。`core/ctfExtra.js` 加 `brainfuckDecode/Encode`、`ookDecode/Encode`；`ciphers.js` 注册 `brainfuck`/`ook`（cat:ctf，共 42 项）；i18n `cipher.brainfuck`/`cipher.ook` 中英镜像。嗅探不误纳（需特定语法）。逻辑层全绿，CDP 真机验证未跑（作者免测）。

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

- [x] **深度动作外链 — 跳成熟开源本地处理站（2026-07-05）**：识别为媒体后可就近跳成熟开源、```浏览器内本地处理```的在线工具，点击才出去、契合零外发。经 GitHub API 一手核实处理位置后落地：media_image 加 Squoosh(`squoosh.app`，Google 开源 Apache-2.0，图片本地压缩/转格式) + VERT(`vert.sh`，AGPL-3.0，本地 WASM 转图片) 两条 `link`；media_audio 加 VERT(本地 WASM 转音频)。均 `group:"export"` 归「导出」组、与本地工坊并列，文案标「本地·不上传」。**视频不加**：VERT 视频走服务端上传、ffmpeg.wasm 是库非成品站，无合格零上传站，宁缺勿打脸。落点：`actions.json` media_image/media_audio + i18n `actionLabel.squooshImage/vertConvertImage/vertConvertAudio`(中英镜像)。CDP 真机验证：分组归位、`↗` 外链标记、href、零 JS 错误全过。**只推不上传的站**（CloudConvert 等服务端转换一律不推）——见记忆「外链隐私边界」

- [x] **P3 解码工具箱智能嗅探（2026-07-05）**：进工具箱自动把所有免密钥解码器（无参、含默认码表的 CODECS+CIPHERS，排除全列举型）跑一遍，只浮出「解出有意义结果」的候选卡，点卡即复用 runTool 选中该工具。判定三闸门+加权：可打印比例≥0.8、UTF-8 有效（无 U+FFFD）为闸门，得分主体是模式命中（URL/邮箱/JSON/CTF flag/常见英文词），codec 干净解码给 0.15 先验、cipher 不给（替换密码太易凑可打印串），阈值 0.35。含搜索框按工具名/结果过滤。关键文件：`core/sniffer.js`（`sniff()` 纯逻辑）、`views/ToolMenu.js`（顶部嗅探区，卡片点击复用 runTool）、i18n `sniffer.*` 4 键镜像、layout.css `.sniffer*` 样式。CDP 真机验证：base64 串→浮出 Base64 卡解出明文、点卡结果区正确、搜索过滤生效、卡片激活态+玻璃层正常、零 JS 错误。
- [~] **P4 继续搬运 ToolsFx 编码**（参考 `临时/ToolsFx/`）：
  - [x] 古典密码 Hill/AutoKey/Manchester/Type7 —— 见下「P4 纯 JS 批」
  - [x] CTF：BauDot/BubbleBabble/EmojiSubstitution/Zero1248 ｜ BrainFuck/Ook ✓ ｜ 零宽字符 ✓
  - [x] base 变体：base58check/base65536/base2048/ecoji/radix10/radix64/utf7 —— 见下「P4 纯 JS 批」
  - [x] 重型加密（**接审计过的 C 密码库编 WASM，不手抄**）：AES/DES/3DES/RC4/ChaCha20/RSA(mbedTLS) + SM4/SM2(GmSSL) 全部完成 —— 见下「P4 重型加密 WASM」

- [x] **P4 纯 JS 批（2026-07-07 完成）**：15 算法（Hill/AutoKey/Manchester/Type7 + Baudot/BubbleBabble/EmojiSubst/Zero1248 + radix10/radix64/base58check/base2048/base65536/ecoji/utf7），源码 4 模块 + 注册 + i18n 全落盘、node 往返验证。
  - **4 模块**：`classicalExtra.js`(hill/autokey/manchester/type7)、`ctfEncodings.js`(baudot/bubbleBabble/emojiSubst/zero1248)、`baseExtra.js`(radix10/radix64/base58check/utf7，自带纯 JS 同步 SHA-256)、`bigBase.js`(base2048/base65536/ecoji，超大码表 node 从 Kotlin 机械抽取)。均含权威向量验证。
  - **注册**：`ciphers.js` 48 项(新增 hill/autokey→classic，manchester/type7/baudot/bubbleBabble/emojiSubst/zero1248→ctf)；`codec.js` 35 项(新增 7 codec)。
  - **i18n**：zh/en 三段键数对齐(cipher 48/codec 35/cipherParam 15)，named export `ZH`/`EN` 读回核过。
  - **sniffer**：7 新 codec 全 sniffable，12 例非目标输入(URL/明文/纯数字/base64/中文/JSON/hex/邮箱/flag/标点等)零误报；6 codec 正向能浮出(score 1.00)；utf7 对纯 ASCII 编码恒等于原文→被「等于没解」跳过，设计固有局限非 bug。
  - **顺手修 punycode 死循环 bug**：`punycodeDecode` 对无 `xn--` 的纯 base36 数字串(如 `1234567890123456`)越界后 `charCodeAt` 返 NaN、`digit<tt` 恒 false 永不 break→死循环。sniffer 会纳入 punycode，用户粘纯数字进工具箱整页卡死。已加 `pos>=length` 越界抛错(`输入意外结束`)，被 sniffer try/catch 吞掉。真实向量 münchen/bücher/中国 仍解正确。`codec.js:194`。
  - **CDP 真机验证未跑**(作者可代跑或免测)。临时脚本可清理(清单见下)。
  - **临时脚本清单（全部可删）**：`_addutf7 _basetest _basetest2 _bbtest _bigtest _cipherverify _fiximport _fiximport2 _gen_base2048 _gen_bigbase _base2048_table.json i18n_payload.json inject_i18n.mjs`（注：payload/inject 删前先把 i18n 落盘）。`_gen_base2048.mjs`/`_gen_bigbase.mjs` 是码表再生成器，删前考虑在 bigBase.js 头注明来源。

- [x] **P4 重型加密 WASM（2026-07-07，一期+二期完成）**：AES/DES/3DES/RC4/ChaCha20 + RSA(PKCS1v15/OAEP) 全部**接审计 C 库(mbedTLS 2.28.10)编 WASM，未手抄一行密码算法**。SM4/SM2 走 GmSSL 3.x 二期已完成(见文末二期段)。**实现**：`wasm/mbedtls_config.h`(裁剪配置，只留所需模块) + `wasm/src/crypto_sym.c`(对称，enum algo/mode，PKCS7，ECB/CBC/CTR) + `wasm/src/crypto_rsa.c`(RSA，PEM/DER 解析，PKCS1v15/OAEP；`EM_JS` 桥接 `crypto.getRandomValues` 补 WASM 无系统熵)。编入 `public/core.loader.wasm`(89253 字节)，标准测试向量全过(AES ECB/CBC/CTR/PKCS7、DES/3DES 2key/3key、RC4、ChaCha20 RFC7539、RSA 双 padding 往返)。**封送层** `src/wasm/bridge.js` 加 `symCrypt`/`rsaCrypt`(多缓冲区 malloc/free，返回 Uint8Array|{error}|null)。**UI 接入**(轻改)：`src/core/cryptoTool.js` 新模块把字节级 bridge 包成工具箱要的「字符串进串出」同步 fn，密钥/IV/密文的字节↔文本走可选编码选择器(utf8/hex/base64，CTF 与日常习惯都覆盖)；注册进 `ciphers.js` 的 `CRYPTO_CIPHERS`(cat:modern，共 6 项)；`ToolMenu.js` 的 `buildCtrl` 轻改支持 `select`/`textarea` 参数类型 + `labelKey||label` 兼容。i18n `cipher.{aes,des,des3,rc4,chacha20,rsa}` + `cryptoParam.*`(14) + `cryptoTool.*`(9) 中英镜像。嗅探天然排除(密钥参数 default 空→`isSniffable` 返 false)。node 端到端往返全绿(对称 5 种 + RSA 双 padding)。CDP 真机验证未跑(作者免测)。 **【二期 SM4/SM2（GmSSL 3.x，Apache-2.0）】** SM4：`wasm/src/crypto_sm.c` 用 GmSSL 审计过的 `sm4.c` 单块 API 自实现 ECB/CBC/CTR+PKCS7(与 crypto_sym.c 循环调单块同性质，非手抄轮函数)，源闭包极小(仅 sm4.c，sm4.h→ghash.h→gf128.h 纯头不链 GCM)。国标 GB/T 32907 单块向量对上(681edf34d206965e86b3e94f536e4246)。SM2：`wasm/src/crypto_sm2.c` 绕过 sm2_key.c 的 PEM/DER/x509 重依赖——裸 32B 私钥标量 / 64B(或 65B 带 04)公钥点直接构造 SM2_KEY，密文按 C1C3C2(C1=04||x||y) 字节布局自拼避开 asn1，与 BouncyCastle/主流国密工具默认一致；调 GmSSL 审计过的 sm2_do_encrypt/do_decrypt。源闭包 sm2_enc.c+sm2_z256.c+sm2_z256_table.c+sm3.c+hex.c(-O3 DCE 丢掉未调 asn1 分支，不编 asn1.c/oid.c)。**RNG**：GmSSL rand_bytes 默认读 /dev/urandom，WASM 无此设备→crypto_sm2.c 提供同签名 rand_bytes 覆盖符号，走 EM_JS(复用 crypto_rsa.c 的 cb_js_random，extern 声明避免重复符号)，不编 rand.c。封送层加 `sm4Crypt`/`sm2Crypt`；cryptoTool.js 加 sm4Run/sm4Def + sm2Run/sm2Def，注册 sm4(key/iv/mode 全参)+sm2(hex 密钥 textarea)，CRYPTO_CIPHERS 共 8 项。i18n `cipher.{sm4,sm2}`+`cryptoParam.sm2Key` 中英镜像(cipher 56/cryptoParam 15/cryptoTool 9 齐)。**验证**：SM4 三模式往返+错误码全绿；SM2 GM/T 0003 标准配对(pub=priv·G)加解密成功(证曲线运算与标准一致)、错配私钥被 C3 摘要校验拒绝(-3)、hex 密文兼容、C1 带/不带 04 前缀均解;node 端到端全链路全绿;自检 11 项未破坏。踩坑：wasm-ld duplicate symbol(cb_js_random+rand_bytes)——EM_JS 改 extern 复用+残留 .o 干净重编解决;build.sh 行级 split 插入避开 CRLF/LF 锚点 MISS。CDP 真机验证未跑(作者免测)。

---

## ▍2026-07-07 编解码/加解密审计（deepseek-pro 报告核查 + 自查）

外部 agent（deepseek-pro）交来 `bug-report.md`，声称加解密/编码有 bug。逐条核查 + 全量往返自测后结论：**该报告未触及任何加解密(crypto)真 bug**，crypto 层 0 条问题，与上轮全链路验证一致。但自查另发现多个编解码字表/算法真 bug（报告漏了）。

### 已修（真 bug，均经往返自测验证）

- **元素周期表 `cnCiphers.js`**（报告漏报，作者点名）：
  - 序号 30 `Zi` → `Zn`（锌拼写错，Zi 非元素）
  - 序号 53 `In` → `I`（碘缺失且与 49 号铟重复；`indexOf` 命中首个 → charCode 全错，CTF 数字/字母映射直接坏）
  - 全表与 IUPAC 118 元素零差异，`Hi5`/`flag`/`I` 往返闭环。
- **CaesarBox `ctfExtra.js`**（报告漏报）：非整除长度往返损坏（`HELLOWORLD` h=3 → `HEWLOLORDL`）。根因 decode 靠 NUL 占位重建锯齿网格失败。重写为精确列长锯齿重建，7 例含非整除全绿。
- **codec.js radixN 系列**（报告漏报，静默丢字节，最危）：
  - `radixNEncode` 删 `if(num===0n) out=dict[0]`：空串/全零字节 encode 多吐首字符（base58 `""`→`"1"`）。
  - base62/base36 `decode` 补前导零字节还原（原本只有 base58 有）：encode 补零 decode 不还原 → 前导 ` ` 静默丢失。三码表含全零字节往返全绿。
  - **base69Decode** 重写：原 `replace(/(?:00000000)*$/,"")` 盲剥尾零，把合法尾部 ` ` 删掉；且 `AA` 填充对当数据解。改为靠 pad 标记 `(AA)*(pad-1)+digit+"="` 精确反推原始字节数 N，取前 N 字节。14 例含尾零边界全绿。
  - hexDecode/hexReverseDecode/binaryDecode 空输入守卫：encode `""`→`""`，decode 收 `""` 应回 `""` 而非抛「非法/不对齐」。
- **sniffer.js `COMMON_WORDS`**（报告 L1）：删重复的 `"was"`。
- **segment.js 中文短文本误拆**（报告 H1）：五言绝句/对联无标点时 proseCount=0 落兜底逐行拆。加 CJK≥50% 整段守卫，诗词/对联不拆，URL 列表/英文短码仍正确拆。

### 复核为「非 bug / 有意行为」

- `ctfCiphers.js` brailleDecode 行尾 `.replace(//g,"\r\n")`：``(单元分隔符)→CRLF 是 ToolsFx 行分隔约定，非乱码。
- `codec.js` base16x（base16Decode）`if(byte!==0) out.push(byte)`：ToolsFx 有意过滤零字节，注释已标，列为**已知有损**，非疏漏。
- Hill/PlayFair/FourSquare 的 X 填充：分组密码补位特性，往返带 X 属正常；Hill 过维基向量 ACT↔POH。
- base58Decode 空串（报告 L5 提的 base58/62 空输入）：修 radixNEncode 后往返正常，非 bug。
- punycode 尾 sigma 不做 IDNA final-sigma 映射：与 WHATWG URL 及 legacy punycode 模块一致，正确。

### 已修（报告 M 类工程隐患，2026-07-07 二轮，均经 node 读回 + 语法校验）

- **M1 ✅** `HexView.js` 已返回 `{destroy}`（disconnect ResizeObserver），但 `SplitView` 里 `requestAnimationFrame(()=>renderHexView(...))` 丢弃了句柄 → 修为捕获进 `hexHandle`，聚合到视图 `destroy()`。
- **M2 ✅** `blurReveal.js`：`makeRippleVeil` 加显式 `destroy()`（停转 + 断 canvas ResizeObserver，不再只靠 draw 循环 `isConnected` 兜底——canvas 若从未进 draw 循环则永不触发）。`frostOverlay` 契约改 `{el, destroy}`，host 上 4 个监听器统一挂 `AbortController.signal`，destroy 时 `ac.abort()` 一次性摘除。
- **M3(生命周期总闸) ✅** `main.js` 加模块级 `currentView` + `destroyCurrentView()`，在 `showLanding`(复位前) 与 `handleReadWithItem`(开头) 两入口调用，覆盖复位/切候选/语言切换(i18n:change 直接重渲不经 showLanding)/吃新文件全路径；`renderSplit` 返回值存 `currentView`。这是 M1/M2 真正生效的前提——子资源有了 destroy，还需宿主在重渲染时调它。
- **M5 ✅** `deploy-pages.yml`：`path: .` → 白名单组装 `_site`（`cp index.html LICENSE README.md .nojekyll` + `cp -r css src public examples docs`）再上传。白名单而非 path+排除，从根上杜绝 `临时/`(ToolsFx/CyberChef 源)、`wasm/`(mbedTLS/GmSSL C 源)、内部文档(PROGRESS/bug-report)泄漏，即便 `git add -f 临时/` 也进不了产物。本地模拟 cp 验产物干净；运行时 WASM 走 `public/core.loader.js` 不碰被排除的 `wasm/` 源。新增站点资源须在 workflow 白名单登记。

### 仍未修（低危，当前无害，待定夺）

- **M3/L4** `main.js` `showLanding()` 未 await：内部 DOM 操作同步，当前无害；`#try=` 启动理论上 DOM 交错。低危。
- **M4** `ClassifierFactory.js`：`classifyAll` 每个命中分类器 `new Cls()` 两次（match 一次、parse 一次）。当前分类器构造无副作用，仅轻微浪费；若将来构造有副作用会重复执行。
- **L2** `culture.js` CipaiClassifier.match `const t=` 遮蔽 i18n `t()`：当前 match 未调 t()，无 bug，隐患。
- **L3** `InvisibleStego.js`：match 与 parse 各调一次 `detect()`，长文本重复遍历。可缓存到实例。

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