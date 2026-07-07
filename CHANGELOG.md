# 更新日志 · Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。日期格式 YYYY-MM-DD。
This project adheres to [Semantic Versioning](https://semver.org/). Dates in YYYY-MM-DD.

---

## [1.1.0] - 2026-07-07

识别之外的「动手」能力大扩容：解码工具箱补齐至 35 编码 + 58 密码，新增接审计 C 库编译的重型加密、隐写透视与本地媒体工坊。
A big expansion beyond recognition: the codec toolbox now covers 35 encodings + 58 ciphers, plus heavy-weight cryptography compiled from audited C libraries, steganography X-ray, and a local media lab.

### 新增 · Added
- **重型加密**（接审计 C 密码库编译为 WASM，未手抄一行算法）：AES / DES / 3DES / RC4 / ChaCha20 / RSA（Mbed TLS）+ 国密 SM4 / SM2（GmSSL）。密钥 / IV / 密文支持 UTF-8·Hex·Base64 编码选择。
- **隐写透视**：揪出肉眼不可见的隐藏字符——Unicode Tag 走私、变体选择器隐写、零宽二进制、bidi 视觉欺骗，并还原藏匿内容。
- **本地媒体工坊**：图片转格式 / 质量 / 缩放 / 旋转、视频抽帧，全程 canvas 内存处理、零外发。
- **解码工具箱智能嗅探**：进箱自动把免密钥解码器跑一遍，只浮出「解出有意义结果」的候选卡。
- **编码族大批搬运**：Base2048 / Base65536 / ecoji / radix 系列 / UTF-7 / base58check、古典密码 Hill / AutoKey、CTF Baudot / BubbleBabble / EmojiSubstitution / Zero1248 / BrainFuck / Ook! / 零宽字符等。
- **上下文感知动作**：URL 已知站点专属动作（GitHub / npm / YouTube / B 站）、图片 EXIF GPS → 地图；动作按意图分组（查证 / 转换 / 导出 / 复制）+ 外链 ↗ 标记 + 超阈值折叠。
- **深度动作外链**：识别为媒体后可跳成熟开源、浏览器内本地处理的在线工具（Squoosh / VERT），标注「本地·不上传」。
- 分类器扩展：MAC / IPv6 / 文件路径，音视频深挖（EXIF / ID3 / 分辨率 / 时长）。
- `NOTICE` 文件：第三方署名与许可证声明（Apache-2.0 合规）。

### 修复 · Fixed
- **编解码逻辑审计**：修 7 处真 bug——元素周期表拼写与序号错位（Zn / 碘 I）、CaesarBox 非整除长度往返损坏、radixN 系列空 / 全零字节静默丢失、base69 尾零误剥、hex / binary 空输入抛异常等。
- **视图内存泄漏**（M1/M2/M3）：HexView 的 ResizeObserver、frostOverlay 挂在宿主上的事件监听器在重渲染时未释放；引入视图生命周期统一 destroy，覆盖复位 / 切候选 / 语言切换 / 吃新文件全路径。
- **BrainFuck / Ook! 功能回归**：实现俱全但从未接入注册表，补 import + 注册 + i18n。
- **punycode 死循环**：纯 base36 数字串越界导致整页卡死，加边界守卫。
- 中文短文本（诗词 / 对联）无标点时被误拆分。

### 安全 · Security
- **Pages 部署收口**：部署 workflow 从上传整仓（`path: .`）改为白名单组装 `_site`，从根上杜绝第三方 C 源码、构建源与内部文档意外发布到公开 Pages。

### 清理 · Removed
- 删除零引用死代码：zeroWidth 的 encode 侧、`getSupportedLangs` / `hasControlChars` / `looksLikeDeltaCode` / `runnableKind`。

---

## [1.0.0] - 2026-07-05

首个公开版本，核心识别与展示能力完备并上线 GitHub Pages。
First public release: core recognition and display capabilities, deployed to GitHub Pages.

### 新增 · Added
- 应用外壳、状态机（EMPTY → READING → READY）、FairyGlass 液态玻璃 UI + 着陆页能力看板。
- 30+ 分类器（瀑布流 + 多重解读）：身份信息 / 结构化数据 / 生活信息 / 文化 / 文件 / 媒体。
- 骨相 × 皮相分屏：OllyDbg 风格自适应 Hex 表格 + 类型化渲染视图。
- 敏感信息双层液态水纹遮罩（hover / 聚焦透出，移开恢复）。
- 「下一步你要…」JSON 动作引擎：外链查证 / 本地复制 / 文件下载 / 纯本地零依赖二维码。
- WASM 计算层：Hex Dump / PE 解析 / MD5 / SHA-1 / SHA-256。
- 多入口喂数据：Ctrl+V / clipboard.read() / paste 事件（移动端长按）/ 文件拖放。
- 完整 i18n（中 / 英），一键启动脚本（三平台），示例展示页。
- 部署上线 GitHub Pages（GitHub Actions 部署 + `.nojekyll`）。

[1.1.0]: https://github.com/Henglie/WhatsInYourClipboard/releases/tag/v1.1.0
[1.0.0]: https://github.com/Henglie/WhatsInYourClipboard/releases/tag/v1.0.0
