---
name: rn-animations
description: React Nativeアニメーションパターン。Animated API、LayoutAnimation、react-native-reanimated、ジェスチャー連携。
---

# React Native アニメーションパターン

reactnative.dev/docs/animations に基づくアニメーションのベストプラクティス集。

## アニメーションシステムの選択

| システム | 用途 | 特徴 |
|---------|------|------|
| **Animated API** | 基本的なアニメーション | React Native標準、宣言的 |
| **LayoutAnimation** | レイアウト変更アニメーション | シンプル、fire-and-forget |
| **react-native-reanimated** | 複雑・高性能アニメーション | UIスレッド実行、ジェスチャー連携 |

## Animated API

### フェードイン

```javascript
import { useRef, useEffect } from 'react'
import { Animated } from 'react-native'

function FadeInView({ children }) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true, // 必須!
    }).start()
  }, [fadeAnim])

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {children}
    </Animated.View>
  )
}
```

### スライドイン

```javascript
function SlideInView({ children, direction = 'right' }) {
  const slideAnim = useRef(new Animated.Value(direction === 'right' ? 300 : -300)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start()
  }, [slideAnim])

  return (
    <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
      {children}
    </Animated.View>
  )
}
```

### アニメーションの組み合わせ

```javascript
// 並列実行
Animated.parallel([
  Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
  Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
]).start()

// 順次実行
Animated.sequence([
  Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
  Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
]).start()

// 遅延付き順次実行
Animated.stagger(100, [
  Animated.timing(anim1, { toValue: 1, duration: 200, useNativeDriver: true }),
  Animated.timing(anim2, { toValue: 1, duration: 200, useNativeDriver: true }),
  Animated.timing(anim3, { toValue: 1, duration: 200, useNativeDriver: true }),
]).start()
```

### 値の補間

```javascript
const spinAnim = useRef(new Animated.Value(0)).current

// 数値 → 文字列（角度）への補間
const spin = spinAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg'],
})

// 数値 → 数値への補間
const opacity = spinAnim.interpolate({
  inputRange: [0, 0.5, 1],
  outputRange: [0, 1, 0],
})

<Animated.View style={{ transform: [{ rotate: spin }], opacity }}>
  <Icon name="refresh" />
</Animated.View>
```

### useNativeDriver の制約

```javascript
// ✅ useNativeDriver: true で使用可能
// opacity, transform (translateX, translateY, scale, rotate, etc.)

// ❌ useNativeDriver: true で使用不可
// width, height, backgroundColor, margin, padding, borderRadius
// → これらはuseNativeDriver: falseまたはReanimatedを使用
```

## LayoutAnimation

```javascript
import { LayoutAnimation, UIManager, Platform } from 'react-native'

// Androidで有効化（必須）
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

function ExpandableCard({ title, content }) {
  const [expanded, setExpanded] = useState(false)

  const toggleExpand = () => {
    // 次のレイアウト変更をアニメーション
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(!expanded)
  }

  return (
    <View>
      <Pressable onPress={toggleExpand}>
        <Text>{title}</Text>
      </Pressable>
      {expanded && <Text>{content}</Text>}
    </View>
  )
}

// カスタム設定
LayoutAnimation.configureNext({
  duration: 300,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
})
```

## react-native-reanimated

### 基本パターン

```javascript
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated'

function AnimatedCard() {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 })
    opacity.value = withTiming(0.8, { duration: 100 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1)
    opacity.value = withTiming(1, { duration: 200 })
  }

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Text>カード</Text>
      </Animated.View>
    </Pressable>
  )
}
```

### リストアイテムの入場アニメーション

```javascript
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated'

function AnimatedListItem({ item, index }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(300)}
      exiting={FadeOutUp.duration(200)}
      layout={Layout.springify()}
    >
      <Text>{item.title}</Text>
    </Animated.View>
  )
}
```

### ジェスチャー連携 (react-native-gesture-handler)

```javascript
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'

function DraggableBox() {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX
      translateY.value = event.translationY
    })
    .onEnd(() => {
      translateX.value = withSpring(0)
      translateY.value = withSpring(0)
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.box, animatedStyle]} />
    </GestureDetector>
  )
}
```

## パフォーマンスルール

1. **必ず `useNativeDriver: true`** (Animated API使用時)
2. **画像サイズ変更は `transform: [{scale}]`** (width/heightは重い)
3. **InteractionManager** でアニメーション後に重い処理を遅延
4. **requestAnimationFrame** でタッチフィードバックと重い処理を分離
5. **Reanimated worklet** はUIスレッドで実行されるので高速
6. **LayoutAnimation** はシンプルなレイアウト変更専用（中断不可）
