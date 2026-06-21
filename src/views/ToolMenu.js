/**
 * ToolMenu.js — 解码工具箱（二级折叠菜单）。
 *
 * 自动从 codec.js (CODECS) 与 ciphers.js (CIPHERS) 注册表生成。
 * 按 cat 分类折叠进可展开的分组，避免一次性铺太多按钮拖慢浏览器。
 * 新增编码只需在注册表加一项（带 cat），菜单自动归类出现。
 *
 * 支持：
 *  - 分类折叠（手风琴，点分组标题展开/收起）
 *  - 编码 / 解码方向切换（仅当该工具含 encode）
 *  - 参数输入（自定义码表 / key / 位移 / a,b）
 *  - 多次处理（圆形液态玻璃 stepper，统一 VI）
 *  - 本地就地显示，不联网、不跳转
 */
import { CODECS, tryDecode, tryEncode } from "../core/codec.js";
import { CIPHERS, tryCipher, tryCipherEncode } from "../core/ciphers.js";
import { applyLiquidGlass } from "../ui/liquidGlass.js";
import { createStepper } from "../ui/stepper.js";
import { t } from "../i18n/i18n.js";

export function renderToolMenu(container, raw) {
  // 分类定义：顺序即展示顺序。kind 决定调用哪套注册表 / try 函数。
  // 放在函数内，确保语言切换后重新调用 t() 获取最新翻译。
  const CATEGORIES = [
    { id: "base", kind: "codec", name: t("cat.base") },
    { id: "radix", kind: "codec", name: t("cat.radix") },
    { id: "web", kind: "codec", name: t("cat.web") },
    { id: "fun", kind: "codec", name: t("cat.fun") },
    { id: "classic", kind: "cipher", name: t("cat.classic") },
    { id: "modern", kind: "cipher", name: t("cat.modern") },
    { id: "ctf", kind: "cipher", name: t("cat.ctf") },
  ];
  const wrap = document.createElement("div");
  wrap.className = "toolbox";

  const title = document.createElement("h3");
  title.className = "toolbox__title";
  title.textContent = t("toolbox.title");
  wrap.appendChild(title);

  const hint = document.createElement("p");
  hint.className = "toolbox__hint";
  hint.textContent = t("toolbox.hint");
  wrap.appendChild(hint);

  // 控制区（选中工具后出现）：方向切换 + 参数 + 次数
  const ctrlBox = document.createElement("div");
  ctrlBox.className = "toolbox__ctrl";
  ctrlBox.style.display = "none";

  const resultBox = document.createElement("div");
  resultBox.className = "decode-result";
  resultBox.style.display = "none";

  // —— 运行态 ——
  let activeChip = null;
  let active = null; // { kind, id, def }
  let dir = "decode"; // 'encode' | 'decode'
  let collectParams = () => ({});

  const renderResult = () => {
    if (!active) return;
    const params = collectParams();
    let r;
    if (active.kind === "codec") {
      r = dir === "encode" ? tryEncode(active.id, raw, params) : tryDecode(active.id, raw, params);
    } else {
      r = dir === "encode" ? tryCipherEncode(active.id, raw, params) : tryCipher(active.id, raw, params);
    }
    const wasHidden = resultBox.style.display === "none";
    resultBox.style.display = "block";
    // 首次出现才入场动画；后续改参数即时刷新，不重复抖动
    if (wasHidden) {
      resultBox.classList.remove("lg-enter");
      void resultBox.offsetWidth; // 强制回流，重置动画
      resultBox.classList.add("lg-enter");
    }
    resultBox.innerHTML = "";
    const titleEl = document.createElement("div");
    titleEl.className = "decode-result__title";
    titleEl.textContent = `${active.def.labelKey ? t(active.def.labelKey) : active.def.label} · ${dir === "encode" ? t("toolbox.resultEncode") : t("toolbox.resultDecode")}`;
    const pre = document.createElement("pre");
    pre.className = "code";
    if (r.ok && r.result && String(r.result).trim()) {
      pre.textContent = r.result;
    } else {
      pre.textContent = r.ok
        ? t("toolbox.emptyResult")
        : t("toolbox.failed", { error: r.error });
      pre.classList.add("decode-result__error");
    }
    resultBox.append(titleEl, pre);
  };

  // 重建控制区（方向切换 + 参数 + 次数）
  const buildCtrl = () => {
    ctrlBox.innerHTML = "";
    ctrlBox.style.display = "flex";
    const def = active.def;

    // 全列举型（如凯撒全位移、栅栏全栏数）：结果本身已穷举所有可能，
    // 既无「编码方向」也无「多次处理」的意义，只保留参数（若有）。
    const enumerated = !!def.enumerated;

    // 方向切换：仅当含 encode 且非全列举
    if (def.encode && !enumerated) {
      const seg = document.createElement("div");
      seg.className = "dir-toggle";
      const mk = (val, label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dir-toggle__btn" + (dir === val ? " is-on" : "");
        b.textContent = label;
        b.addEventListener("click", () => {
          if (dir === val) return;
          dir = val;
          seg.querySelectorAll(".dir-toggle__btn").forEach((x) => x.classList.remove("is-on"));
          b.classList.add("is-on");
          renderResult();
        });
        return b;
      };
      seg.append(mk("decode", t("toolbox.decode")), mk("encode", t("toolbox.encode")));
      ctrlBox.appendChild(seg);
    } else {
      dir = "decode";
    }

    // 参数输入
    const specs = def.params || [];
    const inputs = {};
    if (specs.length) {
      const prow = document.createElement("div");
      prow.className = "toolbox__paramrow";
      for (const sp of specs) {
        const field = document.createElement("label");
        field.className = "toolbox__field";
        const lab = document.createElement("span");
        lab.textContent = t(sp.label);
        const inp = document.createElement("input");
        inp.type = sp.type === "number" ? "number" : "text";
        inp.value = sp.default ?? "";
        inp.className = "toolbox__input";
        inp.addEventListener("input", renderResult);
        inputs[sp.name] = () => inp.value;
        field.append(lab, inp);
        prow.appendChild(field);
      }
      ctrlBox.appendChild(prow);
    }

    // 次数：圆形液态玻璃 stepper（统一 VI）。全列举型不显示（无多次意义）。
    let stepper = null;
    if (!enumerated) {
      const timesField = document.createElement("div");
      timesField.className = "toolbox__field toolbox__field--times";
      const tlab = document.createElement("span");
      tlab.textContent = dir === "encode" ? t("toolbox.timesEncode") : t("toolbox.times");
      stepper = createStepper({
        value: 1, min: 1, max: 20, step: 1,
        onChange: renderResult,
      });
      timesField.append(tlab, stepper.el);
      ctrlBox.appendChild(timesField);
    }

    // 控制区若空（全列举且无参数），整条隐藏
    if (!ctrlBox.children.length) ctrlBox.style.display = "none";

    collectParams = () => {
      const p = { _times: stepper ? stepper.value : 1 };
      for (const [k, getter] of Object.entries(inputs)) p[k] = getter();
      return p;
    };
  };

  const runTool = (chip, kind, id, def) => {
    if (activeChip) {
      activeChip.classList.remove("is-active");
      if (activeChip._glass) { activeChip._glass.destroy(); activeChip._glass = null; }
    }
    activeChip = chip;
    chip.classList.add("is-active");
    chip._glass = applyLiquidGlass(chip, { bezel: 16, scale: 56, dispersion: 2.4 });

    active = { kind, id, def };
    dir = "decode";
    buildCtrl();
    renderResult();
  };

  // —— 分类手风琴 ——
  const registryFor = (kind) => (kind === "codec" ? CODECS : CIPHERS);

  for (const cat of CATEGORIES) {
    const entries = Object.entries(registryFor(cat.kind)).filter(
      ([, def]) => def.cat === cat.id
    );
    if (!entries.length) continue;

    const section = document.createElement("div");
    section.className = "cat-section";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "cat-header";
    header.innerHTML =
      `<span class="cat-header__chevron">▸</span>` +
      `<span class="cat-header__name">${cat.name}</span>` +
      `<span class="cat-header__count">${entries.length}</span>`;

    const body = document.createElement("div");
    body.className = "cat-body"; // grid-rows 抽屉动画容器
    const bodyInner = document.createElement("div");
    bodyInner.className = "cat-body__inner"; // overflow:hidden + padding 在此

    const grid = document.createElement("div");
    grid.className = "toolbox__grid lg-stagger";
    for (const [id, def] of entries) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tool-chip";
      const tags = [];
      if (def.encode) tags.push("⇄");
      if (def.params) tags.push("⚙");
      // 使用 labelKey 获取翻译文本，如果没有 labelKey 则使用 label
      const label = def.labelKey ? t(def.labelKey) : def.label;
      chip.textContent = label + (tags.length ? " " + tags.join("") : "");
      chip.addEventListener("click", () => runTool(chip, cat.kind, id, def));
      grid.appendChild(chip);
    }
    bodyInner.appendChild(grid);
    body.appendChild(bodyInner);

    header.addEventListener("click", () => {
      const open = section.classList.toggle("is-open");
      header.setAttribute("aria-expanded", open ? "true" : "false");
      // 展开时让工具药丸错峰弹入（重置动画再播放）
      if (open) {
        grid.classList.remove("lg-stagger");
        void grid.offsetWidth;
        grid.classList.add("lg-stagger");
      }
    });
    header.setAttribute("aria-expanded", "false");

    section.append(header, body);
    wrap.appendChild(section);
  }

  wrap.append(ctrlBox, resultBox);
  container.appendChild(wrap);
}
