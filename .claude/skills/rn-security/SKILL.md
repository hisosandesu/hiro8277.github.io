---
name: rn-security
description: React Nativeアプリのセキュリティベストプラクティス。シークレット管理、セキュアストレージ、認証、ネットワークセキュリティ。
---

# React Native セキュリティパターン

reactnative.dev/docs/security に基づくセキュリティベストプラクティス集。

## 1. シークレット管理

### 絶対禁止パターン

```javascript
// ❌ CRITICAL: コード内のハードコードされたシークレット
const API_KEY = "sk-xxxxxxxxxxxxx"
const SECRET = "my-secret-key-123"
const DATABASE_URL = "postgres://user:pass@host/db"

// ❌ CRITICAL: .envファイルのシークレット（バンドルに含まれる）
// react-native-dotenv, react-native-config はシークレット保管に使わない
// これらはAPIエンドポイントURLなど非機密データ専用
```

### 推奨パターン: オーケストレーション層

```javascript
// ✅ サーバーレス関数でAPIキーを保持
// クライアント → AWS Lambda/Cloud Functions → 外部API

// クライアント側（シークレットなし）
const API_URL = process.env.EXPO_PUBLIC_API_URL

async function fetchData() {
  // APIキーはサーバー側で付加される
  const response = await fetch(`${API_URL}/data`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  })
  return response.json()
}
```

## 2. データストレージ

### ストレージ選択ガイド

| データ種類 | ストレージ | 理由 |
|-----------|----------|------|
| ユーザー設定 | AsyncStorage | 暗号化不要、非機密 |
| Redux/アプリ状態 | AsyncStorage | 永続化に適切 |
| キャッシュデータ | AsyncStorage | 一時的、非機密 |
| **認証トークン** | **SecureStore** | **暗号化必須** |
| **パスワード** | **SecureStore** | **暗号化必須** |
| **APIキー** | **サーバー側** | **クライアントに保存しない** |

### SecureStore (expo-secure-store)

```javascript
import * as SecureStore from 'expo-secure-store'

// ✅ トークンの安全な保存
async function saveAuthToken(token) {
  await SecureStore.setItemAsync('auth_token', token)
}

async function getAuthToken() {
  return await SecureStore.getItemAsync('auth_token')
}

async function clearAuthToken() {
  await SecureStore.deleteItemAsync('auth_token')
}
```

### 検出すべき危険パターン

```javascript
// ❌ CRITICAL: AsyncStorageにトークンを保存
import AsyncStorage from '@react-native-async-storage/async-storage'
await AsyncStorage.setItem('authToken', token)        // 危険!
await AsyncStorage.setItem('refreshToken', refreshToken) // 危険!
await AsyncStorage.setItem('password', password)       // 危険!
await AsyncStorage.setItem('apiKey', apiKey)           // 危険!

// ❌ WARNING: Redux状態にセンシティブデータを永続化
// redux-persistでトークンを含む状態を保存しない

// ❌ WARNING: エラー監視にセンシティブデータを送信
Sentry.captureException(error, {
  extra: { userToken: token } // 危険!
})
```

## 3. 認証セキュリティ

### OAuth2 + PKCE (推奨)

```javascript
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session'

// PKCE (Proof Key for Code Exchange) フロー
// 1. code_verifier (ランダム文字列) を生成
// 2. code_challenge = SHA256(code_verifier)
// 3. 認可リクエストにcode_challengeを送信
// 4. 認可コード取得後、code_verifierでトークン交換
// → 悪意あるアプリがコードを傍受しても、code_verifierなしでは交換不可

const [request, response, promptAsync] = useAuthRequest(
  {
    clientId: CLIENT_ID,
    scopes: ['openid', 'profile'],
    redirectUri: makeRedirectUri({ scheme: 'myapp' }),
    usePKCE: true, // PKCE有効化
  },
  discovery
)
```

### セッション管理

```javascript
// ✅ トークンの有効期限管理
async function getValidToken() {
  const token = await SecureStore.getItemAsync('auth_token')
  const expiry = await SecureStore.getItemAsync('token_expiry')

  if (!token || Date.now() > Number(expiry)) {
    // トークンリフレッシュ
    return await refreshAuthToken()
  }
  return token
}

// ✅ ログアウト時の完全クリーンアップ
async function logout() {
  await SecureStore.deleteItemAsync('auth_token')
  await SecureStore.deleteItemAsync('refresh_token')
  await SecureStore.deleteItemAsync('token_expiry')
  // ナビゲーションをログイン画面にリセット
}
```

## 4. Deep Linking セキュリティ

```javascript
// ❌ CRITICAL: Deep Linkにセンシティブデータを含めない
// URLスキームは一元管理されない（悪意あるアプリが横取り可能）

// ❌ 危険なDeep Link
// myapp://auth?token=abc123
// myapp://reset-password?code=xyz
// myapp://payment?amount=100&card=xxxx

// ✅ 安全なDeep Link（非機密IDのみ）
// myapp://products/123
// myapp://articles/456

// ✅ iOS: Universal Links を使用（ドメイン検証あり）
// ✅ Android: App Links を使用（ドメイン検証あり）
```

## 5. ネットワークセキュリティ

```javascript
// ✅ 必須: HTTPS通信のみ
const API_URL = 'https://api.example.com'

// ❌ HTTP通信は禁止
const API_URL = 'http://api.example.com' // 危険!

// ✅ SSL Pinning（高セキュリティ要件時）
// react-native-ssl-pinning ライブラリを使用
// 注意: 証明書の有効期限管理が必要
```

### セキュアなAPI通信

```javascript
// ✅ 認証ヘッダーの適切な設定
async function apiRequest(endpoint, options = {}) {
  const token = await getValidToken()

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (response.status === 401) {
    // トークン期限切れ → リフレッシュ
    await refreshAuthToken()
    return apiRequest(endpoint, options) // リトライ
  }

  return response.json()
}
```

## 6. セキュリティスキャンパターン

以下の正規表現でコードベースをスキャン:

```
# ハードコードされたシークレット
/(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+['"]/i

# AsyncStorageへのトークン保存
/AsyncStorage\.(setItem|multiSet).*?(token|password|secret|key)/i

# HTTP通信
/fetch\s*\(\s*['"]http:\/\//i
/https?:\/\/.*?(password|token|secret|key)=/i

# console.logでのセンシティブデータ
/console\.(log|debug|info)\(.*?(token|password|secret)/i
```

## セキュリティチェックリスト

### コミット前
- [ ] ハードコードされたAPIキー・シークレットがない
- [ ] AsyncStorageにトークン・パスワードを保存していない
- [ ] HTTP (非HTTPS) エンドポイントがない
- [ ] Deep LinkにセンシティブなURLパラメータがない
- [ ] console.logでセンシティブデータを出力していない
- [ ] Sentry/CrashlyticsにトークンやPIIを送信していない

### リリース前
- [ ] SSL Pinningの検討（金融・医療アプリ）
- [ ] ProGuard/R8によるコード難読化 (Android)
- [ ] OAuth2 + PKCEによる認証
- [ ] トークンのリフレッシュ・失効処理
- [ ] Universal Links / App Linksの設定
