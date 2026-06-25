/**
 * data.js — 示例展示页的数据源。
 * 把「剪贴板里有什么？」能识别的每一类，各举一个真实可用的样例。
 *
 * 每个 sample：
 *   text     — 复制到真应用即可被识别的原始文本（带真实校验位的用真值）
 *   title    — 这类内容叫什么
 *   verdict  — 应用会怎么「认出」它（对应 cls.* 文案的直白版）
 *   fields   — 应用解析出的关键字段 [标签, 值]
 *   tag      — 右上角小标签（可选，标注特性）
 *   mono     — 样例文本是否等宽显示（编码/哈希类用 true）
 */

export const GROUPS = [
  {
    id: "identity",
    name: "身份信息",
    desc: "证件、号码、地址——结构高度特异，整串即一个标识符时深度拆解。隐私铁律：标识符本身打码，推导只基于结构。",
    samples: [
      {
        text: "110105199003071239",
        title: "身份证号",
        verdict: "是一个身份证号",
        fields: [
          ["归属地", "北京市·朝阳区"],
          ["生日", "1990-03-07"],
          ["性别", "男"],
          ["星座", "双鱼座"],
          ["生肖", "马"],
          ["校验位", "通过"],
        ],
        tag: "校验",
      },
      {
        text: "13800138000",
        title: "手机号",
        verdict: "是一个手机号",
        fields: [
          ["号码", "138****8000"],
          ["运营商", "中国移动"],
          ["号段", "138"],
        ],
      },
      {
        text: "6212261500000123453",
        title: "银行卡号",
        verdict: "是一张银行卡号",
        fields: [
          ["卡号", "**** **** **** 3453"],
          ["Luhn 校验", "通过"],
          ["发卡行", "中国工商银行"],
          ["卡种", "借记卡"],
        ],
        tag: "Luhn",
      },
      {
        text: "贵A·88888",
        title: "车牌号",
        verdict: "是一个车牌号",
        fields: [
          ["车牌", "贵A88888"],
          ["归属地", "贵州"],
          ["发牌机关", "贵阳"],
          ["类型", "普通汽车号牌"],
        ],
        tag: "宽容匹配",
      },
      {
        text: "192.168.1.1",
        title: "IPv4 地址",
        verdict: "是一个 IPv4 地址",
        fields: [
          ["地址", "192.168.1.1"],
          ["类型", "C 类私有地址"],
        ],
      },
      {
        text: "北京市海淀区中关村大街1号 张三 13800138000",
        title: "收货地址",
        verdict: "是一段收货地址",
        fields: [
          ["收件人", "张三"],
          ["电话", "138****8000"],
          ["省份", "北京"],
          ["详细地址", "海淀区中关村大街1号"],
        ],
      },
    ],
  },

  {
    id: "encoding",
    name: "编码与密码",
    desc: "能唯一识别的编码自动解码显示；模糊的（Base58/62/85 等）走「解码工具箱」按需尝试。共 36 种编解码 + 古典密码。",
    samples: [
      {
        text: "SGVsbG8sIOS4lueVjA==",
        title: "Base64",
        verdict: "是 Base64 编码的文本",
        fields: [["解码结果", "Hello, 世界"]],
        mono: true,
      },
      {
        text: "01001000 01101001",
        title: "二进制",
        verdict: "是二进制编码",
        fields: [["解码结果", "Hi"]],
        mono: true,
      },
      {
        text: ".... . .-.. .-.. ---",
        title: "摩斯电码",
        verdict: "是摩斯电码",
        fields: [["解码结果", "HELLO"]],
        mono: true,
      },
      {
        text: "JBSWY3DPEBLW64TMMQ======",
        title: "Base32",
        verdict: "可能是 Base32 编码",
        fields: [["解码结果", "Hello!!!"]],
        mono: true,
      },
      {
        text: "%E4%BD%A0%E5%A5%BD",
        title: "URL 编码",
        verdict: "是 URL 编码的文本",
        fields: [["解码结果", "你好"]],
        mono: true,
      },
      {
        text: "\\u4f60\\u597d\\u4e16\\u754c",
        title: "Unicode 转义",
        verdict: "含有 Unicode 转义序列",
        fields: [["解码结果", "你好世界"]],
        mono: true,
      },
      {
        text: "富强民主文明和谐",
        title: "社会主义核心价值观编码",
        verdict: "可用工具箱解码",
        fields: [["类别", "趣味编码"], ["说明", "确定性算法，可逆"]],
        tag: "趣味",
      },
    ],
  },

  {
    id: "token",
    name: "令牌与数值",
    desc: "格式高度特异的标识符与数值类型，识别后做结构化拆解或进制互转。",
    samples: [
      {
        text: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dumm-sig",
        title: "JWT 令牌",
        verdict: "是一个 JWT 令牌",
        fields: [
          ["类型", "JSON Web Token"],
          ["算法", "HS256"],
          ["载荷", "sub / name…"],
        ],
        mono: true,
      },
      {
        text: "550e8400-e29b-41d4-a716-446655440000",
        title: "UUID",
        verdict: "是一个 UUID（v4）",
        fields: [["版本", "v4"], ["类型", "UUID / GUID"]],
        mono: true,
      },
      {
        text: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        title: "加密货币地址",
        verdict: "是一个以太坊地址",
        fields: [["链", "Ethereum (ETH)"]],
        mono: true,
      },
      {
        text: "1700000000",
        title: "Unix 时间戳",
        verdict: "是一个 Unix 时间戳",
        fields: [
          ["精度", "秒"],
          ["UTC", "2023-11-14 22:13:20"],
        ],
      },
      {
        text: "#1E90FF",
        title: "颜色值",
        verdict: "是一个颜色值",
        fields: [
          ["HEX", "#1E90FF"],
          ["RGB", "rgb(30, 144, 255)"],
          ["HSL", "hsl(210, 100%, 56%)"],
        ],
        swatch: "#1E90FF",
      },
      {
        text: "0xFF",
        title: "进制数",
        verdict: "是一个进制数",
        fields: [
          ["十进制", "255"],
          ["八进制", "0o377"],
          ["二进制", "0b11111111"],
        ],
        mono: true,
      },
      {
        text: "5f4dcc3b5aa765d61d8327deb882cf99",
        title: "哈希值",
        verdict: "是一个 MD5 哈希值",
        fields: [["算法", "MD5"], ["长度", "32 hex"]],
        mono: true,
      },
    ],
  },

  {
    id: "struct",
    name: "结构化数据",
    desc: "代码、配置、表格——识别语言/类型并做高亮、美化、解释或安全提示。",
    samples: [
      {
        text: '{"name":"Kiro","version":"0.2","tags":["clipboard","wasm"]}',
        title: "JSON",
        verdict: "是一段 JSON 数据",
        fields: [["渲染", "美化 + 语法高亮"]],
        mono: true,
      },
      {
        text: "0 3 * * 1-5",
        title: "Cron 表达式",
        verdict: "是一个 Cron 定时表达式",
        fields: [["含义", "工作日每天 3:00 执行"]],
        mono: true,
      },
      {
        text: "SELECT * FROM users WHERE id = 1;",
        title: "SQL 语句",
        verdict: "是一段 SQL 语句",
        fields: [["渲染", "高亮 + 危险语句警示"]],
        mono: true,
      },
      {
        text: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        title: "User-Agent",
        verdict: "是一个 User-Agent",
        fields: [
          ["浏览器", "Chrome 120"],
          ["系统", "Windows 10"],
          ["引擎", "Blink"],
        ],
        mono: true,
      },
      {
        text: "name,age,city\n张三,28,北京\n李四,32,上海",
        title: "CSV 表格",
        verdict: "是表格数据（3 行）",
        fields: [["渲染", "转为表格"]],
        mono: true,
      },
      {
        text: "# 标题\n\n- 列表项\n- **加粗**\n\n> 引用",
        title: "Markdown",
        verdict: "是 Markdown 文档",
        fields: [["渲染", "安全 DOM 渲染"]],
        mono: true,
      },
      {
        text: "function add(a, b) {\n  return a + b;\n}",
        title: "代码",
        verdict: "是一段 JavaScript 代码",
        fields: [["语言", "JavaScript"], ["可运行", "沙箱断网运行"]],
        mono: true,
      },
    ],
  },

  {
    id: "life",
    name: "生活信息",
    desc: "日常高频复制的内容：坐标、算式、书号、快递单。坐标可一键地图（点击才联网）。",
    samples: [
      {
        text: "39.908823, 116.397470",
        title: "经纬度坐标",
        verdict: "是一组经纬度坐标",
        fields: [
          ["WGS84", "39.908823, 116.397470"],
          ["GCJ02", "火星坐标系互转"],
          ["BD09", "百度坐标系互转"],
        ],
        tag: "可看地图",
      },
      {
        text: "(12 + 8) * 3 - 5",
        title: "数学表达式",
        verdict: "是一个数学表达式",
        fields: [["结果", "55"]],
        mono: true,
      },
      {
        text: "9787115428028",
        title: "ISBN 书号",
        verdict: "是一个 ISBN 书号",
        fields: [["类型", "ISBN-13"], ["校验", "通过"]],
        tag: "校验",
        mono: true,
      },
      {
        text: "SF1234567890123",
        title: "快递单号",
        verdict: "可能是快递单号",
        fields: [["单号", "SF1234567890123"], ["可能承运", "顺丰速运"]],
        mono: true,
      },
      {
        text: "6901234567892",
        title: "商品条码",
        verdict: "是一个商品条码（EAN-13）",
        fields: [["类型", "EAN-13"], ["校验", "通过"], ["产地", "中国大陆"]],
        tag: "校验",
        mono: true,
      },
    ],
  },

  {
    id: "file",
    name: "文件与媒体",
    desc: "拖入文件即按特征码识别（复制文件进剪贴板只有路径，拖放才有真实字节）。图片、可执行、压缩包、证书…",
    samples: [
      {
        text: "（拖入一张 PNG/JPG 图片）",
        title: "图片",
        verdict: "是一张图片",
        fields: [["解析", "格式 / 尺寸 / 主色调"]],
        drop: true,
      },
      {
        text: "（拖入一个 .exe / .dll）",
        title: "可执行程序 (PE)",
        verdict: "是一个可执行程序（PE）",
        fields: [
          ["架构", "x86 / x64 / ARM64"],
          ["类型", "EXE / DLL"],
          ["节区数 / 编译时间", "解析头部"],
        ],
        drop: true,
        tag: "拖放",
      },
      {
        text: "（拖入一个 .zip）",
        title: "压缩包 (ZIP)",
        verdict: "是一个压缩包（ZIP）",
        fields: [["解析", "条目数 / 压缩率 / 文件树"]],
        drop: true,
      },
      {
        text: "（拖入一个 PDF）",
        title: "PDF 文档",
        verdict: "是一个 PDF 文档",
        fields: [["解析", "版本 / 页数 / 标题 / 作者"]],
        drop: true,
      },
      {
        text: "-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----",
        title: "PEM 证书 / 密钥",
        verdict: "是一个 X.509 证书",
        fields: [["类型", "X.509 证书"], ["编码", "PEM (Base64)"]],
        mono: true,
      },
      {
        text: "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><circle cx='40' cy='40' r='30' fill='#1E90FF'/></svg>",
        title: "SVG 矢量图",
        verdict: "是一张 SVG 矢量图",
        fields: [["渲染", "安全预览 + 源码"]],
        mono: true,
      },
    ],
  },

  {
    id: "culture",
    name: "文化与语言",
    desc: "古诗词结构化识别（判体裁、韵脚、词牌/诗人）、emoji、外语检测。内容查询遵守隐私铁律，仅给按钮。",
    samples: [
      {
        text: "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
        title: "古诗词",
        verdict: "像是五言绝句",
        fields: [
          ["体裁", "五言绝句"],
          ["疑似作者", "李白（唐）"],
          ["句数", "4 句"],
        ],
        tag: "智能识别",
      },
      {
        text: "水调歌头",
        title: "词牌名",
        verdict: "是词牌名「水调歌头」",
        fields: [["类别", "长调"], ["字数", "95 字"]],
      },
      {
        text: "🎉🎊✨",
        title: "Emoji 表情",
        verdict: "是 Emoji 表情",
        fields: [["数量", "3 个"], ["码点", "U+1F389…"]],
        big: "🎉🎊✨",
      },
      {
        text: "こんにちは、世界",
        title: "外语文本",
        verdict: "检测到外语：日语",
        fields: [["语言", "日语"], ["动作", "可一键翻译（点击才联网）"]],
      },
    ],
  },

  {
    id: "smart",
    name: "智能与垂直",
    desc: "多条内容自动分段逐项识别；游戏改枪码、商品分享码等垂直领域。像国产手机 OS 的智能剪贴板。",
    samples: [
      {
        text: "M7战斗步枪-全面战场-6H7LTPC08VDRT86E2T096",
        title: "三角洲改枪码",
        verdict: "是三角洲改枪码 · M7战斗步枪",
        fields: [
          ["游戏", "三角洲行动"],
          ["武器", "M7战斗步枪"],
          ["模式", "全面战场"],
        ],
        mono: true,
        tag: "垂直",
      },
      {
        text: "https://example.com/page?utm_source=clip",
        title: "网址",
        verdict: "是一段网址",
        fields: [["动作", "在浏览器打开 / 去参数复制"]],
        mono: true,
      },
      {
        text: "我的密码是 admin123，卡号 6212261500000123453",
        title: "敏感信息",
        verdict: "含有敏感信息（已打码保护）",
        fields: [
          ["银行卡号 ×1", { blur: "**** **** **** 3453" }],
          ["保护", "打码后再蒙一层磨砂玻璃，悬停/点击才透出"],
        ],
        tag: "隐私",
      },
      {
        text: "张三 13800138000\nhttps://example.com\n39.9, 116.4",
        title: "多条内容",
        verdict: "自动分段，逐条识别",
        fields: [["分段", "联系人 / 网址 / 坐标"]],
        mono: true,
        tag: "分段",
      },
    ],
  },
];
