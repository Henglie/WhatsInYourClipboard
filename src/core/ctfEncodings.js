/**
 * ctfEncodings.js — CTF 编码增补第二批（移植 ToolsFx[ISC]，鸣谢 Leon406）。
 *
 * BauDot（5-bit 电传码，字母/数字双档切换）、BubbleBabble（元音辅音校验和）、
 * EmojiSubstitution（emoji-aes，64 emoji 替换 base64 字母表）、Zero1248（字母→8421 组合，0 分隔）。
 * 全部 encode/decode 往返验证。
 */

const te = (s) => [...new TextEncoder().encode(s)];
const td = (b) => new TextDecoder("utf-8").decode(new Uint8Array(b));

// ==================== BauDot（ITA2 / Baudot-Murray）====================
// 字母档 / 数字（figures）档，各 32 个 5-bit 码，11011=切数字档 11111=切字母档。
const BAUDOT_LETTER = {
  "00000": "", "00001": "E", "00010": "\n", "00011": "A", "00100": " ",
  "00101": "S", "00110": "I", "00111": "U", "01000": "\r", "01001": "D",
  "01010": "R", "01011": "J", "01100": "N", "01101": "F", "01110": "C",
  "01111": "K", "10000": "T", "10001": "Z", "10010": "L", "10011": "W",
  "10100": "H", "10101": "Y", "10110": "P", "10111": "Q", "11000": "O",
  "11001": "B", "11010": "G", "11011": "Figures", "11100": "M", "11101": "X",
  "11110": "V", "11111": "Letters",
};
const BAUDOT_FIGURE = {
  "00000": "", "00001": "3", "00010": "\n", "00011": "-", "00100": " ",
  "00101": "'", "00110": "8", "00111": "7", "01000": "\r", "01001": "",
  "01010": "4", "01011": "", "01100": ",", "01101": "!", "01110": ":",
  "01111": "(", "10000": "5", "10001": "+", "10010": ")", "10011": "2",
  "10100": "$", "10101": "6", "10110": "0", "10111": "1", "11000": "9",
  "11001": "?", "11010": "^", "11011": "Figures", "11100": ".", "11101": "/",
  "11110": ";", "11111": "Letters",
};
const BAUDOT_FIGURE_START = "11011";
const BAUDOT_LETTER_START = "11111";
const revMap = (m) => {
  const r = {};
  for (const [k, v] of Object.entries(m)) r[v] = k;
  return r;
};
const BAUDOT_LETTER_ENC = revMap(BAUDOT_LETTER);
const BAUDOT_FIGURE_ENC = revMap(BAUDOT_FIGURE);

export function baudotEncode(text) {
  let isLetter = true;
  const out = [];
  for (const ch of text) {
    if (isLetter) {
      const u = ch.toUpperCase();
      if (BAUDOT_LETTER_ENC[u] !== undefined) {
        out.push(BAUDOT_LETTER_ENC[u]);
      } else if (BAUDOT_FIGURE_ENC[ch] !== undefined) {
        out.push(BAUDOT_FIGURE_START, BAUDOT_FIGURE_ENC[ch]);
        isLetter = false;
      }
    } else {
      if (BAUDOT_FIGURE_ENC[ch] !== undefined) {
        out.push(BAUDOT_FIGURE_ENC[ch]);
      } else {
        const u = ch.toUpperCase();
        if (BAUDOT_LETTER_ENC[u] !== undefined) {
          out.push(BAUDOT_LETTER_START, BAUDOT_LETTER_ENC[u]);
          isLetter = true;
        }
      }
    }
  }
  return out.join(" ");
}

export function baudotDecode(text) {
  let isLetter = true;
  const tokens = text.trim().split(/\s+/).filter((t) => /^[01]+$/.test(t));
  const out = [];
  for (const tk of tokens) {
    if (tk === BAUDOT_LETTER_START || tk === BAUDOT_FIGURE_START) {
      isLetter = tk === BAUDOT_LETTER_START;
      continue;
    }
    const ch = isLetter ? BAUDOT_LETTER[tk] : BAUDOT_FIGURE[tk];
    if (ch !== undefined) out.push(ch);
  }
  return out.join("").toLowerCase();
}

// ==================== BubbleBabble ====================
// 规范：wiki.yak.net/589/Bubble_Babble_Encoding.txt（仅 ASCII）。
const BB_VOWELS = "aeiouy";
const BB_CONSONANTS = "bcdfghklmnprstvzx";

export function bubbleBabbleEncode(str) {
  const k = str.length;
  const D = te(str); // 仅 ASCII 时逐字节即字符
  const C = new Array(Math.floor(k / 2) + 1);
  for (let i = 0; i < Math.floor(k / 2) + 1; i++) {
    C[i] = i === 0 ? 1 : ((C[i - 1] * 5 + D[i * 2 - 2] * 7 + D[i * 2 - 1]) % 36);
  }
  let out = "x";
  for (let i = 0; i < Math.floor(k / 2); i++) {
    const a = ((D[i * 2] >> 6 & 3) + C[i]) % 6;
    const b = D[i * 2] >> 2 & 15;
    const c = (D[i * 2] & 3) + (Math.floor(C[i] / 6) % 6);
    if (2 * i + 1 >= k) break;
    const d = D[i * 2 + 1] >> 4 & 15;
    const e = D[i * 2 + 1] & 15;
    out += BB_VOWELS[a] + BB_CONSONANTS[b] + BB_VOWELS[c % 6] + BB_CONSONANTS[d] + "-" + BB_CONSONANTS[e];
  }
  let p0, p1, p2;
  if (k % 2 === 0) {
    p0 = C[k / 2] % 6;
    p1 = 16;
    p2 = Math.floor(C[k / 2] / 6);
  } else {
    p0 = ((D[k - 1] >> 6 & 3) + C[(k - 1) / 2]) % 6;
    p1 = D[k - 1] >> 2 & 15;
    p2 = ((D[k - 1] & 3) + Math.floor(C[(k - 1) / 2] / 6)) % 6;
  }
  out += BB_VOWELS[p0] + BB_CONSONANTS[p1] + BB_VOWELS[p2] + "x";
  return out;
}

export function bubbleBabbleDecode(str) {
  let c = 1;
  const body = str.substring(1, str.length - 1); // 去首尾 x
  const chunks = [];
  for (let i = 0; i < body.length; i += 6) chunks.push(body.slice(i, i + 6));
  const lastTuple = chunks.length - 1;
  const bytes = [];
  chunks.forEach((value, index) => {
    const tup = [];
    tup.push(BB_VOWELS.indexOf(value[0]));
    tup.push(BB_CONSONANTS.indexOf(value[1]));
    tup.push(BB_VOWELS.indexOf(value[2]));
    let hasFull = false;
    if (value.length >= 6) {
      tup.push(BB_CONSONANTS.indexOf(value[3]));
      tup.push("-");
      tup.push(BB_CONSONANTS.indexOf(value[5]));
      hasFull = true;
    }
    const high = ((tup[0] - c % 6) + 6) % 6;
    const mid = tup[1];
    const low = ((tup[2] - Math.floor(c / 6) % 6) + 6) % 6;
    const b = (high << 6 | mid << 2 | low) & 0xff;
    if (lastTuple === index) {
      if (tup[1] !== 16) bytes.push(b);
    } else {
      bytes.push(b);
      const b1 = (tup[3] << 4 | tup[5]) & 0xff;
      bytes.push(b1);
      c = (c * 5 + b * 7 + b1) % 36;
    }
  });
  return td(bytes);
}

// ==================== EmojiSubstitution（emoji-aes）====================
const EMOJI_MAP = [
  "🍎", "🍌", "🏎", "🚪", "👁", "👣", "😀", "🖐", "ℹ", "😂", "🥋", "✉",
  "🚹", "🌉", "👌", "🍍", "👑", "👉", "🎤", "🚰", "☂", "🐍", "💧", "✖",
  "☀", "🦓", "🏹", "🎈", "😎", "🎅", "🐘", "🌿", "🌏", "🌪", "☃", "🍵",
  "🍴", "🚨", "📮", "🕹", "📂", "🛩", "⌨", "🔄", "🔬", "🐅", "🙃", "🐎",
  "🌊", "🚫", "❓", "⏩", "😁", "😆", "💵", "🤣", "☺", "😊", "😇", "😡",
  "🎃", "😍", "✅", "🔪", "🗒",
];
const EMOJI_B64_DICT = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
const circleIndex = (n, len, shift = 0) => {
  let v = n + shift;
  return ((v % len) + len) % len;
};

export function emojiSubstEncode(text, shift = 0) {
  const out = [];
  for (const ch of text) {
    const idx = EMOJI_B64_DICT.indexOf(ch);
    if (idx === -1) continue; // 非 base64 字母表字符跳过
    out.push(EMOJI_MAP[circleIndex(idx, EMOJI_MAP.length, shift)]);
  }
  return out.join("");
}

export function emojiSubstDecode(text, shift = 0) {
  const out = [];
  for (const ch of [...text]) {
    const idx = EMOJI_MAP.indexOf(ch);
    if (idx === -1) continue;
    out.push(EMOJI_B64_DICT[circleIndex(idx, EMOJI_MAP.length, -shift)]);
  }
  return out.join("");
}

// ==================== Zero1248 ====================
// 字母 A..Z → 序号 1..26，序号拆成 8/4/2/1 的重复串（贪心），字母间用 0 分隔。
function zero1248Digit(n) {
  let s = "";
  s += "8".repeat(Math.floor(n / 8));
  s += "4".repeat(Math.floor((n % 8) / 4));
  s += "2".repeat(Math.floor((n % 4) / 2));
  s += "1".repeat(Math.floor((n % 2) / 1));
  return s;
}
export function zero1248Encode(text) {
  return [...text.toUpperCase()]
    .filter((c) => c >= "A" && c <= "Z")
    .map((c) => zero1248Digit(c.charCodeAt(0) - 65 + 1))
    .join("0");
}
export function zero1248Decode(text) {
  return text
    .trim()
    .split("0")
    .map((seg) => {
      const sum = [...seg].reduce((acc, d) => acc + (d.charCodeAt(0) - 48), 0);
      return String.fromCharCode(sum + 65 - 1);
    })
    .join("");
}
