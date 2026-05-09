# 作業ログ（日付別）

## 2026-05-09: iOS Dev Build 実機テスト開始 + Firebase 初期化エラー修正

### 作業概要

EAS iOS Dev Build の実機インストールに成功し、Metro 接続・OCR 動作を確認。
Firebase 匿名認証が動かない問題を複数ビルドをかけて調査し、根本原因（@react-native-firebase/app プラグインが Expo SDK 54 の Swift AppDelegate に非対応）を特定して修正した。
最終ビルド（86d8977a）は Firebase 動作確認待ち。

### 完了した作業

| 作業 | 結果 |
|------|------|
| iOS Dev Build 実機インストール（QRコード方式） | ✅ 完了 |
| iPhone Developer Mode 有効化 | ✅ 完了（設定→プライバシーとセキュリティ） |
| Metro 接続（WiFi直結・ポート8081ファイアウォール開放） | ✅ 完了 |
| 実機動作確認（OCR・保存・履歴・AdMob バナー） | ✅ 正常動作 |
| eas.json に SENTRY_DISABLE_AUTO_UPLOAD=true 追加 | ✅ 完了（Sentry org未設定でもビルド通過） |
| GoogleService-Info.plist を git commit（gitignore除外） | ✅ 完了（google-services.json と同様の対応） |
| @react-native-firebase/app を app.json plugins に追加 | ✅ 完了 |
| withFirebaseAppDelegateSwift.js カスタムプラグイン作成 | ✅ 完了（Expo SDK 54 対応） |
| authManager.js モジュールレベル auth() を遅延初期化に変更 | ✅ 完了 |
| RootNavigation.js で getOrCreateAnonymousUser() 呼び出し追加 | ✅ 完了 |

### Firebase 初期化エラーの原因と解決（重要）

**エラー**: `No Firebase App '[DEFAULT]' has been created - call firebase.initializeApp()`

原因の調査過程：

1. **GoogleService-Info.plist が gitignore** → コミットしてもエラー継続
2. **@react-native-firebase/app が plugins 未登録** → 追加してもエラー継続
3. **根本原因判明**: `@react-native-firebase/app` v21 の built-in Config Plugin は AppDelegate を修正する際に `self.moduleName = "..."` という regex でアンカー箇所を探す。しかし **Expo SDK 54 の AppDelegate.swift にはこのパターンが存在しない**（`rootViewFactory.view(withModuleName: "main", ...)` 方式に変更済み）。プラグインは `WarningAggregator.addWarningIOS` を呼んで黙ってスキップするため、ビルドは通るがランタイムでクラッシュする。

**修正方法**: `plugins/withFirebaseAppDelegateSwift.js` カスタムプラグインを作成し、`withAppDelegate` mod を使って AppDelegate.swift に直接 `import FirebaseCore` と `FirebaseApp.configure()` を注入。

```javascript
// plugins/withFirebaseAppDelegateSwift.js
// didFinishLaunchingWithOptions の開き括弧直後に FirebaseApp.configure() を挿入
const didFinishLaunchingRegex =
  /(override func application\([\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;
contents = contents.replace(didFinishLaunchingRegex, `$1\n    ${configureCall}`);
```

app.json plugins 登録順:
```json
"@react-native-firebase/app",
"./plugins/withFirebaseAppDelegateSwift",  ← 必ずこの順番
```

### 実機テスト結果

| 機能 | 状態 | 備考 |
|------|------|------|
| ML Kit OCR（印刷文字） | ✅ 正常 | オフライン動作確認済み |
| 保存・履歴表示・削除 | ✅ 正常 | |
| AdMob バナー | ✅ テスト広告表示 | |
| カメラ撮影後の画像取り込み | ⚠️ 要確認 | iOS 設定→写真→「すべての写真」に変更要 |
| Firebase 匿名認証 | ✅ 正常 | build 86d8977a で Firebase Console に匿名ユーザー追加を確認 |
| Gemini API（RECEIPT/EDUCATION） | 未確認 | 次回実施 |

### 今日のビルド履歴

| Build ID | 内容 | 状態 |
|----------|------|------|
| 91765774 | Sentry auto-upload 無効化 | ✅ 成功（最初の動作ビルド） |
| 05eadd8d | GoogleService-Info.plist コミット | ✅ 成功（Firebase エラー継続） |
| 0b212a8a | @react-native-firebase/app プラグイン追加 | ✅ 成功（Firebase エラー継続） |
| 86d8977a | withFirebaseAppDelegateSwift.js 追加（最終修正） | ✅ 成功・Firebase 匿名認証動作確認済み |

### 次回作業

1. カメラ・ギャラリー権限（iOS 設定→写真→すべての写真）を変更して再テスト
2. Gemini API（RECEIPT/EDUCATION モード）を実機で確認
3. Cloud Vision iOS 対応（cloudVisionOCR.js に `X-Ios-Bundle-Identifier` ヘッダー追加）
4. Android 内部テスト審査完了後 → RevenueCat フェーズ3実装
5. iOS Production Build → App Store Connect 提出

---

## 2026-05-08: Google Play Console 内部テスト提出 + ストア掲載情報完了

### 作業概要

フェーズ 3（RevenueCat サブスクリプション）実装に向けた Google Play Console 設定を完了し、
内部テスト版のリリースを提出（審査待ち）。次回は審査完了後に定期購入商品作成から再開。

### 完了した作業

| 作業 | 結果 |
|------|------|
| ストア掲載情報（説明文・スクリーンショット・フィーチャーグラフィック） | ✅ 完了 |
| 広告 ID 宣言（AD_ID）| ✅ 完了（「広告・マーケティング」を選択） |
| Google Play Console 本人確認 | ✅ 提出済み（審査中） |
| EAS Build production（AAB）| ✅ 完了 |
| 内部テストトラックへ AAB アップロード・提出 | ✅ 審査待ち |

### 広告 ID 宣言の判断根拠

`react-native-google-mobile-ads` (v16.2.3) を使用しているため AD_ID 権限が自動統合される。
選択カテゴリ: **「広告・マーケティング」**（インタースティシャル・バナー・ネイティブ広告配信のため）
`requestNonPersonalizedAdsOnly: false` 設定のため、ターゲティング広告として申告。

### 内部テスト提出の注意点

- 難読化解除ファイル（ProGuard mapping）の警告が出たが**無視してリリース**（警告のみ・エラーではない）
- Sentry が独自でソースマップを管理しているため、Google Play のクラッシュ分析は補助的に使う方針
- 審査完了まで通常 **数時間〜最大 3 日**。承認メールが nakaima8277@gmail.com に届く

### 次回作業（内部テスト審査完了後に実施）

```
① premium_monthly 定期購入商品を作成
   └ 収益化 → 商品 → 定期購入 → 「定期購入を作成」
   └ 製品ID: premium_monthly / ベースプランID: monthly-base / 価格: ¥480

② RevenueCat コンソール設定（app.revenuecat.com）
   └ プロジェクト "OCR-APP" 作成
   └ Android アプリ追加 → Public API Key を .env.local に保存
   └ Entitlement: "premium" 作成
   └ Product: "premium_monthly:monthly-base" 登録
   └ Offering: $rc_monthly を default に設定
   └ Google Play Service Account と連携

③ コード実装 Step 3: react-native-purchases 統合
   └ react-native-purchases インストール
   └ app.json Config Plugin 追加
   └ src/utils/purchaseManager.js 作成

④ コード実装 Step 4: PaywallModal.js 作成
   └ EAS Dev Build 再ビルド（react-native-purchases はネイティブモジュール）
```

---

## 2026-04-09: mlKitTextReconstructor 精度改善 + receiptParser Pattern 3 修正

### 変更ファイル

| ファイル | 変更種別 |
|---------|---------|
| `src/utils/mlKitTextReconstructor.js` | 改修（yTolerance 適応型 + ピクセルギャップ列区切り） |
| `src/utils/receiptParser.js` | 改修（Pattern 3 greedy バグ修正・¥→4 誤認識対応） |
| `src/components/ReceiptView.js` | 改修（エクスポートUI細部調整） |
| `src/screens/HomeScreen.js` | 改修（OCRモード・Gemini統合の仕上げ） |

### mlKitTextReconstructor.js 改善内容

**グループ適応型 yTolerance**:
- 旧: グローバル平均 height × 0.5 → 合計行など大フォント行が別グループに分離する問題
- 新: `groupMaxH × 0.6`（現グループの最大ライン高さ基準）+ `refTop` を平均に更新
- `refTop` を平均値に更新することで累積ドリフトを防止

**width 追跡 + ピクセルギャップ列区切り**:
- 各ラインに `right = left + width` を追加
- `gap = curr.left - prev.right` が `avgHeight × 0.8` 以上 → `"  "`（列区切り）
- 未満 → `" "`（語内の軽微な隙間）
- これにより receiptParser の `\s{2,}` 列境界検出が確実に動作する

### receiptParser.js Pattern 3 修正内容

**greedy `[^]*` バグ修正**:
- 旧: `"Edy支払計　¥14,151"` で greedy が「計　¥14,15」を先食いして `1` だけキャプチャ → total=1 の誤結果
- 新: `PAYMENT_TOTAL_KW_RE` で支払計行を絞り込み、行内の全価格候補を収集 → 末尾値を採用
- `¥→4` ML Kit 誤認識（ML Kit が ¥ を 4 と読むケース）に `[¥￥4]?` で対応

---

## 2026-04-07: receiptParser 精度向上 + Excel/CSV エクスポート実装

### 目的

1. ML Kit のみでレシート認識の高精度化（Gemini 依存を削減）
2. レシート結果を Excel (.xlsx) または BOM付きCSV (.csv) としてファイルエクスポートする機能追加
3. 現在のUI表示方式と比較できるようにエクスポート選択UIを実装

### フェーズA: receiptParser.js 正規表現改善

**日付フォーマット拡張（extractDate）**:
- `YYYY/MM/DD` / `YYYY年M月D日`（既存）
- `YYYY.MM.DD`（ドット区切り追加）
- `令和N年M月D日`（`reiwaToWestern(n) = 2018 + n` で西暦変換）
- `R\d{1,2}[./]\d+[./]\d+`（R8.4.7 / R8/4/7 短縮形追加）
- 妥当性チェック: 変換後 year が 1990〜2100 の範囲外なら無視

**extractMerchant の EXCLUDE 拡張**:
- `\d{4}[\/年.]\d{1,2}[\/月.]\d{1,2}` → YYYY.MM.DD も除外対象に
- `R\d{1,2}[./]` / `令和\d{1,2}年` → 令和日付を店名誤抽出から保護

**数量パターン拡張（QTY_LINE）**:
```javascript
// 変更前
/単(\d+)\s+x\s*(\d+)[コ個]?/
// 変更後（@プレフィックス・単価キーワード・全角×に対応）
/(?:単価?|@)[¥￥]?(\d+(?:[,.]\d+)?)\s*[xX×]\s*(\d+)[コ個点]?/
```

**値引きキーワード対応（DISCOUNT_KEYWORD_RE）**:
- `値引き|割引|クーポン` を含む品目行は `price: -Math.abs(price)` として負額で登録
- 既存の `-数値` 形式（DISCOUNT_LINE）は変更なし

### フェーズB: excelExporter.js 新規作成

**インストール**:
```bash
npm install xlsx        # Pure JS実装 v0.18.5
npx expo install expo-sharing  # ~14.0.8
```

**設計**:
- `exportReceiptAsExcel(result)` — xlsx でワークブック生成 → `type:"base64"` 書き出し → `expo-file-system/legacy` 保存 → `expo-sharing` 共有
- `exportReceiptAsCSV(result)` — `"\uFEFF"` BOM付きCSV → ファイル保存 → 共有
- `exportReceipt(result, format)` — Excel失敗時（XLSX_UNAVAILABLE）は自動でCSVフォールバック

**Hermes 互換性の注意点**:
- Hermes に `Buffer` グローバルが存在しない → `XLSX.write(wb, { type: "base64" })` を使用
- xlsx の `require()` を動的実行して失敗時に `XLSX_UNAVAILABLE` を throw → CSV へ自動フォールバック

### フェーズC: ReceiptView.js エクスポートUI変更

**変更前**: 「CSV でエクスポート」ボタン → `Share.share({ message: csvText })` でテキスト共有（ファイルなし）

**変更後**: 「エクスポート」ボタン → `Alert.alert` ActionSheet で形式選択
```
エクスポート形式を選択
 [Excel (.xlsx)]  → exportReceiptAsExcel() → OSのShare Sheet
 [CSV (.csv)]     → exportReceiptAsCSV()   → OSのShare Sheet
 [キャンセル]
```

- エクスポート中は `ActivityIndicator` + 「エクスポート中...」テキスト表示・ボタン無効化
- xlsx→CSVフォールバック発生時はアラートでユーザーに通知

### 変更ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `src/utils/receiptParser.js` | 改修（日付/数量/値引き正規表現追加） |
| `src/utils/excelExporter.js` | **新規作成** |
| `src/components/ReceiptView.js` | 改修（エクスポートUI → ActionSheet + ファイル出力） |
| `src/constants/messages.js` | 改修（エクスポートメッセージ追加） |

### 次のアクション

- **EAS Dev Build 再ビルド必須**（expo-sharing はネイティブモジュール）
- 実機で xlsx の Hermes 互換性を検証（動作すれば .xlsx、失敗すれば自動 CSV フォールバック）
- フェーズD（任意）: `mlKitTextReconstructor.js` に `reconstructReceiptLayout()` を追加して列座標ベースの精度向上

---

## 2026-03-06: Cloud Vision API キー制限 + アイコン移行

### Cloud Vision API Android アプリ制限の確認と修正

**問題**: API キーに Android アプリ制限を設定したが、`cloudVisionOCR.js` が REST API で必要な識別ヘッダーを送信していなかったため 403 エラー。

**修正**: `X-Android-Package` + `X-Android-Cert` ヘッダーを追加。

重要な知見:
- SHA-1 フォーマット: **コロンなし・小文字**（例: `abcdef1234...`）。コロン区切り大文字では 403
- SHA-1 は `.env.local` に `EXPO_PUBLIC_ANDROID_CERT_SHA1` として追加、Metro 再起動のみで反映

### app.json slug の修正

expo.dev の slug は作成後変更不可。`slug` を `react-native-text-ml-kit-text-recognition3`（expo.dev 登録値）に戻す。

### アイコンライブラリ移行（fontawesome6 → lucide-react-native）

インストール:
```bash
npx expo install react-native-svg
npm install lucide-react-native
npm uninstall @react-native-vector-icons/fontawesome6
```

設計変更: `ActionButton` の prop を `iconName`（文字列）→ `IconComponent`（コンポーネント）に変更。

| 旧（FontAwesome6） | 新（lucide） | 用途 |
|--------------------|-------------|------|
| `square-plus` | `Camera` | FloatingButton（カメラ起動） |
| `floppy-disk` | `Save` | SaveButton |
| `trash-can` | `Trash2` | ClearButton, HistoryScreen 削除 |
| `folder` | `Folder` | ギャラリー選択 |
| `circle-right` | `ArrowRight` | 履歴画面へ移動 |
| `pen` | `Pen` | 編集モード |
| `check` | `Check` | 編集完了 |
| `arrows-rotate` | `RefreshCw` | 高精度再認識 |
| `file` | `FileText` | 空履歴 |
| `circle-xmark` | `XCircle` | モーダル閉じる |
| `copy` | `Copy` | クリップボードコピー |

---

## 2026-03-03: バグ修正 + slug変更 + プライバシーポリシー公開

### Cloud Vision API 修正（AbortSignal.timeout → AbortController）

`AbortSignal.timeout(30000)` が Hermes の fetch ポリフィルに未実装のため即エラー。
→ `AbortController + setTimeout(30000)` + `finally { clearTimeout }` に変更。

### プライバシーポリシー公開

| 項目 | 内容 |
|------|------|
| リポジトリ | `hiro8277/hiro8277.github.io` |
| 公開URL | `https://hiro8277.github.io/` |
| 記載内容 | カメラ・画像・Cloud Vision API・Sentry・クリップボード自動クリア・お問い合わせ先 |

---

## 2026-03-02: アイコン作成 + EAS Buildエラー修正

### アプリアイコン作成

| ファイル | サイズ | 内容 |
|---------|--------|------|
| `assets/icon.png` | 1024×1024 | iOS / 汎用アプリアイコン |
| `assets/adaptive-icon.png` | 1024×1024 | Android アダプティブアイコン前景（透過PNG） |
| `assets/adaptive-icon-background.png` | 1024×1024 | Android アダプティブアイコン背景（新規追加） |
| `assets/splash-icon.png` | 1024×1024 | スプラッシュ画面 |

### EAS Build エラー修正

1. `EBADENGINE`: `"node": "20.14.0"` が RN 0.81.5 の `>=20.19.4` 要件を未達 → `"20.19.4"` に統一
2. `expo-file-system@17.0.1`（package.json）vs `19.0.21`（package-lock.json）の不整合 → `~19.0.21` に変更

---

## 2026-03-01: 4エージェント並列レビュー + Phase 5 修正

4エージェントを並列実行:
- `code-reviewer`（コード品質・設計・バグ）
- `rn-security-auditor`（OWASP Mobile Top 10・APIキー管理）
- `rn-performance-optimizer`（レンダリング・メモリ・FlatList）
- `expo-specialist`（EAS Build/Update・本番運用準備）

修正内容は `code-review-history.md` の Phase 5 セクション参照。

---

## 2026-02-24: UX改善 Sprint 1+2

### Sprint 1: HomeScreen UX 改善 3点

| 機能 | state/要素 | 実装内容 |
|------|-----------|---------|
| 3-A: 画像プレビュー | `image` (既存) | `<Image>` コンポーネントを OCR 処理中も表示し続ける |
| 3-B: ローディング表示 | `isLoading` (新規) | `ActivityIndicator` + "認識中..."。`try/finally` で確実に解除 |
| 3-C: 手動編集トグル | `isEditing` (新規) | pen/check アイコンで `<Text>` ↔ `<TextInput>` を切り替え |

### Sprint 2: textFilter 強化 + 高精度再認識ボタン (3-D)

- `NOISE_ONLY_PATTERN`（記号・罫線行）と `PUNCTUATION_ONLY_PATTERN`（句読点のみ行）を追加
- 連続3行以上の空行を最大2行に正規化
- `engineUsed` state ('cloud-vision'|'ml-kit'|null) でフォールバック発生を検知
- ML Kit使用 + APIキーあり → 「高精度で再認識」ボタン表示

---

## 2026-02-23: Phase 4A+4B（前処理強化 + Cloud Vision 主エンジン化）

### Phase 4A: 画像前処理強化

- MAX_DIMENSION: 1920 → 2400（Cloud Vision API の推奨解像度）
- 適応的リサイズ（最長辺基準）に変更
- compress: 0.9 → 0.95（テキスト境界の鮮明さ向上）

### Phase 4B: Cloud Vision API 主エンジン化

- `src/utils/cloudVisionOCR.js` 新規作成
- `DOCUMENT_TEXT_DETECTION`（縦書き・段落構造対応）使用
- `languageHints: ["ja", "en"]`: 日英混在文書の認識精度向上

expo-file-system v17 でのトラブルシューティング:

| エラー | 原因 | 解決策 |
|-------|------|--------|
| `Cannot read property 'Base64' of undefined` | `FileSystem.EncodingType` が undefined | `"base64"` 文字列リテラルを直接使用 |
| `Method readAsStringAsync is deprecated` | expo-file-system v17 で旧API廃止 | `import * as FileSystem from "expo-file-system/legacy"` |

---

## 2026-02-21: ストレージ修正 + UUID修正

### 発端: 実機で「履歴の保存に失敗しました」

```
[DEBUG] 保存エラー: Property 'crypto' doesn't exist
```

**根本原因**: `crypto.randomUUID()` → Hermes に `crypto` グローバルが存在しない

**修正**: `Crypto.randomUUID()` (expo-crypto) に変更

### ストレージ変遷

```
AsyncStorage（平文）
  ↓ H1修正 (2026-02-20)
react-native-encrypted-storage（New Arch非対応 → 実機で失敗）
  ↓ 2026-02-21
expo-secure-store（New Architecture 完全対応・Expo公式）
  ↓ 2026-02-21 実機テストで失敗
    - キー名制限: "@" 文字不可
    - 値サイズ制限: 2048 bytes → OCR 履歴 JSON はすぐ超過
AsyncStorage（再採用 - OCR履歴は機密情報非該当のため許容）
```

---

## 2026-02-20: Phase 2A〜4 一括実施

### 新規作成ファイル（8件）

| ファイル | 内容 |
|---------|------|
| `src/constants/colors.js` | COLORS 定数 |
| `src/constants/messages.js` | MESSAGES 定数（i18n 対応可能な構造） |
| `src/constants/app.js` | HISTORY_LIMIT=100, MAX_TEXT_LENGTH=5000, CLIPBOARD_CLEAR_DELAY=30000 |
| `src/components/ActionButton.js` | 3ボタン共通の基底コンポーネント |
| `src/components/ErrorBoundary.js` | 未捕捉例外をキャッチして再試行画面を表示 |
| `src/utils/secureStorage.js` | AsyncStorage ラッパー（AppStorage エクスポート） |
| `src/utils/monitoring.js` | Sentry 初期化・captureError |
| `.env.example` | `EXPO_PUBLIC_SENTRY_DSN` 設定テンプレート |

---

## 2026-02-19: OCR認識率改善 Phase 1

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/imagePreprocessing.js` | **新規作成** — expo-image-manipulatorで画像前処理 |
| `src/utils/textFilter.js` | **新規作成** — OCR結果から空白行・1文字行を除去するフィルタ |

---

## 2026-02-14: ビルド安定化（Phase 0）

### EASビルドエラー履歴と解決策

| # | エラー内容 | 根本原因 | 解決策 |
|---|-----------|---------|--------|
| 1 | expo-dev-launcher Kotlin メタデータ不整合 | Kotlin 1.9.24 vs RN 2.1.0 | パッケージアップグレードで解決 |
| 2 | react-native-reanimated 3.17.5 コンパイルエラー | RN 0.81.5 互換性なし | reanimated 4.1.x アップグレード |
| 3 | react-native-vision-camera Kotlin エラー | MutableMap, currentActivity API変更 | patch-package で修正（後に削除） |
| 4 | expo-dev-menu JSC API 参照エラー | RN 0.81.5 で JSC 完全削除 | パッケージアップグレードで根本解決 |
| 5 | expo-dev-launcher 6ファイル JSC+API変更 | 同上 + メソッドシグネチャ変更 | パッケージアップグレードで根本解決 |
| 6 | Theme.EdgeToEdge not found | android/ が旧SDK生成、テーマリソース欠落 | edge-to-edge無効化（Theme.AppCompat.Light.NoActionBar） |

**重要な教訓**: patch-package はEAS Buildで上書きされる → パッケージアップグレードで根本解決が正しい。

### パッケージアップグレード履歴

| パッケージ | 変更前 | 変更後 |
|-----------|--------|--------|
| expo | ~54.0.28 | ~54.0.33 |
| expo-dev-client | ~5.2.4 | ~6.0.20 |
| expo-camera | ~16.1.11 | ~17.0.10 |
| expo-status-bar | ~2.2.3 | ~3.0.9 |
| react-native-reanimated | ^3.17.5 | ~4.1.1 |
| react-native-worklets | (新規) | 0.5.1 |

### EdgeToEdge問題

`app.json` の `edgeToEdgeEnabled: true` が有効だったが、android/のテーマリソースに `Theme.EdgeToEdge` が未定義。
MVP段階では不要のため無効化: `Theme.AppCompat.Light.NoActionBar` に変更。
将来: `npx expo install react-native-edge-to-edge` で対応可能。

---

## CVE調査結果 (2026-02-13)

### CVE-2025-55182 (React2Shell)

- **影響範囲**: React Server Components — 本プロジェクトへの影響: **なし**（React Native モバイルアプリ）

### npm audit

- 修正前: brace-expansion (HIGH), tar (HIGH), undici (MODERATE) の3件
- 修正後: `npm audit fix` で **0 vulnerabilities** ✅

---

## 2026-03-07: CLAUDE.md スリム化 + OCRエンジン選択機能

### CLAUDE.md スリム化
- 42.4k文字 → 約8.5KB に削減（40k制限対応）
- 完了済み作業ログを `docs/history/` に移動
- 将来計画を `docs/planning/` に移動

### 画像プレビュー位置変更
- HomeScreen.js: 画像プレビューをローディング・OCR結果の**下**に移動
- `imageContainer` の `marginBottom` → `marginTop` に変更

### OCRエンジン選択機能の実装

**新規ファイル:**
- `src/utils/usageTracker.js` — Cloud Vision API 日次使用カウンター（AsyncStorage ベース）

**変更ファイル:**
- `src/constants/app.js` — `OCR_ENGINE`・`CLOUD_VISION_DAILY_LIMIT` 追加
- `src/screens/HomeScreen.js` — `engineForNextOCR` ref 追加、カメラ/ギャラリー両方にエンジン選択ダイアログ

**設計のポイント:** `engineForNextOCR` を `useRef` で管理 → レンダリング不要・`useEffect` 依存配列に影響しない

---

## 2026-03-10: ストア提出前判断 + Google Play Console 対応

- L1（TypeScript）・L2（テスト）・L6（難読化）・L7（SSL証明書ピンニング）— Phase 1 では全て不要と確定
- プライバシーポリシー URL 登録完了 (`https://hiro8277.github.io/`)
- 本人確認（身元確認）実施中

---

## 2026-03-12: Google Play Console 内部テスト提出 + ML Kit 事前スクリーニング

### EAS Production Build と Google Play
- Google Play Console は APK 不可・AAB 必須 → `eas build --profile production` を使う
- EAS 管理キーストアは dev/prod 共通
- `expo-updates` 初回インストール時はビルド一度失敗 → 再実行で解決（正常動作）
- bare workflow の `runtimeVersion` は `{"policy":"appVersion"}` ではなく `"1.0.0"` と文字列で指定

### ML Kit 事前スクリーニング実装
Cloud Vision 選択時も ML Kit を先行実行 → テキストなし → Cloud Vision 未呼び出しでアラート。
Cloud Vision 失敗時に ML Kit 結果を**再利用**（再実行なし）。

### Google Play Console 内部テスト 公開完了
- 警告①（テスター未指定）: テスタータブで Gmail を追加 → オプトイン URL でインストール
- 警告②（難読化解除ファイルなし）: 無視してOK（Sentry で代替）
- トラック昇格は手動のみ: 内部テスト → クローズドテスト → オープンテスト → 製品版

---

## 2026-03-14: Cloud Vision 429 エラーハンドリング + AdMob 導入

### Cloud Vision API 429 エラーハンドリング
- `CloudVisionRateLimitError` クラスを `cloudVisionOCR.js` に追加（429専用）
- `HomeScreen.js` で `instanceof` 判定 → 「しばらくお待ちください」アラート表示（2箇所）

### AdMob 導入実装（EAS Dev Build 動作確認済み 2026-03-15）

**App ID / Ad Unit ID:**
- App ID: `ca-app-pub-4083422635947412~4707834796`
- Banner: `ca-app-pub-4083422635947412/8071125037`
- Interstitial: `ca-app-pub-4083422635947412/8597738645`

**設計のポイント:**
- Config Plugin は使用しない（Expo SDK 54 + RN 0.81 バグ #820, #835）
- `adManager.js` シングルトン: 起動時プリロード → CLOSED イベントで自動リロード
- 本番 ID は `eas secret:create` で EAS Secrets に登録

---

## 2026-03-15: Native Ad + Interstitial タイミング変更 + iOS 計画

### ネイティブ広告を HistoryScreen FlatList に追加
- Native Ad Unit ID: `ca-app-pub-4083422635947412/8337931922`
- `HISTORY_ITEM_HEIGHT=132` を `constants/app.js` に移動（NativeAdCard と共有、循環インポート回避）
- `listData = useMemo()` で history に `{ id: 'ad_N', type: 'ad' }` を5件おきに挿入
- **`useNativeAd` フックは v16 に存在しない** → `NativeAd.createForAdRequest()` + `useState` が正しい API
- アンマウント時に `ad?.destroy()` 必須（メモリリーク防止）

### Interstitial 表示タイミング変更
`showInterstitialIfReady()` を OCR 完了後 → `setIsLoading(true)` 直後に移動。
ローディング中に広告表示 → 広告を閉じると OCR 完了済みの体験に改善。

### iOS 向けビルド計画（Apple Developer Program 登録申請済み）
- Apple Developer Program 登録申請完了（$99/年）、承認待ち
- 承認後の手順: `app.json` iOS セクション追加 → `eas credentials` → `eas device:create` → `eas build --platform ios`
- Windows での .ipa インストール: EAS Internal Distribution の QR コード経由（Mac 不要）
- iOS コード修正が必要な可能性: `Info.plist` への GADApplicationIdentifier、Cloud Vision API iOS 分岐

---

## 2026-03-16: Gemini Flash OCR 統合計画（計画フェーズ）

- Document AI vs Gemini Flash 比較 → Gemini Flash 採用（コスト100倍の差）
- フリーミアム収益化戦略確定（¥480/月プレミアム）
- 実装4フェーズ計画策定

---

## 2026-03-17: Gemini Flash OCR フェーズ1 実装

- `src/utils/geminiOCR.js` 新規作成（`isGeminiAvailable()` + `recognizeTextWithGemini()`）
- `OCR_ENGINE.GEMINI_FLASH` + `GEMINI_DAILY_LIMIT=100` を `constants/app.js` に追加
- **セキュリティインシデント**: AI Studio 画面キャプチャにAPIキーが写り込み → ローテーション対処

---

## 2026-03-18: @google/genai 新SDK 導入・Gemini 2.5 Flash 移行

### 変更内容
- `@google/genai` v1.46.0 を導入（旧: 直接 fetch → 新: SDK経由）
- モデルを `gemini-flash-latest` → **`gemini-2.5-flash`** に明示指定
- タイムアウトは `Promise.race` で実装（SDK が AbortController を直接受け取らないため）

### Metro Bundler と Web版バンドルの仕組み
`package.json` の `exports["browser"]` 条件により、Metro bundler は RN ビルド時に `dist/web/` を自動選択する。
Node.js 固有 API（`fs`, `google-auth-library`）が Hermes に混入しない。

---

## 2026-03-21: ML Kit テキスト空間再構築 + Gemini コスト最適化

### mlKitTextReconstructor.js 新規作成
`reconstructTextSpatially(blocks)` 実装:
- 全ブロック → ライン抽出（frame: top, left, height 付き）
- avgHeight × 0.5 を yTolerance として動的計算
- top でソート → yTolerance 以内のラインを同一行グループに → left でソート → 2スペースで結合

変換例:
- 変更前: `"コーヒー\n¥150\nサンドイッチ\n¥350"` （列分離）
- 変更後: `"コーヒー  ¥150\nサンドイッチ  ¥350"` （行対応）

### GENERALモード Gemini 除外
GENERAL モードは ML Kit のみで完結。Gemini 呼び出しなし（コスト最適化）。

### テキスト渡しロジックの試行とロールバック
- 試行: ML Kit テキストを Gemini に渡す → トークン量が画像より増加、`raw_text` 省略問題
- 結論: テキスト渡しロジックを完全ロールバック。RECEIPT/BUSINESS は画像入力に戻した

---

## 2026-03-22: OCRモード拡張 + 構造化UIコンポーネント実装（フェーズ2完了）

### 実装内容
- `OCR_MODE` 定数追加（GENERAL/RECEIPT/EDUCATION/MEDICAL/BUSINESS）
- Gemini モデルを `gemini-2.5-flash` → `gemini-2.5-flash-lite` に変更（コスト最適化）
- `receiptParser.js` 新規作成（正規表現フォールバックパーサー）
- `ReceiptView.js`・`EducationView.js`・`MedicalView.js`・`BusinessCardView.js`・`PrivacyBadge.js` 新規作成
- HomeScreen に5モード選択ダイアログ・`geminiResult`/`modeUsed` state・"テキスト表示"/"構造化表示" トグル追加

### Gemini 使用制限設計
| 制限 | 値 | 対象 |
|------|-----|------|
| `GEMINI_FREE_TRIAL_LIMIT` | 3回/月 | 無料ユーザー（お試し） |
| `GEMINI_PREMIUM_MONTHLY_LIMIT` | 200回/月 | プレミアムユーザー（安全弁） |
| `GEMINI_DAILY_LIMIT` | 100回/日 | 全ユーザー（コスト保護） |

---

## 2026-03-23: receiptParser.js 大幅改善（Gemini 常時呼び出し問題の根本解決）

### デバッグ Alert による根本原因特定
`HomeScreen.js` に `__DEV__` ガード付き Alert を追加して実機確認した結果：

**根本原因（3層構造）:**
1. ML Kit がサンエーレシートの「合計（税込）」ラベルを OCR 失敗
2. ¥16,629 は `reconstructTextSpatially` により「Edy預り　Edy支払　¥19,120　¥16,629」に空間マージ
3. EXCLUDE フィルターの `Edy` がこの行全体をスキップ → `parsed.total = null`

### 修正内容

| ファイル | 修正内容 |
|---------|---------|
| `receiptParser.js` | `extractTotal` TOTAL_RE を EXCLUDE より前にチェック |
| `receiptParser.js` | `extractTotal` Pattern 3 追加（Edy支払/クレジット支払から末尾金額を greedy `[^]*` で取得） |
| `receiptParser.js` | `extractMerchant` EXCLUDE 追加（2文字以下行・`^様` 行）、スキャン範囲 8→10行 |
| `receiptParser.js` | `extractItems` アイテムゾーン限定スキャン（合計/小計行の直前まで） |
| `receiptParser.js` | `extractItems` `ITEM_SIMPLE` の ¥ を任意に変更（`[¥￥]?`）、品目名末尾の `＊` 除去 |
| `HomeScreen.js` | `setEngineUsed(GEMINI_FLASH)` → `setEngineUsed(ML_KIT)`（パーサー成功時に誤表記） |
| `HomeScreen.js` | `parsed.total != null` → `parsed.total != null && parsed.total > 0`（ゼロ値ガード） |

**greedy `[^]*` を使う理由:**
空間マージ後の行 `Edy預り  Edy支払  ¥19,120  ¥16,629` では、末尾の ¥16,629（= 支払額）を取得したい。
Non-greedy `[^]*?` だと最初の ¥19,120（= Edy チャージ額）を誤キャプチャする。

### RECEIPT モードの確定フロー

```
ML Kit → reconstructTextSpatially → mlKitText（65行）
  ↓
parseReceiptText(mlKitText)
  ├── extractTotal:  Pattern1（TOTAL_RE優先） → Pattern2（次行） → Pattern3（Edy支払末尾）
  ├── extractTax:    (税合計 *1,262) → ¥1,262
  ├── extractMerchant: "様"除外 → 正しい店名
  └── extractItems:  アイテムゾーン（合計行前）のみスキャン

parsed.total != null && parsed.total > 0:
  → Gemini 呼び出しなし（コスト¥0）

それ以外:
  → 画像入力で Gemini にフォールバック

---

## 2026-04-11: receiptParser 精度改善・実機OCR再現テスト追加

**背景**: サンエーレシート実機スキャンで合計行が正しく認識されない問題が発覚。

**発見した根本原因**:
1. `reconstructTextSpatially` が `(税合計 ¥1,071)` 小フォント行と `合計 ¥14,151` 大フォント行をY近接のため同一グループにマージ
2. マージ後の行で `TOTAL_RE` が `[^¥￥\d\n]*` により `¥1,071`（税合計）を先食い → `total=1071` の誤取得
3. 実際のML Kit OCR出力では `合計` 行が未検出 → Edy支払フォールバックが正しく機能していたが、テストがそれを検証していなかった
4. `※`(U+203B) が `[＊*]` に含まれず merchant 誤判定、`Y`/`y`→¥ OCR誤認識が未対応

**修正内容**:

| ファイル | 修正 |
|---|---|
| `mlKitTextReconstructor.js` | height-ratio guard 追加（新行が groupMaxH×1.5 倍超 → 厳格 tolerance×0.3） |
| `receiptParser.js` | extractTotal: 税合計マージ行で最大価格採用 |
| `receiptParser.js` | extractMerchant: `※`/PLUコード行/価格行を EXCLUDE 追加 |
| `receiptParser.js` | PRICE_PREFIX・ITEM_TRAILING_PRICE: `Y`/`y` 誤認識対応 |
| `test-receipt.mjs` | 実機OCRテキストから再現ケース追加（50→60テスト）|

詳細アルゴリズム: `docs/technical/reconstructor-design.md` / `docs/technical/parser-design.md` 参照。

**テスト結果**: 60テスト全件合格（旧52件 → 新60件）

---

## 2026-04-22: RECEIPTモード大幅改善・ReceiptView編集機能・再認識ボタン整理

### 1. RECEIPTモード → ハイブリッド方式に変更

旧: 正規表現パーサーのみ → 新: ML Kit + parseReceiptText → 品質チェック → Geminiフォールバック

```
isHighQuality = parsed.total != null && parsed.items.length > 0
  YES → ML Kit結果で確定（Gemini未消費・コスト¥0）
  NO  → Gemini 2.5 Flash Liteにフォールバック（1回消費）
```

### 2. ReceiptView.js に編集機能を追加

- 編集/完了トグルボタン（Pen/Check アイコン）を右上に追加
- 編集モード: 店名・日付・商品名・数量・金額・消費税・合計を TextInput でインライン編集
- ローカル `draft` state で編集 → 「完了」時に `onResultChange(normalized)` で親の `geminiResult` を更新
- `itemRowEdit.alignItems` を `"flex-end"` に変更、全3入力に `height: 32` を統一

### 3. 再認識ボタンを役割別に分離

| ボタン | API | 表示条件 |
|--------|-----|---------|
| AIで再認識 | Gemini 2.5 Flash Lite | 構造化モード（RECEIPT/EDUCATION）のみ |
| 手書き認識 | Cloud Vision API | GENERALモードのみ |

---

## 2026-04-24: AIで再認識ボタン 1回制限 + 広告表示

- `adManager.js` に `showInterstitialNow()`（頻度カウンター不依存・即時表示）を追加
- `aiReRecognizeUsed` state で1スキャン1回制限（楽観的ロック方式）
- 新スキャン開始・クリア時にリセット、成功・失敗どちらでもボタン無効化

---

## 2026-04-28: 教育モード強化・ReceiptView 任意位置挿入・再認識ロジック修正

### 1. 教育モード Phase 1〜3

**Phase 1: 科目別プロンプト強化**（`geminiOCR.js`）

| 科目 | 追加指示 |
|------|---------|
| math | LaTeX 記法（`\frac`・`\sqrt`・`\int` 等）で formulas[] に格納 |
| science | 化学式・物理公式を LaTeX で formulas[]、単位必須 |
| japanese | **縦書き変換**（右列→左列・上→下）、古文/漢文を別 section に分離 |
| english | 単語リストを「単語: 意味（品詞）」形式で list 型 section に整理 |
| social | 年号を key_dates[]、地名・人名を important_terms[] に格納 |

**Phase 2: EducationView UI 強化**
- 縦書きバッジ・数式セクション（暗色コードブロック）・年表セクション（年号bold+primary色）

**Phase 3: エクスポート強化**
- Markdown: LaTeX `$$...$$`・年表・重要語句含む `.md` ファイルを expo-sharing で共有
- テキスト: 既存 `Share.share()` によるネイティブ共有

**科目選択 UI（HomeScreen.js）**
- `subjectForNextOCR = useRef()` — モーダルコールバック間の受け渡し
- `showSubjectSelector(onSelected)` — 6科目選択サブダイアログ

### 2. ReceiptView 任意位置への商品挿入

```javascript
const insertAt = useCallback((index) =>
  setDraft((prev) => {
    const next = [...(prev.items ?? [])];
    next.splice(index, 0, { name: "", price: null, quantity: 1 });
    return { ...prev, items: next };
  }), []);
```

行間に挿入バー（＋アイコン）表示。「商品を追加」は `insertAt(items.length)` で末尾挿入に統一。

### 3. 再認識ロジック修正

`reRecognizeWithGemini` 内で `showInterstitialNow()` の後に `showInterstitialIfReady()` が重複していた問題を修正。

---

## 2026-04-30: 教育モード クイズ生成機能（Phase E1）+ BUSINESS モード削除

### 1. クイズ生成機能

```
教育OCR（画像→JSON）→「クイズ生成（5問）」ボタン
  → generateQuizFromEducationResult(structuredResult)
    入力: OCR結果のJSON文字列（base64不要 → コスト≈¥0.03）
    出力: { subject, questions[] }
  → QuizView（カードめくり式・自己採点・スコア表示）
```

新規ファイル: `quizGenerator.js`（Gemini JSON→JSON）、`QuizView.js`（カード式UI）

### 2. OCR_MODE.BUSINESS 削除

名刺専用アプリ（Eight・CamCard等）との差別化不可のため廃止。教育×クイズ生成に集中。
削除: `BusinessCardView.js`・関連 import/定数/プロンプト。現在のOCRモード: GENERAL / RECEIPT / EDUCATION。

---

## 2026-05-01: フェーズ E2 実装（Anki エクスポート・クイズ履歴保存・HistoryScreen 全面改修）

### 主要変更

- **`ankiExporter.js`** 新規: Anki互換タブ区切りTXT（`表面\t裏面\n`）エクスポート
- **`QuizView.js`**: `onFinish` プロップ追加 → `{ correct, total }` を親に通知
- **`ReceiptView.js`**: `readOnly = false` プロップ → HistoryScreen では編集ボタン非表示
- **`EducationView.js`**: `savedQuiz` / `onQuizFinish` プロップ・Ankiエクスポート追加
- **`HomeScreen.js`**: クイズ結果2パス保存・`updateHistoryQuizScore`・Gemini catch バグ修正
- **`HistoryScreen.js`**: フルスクリーンモーダル・モード別表示（RECEIPT/EDUCATION/GENERAL）・バッジ・TXT出力

**クイズ保存フロー（2パス設計）**:
```
パス①: スキャン → 保存 → クイズ生成
  saveToHistory → lastSavedItemIdRef にID記憶
  QuizView.onFinish → updateHistoryQuizScore(ID, quizData)

パス②: クイズ生成 → 保存
  QuizView.onFinish → quizResultRef に結果保存
  saveToHistory → quizResultRef.current をそのまま保存
```

**Gemini API 失敗時のボタン誤表示バグ修正**: Gemini catch ブロックで `setModeUsed(selectedMode)` を追加。
`modeUsed === null` → `!modeUsed` が真になり「手書き認識」ボタンが誤表示されていた問題を解消。

---

## 2026-05-01: UX全面改善（lucide 統一・モーダル改善・フィルターチップ・メッセージ文言）

### 1. lucide アイコン統一

モード/科目選択モーダルの絵文字を lucide-react-native アイコンに統一。HistoryScreen バッジも lucide 化。
- `Globe2` は v0.577.0 に存在しない → `Globe` で代替（確認済み）

### 2. HistoryScreen カテゴリフィルターチップバー

- `filterMode` / `filterSubject` state で2段階フィルタ（useMemo）
- FlatList vs Panジェスチャー競合修正: `.activeOffsetX([-10, 10])` + `.failOffsetY([-5, 5])`

### 3. messages.js UX文言改善

1. **技術用語の隠蔽**: "Cloud Vision API" → "手書き認識"、"Gemini API" → "AI認識"
2. **語調統一**: "〜に失敗しました" → "〜できませんでした"
3. **行動指示の付加**: エラー後に「次に何をすれば良いか」を明示

---

## 2026-05-04: Interstitial 広告配置最適化 + セキュリティ監査・対策

### 広告発火マトリクス（最終）

| アクション | 関数 | 発火 |
|-----------|------|------|
| OCR（GENERAL/RECEIPT） | `showInterstitialIfReady` | N回に1回 |
| OCR（EDUCATION） | `showInterstitialNow` | 毎回 |
| AIで再認識 | `showInterstitialNow` | 毎回 |
| クイズ生成 | `showInterstitialNow` | 毎回 |

### セキュリティ対策（実装完了）

| 重大度 | 問題 | 対処 |
|--------|------|------|
| HIGH | 過剰パーミッション（RECORD_AUDIO 等） | `tools:node="remove"` で明示除去 |
| HIGH | `allowBackup="true"` → ADB抽出可能 | `allowBackup="false"` に変更 |
| HIGH | Android 13+ で `READ_MEDIA_IMAGES` 未対応 | `maxSdkVersion="32"` + `READ_MEDIA_IMAGES` 追加 |
| HIGH | CSV/Excelインジェクション（CWE-1236） | `escapeFormula()` 追加（OWASP推奨） |
| HIGH | Ankiフィールド内タブ・改行 | `sanitizeAnkiField()` 追加 |
| HIGH | プロンプトインジェクション | `sanitizeForPrompt()` + `<user_data>` タグ分離 |
| MEDIUM | 画像サイズ無制限 | 20MB上限・アスペクト比20:1超拒否 |

**未対応（設定作業が必要）**:
- Gemini API 日次クォータを Cloud Console で設定（推奨200 req/day）
- `.env.local` が `.gitignore` に含まれることを確認

---

## 2026-05-07: CLAUDE.md スリム化 + Firebase フェーズ3+4 STEP 1〜4 実装

### 1. CLAUDE.md スリム化（1,120行 → 306行）

CLAUDE.md がコンテキスト制限に影響するサイズだったため、詳細情報を `docs/` 以下に分割。

| 移行先ファイル | 内容 |
|--------------|------|
| `docs/technical/reconstructor-design.md` | mlKitTextReconstructor アルゴリズム詳細（新規作成） |
| `docs/technical/parser-design.md` | receiptParser 設計原則（新規作成） |
| `docs/planning/phase3-4-plan.md` | RevenueCat + Firebase 実装計画（新規作成） |
| `docs/history/work-logs.md` | 2026-04-11〜05-04 ログを追記 |

CLAUDE.md には参照リンクのみ残し、常時必要な情報（OCR設計・技術制約・EAS手順）は維持。

### 2. Firebase STEP 1〜3: インストール + Gradle 設定

**インストールしたパッケージ（v21.14.0・New Architecture 対応）:**
- `@react-native-firebase/app`
- `@react-native-firebase/auth`
- `@react-native-firebase/firestore`

**Gradle 変更:**
- `android/build.gradle`: `classpath('com.google.gms:google-services:4.4.2')` 追加
- `android/app/build.gradle`: `apply plugin: "com.google.gms.google-services"` 追加

**EAS Dev Build エラーと解決:**

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `npm ci: Missing async-storage@1.24.0` | Firebase install/uninstall後にlock fileが不整合 | `npm install` で再生成・両ファイルコミット |
| EAS Build 23秒で即失敗（2回） | `google-services.json` が gitignore されておりEASに届かない | `.gitignore` から除外してコミット |

**重要な決定**: `google-services.json` は EAS Build には `googleServicesFile`（eas.json）が使えないため、Git にコミットする方式を採用。android/app/google-services.json のみ、iOS の GoogleService-Info.plist は gitignore 維持。

EAS Dev Build 成功: build ID `4932d71f`

### 3. Firebase STEP 4: authManager.js 実装

**新規作成: `src/utils/authManager.js`**

| 関数 | 役割 |
|------|------|
| `getOrCreateAnonymousUser()` | Firebase 匿名認証（既存ユーザーなら UID を返すだけ） |
| `getIdToken(forceRefresh?)` | Firebase Functions 呼び出し時の IDトークン取得 |
| `getCurrentUid()` | 現在の UID を同期で取得（未認証なら null） |

モジュールレベルで `onAuthStateChanged` リスナーを自動起動（App.js 変更不要）。
RevenueCat の `Purchases.logIn()` には `getOrCreateAnonymousUser()` の UID を渡す。

### 次回実施予定

- STEP 5: RevenueCat コンソール（app.revenuecat.com）でプロジェクト・製品・エンタイトルメント作成
- STEP 6: `react-native-purchases` インストール + `purchaseManager.js` 実装
