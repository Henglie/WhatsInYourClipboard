/**
 * demoData.js — 主界面「随机样例」按钮的数据池。
 *
 * 每条是一段「复制进来就能被识别」的真实文本（带正确校验位的用真值）。
 * 只放纯文本类（图片/PE 等二进制样例走拖放，不在此列）。
 * 展示更完整的分类样例见 examples/data.js（能识别什么 · 示例页）。
 *
 * 用途：① 主界面随机按钮随机取一条复制并识别；② 也是 #try= 直达链路的素材。
 */
export const DEMO_SAMPLES = [
  { label: "身份证号", text: "110105199003071239" },
  { label: "手机号", text: "13800138000" },
  { label: "银行卡号", text: "6212261500000123453" },
  { label: "车牌号", text: "贵A·88888" },
  { label: "IPv4 地址", text: "192.168.1.1" },
  { label: "Base64", text: "SGVsbG8sIOS4lueVjA==" },
  { label: "摩斯电码", text: ".... . .-.. .-.. ---" },
  { label: "社会主义核心价值观编码", text: "富强民主文明和谐" },
  { label: "JWT 令牌", text: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dumm-sig" },
  { label: "UUID", text: "550e8400-e29b-41d4-a716-446655440000" },
  { label: "以太坊地址", text: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  { label: "Unix 时间戳", text: "1700000000" },
  { label: "颜色值", text: "#1E90FF" },
  { label: "JSON", text: '{"name":"Kiro","version":"0.2","tags":["clipboard","wasm"]}' },
  { label: "Cron 表达式", text: "0 3 * * 1-5" },
  { label: "经纬度坐标", text: "39.908823, 116.397470" },
  { label: "数学表达式", text: "(12 + 8) * 3 - 5" },
  { label: "ISBN 书号", text: "9787115428028" },
  { label: "商品条码", text: "6901234567892" },
  { label: "古诗词", text: "床前明月光，疑是地上霜。举头望明月，低头思故乡。" },
  { label: "三角洲改枪码", text: "M7战斗步枪-全面战场-6H7LTPC08VDRT86E2T096" },
  { label: "网址", text: "https://github.com/Henglie/FairyGlass" },
];

/** 随机取一条，避免与 exclude 相同（连点不重复）。 */
export function pickRandomSample(exclude) {
  if (DEMO_SAMPLES.length <= 1) return DEMO_SAMPLES[0];
  let s;
  do {
    s = DEMO_SAMPLES[Math.floor(Math.random() * DEMO_SAMPLES.length)];
  } while (s.text === exclude);
  return s;
}
