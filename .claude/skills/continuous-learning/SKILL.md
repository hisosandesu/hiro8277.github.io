---
name: continuous-learning
description: Claude Codeセッションから再利用可能なパターンを自動抽出し、将来使用するための学習スキルとして保存します。
---

# 継続学習スキル

セッション終了時にClaude Codeセッションを自動評価し、学習スキルとして保存可能な再利用パターンを抽出します。

## 動作の仕組み

このスキルは各セッション終了時に**Stopフック**として実行されます：

1. **セッション評価**: セッションに十分なメッセージがあるか確認（デフォルト: 10+）
2. **パターン検出**: セッションから抽出可能なパターンを特定
3. **スキル抽出**: 有用なパターンを`~/.claude/skills/learned/`に保存

## 設定

`config.json`を編集してカスタマイズ：

```json
{
  "min_session_length": 10,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": "~/.claude/skills/learned/",
  "patterns_to_detect": [
    "error_resolution",
    "user_corrections",
    "workarounds",
    "debugging_techniques",
    "project_specific"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues"
  ]
}
```

## パターンタイプ

| パターン | 説明 |
|---------|------|
| `error_resolution` | 特定のエラーがどのように解決されたか |
| `user_corrections` | ユーザー訂正からのパターン |
| `workarounds` | フレームワーク/ライブラリの癖に対する解決策 |
| `debugging_techniques` | 効果的なデバッグアプローチ |
| `project_specific` | プロジェクト固有の規約 |

## フック設定

`~/.claude/settings.json`に追加：

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "~/.claude/skills/continuous-learning/evaluate-session.sh"
      }]
    }]
  }
}
```

## なぜStopフックなのか？

- **軽量**: セッション終了時に1回だけ実行
- **ノンブロッキング**: すべてのメッセージにレイテンシを追加しない
- **完全なコンテキスト**: 完全なセッショントランスクリプトにアクセス可能

## 関連

- [The Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - 継続学習のセクション
- `/learn`コマンド - セッション中の手動パターン抽出
