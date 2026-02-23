---
name: expo-patterns
description: Expo SDK、EAS (Build/Submit/Update)、パーミッション、認証、Config Pluginsのベストプラクティス。
---

# Expo パターン集

docs.expo.dev に基づくExpo SDK (54+) とEASのベストプラクティス。

## Expo SDK パッケージ管理

```bash
# ✅ npx expo install を使用（バージョン互換性を自動解決）
npx expo install expo-camera expo-image-picker expo-clipboard

# ❌ npm install は互換性問題の原因
npm install expo-camera  # バージョン不一致のリスク
```

## 主要パッケージパターン

### expo-camera

```javascript
import { CameraView, useCameraPermissions } from 'expo-camera'

function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()

  if (!permission) return <View />

  if (!permission.granted) {
    return (
      <View>
        <Text>カメラへのアクセスが必要です</Text>
        <Pressable onPress={requestPermission}>
          <Text>許可する</Text>
        </Pressable>
      </View>
    )
  }

  return <CameraView style={{ flex: 1 }} facing="back" />
}
```

### expo-image-picker

```javascript
import * as ImagePicker from 'expo-image-picker'

async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8, // 圧縮率（0-1）
  })

  if (!result.canceled) {
    return result.assets[0].uri
  }
  return null
}

async function takePhoto() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('カメラへのアクセスが必要です')
    return null
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  })

  if (!result.canceled) {
    return result.assets[0].uri
  }
  return null
}
```

### expo-secure-store（セキュアストレージ）

```javascript
import * as SecureStore from 'expo-secure-store'

// ✅ トークン・パスワードはSecureStoreに保存
async function saveToken(token) {
  await SecureStore.setItemAsync('authToken', token)
}

async function getToken() {
  return await SecureStore.getItemAsync('authToken')
}

async function deleteToken() {
  await SecureStore.deleteItemAsync('authToken')
}
```

### expo-clipboard

```javascript
import * as Clipboard from 'expo-clipboard'

async function copyToClipboard(text) {
  await Clipboard.setStringAsync(text)
}

async function getClipboardContent() {
  return await Clipboard.getStringAsync()
}
```

### expo-localization（多言語対応）

```javascript
import { getLocales } from 'expo-localization'
import { I18n } from 'i18n-js'

const translations = {
  en: { welcome: 'Welcome', settings: 'Settings' },
  ja: { welcome: 'ようこそ', settings: '設定' },
}

const i18n = new I18n(translations)
i18n.locale = getLocales()[0].languageCode ?? 'en'
i18n.enableFallback = true

// 使用
i18n.t('welcome') // "ようこそ" (日本語端末)
```

### expo-updates（OTAアップデート）

```javascript
import * as Updates from 'expo-updates'

async function checkForUpdates() {
  try {
    const update = await Updates.checkForUpdateAsync()
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync() // アプリ再起動
    }
  } catch (error) {
    console.error('アップデート確認失敗:', error)
  }
}

// useUpdates フックで状態管理
import { useUpdates } from 'expo-updates'

function App() {
  const { isUpdateAvailable, isUpdatePending } = useUpdates()

  if (isUpdatePending) {
    return <Text>アップデート中...</Text>
  }
}
```

## パーミッション設定

### app.json / app.config.js

```json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE"
      ],
      "blockedPermissions": [
        "android.permission.RECORD_AUDIO"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "写真を撮影してOCR処理するためにカメラを使用します",
        "NSPhotoLibraryUsageDescription": "写真からテキストを読み取るために写真ライブラリにアクセスします"
      }
    },
    "plugins": [
      [
        "expo-camera",
        { "cameraPermission": "写真を撮影してOCR処理するためにカメラを使用します" }
      ]
    ]
  }
}
```

### ランタイムでのパーミッションリクエスト

```javascript
// ✅ パーミッションの段階的リクエスト
async function requestCameraAccess() {
  // 1. 現在の状態を確認
  const { status: existingStatus } = await Camera.getCameraPermissionsAsync()

  if (existingStatus === 'granted') return true

  // 2. リクエスト
  const { status } = await Camera.requestCameraPermissionsAsync()

  if (status !== 'granted') {
    Alert.alert(
      'カメラへのアクセス',
      'OCR機能を使用するにはカメラへのアクセスが必要です。設定画面から許可してください。',
      [
        { text: 'キャンセル' },
        { text: '設定を開く', onPress: () => Linking.openSettings() }
      ]
    )
    return false
  }

  return true
}
```

## EAS設定

### eas.json

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "internal"
      },
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

### EASコマンド

```bash
# ビルド
eas build --platform android --profile preview  # APK作成
eas build --platform ios --profile production    # IPA作成
eas build --platform all                         # 両方

# サブミット
eas submit --platform android
eas submit --platform ios
eas build --platform ios --auto-submit           # ビルド+サブミット

# アップデート (OTA)
eas update --channel production --message "バグ修正"
eas update --channel preview --message "新機能テスト"
```

## Development Builds vs Expo Go

| 項目 | Expo Go | Development Build |
|------|---------|-------------------|
| カスタムネイティブコード | ❌ | ✅ |
| OAuthリダイレクト | ❌ | ✅ |
| カスタムURLスキーム | ❌ | ✅ |
| Config Plugins | ❌ | ✅ |
| プロダクション対応 | ❌ | ✅ |
| セットアップの手軽さ | ✅ | △（初回ビルド必要） |

## Development Build 接続トラブルシュート

### ビルドプロファイルの違い

| プロファイル | コマンド | 動作 | 用途 |
|---|---|---|---|
| `development` | `eas build -p android --profile development` | Metro開発サーバー接続が**必要** | 開発・デバッグ |
| `preview` | `eas build -p android --profile preview` | サーバー不要、**単体で動く** | 内部テスト・QA |
| `production` | `eas build -p android --profile production` | サーバー不要、署名済み | ストア公開 |

### Dev Build 起動手順

```bash
# 1. PCで開発サーバーを起動
npx expo start --dev-client

# 2. スマホとPCを同じWi-Fiに接続
# 3. アプリでQRコードをスキャンまたはサーバーを選択
```

### 接続エラーの解決

#### "failed to connect to /x.x.x.x (port 8081) after 10000ms"

**原因**: Windowsファイアウォールがポート8081をブロック

```powershell
# PowerShell（管理者）でポート8081を許可
netsh advfirewall firewall add rule name="Expo Metro (8081)" dir=in action=allow protocol=TCP localport=8081
```

#### ファイアウォール設定が困難な場合 — トンネルモード

```bash
# トンネル経由で接続（ファイアウォール回避）
# Expo SDK 54 では @expo/ws-tunnel を内部使用（@expo/ngrok は不要・削除可）
npx expo start --dev-client --tunnel
```

> **Note**: `@expo/ngrok` は Expo SDK 54 では不要。`expo` の内部依存 `@expo/ws-tunnel` が自動使用される。

```bash
# より安定した代替: USB + adb reverse（Wi-Fi/ファイアウォール非依存）
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client
```

#### その他の接続チェックリスト

- [ ] スマホとPCが同じWi-Fiネットワーク上にあるか
- [ ] Metro開発サーバー (`npx expo start --dev-client`) が起動しているか
- [ ] ファイアウォールでポート8081が許可されているか
- [ ] VPNが有効になっていないか（VPNはローカル通信をブロックすることがある）
- [ ] PCのIPアドレスがアプリに表示されるアドレスと一致しているか

### Expo Go vs Development Build

このプロジェクトのようにネイティブモジュールを含む場合、Expo Goでは動作しない:
- `@react-native-ml-kit/text-recognition`
- `react-native-vision-camera`
- `@react-native-vector-icons/fontawesome6`

→ **EAS Development Build** (カスタムAPK) が必須

### eas.json 推奨設定

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

## 認証パターン (expo-auth-session)

```javascript
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session'

WebBrowser.maybeCompleteAuthSession()

const redirectUri = makeRedirectUri({
  scheme: 'your-app-scheme'
})

function AuthScreen() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: 'YOUR_CLIENT_ID',
      scopes: ['openid', 'profile'],
      redirectUri,
    },
    { authorizationEndpoint: 'https://provider.com/authorize' }
  )

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params
      // サーバーサイドでcode → tokenに交換
      exchangeCodeForToken(code)
    }
  }, [response])

  return (
    <Pressable
      disabled={!request}
      onPress={() => promptAsync()}
    >
      <Text>ログイン</Text>
    </Pressable>
  )
}
```
