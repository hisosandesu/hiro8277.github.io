---
name: rn-performance
description: React Nativeパフォーマンス最適化パターン。FlatList、アニメーション、メモ化、メモリ管理のベストプラクティス。
---

# React Native パフォーマンス最適化パターン

React Native公式ドキュメント (reactnative.dev/docs/performance) に基づく最適化パターン集。

## フレームレートの基礎

- 目標: 60 FPS (16.67ms/フレーム)
- **JSスレッド**: ビジネスロジック、React、API呼び出し、タッチイベント
- **UIスレッド (メインスレッド)**: ネイティブアニメーション、スクロール描画
- 2つのスレッドは独立 — UIスレッドのアニメーションはJSスレッドのフレーム落ちの影響を受けない

## FlatList最適化

### 必須設定

```javascript
import { useCallback, memo } from 'react'
import { FlatList } from 'react-native'

// 1. リストアイテムをmemo化
const ListItem = memo(({ item }) => (
  <View style={styles.item}>
    <Text>{item.title}</Text>
  </View>
))

// 2. renderItemをuseCallbackで包む
const renderItem = useCallback(({ item }) => (
  <ListItem item={item} />
), [])

// 3. keyExtractorを設定
const keyExtractor = useCallback((item) => item.id, [])

// 4. getItemLayoutで固定高さを指定（非同期計測をスキップ）
const getItemLayout = useCallback((data, index) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
}), [])

function MyList({ data }) {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      // パフォーマンスチューニング
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={21}
      removeClippedSubviews={true}
    />
  )
}
```

### FlatListプロパティガイド

| プロパティ | デフォルト | 効果 | トレードオフ |
|-----------|----------|------|------------|
| `removeClippedSubviews` | Android:true | ビューポート外のビューを切り離し | iOS: コンテンツ欠落バグあり |
| `maxToRenderPerBatch` | 10 | バッチあたりレンダリング数 | 多い=空白減、JS負荷増 |
| `updateCellsBatchingPeriod` | 50ms | バッチ間の遅延 | 短い=空白減、応答性低下 |
| `initialNumToRender` | 10 | 初期レンダリング数 | 画面を埋める最小数に設定 |
| `windowSize` | 21 | マウント領域(ビューポート倍数) | 大=空白減、メモリ増 |

### 高性能代替リスト
- **FlashList** (@shopify/flash-list): 自動リサイクル、estimatedItemSizeのみ指定
- **Legend List** (legendapp/legend-list): 軽量・高性能

## アニメーション最適化

### useNativeDriver (必須)

```javascript
// ✅ ネイティブスレッドでアニメーション実行
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true, // 必須!
}).start()

// ✅ useNativeDriverで使用可能なプロパティ
// opacity, transform (translateX/Y, scale, rotate)

// ❌ useNativeDriverで使用不可
// width, height, backgroundColor, margin, padding
// → これらはLayoutAnimationまたはReanimatedを使用
```

### LayoutAnimation (シンプルなレイアウト変更)

```javascript
import { LayoutAnimation, UIManager, Platform } from 'react-native'

// Androidで有効化
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

function toggleExpand() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
  setExpanded(!expanded)
}
```

### react-native-reanimated (高度なアニメーション)

```javascript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated'

function AnimatedBox() {
  const offset = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(offset.value) }],
  }))

  return (
    <Animated.View style={[styles.box, animatedStyle]}>
      <Pressable onPress={() => { offset.value = offset.value + 50 }}>
        <Text>移動</Text>
      </Pressable>
    </Animated.View>
  )
}
```

### 画像アニメーション

```javascript
// ❌ 重い: サイズ変更でリクロップ発生
<Image style={{ width: animatedWidth, height: animatedHeight }} />

// ✅ 軽い: スケールはGPU処理
<Image style={{ transform: [{ scale: animatedScale }] }} />
```

## レンダリング最適化

### React.memo

```javascript
// ✅ 純粋コンポーネントをメモ化
const ExpensiveComponent = memo(({ data, onPress }) => {
  return (
    <View>
      <Text>{data.title}</Text>
      <Pressable onPress={onPress}><Text>実行</Text></Pressable>
    </View>
  )
})

// ✅ カスタム比較関数
const OptimizedItem = memo(
  ({ item }) => <Text>{item.title}</Text>,
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id
)
```

### useMemo / useCallback

```javascript
// ✅ 高コスト計算をメモ化
const filteredData = useMemo(() => {
  return data.filter(item => item.category === selectedCategory)
}, [data, selectedCategory])

// ✅ コールバックをメモ化（子コンポーネントの再レンダリング防止）
const handlePress = useCallback((id) => {
  setSelectedId(id)
}, [])

// ❌ 不要なメモ化（プリミティブ値やシンプルな計算）
const total = useMemo(() => a + b, [a, b]) // 不要
```

### 状態の適切な配置

```javascript
// ❌ 親コンポーネントの状態変更で全子が再レンダリング
function Parent() {
  const [searchQuery, setSearchQuery] = useState('')
  return (
    <View>
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <ExpensiveList /> {/* searchQuery変更のたびに再レンダリング */}
    </View>
  )
}

// ✅ 状態を使用するコンポーネントに近づける
function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('')
  return <SearchBar query={searchQuery} onChange={setSearchQuery} />
}

function Parent() {
  return (
    <View>
      <SearchSection />
      <ExpensiveList /> {/* 再レンダリングされない */}
    </View>
  )
}
```

## JSスレッド最適化

### console.log除去

```json
// babel.config.js
{
  "env": {
    "production": {
      "plugins": ["transform-remove-console"]
    }
  }
}
```

### InteractionManager

```javascript
import { InteractionManager } from 'react-native'

// ✅ アニメーション完了後に重い処理を実行
InteractionManager.runAfterInteractions(() => {
  // 重いデータ処理、API呼び出しなど
  loadHeavyData()
})
```

### requestAnimationFrame

```javascript
// ✅ タッチフィードバックを即座に表示してから重い処理
function handlePress() {
  requestAnimationFrame(() => {
    doExpensiveWork()
  })
}
```

## 画像最適化

```javascript
// ✅ 高速画像ライブラリ（キャッシュ対応）
import FastImage from '@d11/react-native-fast-image'

<FastImage
  source={{ uri: imageUrl, priority: FastImage.priority.normal }}
  style={{ width: 100, height: 100 }}
  resizeMode={FastImage.resizeMode.cover}
/>

// ✅ 静的画像は@2x/@3xを用意
// check.png, check@2x.png, check@3x.png
// Metroバンドラーが自動的にデバイス密度に応じて選択

// ✅ 画像のrequireは静的に（変数不可）
const icon = isActive
  ? require('./icon-active.png')
  : require('./icon-inactive.png')
```

## パフォーマンス計測

```javascript
// リリースビルドでテスト（dev=trueは遅い）
// Dev Menu → Show Perf Monitor でFPS確認
// JS frame rate: JSスレッドのFPS
// UI frame rate: UIスレッドのFPS

// Android: renderToHardwareTextureAndroid（GPU描画）
// iOS: shouldRasterizeIOS（ラスタライズ）
// → メモリ増加に注意、プロファイル後に使用
```
