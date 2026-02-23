# コーディングスタイル

## イミュータビリティ（重要）

常に新しいオブジェクトを作成、絶対にミューテートしない：

```javascript
// 悪い例: ミューテーション
function updateUser(user, name) {
  user.name = name  // ミューテーション！
  return user
}

// 良い例: イミュータビリティ
function updateUser(user, name) {
  return {
    ...user,
    name
  }
}
```

## ファイル構成

小さいファイルを多く > 大きいファイルを少なく：
- 高凝集、低結合
- 通常200-400行、最大800行
- 大きなコンポーネントからユーティリティを抽出
- タイプ別ではなく、機能/ドメイン別に整理

## エラーハンドリング

常に包括的にエラーを処理：

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('操作に失敗しました:', error)
  throw new Error('詳細なユーザーフレンドリーメッセージ')
}
```

## 入力検証

常にユーザー入力を検証：

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

const validated = schema.parse(input)
```

## コード品質チェックリスト

作業完了前に：
- [ ] コードが読みやすく、命名が適切
- [ ] 関数が小さい（50行未満）
- [ ] ファイルが焦点を絞っている（800行未満）
- [ ] 深いネストがない（4レベル以上）
- [ ] 適切なエラーハンドリング
- [ ] console.log文がない
- [ ] ハードコードされた値がない
- [ ] ミューテーションがない（イミュータブルパターンを使用）
