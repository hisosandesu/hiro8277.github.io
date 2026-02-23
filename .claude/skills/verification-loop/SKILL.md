# 検証ループスキル

Claude Codeセッション向けの包括的な検証システム。

## 使用タイミング

このスキルを呼び出す：
- 機能または重要なコード変更完了後
- PR作成前
- 品質ゲートのパスを確認したい時
- リファクタリング後

## 検証フェーズ

### フェーズ1: ビルド検証
```bash
# プロジェクトがビルドできるか確認
npm run build 2>&1 | tail -20
# または
pnpm build 2>&1 | tail -20
```

ビルドが失敗した場合、停止して続行前に修正。

### フェーズ2: 型チェック
```bash
# TypeScriptプロジェクト
npx tsc --noEmit 2>&1 | head -30

# Pythonプロジェクト
pyright . 2>&1 | head -30
```

すべての型エラーをレポート。続行前に重大なものを修正。

### フェーズ3: Lintチェック
```bash
# JavaScript/TypeScript
npm run lint 2>&1 | head -30

# Python
ruff check . 2>&1 | head -30
```

### フェーズ4: テストスイート
```bash
# カバレッジ付きテスト実行
npm run test -- --coverage 2>&1 | tail -50

# カバレッジ閾値を確認
# 目標: 最低80%
```

レポート：
- 総テスト数: X
- パス: X
- 失敗: X
- カバレッジ: X%

### フェーズ5: セキュリティスキャン
```bash
# シークレットをチェック
grep -rn "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# console.logをチェック
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | head -10
```

### フェーズ6: 差分レビュー
```bash
# 変更内容を表示
git diff --stat
git diff HEAD~1 --name-only
```

各変更ファイルをレビュー：
- 意図しない変更
- 欠落しているエラーハンドリング
- 潜在的なエッジケース

## 出力形式

すべてのフェーズ実行後、検証レポートを生成：

```
検証レポート
============

ビルド:      [PASS/FAIL]
型:          [PASS/FAIL] (Xエラー)
Lint:        [PASS/FAIL] (X警告)
テスト:      [PASS/FAIL] (X/Yパス, Z%カバレッジ)
セキュリティ: [PASS/FAIL] (X問題)
差分:        [Xファイル変更]

総合:        [準備完了/未完了] PR作成

修正すべき問題：
1. ...
2. ...
```

## 継続モード

長いセッションでは、15分ごとまたは大きな変更後に検証を実行：

```markdown
メンタルチェックポイントを設定：
- 各関数完了後
- コンポーネント完成後
- 次のタスクに移動前

実行: /verify
```

## フックとの統合

このスキルはPostToolUseフックを補完しますが、より深い検証を提供します。
フックは問題を即座にキャッチ。このスキルは包括的なレビューを提供。
