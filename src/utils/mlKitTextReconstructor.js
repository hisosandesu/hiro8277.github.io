/**
 * ML Kit Text Recognition v2 の空間的テキスト再構築ユーティリティ。
 *
 * 【問題】
 * ML Kit が返す `result.text` はブロック単位の連結文字列。
 * レシートのような2列レイアウト（品目 | 価格）では、
 * 品目名ブロックと価格ブロックが別々に検出・連結されるため
 * 「コーヒー\nサンドイッチ\n¥150\n¥350」のように列が分離してしまう。
 *
 * 【解決策】
 * TextBlock.lines[].frame（top, left, width, height）でラインを空間的に処理し、
 * Y座標グループ化 → X座標ソート → 視覚ギャップに応じたスペース結合で
 * レシートの「品目  ¥価格」形式を確実に再現する。
 *
 * 変換例:
 *   result.text:   "コーヒー\nサンドイッチ\n¥150\n¥350"  ← 列が分離
 *   reconstructed: "コーヒー  ¥150\nサンドイッチ  ¥350"  ← 正しい行対応
 *
 * 【改善点（width 対応）】
 * 各ラインの right = left + width を計算し、隣接ライン間の視覚ギャップを px 単位で
 * 判定する。ギャップが「文字高さの 0.8 倍以上」なら列区切りとして 2 スペースを挿入。
 * これにより receiptParser の \s{2,} が確実に列境界を検出できる。
 */

/**
 * ML Kit ブロック配列から視覚的なレイアウト順でテキストを再構築する。
 *
 * アルゴリズム:
 * 1. 全ブロックから全ラインを frame（top, left, width, height）付きで抽出
 * 2. top でソートし、グループ適応型 yTolerance でラインを同一行グループにまとめる
 *    ※ yTolerance はグローバル平均ではなく現グループの maxHeight × 0.6 で計算。
 *      合計行など大きいフォントの行でも正しく同一行にグループ化できる。
 * 3. 各グループ内を left でソートし、隣接ライン間の視覚ギャップで結合文字を決定:
 *    - ギャップ >= height × 0.8 → "  "（2スペース: 列区切り）
 *    - ギャップ < height × 0.8  → " " （1スペース: 同一語内の軽微な隙間）
 * 4. グループを top 順（上→下）で改行結合
 *
 * @param {import('@react-native-ml-kit/text-recognition').TextBlock[]} blocks
 *   TextRecognitionResult.blocks
 * @returns {string} 視覚的な行順に再構築されたテキスト。
 *   blocks が空または frame 情報がない場合は空文字列を返す。
 */
export function reconstructTextSpatially(blocks) {
  if (!blocks || blocks.length === 0) return "";

  // 全ブロックから全ラインを frame 付きで抽出（width を追加）
  const allLines = [];
  for (const block of blocks) {
    for (const line of block.lines ?? []) {
      const height = line.frame?.height ?? 20;
      const width  = line.frame?.width  ?? 0;
      allLines.push({
        text:   line.text,
        top:    line.frame?.top  ?? 0,
        left:   line.frame?.left ?? 0,
        height,
        width,
        right:  (line.frame?.left ?? 0) + width, // 右端座標
      });
    }
  }

  if (allLines.length === 0) return "";

  // top でソート（上から下へ）
  allLines.sort((a, b) => a.top - b.top);

  // Y 座標でグループ化。
  // yTolerance はグループの最大ライン高さ × 0.6 でグループごとに計算する。
  // グローバル平均を使うと合計行など大きいフォントのラインで tolerance が不足し、
  // 同一行の左右ブロックが別グループに分離してしまう問題を防ぐ。
  //   例: 商品行 height=16 → tolerance=max(16×0.6,8)=9.6px
  //       合計行 height=32 → tolerance=max(32×0.6,8)=19.2px
  // refTop を平均に更新することで累積ドリフトも防ぐ。
  const groups = [];
  for (const line of allLines) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup) {
      const groupMaxH = Math.max(...lastGroup.lines.map(l => l.height));
      const localTolerance = Math.max(groupMaxH * 0.6, 8);
      // 新しい行が現グループの最大高さの 1.5 倍以上の場合（例: 小フォントの(税合計)行の直後に
      // 大フォントの合計行が来るケース）、厳格なトレランスを適用して誤マージを防ぐ。
      // 同一行内の左右ブロック（同程度のフォントサイズ）には影響しない。
      const isNewLineMuchTaller = line.height > groupMaxH * 1.5;
      const effectiveTolerance = isNewLineMuchTaller
        ? Math.max(groupMaxH * 0.3, 4)
        : localTolerance;
      if (line.top - lastGroup.refTop <= effectiveTolerance) {
        lastGroup.lines.push(line);
        lastGroup.refTop =
          lastGroup.lines.reduce((s, l) => s + l.top, 0) / lastGroup.lines.length;
        continue;
      }
    }
    groups.push({ refTop: line.top, lines: [line] });
  }

  // 各グループを left（X座標）でソートし、視覚ギャップで結合文字を決定する。
  //
  // ギャップ判定:
  //   gap = next.left - prev.right（前ラインの右端と次ラインの左端の差）
  //   gap >= avgHeight × 0.8 → 列区切り("  ") ← receiptParser の \s{2,} にマッチ
  //   gap <  avgHeight × 0.8 → 語内隙間(" ")
  //
  // width=0（frame なし）のフォールバック: 従来通り一律 "  " で結合。
  return groups
    .map((group) => {
      const sorted = group.lines.sort((a, b) => a.left - b.left);
      if (sorted.length === 1) return sorted[0].text;

      const avgHeight =
        sorted.reduce((s, l) => s + l.height, 0) / sorted.length;
      const colGapThreshold = avgHeight * 0.8;

      let result = sorted[0].text;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        // width が不明（0）の場合は安全のため列区切りとして扱う
        const gap = prev.width > 0 ? curr.left - prev.right : colGapThreshold;
        result += gap >= colGapThreshold ? "  " : " ";
        result += curr.text;
      }
      return result;
    })
    .join("\n");
}
