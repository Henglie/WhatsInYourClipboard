/**
 * i18n.js — 轻量国际化核心（零依赖）。
 *
 * 设计：
 *  - 支持语言：'zh'（中文）/ 'en'（英文）。
 *  - 默认语言：localStorage 记忆优先；否则跟随系统 navigator.language
 *    （zh* → zh，其它一律 en）。
 *  - t(key, vars?)：按当前语言查字典，缺失回退 zh，再缺失回显 key。
 *    支持 {name} 占位符插值。
 *  - 切换语言：setLang(lang) 写 localStorage 并广播 'i18n:change' 事件，
 *    监听者（main.js）收到后重渲染当前视图即可（无需框架级响应式）。
 *
 * 约定（重要，给后续接入者）：
 *  - 只翻译三类 UI 文案：界面框架、类型标签、注册表 label。
 *  - 「识别出的领域内容」（古诗词/运营商/银行/地名/中式编码字符等）保留中文，
 *    不进字典。详见 PROGRESS.md「国际化」章节。
 */
import { ZH } from "./zh.js";
import { EN } from "./en.js";

const DICTS = { zh: ZH, en: EN };
const STORAGE_KEY = "wiyc.lang";
const SUPPORTED = ["zh", "en"];

function detectSystemLang() {
  const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  return nav.startsWith("zh") ? "zh" : "en";
}

function loadInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch (_) {
    /* localStorage 不可用时静默回退 */
  }
  return detectSystemLang();
}

let currentLang = loadInitialLang();

/** 当前语言代码 'zh' | 'en' */
export function getLang() {
  return currentLang;
}

export function getSupportedLangs() {
  return [...SUPPORTED];
}

/**
 * 翻译。
 * @param {string} key   点分路径，如 "shell.brand"、"toolbox.title"
 * @param {object} [vars] 占位符插值，如 { count: 3 } 对应 "{count}"
 * @returns {string}
 */
export function t(key, vars) {
  const lookup = (dict) =>
    key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), dict);
  let val = lookup(DICTS[currentLang]);
  if (val === undefined) val = lookup(DICTS.zh); // 回退中文
  if (val === undefined) return key; // 再缺失回显 key（便于发现漏翻）
  if (vars && typeof val === "string") {
    val = val.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  }
  return val;
}

/** 切换语言：持久化 + 广播事件（main.js 监听后重渲染） */
export function setLang(lang) {
  if (!SUPPORTED.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {
    /* ignore */
  }
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  window.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang } }));
}

/** 在 <html lang> 上同步初始语言（main.js 启动时调一次） */
export function applyHtmlLang() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
}
