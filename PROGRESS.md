# 交接文档 · WhatsInYourClipboard

> 最后更新：2026-06-21 | 给下一个 AI 的接续说明

---

## 项目定位

纯前端 + WASM 剪贴板透视工具。绝对隐私（零上传），液态玻璃 UI。作者 Henglie，MIT。
核心是"娱乐网页"——让用户惊喜地发现网页能认出剪贴板内容、正确显示、并给出"下一步"。

## 启动

```bash
cd C:\Users\Operater\Documents\我的项目源码\WhatsInYourClipboard
python -m http.server 8123
# 浏览器访问 http://localhost:8123
# 必须 Chrome/Edge（液态玻璃 SVG 滤镜仅 Chromium 完整支持）
# 不能 file:// 协议
```

- WASM 自检：`node wasm/selftest.mjs`（11 项全过）
- 编译 WASM：`bash wasm/build.sh`（emcc 路径 `~/emsdk/upstream/emscripten/emcc`，需 EXPORT_ES6=1）

## 架构速览

```
src/
├── main.js                  # 入口 + 状态机（EMPTY→READING→READY）
├── clipboard/reader.js      # 读剪贴板
├── core/
│   ├── ClassifierFactory.js # 分类器注册表（REGISTRY，按 priority 降序瀑布判定）
│   ├── classifiers/         # 40+ 分类器，继承 BaseClassifier，实现 match()/parse()
│   ├── codec.js             # CODECS 注册表（编解码器）
│   ├── ciphers.js           # CIPHERS 注册表（密码工具）
│   ├── cnCiphers.js         # 中式编码（当铺/天干地支/百家姓/元素周期表/ROT8000）
│   ├── classicalCiphers.js  # 古典密码（Polybius/Beaufort/Gronsfeld/Porta）
│   ├── classicalGrid.js     # 古典密码网格族（Bifid/Trifid/PlayFair/ADFGX/ADFGVX/Nihilist/TapCode/FourSquare/GrayCode）
│   ├── ctfCiphers.js        # CTF 编码（DNA/Braille/Cetacean）
│   ├── ctfExtra.js          # CTF 编码（莫尔斯/六十四卦/兽音/QWE/TwinHex/CaesarBox/FracMorse）
│   ├── segment.js           # 多内容智能分段
│   └── data/                # 静态数据 JSON（bank-bins/cipai/poets/region-codes 等）
├── i18n/
│   ├── i18n.js              # t() 翻译函数 + setLang() 语言切换
│   ├── zh.js                # 中文字典（基准语言）
│   └── en.js                # 英文字典
├── views/
│   ├── AppShell.js          # 顶栏（含 中/EN 语言切换钮）+ 状态栏
│   ├── ToolMenu.js          # 解码工具箱（手风琴折叠菜单，自动从注册表生成）
│   ├── SplitView.js         # 左右分栏：Hex 矩阵 + 渲染视图
│   ├── LandingView.js       # 着陆页 + 能力看板
│   └── capabilities.js      # 能力看板数据
├── ui/
│   ├── liquidGlass.js       # 液态玻璃效果
│   └── stepper.js           # 圆形加减 stepper
└── wasm/                    # C → WASM（hexdump/sha256/md5/sha1/magic/PE解析）
```

## 关键约定

- **git：在彻底"吃掉"ToolsFx 之前都不提交**（用户明确要求，不要再问）
- 不用彩色 emoji（保留 ● ✓ ← 等黑白几何符号）
- 中式/特殊编码算法必须查证源码或权威实现，不许编造
- 所有解码用权威向量或往返测试验证后才算完成
- 识别永远本地、零外发。联网功能只做"下一步"按钮，点击才出去

## 当前状态：已完成

### 编码工具箱（共 46 项，全部验证通过）
- CODECS 23 项：hex/binary/octal/decimal/base32/36/45/58/62/69/91/92/100/ascii85/base85std/z85/base85ipv6/QP/uu/xx/punycode/unescape/jsHex/coreValues/mixHexOctBin/hexReverse
- CIPHERS 40 项：ROT 系列(5/13/18/47/8000)/Atbash/Caesar/Vigenere/Affine/Beaufort/Gronsfeld/Porta/Polybius/Bacon/Railfence/A1Z26/Bifid/Trifid/PlayFair/ADFGX/ADFGVX/Nihilist/TapCode/FourSquare/GrayCode/当铺/天干地支/百家姓/元素周期表/DNA/Braille/Cetacean/Morse/六十四卦/兽音/QWE/TwinHex/CaesarBox/FracMorse
- 全部支持编码/解码方向（含 encode 的标 ⇄），参数化工具标 ⚙
- 工具箱菜单自动从注册表生成，按 cat 分类折叠（手风琴）

### 分类器（40+ 个）
身份(身份证/手机/银行卡/IP/车牌)、结构化(JSON/CSV/Markdown/SQL/Cron/UA)、生活(地址/坐标/数学/ISBN/快递)、文化(古诗词/词牌/外语/emoji)、垂直(条码/分享码/三角洲改枪码)、文件(PE/ZIP/PDF/ELF/PEM)、媒体(图片/SVG)

### WASM 计算层
hexdump/sha256/md5/sha1/magic/PE解析，selftest 11 项全过

### i18n 国际化（全部完成）
- subtitle/title/note/行标签/动作标签/错误信息/参数标签 全部接入 i18n
- 语言切换不跳回主页（main.js 保存 currentClipboardItem 重分类）
- 顶栏 中/EN 按钮切换语言
- 能力看板 + hashPanel 已国际化
- **已修复 4 个 ToolMenu.js Bug**（变量遮蔽 `t is not a function`、字典键缺失、CATEGORIES 静态化、结果标题翻译）
- **已修复 actions.json + ActionEngine.js**：所有动作按钮标签改为 `labelKey`，通过 `t()` 翻译
- **已修复 codec.js**：所有错误信息通过 `codecError.*` 分区 i18n
- **已修复 ciphers.js**：所有错误信息通过 `cipherError.*` 分区，参数标签通过 `cipherParam.*` 分区
- **已修复 bridge.js**：PE 架构名称通过 `cardRow.*` 分区 i18n
- **已修复所有分类器行标签**：identity.js / culture.js / vertical.js / lifeView.js / FileBase.js / MediaBase.js / structuredView.js / token.js / numeric.js 等
- **已修复 UI 组件**：stepper.js / lightbox.js / mapLoader.js 的按钮提示和 alt 文本
- **已修复 culture.js 变量遮蔽 Bug**：EmojiClassifier / ChineseTextClassifier / ForeignLangClassifier / CipaiClassifier 中 `const t` 遮蔽了 i18n 的 `t()` 函数，已重命名为 `text`
- **i18n 字典新增分区**：`cardRow`（行标签）、`capItem`（能力看板条目）、`cardTitle`（卡片标题）、`cardNote`（卡片注释）、`actionLabel`（动作按钮标签）、`action`（动作提示）、`codecError`（编解码错误）、`cipherError`（密码错误）、`cipherParam`（密码参数标签）

**注意**：领域特有中文内容（古诗词、词牌名、诗人名、分类名如"小令/中调/长调"、计数后缀如"字/句/个"、data/*.json 中的数据）**不国际化**，保留原中文。这是正确的设计——这些是中文文化内容本身，不是 UI 文案。

---

## 下一步任务

### P0：i18n 国际化收尾 ✅ 已完成
- 所有行标签、动作标签、错误信息、参数标签已全部国际化
- 领域中文内容（古诗/词牌/数据文件）保留原中文，不国际化

### P1：本地测试验证
- 启动服务器 `python -m http.server 8123`
- 测试语言切换：复制一段内容 → 识别 → 点 中/EN 切换 → 确认编解码工具仍可用
- 检查所有分类器渲染正常
- 确认英文翻译准确

### P2：隐私数据模糊显示（用户提出，未开始）
- 身份证/手机/银行卡等敏感数据的 hex 和解码结果做高斯模糊
- 点击解除模糊，鼠标离开恢复模糊
- 涉及 `classifiers/identity.js` + CSS 新增 `.blur-mask` 样式

### P3：解码工具箱智能嗅探（用户已讨论方向，未动手）
- 粘贴后后台跑所有可逆解码器，只浮出"能解出有意义结果"的
- 判定 = 可打印字符比例 + 有效 UTF-8 + 命中已知模式加权
- 加搜索框即时过滤

### P4：继续搬运 ToolsFx 编码（低优先级）
参考源码：`临时/ToolsFx/app/src/main/kotlin/me/leon/`

**还没搬的**：
- 古典密码：Hill/AutoKey/Manchester/Type7
- CTF 编码：BauDot/BrainFuck/Ook/BubbleBabble/EmojiSubstitution/Zero1248/零宽字符
- base 变体：base58check/base65536/base2048/ecoji/radix 系列/utf7/htmlEntityAll
- 重型加密（用户定：接审计过的 C 密码库编 WASM，不手抄）：AES/DES/3DES/SM4/RSA/SM2/ChaCha/RC4

---

## 参考：i18n 接入模式

**新增翻译**：在 `zh.js` 和 `en.js` 同步添加键值对，两文件结构必须镜像。

**分类器用法**：
```javascript
import { t } from "../../i18n/i18n.js";

async parse(item) {
  return {
    subtitle: t("cls.xxx"),           // 副标题
    render: (el) => {
      const rows = [
        [t("cardRow.xxx"), value],    // 行标签
      ];
      el.appendChild(buildInfoCard(rows, {
        title: t("cardTitle.xxx"),    // 卡片标题
        note: t("cardNote.xxx"),      // 卡片说明
      }));
    },
  };
}
```

**注册表新增工具**（自动出现在工具箱菜单）：
```javascript
// codec.js 或 ciphers.js
newTool: {
  label: "中文名",                     // 硬编码回退
  labelKey: "codec.newTool",          // i18n 键（优先）
  cat: "ctf",                         // 分类：base/radix/web/fun/classic/modern/ctf
  fn: decodeFn,                       // 解码函数
  encode: encodeFn,                   // 编码函数（可选，有则标 ⇄）
  params: [{ name: "key", label: "密钥", type: "text", default: "" }], // 可选，有则标 ⚙
}
```

**语言切换流程**：顶栏 中/EN 按钮 → `setLang()` → 广播 `i18n:change` → main.js 监听 → `renderShellRefresh()` + 重新分类当前内容。

---

## 参考：已 clone 的第三方源码

- `临时/ToolsFx/` — Kotlin 密码学工具箱（ISC License），编码搬运参考，用完可删
- `临时/CyberChef/` — GCHQ 网络瑞士军刀（Apache-2.0），算法零件库，按需取用