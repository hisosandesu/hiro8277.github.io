# エージェントオーケストレーション

## 利用可能なエージェント

`~/.claude/agents/`にあります：

| エージェント | 目的 | 使用タイミング |
|-------------|------|---------------|
| planner | 実装計画 | 複雑な機能、リファクタリング |
| architect | システム設計 | アーキテクチャの決定 |
| tdd-guide | テスト駆動開発 | 新機能、バグ修正 |
| code-reviewer | コードレビュー | コード作成後 |
| security-reviewer | セキュリティ分析 | コミット前 |
| build-error-resolver | ビルドエラー修正 | ビルド失敗時 |
| e2e-runner | E2Eテスト | 重要なユーザーフロー |
| refactor-cleaner | デッドコード削除 | コードメンテナンス |
| doc-updater | ドキュメント | ドキュメント更新 |

### React Native 専用エージェント

| エージェント | 目的 | 使用タイミング |
|-------------|------|---------------|
| rn-performance-optimizer | RNパフォーマンス最適化 | FlatList、アニメーション、レンダリング最適化 |
| rn-navigation-expert | ナビゲーション設計 | 画面遷移、Deep Linking、認証フロー |
| expo-specialist | Expo SDK / EAS | ビルド、パーミッション、OTAアップデート |
| rn-accessibility-reviewer | アクセシビリティ | VoiceOver/TalkBack対応、WCAG準拠 |
| rn-native-bridge | ネイティブ連携 | TurboModules、JSI、Platform固有コード |
| rn-security-auditor | RNセキュリティ監査 | ストレージ、認証、Deep Link、ネットワーク |

## 即座のエージェント使用

ユーザープロンプト不要：
1. 複雑な機能リクエスト - **planner**エージェントを使用
2. コード作成/変更直後 - **code-reviewer**エージェントを使用
3. バグ修正または新機能 - **tdd-guide**エージェントを使用
4. アーキテクチャの決定 - **architect**エージェントを使用

## 並列タスク実行

独立した操作には常に並列Task実行を使用：

```markdown
# 良い例: 並列実行
3つのエージェントを並列起動：
1. エージェント1: auth.tsのセキュリティ分析
2. エージェント2: キャッシュシステムのパフォーマンスレビュー
3. エージェント3: utils.tsの型チェック

# 悪い例: 不必要な順次実行
まずエージェント1、次にエージェント2、次にエージェント3
```

## 多角的分析

複雑な問題には、役割分担したサブエージェントを使用：
- 事実確認者
- シニアエンジニア
- セキュリティエキスパート
- 一貫性レビューア
- 冗長性チェッカー
