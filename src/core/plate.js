/**
 * plate.js — 中国机动车号牌识别与解析（纯本地推导）。
 *
 * 目标：像国产手机 OS 智能剪贴板一样宽容——无论用户复制的是
 *   贵A12345 / 贵 A12345 / 贵·A12345 / 贵-A·12345
 * 都能识别。做法是先「规范化」（剥离省份与发牌字母之间、字母与序号
 * 之间的分隔符——空格 / 中点·/ 连字符-/ 等），再用严格正则校验，
 * 最后深度拆解（归属地=省份全称+城市、号牌类型、是否新能源等）。
 */

// 省份简称 → 全称
const PROVINCE = {
  京: "北京", 津: "天津", 沪: "上海", 渝: "重庆",
  冀: "河北", 豫: "河南", 云: "云南", 辽: "辽宁", 黑: "黑龙江",
  湘: "湖南", 皖: "安徽", 鲁: "山东", 新: "新疆", 苏: "江苏",
  浙: "浙江", 赣: "江西", 鄂: "湖北", 桂: "广西", 甘: "甘肃",
  晋: "山西", 蒙: "内蒙古", 陕: "陕西", 吉: "吉林", 闽: "福建",
  贵: "贵州", 粤: "广东", 青: "青海", 藏: "西藏", 川: "四川",
  宁: "宁夏", 琼: "海南",
  使: "使馆", 领: "领馆",
};

// 直辖市：任意发牌字母都归属于该市本身（不带「市」后缀，与城市显示风格一致）
const MUNICIPALITY = { 京: "北京", 津: "天津", 沪: "上海", 渝: "重庆" };

// 省份简称 + 发牌字母 → 城市。
// 覆盖国标常规分配（省会=字母 A）；个别历史/冷门/已撤销代码若无把握则不收录，
// 解析时回退为只显示省份全称，避免显示错误城市。
const CITY = {
  冀: { A: "石家庄", B: "唐山", C: "秦皇岛", D: "邯郸", E: "邢台", F: "保定", G: "张家口", H: "承德", J: "沧州", R: "廊坊", T: "衡水" },
  晋: { A: "太原", B: "大同", C: "阳泉", D: "长治", E: "晋城", F: "朔州", H: "忻州", J: "吕梁", K: "晋中", L: "临汾", M: "运城" },
  蒙: { A: "呼和浩特", B: "包头", C: "乌海", D: "赤峰", E: "呼伦贝尔", F: "兴安盟", G: "通辽", H: "锡林郭勒盟", J: "乌兰察布", K: "鄂尔多斯", L: "巴彦淖尔", M: "阿拉善盟" },
  辽: { A: "沈阳", B: "大连", C: "鞍山", D: "抚顺", E: "本溪", F: "丹东", G: "锦州", H: "营口", J: "阜新", K: "辽阳", L: "盘锦", M: "铁岭", N: "朝阳", P: "葫芦岛" },
  吉: { A: "长春", B: "吉林", C: "四平", D: "辽源", E: "通化", F: "白山", G: "白城", H: "延边", J: "松原" },
  黑: { A: "哈尔滨", B: "齐齐哈尔", C: "牡丹江", D: "佳木斯", E: "大庆", F: "伊春", G: "鸡西", H: "鹤岗", J: "双鸭山", K: "七台河", M: "绥化", N: "黑河", P: "大兴安岭" },
  苏: { A: "南京", B: "无锡", C: "徐州", D: "常州", E: "苏州", F: "南通", G: "连云港", H: "淮安", J: "盐城", K: "扬州", L: "镇江", M: "泰州", N: "宿迁", U: "苏州" },
  浙: { A: "杭州", B: "宁波", C: "温州", D: "绍兴", E: "湖州", F: "嘉兴", G: "金华", H: "衢州", J: "台州", K: "丽水", L: "舟山" },
  皖: { A: "合肥", B: "芜湖", C: "蚌埠", D: "淮南", E: "马鞍山", F: "淮北", G: "铜陵", H: "安庆", J: "黄山", K: "阜阳", L: "宿州", M: "滁州", N: "六安", P: "宣城", R: "池州", S: "亳州" },
  闽: { A: "福州", B: "莆田", C: "泉州", D: "厦门", E: "漳州", F: "龙岩", G: "三明", H: "南平", J: "宁德", K: "省直机关" },
  赣: { A: "南昌", B: "赣州", C: "宜春", D: "吉安", E: "上饶", F: "抚州", G: "九江", H: "景德镇", J: "萍乡", K: "新余", L: "鹰潭", M: "南昌" },
  鲁: { A: "济南", B: "青岛", C: "淄博", D: "枣庄", E: "东营", F: "烟台", G: "潍坊", H: "济宁", J: "泰安", K: "威海", L: "日照", M: "莱芜", N: "德州", P: "聊城", Q: "临沂", R: "菏泽", S: "滨州", U: "青岛", V: "潍坊", Y: "烟台" },
  豫: { A: "郑州", B: "开封", C: "洛阳", D: "平顶山", E: "安阳", F: "鹤壁", G: "新乡", H: "焦作", J: "濮阳", K: "许昌", L: "漯河", M: "三门峡", N: "商丘", P: "周口", Q: "驻马店", R: "南阳", S: "信阳", U: "济源" },
  鄂: { A: "武汉", B: "黄石", C: "十堰", D: "荆州", E: "宜昌", F: "襄阳", G: "鄂州", H: "荆门", J: "黄冈", K: "孝感", L: "咸宁", M: "仙桃", N: "潜江", P: "神农架", Q: "恩施", R: "天门", S: "随州" },
  湘: { A: "长沙", B: "株洲", C: "湘潭", D: "衡阳", E: "邵阳", F: "岳阳", G: "张家界", H: "益阳", J: "常德", K: "娄底", L: "郴州", M: "永州", N: "怀化", U: "长沙" },
  粤: { A: "广州", B: "深圳", C: "珠海", D: "汕头", E: "佛山", F: "韶关", G: "湛江", H: "肇庆", J: "江门", K: "茂名", L: "惠州", M: "梅州", N: "汕尾", P: "河源", Q: "阳江", R: "清远", S: "东莞", T: "中山", U: "潮州", V: "揭阳", W: "云浮" },
  桂: { A: "南宁", B: "柳州", C: "桂林", D: "梧州", E: "北海", F: "崇左", G: "来宾", H: "桂林", J: "贺州", K: "玉林", L: "百色", M: "河池", N: "钦州", P: "防城港", R: "贵港" },
  琼: { A: "海口", B: "三亚", C: "儋州", E: "洋浦" },
  川: { A: "成都", B: "绵阳", C: "自贡", D: "攀枝花", E: "泸州", F: "德阳", H: "广元", J: "遂宁", K: "内江", L: "乐山", M: "资阳", Q: "宜宾", R: "南充", S: "达州", T: "雅安", U: "成都", V: "眉山", W: "阿坝", X: "甘孜", Y: "凉山", Z: "广安" },
  贵: { A: "贵阳", B: "六盘水", C: "遵义", D: "铜仁", E: "黔西南", F: "毕节", G: "安顺", H: "黔东南", J: "黔南" },
  云: { A: "昆明", C: "昭通", D: "曲靖", E: "楚雄", F: "玉溪", G: "红河", H: "文山", J: "普洱", K: "西双版纳", L: "大理", M: "保山", N: "德宏", P: "丽江", Q: "怒江", R: "迪庆", S: "临沧", V: "昆明" },
  陕: { A: "西安", B: "铜川", C: "宝鸡", D: "咸阳", E: "渭南", F: "汉中", G: "安康", H: "商洛", J: "延安", K: "榆林", V: "杨凌" },
  甘: { A: "兰州", B: "嘉峪关", C: "金昌", D: "白银", E: "天水", F: "酒泉", G: "张掖", H: "武威", J: "定西", K: "陇南", L: "平凉", M: "庆阳", N: "临夏", P: "甘南" },
  青: { A: "西宁", B: "海东", C: "海北", D: "黄南", E: "海南", F: "果洛", G: "玉树", H: "海西" },
  宁: { A: "银川", B: "石嘴山", C: "吴忠", D: "固原", E: "中卫" },
  新: { A: "乌鲁木齐", B: "昌吉", C: "石河子", E: "博尔塔拉", F: "伊犁", G: "塔城", H: "阿勒泰", J: "克拉玛依", K: "吐鲁番", L: "哈密", M: "巴音郭楞", N: "阿克苏", P: "克孜勒苏", Q: "喀什", R: "和田" },
  藏: { A: "拉萨", B: "昌都", C: "山南", D: "日喀则", E: "那曲", F: "阿里", G: "林芝" },
};

const PROVINCE_CHARS = Object.keys(PROVINCE).join("");
// 发牌字母与序号字符集（不含方括号，便于拼进字符类，避免嵌套字符类把 ] 提前闭合）
const LETTER_SET = "A-HJ-NP-Z"; // A-Z 去除 I、O（避免与 1、0 混淆，国标不使用）
const ALNUM_SET = "A-HJ-NP-Z0-9";
const LETTER = `[${LETTER_SET}]`;
const ALNUM = `[${ALNUM_SET}]`;
// 末位特殊字（挂车/教练/警/港澳）
const TAIL_SET = "挂学警港澳";

// 普通民用：省 + 字母 + 5 位（字母数字，去 I/O）
// 新能源：省 + 字母 + 6 位
// 特殊（警/学/挂/港澳）：前 4 位字母数字 + 末位特殊字
const PLATE_BODY_RE = new RegExp(
  `^[${PROVINCE_CHARS}]${LETTER}(?:${ALNUM}{5}|${ALNUM}{4}[${ALNUM_SET}${TAIL_SET}]|${ALNUM}{6})$`
);

// 武警车牌：WJ + 省份简称(可选) + 字母数字。如 WJ京1234X、WJ1234X
const WJ_RE = new RegExp(`^WJ[${PROVINCE_CHARS}]?${ALNUM}{4,5}$`, "i");

// 末位特殊字（民用特种 + 警车 + 港澳出入境）
const SPECIAL_TAIL = {
  挂: "挂车",
  学: "教练车",
  警: "警车",
  港: "港澳入出境车（粤港）",
  澳: "港澳入出境车（粤澳）",
};

/**
 * 规范化车牌：剥离省份字、发牌字母、序号之间的分隔符与空白。
 * 仅去掉「分隔用」字符（空格 · • ・ - — – 中文间隔号、点），不动字母数字与汉字。
 * @param {string} raw
 * @returns {string} 大写、无分隔的紧凑串
 */
export function normalizePlate(raw) {
  return raw
    .trim()
    .replace(/[\s·••・\-—–.]/g, "") // 各类分隔符与空白
    .toUpperCase();
}

/**
 * 判断（规范化后的）字符串是否为合法车牌。
 */
export function isPlate(raw) {
  const s = normalizePlate(raw);
  return PLATE_BODY_RE.test(s) || WJ_RE.test(s);
}

/**
 * 查城市（发牌机关）：直辖市返回市本身；普通省份查表，未收录返回 null。
 * @returns {string|null}
 */
function lookupCity(provinceShort, letter) {
  if (MUNICIPALITY[provinceShort]) return MUNICIPALITY[provinceShort];
  const city = CITY[provinceShort] && CITY[provinceShort][letter];
  return city || null;
}

/**
 * 查归属地（城市上一级）：直辖市返回市本身；普通省份返回省份全称。
 * @returns {string}
 */
function lookupRegion(provinceShort) {
  if (MUNICIPALITY[provinceShort]) return MUNICIPALITY[provinceShort];
  return PROVINCE[provinceShort] || "未知";
}

/**
 * 深度解析车牌，返回结构化信息。
 * @param {string} raw 用户原始输入（可含分隔符）
 * @returns {{
 *   plate:string, normalized:string, provinceShort:string,
 *   region:string, city:string|null,
 *   isNewEnergy:boolean, energyType:string|null, special:string|null,
 *   isWj:boolean, kindKey:string
 * }|null}
 */
export function parsePlate(raw) {
  const s = normalizePlate(raw);
  const isWj = WJ_RE.test(s);
  if (!isWj && !PLATE_BODY_RE.test(s)) return null;

  if (isWj) {
    // 武警：WJ + [省] + 序号
    const rest = s.slice(2);
    const hasProvince = PROVINCE[rest[0]] !== undefined;
    const provinceShort = hasProvince ? rest[0] : null;
    return {
      plate: s,
      normalized: s,
      provinceShort: provinceShort || "—",
      region: provinceShort ? PROVINCE[provinceShort] : "全国",
      city: null,
      isNewEnergy: false,
      energyType: null,
      special: "武警车",
      isWj: true,
      kindKey: "cardRow.plateKindWj",
    };
  }

  const provinceShort = s[0];
  const authorityLetter = s[1];
  const body = s.slice(2); // 发牌字母之后的序号部分
  const tail = s[s.length - 1];

  // 新能源：省+字母后共 6 位序号（总长 8）。
  const isNewEnergy = body.length === 6;
  let energyType = null;
  if (isNewEnergy) {
    // 小型新能源：序号首位为字母（纯电 D / 插混 F 等）
    // 大型新能源：序号末位为字母
    if (/[A-Z]/.test(body[0])) energyType = "cardRow.plateEnergySmall";
    else if (/[A-Z]/.test(body[body.length - 1])) energyType = "cardRow.plateEnergyLarge";
  }

  const special = SPECIAL_TAIL[tail] || null;
  const isEmbassy = provinceShort === "使" || provinceShort === "领";

  let kindKey;
  if (isEmbassy) kindKey = "cardRow.plateKindEmbassy";
  else if (special === "教练车") kindKey = "cardRow.plateKindCoach";
  else if (special === "警车") kindKey = "cardRow.plateKindPolice";
  else if (special === "挂车") kindKey = "cardRow.plateKindTrailer";
  else if (special && special.startsWith("港澳")) kindKey = "cardRow.plateKindHkMacau";
  else if (isNewEnergy) kindKey = "cardRow.plateKindNewEnergy";
  else kindKey = "cardRow.plateKindNormal";

  return {
    plate: s,
    normalized: s,
    provinceShort,
    region: isEmbassy ? PROVINCE[provinceShort] : lookupRegion(provinceShort),
    city: isEmbassy ? null : lookupCity(provinceShort, authorityLetter),
    isNewEnergy,
    energyType,
    special,
    isWj: false,
    kindKey,
  };
}
