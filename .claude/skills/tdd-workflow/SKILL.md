---
name: tdd-workflow
description: 新機能の作成、バグ修正、リファクタリング時に使用。ユニット、統合、E2Eテストを含む80%以上のカバレッジでテスト駆動開発を強制します。
---

# テスト駆動開発ワークフロー

このスキルは、すべてのコード開発が包括的なテストカバレッジを持つTDD原則に従うことを保証します。

## 有効化タイミング

- 新機能や機能の作成時
- バグや問題の修正時
- 既存コードのリファクタリング時
- APIエンドポイントの追加時
- 新しいコンポーネントの作成時

## 核となる原則

### 1. コードの前にテスト
常に最初にテストを書き、その後テストをパスするコードを実装。

### 2. カバレッジ要件
- 最低80%カバレッジ（ユニット + 統合 + E2E）
- すべてのエッジケースをカバー
- エラーシナリオをテスト
- 境界条件を検証

### 3. テストタイプ

#### ユニットテスト
- 個々の関数とユーティリティ
- コンポーネントロジック
- 純粋関数
- ヘルパーとユーティリティ

#### 統合テスト
- APIエンドポイント
- データベース操作
- サービス間連携
- 外部API呼び出し

#### E2Eテスト（Playwright）
- 重要なユーザーフロー
- 完全なワークフロー
- ブラウザ自動化
- UI操作

## TDDワークフローステップ

### ステップ1: ユーザージャーニーを書く
```
[役割]として、[アクション]したい、なぜなら[利益]だから

例：
ユーザーとして、マーケットをセマンティック検索したい、
なぜなら正確なキーワードがなくても関連マーケットを見つけられるから。
```

### ステップ2: テストケースを生成
各ユーザージャーニーに対して包括的なテストケースを作成：

```typescript
describe('セマンティック検索', () => {
  it('クエリに関連するマーケットを返す', async () => {
    // テスト実装
  })

  it('空のクエリを適切に処理する', async () => {
    // エッジケースをテスト
  })

  it('Redis利用不可時は部分文字列検索にフォールバック', async () => {
    // フォールバック動作をテスト
  })

  it('類似度スコアで結果をソート', async () => {
    // ソートロジックをテスト
  })
})
```

### ステップ3: テストを実行（失敗するはず）
```bash
npm test
# テストは失敗するはず - まだ実装していない
```

### ステップ4: コードを実装
テストをパスする最小限のコードを書く：

```typescript
// テストに導かれた実装
export async function searchMarkets(query: string) {
  // 実装をここに
}
```

### ステップ5: テストを再実行
```bash
npm test
# テストはパスするはず
```

### ステップ6: リファクタリング
テストをグリーンに保ちながらコード品質を改善：
- 重複を削除
- 命名を改善
- パフォーマンスを最適化
- 可読性を向上

### ステップ7: カバレッジを確認
```bash
npm run test:coverage
# 80%以上のカバレッジを確認
```

## テストパターン

### ユニットテストパターン（Jest/Vitest）
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Buttonコンポーネント', () => {
  it('正しいテキストでレンダリングする', () => {
    render(<Button>クリック</Button>)
    expect(screen.getByText('クリック')).toBeInTheDocument()
  })

  it('クリック時にonClickを呼び出す', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>クリック</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disabled propがtrueの時に無効化される', () => {
    render(<Button disabled>クリック</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### API統合テストパターン
```typescript
import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /api/markets', () => {
  it('マーケットを正常に返す', async () => {
    const request = new NextRequest('http://localhost/api/markets')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('クエリパラメータをバリデート', async () => {
    const request = new NextRequest('http://localhost/api/markets?limit=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('データベースエラーを適切に処理', async () => {
    // データベース失敗をモック
    const request = new NextRequest('http://localhost/api/markets')
    // エラーハンドリングをテスト
  })
})
```

### E2Eテストパターン（Playwright）
```typescript
import { test, expect } from '@playwright/test'

test('ユーザーがマーケットを検索・フィルタリングできる', async ({ page }) => {
  // マーケットページに移動
  await page.goto('/')
  await page.click('a[href="/markets"]')

  // ページ読み込みを確認
  await expect(page.locator('h1')).toContainText('マーケット')

  // マーケットを検索
  await page.fill('input[placeholder="マーケットを検索"]', 'election')

  // デバウンスと結果を待つ
  await page.waitForTimeout(600)

  // 検索結果が表示されることを確認
  const results = page.locator('[data-testid="market-card"]')
  await expect(results).toHaveCount(5, { timeout: 5000 })

  // 結果が検索語を含むことを確認
  const firstResult = results.first()
  await expect(firstResult).toContainText('election', { ignoreCase: true })

  // ステータスでフィルタリング
  await page.click('button:has-text("アクティブ")')

  // フィルタリング結果を確認
  await expect(results).toHaveCount(3)
})

test('ユーザーが新しいマーケットを作成できる', async ({ page }) => {
  // まずログイン
  await page.goto('/creator-dashboard')

  // マーケット作成フォームに入力
  await page.fill('input[name="name"]', 'テストマーケット')
  await page.fill('textarea[name="description"]', 'テスト説明')
  await page.fill('input[name="endDate"]', '2025-12-31')

  // フォームを送信
  await page.click('button[type="submit"]')

  // 成功メッセージを確認
  await expect(page.locator('text=マーケットが正常に作成されました')).toBeVisible()

  // マーケットページへのリダイレクトを確認
  await expect(page).toHaveURL(/\/markets\/test-market/)
})
```

## テストファイルの構成

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx          # ユニットテスト
│   │   └── Button.stories.tsx       # Storybook
│   └── MarketCard/
│       ├── MarketCard.tsx
│       └── MarketCard.test.tsx
├── app/
│   └── api/
│       └── markets/
│           ├── route.ts
│           └── route.test.ts         # 統合テスト
└── e2e/
    ├── markets.spec.ts               # E2Eテスト
    ├── trading.spec.ts
    └── auth.spec.ts
```

## 外部サービスのモック

### Supabaseモック
```typescript
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{ id: 1, name: 'テストマーケット' }],
          error: null
        }))
      }))
    }))
  }
}))
```

### Redisモック
```typescript
jest.mock('@/lib/redis', () => ({
  searchMarketsByVector: jest.fn(() => Promise.resolve([
    { slug: 'test-market', similarity_score: 0.95 }
  ])),
  checkRedisHealth: jest.fn(() => Promise.resolve({ connected: true }))
}))
```

### OpenAIモック
```typescript
jest.mock('@/lib/openai', () => ({
  generateEmbedding: jest.fn(() => Promise.resolve(
    new Array(1536).fill(0.1) // 1536次元埋め込みをモック
  ))
}))
```

## テストカバレッジの確認

### カバレッジレポートを実行
```bash
npm run test:coverage
```

### カバレッジ閾値
```json
{
  "jest": {
    "coverageThresholds": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## 避けるべきよくあるテストの間違い

### ❌ 間違い: 実装詳細をテスト
```typescript
// 内部状態をテストしない
expect(component.state.count).toBe(5)
```

### ✅ 正解: ユーザーに見える動作をテスト
```typescript
// ユーザーが見るものをテスト
expect(screen.getByText('カウント: 5')).toBeInTheDocument()
```

### ❌ 間違い: 壊れやすいセレクタ
```typescript
// 簡単に壊れる
await page.click('.css-class-xyz')
```

### ✅ 正解: セマンティックセレクタ
```typescript
// 変更に強い
await page.click('button:has-text("送信")')
await page.click('[data-testid="submit-button"]')
```

### ❌ 間違い: テスト分離なし
```typescript
// テストが互いに依存
test('ユーザーを作成', () => { /* ... */ })
test('同じユーザーを更新', () => { /* 前のテストに依存 */ })
```

### ✅ 正解: 独立したテスト
```typescript
// 各テストが独自のデータを準備
test('ユーザーを作成', () => {
  const user = createTestUser()
  // テストロジック
})

test('ユーザーを更新', () => {
  const user = createTestUser()
  // 更新ロジック
})
```

## 継続的テスト

### 開発中のウォッチモード
```bash
npm test -- --watch
# ファイル変更時に自動でテスト実行
```

### プレコミットフック
```bash
# すべてのコミット前に実行
npm test && npm run lint
```

### CI/CD統合
```yaml
# GitHub Actions
- name: テストを実行
  run: npm test -- --coverage
- name: カバレッジをアップロード
  uses: codecov/codecov-action@v3
```

## ベストプラクティス

1. **テストを先に書く** - 常にTDD
2. **テストごとに1アサート** - 単一の動作に焦点
3. **説明的なテスト名** - 何をテストしているか説明
4. **Arrange-Act-Assert** - 明確なテスト構造
5. **外部依存をモック** - ユニットテストを分離
6. **エッジケースをテスト** - null、undefined、空、大きな値
7. **エラーパスをテスト** - ハッピーパスだけでなく
8. **テストを高速に** - ユニットテストは各50ms未満
9. **テスト後にクリーンアップ** - 副作用なし
10. **カバレッジレポートをレビュー** - ギャップを特定

## 成功指標

- 80%以上のコードカバレッジ達成
- すべてのテストがパス（グリーン）
- スキップや無効化されたテストなし
- 高速なテスト実行（ユニットテストは30秒未満）
- E2Eテストが重要なユーザーフローをカバー
- テストが本番前にバグをキャッチ

---

**覚えておくこと**: テストはオプションではありません。自信を持ったリファクタリング、迅速な開発、本番環境の信頼性を可能にするセーフティネットです。
