/**
 * codeLang.js — 编程/标记语言识别（纯本地，特征加权打分）。
 *
 * 思路：不做完整词法分析（太重），而是为每种语言列一组「特征证据」
 * （独占关键字、典型语法、标志性符号），各自带权重；逐条命中累加，
 * 取分最高者。设最低门槛，分太低判为「未知语言」交给上层兜底。
 *
 * 只回答「是什么语言」，不执行、不外发。可运行性由 isRunnable() 单独判定。
 */

/**
 * 每种语言一个评估器：{ id, label, runnable, score(text) → number }
 * score 返回该语言的证据总分。命中越多越独占，分越高。
 */
const LANGS = [
  {
    id: "html", label: "HTML", runnable: "html",
    score: (t) => {
      let s = 0;
      if (/<!doctype\s+html/i.test(t)) s += 5;
      if (/<html[\s>]/i.test(t)) s += 3;
      if (/<\/(?:div|span|p|body|head|table|ul|li|a|h[1-6])>/i.test(t)) s += 3;
      if (/<(?:div|span|p|img|br|input|button)\b[^>]*>/i.test(t)) s += 2;
      if (/<[a-z][\w-]*(?:\s+[\w-]+(?:=("[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/i.test(t)) s += 1;
      if (/&(?:nbsp|amp|lt|gt|quot|#\d+);/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "xml", label: "XML", runnable: null,
    score: (t) => {
      let s = 0;
      if (/<\?xml[\s\S]*?\?>/i.test(t)) s += 5;
      if (/xmlns(?::\w+)?\s*=/.test(t)) s += 3;
      if (/<\w+:\w+[\s>/]/.test(t)) s += 2; // 命名空间标签 <ns:tag>
      // 闭合标签结构但不像 HTML 常见标签
      if (/<([a-zA-Z][\w.-]*)[^>]*>[\s\S]*?<\/\1>/.test(t) && !/<\/(?:div|span|body|html|p)>/i.test(t)) s += 2;
      return s;
    },
  },
  {
    id: "css", label: "CSS", runnable: "css",
    score: (t) => {
      let s = 0;
      const rules = t.match(/[.#]?[\w-]+(?:\s*[,>+~]\s*[\w.#:-]+)*\s*\{[^{}]*\}/g);
      if (rules && rules.length >= 1) s += 3;
      if (rules && rules.length >= 3) s += 2;
      if (/[\w-]+\s*:\s*[^;{}]+;/.test(t)) s += 2; // 属性: 值;
      if (/@(?:media|import|keyframes|font-face|supports)\b/.test(t)) s += 3;
      if (/:\s*(?:#[0-9a-f]{3,8}|\d+px|\d+rem|\d+%|rgba?\()/i.test(t)) s += 1;
      // 排除：含明显 JS/HTML 特征时降权
      if (/<[a-z]+[\s>]/i.test(t) || /\bfunction\b|=>/.test(t)) s -= 3;
      return s;
    },
  },
  {
    id: "json", label: "JSON", runnable: null,
    score: (t) => {
      const tr = t.trim();
      if (!(tr.startsWith("{") || tr.startsWith("["))) return 0;
      try { JSON.parse(tr); return 8; } catch { return 0; }
    },
  },
  {
    id: "python", label: "Python", runnable: null,
    score: (t) => {
      let s = 0;
      if (/^\s*def\s+\w+\s*\([^)]*\)\s*(?:->\s*[\w\[\], ]+)?\s*:/m.test(t)) s += 4;
      if (/^\s*(?:from\s+[\w.]+\s+)?import\s+\w/m.test(t)) s += 3;
      if (/^\s*class\s+\w+\s*(?:\([^)]*\))?\s*:/m.test(t)) s += 2;
      if (/\bprint\s*\(/.test(t)) s += 1;
      if (/\b(?:elif|self|None|True|False|lambda|__\w+__)\b/.test(t)) s += 2;
      if (/^\s*(?:if|for|while|with|try|except|else)\b[^;{}]*:\s*$/m.test(t)) s += 2;
      if (/f["'][^"']*\{[^}]*\}/.test(t)) s += 1; // f-string
      if (/[{};]\s*$/m.test(t)) s -= 1; // 行尾分号/花括号偏 C 系
      return s;
    },
  },
  {
    id: "typescript", label: "TypeScript", runnable: null,
    score: (t) => {
      let s = 0;
      if (/\binterface\s+\w+\s*\{/.test(t)) s += 4;
      if (/\btype\s+\w+\s*=/.test(t)) s += 3;
      if (/:\s*(?:string|number|boolean|any|void|unknown|never)\b/.test(t)) s += 3;
      if (/\benum\s+\w+\s*\{/.test(t)) s += 2;
      if (/\b(?:public|private|readonly|implements)\b/.test(t) && /=>|function/.test(t)) s += 2;
      if (/\bas\s+(?:const|\w+)/.test(t)) s += 1;
      if (/<[A-Z]\w*>/.test(t)) s += 1; // 泛型
      return s;
    },
  },
  {
    id: "javascript", label: "JavaScript", runnable: "js",
    score: (t) => {
      let s = 0;
      if (/\b(?:const|let|var)\s+\w+\s*=/.test(t)) s += 2;
      if (/\bfunction\s*\*?\s*\w*\s*\(/.test(t)) s += 2;
      if (/=>\s*[{(]?/.test(t)) s += 2;
      if (/\b(?:console\.(?:log|error|warn)|document\.|window\.|require\(|module\.exports)/.test(t)) s += 2;
      if (/\b(?:async|await|Promise|=>)\b/.test(t)) s += 1;
      if (/`(?:[^`\\]|\\.)*\$\{[^}]*\}/.test(t)) s += 1; // 模板字符串
      if (/\bexport\s+(?:default\s+|const\s+|function\b)/.test(t)) s += 1;
      // TS 专属特征出现则不抢（让 TS 赢）
      if (/\binterface\s+\w+\s*\{|:\s*(?:string|number|boolean)\b/.test(t)) s -= 2;
      return s;
    },
  },
  {
    id: "java", label: "Java", runnable: null,
    score: (t) => {
      let s = 0;
      if (/\b(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+\w/.test(t)) s += 4;
      if (/\bpublic\s+static\s+void\s+main\s*\(/.test(t)) s += 4;
      if (/\bSystem\.out\.print/.test(t)) s += 3;
      if (/\bimport\s+(?:java|javax|org)\./.test(t)) s += 3;
      if (/\b(?:String|Integer|List|Map|ArrayList|HashMap)\b/.test(t)) s += 1;
      if (/@(?:Override|Test|Autowired|Component|Service)\b/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "csharp", label: "C#", runnable: null,
    score: (t) => {
      let s = 0;
      if (/\busing\s+(?:System|System\.\w+)\s*;/.test(t)) s += 4;
      if (/\bnamespace\s+[\w.]+/.test(t)) s += 3;
      if (/\b(?:public|private|protected|internal)\s+(?:static\s+)?(?:class|struct|interface|record)\s+\w/.test(t)) s += 2;
      if (/\bConsole\.(?:Write|WriteLine)\s*\(/.test(t)) s += 3;
      if (/\bvar\s+\w+\s*=/.test(t) && /;\s*$/m.test(t)) s += 1;
      if (/\bstring\[\]\s+args/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "cpp", label: "C++", runnable: null,
    score: (t) => {
      let s = 0;
      if (/#include\s*<(?:iostream|vector|string|map|algorithm)>/.test(t)) s += 4;
      if (/\bstd::\w+/.test(t)) s += 4;
      if (/\b(?:cout|cin|endl)\b/.test(t)) s += 3;
      if (/\busing\s+namespace\s+std\s*;/.test(t)) s += 3;
      if (/\btemplate\s*<[^>]*>/.test(t)) s += 2;
      if (/<<|>>/.test(t) && /cout|cin/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "c", label: "C", runnable: null,
    score: (t) => {
      let s = 0;
      if (/#include\s*<(?:stdio|stdlib|string|unistd)\.h>/.test(t)) s += 4;
      if (/\bint\s+main\s*\([^)]*\)\s*\{/.test(t)) s += 3;
      if (/\bprintf\s*\(/.test(t)) s += 2;
      if (/\b(?:malloc|free|sizeof|struct|typedef)\b/.test(t)) s += 1;
      // C++ 专属出现则让位
      if (/\bstd::|\bcout\b|using\s+namespace/.test(t)) s -= 4;
      return s;
    },
  },
  {
    id: "go", label: "Go", runnable: null,
    score: (t) => {
      let s = 0;
      if (/\bpackage\s+\w+/.test(t) && /\bfunc\b/.test(t)) s += 4;
      if (/\bfunc\s+(?:\(\w+\s+[\w*]+\)\s+)?\w+\s*\(/.test(t)) s += 3;
      if (/\bimport\s+(?:\(\s*[\s\S]*?\)|"[^"]+")/.test(t)) s += 2;
      if (/\bfmt\.(?:Print|Sprint)/.test(t)) s += 3;
      if (/:=/.test(t)) s += 2;
      if (/\bchan\b|\bgo\s+\w+\(|\bdefer\b/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "rust", label: "Rust", runnable: null,
    score: (t) => {
      let s = 0;
      if (/\bfn\s+\w+\s*(?:<[^>]*>)?\s*\(/.test(t)) s += 3;
      if (/\blet\s+(?:mut\s+)?\w+/.test(t)) s += 2;
      if (/\b(?:println!|print!|vec!|format!)\s*[\[(]/.test(t)) s += 3;
      if (/\b(?:impl|trait|pub\s+fn|use\s+std::)\b/.test(t)) s += 3;
      if (/->\s*\w+(?:<[^>]*>)?\s*\{/.test(t)) s += 1;
      if (/&(?:mut\s+)?self\b/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "php", label: "PHP", runnable: null,
    score: (t) => {
      let s = 0;
      if (/<\?php/.test(t)) s += 5;
      if (/\$\w+\s*=/.test(t)) s += 2;
      if (/\b(?:echo|print_r|var_dump)\b/.test(t)) s += 2;
      if (/->\w+\(|::\w+/.test(t)) s += 1;
      if (/\bfunction\s+\w+\s*\([^)]*\)\s*\{/.test(t) && /\$/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "ruby", label: "Ruby", runnable: null,
    score: (t) => {
      let s = 0;
      if (/\bdef\s+\w+[?!]?\s*(?:\([^)]*\))?\s*$/m.test(t)) s += 3;
      if (/\bend\s*$/m.test(t)) s += 2;
      if (/\b(?:puts|require|attr_accessor|attr_reader)\b/.test(t)) s += 3;
      if (/\bdo\s*\|[^|]*\|/.test(t)) s += 2;
      if (/:\w+\s*=>/.test(t) || /\b\w+:\s/.test(t)) s += 1;
      if (/@\w+/.test(t)) s += 1;
      return s;
    },
  },
  {
    id: "shell", label: "Shell / Bash", runnable: null,
    score: (t) => {
      let s = 0;
      if (/^#!\s*\/(?:usr\/)?bin\/(?:ba|z|)sh/m.test(t)) s += 5;
      if (/\b(?:echo|cd|ls|grep|sed|awk|cat|export|chmod|sudo|mkdir|rm)\b/.test(t)) s += 1;
      if (/\$\{?\w+\}?/.test(t)) s += 1;
      if (/\bif\b[\s\S]*?\bthen\b[\s\S]*?\bfi\b/.test(t)) s += 2;
      if (/\bfor\b[\s\S]*?\bdo\b[\s\S]*?\bdone\b/.test(t)) s += 2;
      if (/\|\s*(?:grep|awk|sed|sort|head|tail|wc)\b/.test(t)) s += 2;
      return s;
    },
  },
  {
    id: "sql", label: "SQL", runnable: null,
    score: (t) => {
      let s = 0;
      if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b/i.test(t.trim())) s += 3;
      if (/\b(?:FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|VALUES|INTO|SET)\b/i.test(t)) s += 2;
      return s;
    },
  },
  {
    id: "yaml", label: "YAML", runnable: null,
    score: (t) => {
      let s = 0;
      if (/^---\s*$/m.test(t)) s += 2;
      const kv = t.match(/^[ \t]*[\w-]+:\s*(?:.+)?$/gm);
      if (kv && kv.length >= 3) s += 3;
      if (/^[ \t]*-\s+\w/m.test(t)) s += 1;
      if (/[{};]/.test(t)) s -= 2;
      return s;
    },
  },
];

/**
 * 识别语言。返回 { id, label, runnable, score, candidates }，
 * 无明显语言时返回 null（交由上层「纯文本」兜底）。
 * @param {string} text
 * @param {number} [minScore=4] 判定门槛
 */
export function detectCodeLang(text, minScore = 4) {
  if (!text || text.length < 3) return null;
  const sample = text.slice(0, 20000); // 长文本只看前段
  const scored = LANGS
    .map((l) => ({ id: l.id, label: l.label, runnable: l.runnable, score: l.score(sample) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score < minScore) return null;
  const top = scored[0];
  return { ...top, candidates: scored.slice(0, 3) };
}

