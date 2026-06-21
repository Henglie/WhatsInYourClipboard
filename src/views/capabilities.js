/**
 * capabilities.js — 能力清单（着陆页下方看板的数据源）。
 * 已支持 / 规划中两组，按类别组织。新增功能时同步更新此处。
 *
 * 数据模型：每个 group 可用 `items`（平铺）或 `subgroups`（三级标题分组）。
 * group / sub 键为 i18n key（caps 分区），items 为 i18n key（capItem 分区）。
 * 渲染见 LandingView.buildBoard。
 */

export const SUPPORTED = [
  {
    group: "caps.codecGroup",
    subgroups: [
      {
        sub: "caps.codecBase",
        items: [
          "capItem.baseFamily",
          "capItem.baseMid",
          "capItem.baseHigh",
          "capItem.base85Variants",
          "capItem.base100",
        ],
      },
      {
        sub: "caps.codecRadix",
        items: [
          "capItem.radixBinary",
          "capItem.radixHex",
          "capItem.radixQP",
          "capItem.radixPuny",
          "capItem.radixWeb",
        ],
      },
      {
        sub: "caps.codecClassic",
        items: [
          "capItem.classicCaesar",
          "capItem.classicAtbash",
          "capItem.classicGrons",
          "capItem.classicBifid",
          "capItem.classicAdfgx",
          "capItem.classicPlayfair",
          "capItem.classicBacon",
        ],
      },
      {
        sub: "caps.codecModern",
        items: [
          "capItem.modernCore",
          "capItem.modernPawn",
          "capItem.modernRot",
        ],
      },
      {
        sub: "caps.codecCtf",
        items: [
          "capItem.ctfDna",
          "capItem.ctfMorse",
          "capItem.ctfDiagram",
          "capItem.ctfTwin",
        ],
      },
      {
        sub: "caps.codecHash",
        items: [
          "capItem.hashDetect",
          "capItem.hashFile",
          "capItem.hashJwt",
        ],
      },
      {
        sub: "caps.codecOther",
        items: [
          "capItem.otherMorse",
          "capItem.otherUuid",
          "capItem.otherColor",
          "capItem.otherTimestamp",
          "capItem.otherCrypto",
        ],
      },
    ],
  },
  {
    group: "caps.identityGroup",
    items: [
      "capItem.idCard",
      "capItem.phone",
      "capItem.bankCard",
      "capItem.ipv4",
      "capItem.plate",
      "capItem.sensitive",
    ],
  },
  {
    group: "caps.structGroup",
    items: [
      "capItem.json",
      "capItem.code",
      "capItem.codeRun",
      "capItem.htmlRender",
      "capItem.xml",
      "capItem.csv",
      "capItem.markdown",
      "capItem.sql",
      "capItem.cron",
      "capItem.ua",
    ],
  },
  {
    group: "caps.lifeGroup",
    items: [
      "capItem.address",
      "capItem.coord",
      "capItem.map",
      "capItem.math",
      "capItem.isbn",
      "capItem.express",
    ],
  },
  {
    group: "caps.fileGroup",
    items: [
      "capItem.image",
      "capItem.svg",
      "capItem.pe",
      "capItem.zip",
      "capItem.pdf",
      "capItem.extFormat",
      "capItem.cert",
    ],
  },
  {
    group: "caps.cultureGroup",
    items: [
      "capItem.poetry",
      "capItem.cipai",
      "capItem.foreign",
      "capItem.emoji",
      "capItem.chineseRef",
    ],
  },
  {
    group: "caps.smartGroup",
    items: [
      "capItem.multiItem",
      "capItem.multiRead",
      "capItem.barcode",
      "capItem.shareCode",
      "capItem.delta",
    ],
  },
];

export const PLANNED = [
  {
    group: "caps.culturePlanned",
    items: [
      "capItem.poetrySrc",
      "capItem.idiom",
      "capItem.autoTrans",
      "capItem.emojiMeaning",
      "capItem.rareChar",
    ],
  },
  {
    group: "caps.gamePlanned",
    items: [
      "capItem.moreGame",
      "capItem.antiFake",
    ],
  },
  {
    group: "caps.filePlanned",
    items: [
      "capItem.office",
      "capItem.apk",
      "capItem.font",
    ],
  },
  {
    group: "caps.mediaPlanned",
    items: [
      "capItem.ocr",
      "capItem.mediaInfo",
      "capItem.exif",
    ],
  },
];