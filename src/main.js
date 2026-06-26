/**
 * main.js — 应用入口与状态机。
 * 状态流转：EMPTY → READING → READY / ERROR → (reset) → EMPTY
 *
 * 编排链路：
 *   读剪贴板 → WasmBridge.detectMagic / hexdump
 *           → ClassifierFactory.classify → SplitView 渲染
 *           → ActionEngine 渲染「下一步你要…」
 */
import { readClipboard, itemsFromDataTransfer } from "./clipboard/reader.js";
import { WasmBridge } from "./wasm/bridge.js";
import { ClassifierFactory } from "./core/ClassifierFactory.js";
import { renderActions } from "./actions/ActionEngine.js";
import { renderShell } from "./views/AppShell.js";
import { renderLanding } from "./views/LandingView.js";
import { renderSplit } from "./views/SplitView.js";
import { renderMulti } from "./views/MultiView.js";
import { renderToolMenu } from "./views/ToolMenu.js";
import { hydrateGlass } from "./ui/liquidGlass.js";
import { DataPack } from "./core/DataPack.js";
import { segmentText } from "./core/segment.js";
import { t, applyHtmlLang } from "./i18n/i18n.js";

applyHtmlLang(); // 同步 <html lang> 到当前语言

// 古诗词识别需同步参与 match 判定，启动即预取词牌库与诗人库；分享码注册表同理
DataPack.prefetch("cipai", "poets", "share-codes", "delta-weapons");

const root = document.getElementById("app");

const STATE = { EMPTY: "EMPTY", READING: "READING", READY: "READY", ERROR: "ERROR" };
let current = STATE.EMPTY;
let landingHandle = null;
let currentClipboardItem = null; // 保存当前剪贴板项，用于语言切换后重新分类

// 外壳只渲染一次，内容进 stage
const shell = renderShell(root);
hydrateGlass(root); // 顶/底栏玻璃

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function showLanding() {
  current = STATE.EMPTY;
  landingHandle = renderLanding(shell.stage, { onTrigger: handleRead });
  shell.setStatus({ state: t("status.idle"), type: "—", size: "" });
  hydrateGlass(shell.stage);
}

/** 渲染某个候选解读到右侧 + 动作区。ctx 透传原始字节/类型/文件名，供 download 的 source:"bytes" 二进制另存。 */
async function showCandidate(view, result, rawText, ctx = {}) {
  view.setSubtitle(result.subtitle);
  view.renderTarget.innerHTML = "";
  view.actionsList.innerHTML = "";
  result.render(view.renderTarget);
  await renderActions(view.actionsList, result.actionKey, result.tplVars || {}, ctx);
  // 文本类内容：在「下一步你要…」动作区附解码工具箱二级菜单（厚玻璃+加粗，与普通动作区分）
  const actionsSection = view.actionsList.parentElement;
  actionsSection.querySelectorAll(".toolbox").forEach((n) => n.remove());
  const raw = rawText ?? result.tplVars?.raw ?? result.tplVars?.text;
  if (raw && typeof raw === "string") {
    renderToolMenu(actionsSection, raw);
  }
  hydrateGlass(view.renderTarget);
}

async function handleRead() {
  if (current === STATE.READING) return;
  current = STATE.READING;
  shell.setStatus({ state: t("status.reading") });

  try {
    await WasmBridge.ready();
    const items = await readClipboard();

    if (!items.length) {
      landingHandle?.setHint(t("landing.hintEmpty"));
      shell.setStatus({ state: t("status.idle") });
      current = STATE.EMPTY;
      return;
    }

    const item = items[0]; // 取首项
    currentClipboardItem = item; // 保存当前项，用于语言切换

    await handleReadWithItem(item);
  } catch (err) {
    console.error(err);
    current = STATE.EMPTY;
    shell.setStatus({ state: t("status.needAuth") });
    // 权限或不支持：平滑改文案，引导快捷键
    landingHandle?.setButtonText(t("landing.btnNeedPerm"));
    landingHandle?.setHint(t("landing.hintNeedPerm"));
  }
}

/**
 * 接收已构造好的 ClipItem[]（来自 paste 事件或文件拖放），走与 handleRead
 * 相同的后续链路。这是 read()/readText() 之外的进路：
 *  - 移动端无 Ctrl+V、clipboard.read() 多半缺失，靠长按粘贴触发的 paste 事件。
 *  - 桌面拖入 .exe/图片等文件才有真实字节（复制文件进剪贴板只有路径）。
 */
async function ingestItems(items) {
  if (current === STATE.READING) return;
  if (!items || !items.length) return;
  current = STATE.READING;
  shell.setStatus({ state: t("status.reading") });
  try {
    await WasmBridge.ready();
    const item = items[0];
    currentClipboardItem = item;
    await handleReadWithItem(item);
  } catch (err) {
    console.error(err);
    current = STATE.EMPTY;
    shell.setStatus({ state: t("status.idle") });
  }
}

/** 处理已读取的剪贴板项（语言切换时复用） */
async function handleReadWithItem(item) {
  try {
    // 文本：先判断是否为多条独立内容
    if (item.isText) {
      const seg = segmentText(item.text);
      if (seg.multi && seg.segments.length >= 2) {
        await renderMulti(shell.stage, {
          segments: seg.segments,
          reason: seg.reason,
          onReset: showLanding,
        });
        hydrateGlass(shell.stage);
        shell.setStatus({
          state: t("status.multi"),
          type: t("status.items", { count: seg.segments.length }),
          size: fmtSize(item.size),
        });
        current = STATE.READY;
        return;
      }
    }

    const candidates = await ClassifierFactory.classifyAll(item);

    if (!candidates.length) {
      landingHandle?.setHint(t("landing.hintUnknown"));
      shell.setStatus({ state: t("status.idle") });
      current = STATE.EMPTY;
      return;
    }

    const ctx = { bytes: item.bytes, mime: item.mime, fileName: item.meta?.fileName };

    const view = renderSplit(shell.stage, {
      subtitle: candidates[0].result.subtitle,
      bytes: item.bytes,
      candidates,
      sensitive: !!candidates[0].result.sensitive,
      onSwitch: (i) => {
        view.setHexMask(!!candidates[i].result.sensitive);
        showCandidate(view, candidates[i].result, item.isText ? item.text : null, ctx);
      },
      onReset: showLanding,
    });

    await showCandidate(view, candidates[0].result, item.isText ? item.text : null, ctx);
    hydrateGlass(shell.stage);
    shell.setStatus({
      state: candidates.length > 1
        ? t("status.recognizedN", { count: candidates.length })
        : t("status.recognized"),
      type: candidates[0].result.subtitle,
      size: fmtSize(item.size),
    });
    current = STATE.READY;
  } catch (err) {
    console.error(err);
    current = STATE.EMPTY;
    shell.setStatus({ state: t("status.needAuth") });
    landingHandle?.setButtonText(t("landing.btnNeedPerm"));
    landingHandle?.setHint(t("landing.hintNeedPerm"));
  }
}

// 全局 Ctrl+V 触发
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
    if (current === STATE.EMPTY) {
      e.preventDefault();
      handleRead();
    }
  }
});

// paste 事件：移动端「长按粘贴」与桌面 Ctrl+V 的通用进路。
// clipboard.read() 在移动端/部分浏览器缺失或需权限，而 paste 事件的
// clipboardData 几乎全平台可用、且无需读权限。监听 document 以捕获任意焦点下的粘贴。
document.addEventListener("paste", (e) => {
  if (current !== STATE.EMPTY) return;
  const dt = e.clipboardData;
  if (!dt) return;
  e.preventDefault();
  itemsFromDataTransfer(dt).then(ingestItems);
});

// 文件拖放：复制文件进系统剪贴板时只有路径而非内容，clipboard.read()
// 永远拿不到 .exe/图片等的字节；拖放是获取真实二进制字节的唯一可靠进路。
// 页面任意处可拖放（隐形入口，不改着陆页外观）。
window.addEventListener("dragover", (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
    e.preventDefault(); // 允许 drop
  }
});
window.addEventListener("drop", (e) => {
  if (!e.dataTransfer) return;
  const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
  if (!hasFiles) return;
  e.preventDefault();
  if (current !== STATE.EMPTY) showLanding(); // 已在结果页时先复位，再吃新文件
  itemsFromDataTransfer(e.dataTransfer).then(ingestItems);
});

// 语言切换：重建外壳与当前视图（外壳含语言钮，必须重建）。
// 如果当前已识别内容，保持在结果页；否则显示着陆页。
window.addEventListener("i18n:change", () => {
  renderShellRefresh();
  if (current === STATE.READY && currentClipboardItem) {
    // 保持在结果页，重新分类当前内容
    handleReadWithItem(currentClipboardItem);
  } else {
    showLanding();
  }
});

// 重新渲染外壳（语言变更后顶栏/状态栏文案需更新）
function renderShellRefresh() {
  const fresh = renderShell(root);
  shell.stage = fresh.stage;
  shell.setStatus = fresh.setStatus;
  hydrateGlass(root);
}

showLanding();
