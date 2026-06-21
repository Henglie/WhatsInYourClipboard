/**
 * codeRunner.js — 浏览器可运行代码的本地沙箱执行器。
 *
 * 隐私铁律：全部在本地 <iframe sandbox> 内运行，CSP 切断所有网络
 * （default-src 'none'），用户代码即便想 fetch/beacon 也出不去。
 * 父页面只通过 postMessage 收回 console 输出与错误，不读 iframe DOM。
 *
 * 支持三种：
 *   js   — 跑脚本，捕获 console.log/info/warn/error + 未捕获异常 + 最后表达式值
 *   html — 直接当网页渲染（含其内联脚本），可视的「运行原貌」
 *   css  — 套一段示例 DOM 预览样式效果
 */
import { t } from "../../i18n/i18n.js";

let _seq = 0;

/** JS 运行：控制台捕获沙箱。父子用一次性 token 配对消息。 */
function buildJsSrcdoc(code, token) {
  // 注意：CSP 用 'unsafe-inline' 允许我们注入的引导脚本与用户脚本执行，
  // 但 default-src 'none' + connect-src 'none' 断绝一切网络出口。
  return `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:;">
<meta charset="utf-8"></head><body>
<script>
(function(){
  var TOKEN=${JSON.stringify(token)};
  var logs=[];
  function ser(v){
    try{
      if(typeof v==='string')return v;
      if(v instanceof Error)return v.name+': '+v.message;
      if(typeof v==='function')return v.toString();
      if(typeof v==='undefined')return 'undefined';
      return JSON.stringify(v,function(k,val){return typeof val==='bigint'?String(val)+'n':val;},2);
    }catch(e){ try{return String(v);}catch(_){return '[unserializable]';} }
  }
  function push(level,args){ logs.push({level:level,text:Array.prototype.map.call(args,ser).join(' ')}); }
  ['log','info','warn','error','debug'].forEach(function(m){
    var orig=console[m];
    console[m]=function(){ push(m==='debug'?'log':m,arguments); try{orig.apply(console,arguments);}catch(e){} };
  });
  function done(err,ret){
    if(typeof ret!=='undefined') push('result', [ret]);
    parent.postMessage({token:TOKEN,logs:logs,error:err?(err.name+': '+err.message):null},'*');
  }
  window.onerror=function(msg,src,line,col,error){ done(error||{name:'Error',message:String(msg)}); return true; };
  try{
    var __ret=(function(){ "use strict";
      return eval(${JSON.stringify(code)});
    })();
    done(null,__ret);
  }catch(e){ done(e); }
})();
<\/script></body></html>`;
}

/** HTML 运行：原样渲染用户文档，仍套断网 CSP（允许内联脚本/样式/data 图）。 */
export function buildHtmlSrcdoc(html) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src data: blob:;">`;
  // 已有 <head> 则把 CSP 插进去；否则包一层最小文档
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${csp}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${csp}</head>`);
  }
  return `<!doctype html><html><head>${csp}<meta charset="utf-8"></head><body>${html}</body></html>`;
}

/** CSS 运行：套一段中性示例 DOM，让用户看到样式落到元素上的样子。 */
function buildCssSrcdoc(css) {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">`;
  return `<!doctype html><html><head>${csp}<meta charset="utf-8"><style>
  body{font-family:system-ui,sans-serif;color:#e6edf3;background:transparent;margin:12px;}
  ${css}
  </style></head><body>
  <h1>Heading 标题</h1>
  <p>Paragraph 段落文本 with a <a href="#">link 链接</a> and <button>button 按钮</button>.</p>
  <ul><li>List item 一</li><li>List item 二</li></ul>
  <div class="box">.box</div>
  <input placeholder="input"/>
  </body></html>`;
}

/**
 * 在容器内渲染「运行」按钮 + 结果区。点击后才创建 iframe 执行。
 * @param {HTMLElement} container 挂载点（通常是右侧渲染区下方）
 * @param {string} code 源码
 * @param {"js"|"html"|"css"} kind 运行类型
 */
export function renderRunner(container, code, kind) {
  const wrap = document.createElement("div");
  wrap.className = "runner";

  const bar = document.createElement("div");
  bar.className = "runner__bar";
  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "action-chip runner__run";
  runBtn.setAttribute("data-glass", "chip");
  runBtn.textContent = t("runner.run");
  const hint = document.createElement("span");
  hint.className = "runner__hint";
  hint.textContent = t("runner.sandboxHint");
  bar.append(runBtn, hint);

  const out = document.createElement("div");
  out.className = "runner__out";
  out.style.display = "none";

  wrap.append(bar, out);
  container.appendChild(wrap);

  let frame = null;
  let msgHandler = null;

  const cleanup = () => {
    if (msgHandler) { window.removeEventListener("message", msgHandler); msgHandler = null; }
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    frame = null;
  };

  const run = () => {
    cleanup();
    out.style.display = "block";
    out.innerHTML = "";
    runBtn.textContent = t("runner.rerun");

    if (kind === "js") {
      const token = "rnr_" + Date.now() + "_" + ++_seq;
      const console = document.createElement("div");
      console.className = "runner__console";
      const pending = document.createElement("div");
      pending.className = "runner__pending";
      pending.textContent = t("runner.running");
      console.appendChild(pending);
      out.appendChild(console);

      frame = document.createElement("iframe");
      frame.className = "runner__frame runner__frame--hidden";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("title", "js-sandbox");

      let settled = false;
      const finish = (data) => {
        if (settled) return;
        settled = true;
        console.innerHTML = "";
        const rows = data.logs || [];
        if (!rows.length && !data.error) {
          const empty = document.createElement("div");
          empty.className = "runner__line runner__line--muted";
          empty.textContent = t("runner.noOutput");
          console.appendChild(empty);
        }
        for (const r of rows) {
          const line = document.createElement("div");
          line.className = "runner__line runner__line--" + r.level;
          if (r.level === "result") {
            const tag = document.createElement("span");
            tag.className = "runner__tag";
            tag.textContent = "→";
            line.appendChild(tag);
          }
          line.appendChild(document.createTextNode(r.text));
          console.appendChild(line);
        }
        if (data.error) {
          const errLine = document.createElement("div");
          errLine.className = "runner__line runner__line--error";
          errLine.textContent = data.error;
          console.appendChild(errLine);
        }
      };

      msgHandler = (e) => {
        if (!e.data || e.data.token !== token) return;
        finish(e.data);
      };
      window.addEventListener("message", msgHandler);

      // 兜底：超时（死循环等）给提示，不卡死
      const timer = setTimeout(() => {
        finish({ logs: [], error: t("runner.timeout") });
        cleanup();
      }, 5000);
      const clearOnSettle = () => clearTimeout(timer);
      frame.addEventListener("load", clearOnSettle);

      frame.srcdoc = buildJsSrcdoc(code, token);
      out.appendChild(frame);
    } else {
      // html / css：可视渲染
      frame = document.createElement("iframe");
      frame.className = "runner__frame";
      frame.setAttribute("sandbox", kind === "html" ? "allow-scripts" : "");
      frame.setAttribute("title", kind + "-preview");
      frame.srcdoc = kind === "html" ? buildHtmlSrcdoc(code) : buildCssSrcdoc(code);
      out.appendChild(frame);
    }
  };

  runBtn.addEventListener("click", run);
  return { el: wrap, destroy: cleanup };
}
