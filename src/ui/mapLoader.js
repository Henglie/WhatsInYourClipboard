/**
 * mapLoader.js — 按需加载 Leaflet + OpenStreetMap 渲染地图。
 *
 * 隐私铁律：地图瓦片来自 openstreetmap.org，加载即向其发起请求，
 * 因此必须由用户主动点击触发，绝不在识别时自动加载。
 * Leaflet 资源从 CDN 动态注入，仅首次加载。
 */

import { t } from "../i18n/i18n.js";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let _loading = null;

function injectOnce() {
  if (_loading) return _loading;
  _loading = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);

    const js = document.createElement("script");
    js.src = LEAFLET_JS;
    js.onload = () => (window.L ? resolve(window.L) : reject(new Error(t("mapLoader.leafletNotReady"))));
    js.onerror = () => reject(new Error(t("mapLoader.libLoadFailed")));
    document.head.appendChild(js);
  });
  return _loading;
}

/**
 * 在容器内渲染地图并标记坐标（WGS84）。
 * @param {HTMLElement} container
 * @param {number} lat
 * @param {number} lng
 * @param {string} [label]
 */
export async function renderMap(container, lat, lng, label = "") {
  container.textContent = t("mapLoader.loading");
  try {
    const L = await injectOnce();
    container.textContent = "";
    const map = L.map(container).setView([lat, lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    const marker = L.marker([lat, lng]).addTo(map);
    if (label) marker.bindPopup(label).openPopup();
    // 容器尺寸在动画后可能变化，强制重算
    setTimeout(() => map.invalidateSize(), 200);
    return map;
  } catch (e) {
    container.textContent = t("mapLoader.loadFailed", { message: e.message });
    return null;
  }
}
