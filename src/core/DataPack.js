/**
 * DataPack.js — 离线数据包懒加载器。
 *
 * 手机归属地号段、银行卡 BIN、行政区划码、古诗词、防伪码注册表等，
 * 都以 JSON 数据包形式存于 src/data/，首屏不加载，按需 fetch + 内存缓存。
 *
 * 用法：const map = await DataPack.load("phone-segments");
 */

const CACHE = new Map();
const INFLIGHT = new Map();

export const DataPack = {
  /**
   * 按名加载数据包（src/data/<name>.json），结果缓存。
   * @param {string} name
   * @returns {Promise<any>} 解析后的 JSON；加载失败返回 null
   */
  async load(name) {
    if (CACHE.has(name)) return CACHE.get(name);
    if (INFLIGHT.has(name)) return INFLIGHT.get(name);

    const p = (async () => {
      try {
        const res = await fetch(`src/data/${name}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        CACHE.set(name, data);
        return data;
      } catch (e) {
        console.warn(`[DataPack] 加载 ${name} 失败：`, e.message);
        CACHE.set(name, null); // 缓存失败结果，避免反复请求
        return null;
      } finally {
        INFLIGHT.delete(name);
      }
    })();

    INFLIGHT.set(name, p);
    return p;
  },

  /** 预加载（不阻塞，后台拉取） */
  prefetch(...names) {
    for (const n of names) this.load(n);
  },

  /** 同步取已缓存数据（未加载返回 null）。供分类器 match() 同步判定用。 */
  getCached(name) {
    return CACHE.has(name) ? CACHE.get(name) : null;
  },

  /** 是否已缓存 */
  has(name) {
    return CACHE.has(name) && CACHE.get(name) !== null;
  },
};
