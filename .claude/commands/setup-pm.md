---
description: 優先パッケージマネージャー（npm/pnpm/yarn/bun）を設定
disable-model-invocation: true
---

# パッケージマネージャー設定

このプロジェクトまたはグローバルで優先するパッケージマネージャーを設定します。

## 使用方法

```bash
# 現在のパッケージマネージャーを検出
node scripts/setup-package-manager.js --detect

# グローバル設定を変更
node scripts/setup-package-manager.js --global pnpm

# プロジェクト設定を変更
node scripts/setup-package-manager.js --project bun

# 利用可能なパッケージマネージャーを一覧表示
node scripts/setup-package-manager.js --list
```

## 検出の優先順位

使用するパッケージマネージャーを決定する際、以下の順序で確認されます：

1. **環境変数**: `CLAUDE_PACKAGE_MANAGER`
2. **プロジェクト設定**: `.claude/package-manager.json`
3. **package.json**: `packageManager`フィールド
4. **ロックファイル**: package-lock.json、yarn.lock、pnpm-lock.yaml、またはbun.lockbの存在
5. **グローバル設定**: `~/.claude/package-manager.json`
6. **フォールバック**: 最初に見つかったパッケージマネージャー（pnpm > bun > yarn > npm）

## 設定ファイル

### グローバル設定
```json
// ~/.claude/package-manager.json
{
  "packageManager": "pnpm"
}
```

### プロジェクト設定
```json
// .claude/package-manager.json
{
  "packageManager": "bun"
}
```

### package.json
```json
{
  "packageManager": "pnpm@8.6.0"
}
```

## 環境変数

`CLAUDE_PACKAGE_MANAGER`を設定すると、他のすべての検出方法を上書きします：

```bash
# Windows (PowerShell)
$env:CLAUDE_PACKAGE_MANAGER = "pnpm"

# macOS/Linux
export CLAUDE_PACKAGE_MANAGER=pnpm
```

## 検出の実行

現在のパッケージマネージャー検出結果を確認するには：

```bash
node scripts/setup-package-manager.js --detect
```
