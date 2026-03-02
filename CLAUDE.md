# OCR-APP プロジェクト

## プロジェクト概要

React Native (Expo SDK 54) + ML Kit Text Recognition のOCRアプリ。
カメラ/ギャラリーから画像を取得し、日本語テキスト認識して履歴保存する。

- **フレームワーク**: React Native 0.81.5 + Expo SDK 54
- **画面数**: 2 (HomeScreen, HistoryScreen)
- **コンポーネント数**: 5 (ActionButton, FloatingButton, SaveButton, ClearButton, ErrorBoundary)
- **ナビゲーション**: React Navigation Stack
- **ストレージ**: AsyncStorage（secureStorage.js の `AppStorage` ラッパー経由、OCR履歴はユーザー生成テキストのため機密非該当）
- **OCR**: @react-native-ml-kit/text-recognition (日本語)
- **エラー監視**: @sentry/react-native（DSN設定後に有効）

## ファイル構成

```
src/
  screens/
    HomeScreen.js         # メイン画面（カメラ/ギャラリー → 前処理 → OCR → フィルタ → 保存）
    HistoryScreen.js      # 履歴一覧（FlatList、スワイプ削除、モーダル全文表示、コピー）
  components/
    ActionButton.js       # 共通ボタン基底コンポーネント（position:absolute, 60x60, primary色）
    FloatingButton.js     # カメラ起動ボタン（右下）← ActionButton 使用
    SaveButton.js         # 保存ボタン（左下）← ActionButton 使用
    ClearButton.js        # クリアボタン（中央下）← ActionButton 使用
    ErrorBoundary.js      # 未捕捉例外バウンダリ（再試行ボタン付き）
  utils/
    imagePreprocessing.js # 画像前処理（リサイズ1920px、JPEG圧縮0.9、EXIF回転補正）
    textFilter.js         # OCR結果フィルタ（空白行・1文字行・記号行・句読点行除去、連続空行正規化）
    secureStorage.js      # AsyncStorage ラッパー（AppStorage エクスポート、OCR履歴は機密非該当のためAsyncStorage採用・非暗号化）
    monitoring.js         # Sentry エラー監視ラッパー（DSN未設定時はノーオペレーション）
  constants/
    storage.js            # HISTORY_KEY
    colors.js             # COLORS（primary, background, white, textPrimary, textSecondary, ...）
    messages.js           # MESSAGES（ERROR, SUCCESS, CONFIRM, INFO）
    app.js                # HISTORY_LIMIT=100, MAX_TEXT_LENGTH=5000, CLIPBOARD_CLEAR_DELAY=30000
  navigations/
    RootNavigation.js     # NavigationContainer
    stack/
      HomeStack.js        # Stack.Navigator (Home, History)
```

---

## 包括的レビュー結果 (2026-02-19)

### 総合評価（2026-03-01 更新）

| 観点 | スコア | 状態 |
|------|--------|------|
| コード品質 | 4.5/5 | ✅ useCallback 全関数対応・useEffect deps 修正完了 |
| セキュリティ | 4.3/5 | ✅ fetchタイムアウト・エラーサニタイズ・microphonePermission削除 |
| パフォーマンス | 4.8/5 | ✅ FlatList最適化・processedURIキャッシュ・全useCallback化 |
| 本番運用準備 | 85/100 | ⚠️ アイコン・プライバシーポリシー作成後にストア提出可能 |

**結論: コード品質・セキュリティ・パフォーマンスは MVPリリース水準に到達。残作業はアイコン作成とプライバシーポリシー公開のみ（次回実施予定）。**

### レビュー実施エージェント
- code-reviewer（コード品質）
- security-reviewer（OWASP Mobile Top 10）
- rn-performance-optimizer（パフォーマンス）
- expo-specialist（本番運用準備）

---

## コードレビュー結果（最終更新: 2026-02-20）

### Phase 1 CRITICAL (全件修正済み ✅)

| # | 問題 | 状態 | 修正内容 |
|---|------|------|---------|
| C1 | console.log 15箇所残留 | ✅ 修正済み | HomeScreen.js (8箇所), HistoryScreen.js (7箇所) 全削除 |
| C2 | GestureHandlerRootView 未設置 | ✅ 修正済み | App.js に GestureHandlerRootView ラッパー追加 |
| C3 | useLayoutEffect 依存配列が空 | ✅ 修正済み | pickImage を useCallback 化、依存配列 [navigation, pickImage] に修正 |
| C4 | JSON.parse未バリデーション | ✅ 修正済み | try/catch + Array.isArray ガード追加（両画面） |

### 新規発見 CRITICAL (全件修正済み ✅)

| # | 問題 | 状態 | 修正内容 |
|---|------|------|---------|
| NC1 | SwipeableHistoryItem が React.memo 未使用 | ✅ 修正済み | React.memo でラップ |
| NC2 | deleteItem/openItem が useCallback 未使用 | ✅ 修正済み | useCallback 化 + functional setState でクロージャ回避 |
| NC3 | formatDate がコンポーネント内定義 | ✅ 修正済み | コンポーネント外のモジュールレベル関数に移動 |

### HIGH (全件修正済み ✅)

| # | 問題 | 状態 | 修正内容 |
|---|------|------|---------|
| H1 | AsyncStorage暗号化なし | ✅ 修正済み | AsyncStorage + secureStorage.js ラッパー（react-native-encrypted-storage → expo-secure-store 経由で AsyncStorage に最終確定。OCR履歴は機密情報非該当） |
| H2 | useEffect初回発火 | ✅ 修正済み | `if (image)` ガード追加 |
| H3 | ScrollView + map() | ✅ 修正済み | FlatList + keyExtractor + renderItem(useCallback) |
| H4 | StatusBar import混在 | ✅ 修正済み | expo-status-bar からの import に統一 |
| H5 | HISTORY_KEY重複定義 | ✅ 修正済み | src/constants/storage.js に共通化 |
| H6 | 不要パーミッション | ✅ 修正済み | app.json の recordAudioAndroid: false |

### 新規発見 HIGH (全件修正済み ✅)

| # | 問題 | 状態 | 修正内容 |
|---|------|------|---------|
| NH1 | クリップボードに機密情報コピー | ✅ 修正済み | コピー後 30秒で自動クリア（CLIPBOARD_CLEAR_DELAY） |
| NH2 | Deep Linking入力検証なし | ➖ 非対応 | 現在 RootNavigation に linking 設定なし → 実リスクなし |
| NH3 | エラー監視未統合 | ✅ 修正済み | @sentry/react-native + monitoring.js（DSN設定済み: .env.local） |
| NH4 | EAS Update未構成 | ✅ 修正済み | app.json に runtimeVersion + updates.url、eas.json に channel |
| NH5 | iOS bundleIdentifier未設定 | ✅ 修正済み | app.json に bundleIdentifier 追加 |
| NH6 | useFocusEffect依存配列不備 | ✅ 修正済み | loadHistory を useCallback 化して依存配列に追加 |

### MEDIUM (全件修正済み ✅)

| # | 問題 | 状態 | 修正内容 |
|---|------|------|---------|
| M1 | position:absolute in ScrollView | ✅ 修正済み | ボタン群を SafeAreaView 直下（ScrollView 外）に移動 |
| M2 | borderRadius重複定義 | ✅ 修正済み | borderRadius: 8 削除、30のみに統一 |
| M3 | 未使用import | ✅ 修正済み | Button, useColorScheme 削除 |
| M4 | Date.now()でID生成 | ✅ 修正済み | Crypto.randomUUID()（expo-crypto）※ Hermes に crypto グローバル非対応のため expo-crypto 必須 |
| M5 | ボタンコンポーネント重複 | ✅ 修正済み | ActionButton 共通コンポーネント化 |

### 新規発見 MEDIUM (全件修正済み ✅)

| # | 問題 | 状態 | 修正内容 |
|---|------|------|---------|
| NM1 | カラー値がハードコード散在 | ✅ 修正済み | src/constants/colors.js に集約（全ファイル適用） |
| NM2 | エラーメッセージがハードコード | ✅ 修正済み | src/constants/messages.js に集約（i18n対応可能な構造） |
| NM3 | 履歴テキストサイズ制限なし | ✅ 修正済み | MAX_TEXT_LENGTH = 5000（超過時はアラート付きで先頭部分のみ保存） |

### LOW (対応済み / 将来対応)

| # | 問題 | 状態 | 詳細 |
|---|------|------|------|
| L1 | TypeScript未使用 | 将来対応 | 大規模移行のため別フェーズ |
| L2 | テストファイル0件 | 将来対応 | 別フェーズで対応 |
| L3 | エラーバウンダリ未設置 | ✅ 修正済み | ErrorBoundary コンポーネント + App.js でラップ |
| L4 | isDarkMode未使用 | 将来対応 | ダークモード対応は別フェーズ |
| L5 | 履歴上限100件がマジックナンバー | ✅ 修正済み | HISTORY_LIMIT = 100 を constants/app.js に移動 |
| L6 | コード難読化未実装 | 将来対応 | ProGuard/R8 はストアリリース前に確認 |
| L7 | SSL証明書ピンニング未実装 | 将来対応 | 将来API連携時に実装 |

---

## セキュリティ評価（2026-02-20 更新）

### OWASP Mobile Top 10 対応状況

| # | カテゴリ | リスク | 状態 |
|---|---------|--------|------|
| M1 | 不適切なプラットフォーム使用 | 🟢 低 | H6(権限修正済み ✅), NH2(Deep Link未設定のため実リスクなし) |
| M2 | 安全でないデータストレージ | 🟢 低 | AsyncStorage採用（OCR履歴はユーザー生成テキストのため機密非該当）, NH1(クリップボード自動クリア ✅) |
| M3 | 安全でない通信 | 🟢 低 | L7(SSLピンニング: 将来API連携時に実装) |
| M5 | 不十分な暗号化 | 🟡 中 | OCR履歴はAsyncStorage（平文）。機密情報非該当のため許容。将来API認証情報はexpo-secure-store推奨 |
| M7 | 脆弱なコード品質 | 🟡 中 | L1(TypeScript未使用), L2(テスト0件) |
| M8 | コード改ざん | 🟢 低 | L6(難読化: ストアリリース前に対応) |

### セキュリティ状態サマリー

| カテゴリ | 状態 | リスクレベル |
|---------|------|------------|
| データストレージ | AsyncStorage（OCR履歴は機密情報非該当のため平文で許容）✅ | 🟢 LOW |
| クリップボード | 30秒自動クリア ✅ | 🟢 LOW |
| ログ出力 | 全削除済み ✅ | 🟢 解消済み |
| パーミッション | recordAudioAndroid: false ✅ | 🟢 LOW |
| Deep Linking | 未設定（実リスクなし） | 🟢 LOW |
| 入力検証 | JSON.parseバリデーション済み ✅ | 🟢 解消済み |
| 依存関係 | patch-package 削除済み（react-native-vision-camera も削除）✅ | 🟢 LOW |
| npm脆弱性 | npm audit 0 vulnerabilities ✅ | 🟢 解消済み |
| エラー監視 | Sentry統合済み（DSN設定済み: .env.local）✅ | 🟢 LOW |

---

## 本番運用準備状況（2026-03-01 更新）

| カテゴリ | スコア | 状態 |
|---------|-------|------|
| ビルド設定 | 90/100 | ✅ 全プロファイルに node バージョン統一・preview チャンネル追加 |
| アプリ設定 | 85/100 | ✅ microphonePermission 削除・fallbackToCacheTimeout: 0 追加 |
| ストア準備 | 0/100 | ❌ アイコン・プライバシーポリシー・スクリーンショット未作成（次回実施予定） |
| エラー監視 | 88/100 | ✅ Sentry統合済み・tracesSampleRate: 0.1 に適正化 |
| OTA機能 | 90/100 | ✅ EAS Update 構成済み・fallbackToCacheTimeout 追加 |
| パフォーマンス | 96/100 | ✅ FlatList最適化・全useCallback化・processedURIキャッシュ完了 |

### 次回実施予定（ストア提出前）
1. アプリアイコン作成（icon.png 1024×1024、adaptive-icon.png、splash-icon.png）
2. プライバシーポリシー作成・GitHub Pages 公開・Google Play Console に URL 登録
3. Cloud Vision API キーに Android アプリ制限を設定（Google Cloud Console）
4. EAS Build（production）→ Google Play 内部テストトラックへ提出

---

## 修正優先順位（2026-03-01 最終更新）

1. ~~**Phase 0 (ビルド安定化)**~~: ✅ 完了 — パッケージアップグレード + EdgeToEdge修正
2. ~~**Phase 1 (CRITICAL)**~~: ✅ 完了 — C1-C4 全件修正済み
3. ~~**Phase 2A (パフォーマンスCRITICAL)**~~: ✅ 完了 — NC1-NC3, NH6
4. ~~**Phase 2B (既知HIGH)**~~: ✅ 完了 — H1,H3,H5,H6,NH5,NH6
5. ~~**Phase 2C (本番運用準備)**~~: ✅ 完了 — NH3,NH4
6. ~~**Phase 3 (MEDIUM)**~~: ✅ 完了 — M1,M4,M5,NM1-NM3,NH1
7. ~~**Phase 4 (LOW 一部)**~~: ✅ 完了 — L3,L5
8. ~~**残タスク**: EAS Build（新パッケージ）→ Sentry DSN 設定~~: ✅ 完了（2026-02-21）
9. ~~**Phase 5 (4エージェント並列レビュー後 CRITICAL/HIGH/MEDIUM)**~~: ✅ 完了（2026-03-01）
10. **次回実施**: アイコン作成 → プライバシーポリシー公開 → API キー制限 → EAS Build (production) → ストア提出

---

## 2026-03-01 実施作業（4エージェント並列レビュー + Phase 5 修正）

### レビュー体制

4つのエージェントを並列実行して包括的レビューを実施:
- `code-reviewer`（コード品質・設計・バグ）
- `rn-security-auditor`（OWASP Mobile Top 10・APIキー管理）
- `rn-performance-optimizer`（レンダリング・メモリ・FlatList）
- `expo-specialist`（EAS Build/Update・本番運用準備）

### Phase 5 CRITICAL 修正

| 修正ID | 問題 | ファイル | 修正内容 |
|--------|------|---------|---------|
| C1-new | Cloud Vision fetch タイムアウト未設定 | `cloudVisionOCR.js` | `signal: AbortSignal.timeout(30000)` 追加 |
| C2-new | Cloud Vision APIエラーメッセージが Sentry に漏出 | `cloudVisionOCR.js` | エラーメッセージをサニタイズ（Google内部文字列を除去） |
| C3-new | `recognizeText` が `useCallback` 未使用 → `useEffect` 依存配列不正 | `HomeScreen.js` | `recognizeText` を `useCallback([image, applyOCRResult])` 化。`useEffect` deps を `[image, recognizeText]` に修正 |

### Phase 5 HIGH 修正

| 修正ID | 問題 | ファイル | 修正内容 |
|--------|------|---------|---------|
| H1-new | クリップボードタイマーがアンマウント時にリークする | `HistoryScreen.js` | `clipboardTimerRef` + cleanup `useEffect` を追加 |
| H2-new | `openCamera`, `applyOCRResult`, `recognizeTextHighPrecision`, `clearResult`, `saveToHistory`, `toggleEdit` が `useCallback` 未使用 | `HomeScreen.js` | 全関数を `useCallback` 化（適切な依存配列付き） |
| H3-new | `deleteItem` の `setState` updater 内で非同期 Storage 書き込み（副作用混入） | `HistoryScreen.js` | `historyRef` パターンで分離。updater 外でストレージ書き込み |
| H4-new | `microphonePermission` が app.json に残存（iOS 審査リスク） | `app.json` | `microphonePermission` キーを削除 |
| H5-new | `tracesSampleRate: 1.0`（本番で全トレース送信、Sentry クォータ枯渇リスク） | `monitoring.js` | `1.0` → `0.1` に変更 |
| H6-new | FlatList に `getItemLayout` / `initialNumToRender` 未設定 | `HistoryScreen.js` | `getItemLayout`（ITEM_HEIGHT=132）、`initialNumToRender: 10`、`windowSize: 10`、`removeClippedSubviews: true` 追加 |

### Phase 5 MEDIUM 修正

| 修正ID | 問題 | ファイル | 修正内容 |
|--------|------|---------|---------|
| M1-new | `clearAllHistory`, `closeModal`, `copyToClipboard` が `useCallback` 未使用 | `HistoryScreen.js` | 全関数を `useCallback` 化 |
| M2-new | `preprocessImageForOCR` が `recognizeText` と `recognizeTextHighPrecision` の両方で実行（二重処理） | `HomeScreen.js` | `processedUri` state を追加。`recognizeText` 後にキャッシュ → 高精度ボタンで `??` 演算子で再利用。`clearResult` でクリア |
| M3-new | `SecureStorage` という名前が誤解を招く（実態は AsyncStorage の薄いラッパー） | `secureStorage.js`, `HomeScreen.js`, `HistoryScreen.js` | `AppStorage` にリネーム。コメントを「非暗号化・OCR履歴専用」と明記 |
| M4-new | `react-native-vision-camera` が未使用のまま残存（バンドルサイズ増加・パッチリスク） | `package.json`, `patches/` | パッケージ削除。`patch-package` も削除。`postinstall` スクリプト削除 |
| M5-new | EAS Build の `development` プロファイルに `node` バージョン未設定 | `eas.json` | `node: "20.14.0"` 追加。`preview` に `channel: "preview"` も追加 |
| M6-new | OTA 失敗時にアプリ起動がブロックされる（`fallbackToCacheTimeout` 未設定） | `app.json` | `updates.fallbackToCacheTimeout: 0` 追加 |

### 変更ファイル一覧（2026-03-01）

| ファイル | 変更概要 |
|---------|---------|
| `src/utils/cloudVisionOCR.js` | fetchタイムアウト + エラーメッセージサニタイズ |
| `src/utils/monitoring.js` | tracesSampleRate: 1.0 → 0.1 |
| `src/utils/secureStorage.js` | SecureStorage → AppStorage リネーム + コメント明確化 |
| `src/screens/HomeScreen.js` | 全関数 useCallback 化 + useEffect deps 修正 + processedUri キャッシュ + AppStorage |
| `src/screens/HistoryScreen.js` | clipboardTimerRef + historyRef + deleteItem 副作用分離 + useCallback + FlatList最適化 + AppStorage |
| `app.json` | microphonePermission 削除 + fallbackToCacheTimeout: 0 |
| `eas.json` | development node 追加 + preview channel/node 追加 |
| `package.json` | react-native-vision-camera 削除 + patch-package 削除 + postinstall 削除 |
| `patches/react-native-vision-camera+4.7.1.patch` | 削除（vision-camera 未使用のため不要） |

### 次回実施予定（コード外作業）

| 優先度 | 作業 | 手順 |
|--------|------|------|
| CRITICAL | アプリアイコン作成 | icon.png(1024×1024)・adaptive-icon.png・splash-icon.png を差し替え |
| CRITICAL | プライバシーポリシー作成・公開 | GitHub Pages で HTML ページを公開 → Google Play Console の「ポリシー」→「アプリのコンテンツ」にURLを登録 |
| MEDIUM | Cloud Vision API キーに制限設定 | Google Cloud Console → 認証情報 → API キー → アプリケーションの制限:「Androidアプリ」→ パッケージ名 + `eas credentials` で取得した SHA-1 を入力 |
| LOW | EAS Build (production) → ストア提出 | `eas build --profile production --platform android` → Google Play 内部テスト → 審査 |

---

## 2026-02-20 実施作業

### Phase 2A + NH6 + H3 + H5（HistoryScreen 一括最適化）

| 修正 | 変更内容 |
|------|---------|
| NC3 | `formatDate` をコンポーネント外のモジュールレベル関数に移動 |
| NC2 | `loadHistory`, `deleteItem`, `openItem` を `useCallback` 化。`deleteItem` は functional setState でクロージャ回避 |
| NC1 | `SwipeableHistoryItem` を `React.memo` でラップ |
| NH6 | `useFocusEffect` の依存配列に `loadHistory` を追加 |
| H3 | `ScrollView + map()` → `FlatList`（仮想化）+ `renderItem(useCallback)` |
| H5 | `HISTORY_KEY` を `src/constants/storage.js` に共通化。両画面から import |

### Phase 2B/2C/3/4 一括実施（JS変更のみ・ビルド不要）

**新規作成ファイル（8件）**

| ファイル | 内容 |
|---------|------|
| `src/constants/colors.js` | COLORS 定数（primary, background, white, textPrimary, textSecondary, border, danger, shadow, overlay） |
| `src/constants/messages.js` | MESSAGES 定数（ERROR, SUCCESS, CONFIRM, INFO）— i18n 対応可能な構造 |
| `src/constants/app.js` | HISTORY_LIMIT=100, MAX_TEXT_LENGTH=5000, CLIPBOARD_CLEAR_DELAY=30000 |
| `src/components/ActionButton.js` | 3ボタン共通の基底コンポーネント（position:absolute, 60x60, primary色, shadow） |
| `src/components/ErrorBoundary.js` | 未捕捉例外をキャッチして再試行画面を表示。Sentry 送信対応 |
| `src/utils/secureStorage.js` | `react-native-encrypted-storage` ラッパー。AsyncStorage からの自動マイグレーション付き |
| `src/utils/monitoring.js` | Sentry 初期化・captureError。DSN未設定時はノーオペレーション |
| `.env.example` | `EXPO_PUBLIC_SENTRY_DSN` 設定テンプレート |

**更新ファイル（10件）**

| ファイル | 修正内容 |
|---------|---------|
| `src/components/FloatingButton.js` | ActionButton 委譲（5行に削減） |
| `src/components/SaveButton.js` | 同上 |
| `src/components/ClearButton.js` | 同上 |
| `src/navigations/stack/HomeStack.js` | ハードコードカラー → COLORS |
| `src/screens/HomeScreen.js` | M1（ボタンScrollView外）, M4（UUID）, NM3（文字制限）, COLORS/MESSAGES, SecureStorage, captureError |
| `src/screens/HistoryScreen.js` | NH1（クリップボード自動クリア）, COLORS/MESSAGES, SecureStorage, captureError |
| `App.js` | ErrorBoundary ラップ + initMonitoring() + Sentry.wrap(AppContent) |
| `app.json` | H6(recordAudioAndroid:false), NH5(iOS bundleId), NH4(runtimeVersion+updates.url), 権限説明日本語化 |
| `eas.json` | production に node/distribution/channel/android.buildType 追加 |
| `package.json` | @sentry/react-native ~7.2.0 追加（react-native-encrypted-storage は 2026-02-21 に削除） |

### ~~次に実行すべきコマンド~~（✅ 2026-02-21 実施済み）

> **注意**: 以下のコマンドは実施済みです。再実行しないでください。
> `react-native-encrypted-storage` は 2026-02-21 に削除済みです（インストール不要）。

```bash
# ✅ 完了: @sentry/react-native ~7.2.0 インストール済み（package.json 参照）
# ✅ 完了: .env.local に EXPO_PUBLIC_SENTRY_DSN 設定済み
# ✅ 完了: EAS Build 実行済み（ビルドID: ca27a4c4）
```

次回ビルドが必要な場合:

```bash
eas build --profile development --platform android --no-wait
```

---

## ビルド安定性分析（2026-02-14 最終更新）

### ✅ ビルド成功 (2026-02-19 最新)

- **ビルドID**: `3c96e332-6989-403d-acec-9e80101bed38`
- **APK**: https://expo.dev/accounts/hiro8277/projects/react-native-text-ml-kit-text-recognition3/builds/3c96e332-6989-403d-acec-9e80101bed38
- **内容**: OCR認識率改善（画像前処理 + ゴミ文字フィルタ）

#### 前回ビルド (2026-02-14)

- **ビルドID**: `9c7f0a6a-16e5-4f33-bc7e-43cd79499665`
- **コミット**: `5ebd673`

### EASビルドエラー履歴と解決策

| # | エラー内容 | 根本原因 | 解決策 | 状態 |
|---|-----------|---------|--------|------|
| 1 | expo-dev-launcher Kotlin メタデータ不整合 | Kotlin 1.9.24 vs RN 2.1.0 | patch-package で修正 | ✅→パッケージアップグレードで不要に |
| 2 | react-native-reanimated 3.17.5 コンパイルエラー | RN 0.81.5 互換性なし | reanimated 4.1.x アップグレード | ✅ 解決 |
| 3 | react-native-vision-camera Kotlin エラー | MutableMap, currentActivity API変更 | patch-package で修正 | ✅ 解決（パッチ継続中） |
| 4 | expo-dev-menu JSC API 参照エラー | RN 0.81.5 で JSC 完全削除 | patch-package → パッケージアップグレードで根本解決 | ✅ 解決 |
| 5 | expo-dev-launcher 6ファイル JSC+API変更 | 同上 + RN 0.81.5 メソッドシグネチャ変更 | パッチ作成 → EASで上書きされる → パッケージアップグレードで根本解決 | ✅ 解決 |
| 6 | Theme.EdgeToEdge not found | android/ が旧SDK生成、EdgeToEdgeテーマリソース欠落 | edge-to-edge無効化（Theme.AppCompat.Light.NoActionBar） | ✅ 解決 |

### 重要な教訓: patch-package vs パッケージアップグレード

**patch-packageの問題点（EAS Build環境）**:
- EAS Buildは`npm ci`(postinstall)後、`gradlew`実行前に何らかのステップでnode_modulesを上書きする
- そのため、postinstallで適用したパッチが消える
- Gradle preBuildフックで再適用を試みたが、`npx`がGradleのexec PATHに存在しない

**正しい解決策**: パッケージを正しいバージョンにアップグレードする
- `npx expo install --check` で SDK 54 期待バージョンを確認
- `npx expo install <packages>` でアップグレード
- パッチが不要になり、EAS Build環境での上書き問題も回避

### パッケージアップグレード履歴 (2026-02-14)

| パッケージ | 変更前 | 変更後 | 理由 |
|-----------|--------|--------|------|
| expo | ~54.0.28 | ~54.0.33 | SDK 54 最新パッチ |
| expo-dev-client | ~5.2.4 | ~6.0.20 | RN 0.81.5 互換 (expo-dev-launcher 6.0.20 / expo-dev-menu 7.0.18) |
| expo-camera | ~16.1.11 | ~17.0.10 | SDK 54 期待バージョン (MAJOR) |
| expo-status-bar | ~2.2.3 | ~3.0.9 | SDK 54 期待バージョン (MAJOR) |
| expo-image-picker | ~17.0.9 | ~17.0.10 | SDK 54 期待バージョン (PATCH) |
| react-native-gesture-handler | ~2.24.0 | ~2.28.0 | SDK 54 期待バージョン |
| react-native-safe-area-context | 5.4.0 | ~5.6.0 | SDK 54 期待バージョン |
| react-native-screens | ~4.11.1 | ~4.16.0 | SDK 54 期待バージョン |
| react-native-reanimated | ^3.17.5 | ~4.1.1 | RN 0.81.5 互換性 |
| react-native-worklets | (新規) | 0.5.1 | reanimated peer dep |

### 現在のパッチ状況 (patches/)

| パッチファイル | 修正内容 | 必要性 |
|--------------|---------|--------|
| `react-native-vision-camera+4.7.1.patch` | `.build()` → `.toMutableMap()` / `currentActivity` → `reactApplicationContext.currentActivity` | RN 0.81.5 API変更対応。vision-cameraはExpo管理外のため引き続き必要 |

**削除済みパッチ**: `expo-dev-launcher+5.1.16.patch`, `expo-dev-menu+6.1.14.patch`, `react-native-reanimated+3.17.5.patch`

### EdgeToEdge問題 (2026-02-14 修正)

- `app.json` の `edgeToEdgeEnabled: true` と `gradle.properties` の `expo.edgeToEdgeEnabled=true` が有効だったが、android/のテーマリソースに `Theme.EdgeToEdge` が未定義
- Edge-to-EdgeはAndroid 15+ (API 35) + Material3 + `react-native-edge-to-edge`パッケージが必要
- MVP段階では不要のため無効化: `Theme.AppCompat.Light.NoActionBar` に変更
- 将来的に必要になれば `npx expo install react-native-edge-to-edge` で対応可能

### expo doctor 結果 (2026-02-14)

- **修正前**: 5エラー（パッケージバージョン不整合、スキーマエラー、peer dep欠落等）
- **修正後**: 2警告のみ（ビルドに影響なし）
  - CNG/Prebuild設定の警告（android/フォルダ存在時のapp.json同期に関する情報）
  - サードパーティパッケージのReact Native Directoryメタデータ警告

### Expo Go について

このプロジェクトは以下のネイティブモジュールを含むため **Expo Go では動作しない**:
- @react-native-ml-kit/text-recognition
- react-native-vision-camera
- @react-native-vector-icons/fontawesome6
- @sentry/react-native（2026-02-20 追加）
- expo-crypto（2026-02-21 追加）

実機テストには **EAS Development Build** (カスタムAPK) が必須。

### ビルド成功後の手順

1. `.env.local` に `EXPO_PUBLIC_SENTRY_DSN` を設定（設定済みであれば不要）
2. `eas build --profile development` でDev Build作成
3. `npx expo start --dev-client` でdevサーバー起動
4. 実機でAPKをインストール → devサーバーに接続

---

## CVE調査結果 (2026-02-13)

### CVE-2025-55182 (React2Shell)

- **CVSS**: 10.0 (CRITICAL)
- **影響範囲**: React Server Components (react-server-dom-webpack 等)
- **本プロジェクトへの影響**: **なし** — React Native モバイルアプリのためServer Components は非該当
- **対応**: 不要

### npm audit

- **修正前**: brace-expansion (HIGH), tar (HIGH), undici (MODERATE) の3件
- **修正後**: `npm audit fix` で **0 vulnerabilities** ✅

---

## OCR改善ロードマップ

| フェーズ | 内容 | コスト | 期待効果 | 状態 |
|---------|------|--------|---------|------|
| **Phase 1** | 画像前処理 + ゴミ文字フィルタ | 0 | 認識率 10-30%↑ | ✅ 完了 |
| **Phase 2** | Google Cloud Vision API 主エンジン化 | 0（月1000回無料） | 認識率 50-80%↑ | ✅ 完了（Phase 4B として実装） |
| **Phase 3** | UX改善（編集機能、プレビュー、高精度ボタン） | 0 | ユーザー体験向上 | ✅ 完了 |
| **Phase 4** | 前処理強化 + Cloud Vision 主エンジン化 | 0 | 認識率 大幅改善 | ✅ 完了（4A+4B） |

### Phase 2: Cloud Vision API 主エンジン化 ✅ 完了（Phase 4B として実装）

- Cloud Vision API を**主エンジン**、ML Kit を**オフライン/失敗時フォールバック**として実装
- 月1000回無料枠、`DOCUMENT_TEXT_DETECTION`（縦書き・段落構造対応）使用
- APIキーは`EXPO_PUBLIC_CLOUD_VISION_API_KEY`で環境変数管理
- 未設定時は ML Kit のみ（オフライン動作）
- 実装: `src/utils/cloudVisionOCR.js`（新規）、`HomeScreen.js` 更新

### Phase 3: UX改善 ✅ 完了（2026-02-24 Sprint 1+2 として実装）

1. ~~認識結果の手動編集機能~~ ✅ 3-C: 編集トグルボタン（pen/check）
2. ~~認識前の画像プレビュー表示~~ ✅ 3-A: OCR中も表示継続
3. ~~「高精度モードで再認識」ボタン~~ ✅ 3-D: ML Kit使用時のみ表示（Cloud Vision強制実行）

### Phase 4: 代替OCRエンジン検討

| エンジン | 日本語精度 | 速度 | アプリサイズ | コスト | オフライン |
|----------|-----------|------|-------------|--------|-----------|
| ML Kit（現状） | 低-中 | 高速 | +約20MB | 無料 | 対応 |
| Cloud Vision API | 非常に高 | 中 | なし | 無料枠1000回/月 | 非対応 |
| Tesseract (jpn_best) | 中-高 | 低速(3-10秒) | +15-30MB | 無料 | 対応 |
| PaddleOCR | 非常に高 | 中 | +50-100MB | 無料 | 対応 |
| Apple Vision | 高 | 高速 | なし | 無料 | 対応(iOS専用) |

**最適解**: Phase 1 + Phase 2 の組み合わせ（完全無料で日本語認識精度を大幅改善）

### 代替エンジン調査結果（2026-02-24 結論）

#### Tesseract（不採用）
- **根本的問題**: 既存 RN パッケージ（react-native-tesseract-ocr 等）が旧 NativeModules ベース → `react-native-encrypted-storage` と同じ New Architecture 非対応の失敗パターン
- `newArchEnabled=true` は `react-native-reanimated ~4.1.1` 必須のため変更不可
- `tesseract.js` WASM は Hermes で 20〜60 秒（ML Kit の 30〜120 倍遅い）
- ネイティブ Tesseract でも 3〜10 秒（ML Kit の 5〜10 倍遅い）→ UX として許容不可
- **判断: 導入しない**

#### PaddleOCR（アプリ内組み込みは不採用）
- 公式 React Native パッケージなし（Python/C++ ベース）
- アプリサイズ +50〜100MB
- Cloud Vision API と精度同等、実装コストが極めて高い
- **判断: アプリ内組み込みはしない**
- **注意**: バックエンドサービス（ConoHa VPS + Docker + FastAPI）として外出しする案は別途検討中 → 「バックエンド OCR アーキテクチャ計画」セクション参照

### 個人開発 OCR アプリの業界調査結果（2026-02-24）

#### 典型的なアーキテクチャ分布

| パターン | 採用率 | 代表例 |
|---------|--------|--------|
| **ML Kit のみ（完全オンデバイス）** | 70%+ | 多数の RN 製 OCR アプリ |
| **Tesseract のみ（完全オフライン）** | 15% | Text Fairy (OCR Text Scanner) |
| **Cloud Vision + バックエンド Proxy** | 10% | 有料サブスク系アプリ |
| **全部入り（ML Kit + Tesseract + Cloud Vision）** | 5% | Android-OCR-Text-Recognition-Scanner（OSS） |

#### 参考アプリの実態

| アプリ | エンジン | モデル | 備考 |
|--------|---------|--------|------|
| **Text Fairy (OCR Text Scanner)** | Tesseract | 完全オフライン | OSS・jpn.traineddata 内蔵 |
| **Text Scanner [OCR]** (com.peace.TextScanner) | 非公開（推定 ML Kit + Cloud Vision） | フリーミアム | 無料 = オンデバイス、有料 = Cloud Vision（サーバー経由） |
| **Android-OCR-Text-Recognition-Scanner** | ML Kit + Tesseract + Cloud Vision | 選択式 | GitHub OSS。3エンジン共存の参考実装 |

#### 本プロジェクトへの適用方針

```
【現在】開発・テスト環境
  .env.local に EXPO_PUBLIC_CLOUD_VISION_API_KEY 設定
  → Cloud Vision 主エンジン + ML Kit フォールバック

【本番リリース時（フェーズ1）】
  EXPO_PUBLIC_CLOUD_VISION_API_KEY を設定しない
  → ML Kit のみ（キー漏洩リスクゼロ・コストゼロ）
  ※ isCloudVisionAvailable() = false で自動的に ML Kit 専用モードへ

【スケール後（フェーズ2）】
  自社バックエンド（BFF）経由で Cloud Vision を提供
  → 有料ユーザーのみ高精度認識
  → APIキーはサーバー側で管理（アプリに埋め込まない）
```

> **教訓**: 個人開発 OCR アプリの成功パターンは「まず ML Kit でリリース、スケール後に課金モデルを追加」。APIキー漏洩・コスト爆発・実装複雑化を避けて早期リリースを優先する。

---

## バックエンド OCR アーキテクチャ計画（ConoHa VPS + Docker + PaddleOCR + FastAPI）

> **分析日**: 2026-02-24 | **状態**: 計画中（未実装）| **対象フェーズ**: スケール後 Phase 3

### 概要

PaddleOCR をアプリ内に組み込む代わりに、**セルフホスト型バックエンドサービス**として運用する案。
月間 OCR 回数が1万回を超えた段階・プライバシー要件が厳しくなった段階で Cloud Vision API から移行する。

### アーキテクチャ図

```
[React Native App]
      │ POST /ocr (JPEG base64 + Bearer token)
      │ HTTPS
      ▼
[ConoHa VPS Tokyo]
  ┌──────────────────────────────────┐
  │  Nginx (リバースプロキシ + SSL)   │
  └──────────────┬───────────────────┘
                 │
  ┌──────────────▼───────────────────┐
  │  FastAPI                          │
  │  ├─ JWT/APIKey 認証              │
  │  ├─ レートリミット               │
  │  ├─ 画像バリデーション           │
  │  └─ PaddleOCR 推論              │
  └──────────────────────────────────┘
  ↕ Docker Compose
```

### ConoHa VPS プランと推奨構成

| プラン | RAM | CPU | 月額 | PaddleOCR |
|--------|-----|-----|------|-----------|
| 1GB | 1GB | 2コア | ¥550 | ❌ 不可 |
| 2GB | 2GB | 3コア | ¥880 | △ slim モデルのみ |
| **4GB** | 4GB | 6コア | **¥1,650** | ✅ **推奨**（standard モデル動作） |
| 8GB | 8GB | 8コア | ¥3,300 | ✅ 余裕あり |

**推奨: 4GB プラン（¥1,650/月）**
- PP-OCRv4 standard（det + rec + cls ≈ 1.5GB）が動作
- Docker + Nginx + FastAPI の並列動作に余裕
- 同時推論 2〜3 リクエストまで対応

### PaddleOCR モデル選択

| モデル | 日本語精度 | メモリ | CPU推論速度 |
|--------|-----------|--------|------------|
| PP-OCRv4 standard | 非常に高 | ~1.5GB | 1〜3秒 |
| PP-OCRv4 slim | 高 | ~400MB | 0.5〜1秒 |
| PP-OCRv4 server | 最高 | ~3GB | 3〜8秒 |

設定: `use_angle_cls=True`（縦書き対応）、`lang='japan'`

### コスト比較（Break-even 分析）

| 月間OCR回数 | Cloud Vision費用 | VPS費用(4GB) | 差額 |
|-----------|-----------------|-------------|------|
| ≤1,000 | ¥0 | ¥1,650 | VPS が¥1,650高い |
| 5,000 | ¥600 | ¥1,650 | VPS が¥1,050高い |
| 10,000 | ¥1,230 | ¥1,650 | VPS が¥420高い |
| **≈11,000** | **≈¥1,650** | **¥1,650** | **損益分岐点** |
| 50,000 | ¥6,150 | ¥1,650 | VPS が¥4,500安い |

※ Cloud Vision 料金: 月1000回超は $0.0015/回（≈¥0.23/回）

### React Native 側の変更（実装時）

```javascript
// src/utils/paddleOCRApi.js（新規作成予定）
const BACKEND_URL = process.env.EXPO_PUBLIC_PADDLEOCR_API_URL;
const BACKEND_KEY = process.env.EXPO_PUBLIC_PADDLEOCR_API_KEY;

export const isBackendOCRAvailable = () =>
  Boolean(BACKEND_URL && BACKEND_KEY);

export const recognizeTextWithBackend = async (imageUri) => {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: "base64"  // expo-file-system/legacy
  });
  const response = await fetch(`${BACKEND_URL}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BACKEND_KEY}`,
    },
    body: JSON.stringify({ image_base64: base64 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Backend OCR failed: ${response.status}`);
  const { text } = await response.json();
  return text;
};
```

フォールバック戦略（移行後）:
```
Backend PaddleOCR → 失敗 → Cloud Vision → 失敗 → ML Kit
```

### Docker Compose 構成

```yaml
services:
  paddleocr-api:
    build: ./api
    restart: unless-stopped
    volumes:
      - paddleocr_models:/root/.paddleocr  # モデルキャッシュ（再起動高速化）
    environment:
      - API_SECRET_KEY=${API_SECRET_KEY}
    mem_limit: 3g          # OOM キラー対策
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - certbot_certs:/etc/letsencrypt

  certbot:
    image: certbot/certbot
    # Let's Encrypt 自動更新
```

**Dockerfile のポイント**: `FROM python:3.11-slim` ベース。ビルド時にモデルを事前ダウンロードして Volume にキャッシュ → コンテナ再起動時の遅延（30〜60秒）を回避。

### FastAPI 実装の核心

```python
# PaddleOCR は同期ライブラリ → ThreadPoolExecutor で async に変換
ocr = PaddleOCR(use_angle_cls=True, lang='japan', use_gpu=False)
executor = ThreadPoolExecutor(max_workers=2)  # CPUコア数に合わせる

@app.post("/ocr")
async def recognize_text(request: OCRRequest):
    img = decode_base64_image(request.image_base64)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, lambda: ocr.ocr(img, cls=True))
    lines = [line[1][0] for page in result if page for line in page]
    return {"text": "\n".join(lines), "engine": "paddleocr-v4"}
```

### リスクと対策

| リスク | 深刻度 | 対策 |
|--------|--------|------|
| VPS 障害時の全停止 | 高 | ML Kit フォールバック維持（既実装） |
| APIキーの漏洩 | 中 | Bearer token + IP制限 + レートリミット |
| メモリ不足（OOM） | 中 | `mem_limit: 3g` + スワップ設定 |
| インフラ管理工数 | 高 | 初期設定後は SSL 自動更新で最小化 |
| 大きなDockerイメージ | 低 | python:3.11-slim + multi-stage build |

### 推奨移行タイミング

```
【現在 = Phase 1】ML Kit + Cloud Vision API（.env.local）
  → MVP・ユーザー数少数・無料枠(1000回/月)で十分

【Phase 2: BFF Proxy（ユーザー増加時）】
  ConoHa VPS 1GB + Nginx + Node.js
  → Cloud Vision の APIキーをサーバー管理（アプリから排除）
  → ¥880/月

【Phase 3: PaddleOCR 移行（月1万回超）】
  ConoHa VPS 4GB + Docker + PaddleOCR + FastAPI
  → コスト固定化（¥1,650/月）・プライバシー強化
  → .env.example に EXPO_PUBLIC_PADDLEOCR_API_URL/KEY を追加
```

### 総合評価

| 観点 | 評価 |
|------|------|
| 技術的実現可能性 | ✅ 高（FastAPI + PaddleOCR は成熟した組み合わせ） |
| 日本語OCR精度 | ✅ 非常に高（Cloud Vision と同等以上、縦書き対応） |
| 現時点でのROI | ⚠️ 低（月1万回以上でないとコスト優位なし） |
| APIキーセキュリティ | ✅ 優秀（アプリバンドルからキーを完全排除） |
| 実装・運用コスト | ⚠️ 高（SSL管理・Docker監視が必要） |
| **総合判断** | **Phase 3 向き。スケール後の最有力移行先** |

---

## OCR認識率改善 Phase 1 (2026-02-19 実施) ✅

### 実装内容

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/imagePreprocessing.js` | **新規作成** — expo-image-manipulatorで画像前処理（リサイズ1920px、JPEG圧縮0.9、EXIF回転自動補正） |
| `src/utils/textFilter.js` | **新規作成** — OCR結果から空白行・1文字行を除去するフィルタ |
| `src/screens/HomeScreen.js` | recognizeText関数に前処理とフィルタを組み込み |
| `package.json` | `expo-image-manipulator` 追加 |

### OCR処理フロー（Phase 1 実装時）

```
画像取得 → preprocessImageForOCR(リサイズ1920px+JPEG0.9+EXIF補正) → ML Kit認識 → filterOCRResult(ゴミ文字除去) → 5000文字制限チェック → 表示
```

### OCR処理フロー（Phase 4A+4B 実装後・現在）

```
画像取得
  → preprocessImageForOCR(最長辺2400px適応リサイズ + JPEG0.95 + EXIF補正)
  → Cloud Vision API 有効？
      YES: DOCUMENT_TEXT_DETECTION(ja/en) → 失敗時 ML Kit にフォールバック
      NO:  ML Kit(JAPANESE) のみ
  → filterOCRResult(ゴミ文字除去)
  → 5000文字制限チェック
  → 表示
```

---

## OCR改善 Phase 4A+4B (2026-02-23 実施) ✅

### Phase 4A: 画像前処理強化

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/imagePreprocessing.js` | MAX_DIMENSION: 1920 → 2400。縦横比を取得し最長辺基準の**適応的リサイズ**に変更。compress: 0.9 → 0.95（テキスト境界の鮮明さ向上） |

**変更の意図**:
- 1920px固定→2400px: Cloud Vision API の推奨解像度に合わせて精度向上
- 適応的リサイズ: 縦長画像を幅基準でリサイズすると高さが極端に小さくなる問題を解消
- compress 0.95: JPEG劣化によるテキスト境界の滲みを抑制

### Phase 4B: Cloud Vision API 主エンジン化

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/cloudVisionOCR.js` | **新規作成** — `isCloudVisionAvailable()` + `recognizeTextWithCloudVision(imageUri)` |
| `src/screens/HomeScreen.js` | `recognizeText` を3分岐に更新（Cloud Vision主→失敗時ML Kitフォールバック→未設定時ML Kitのみ） |
| `package.json` | `expo-file-system ~17.0.1` 追加（cloudVisionOCR.js の base64変換に使用） |
| `.env.example` | `EXPO_PUBLIC_CLOUD_VISION_API_KEY` エントリ追加 |

**Cloud Vision API 選択理由**:
- `DOCUMENT_TEXT_DETECTION`: テキスト散在向けの `TEXT_DETECTION` と異なり、段落・縦書きを含む文書構造を保持。日本語 OCR に最適
- `languageHints: ["ja", "en"]`: 日英混在文書の認識精度向上
- `expo-file-system` は `expo-image-manipulator` の transitive dep として既にコンパイル済み → EAS Build 不要（package.json 明示追加のみ）

**設定方法**:
1. `.env.local` に `EXPO_PUBLIC_CLOUD_VISION_API_KEY=<your_key>` を追加
2. JS バンドル再ビルド（`npx expo start` 再起動）で有効化
3. 未設定時は自動的に ML Kit のみで動作（既存動作維持）

---

## Cloud Vision API 実機動作確認 (2026-02-23) ✅

### 実施内容

Google Cloud Console でのAPIキー取得〜実機での動作確認を完了。

| 手順 | 内容 | 状態 |
|------|------|------|
| Google Cloud プロジェクト作成 | console.cloud.google.com でプロジェクト新規作成 | ✅ |
| Cloud Vision API 有効化 | APIとサービス → ライブラリ → Cloud Vision API → 有効にする | ✅ |
| APIキー作成 | 認証情報 → + 認証情報を作成 → APIキー（サービスアカウント不要） | ✅ |
| `.env.local` に設定 | `EXPO_PUBLIC_CLOUD_VISION_API_KEY=AIzaSy...` | ✅ |
| 実機動作確認 | 一時的DEBUGアラートで `Cloud Vision 使用: true` を確認 | ✅ |

### 重要な教訓

- **サービスアカウント不要**: モバイルアプリから直接APIを呼ぶ場合は「APIキー」のみで動作。サービスアカウントはサーバー間通信用
- **認証情報ウィザードは使わない**: 「+ 認証情報を作成」→「APIキー」を直接選ぶ（ウィザードはサービスアカウント作成に誘導されるため混乱しやすい）
- **動作確認方法**: 一時的 `Alert.alert("DEBUG", ...)` を追加して `isCloudVisionAvailable()` の戻り値を確認するのが確実。Google Cloud Console のダッシュボードは反映に1〜2分かかる

### トラブルシューティング (2026-02-24 解決)

| エラー | 原因 | 解決策 |
|-------|------|--------|
| `Cannot read property 'Base64' of undefined` | expo-file-system v17 で `FileSystem.EncodingType` が undefined | `encoding: "base64"` の文字列リテラルを直接使用 |
| `Method readAsStringAsync is deprecated` | expo-file-system v17 で旧API廃止 | import を `"expo-file-system/legacy"` に変更 |

**expo-file-system v17 での正しい import**:
```javascript
// NG: import * as FileSystem from "expo-file-system";
// OK: legacy API を使う場合
import * as FileSystem from "expo-file-system/legacy";
```

### 現在の動作状態

```
画像取得（カメラ or ギャラリー） → 画像プレビュー表示（3-A）
  → preprocessImageForOCR（2400px適応リサイズ + JPEG0.95）
  → ローディング表示（3-B）
  → Cloud Vision API (DOCUMENT_TEXT_DETECTION, ja/en) ✅ 動作中
      └→ 失敗時: ML Kit にフォールバック（engineUsed='ml-kit'）
  → filterOCRResult（記号行・句読点行・1文字行・連続空行を除去）
  → 5000文字制限チェック
  → 表示
      ├ 手動編集トグル（3-C: pen/check ボタン）
      └ ML Kit使用時: 「高精度で再認識」ボタン（3-D） → Cloud Vision 強制実行
```

---

## 2026-02-24 実施作業（UX改善 Sprint 1+2）

### Sprint 1: HomeScreen UX 改善 3点

| 機能 | state/要素 | 実装内容 |
|------|-----------|---------|
| 3-A: 画像プレビュー | `image` (既存) | `<Image>` コンポーネントを OCR 処理中も表示し続ける |
| 3-B: ローディング表示 | `isLoading` (新規) | `ActivityIndicator` + "認識中..."。`try/finally` で確実に解除 |
| 3-C: 手動編集トグル | `isEditing` (新規) | pen/check アイコンで `<Text>` ↔ `<TextInput>` を切り替え |

### Sprint 2: textFilter 強化 + 高精度再認識ボタン (3-D)

**変更ファイル（3件）**

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/textFilter.js` | `NOISE_ONLY_PATTERN`（記号・罫線行）と `PUNCTUATION_ONLY_PATTERN`（句読点のみ行）を追加。連続3行以上の空行を最大2行に正規化 |
| `src/constants/messages.js` | `MESSAGES.ERROR.HIGH_PRECISION_FAILED` 追加 |
| `src/screens/HomeScreen.js` | `engineUsed` state・`applyOCRResult()` ヘルパー・`recognizeTextHighPrecision()` 追加。高精度ボタン JSX・スタイル追加 |

**3-D 表示条件の設計**:
- `text && !isLoading && engineUsed === "ml-kit" && isCloudVisionAvailable()`
- → Cloud Vision が使えるのにフォールバックした場合のみボタンを表示
- → API キー未設定時 (`isCloudVisionAvailable()` = false) はボタン非表示

**`engineUsed` state の役割**:
- `null`: OCR未実行
- `"cloud-vision"`: Cloud Vision 成功 → 高精度ボタン非表示
- `"ml-kit"`: フォールバック発生 → 高精度ボタン表示

> Sprint 1+2 は JS のみの変更（新規ネイティブモジュールなし）。既存 Dev Build で動作確認済み ✅

---

## 2026-02-21 実施作業（ストレージ修正 + UUID修正）

### 発端：実機で「履歴の保存に失敗しました」が発生

EAS Build (`00d61065`, 2026-02-21 8:36完了) 後の実機テストで保存が失敗。
デバッグ Alert を追加したビルド (`ca27a4c4`) で実機確認した結果：

```
[DEBUG] 保存エラー: Property 'crypto' doesn't exist
```

### 調査で判明したこと

| 調査項目 | 結果 |
|---------|------|
| `react-native-encrypted-storage` New Arch 対応 | 非対応（`NativeModules` / `ReactPackage` 使用、`codegenConfig` なし）→ Interop Layer 経由では動作した |
| `newArchEnabled=false` に変更 | `react-native-reanimated ~4.1.1` がNew Arch必須のためビルド失敗 |
| `newArchEnabled` は変更不可 | `react-native-reanimated 4.x` の要件により `true` 固定 |
| 実際の根本原因 | `crypto.randomUUID()` → Hermes に `crypto` グローバルが存在しない |

### 重要な教訓

- **`crypto.randomUUID()` は Hermes RN 0.81.5 で使用不可**（CLAUDE.md の旧記載「RN 0.73+ で利用可」は誤り）
- `react-native-reanimated ~4.1.1` は `newArchEnabled=true` が必須（変更不可）
- `react-native-encrypted-storage` は NativeModules ベースで TurboModule 非対応（Interop Layer では動くが不安定）

### 変更内容

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/secureStorage.js` | `expo-secure-store` 試行 → キー名・サイズ制限で失敗 → **AsyncStorage ラッパー**に最終確定。インターフェース（getItem/setItem/removeItem）は維持 |
| `src/screens/HomeScreen.js` | `crypto.randomUUID()` → `Crypto.randomUUID()` (expo-crypto) |
| `package.json` | `react-native-encrypted-storage` 除去。`expo-secure-store ~15.0.8`、`expo-crypto ~15.0.8` 追加 |
| `app.json` | `expo-secure-store` プラグイン自動追加（npx expo install が実施） |
| `.env.example` | 実際の Sentry DSN をプレースホルダーに変更（セキュリティ対応） |
| `.env.local` | Sentry DSN 設定済み（ユーザーが実施） |

### ストレージ変遷

```
AsyncStorage（平文）
  ↓ H1修正 (2026-02-20)
react-native-encrypted-storage（New Arch非対応 → 実機で失敗）
  ↓ 2026-02-21
expo-secure-store（New Architecture 完全対応・Expo公式）
  ↓ 2026-02-21 実機テストで失敗
AsyncStorage（再採用 - 下記参照）
```

**expo-secure-store が OCR 履歴に不適な理由（2026-02-21 判明）**
1. キー名制限: 英数字・"."・"-"・"_" のみ許可。"@ocr_history" の "@" で `Invalid key` エラー
2. 値サイズ制限: 2048 bytes。JSON 化した履歴はすぐ超過
→ OCR 履歴（ユーザー生成テキスト）は機密情報ではないため AsyncStorage が適切

### パッケージ変更

| パッケージ | 変更 | バージョン |
|-----------|------|---------|
| `react-native-encrypted-storage` | ❌ 除去 | ^4.0.3 |
| `expo-secure-store` | ✅ 追加（package.jsonに残存・OCR履歴には未使用） | ~15.0.8 |
| `expo-crypto` | ✅ 追加 | ~15.0.8 |

> **注意**: `expo-secure-store` は package.json に残っているが OCR 履歴の保存には使用していない（キー名・サイズ制限のため）。将来の認証トークン等の機密情報保存用として保持。

### ビルド履歴 (2026-02-21)

| ビルドID | 状態 | 内容 |
|---------|------|------|
| `3ce6fae7` | in progress（未使用） | 前回の作業開始時に起動 |
| `06c645b6` | ❌ 失敗 | newArch=false → reanimated ビルドエラー |
| `ca27a4c4` | ✅ 完了（診断用） | newArch=true + DEBUG Alert → `Property 'crypto' doesn't exist` 確認 |
| `f3e76004` | ✅ 完了（部分修正） | expo-secure-store 導入済み、crypto未修正 |
| 次回ビルド | ⏳ 未実行 | expo-crypto + Crypto.randomUUID() 修正込み |

### 次に実行すべきコマンド

```bash
eas build --profile development --platform android --no-wait
```

---

## Phase 0〜1 修正詳細（2026-02-13〜2026-02-14 実施）

### コミット履歴

| コミット | 日付 | 内容 |
|---------|------|------|
| `37e1a9f` | 02-13 | パッチファイル3件をgitに追加 |
| `9a992c3` | 02-13 | expo-dev-menu パッチを正しいgitハッシュで再生成 |
| `463c903` | 02-13 | expo-dev-launcher 包括的パッチ(7ファイル)作成 |
| `8602bf0` | 02-14 | postinstallデバッグログ追加（→EASでパッチ上書き問題を発見） |
| `0a6f00a` | 02-14 | Gradle preBuildフックでpatch-package再実行（→npx PATH問題で失敗） |
| `87dffe5` | 02-14 | **根本解決**: 全パッケージをSDK 54期待バージョンにアップグレード、不要パッチ削除 |
| `5ebd673` | 02-14 | Theme.EdgeToEdge修正: edge-to-edge無効化 |
