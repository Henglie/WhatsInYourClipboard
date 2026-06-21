/**
 * ctfCiphers.js — CTF 趣味编码（移植自 ToolsFx，ISC，鸣谢 Leon406）。
 * DNA、盲文 Braille、鲸语 Cetacean。
 */

// ---------- DNA 密码（3 字母密码子 → 字符） ----------
const DNA_MAP = {
  AAA:"a",AAC:"b",AAG:"c",AAT:"d",ACA:"e",ACC:"f",ACG:"g",ACT:"h",AGA:"i",AGC:"j",
  AGG:"k",AGT:"l",ATA:"m",ATC:"n",ATG:"o",ATT:"p",CAA:"q",CAC:"r",CAG:"s",CAT:"t",
  CCA:"u",CCC:"v",CCG:"w",CCT:"x",CGA:"y",CGC:"z",CGG:"A",CGT:"B",CTA:"C",CTC:"D",
  CTG:"E",CTT:"F",GAA:"G",GAC:"H",GAG:"I",GAT:"J",GCA:"K",GCC:"L",GCG:"M",GCT:"N",
  GGA:"O",GGC:"P",GGG:"Q",GGT:"R",GTA:"S",GTC:"T",GTG:"U",GTT:"V",TAA:"W",TAC:"X",
  TAG:"Y",TAT:"Z",TCA:"1",TCC:"2",TCG:"3",TCT:"4",TGA:"5",TGC:"6",TGG:"7",TGT:"8",
  TTA:"9",TTC:"0",TTG:" ",TTT:".",
};
const DNA_BIN = { "00":"A","10":"C","01":"G","11":"T" };

export function dnaDecode(text) {
  return text
    .split(/[^01AGCTagct]+/)
    .filter(Boolean)
    .map((seg) => {
      let codon = seg;
      // 若为 0/1 串，先转 DNA 字母
      if (/[01]/.test(seg)) {
        codon = (seg.match(/.{2}/g) || []).map((b) => DNA_BIN[b] || "").join("");
      }
      return DNA_MAP[codon.toUpperCase()] || "";
    })
    .join("");
}

// ---------- 盲文 Braille ----------
const BRAILLE_DICT =
  "⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⡰⡱⡲⡳⡴⡵⡶⡷⡸⡹⡺⡻⡼⡽⡾⡿⡠⡡⡢⡣⡤⡥⡦⡧⡨⡩⡪⡫⡬⡭⡮⡯⡐⡑⡒⡓⡔⡕⡖⡗⡘⡙⡚⡛⡜⡝⡞⡟⡀⡁⡂⡃⡄⡅⡆⡇⡈⡉⡊⡋⡌⡍⡎";

export function brailleDecode(text) {
  return [...text]
    .filter((c) => c !== "=")
    .map((c) => {
      const idx = BRAILLE_DICT.indexOf(c);
      return idx === -1 ? c : String.fromCharCode(idx + 32);
    })
    .join("")
    .replace(//g, "\r\n");
}

// ---------- 鲸语 Cetacean（16 位二进制，1→e 0→E） ----------
export function cetaceanDecode(text) {
  const s = text.replace(/\s/g, "");
  const chunks = s.match(/.{16}/g) || [];
  return chunks
    .map((ch) => {
      const bin = ch.replace(/e/g, "1").replace(/E/g, "0");
      return String.fromCharCode(parseInt(bin, 2));
    })
    .join("");
}
