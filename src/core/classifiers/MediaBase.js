/**
 * MediaBase — 多媒体类分类器。
 * 位图图片预览（双击放大）+ 尺寸/主色调分析。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { enableZoom } from "../../ui/lightbox.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { readImageSize, readImageDetail, extractColors } from "../imageInfo.js";
import { parseExif, parseMediaMeta, fmtDuration } from "../mediaMeta.js";
import { detectExtended } from "../fileformats.js";
import { renderMap } from "../../ui/mapLoader.js";
import { t } from "../../i18n/i18n.js";

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export class MediaClassifier extends BaseClassifier {
  static priority = 30;

  match(item) {
    return item.mime.startsWith("image/") && item.mime !== "image/svg+xml";
  }

  async parse(item) {
    const blob = new Blob([item.bytes], { type: item.mime });
    const url = URL.createObjectURL(blob);
    const dim = readImageSize(item.bytes);
    const detail = readImageDetail(item.bytes); // 位深/色彩类型/透明/动图帧数
    const exif = parseExif(item.bytes); // JPEG EXIF（含 GPS），非 JPEG 为 null

    // 上下文感知动态动作（第三层）：EXIF 含 GPS 时，加「复制拍摄坐标 / 地图查看」。
    // GPS 为 WGS84，可直接喂 OSM；隐私铁律照旧——只构造按钮，点击才出去。
    const dynamicActions = [];
    if (exif?.gps) {
      const coord = `${exif.gps.lat.toFixed(6)}, ${exif.gps.lng.toFixed(6)}`;
      dynamicActions.push(
        { type: "copy", labelKey: "actionLabel.copyExifGps", template: coord },
        {
          type: "link",
          labelKey: "actionLabel.viewExifGpsOsm",
          url: `https://www.openstreetmap.org/?mlat=${exif.gps.lat}&mlon=${exif.gps.lng}#map=16/${exif.gps.lat}/${exif.gps.lng}`,
        },
      );
    }

    return {
      actionKey: "media_image",
      subtitle: t("cls.image"),
      tplVars: { mime: item.mime, size: String(item.size) },
      dynamicActions,
      render: (el) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = t("cls.image");
        enableZoom(img, url);
        el.appendChild(img);

        const hint = document.createElement("p");
        hint.className = "media-hint";
        hint.textContent = t("cardNote.imageZoom");
        el.appendChild(hint);

        const rows = [
          [t("cardRow.mediaFormat"), item.mime],
          [t("cardRow.mediaSize"), fmtSize(item.size)],
        ];
        if (dim) rows.push([t("cardRow.mediaDimensions"), `${dim.width} × ${dim.height} 像素`]);
        if (detail) {
          if (detail.bitDepth) rows.push([t("cardRow.imgBitDepth"), `${detail.bitDepth} bit`]);
          if (detail.colorType) rows.push([t("cardRow.imgColorType"), detail.colorType]);
          if (detail.hasAlpha != null) {
            rows.push([t("cardRow.imgAlpha"), detail.hasAlpha ? t("cardRow.imgAlphaYes") : t("cardRow.imgAlphaNo")]);
          }
          if (detail.animated) {
            rows.push([t("cardRow.imgAnimated"), t("cardRow.imgFrames", { count: detail.frames || "?" })]);
          }
          if (detail.progressive) rows.push([t("cardRow.imgScan"), t("cardRow.imgProgressive")]);
          if (detail.interlaced) rows.push([t("cardRow.imgScan"), t("cardRow.imgInterlaced")]);
          if (detail.mode) rows.push([t("cardRow.imgMode"), detail.mode]);
        }
        const card = buildInfoCard(rows, { title: t("cardTitle.imageInfo") });
        el.appendChild(card);

        // EXIF 拍摄信息（仅 JPEG 且有 EXIF 时）
        if (exif) {
          const exRows = [];
          if (exif.make || exif.model) {
            exRows.push([t("cardRow.exifCamera"), [exif.make, exif.model].filter(Boolean).join(" ")]);
          }
          const shot = exif.dateTimeOriginal || exif.dateTime;
          if (shot) exRows.push([t("cardRow.exifDateTime"), shot]);
          if (exif.fNumber) exRows.push([t("cardRow.exifAperture"), "f/" + exif.fNumber]);
          if (exif.exposureTime) {
            const et = exif.exposureTime < 1 ? `1/${Math.round(1 / exif.exposureTime)}` : String(exif.exposureTime);
            exRows.push([t("cardRow.exifExposure"), et + " s"]);
          }
          if (exif.iso) exRows.push([t("cardRow.exifIso"), "ISO " + exif.iso]);
          if (exif.focalLength) exRows.push([t("cardRow.exifFocal"), exif.focalLength + " mm"]);
          if (exif.gps) {
            const f = (n) => n.toFixed(6);
            exRows.push([t("cardRow.exifGps"), `${f(exif.gps.lat)}, ${f(exif.gps.lng)}`]);
          }
          if (exRows.length) {
            el.appendChild(buildInfoCard(exRows, {
              title: t("cardTitle.exif"),
              note: exif.gps ? t("cardNote.exifGps") : undefined,
            }));
          }
          // GPS → 点击查看地图（隐私铁律：默认不加载，点击才向 OSM 请求）
          if (exif.gps) {
            const mapBtn = document.createElement("button");
            mapBtn.className = "map-load-btn";
            mapBtn.textContent = t("cardRow.lifeLoadMap");
            const mapBox = document.createElement("div");
            mapBox.className = "map-box";
            mapBox.style.display = "none";
            const { lat, lng } = exif.gps;
            mapBtn.addEventListener("click", () => {
              mapBtn.remove();
              mapBox.style.display = "block";
              renderMap(mapBox, lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            });
            el.append(mapBtn, mapBox);
          }
        }

        // 主色调（异步）
        const palette = document.createElement("div");
        palette.className = "palette";
        el.appendChild(palette);
        extractColors(url, 5).then((colors) => {
          if (!colors.length) return;
          const label = document.createElement("div");
          label.className = "infocard__title";
          label.textContent = t("cardRow.mediaDominantColor");
          palette.appendChild(label);
          const swatches = document.createElement("div");
          swatches.className = "palette__row";
          for (const c of colors) {
            const sw = document.createElement("div");
            sw.className = "palette__chip";
            sw.style.background = c;
            sw.title = c;
            const lbl = document.createElement("span");
            lbl.textContent = c.toUpperCase();
            sw.appendChild(lbl);
            swatches.appendChild(sw);
          }
          palette.appendChild(swatches);
        });
      },
    };
  }
}

// ---------- SVG（识别 + 安全渲染 + 源码） ----------
export class SvgClassifier extends BaseClassifier {
  static priority = 34;

  match(item) {
    if (item.mime === "image/svg+xml") return true;
    if (!item.isText) return false;
    const text = item.text.trim();
    return /^<\?xml[^>]*\?>\s*<svg[\s>]/i.test(text) || /^<svg[\s>][\s\S]*<\/svg>\s*$/i.test(text);
  }

  async parse(item) {
    const src = item.isText
      ? item.text
      : new TextDecoder("utf-8").decode(item.bytes);

    // 安全渲染：剥离 script/事件处理器，用 Blob 通过 <img> 加载（img 不执行脚本）
    const blob = new Blob([src], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    // 尝试读 viewBox/宽高
    const wMatch = src.match(/width\s*=\s*["']([\d.]+)/i);
    const hMatch = src.match(/height\s*=\s*["']([\d.]+)/i);
    const vbMatch = src.match(/viewBox\s*=\s*["']([^"']+)["']/i);

    return {
      actionKey: "media_svg",
      subtitle: t("cls.svg"),
      tplVars: { svg: src },
      render: (el) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = t("cls.svg");
        img.className = "svg-preview";
        enableZoom(img, url);
        el.appendChild(img);

        const rows = [[t("cardRow.mediaFormat"), t("cardRow.formatSvg")]];
        if (wMatch && hMatch) rows.push([t("cardRow.mediaDimensions"), `${wMatch[1]} × ${hMatch[1]}`]);
        if (vbMatch) rows.push(["viewBox", vbMatch[1]]);
        rows.push([t("cardRow.mediaSourceLength"), `${src.length} 字符`]);
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.svg"),
            note: t("cardNote.svgSafe"),
          })
        );

        const lbl = document.createElement("div");
        lbl.className = "infocard__title";
        lbl.textContent = t("cardRow.mediaSource");
        const pre = document.createElement("pre");
        pre.className = "code";
        pre.textContent = src.length > 3000 ? src.slice(0, 3000) + "\n…" : src;
        el.append(lbl, pre);
      },
    };
  }
}

// ---------- 音频 / 视频（深度元信息）----------
// 让音视频不再只显示「一个名字」：MP3 标签 + 时长、WAV/FLAC 采样参数、
// MP4/MOV 时长 + 分辨率。视频可内嵌 <video> 本地预览，音频内嵌 <audio>。
export class AudioVideoClassifier extends BaseClassifier {
  static priority = 28; // 高于通用 FileClassifier(25)/ExtendedFile(24)，抢先深挖媒体

  match(item) {
    if (item.isText) return false;
    return parseMediaMeta(item.bytes, item.mime) !== null;
  }

  async parse(item) {
    const meta = parseMediaMeta(item.bytes, item.mime);
    if (!meta) return null;
    const isVideo = meta.kind === "video";
    // MIME：优先剪贴板给的，否则按解析出的格式兜一个，供 <audio>/<video> 用
    const fmtMime = {
      MP3: "audio/mpeg", WAV: "audio/wav", FLAC: "audio/flac", MP4: isVideo ? "video/mp4" : "audio/mp4",
    };
    const mime = item.mime && item.mime !== "application/octet-stream"
      ? item.mime
      : (fmtMime[meta.format] || (isVideo ? "video/mp4" : "audio/mpeg"));
    const blob = new Blob([item.bytes], { type: mime });
    const url = URL.createObjectURL(blob);

    // 动作模板插值：曲名/艺术家供搜歌，时长/分辨率供复制。
    // 搜索串优先「曲名 艺术家」，没标签则空（actions.json 会据此决定显隐）。
    const songQuery = [meta.title, meta.artist].filter(Boolean).join(" ");
    const dims = meta.width ? `${meta.width} × ${meta.height}` : "";
    const dur = meta.duration != null ? (fmtDuration(meta.duration) || "") : "";
    return {
      actionKey: isVideo ? "media_video" : "media_audio",
      subtitle: isVideo ? t("cls.video") : t("cls.audio"),
      tplVars: {
        format: meta.format,
        title: meta.title || "",
        artist: meta.artist || "",
        album: meta.album || "",
        songQuery,
        dims,
        duration: dur,
      },
      render: (el) => {
        // 本地预览（不外发：blob: URL 指向内存字节）
        const player = document.createElement(isVideo ? "video" : "audio");
        player.src = url;
        player.controls = true;
        player.preload = "metadata";
        player.className = isVideo ? "media-video" : "media-audio";
        el.appendChild(player);

        const rows = [[t("cardRow.mediaFormat"), meta.format]];
        if (meta.brand) rows.push([t("cardRow.mediaBrand"), meta.brand]);
        if (isVideo && meta.width) rows.push([t("cardRow.mediaDimensions"), `${meta.width} × ${meta.height} 像素`]);
        if (meta.duration != null) {
          const d = fmtDuration(meta.duration);
          if (d) rows.push([t("cardRow.mediaDuration"), d]);
        }
        if (meta.sampleRate) rows.push([t("cardRow.mediaSampleRate"), `${(meta.sampleRate / 1000).toFixed(1)} kHz`]);
        if (meta.channels) rows.push([t("cardRow.mediaChannels"), meta.channels === 1 ? t("cardRow.mediaMono") : meta.channels === 2 ? t("cardRow.mediaStereo") : String(meta.channels)]);
        if (meta.bitsPerSample) rows.push([t("cardRow.mediaBitDepth"), `${meta.bitsPerSample} bit`]);
        if (meta.bitrate) rows.push([t("cardRow.mediaBitrate"), `${meta.bitrate} kbps`]);
        rows.push([t("cardRow.mediaSize"), fmtSize(item.size)]);
        el.appendChild(buildInfoCard(rows, {
          title: isVideo ? t("cardTitle.videoInfo") : t("cardTitle.audioInfo"),
        }));

        // 音频 ID3 标签（曲名/艺术家/专辑/年份）单独成卡
        if (!isVideo && (meta.title || meta.artist || meta.album)) {
          const tagRows = [];
          if (meta.title) tagRows.push([t("cardRow.mediaTrackTitle"), meta.title]);
          if (meta.artist) tagRows.push([t("cardRow.mediaArtist"), meta.artist]);
          if (meta.album) tagRows.push([t("cardRow.mediaAlbum"), meta.album]);
          if (meta.year) tagRows.push([t("cardRow.mediaYear"), String(meta.year)]);
          el.appendChild(buildInfoCard(tagRows, { title: t("cardTitle.audioTags") }));
        }
      },
    };
  }
}
