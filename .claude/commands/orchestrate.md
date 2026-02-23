# オーケストレートコマンド

複雑なタスク向けの順次エージェントワークフロー。

## 使用方法

`/orchestrate [workflow-type] [task-description]`

## ワークフロータイプ

### feature
完全な機能実装ワークフロー：
```
planner -> tdd-guide -> code-reviewer -> security-reviewer
```

### bugfix
バグ調査と修正ワークフロー：
```
explorer -> tdd-guide -> code-reviewer
```

### refactor
安全なリファクタリングワークフロー：
```
architect -> code-reviewer -> tdd-guide
```

### security
セキュリティ重視のレビュー：
```
security-reviewer -> code-reviewer -> architect
```

## 実行パターン

ワークフロー内の各エージェントについて：

1. **エージェントを呼び出し** - 前のエージェントからのコンテキストを渡す
2. **出力を収集** - 構造化された引き継ぎドキュメントとして
3. **次のエージェントに渡す** - チェーン内の次のエージェントへ
4. **結果を集約** - 最終レポートにまとめる

## 引き継ぎドキュメント形式

エージェント間で引き継ぎドキュメントを作成：

```markdown
## 引き継ぎ: [前のエージェント] -> [次のエージェント]

### コンテキスト
[実施した内容のサマリー]

### 発見事項
[主要な発見または決定事項]

### 変更したファイル
[変更したファイルのリスト]

### 未解決の質問
[次のエージェントへの未解決項目]

### 推奨事項
[推奨される次のステップ]
```

## 例：機能ワークフロー

```
/orchestrate feature "ユーザー認証を追加"
```

実行内容：

1. **Plannerエージェント**
   - 要件を分析
   - 実装計画を作成
   - 依存関係を特定
   - 出力: `引き継ぎ: planner -> tdd-guide`

2. **TDD Guideエージェント**
   - Plannerの引き継ぎを読み込み
   - 最初にテストを作成
   - テストをパスするよう実装
   - 出力: `引き継ぎ: tdd-guide -> code-reviewer`

3. **Code Reviewerエージェント**
   - 実装をレビュー
   - 問題点をチェック
   - 改善を提案
   - 出力: `引き継ぎ: code-reviewer -> security-reviewer`

4. **Security Reviewerエージェント**
   - セキュリティ監査
   - 脆弱性チェック
   - 最終承認
   - 出力: 最終レポート

## 最終レポート形式

```
オーケストレーションレポート
============================
ワークフロー: feature
タスク: ユーザー認証を追加
エージェント: planner -> tdd-guide -> code-reviewer -> security-reviewer

サマリー
--------
[1段落のサマリー]

エージェント出力
----------------
Planner: [サマリー]
TDD Guide: [サマリー]
Code Reviewer: [サマリー]
Security Reviewer: [サマリー]

変更ファイル
------------
[変更したすべてのファイルのリスト]

テスト結果
----------
[テストのパス/失敗サマリー]

セキュリティステータス
----------------------
[セキュリティの発見事項]

推奨事項
--------
[リリース可 / 要修正 / ブロック]
```

## 並列実行

独立したチェックの場合、エージェントを並列実行：

```markdown
### 並列フェーズ
同時実行：
- code-reviewer（品質）
- security-reviewer（セキュリティ）
- architect（設計）

### 結果のマージ
出力を単一のレポートに統合
```

## 引数

$ARGUMENTS:
- `feature <description>` - 完全機能ワークフロー
- `bugfix <description>` - バグ修正ワークフロー
- `refactor <description>` - リファクタリングワークフロー
- `security <description>` - セキュリティレビューワークフロー
- `custom <agents> <description>` - カスタムエージェントシーケンス

## カスタムワークフロー例

```
/orchestrate custom "architect,tdd-guide,code-reviewer" "キャッシュレイヤーを再設計"
```

## ヒント

1. **複雑な機能はPlannerから開始**
2. **マージ前は必ずcode-reviewerを含める**
3. **認証/決済/個人情報にはsecurity-reviewerを使用**
4. **引き継ぎは簡潔に** - 次のエージェントに必要な情報に焦点
5. **必要に応じてエージェント間で検証を実行**
