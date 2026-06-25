# PROGRESS · WhatsInYourClipboard（剪贴板里有什么？）

> 项目进度与 AI 接管文档。**人看的介绍在 [README.md](./README.md)，本文件只给接手的 AI / 开发者。**
> 最后更新：2026-06-23

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

- **必须 Chrome/Edge 等 Chromium 内核 + http 协议**：液态玻璃 SVG 滤镜仅 Chromium 完整支持；不能 `file://`，要起 `python -m http.server 8123`。
- **i18n 变量遮蔽 bug（踩过多次）**：分类器里 `const t = ...` 会遮蔽 i18n 的 `t()` 翻译函数 → `t is not a function`。局部变量改名 `text`。culture.js / ToolMenu.js 都中过招。
- **zh.js 与 en.js 结构必须镜像**：新增翻译两文件同步加键值对，缺键会显示原始 key。
- **领域中文不国际化**：古诗词/词牌名/诗人名/分类名（小令/中调/长调）/计数后缀（字/句/个）/`data/*.json` 数据**保留原中文**——它们是中文文化内容本身，不是 UI 文案。这是正确设计，别去翻译。
- **WASM 编译**：emcc 路径 `~/emsdk/upstream/emscripten/emcc`，需 `EXPORT_ES6=1`。改 C 后 `bash wasm/build.sh` 重编，再 `node wasm/selftest.mjs` 自检。
- **`prefers-reduced-motion` 别关停功能性动画**：遮罩动画（现为液态水纹）是「这是受保护内容」的核心视觉信号，不是装饰。曾用该偏好整段关掉 rAF，结果 Windows 11 默认开启此设置的机器上动画全静止（作者反馈「没有动画」）。功能性动画要恒动，该偏好只该弱化纯装饰过渡。
- **CDP headless 默认 `prefers-reduced-motion: reduce`**：用 chrome-headless-shell 验证动画时，不显式 `Emulation.setEmulatedMedia({features:[{name:'prefers-reduced-motion',value:'no-preference'}]})` 就采不到动画帧，会误判「粒子没动」。
- **MP4 tkhd 宽高偏移**：宽高是 tkhd payload（version+flags 之后）末尾两个 16.16 定点数，v0 在 payload 偏移 76、v1 在 88（即 box 头后再 +76/+88）。曾多算 8 字节取不到分辨率。
- **覆盖层遮罩别拦截底层指针**：Hex 整块遮罩 `.hex-mask`（`z-index:2`）曾绑自身 hover 揭示、且为防闪烁让揭示态也吃指针，结果它永久拦截底层 Hex 的滚动与字节 hover 联动（作者反馈「没法互动 hex 面板」）。正解：覆盖层恒 `pointer-events:none`（纯视觉层），hover 检测改挂外部宿主（`.pane--hex` 的 mouseenter/leave + focusin/out），遮罩从不吃事件，底层全程可交互。

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

## ▍待办

- [ ] **P1 本地测试验证**：逐个分类器渲染正常、英文翻译准确（启服务器人工过一遍）。
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

- **git：在彻底「吃掉」ToolsFx 之前都不提交**（用户明确要求，不要再问）。
- 第三方源码：`临时/ToolsFx/`（Kotlin 密码学，ISC）+ `临时/CyberChef/`（GCHQ，Apache-2.0），搬运参考，用完可删，署名见 README/NOTICE。
- 作者：恒烈 / Henglie。中文交流。**反感 emoji**。
- git 提交用 `Henglie <ebhenglie@gmail.com>` 身份，**绝不出现 Claude 署名 / Co-Authored-By / AI 痕迹**。