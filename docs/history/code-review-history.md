# コードレビュー履歴（完了済み）

> 最終更新: 2026-03-01 | すべて修正済み ✅

## Phase 1 CRITICAL (全件修正済み ✅)

| # | 問題 | 修正内容 |
|---|------|---------|
| C1 | console.log 15箇所残留 | HomeScreen.js (8箇所), HistoryScreen.js (7箇所) 全削除 |
| C2 | GestureHandlerRootView 未設置 | App.js に GestureHandlerRootView ラッパー追加 |
| C3 | useLayoutEffect 依存配列が空 | pickImage を useCallback 化、依存配列 [navigation, pickImage] に修正 |
| C4 | JSON.parse未バリデーション | try/catch + Array.isArray ガード追加（両画面） |

## 新規発見 CRITICAL (全件修正済み ✅)

| # | 問題 | 修正内容 |
|---|------|---------|
| NC1 | SwipeableHistoryItem が React.memo 未使用 | React.memo でラップ |
| NC2 | deleteItem/openItem が useCallback 未使用 | useCallback 化 + functional setState でクロージャ回避 |
| NC3 | formatDate がコンポーネント内定義 | コンポーネント外のモジュールレベル関数に移動 |

## HIGH (全件修正済み ✅)

| # | 問題 | 修正内容 |
|---|------|---------|
| H1 | AsyncStorage暗号化なし | AsyncStorage + secureStorage.js ラッパー（OCR履歴は機密情報非該当） |
| H2 | useEffect初回発火 | `if (image)` ガード追加 |
| H3 | ScrollView + map() | FlatList + keyExtractor + renderItem(useCallback) |
| H4 | StatusBar import混在 | expo-status-bar からの import に統一 |
| H5 | HISTORY_KEY重複定義 | src/constants/storage.js に共通化 |
| H6 | 不要パーミッション | app.json の recordAudioAndroid: false |

## 新規発見 HIGH (全件修正済み ✅)

| # | 問題 | 修正内容 |
|---|------|---------|
| NH1 | クリップボードに機密情報コピー | コピー後 30秒で自動クリア（CLIPBOARD_CLEAR_DELAY） |
| NH2 | Deep Linking入力検証なし | 現在 RootNavigation に linking 設定なし → 実リスクなし |
| NH3 | エラー監視未統合 | @sentry/react-native + monitoring.js（DSN設定済み: .env.local） |
| NH4 | EAS Update未構成 | app.json に runtimeVersion + updates.url、eas.json に channel |
| NH5 | iOS bundleIdentifier未設定 | app.json に bundleIdentifier 追加 |
| NH6 | useFocusEffect依存配列不備 | loadHistory を useCallback 化して依存配列に追加 |

## MEDIUM (全件修正済み ✅)

| # | 問題 | 修正内容 |
|---|------|---------|
| M1 | position:absolute in ScrollView | ボタン群を SafeAreaView 直下（ScrollView 外）に移動 |
| M2 | borderRadius重複定義 | borderRadius: 8 削除、30のみに統一 |
| M3 | 未使用import | Button, useColorScheme 削除 |
| M4 | Date.now()でID生成 | Crypto.randomUUID()（expo-crypto）※ Hermes に crypto グローバル非対応のため expo-crypto 必須 |
| M5 | ボタンコンポーネント重複 | ActionButton 共通コンポーネント化 |
| NM1 | カラー値がハードコード散在 | src/constants/colors.js に集約（全ファイル適用） |
| NM2 | エラーメッセージがハードコード | src/constants/messages.js に集約（i18n対応可能な構造） |
| NM3 | 履歴テキストサイズ制限なし | MAX_TEXT_LENGTH = 5000（超過時はアラート付きで先頭部分のみ保存） |

## LOW (対応済み / 将来対応)

| # | 問題 | 状態 | 詳細 |
|---|------|------|------|
| L1 | TypeScript未使用 | 将来対応 | 大規模移行のため別フェーズ |
| L2 | テストファイル0件 | 将来対応 | 別フェーズで対応 |
| L3 | エラーバウンダリ未設置 | ✅ 修正済み | ErrorBoundary コンポーネント + App.js でラップ |
| L4 | isDarkMode未使用 | 将来対応 | ダークモード対応は別フェーズ |
| L5 | 履歴上限100件がマジックナンバー | ✅ 修正済み | HISTORY_LIMIT = 100 を constants/app.js に移動 |
| L6 | コード難読化未実装 | 将来対応 | ProGuard/R8 はストアリリース前に確認 |
| L7 | SSL証明書ピンニング未実装 | 将来対応 | 将来API連携時に実装 |

## Phase 5 修正（2026-03-01 4エージェント並列レビュー後）

| 修正ID | 問題 | ファイル | 修正内容 |
|--------|------|---------|---------|
| C1-new | Cloud Vision fetch タイムアウト未設定 | `cloudVisionOCR.js` | `AbortController + setTimeout(30000)` 追加 |
| C2-new | Cloud Vision APIエラーメッセージが Sentry に漏出 | `cloudVisionOCR.js` | エラーメッセージをサニタイズ |
| C3-new | `recognizeText` が `useCallback` 未使用 | `HomeScreen.js` | `useCallback([image, applyOCRResult])` 化 |
| H1-new | クリップボードタイマーがアンマウント時にリーク | `HistoryScreen.js` | `clipboardTimerRef` + cleanup `useEffect` 追加 |
| H2-new | 複数関数が `useCallback` 未使用 | `HomeScreen.js` | 全関数を `useCallback` 化 |
| H3-new | `deleteItem` の `setState` updater 内で非同期 Storage 書き込み | `HistoryScreen.js` | `historyRef` パターンで分離 |
| H4-new | `microphonePermission` が app.json に残存 | `app.json` | `microphonePermission` キーを削除 |
| H5-new | `tracesSampleRate: 1.0` | `monitoring.js` | `1.0` → `0.1` に変更 |
| H6-new | FlatList に `getItemLayout` / `initialNumToRender` 未設定 | `HistoryScreen.js` | `getItemLayout`（ITEM_HEIGHT=132）、`initialNumToRender: 10` 追加 |
| M1-new | 複数関数が `useCallback` 未使用 | `HistoryScreen.js` | 全関数を `useCallback` 化 |
| M2-new | `preprocessImageForOCR` が二重実行 | `HomeScreen.js` | `processedUri` state でキャッシュ |
| M3-new | `SecureStorage` という名前が誤解を招く | 複数ファイル | `AppStorage` にリネーム |
| M4-new | `react-native-vision-camera` が未使用のまま残存 | `package.json` | パッケージ削除。`patch-package` も削除 |
| M5-new | EAS Build の `development` プロファイルに `node` バージョン未設定 | `eas.json` | `node: "20.14.0"` 追加 |
| M6-new | OTA 失敗時にアプリ起動がブロックされる | `app.json` | `updates.fallbackToCacheTimeout: 0` 追加 |
