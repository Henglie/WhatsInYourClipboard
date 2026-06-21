/**
 * hashPanel.js — 文件哈希计算面板（点击本地计算 MD5/SHA-1/SHA-256）。
 * WASM 优先，未编译则用 Web Crypto（SHA 系列）；MD5 仅 WASM 可用。
 */
import { WasmBridge } from "../../wasm/bridge.js";
import { t } from "../../i18n/i18n.js";

/**
 * @param {HTMLElement} el  容器
 * @param {Uint8Array} bytes
 */
export function buildHashPanel(el, bytes) {
  const wrap = document.createElement("div");
  wrap.className = "hashpanel";

  const title = document.createElement("div");
  title.className = "infocard__title";
  title.textContent = t("hashPanel.title");
  wrap.appendChild(title);

  const grid = document.createElement("dl");
  grid.className = "infocard__grid";
  wrap.appendChild(grid);

  const addRow = (label, value) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    grid.append(dt, dd);
  };

  const btn = document.createElement("button");
  btn.className = "tool-chip";
  btn.textContent = t("hashPanel.calculate");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = t("hashPanel.calculating");
    await WasmBridge.ready();
    grid.innerHTML = "";
    try {
      const md5 = WasmBridge.md5(bytes);
      const sha1 = await WasmBridge.sha1(bytes);
      const sha256 = await WasmBridge.sha256(bytes);
      addRow("MD5", md5 || t("hashPanel.needWasm"));
      addRow("SHA-1", sha1);
      addRow("SHA-256", sha256);
    } catch (e) {
      addRow(t("hashPanel.error"), e.message);
    }
    btn.remove();
  });
  wrap.appendChild(btn);
  el.appendChild(wrap);
}
