---
name: rn-accessibility
description: React Nativeアクセシビリティパターン。VoiceOver/TalkBack対応、ARIA属性、スクリーンリーダー、フォーカス管理。
---

# React Native アクセシビリティパターン

reactnative.dev/docs/accessibility に基づくアクセシビリティベストプラクティス集。

## 基本プロパティ

### accessible

```javascript
// ✅ タッチ要素はデフォルトでaccessible=true
<Pressable accessible={true}>...</Pressable>

// ✅ グループ化: 子要素を1つのアクセシブル要素として
<View accessible={true} accessibilityLabel="田中太郎、ステータス: オンライン">
  <Text>田中太郎</Text>
  <Text>オンライン</Text>
</View>
```

### accessibilityLabel

```javascript
// ✅ 要素の説明（スクリーンリーダーが読み上げ）
<Pressable
  accessibilityLabel="写真を撮影"
  onPress={takePhoto}
>
  <Icon name="camera" />
</Pressable>

// ✅ Textの子要素はデフォルトでラベルとして結合される
<Pressable>
  <Text>保存</Text> {/* accessibilityLabelは自動的に"保存" */}
</Pressable>

// ❌ アイコンのみのボタンにラベルがない
<Pressable onPress={takePhoto}>
  <Icon name="camera" /> {/* VoiceOverで何も読まれない */}
</Pressable>
```

### accessibilityHint

```javascript
// ✅ アクション結果のヒント
<Pressable
  accessibilityLabel="戻る"
  accessibilityHint="前の画面に戻ります"
  onPress={goBack}
>
  <Icon name="arrow-left" />
</Pressable>
```

### accessibilityRole

```javascript
// 主要なロール
<Pressable accessibilityRole="button">...</Pressable>
<Pressable accessibilityRole="link">...</Pressable>
<Text accessibilityRole="header">見出し</Text>
<Image accessibilityRole="image" accessibilityLabel="東京タワー" />
<TextInput accessibilityRole="search" />
<Switch accessibilityRole="switch" />
<View accessibilityRole="alert">エラーメッセージ</View>
```

### accessibilityState

```javascript
<Pressable
  accessibilityState={{
    disabled: isDisabled,
    selected: isSelected,
    checked: isChecked,    // チェックボックス用
    expanded: isExpanded,  // アコーディオン用
    busy: isLoading,       // ローディング中
  }}
>
  <Text>ボタン</Text>
</Pressable>
```

## コンポーネント別パターン

### ボタン

```javascript
function AccessibleButton({ onPress, label, hint, disabled, loading }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
    >
      {loading ? <ActivityIndicator /> : <Text>{label}</Text>}
    </Pressable>
  )
}
```

### フォーム入力

```javascript
function AccessibleInput({ label, error, ...props }) {
  const inputId = `input-${label}`

  return (
    <View>
      <Text nativeID={inputId}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={inputId}  // Android
        accessibilityState={{ disabled: props.editable === false }}
        {...props}
      />
      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  )
}
```

### 画像

```javascript
// ✅ 情報を持つ画像
<Image
  source={require('./photo.png')}
  accessibilityLabel="撮影したレシートの画像"
  accessibilityRole="image"
/>

// ✅ 装飾画像（アクセシビリティから除外）
<Image
  source={require('./decoration.png')}
  accessible={false}
/>
```

### リスト

```javascript
function AccessibleList({ items }) {
  return (
    <FlatList
      data={items}
      renderItem={({ item, index }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title}、${item.date}`}
          accessibilityHint="タップして詳細を表示"
        >
          <Text>{item.title}</Text>
          <Text>{item.date}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text accessibilityRole="alert">
          アイテムがありません
        </Text>
      }
    />
  )
}
```

### モーダル / ダイアログ

```javascript
function AccessibleModal({ visible, title, children, onClose }) {
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      accessibilityViewIsModal={true}  // iOS: 背景要素をブロック
    >
      <View
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel={title}
      >
        <Text accessibilityRole="header">{title}</Text>
        {children}
        <Pressable
          onPress={onClose}
          accessibilityLabel="閉じる"
          accessibilityRole="button"
        >
          <Icon name="close" />
        </Pressable>
      </View>
    </Modal>
  )
}
```

## 動的コンテンツ通知

### accessibilityLiveRegion (Android)

```javascript
// ✅ エラーメッセージを即座に通知
<Text accessibilityLiveRegion="assertive">
  {errorMessage}
</Text>

// ✅ ステータス更新をpolyteに通知
<Text accessibilityLiveRegion="polite">
  {statusMessage}
</Text>

// "assertive": 即座に読み上げ（エラー、警告）
// "polite": 現在の読み上げ完了後に通知（ステータス更新）
// "none": 通知しない
```

### iOS: AccessibilityInfo

```javascript
import { AccessibilityInfo } from 'react-native'

// ✅ 動的コンテンツ変更を通知 (iOS)
AccessibilityInfo.announceForAccessibility('画像からテキストを認識しました')

// ✅ スクリーンリーダーの有効状態を確認
const [screenReaderEnabled, setScreenReaderEnabled] = useState(false)

useEffect(() => {
  AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled)

  const subscription = AccessibilityInfo.addEventListener(
    'screenReaderChanged',
    setScreenReaderEnabled
  )

  return () => subscription.remove()
}, [])
```

## プラットフォーム固有

### Android

```javascript
// importantForAccessibility
<View importantForAccessibility="no-hide-descendants">
  {/* この配下のすべての要素がアクセシビリティから除外 */}
  <DecorativeContent />
</View>
```

### iOS

```javascript
// accessibilityIgnoresInvertColors: ダークモードで画像の色を反転させない
<Image
  source={require('./photo.png')}
  accessibilityIgnoresInvertColors={true}
/>

// accessibilityElementsHidden: VoiceOverから非表示
<View accessibilityElementsHidden={true}>
  <DecorativeContent />
</View>
```

## チェックリスト

- [ ] すべてのPressable/ボタンにaccessibilityLabelがある
- [ ] アイコンのみのボタンにラベルが設定されている
- [ ] フォーム入力にラベルが関連付けられている
- [ ] エラーメッセージがaccessibilityLiveRegionで通知される
- [ ] 画像にaccessibilityLabelがある（装飾画像はaccessible=false）
- [ ] モーダルにaccessibilityViewIsModalが設定されている
- [ ] ヘッダーにaccessibilityRole="header"が設定されている
- [ ] disabled状態がaccessibilityStateに反映されている
- [ ] カラーコントラスト比が4.5:1以上
