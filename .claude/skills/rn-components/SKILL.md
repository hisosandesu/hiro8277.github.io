---
name: rn-components
description: React Nativeコアコンポーネントのベストプラクティス。View、Text、Image、TextInput、Pressable、ScrollView、FlatListの正しい使い方。
---

# React Native コアコンポーネントパターン

reactnative.dev/docs/components-and-apis に基づくコンポーネントのベストプラクティス集。

## コアコンポーネント一覧

### Basic
- **View**: UIの基本ビルディングブロック（Web の div 相当）
- **Text**: テキスト表示（ネスト可、スタイル継承あり）
- **Image**: 静的・ネットワーク画像表示
- **TextInput**: テキスト入力
- **Pressable**: タッチ操作の検出（推奨: TouchableOpacityより）
- **ScrollView**: スクロールコンテナ（少量コンテンツ向け）
- **StyleSheet**: CSSライクなスタイル定義

### User Interface
- **Button**: 基本ボタン（カスタマイズ限定的）
- **Switch**: ブーリアン入力
- **ActivityIndicator**: ローディングスピナー
- **Alert**: アラートダイアログ
- **Modal**: モーダル表示
- **StatusBar**: ステータスバー制御

### List Views
- **FlatList**: 大量データのリスト（仮想化）
- **SectionList**: セクション付きリスト（仮想化）
- **VirtualizedList**: FlatList/SectionListのベース

### その他
- **Animated**: アニメーションAPI
- **KeyboardAvoidingView**: キーボード回避
- **Linking**: URL/Deep Link操作
- **RefreshControl**: プルトゥリフレッシュ

## コンポーネントパターン

### Pressable（推奨タッチコンポーネント）

```javascript
// ✅ Pressableを使用（TouchableOpacity/Highlightより推奨）
import { Pressable, StyleSheet } from 'react-native'

function MyButton({ onPress, title }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {({ pressed }) => (
        <Text style={[styles.text, pressed && styles.textPressed]}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}

// Pressableのタッチ状態
// onPressIn → onPress → onPressOut
// onLongPress (500ms デフォルト)
// hitSlop: タッチ領域の拡張
```

### TextInput パターン

```javascript
import { useState, useCallback } from 'react'
import { TextInput, View, Text } from 'react-native'

function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('')

  const handleChangeText = useCallback((text) => {
    setQuery(text)
  }, [])

  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim())
    }
  }, [query, onSearch])

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        placeholder="検索..."
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="while-editing" // iOS
        // セキュリティ
        secureTextEntry={false} // パスワードの場合はtrue
        autoComplete="off"
      />
    </View>
  )
}
```

### ScrollView vs FlatList

```javascript
// ✅ ScrollView: 少量のコンテンツ（画面数枚分まで）
// 全子要素を一度にレンダリング
<ScrollView>
  <Header />
  <Content />
  <Footer />
</ScrollView>

// ✅ FlatList: 大量のデータリスト
// ビューポート付近のみレンダリング（仮想化）
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>

// ❌ ScrollView内に大量のリストを配置しない
```

### Image パターン

```javascript
import { Image } from 'react-native'

// 静的画像（バンドル内）
<Image source={require('./assets/logo.png')} />

// ネットワーク画像（サイズ指定必須）
<Image
  source={{ uri: 'https://example.com/photo.jpg' }}
  style={{ width: 200, height: 200 }}
  resizeMode="cover"
/>

// ✅ 条件分岐はrequireを静的に
const icon = isActive
  ? require('./icon-active.png')
  : require('./icon-inactive.png')

// ❌ 動的パスは不可
const icon = require('./' + iconName + '.png') // NG!

// 背景画像
import { ImageBackground } from 'react-native'
<ImageBackground source={require('./bg.png')} style={styles.container}>
  <Text>コンテンツ</Text>
</ImageBackground>
```

### KeyboardAvoidingView

```javascript
import { KeyboardAvoidingView, Platform } from 'react-native'

// ✅ プラットフォームに応じたbehavior
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={styles.container}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
>
  <ScrollView>
    <TextInput placeholder="入力..." />
    <TextInput placeholder="入力..." />
  </ScrollView>
</KeyboardAvoidingView>
```

### Modal パターン

```javascript
import { Modal, Pressable, View, Text } from 'react-native'

function ConfirmModal({ visible, onConfirm, onCancel, message }) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel} // Androidバックボタン対応
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text>{message}</Text>
          <View style={styles.buttonRow}>
            <Pressable onPress={onCancel}>
              <Text>キャンセル</Text>
            </Pressable>
            <Pressable onPress={onConfirm}>
              <Text>確認</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
```

### RefreshControl（プルトゥリフレッシュ）

```javascript
import { FlatList, RefreshControl } from 'react-native'

function RefreshableList({ data, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#007AFF']} // Android
          tintColor="#007AFF"  // iOS
        />
      }
    />
  )
}
```

## StyleSheet ベストプラクティス

```javascript
import { StyleSheet } from 'react-native'

// ✅ StyleSheet.createで定義（パフォーマンス最適化あり）
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
})

// ✅ 条件付きスタイルは配列で
<View style={[styles.container, isActive && styles.active]} />

// ❌ インラインスタイルは避ける（毎回新しいオブジェクト生成）
<View style={{ flex: 1, backgroundColor: '#fff' }} />
```

## Platform-Specific パターン

```javascript
import { Platform, StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    android: {
      elevation: 5,
    },
  }),
})
```
