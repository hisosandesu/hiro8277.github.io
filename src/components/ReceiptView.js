import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Share2, Pen, Check, X, Plus } from "lucide-react-native";
import { COLORS } from "../constants/colors";
import { exportReceipt } from "../utils/excelExporter";
import { MESSAGES } from "../constants/messages";

/**
 * レシート構造化結果を表示・編集するコンポーネント。
 * 編集モードでは各フィールドを TextInput に切り替え、
 * 「完了」押下時に onResultChange で親の geminiResult を更新する。
 *
 * @param {{
 *   result: { raw_text, merchant, date, total, tax, items[] },
 *   onResultChange: (updated: object) => void
 * }} props
 */
export default function ReceiptView({ result, onResultChange, readOnly = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft]         = useState(result ?? {});
  const [exporting, setExporting] = useState(false);

  // 新OCR実行後など result prop が変わったら draft をリセット
  useEffect(() => {
    if (result) {
      setDraft(result);
      setIsEditing(false);
    }
  }, [result]);

  if (!result) return null;

  // ─── イミュータブル draft 更新ヘルパー ───────────────────────

  const updateDraft = useCallback(
    (patch) => setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );

  const updateItem = useCallback(
    (index, patch) =>
      setDraft((prev) => ({
        ...prev,
        items: prev.items.map((item, i) =>
          i === index ? { ...item, ...patch } : item,
        ),
      })),
    [],
  );

  const deleteItem = useCallback(
    (index) =>
      setDraft((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      })),
    [],
  );

  const insertAt = useCallback(
    (index) =>
      setDraft((prev) => {
        const next = [...(prev.items ?? [])];
        next.splice(index, 0, { name: "", price: null, quantity: 1 });
        return { ...prev, items: next };
      }),
    [],
  );

  // ─── 編集完了 ────────────────────────────────────────────────

  /** 文字列 → 整数変換。空・NaN は null を返す */
  const toInt = (v) => {
    const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
    return isNaN(n) ? null : n;
  };

  const handleDone = useCallback(() => {
    const normalized = {
      ...draft,
      total: toInt(draft.total),
      tax:   toInt(draft.tax),
      items: (draft.items ?? []).map((item) => ({
        ...item,
        price:    toInt(item.price),
        quantity: toInt(item.quantity) ?? 1,
      })),
    };
    setDraft(normalized);
    setIsEditing(false);
    onResultChange?.(normalized);
  }, [draft, onResultChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = useCallback(() => setIsEditing(true), []);

  // ─── エクスポート ─────────────────────────────────────────────

  /** エクスポートは常に draft（編集済みデータ）を使う */
  const runExport = useCallback(
    async (format) => {
      setExporting(true);
      try {
        const { format: usedFormat } = await exportReceipt(draft, format);
        if (usedFormat === "csv" && format === "excel") {
          Alert.alert(
            MESSAGES.SUCCESS.EXPORT_CSV_FALLBACK_TITLE,
            MESSAGES.SUCCESS.EXPORT_CSV_FALLBACK_BODY,
          );
        }
      } catch {
        Alert.alert("エクスポート失敗", "ファイルの共有に失敗しました");
      } finally {
        setExporting(false);
      }
    },
    [draft],
  );

  const handleExport = useCallback(() => {
    Alert.alert(MESSAGES.CONFIRM.EXPORT_FORMAT_TITLE, undefined, [
      { text: MESSAGES.CONFIRM.EXPORT_EXCEL, onPress: () => runExport("excel") },
      { text: MESSAGES.CONFIRM.EXPORT_CSV,   onPress: () => runExport("csv") },
      { text: MESSAGES.CONFIRM.CANCEL, style: "cancel" },
    ]);
  }, [runExport]);

  // ─── 表示用ヘルパー ──────────────────────────────────────────

  /** 金額を "¥1,234" 形式に変換。null/undefined は空文字 */
  const formatPrice = (value) => {
    if (value == null) return "";
    const n = Number(String(value).replace(/[^\d.]/g, ""));
    return isNaN(n) ? String(value) : `¥${n.toLocaleString()}`;
  };

  // 表示は常に draft から（編集中・表示中どちらも一元管理）
  const { merchant, date, total, tax, taxBreakdown, items = [], confidence } = draft;
  const hasItems   = items.length > 0;
  const hasSummary = total != null || tax != null;

  // ─── レンダー ────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      {/* 低信頼度バナー（スコア 0.5 未満のみ） */}
      {confidence != null && confidence < 0.5 ? (
        <View style={styles.confidenceBanner}>
          <Text style={styles.confidenceBannerText}>
            一部の情報が正しく読み取れていない可能性があります
          </Text>
        </View>
      ) : null}

      {/* 編集 / 完了 トグルボタン（readOnly=true のときは非表示） */}
      {!readOnly && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={isEditing ? handleDone : handleEdit}
        >
          {isEditing ? (
            <Check color={COLORS.primary} size={14} />
          ) : (
            <Pen color={COLORS.primary} size={14} />
          )}
          <Text style={styles.editButtonLabel}>
            {isEditing ? "完了" : "編集"}
          </Text>
        </TouchableOpacity>
      )}

      {/* 店名 */}
      {isEditing ? (
        <TextInput
          style={styles.merchantInput}
          value={draft.merchant ?? ""}
          onChangeText={(v) => updateDraft({ merchant: v })}
          placeholder="店名"
          textAlign="center"
        />
      ) : merchant ? (
        <Text style={styles.merchant}>{merchant}</Text>
      ) : null}

      {/* 日付 */}
      {isEditing ? (
        <TextInput
          style={styles.dateInput}
          value={draft.date ?? ""}
          onChangeText={(v) => updateDraft({ date: v })}
          placeholder="YYYY-MM-DD"
          textAlign="center"
        />
      ) : date ? (
        <Text style={styles.date}>{date}</Text>
      ) : null}

      {/* 区切り線（ヘッダーと明細の間） */}
      {isEditing || ((merchant || date) && hasItems) ? (
        <View style={styles.divider} />
      ) : null}

      {/* 明細テーブル */}
      <View style={styles.itemsSection}>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {/* 行間インサートバー（編集時・先頭行を除く） */}
            {isEditing && index > 0 ? (
              <TouchableOpacity
                style={styles.insertRowButton}
                onPress={() => insertAt(index)}
                hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
              >
                <View style={styles.insertRowLine} />
                <Plus color={COLORS.primary} size={10} />
                <View style={styles.insertRowLine} />
              </TouchableOpacity>
            ) : null}

            <View style={isEditing ? styles.itemRowEdit : styles.itemRow}>
              {isEditing ? (
                <>
                  {/* 商品名 */}
                  <TextInput
                    style={styles.itemNameInput}
                    value={item.name ?? ""}
                    onChangeText={(v) => updateItem(index, { name: v })}
                    placeholder="商品名"
                  />
                  {/* 数量・金額・削除 */}
                  <View style={styles.itemEditRight}>
                    <TextInput
                      style={styles.itemQtyInput}
                      value={item.quantity != null ? String(item.quantity) : ""}
                      onChangeText={(v) => updateItem(index, { quantity: v })}
                      keyboardType="numeric"
                      placeholder="1"
                      textAlign="center"
                    />
                    <Text style={styles.itemQtyLabel}>個</Text>
                    <TextInput
                      style={styles.itemPriceInput}
                      value={item.price != null ? String(item.price) : ""}
                      onChangeText={(v) => updateItem(index, { price: v })}
                      keyboardType="numeric"
                      placeholder="0"
                      textAlign="right"
                    />
                    <TouchableOpacity
                      style={styles.deleteItemButton}
                      onPress={() => deleteItem(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X color={COLORS.danger} size={16} />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name ?? ""}
                  </Text>
                  <View style={styles.itemRight}>
                    {item.quantity != null && item.quantity > 1 ? (
                      <Text style={styles.itemQty}>×{item.quantity}</Text>
                    ) : null}
                    <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                  </View>
                </>
              )}
            </View>
          </React.Fragment>
        ))}

        {/* 商品追加ボタン（編集時のみ・末尾に追加） */}
        {isEditing ? (
          <TouchableOpacity style={styles.addItemButton} onPress={() => insertAt(items.length)}>
            <Plus color={COLORS.primary} size={14} />
            <Text style={styles.addItemLabel}>商品を追加</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 合計・税 */}
      {hasSummary || isEditing ? (
        <>
          <View style={styles.divider} />

          {/* 複数税率の内訳（表示モードのみ・編集モードでは非表示） */}
          {taxBreakdown && !isEditing ? (
            <View style={styles.taxBreakdownSection}>
              {taxBreakdown.rate8 ? (
                <View style={styles.taxBreakdownRow}>
                  <Text style={styles.taxBreakdownLabel}>8%対象</Text>
                  <View style={styles.taxBreakdownValues}>
                    {taxBreakdown.rate8.subtotal != null ? (
                      <Text style={styles.taxBreakdownValue}>
                        ¥{Number(taxBreakdown.rate8.subtotal).toLocaleString()}
                      </Text>
                    ) : null}
                    {taxBreakdown.rate8.tax != null ? (
                      <Text style={styles.taxBreakdownTax}>
                        （税¥{Number(taxBreakdown.rate8.tax).toLocaleString()}）
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {taxBreakdown.rate10 ? (
                <View style={styles.taxBreakdownRow}>
                  <Text style={styles.taxBreakdownLabel}>10%対象</Text>
                  <View style={styles.taxBreakdownValues}>
                    {taxBreakdown.rate10.subtotal != null ? (
                      <Text style={styles.taxBreakdownValue}>
                        ¥{Number(taxBreakdown.rate10.subtotal).toLocaleString()}
                      </Text>
                    ) : null}
                    {taxBreakdown.rate10.tax != null ? (
                      <Text style={styles.taxBreakdownTax}>
                        （税¥{Number(taxBreakdown.rate10.tax).toLocaleString()}）
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* 消費税 */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>消費税</Text>
            {isEditing ? (
              <TextInput
                style={styles.summaryInput}
                value={draft.tax != null ? String(draft.tax) : ""}
                onChangeText={(v) => updateDraft({ tax: v })}
                keyboardType="numeric"
                placeholder="0"
                textAlign="right"
              />
            ) : tax != null ? (
              <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
            ) : null}
          </View>

          {/* 合計 */}
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>合計</Text>
            {isEditing ? (
              <TextInput
                style={styles.totalInput}
                value={draft.total != null ? String(draft.total) : ""}
                onChangeText={(v) => updateDraft({ total: v })}
                keyboardType="numeric"
                placeholder="0"
                textAlign="right"
              />
            ) : total != null ? (
              <Text style={styles.totalAmount}>{formatPrice(total)}</Text>
            ) : null}
          </View>
        </>
      ) : null}

      {/* 構造化データが全くない場合のフォールバック（表示モードのみ） */}
      {!isEditing && !merchant && !date && !hasItems && !hasSummary ? (
        <Text style={styles.noDataText}>
          構造化データが抽出できませんでした。テキスト表示をご利用ください。
        </Text>
      ) : null}

      {/* エクスポートボタン */}
      <TouchableOpacity
        style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Share2 color={COLORS.white} size={14} />
        )}
        <Text style={styles.exportLabel}>
          {exporting ? "エクスポート中..." : "エクスポート"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    width: "100%",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // ── 編集/完了ボタン ──────────────────────────────────────────
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonLabel: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.primary,
  },

  // ── ヘッダー（店名・日付）── 表示モード ──────────────────────
  merchant: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },

  // ── ヘッダー（店名・日付）── 編集モード ──────────────────────
  merchantInput: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    marginBottom: 4,
    paddingVertical: 2,
  },
  dateInput: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
    paddingVertical: 2,
  },

  // ── 区切り線 ────────────────────────────────────────────────
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderStyle: "dashed",
    marginVertical: 10,
  },

  // ── 明細行 ── 表示モード ────────────────────────────────────
  itemsSection: {
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  itemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemQty: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  itemPrice: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontVariant: ["tabular-nums"],
  },

  // ── 明細行 ── 編集モード ────────────────────────────────────
  itemRowEdit: {
    flexDirection: "row",
    alignItems: "flex-end", // 底辺（下線）を揃える
    gap: 4,
    marginBottom: 4,
  },
  itemNameInput: {
    flex: 1,
    height: 32,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 0,
  },
  itemEditRight: {
    flexDirection: "row",
    alignItems: "flex-end", // 底辺（下線）を揃える
    gap: 4,
  },
  itemQtyInput: {
    width: 36,
    height: 32,
    fontSize: 12,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 0,
    textAlign: "center",
  },
  itemQtyLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    height: 32,
    lineHeight: 32, // 他の入力欄の底辺に揃える
  },
  itemPriceInput: {
    width: 72,
    height: 32,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 0,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  deleteItemButton: {
    padding: 2,
  },

  // ── 行間インサートバー ──────────────────────────────────────
  insertRowButton: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
    gap: 4,
  },
  insertRowLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  // ── 商品追加ボタン ───────────────────────────────────────────
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    gap: 4,
  },
  addItemLabel: {
    fontSize: 13,
    color: COLORS.primary,
  },

  // ── サマリー（税・合計）── 表示モード ─────────────────────────
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    fontVariant: ["tabular-nums"],
  },

  // ── サマリー（税・合計）── 編集モード ─────────────────────────
  summaryInput: {
    width: 100,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 2,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  totalInput: {
    width: 100,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },

  // ── その他 ──────────────────────────────────────────────────
  noDataText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: 8,
  },
  confidenceBanner: {
    backgroundColor: "#fff8e1",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  confidenceBannerText: {
    fontSize: 11,
    color: "#92400e",
  },
  taxBreakdownSection: {
    gap: 2,
    marginBottom: 6,
  },
  taxBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taxBreakdownLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  taxBreakdownValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  taxBreakdownValue: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  taxBreakdownTax: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
    gap: 6,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportLabel: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "600",
  },
});
