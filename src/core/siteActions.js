/**
 * siteActions.js — URL 已知站点的上下文感知动态动作（第三层）。
 *
 * 输入一个 URL，识别出已知站点后返回一批「站点专属」动作 def（与 actions.json 同构）。
 * 这些 def 的 url/template 已是算好的最终串（不含 {{}}），labelKey 走 i18n。
 * 隐私铁律：仍是「点击才出去」——这里只构造按钮，不发任何请求。
 *
 * 站点品牌名（GitHub/npm/B 站…）是专有名词，写进 label 文案而非翻译；
 * 动作动词（查看/复制…）走 labelKey 中英镜像。
 */

/** 安全解析 URL，失败返回 null。 */
function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** 去掉路径首尾斜杠后按 / 切段。 */
function segments(pathname) {
  return pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

/**
 * 由 URL 推导站点专属动态动作。
 * @param {string} raw  已识别为 URL 的原始串
 * @returns {object[]}  动态动作 def 数组（无命中返回 []）
 */
export function siteActions(raw) {
  const u = parseUrl(raw);
  if (!u) return [];
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const seg = segments(u.pathname);

  // GitHub 仓库：github.com/owner/repo
  if (host === "github.com" && seg.length >= 2) {
    const owner = seg[0];
    const repo = seg[1].replace(/\.git$/, "");
    const base = `https://github.com/${owner}/${repo}`;
    // 排除非仓库路径（如 github.com/settings、/marketplace）
    const reserved = new Set(["settings", "marketplace", "sponsors", "topics", "explore", "notifications", "orgs"]);
    if (!reserved.has(owner)) {
      return [
        { type: "link", labelKey: "actionLabel.siteGithubIssues", url: `${base}/issues` },
        { type: "link", labelKey: "actionLabel.siteGithubReleases", url: `${base}/releases` },
        { type: "copy", labelKey: "actionLabel.siteGithubClone", template: `git clone ${base}.git` },
      ];
    }
  }

  // npm 包：npmjs.com/package/<name>（含 scoped @scope/name）
  if (host === "npmjs.com" && seg[0] === "package" && seg.length >= 2) {
    const name = seg.slice(1).join("/");
    return [
      { type: "copy", labelKey: "actionLabel.siteNpmInstall", template: `npm install ${name}` },
    ];
  }

  // YouTube 视频：youtube.com/watch?v=ID 或 youtu.be/ID
  let ytId = null;
  if ((host === "youtube.com" || host === "m.youtube.com") && u.searchParams.get("v")) {
    ytId = u.searchParams.get("v");
  } else if (host === "youtu.be" && seg.length >= 1) {
    ytId = seg[0];
  }
  if (ytId) {
    return [
      { type: "copy", labelKey: "actionLabel.siteYoutubeCopyId", template: ytId },
    ];
  }

  // Bilibili 视频：bilibili.com/video/BVxxxx
  if (host === "bilibili.com" && seg[0] === "video" && seg[1]) {
    const bv = seg[1];
    if (/^BV[0-9A-Za-z]+$/.test(bv)) {
      return [
        { type: "copy", labelKey: "actionLabel.siteBilibiliCopyBv", template: bv },
      ];
    }
  }

  return [];
}
