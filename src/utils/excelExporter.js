/**
 * excelExporter.js
 *
 * レシート構造化データを Excel (.xlsx) または BOM付きCSV (.csv) としてエクスポートする。
 *
 * 戦略:
 *   1. xlsx パッケージで .xlsx ファイルを生成 → expo-file-system で保存 → expo-sharing で共有
 *   2. xlsx が Hermes で動作しない場合: BOM付き UTF-8 CSV にフォールバック（追加ライブラリ不要）
 *
 * 制約:
 *   - expo-file-system/legacy を使用（v19, "base64" リテラルを使用）
 *   - FileSystem.EncodingType は undefined になるため文字列リテラルで指定
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

// ─────────────────────────────────────────────────
// 共通ヘルパー
// ─────────────────────────────────────────────────

/**
 * ファイル名として安全な文字列を生成する（パス区切り文字・制御文字・.. を除去）
 */
function sanitizeFilename(str) {
  return String(str ?? "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\.{2,}/g, "_")  // パストラバーサル対策
    .trim()
    .slice(0, 40);
}

/**
 * スプレッドシートインジェクション（CSV Injection / Formula Injection）を防ぐ。
 * Excelは先頭が = + - @ \t \r の場合に数式として評価するため、シングルクォートを前置する。
 * CWE-1236 / OWASP 推奨パターン。
 */
function escapeFormula(value) {
  if (value == null) return value;
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/**
 * レシートデータからベースファイル名を生成する。
 * 例: "レシート_セブンイレブン_2026-04-07"
 */
function buildBaseName(result) {
  const merchant = sanitizeFilename(result.merchant ?? "");
  const date = sanitizeFilename(result.date ?? "");
  const suffix = merchant || date || new Date().toISOString().slice(0, 10);
  return `レシート_${suffix}`;
}

/**
 * 金額を "¥1,234" 形式に変換。null は空文字。
 */
function formatPrice(value) {
  if (value == null) return "";
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return isNaN(n) ? String(value) : `¥${n.toLocaleString()}`;
}

// ─────────────────────────────────────────────────
// Excel (.xlsx) エクスポート
// ─────────────────────────────────────────────────

/**
 * レシートデータを行列（Array of Arrays）に変換する。
 * xlsx.utils.aoa_to_sheet に渡すためのデータを生成する。
 *
 * @param {{ merchant, date, total, tax, items[] }} result
 * @returns {Array<Array>} aoa （Array of Arrays）
 */
function buildReceiptAOA(result) {
  const { merchant, date, total, tax, items = [] } = result;
  const aoa = [];

  // ヘッダー情報
  if (merchant) aoa.push(["店名", escapeFormula(merchant)]);
  if (date) aoa.push(["日付", escapeFormula(date)]);
  aoa.push([]); // 空行

  // 明細テーブルヘッダー
  aoa.push(["商品名", "数量", "金額"]);

  // 明細行
  for (const item of items) {
    aoa.push([
      escapeFormula(item.name ?? ""),
      item.quantity ?? 1,
      item.price ?? "",
    ]);
  }

  aoa.push([]); // 空行（区切り）

  // サマリー
  if (tax != null) aoa.push(["消費税", "", tax]);
  if (total != null) aoa.push(["合計", "", total]);

  return aoa;
}

/**
 * xlsx パッケージを使って .xlsx ファイルを生成し、共有ダイアログを表示する。
 *
 * @param {{ merchant, date, total, tax, items[] }} result - parseReceiptText の戻り値
 * @returns {Promise<void>}
 */
export async function exportReceiptAsExcel(result) {
  // xlsx のインポートを動的に実行（Hermes互換性の問題があれば catch される）
  let XLSX;
  try {
    XLSX = require("xlsx");
  } catch {
    throw new Error("XLSX_UNAVAILABLE");
  }

  const aoa = buildReceiptAOA(result);

  // ワークブック・シート生成
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 列幅の設定
  ws["!cols"] = [
    { wch: 30 }, // 商品名
    { wch: 8 },  // 数量
    { wch: 15 }, // 金額
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "レシート");

  // base64 文字列として書き出し（Hermes は Buffer 未対応のため type:"base64" を使用）
  const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  // ファイル保存
  const baseName = buildBaseName(result);
  const filePath = `${FileSystem.documentDirectory}${baseName}.xlsx`;
  await FileSystem.writeAsStringAsync(filePath, base64, { encoding: "base64" });

  // 共有ダイアログ
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("SHARING_UNAVAILABLE");
  }
  await Sharing.shareAsync(filePath, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "レシートをExcelで共有",
    UTI: "com.microsoft.excel.xlsx",
  });
}

// ─────────────────────────────────────────────────
// BOM付き CSV エクスポート（フォールバック）
// ─────────────────────────────────────────────────

/**
 * レシートデータを BOM付き UTF-8 CSV として生成する。
 * Excel で開いたときに日本語が文字化けしないよう BOM (\uFEFF) を先頭に付与する。
 *
 * @param {{ merchant, date, total, tax, items[] }} result
 * @returns {string} BOM付き CSV テキスト
 */
function buildReceiptCSV(result) {
  const { merchant, date, total, tax, items = [] } = result;

  // CSV セルのエスケープ（カンマ・改行・ダブルクォートを含む値をクォート）+ 数式インジェクション対策
  const esc = (v) => {
    const safe = escapeFormula(v ?? "");
    const s = String(safe);
    return s.includes(",") || s.includes("\n") || s.includes('"')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = [];
  if (merchant) rows.push(`店名,${esc(merchant)}`);
  if (date) rows.push(`日付,${esc(date)}`);
  rows.push("");
  rows.push("商品名,数量,金額");

  for (const item of items) {
    rows.push(
      [esc(item.name ?? ""), item.quantity ?? 1, item.price ?? ""].join(",")
    );
  }

  rows.push("");
  if (tax != null) rows.push(`消費税,,${tax}`);
  if (total != null) rows.push(`合計,,${total}`);

  // \uFEFF = BOM（Byte Order Mark）で Excel の文字コード自動検出を助ける
  return "\uFEFF" + rows.join("\n");
}

/**
 * BOM付き CSV を expo-file-system に保存して共有ダイアログを表示する。
 * xlsx が使えない環境でのフォールバックとして使用する。
 *
 * @param {{ merchant, date, total, tax, items[] }} result
 * @returns {Promise<void>}
 */
export async function exportReceiptAsCSV(result) {
  const csvText = buildReceiptCSV(result);
  const baseName = buildBaseName(result);
  const filePath = `${FileSystem.documentDirectory}${baseName}.csv`;

  // UTF-8 テキストをそのまま書き込み（encoding 省略 = UTF-8）
  await FileSystem.writeAsStringAsync(filePath, csvText);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("SHARING_UNAVAILABLE");
  }
  await Sharing.shareAsync(filePath, {
    mimeType: "text/csv",
    dialogTitle: "レシートをCSVで共有",
    UTI: "public.comma-separated-values-text",
  });
}

// ─────────────────────────────────────────────────
// 統合エントリーポイント
// ─────────────────────────────────────────────────

/**
 * Excel でのエクスポートを試み、失敗した場合は CSV にフォールバックする。
 *
 * @param {{ merchant, date, total, tax, items[] }} result
 * @param {"excel" | "csv"} format - ユーザーが選択したフォーマット
 * @returns {Promise<{ format: "excel" | "csv" }>} 実際に使用されたフォーマット
 */
export async function exportReceipt(result, format = "excel") {
  if (format === "csv") {
    await exportReceiptAsCSV(result);
    return { format: "csv" };
  }

  try {
    await exportReceiptAsExcel(result);
    return { format: "excel" };
  } catch (err) {
    // xlsx が利用不可の場合は CSV にフォールバック
    if (err.message === "XLSX_UNAVAILABLE") {
      await exportReceiptAsCSV(result);
      return { format: "csv" };
    }
    throw err;
  }
}
