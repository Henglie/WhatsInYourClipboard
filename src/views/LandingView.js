/**
 * LandingView — 着陆页（空态）。
 * 大标题 + 三行文案浮雕按钮 + 下方能力清单看板（需下拉可见）。
 */
import { SUPPORTED, PLANNED } from "./capabilities.js";
import { t } from "../i18n/i18n.js";

function buildBoard() {
  const board = document.createElement("section");
  board.className = "capboard";

  const scrollHint = document.createElement("div");
  scrollHint.className = "capboard__scrollhint";
  scrollHint.textContent = t("landing.scrollHint");
  board.appendChild(scrollHint);

  const makeColumn = (title, groups, planned) => {
    const col = document.createElement("div");
    col.className = "capboard__col" + (planned ? " is-planned" : "");

    const h = document.createElement("h2");
    h.className = "capboard__coltitle";
    h.textContent = title;
    col.appendChild(h);

    // 渲染一个条目列表（✓/○ 标记）
    const makeList = (items) => {
      const ul = document.createElement("ul");
      ul.className = "capgroup__list";
      for (const item of items) {
        const li = document.createElement("li");
        li.className = "capgroup__item";
        const mark = document.createElement("span");
        mark.className = "capgroup__mark";
        mark.textContent = planned ? "○" : "✓";
        const txt = document.createElement("span");
        txt.textContent = t(item);
        li.append(mark, txt);
        ul.appendChild(li);
      }
      return ul;
    };

    for (const { group, items, subgroups } of groups) {
      const g = document.createElement("div");
      g.className = "capgroup";
      const gh = document.createElement("h3");
      gh.className = "capgroup__title";
      gh.textContent = t(group);
      g.appendChild(gh);

      if (subgroups && subgroups.length) {
        // 三级标题：每个 subgroup 一个小标题 + 列表
        for (const { sub, items: subItems } of subgroups) {
          const sh = document.createElement("h4");
          sh.className = "capgroup__subtitle";
          sh.textContent = t(sub);
          g.appendChild(sh);
          g.appendChild(makeList(subItems));
        }
      } else {
        g.appendChild(makeList(items || []));
      }
      col.appendChild(g);
    }
    return col;
  };

  const grid = document.createElement("div");
  grid.className = "capboard__grid";
  grid.append(
    makeColumn(t("landing.colSupported"), SUPPORTED, false),
    makeColumn(t("landing.colPlanned"), PLANNED, true)
  );
  board.appendChild(grid);

  const footer = document.createElement("p");
  footer.className = "capboard__footer";
  footer.textContent = t("landing.footer");
  board.appendChild(footer);

  return board;
}

export function renderLanding(root, { onTrigger, onRandom }) {
  root.innerHTML = "";

  const landing = document.createElement("section");
  landing.className = "landing";

  const hero = document.createElement("div");
  hero.className = "landing__hero lg-enter";

  const title = document.createElement("h1");
  title.className = "landing__title";
  title.textContent = t("landing.title");

  const btn = document.createElement("button");
  btn.className = "cta-button";
  btn.setAttribute("data-glass", "button");
  btn.innerHTML = `
    <span class="cta-main">${t("landing.ctaMain")}</span>
    <span class="cta-divider">${t("landing.ctaOr")}</span>
    <span class="cta-shortcut">${t("landing.ctaShortcutPrefix")} <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
  `;

  const hint = document.createElement("p");
  hint.className = "landing__hint";

  btn.addEventListener("click", () => onTrigger());

  hero.append(title, btn, hint);

  // 随机数据区：放在首屏之下（hero 占满首屏，需下滑才见），不喧宾夺主。
  // 「复制随机数据」随机塞一条样例进剪贴板并识别；旁边给「能识别什么」示例页入口。
  const tryRow = document.createElement("div");
  tryRow.className = "landing__tryrow";
  tryRow.innerHTML = `
    <p class="landing__tryhint">${t("landing.tryHint")}</p>
    <div class="landing__trybtns">
      <button class="landing__trybtn landing__trybtn--primary" data-role="random" type="button">${t("landing.randomBtn")}</button>
      <a class="landing__trybtn landing__trybtn--ghost" href="examples/index.html">${t("landing.examplesLink")}</a>
    </div>
  `;
  if (onRandom) tryRow.querySelector('[data-role="random"]').addEventListener("click", () => onRandom());

  landing.append(hero, tryRow, buildBoard());
  root.appendChild(landing);

  // 暴露提示更新器，供权限失败时改文案
  return {
    setHint(msg) {
      hint.textContent = msg;
    },
    setButtonText(mainText) {
      btn.querySelector(".cta-main").textContent = mainText;
    },
  };
}
