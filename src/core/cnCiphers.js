/**
 * cnCiphers.js — 中式/CJK 趣味编码（移植自 ToolsFx，ISC，鸣谢 Leon406）。
 * 当铺、天干地支(base60)、百家姓、元素周期表、ROT8000。
 * 以解码为主（剪贴板透视场景）。
 */

const td = (bytes) => new TextDecoder("utf-8").decode(new Uint8Array(bytes));

// ---------- 通用 radixN 解码（多字符 token 字典 → 字节） ----------
function radixNDecodeTokens(tokens, dict) {
  const radix = BigInt(dict.length);
  const leadingZero = dict[0];
  let num = 0n;
  let leadingZeros = 0;
  let counting = true;
  for (const tk of tokens) {
    const idx = dict.indexOf(tk);
    if (idx === -1) throw new Error("非法 token: " + tk);
    if (counting && tk === leadingZero) leadingZeros++;
    else counting = false;
    num = num * radix + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  for (let i = 0; i < leadingZeros; i++) bytes.unshift(0);
  return bytes;
}

// ---------- 当铺密码 ----------
const PAWN = {
  目: 0, 口: 0, 凹: 0, 凸: 0, 田: 0, 由: 1, 中: 2, 人: 3, 入: 3, 古: 3,
  工: 4, 互: 4, 果: 5, 克: 5, 尔: 5, 土: 5, 大: 5, 木: 6, 王: 6, 夫: 7,
  主: 7, 井: 8, 关: 8, 丰: 8, 并: 8, 圭: 9, 羊: 9,
};
export function pawnshopDecode(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      let digits = "";
      for (const ch of word) {
        if (!(ch in PAWN)) throw new Error("非当铺字符: " + ch);
        digits += PAWN[ch];
      }
      return String.fromCharCode(parseInt(digits, 10));
    })
    .join("");
}

// ---------- 天干地支 base60 ----------
const STEM = "甲乙丙丁戊己庚辛壬癸";
const BRANCH = "子丑寅卯辰巳午未申酉戌亥";
const STEM_BRANCH = [];
for (let i = 0; i < 60; i++) STEM_BRANCH.push(STEM[i % 10] + BRANCH[i % 12]);

export function stemBranchDecode(text) {
  const clean = text.replace(/\s/g, "");
  const tokens = [];
  for (let i = 0; i + 2 <= clean.length; i += 2) tokens.push(clean.slice(i, i + 2));
  return td(radixNDecodeTokens(tokens, STEM_BRANCH));
}

// ---------- 百家姓（字符替换 → base64 字母表 → base64 解码） ----------
const BJX = {
  赵:"0",钱:"1",孙:"2",李:"3",周:"4",吴:"5",郑:"6",王:"7",冯:"8",陈:"9",
  褚:"a",卫:"b",蒋:"c",沈:"d",韩:"e",杨:"f",朱:"g",秦:"h",尤:"i",许:"j",
  何:"k",吕:"l",施:"m",张:"n",孔:"o",曹:"p",严:"q",华:"r",金:"s",魏:"t",
  陶:"u",姜:"v",戚:"w",谢:"x",邹:"y",喻:"z",福:"A",水:"B",窦:"C",章:"D",
  云:"E",苏:"F",潘:"G",葛:"H",奚:"I",范:"J",彭:"K",郎:"L",鲁:"M",韦:"N",
  昌:"O",马:"P",苗:"Q",凤:"R",花:"S",方:"T",俞:"U",任:"V",袁:"W",柳:"X",
  唐:"Y",罗:"Z",薛:".",伍:"-",余:"_",米:"+",贝:"=",姚:"/",孟:"?",顾:"#",
  尹:"%",江:"&",钟:"*",
};
export function baiJiaXingDecode(text) {
  // 还原为字符，再按 base64（带特殊词典）解码
  let mapped = "";
  for (const ch of text) mapped += BJX[ch] ?? ch;
  // ToolsFx 用 base64 自定义词典；这里直接 atob（标准 base64 部分）
  try {
    const bin = atob(mapped.replace(/[^A-Za-z0-9+/=]/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return td(bytes);
  } catch {
    return mapped; // 退化：仅显示替换结果
  }
}

// ---------- 元素周期表（符号 → 序号 → 字符） ----------
const PERIOD = ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zi Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te In Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og").split(" ");
export function elementPeriodDecode(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((sym) => {
      const idx = PERIOD.indexOf(sym);
      if (idx === -1) throw new Error("未知元素: " + sym);
      return String.fromCharCode(idx + 1);
    })
    .join("");
}

// ---------- ROT8000（CJK 全角旋转，自反 shift=SIZE/2） ----------
const ROT8000_SIZE = 63404;
function r8index(code) {
  if (code >= 33 && code < 127) return code - 33;
  if (code >= 161 && code < 5760) return code - 67;
  if (code >= 5761 && code < 8192) return code - 68;
  if (code >= 8203 && code < 8232) return code - 79;
  if (code >= 8234 && code < 8239) return code - 81;
  if (code >= 8240 && code < 8287) return code - 81;
  if (code >= 8288 && code < 12288) return code - 83;
  if (code >= 12289 && code < 55296) return code - 84;
  if (code >= 57344 && code < 65536) return code - 2132;
  return -code;
}
function r8indexRe(index) {
  if (index >= 0 && index < 94) return index + 33;
  if (index >= 94 && index < 5693) return index + 67;
  if (index >= 5693 && index < 8124) return index + 68;
  if (index >= 8124 && index < 8153) return index + 79;
  if (index >= 8153 && index < 8158) return index + 81;
  if (index >= 8158 && index < 8205) return index + 81;
  if (index >= 8205 && index < 12205) return index + 83;
  if (index >= 12205 && index < 55212) return index + 84;
  if (index >= 55212 && index < 65536) return index + 2132;
  return index;
}
export function rot8000(text) {
  const shift = ROT8000_SIZE / 2;
  let out = "";
  for (const ch of text) {
    if (ch === " ") { out += ch; continue; }
    const i = r8index(ch.charCodeAt(0));
    out += i < 0 ? ch : String.fromCharCode(r8indexRe((i + shift) % ROT8000_SIZE));
  }
  return out;
}
