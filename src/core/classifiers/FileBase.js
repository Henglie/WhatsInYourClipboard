/**
 * FileBase — 文件类分类器。
 * 通过特征码（WasmBridge.detectMagic）判断二进制文件类型。
 * 覆盖：PE（EXE/DLL，提取架构）、ZIP 压缩包、PDF 文档。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { WasmBridge, CB_TYPE } from "../../wasm/bridge.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import { parseZip } from "../zip.js";
import { parsePDF } from "../fileformats.js";
import { buildHashPanel } from "../../views/renderers/hashPanel.js";
import { t } from "../../i18n/i18n.js";

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export class FileClassifier extends BaseClassifier {
  static priority = 25;

  match(item) {
    const type = WasmBridge.detectMagic(item.bytes);
    return (
      type === CB_TYPE.PE ||
      type === CB_TYPE.ZIP ||
      type === CB_TYPE.PDF
    );
  }

  async parse(item) {
    const type = WasmBridge.detectMagic(item.bytes);

    if (type === CB_TYPE.PE) {
      const pe = WasmBridge.parsePE(item.bytes) || {};
      const archDisplay = pe.arch ? t(pe.arch) : t("cardRow.unknown");
      return {
        actionKey: "file_exe",
        subtitle: t("cls.pe"),
        tplVars: { fileName: item.meta.fileName || "program.exe", arch: archDisplay },
        render: (el) => {
          el.appendChild(
            buildInfoCard(
              [
                [t("cardRow.mediaFormat"), "PE（Portable Executable）"],
                [t("cardRow.fileArchitecture"), archDisplay],
                [t("cardRow.mediaSize"), fmtSize(item.size)],
              ],
              {
                title: t("cardTitle.pe"),
                note: t("cardNote.pe"),
              }
            )
          );
          buildHashPanel(el, item.bytes);
        },
      };
    }

    if (type === CB_TYPE.ZIP) {
      const zip = parseZip(item.bytes);
      return {
        actionKey: "file_zip",
        subtitle: zip
          ? t("cls.zip", { count: zip.count })
          : t("cls.zipSimple"),
        tplVars: { size: fmtSize(item.size) },
        render: (el) => {
          if (!zip) {
            el.appendChild(
              buildInfoCard([[t("cardRow.mediaFormat"), t("cardRow.formatZip")], [t("cardRow.mediaSize"), fmtSize(item.size)]], {
                title: t("cardTitle.zip"),
                note: t("cardNote.zipBroken"),
              })
            );
            return;
          }

          const rows = [
            [t("cardRow.mediaFormat"), t("cardRow.formatZip")],
            [t("cardRow.fileEntryCount"), `${zip.count} ${t("cardRow.fileEntryCountUnit")}`],
            [t("cardRow.fileUncompressed"), fmtSize(zip.totalUncomp)],
            [t("cardRow.fileCompressed"), fmtSize(zip.totalComp)],
          ];
          if (zip.ratio > 0) {
            rows.push([t("cardRow.fileRatio"), `${(zip.ratio * 100).toFixed(0)}%`]);
          }
          if (zip.encrypted) rows.push([t("cardRow.fileEncrypted"), t("cardRow.fileEncryptedYes")]);
          el.appendChild(buildInfoCard(rows, { title: t("cardTitle.zip") }));

          // 文件树列表
          const listTitle = document.createElement("div");
          listTitle.className = "infocard__title";
          listTitle.textContent = t("cardRow.fileInsideFiles");
          el.appendChild(listTitle);

          const list = document.createElement("ul");
          list.className = "filelist";
          for (const entry of zip.entries.slice(0, 500)) {
            const li = document.createElement("li");
            li.className = entry.isDir ? "filelist__item is-dir" : "filelist__item";
            const name = document.createElement("span");
            name.className = "filelist__name";
            name.textContent = entry.name;
            const size = document.createElement("span");
            size.className = "filelist__size";
            size.textContent = entry.sizeText;
            li.append(name, size);
            list.appendChild(li);
          }
          el.appendChild(list);
          if (zip.entries.length > 500) {
            const more = document.createElement("p");
            more.className = "infocard__note";
            more.textContent = t("cardNote.zipTruncated", { count: zip.entries.length });
            el.appendChild(more);
          }
          buildHashPanel(el, item.bytes);
        },
      };
    }

    // PDF
    const pdf = parsePDF(item.bytes);
    return {
      actionKey: "file_pdf",
      subtitle: t("cls.pdf"),
      tplVars: { size: fmtSize(item.size) },
      render: (el) => {
        const rows = [
          [t("cardRow.mediaFormat"), `PDF ${pdf.version}`],
          [t("cardRow.mediaSize"), fmtSize(item.size)],
        ];
        if (pdf.pages) rows.push([t("cardRow.filePages"), `约 ${pdf.pages} 页`]);
        if (pdf.title) rows.push([t("cardRow.fileTitle"), pdf.title]);
        if (pdf.author) rows.push([t("cardRow.fileAuthor"), pdf.author]);
        if (pdf.creator) rows.push([t("cardRow.fileCreator"), pdf.creator]);
        el.appendChild(
          buildInfoCard(rows, {
            title: t("cardTitle.pdf"),
            note: t("cardNote.pdf"),
          })
        );
        buildHashPanel(el, item.bytes);
      },
    };
  }
}
