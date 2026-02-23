# フックシステム

## フックタイプ

- **PreToolUse**: ツール実行前（検証、パラメータ変更）
- **PostToolUse**: ツール実行後（自動フォーマット、チェック）
- **Stop**: セッション終了時（最終検証）

## 現在のフック（~/.claude/settings.json内）

### PreToolUse
- **tmuxリマインダー**: 長時間実行コマンドにtmuxを提案（npm、pnpm、yarn、cargoなど）
- **gitプッシュレビュー**: プッシュ前にZedでレビューを開く
- **ドキュメントブロッカー**: 不要な.md/.txtファイルの作成をブロック

### PostToolUse
- **PR作成**: PR URLとGitHub Actionsステータスをログ
- **Prettier**: 編集後にJS/TSファイルを自動フォーマット
- **TypeScriptチェック**: .ts/.tsxファイル編集後にtscを実行
- **console.log警告**: 編集ファイル内のconsole.logを警告

### Stop
- **console.log監査**: セッション終了前にすべての変更ファイルでconsole.logをチェック

## 自動承認パーミッション

慎重に使用：
- 信頼された、明確に定義された計画で有効化
- 探索的な作業では無効化
- dangerously-skip-permissionsフラグは絶対に使用しない
- 代わりに`~/.claude.json`で`allowedTools`を設定

## TodoWriteベストプラクティス

TodoWriteツールの使用目的：
- マルチステップタスクの進捗を追跡
- 指示の理解を確認
- リアルタイムのステアリングを可能に
- 詳細な実装ステップを表示

Todoリストで明らかになること：
- 順序が間違ったステップ
- 欠落している項目
- 不要な追加項目
- 間違った粒度
- 誤解された要件
