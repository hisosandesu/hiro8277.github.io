---
name: dexie-patterns
description: Dexie.js（IndexedDBラッパー）のベストプラクティス、パターン、TypeScript統合、React hooks、liveQueryの使用方法。オフラインファースト開発に使用。
---

# Dexie.js ベストプラクティスとパターン

Dexie.jsを使用したIndexedDB開発のための包括的なガイド。

## 基本セットアップ

### TypeScriptでのデータベース定義

```typescript
// db.ts - シンプルな例
import { Dexie, type EntityTable } from "dexie"

interface Friend {
  id: number        // 主キー
  name: string
  age: number
  email?: string    // オプショナルプロパティ
}

const db = new Dexie("FriendsDatabase") as Dexie & {
  friends: EntityTable<Friend, "id">
}

db.version(1).stores({
  friends: "++id, name, age, email"  // ++id = 自動インクリメント主キー
})

export type { Friend }
export { db }
```

### マップされたクラスを使用する例

```typescript
// AppDB.ts
import { Dexie, type EntityTable } from "dexie"
import Friend from "./Friend"

export default class AppDB extends Dexie {
  friends!: EntityTable<Friend, "id">

  constructor() {
    super("FriendsDB")
    this.version(1).stores({
      friends: "++id, name, age"
    })
    this.friends.mapToClass(Friend)
  }
}

// Friend.ts
import { Entity } from "dexie"
import type AppDB from "./AppDB"

export default class Friend extends Entity<AppDB> {
  id!: number
  name!: string
  age!: number

  // DBにアクセスするメソッド例
  async birthday() {
    await this.db.friends.update(this.id, (friend) => ++friend.age)
  }
}

// db.ts
import AppDB from "./AppDB"
export const db = new AppDB()
```

## インデックス定義構文

```typescript
db.version(1).stores({
  // ++  = 自動インクリメント主キー
  // &   = ユニークインデックス
  // *   = マルチエントリインデックス（配列用）
  // [a+b] = 複合インデックス

  friends: "++id, name, age, *tags, [firstName+lastName]",
  messages: "++id, date, conversationId, [conversationId+date]"
})
```

## Promiseのベストプラクティス

### 正しいPromiseの扱い方

```typescript
// ✅ 良い例: Promiseを返す
function getFriends() {
  return db.friends.where('age').above(18).toArray()
}

// ✅ 良い例: async/await
async function getFriendById(id: number) {
  return await db.friends.get(id)
}

// ❌ 悪い例: catchしてログするだけ
function badExample() {
  return db.friends.add({ name: 'foo', age: 20 })
    .catch(err => {
      console.log(err)  // 呼び出し元はエラーを知らない！
    })
}

// ✅ 良い例: エラーを再スロー
function goodExample() {
  return db.friends.add({ name: 'foo', age: 20 })
    .catch(err => {
      console.error("追加に失敗:", err)
      throw err  // 再スロー！
    })
}
```

### トップレベルでのみキャッチ

```typescript
// イベントハンドラー等のトップレベルでキャッチ
async function handleSubmit() {
  try {
    await addFriend({ name: 'John', age: 25 })
    showSuccess("友達を追加しました")
  } catch (error) {
    showError("追加に失敗しました: " + error)
  }
}
```

## トランザクション

### トランザクションを使う理由

1. **原子性**: エラー時にロールバック
2. **パフォーマンス**: 複数操作を1つにまとめる
3. **一貫性**: ブラウザ終了時も安全
4. **シンプルさ**: 1箇所でエラーハンドリング

### トランザクションの基本

```typescript
// ✅ 良い例: トランザクションを使用
await db.transaction('rw', db.friends, db.pets, async () => {
  const friendId = await db.friends.add({ name: 'John', age: 25 })
  await db.pets.add({ name: 'Rex', ownerId: friendId })
  // エラーが発生したら両方ロールバック
})

// 'rw' = 読み書き, 'r' = 読み取りのみ
```

### トランザクション内での注意

```typescript
// ❌ 悪い例: トランザクション内で他の非同期APIを待つ
await db.transaction('rw', db.friends, async () => {
  const response = await fetch('/api/data')  // トランザクションが死ぬ！
  await db.friends.add(await response.json())
})

// ✅ 良い例: トランザクション外でfetch
const data = await fetch('/api/data').then(r => r.json())
await db.transaction('rw', db.friends, async () => {
  await db.friends.add(data)
})

// ✅ どうしても必要な場合: Dexie.waitFor()を使用（短い操作のみ）
await db.transaction('rw', db.friends, async () => {
  const hash = await Dexie.waitFor(
    crypto.subtle.digest('SHA-256', buffer)
  )
  await db.friends.update(id, { hash })
})
```

### エラー時の再スロー

```typescript
// ✅ トランザクションをアボートするには再スローが必須
await db.transaction('rw', db.friends, async () => {
  try {
    await db.friends.add({ name: 'John', age: 25 })
  } catch (error) {
    console.error("追加に失敗:", error)
    throw error  // 再スローしないとトランザクションがコミットされる！
  }
})
```

## liveQuery() - リアクティブクエリ

### 基本的な使い方

```typescript
import { liveQuery } from 'dexie'

// ObservableとしてDB変更を監視
const friendsObservable = liveQuery(
  () => db.friends.where('age').between(20, 30).toArray()
)

const subscription = friendsObservable.subscribe({
  next: (friends) => console.log('更新:', friends),
  error: (error) => console.error(error)
})

// 解除
subscription.unsubscribe()
```

### liveQueryのルール

```typescript
// ❌ 悪い例: 非Dexie APIを直接await
const observable = liveQuery(async () => {
  const friends = await db.friends.toArray()
  const meta = await fetch('/api/meta').then(r => r.json())  // 観測が壊れる
  return { friends, meta }
})

// ✅ 良い例: Dexie.waitFor()でラップ
const observable = liveQuery(async () => {
  const friends = await db.friends.toArray()
  const meta = await Dexie.waitFor(
    fetch('/api/meta').then(r => r.json())
  )
  return { friends, meta }
})
```

## React統合 - useLiveQuery()

### 基本的な使い方

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

function FriendList() {
  const friends = useLiveQuery(
    () => db.friends.where('age').above(18).toArray()
  )

  if (!friends) return <div>読み込み中...</div>

  return (
    <ul>
      {friends.map(friend => (
        <li key={friend.id}>{friend.name}, {friend.age}</li>
      ))}
    </ul>
  )
}
```

### 依存配列を使用

```typescript
function FriendList({ minAge }: { minAge: number }) {
  // minAgeが変わるとクエリが再実行される
  const friends = useLiveQuery(
    () => db.friends.where('age').above(minAge).toArray(),
    [minAge]  // deps配列（useEffectと同様）
  )

  if (!friends) return null

  return (
    <ul>
      {friends.map(friend => (
        <li key={friend.id}>{friend.name}</li>
      ))}
    </ul>
  )
}
```

### デフォルト値を設定

```typescript
function FriendCount() {
  // 第3引数でデフォルト値を設定
  const count = useLiveQuery(
    () => db.friends.count(),
    [],
    0  // ローディング中は0を返す
  )

  return <span>友達の数: {count}</span>
}
```

### 複数のクエリを組み合わせる

```typescript
function Dashboard() {
  const data = useLiveQuery(async () => {
    const [friends, total, activeCount] = await Promise.all([
      db.friends.limit(10).toArray(),
      db.friends.count(),
      db.friends.where('status').equals('active').count()
    ])
    return { friends, total, activeCount }
  })

  if (!data) return <div>読み込み中...</div>

  return (
    <div>
      <p>合計: {data.total}, アクティブ: {data.activeCount}</p>
      <ul>
        {data.friends.map(f => <li key={f.id}>{f.name}</li>)}
      </ul>
    </div>
  )
}
```

### 非Dexie APIの呼び出し

```typescript
function FriendWithMeta({ id }: { id: number }) {
  const friend = useLiveQuery(async () => {
    const friend = await db.friends.get(id)
    if (!friend) return null

    // 非Dexie APIはPromise.resolve()でラップ
    const meta = await Promise.resolve(
      fetch(`/api/friends/${id}/meta`).then(r => r.json())
    )

    return { ...friend, meta }
  }, [id])

  if (!friend) return null

  return <div>{friend.name} - {friend.meta?.status}</div>
}
```

## CRUD操作

### 作成（Create）

```typescript
// 単一追加
const id = await db.friends.add({ name: 'John', age: 25 })

// バルク追加
const ids = await db.friends.bulkAdd([
  { name: 'John', age: 25 },
  { name: 'Jane', age: 30 }
])

// put: キーがあれば更新、なければ追加
await db.friends.put({ id: 1, name: 'John', age: 26 })

// bulkPut
await db.friends.bulkPut([
  { id: 1, name: 'John', age: 26 },
  { id: 2, name: 'Jane', age: 31 }
])
```

### 読み取り（Read）

```typescript
// IDで取得
const friend = await db.friends.get(1)

// 条件で取得
const adults = await db.friends.where('age').above(18).toArray()

// 複合条件
const results = await db.friends
  .where('age').between(20, 30)
  .and(f => f.name.startsWith('J'))
  .toArray()

// 最初の1件
const first = await db.friends.where('age').above(18).first()

// カウント
const count = await db.friends.where('status').equals('active').count()

// ソート
const sorted = await db.friends.orderBy('age').toArray()
const desc = await db.friends.orderBy('age').reverse().toArray()

// ページネーション
const page = await db.friends.offset(10).limit(10).toArray()
```

### 更新（Update）

```typescript
// IDで更新
await db.friends.update(1, { age: 26 })

// 条件で一括更新
await db.friends.where('status').equals('pending').modify({ status: 'active' })

// 関数で更新
await db.friends.where('status').equals('active').modify(friend => {
  friend.lastLogin = new Date()
})
```

### 削除（Delete）

```typescript
// IDで削除
await db.friends.delete(1)

// バルク削除
await db.friends.bulkDelete([1, 2, 3])

// 条件で削除
await db.friends.where('age').below(18).delete()

// 全削除
await db.friends.clear()
```

## クエリパターン

### WhereClause

```typescript
// 等価
db.friends.where('name').equals('John')

// 範囲
db.friends.where('age').above(18)
db.friends.where('age').aboveOrEqual(18)
db.friends.where('age').below(65)
db.friends.where('age').belowOrEqual(65)
db.friends.where('age').between(18, 65)

// 複数値
db.friends.where('status').anyOf(['active', 'pending'])
db.friends.where('status').noneOf(['deleted', 'banned'])

// 前方一致
db.friends.where('name').startsWith('Jo')

// 大文字小文字無視
db.friends.where('name').equalsIgnoreCase('john')

// 複合インデックス
db.friends.where('[firstName+lastName]').equals(['John', 'Doe'])
```

### Collection操作

```typescript
// フィルター（インデックスなし）
db.friends.filter(f => f.name.includes('John'))

// and条件
db.friends.where('age').above(18).and(f => f.status === 'active')

// ソート（非インデックスカラム）
db.friends.toCollection().sortBy('createdAt')

// ユニーク
db.friends.orderBy('age').uniqueKeys()

// リミット
db.friends.limit(10)
db.friends.offset(20).limit(10)
```

## エラーハンドリング

### 一般的なエラー

```typescript
import { Dexie } from 'dexie'

try {
  await db.friends.add({ name: 'John', age: 25 })
} catch (error) {
  if (error instanceof Dexie.ConstraintError) {
    // ユニーク制約違反
    console.error('既に存在します')
  } else if (error instanceof Dexie.QuotaExceededError) {
    // ストレージ容量超過
    console.error('ストレージがいっぱいです')
  } else if (error instanceof Dexie.AbortError) {
    // トランザクションがアボート
    console.error('操作が中断されました')
  } else {
    throw error
  }
}
```

### BulkErrorの処理

```typescript
try {
  await db.friends.bulkAdd(items)
} catch (error) {
  if (error instanceof Dexie.BulkError) {
    console.log(`${error.failures.length}件のエラー:`, error.failures)
    // 成功した分は追加済み
  }
}
```

## パフォーマンス最適化

### インデックス設計

```typescript
// ✅ 良い例: 頻繁に検索するカラムにインデックス
db.version(1).stores({
  messages: "++id, date, conversationId, [conversationId+date]"
})

// 複合インデックスで効率的なクエリ
await db.messages
  .where('[conversationId+date]')
  .between([convId, startDate], [convId, endDate])
  .toArray()
```

### バルク操作を使用

```typescript
// ❌ 悪い例: ループで個別追加
for (const item of items) {
  await db.friends.add(item)  // 遅い！
}

// ✅ 良い例: バルク追加
await db.friends.bulkAdd(items)  // 高速！
```

### 必要なデータのみ取得

```typescript
// ❌ 悪い例: 全件取得してフィルター
const friends = await db.friends.toArray()
const adults = friends.filter(f => f.age > 18)

// ✅ 良い例: クエリでフィルター
const adults = await db.friends.where('age').above(18).toArray()
```

## Dexie Cloud統合

### セットアップ

```typescript
import { Dexie } from "dexie"
import dexieCloud, { type DexieCloudTable } from "dexie-cloud-addon"

class AppDB extends Dexie {
  friends!: DexieCloudTable<Friend, "id">

  constructor() {
    super("FriendsDB", { addons: [dexieCloud] })

    this.version(1).stores({
      friends: "@id, name, age"  // @id = グローバルユニークID
    })

    this.cloud.configure({
      databaseUrl: "https://xxxxxx.dexie.cloud"
    })
  }
}
```

### 認証

```typescript
// ログイン
await db.cloud.login()

// ログアウト
await db.cloud.logout()

// 現在のユーザー
const currentUser = db.cloud.currentUser
```

## チェックリスト

### 新しいDexieプロジェクト開始時

- [ ] EntityTableを使った型安全なテーブル定義
- [ ] 適切なインデックス設計
- [ ] エラーハンドリングの実装
- [ ] トランザクションの適切な使用

### Reactコンポーネント作成時

- [ ] useLiveQueryを使用してリアクティブに
- [ ] ローディング状態の処理
- [ ] エラーバウンダリの設定
- [ ] 依存配列の適切な設定

### パフォーマンス最適化時

- [ ] インデックスの確認
- [ ] バルク操作の使用
- [ ] 不要なクエリの削除
- [ ] トランザクションでの操作グループ化
