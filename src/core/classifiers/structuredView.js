/**
 * structuredView.js — 结构化数据分类器：CSV表格、Cron、User-Agent、SQL。
 * Markdown 由 markdown.js 处理，CSV/Cron/UA/SQL 在此。
 */
import { BaseClassifier } from "./BaseClassifier.js";
import { buildInfoCard } from "../../views/renderers/infoCard.js";
import {
  parseCSV,
  isCron,
  describeCron,
  parseUA,
  isUA,
  isSQL,
  sqlDanger,
} from "../structured.js";
import { t } from "../../i18n/i18n.js";

// ---------- CSV/TSV → 表格 ----------
export class CsvClassifier extends BaseClassifier {
  static priority = 18;

  match(item) {
    if (!item.isText) return false;
    const t = item.text.trim();
    const lines = t.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return false;
    // 至少两行，每行有分隔符，且各行列数大体一致
    const delim = t.includes("\t") ? "\t" : ",";
    if (!t.includes(delim)) return false;
    const counts = lines.slice(0, 5).map((l) => l.split(delim).length);
    return counts[0] >= 2 && counts.every((c) => Math.abs(c - counts[0]) <= 1);
  }

  async parse(item) {
    const rows = parseCSV(item.text.trim());
    return {
      actionKey: "struct_csv",
      subtitle: t("cls.csv", { count: rows.length }),
      tplVars: {},
      render: (el) => {
        const table = document.createElement("table");
        table.className = "datatable";
        const thead = document.createElement("thead");
        const headTr = document.createElement("tr");
        for (const cell of rows[0]) {
          const th = document.createElement("th");
          th.textContent = cell;
          headTr.appendChild(th);
        }
        thead.appendChild(headTr);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (const row of rows.slice(1, 200)) {
          const tr = document.createElement("tr");
          for (const cell of row) {
            const td = document.createElement("td");
            td.textContent = cell;
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        el.appendChild(table);
      },
    };
  }
}

// ---------- Cron ----------
export class CronClassifier extends BaseClassifier {
  static priority = 49;

  match(item) {
    return item.isText && isCron(item.text);
  }

  async parse(item) {
    const t = item.text.trim();
    return {
      actionKey: "struct_cron",
      subtitle: t("cls.cron"),
      tplVars: {},
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.structExpression"), t],
              [t("cardRow.structMeaning"), describeCron(t)],
            ],
            { title: t("cardTitle.cron"), note: t("cardNote.cron") }
          )
        );
      },
    };
  }
}

// ---------- User-Agent ----------
export class UserAgentClassifier extends BaseClassifier {
  static priority = 47;

  match(item) {
    return item.isText && isUA(item.text);
  }

  async parse(item) {
    const ua = item.text.trim();
    const info = parseUA(ua);
    return {
      actionKey: "struct_ua",
      subtitle: t("cls.ua"),
      tplVars: {},
      render: (el) => {
        el.appendChild(
          buildInfoCard(
            [
              [t("cardRow.structBrowser"), info.browser],
              [t("cardRow.structOS"), info.os],
              [t("cardRow.structEngine"), info.engine],
              [t("cardRow.structDeviceType"), info.device],
            ],
            { title: t("cardTitle.ua") }
          )
        );
      },
    };
  }
}

// ---------- SQL ----------
export class SqlClassifier extends BaseClassifier {
  static priority = 15;

  match(item) {
    return item.isText && isSQL(item.text);
  }

  async parse(item) {
    const sql = item.text.trim();
    const danger = sqlDanger(sql);
    return {
      actionKey: "struct_sql",
      subtitle: t("cls.sql"),
      tplVars: { sql },
      render: (el) => {
        if (danger) {
          const warn = document.createElement("div");
          warn.className = "sql-warning";
          warn.textContent = t("cardRow.sqlDanger", { danger });
          el.appendChild(warn);
        }
        const pre = document.createElement("pre");
        pre.className = "code";
        pre.textContent = sql;
        el.appendChild(pre);
      },
    };
  }
}
