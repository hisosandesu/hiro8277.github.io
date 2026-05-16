# mlKitTextReconstructor.js アルゴリズム詳細

`reconstructTextSpatially(blocks)` の主要アルゴリズム（2026-04-11 版）

## グループ適応型 yTolerance

- 旧: グローバル平均 height × 0.5 → 合計行など大フォント行が別グループに分離する問題
- 新: `groupMaxH × 0.6`（現グループの最大ライン高さ基準）+ `refTop` を平均に更新
- 商品行 height=16 → tolerance≈9.6px、合計行 height=32 → tolerance≈19.2px で自動調整

## height-ratio guard（2026-04-11 追加）

**問題**: `(税合計 ¥1,071)` 小フォント行と `合計 ¥14,151` 大フォント行がY近接のためマージ
→ TOTAL_RE が ¥1,071 を先食いして合計誤取得

**対策**: 新しい行が `groupMaxH × 1.5` 倍以上の高さなら厳格トレランス `max(groupMaxH × 0.3, 4)` を適用

```javascript
const isNewLineMuchTaller = line.height > groupMaxH * 1.5;
const effectiveTolerance = isNewLineMuchTaller
  ? Math.max(groupMaxH * 0.3, 4)
  : localTolerance; // max(groupMaxH * 0.6, 8)
```

例: `(税合計)` height=24 → tolerance=14.4px → guard 発動時は 7.2px → `合計` height=40 (40>24×1.5=36) → 別グループ化

## ピクセルギャップ基準の列区切り

```javascript
// right = left + width で各ラインの右端を計算
const gap = prev.width > 0 ? curr.left - prev.right : colGapThreshold;
result += gap >= avgHeight * 0.8 ? "  " : " ";
//         ^^^^^^^^ 列区切り（receiptParser の \s{2,} にマッチ）   ↑ 語内の軽微な隙間
```

- `width=0`（frame なし）のフォールバック: 従来通り一律 `"  "` で結合
- receiptParser の `ITEM_SIMPLE` の `\s{2,}` はこの 2スペース区切りを前提とする
