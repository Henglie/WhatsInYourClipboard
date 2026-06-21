/**
 * stepper.js — 圆形液态玻璃数字步进器（统一 VI）。
 *
 * 结构：[ − 圆形玻璃钮 ] [ 数值框 ] [ + 圆形玻璃钮 ]
 * 参考 FairySave 的 .stepper（加减按钮 + 可编辑数值框），
 * 但加减钮做成本项目的圆形液态玻璃，统一全站「带上下箭头/增减」的数字输入。
 *
 * 用法：
 *   const s = createStepper({ value: 1, min: 1, max: 20, onChange: v => ... });
 *   container.appendChild(s.el);  // 入 DOM 后玻璃折射自动生效
 *   s.value          // 读取当前值
 *   s.value = 5      // 写入并触发 onChange
 */
import { applyLiquidGlass, supportsLiquidGlass } from "./liquidGlass.js";
import { t } from "../i18n/i18n.js";

export function createStepper({
  value = 1,
  min = 1,
  max = 99,
  step = 1,
  unit = "",
  onChange = null,
} = {}) {
  const clamp = (v) => {
    v = Number(v);
    if (Number.isNaN(v)) v = min;
    return Math.max(min, Math.min(max, v));
  };

  const wrap = document.createElement("div");
  wrap.className = "stepper";

  const dec = document.createElement("button");
  dec.type = "button";
  dec.className = "stepper__btn";
  dec.textContent = "−";
  dec.setAttribute("aria-label", t("stepper.dec"));

  const input = document.createElement("input");
  input.type = "number";
  input.className = "stepper__input";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(clamp(value));
  input.setAttribute("inputmode", "numeric");

  const inc = document.createElement("button");
  inc.type = "button";
  inc.className = "stepper__btn";
  inc.textContent = "+";
  inc.setAttribute("aria-label", t("stepper.inc"));

  wrap.append(dec, input);
  if (unit) {
    const u = document.createElement("span");
    u.className = "stepper__unit";
    u.textContent = unit;
    wrap.appendChild(u);
  }
  wrap.appendChild(inc);

  let cur = clamp(value);
  const emit = () => {
    input.value = String(cur);
    if (onChange) onChange(cur);
  };
  const set = (v) => {
    const next = clamp(v);
    if (next === cur) {
      input.value = String(cur); // 纠正越界输入显示
      return;
    }
    cur = next;
    emit();
  };

  dec.addEventListener("click", () => set(cur - step));
  inc.addEventListener("click", () => set(cur + step));
  input.addEventListener("input", () => {
    // 输入中允许临时空/非法，change 时再钳制
    const v = Number(input.value);
    if (!Number.isNaN(v) && input.value !== "") {
      cur = clamp(v);
      if (onChange) onChange(cur);
    }
  });
  input.addEventListener("change", () => set(input.value));

  // 圆形液态玻璃折射（仅 Chromium；其他浏览器降级为 CSS 玻璃）
  if (supportsLiquidGlass()) {
    for (const btn of [dec, inc]) {
      applyLiquidGlass(btn, { bezel: 9, scale: 26, blur: 0.6, dispersion: 1.4 });
    }
  }

  return {
    el: wrap,
    get value() {
      return cur;
    },
    set value(v) {
      set(v);
    },
    input,
  };
}
