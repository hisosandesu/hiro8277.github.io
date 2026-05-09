# OCR-APP プロジェクト

## プロジェクト概要

React Native (Expo SDK 54) + ML Kit Text Recognition のOCRアプリ。
カメラ/ギャラリーから画像を取得し、日本語テキスト認識して履歴保存する。

- **フレームワーク**: React Native 0.81.5 + Expo SDK 54
- **画面数**: 2 (HomeScreen, HistoryScreen)
- **コンポーネント数**: 10 (ActionButton, FloatingButton, SaveButton, ClearButton, ErrorBoundary, ReceiptView, EducationView, QuizView, NativeAdCard, PrivacyBadge)
- **ナビゲーション**: React Navigation Stack
- **ストレージ**: AsyncStorage（secureStorage.js の `AppStorage` ラッパー経由、OCR履歴はユーザー生成テキストのため機密非該当）
- **OCR**: @react-native-ml-kit/text-recognition (日本語) + Cloud Vision API (手書き専用) + Gemini 2.5 Flash Lite（構造化抽出・新SDK・医療モード除く）
- **エラー監視**: @sentry/react-native（DSN設定後に有効）
- **アイコン**: lucide-react-native + react-native-svg

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
    ReceiptView.js        # レシート構造化表示（Excel/.xlsx + BOM付きCSV ファイルエクスポート）
    EducationView.js      # 教育モード構造化表示 + クイズ生成ボタン（月次使用量チェック付き）
    QuizView.js           # カードめくり式クイズ（穴埋め/選択・自己採点・スコア表示）
    NativeAdCard.js       # ネイティブ広告カード（HistoryScreen FlatList 内）
    PrivacyBadge.js       # 「学習利用なし」バッジ
  utils/
    imagePreprocessing.js # 画像前処理（最長辺2400px適応リサイズ、JPEG0.95、EXIF回転補正）
    textFilter.js         # OCR結果フィルタ（空白行・1文字行・記号行・句読点行除去、連続空行正規化）
    cloudVisionOCR.js     # Cloud Vision API OCR（X-Android-Package/Cert ヘッダー付き、CloudVisionRateLimitError）
    geminiOCR.js          # Gemini 2.5 Flash Lite OCR（@google/genai 新SDK・マルチモーダル・モード別プロンプト）
    quizGenerator.js      # 教育モード構造化結果からクイズ生成（テキストJSON入力・base64不要）
    mlKitTextReconstructor.js # ML Kit blocks から視覚的行順に再構築（Y座標グループ化→X座標ソート）
    receiptParser.js      # 正規表現レシートパーサー（ML Kit テキスト→JSON構造化、Gemini 不使用）
    excelExporter.js      # Excel/.xlsx + BOM付きCSV エクスポート（xlsx + expo-sharing 使用）
    secureStorage.js      # AsyncStorage ラッパー（AppStorage エクスポート）
    monitoring.js         # Sentry エラー監視ラッパー（DSN未設定時はノーオペレーション）
    usageTracker.js       # Cloud Vision + Gemini API 日次使用カウンター（get/increment）
    adManager.js          # Interstitial 広告シングルトン（プリロード・自動リロード）
    ankiExporter.js       # クイズデータをAnki互換タブ区切りTXT形式でエクスポート（expo-sharing使用）
    authManager.js        # Firebase 匿名認証ラッパー（getOrCreateAnonymousUser / getIdToken / getCurrentUid）
  constants/
    storage.js            # HISTORY_KEY
    colors.js             # COLORS（primary, background, white, textPrimary, textSecondary, ...）
    messages.js           # MESSAGES（ERROR, SUCCESS, CONFIRM, INFO）
    app.js                # HISTORY_LIMIT=100, MAX_TEXT_LENGTH=5000, OCR_ENGINE, OCR_MODE, AD_UNIT_IDS
  navigations/
    RootNavigation.js     # NavigationContainer
    stack/
      HomeStack.js        # Stack.Navigator (Home, History)
docs/
  history/
    code-review-history.md   # 完了済みレビュー詳細（C1〜L7, Phase 5）
    work-logs.md             # 日付別作業ログ（2026-02-13〜05-04）
  planning/
    backend-ocr-architecture.md  # ConoHa VPS + PaddleOCR 計画（未実装・スケール後 Phase 3）
    phase3-4-plan.md             # RevenueCat + Firebase 実装計画（2026-05-05 確定）
  technical/
    reconstructor-design.md  # mlKitTextReconstructor アルゴリズム詳細
    parser-design.md          # receiptParser 設計原則
```

---

## OCRモード・エンジン設計

### OCR_MODE 定数と役割分担

```javascript
export const OCR_MODE = {
  GENERAL:   "general",   // 汎用（ML Kit のみ・Gemini 呼び出しなし）
  RECEIPT:   "receipt",   // レシート・領収書（JSON: merchant/date/total/tax/items[]）
  EDUCATION: "education", // 黒板・教科書・試験問題（JSON: subject/title/sections/important_terms[]）
};
// ※ MEDICAL モードは導入しないと決定（2026-04-29）
// ※ BUSINESS モード（名刺・書類）は削除（2026-04-30）→ 教育特化に集中
```

### OCRエンジン役割分担（確定）

| エンジン | 用途 | コスト | プラン |
|---------|------|--------|--------|
| ML Kit | 印刷文字・オフライン認識 | 無料 | 全ユーザー無制限 |
| Cloud Vision API | **手書き文字・難解フォント専用** | $1.50/1,000枚 | フリー層（日次上限あり） |
| Gemini 2.5 Flash Lite | レシート構造化・教育構造化・クイズ生成 | ≈$0.07/回（画像）≈$0.03/回（クイズ） | フリーお試し（月次上限）|

**Cloud Vision は削除しない。** Gemini は構造化JSON出力、Cloud Vision は手書き精度と役割が異なる。

### OCR処理フロー（現在）

```
GENERALモード:
  ML Kit（reconstructTextSpatially） → textFilter → 表示（Gemini 呼び出しなし）

RECEIPTモード（ハイブリッド方式）:
  ML Kit → parseReceiptText（正規表現）→ 品質チェック（total != null && items.length > 0）
      YES（高品質）: ML Kit 結果で確定。Gemini 未消費。コスト¥0。
      NO（低品質）:  Gemini 2.5 Flash Lite にフォールバック → 構造化JSON

EDUCATIONモード:
  ML Kit → rawText 取得 + 画像入力 Gemini Flash Lite → 構造化JSON → EducationView
  → 「クイズ生成（5問）」ボタン → 日次/月次チェック → generateQuizFromEducationResult()
  → QuizView（カードめくり・自己採点）

Cloud Vision 選択時（GENERALモード・手書き認識）:
  日次上限チェック → ML Kit 先行実行 → テキストなし → アラート終了
  → Cloud Vision 呼び出し → 失敗時: ML Kit 結果を再利用

再認識ボタン:
  構造化モード: 「AIで再認識」→ reRecognizeWithGemini()（1回制限・広告必須）
  GENERALモード: 「手書き認識」→ recognizeTextHighPrecision() → Cloud Vision のみ
```

---

## セキュリティ状態サマリー

| カテゴリ | 状態 | リスクレベル |
|---------|------|------------|
| データストレージ | AsyncStorage（OCR履歴は機密情報非該当のため平文で許容）✅ | LOW |
| クリップボード | 30秒自動クリア ✅ | LOW |
| ログ出力 | 全削除済み ✅ | LOW |
| パーミッション | RECORD_AUDIO/SYSTEM_ALERT_WINDOW/WRITE_EXTERNAL_STORAGE 除去済み ✅（2026-05-04） | LOW |
| ADBバックアップ | allowBackup="false" に変更済み ✅（2026-05-04） | LOW |
| npm脆弱性 | npm audit 0 vulnerabilities ✅ | LOW |
| エラー監視 | Sentry統合済み（DSN設定済み: .env.local）✅ | LOW |
| APIキー | Gemini/CloudVision は .env.local（フェーズ4でFirebase Proxy に移行予定）| MEDIUM |
| CSV/Excelインジェクション | escapeFormula() 追加済み ✅（2026-05-04） | LOW |
| プロンプトインジェクション | sanitizeForPrompt() + user_data タグ分離済み ✅（2026-05-04） | LOW |
| 画像サイズ境界値 | 20MB上限・アスペクト比20:1超拒否 追加済み ✅（2026-05-04） | LOW |
| Gemini APIクォータ | Cloud Console でのハードクォータ設定が**必要**（未設定） | MEDIUM |

将来対応: TypeScript未使用(L1)、テスト0件(L2)、SSL証明書ピンニング(L7)、難読化(L6)、Gemini Cloud Quota設定

---

## 重要な技術的制約・落とし穴

### Hermes (RN 0.81.5) の制限

- **`crypto.randomUUID()` 使用不可** — `expo-crypto` の `Crypto.randomUUID()` を使用
- **`AbortSignal.timeout()` 使用不可** — `AbortController + setTimeout` を使用

### expo-file-system v19（legacy API）

```javascript
import * as FileSystem from "expo-file-system/legacy";
// encoding は "base64" 文字列リテラルを直接使用（FileSystem.EncodingType は undefined）
```

### ストレージ選択

- **expo-secure-store**: キー名に `@` 不可・値サイズ 2048 bytes 上限 → OCR 履歴には不適
- **AsyncStorage（AppStorage ラッパー）**: OCR 履歴は機密情報非該当のため採用

### Cloud Vision API Android アプリ制限

```javascript
headers: {
  "X-Android-Package": "com.yourpackage.name",
  "X-Android-Cert": "abcdef1234...",  // コロンなし・小文字（コロン区切り大文字では 403）
}
```
SHA-1 は `.env.local` に `EXPO_PUBLIC_ANDROID_CERT_SHA1` として設定（Metro 再起動のみで反映）。

### アイコン（lucide-react-native）

```javascript
import { Camera } from "lucide-react-native";
<FloatingButton IconComponent={Camera} onPress={openCamera} />
// ActionButton は IconComponent prop（文字列ではなくコンポーネントを渡す）
// Globe2 は v0.577.0 に存在しない → Globe で代替
```

### app.json slug

`react-native-text-ml-kit-text-recognition3`（expo.dev 登録値）に固定。**変更すると EAS Build / `eas credentials` が全て失敗する**。

### iOS 実機テスト（Windows 11 環境）

- **Developer Mode**: `設定 → プライバシーとセキュリティ → デベロッパモード → ON → 再起動`（USB 不要・iPhone 単体で完結）
- **Ad Hoc インストール**: Safari のみ対応（Chrome・LINE 内ブラウザは `itms-services://` 未対応で無言失敗）
- **Metro 接続**: PC と iPhone を同じ WiFi に接続 + Windows Firewall でポート 8081 を開放
  ```powershell
  # 管理者 PowerShell で実行
  New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
  ```
- **接続失敗時**: `npx expo start --dev-client --tunnel`（@expo/ws-tunnel 自動使用）
- **カメラ/ギャラリー権限**: `設定 → ヨミトルAI → 写真 → すべての写真` に変更が必要

### Firebase iOS（@react-native-firebase v21 + Expo SDK 54）

**重要: @react-native-firebase/app v21 の built-in Config Plugin は Expo SDK 54 非対応**

- v21 プラグインは AppDelegate に `self.moduleName = "..."` regex でアンカーを探すが、SDK 54 の Swift AppDelegate にこのパターンは存在しない
- プラグインは黙ってスキップ → ビルドは通るが `FirebaseApp.configure()` が未呼び出し → JS で `auth()` 呼び出し時に `No Firebase App '[DEFAULT]'` エラー
- **解決策**: `plugins/withFirebaseAppDelegateSwift.js` カスタムプラグインで AppDelegate.swift に直接注入

```json
// app.json plugins 登録順（必ずこの順番）
"@react-native-firebase/app",
"./plugins/withFirebaseAppDelegateSwift"
```

- `GoogleService-Info.plist` は `google-services.json` と同様に **git commit 必須**（EAS Build は git clone で動作）
- `authManager.js` のモジュールレベル `auth()` 呼び出しは禁止 → `ensureAuthListener()` パターンで遅延初期化

### その他

- `react-native-reanimated ~4.1.1`: `newArchEnabled=true` が必須（変更不可）
- **Expo Go では動作しない** — ネイティブモジュール含む。EAS Dev Build 必須
- `react-native-google-mobile-ads` Config Plugin バグ（#820, #835）— `app.json` の `plugins` に追加しないこと
- `@google/genai` SDK: Metro bundler が `"browser"` 条件を解決 → `dist/web/` バンドルが自動選択（Node.js固有コードは混入しない）

### mlKitTextReconstructor.js（アルゴリズム詳細）

詳細: [docs/technical/reconstructor-design.md](docs/technical/reconstructor-design.md)
要点: `groupMaxH×0.6` 適応 yTolerance + height-ratio guard（1.5倍超で tolerance×0.3）+ ピクセルギャップ列区切り（avgHeight×0.8 → `"  "`）。

### receiptParser.js（設計原則）

詳細: [docs/technical/parser-design.md](docs/technical/parser-design.md)
要点: 2スペース区切り列境界・TOTAL_RE はEXCLUDE前評価・令和/R短縮形日付対応・Y/y→¥誤認識対応。

### xlsx / expo-sharing の制約

```javascript
const XLSX = require("xlsx");
const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
// Hermes は Buffer 未対応 → type:"base64" が必須
await FileSystem.writeAsStringAsync(filePath, base64, { encoding: "base64" });
```
- xlsx Hermes 失敗時: `XLSX_UNAVAILABLE` エラー → `exportReceiptAsCSV()` に自動フォールバック
- BOM付きCSV: `"﻿" + csvText` で Excel 日本語文字化け防止

---

## EAS Build 手順

```bash
# Android
eas build --profile development --platform android --no-wait  # Dev Build（実機テスト用）
eas build --profile production --platform android             # Google Play 提出用（AAB）

# iOS
eas build --profile development --platform ios --no-wait      # Dev Build（Ad Hoc 実機テスト用）
eas build --profile production --platform ios                 # App Store 提出用（.ipa）

# 共通
npx expo start --dev-client                                   # Metro 起動（WiFi直結）
npx expo start --dev-client --tunnel                          # Metro 起動（Tunnel）
```

`.env.local` に必要な環境変数:
- `EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_CLOUD_VISION_API_KEY` / `EXPO_PUBLIC_ANDROID_CERT_SHA1`
- `EXPO_PUBLIC_GEMINI_API_KEY` / `EXPO_PUBLIC_CLOUD_VISION_DAILY_LIMIT`（省略時デフォルト: 30）

本番リリース時の EAS Secrets:
```bash
eas secret:create --name EXPO_PUBLIC_ADMOB_BANNER_ID --value ca-app-pub-4083422635947412/8071125037
eas secret:create --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID --value ca-app-pub-4083422635947412/8597738645
eas secret:create --name EXPO_PUBLIC_ADMOB_NATIVE_ID --value ca-app-pub-4083422635947412/8337931922
```

---

## 収益化戦略・実装ロードマップ

### フリーミアム プラン設計（確定）

```
無料プラン:
  - ML Kit OCR（印刷文字・無制限・オフライン対応）
  - Cloud Vision API（手書き認識・日次上限あり）
  - RECEIPTモード（正規表現パーサー・無制限・Gemini 不使用・コスト¥0）
  - EDUCATIONモード + クイズ生成: Gemini Lite お試し（月次上限あり）
  - 広告表示あり（AdMob Banner + Interstitial + Native）
  - 履歴 100件

プレミアムプラン（¥480/月）:
  - Gemini 2.5 Flash Lite（EDUCATION 構造化・クイズ生成 無制限）
  - 広告なし / 履歴無制限 / Markdown・CSV エクスポート
```

採算性: RECEIPTは標準レシートコスト¥0、複雑レシートのみ≈¥0.07。EDUCATION 1スキャン≈¥0.07+クイズ≈¥0.03。損益分岐 4,800回/月 → コスト破綻リスクほぼゼロ。

### 実装ロードマップ

| フェーズ | 内容 | 状態 |
|---------|------|------|
| フェーズ 1 | Gemini OCR 統合（@google/genai 新SDK・gemini-2.5-flash） | ✅ 完了 2026-03-18 |
| フェーズ 2 | OCRモード拡張・構造化UIコンポーネント・receiptParser | ✅ 完了 2026-03-22〜23 |
| フェーズ 2.5 | receiptParser 精度向上 + Excel/CSV エクスポート | ✅ 完了 2026-04-07 |
| フェーズ E1 | 教育モード クイズ生成（quizGenerator.js・QuizView.js） | ✅ 完了 2026-04-30 |
| フェーズ E2 | Anki エクスポート・クイズ履歴保存・HistoryScreen 改修 | ✅ 完了 2026-05-01 |
| フェーズ 3 | RevenueCat サブスクリプション（purchaseManager.js・PaywallModal.js） | 実装中 |
| フェーズ 4 | Firebase Functions Proxy（APIキー隠蔽）・クラウド履歴同期 | 未実装 |

詳細: [docs/planning/phase3-4-plan.md](docs/planning/phase3-4-plan.md)

### AdMob ID 一覧

| 広告種別 | 本番 ID |
|---------|--------|
| App ID | `ca-app-pub-4083422635947412~4707834796` |
| Banner | `ca-app-pub-4083422635947412/8071125037` |
| Interstitial | `ca-app-pub-4083422635947412/8597738645` |
| Native | `ca-app-pub-4083422635947412/8337931922` |

開発中（`.env.local` 未設定時）は Google 公式テスト ID に自動フォールバック。

---

## 現在の残タスク

| # | タスク | 状態 |
|---|--------|------|
| 1 | プライバシーポリシー URL 登録 | ✅ 完了 |
| 2 | Google Play Console 本人確認 | ✅ 提出済み（審査中・24〜72時間） |
| 3 | ストア掲載情報入力（説明文・スクリーンショット等） | ✅ 完了 2026-05-08 |
| 4 | EAS Build production → Google Play 内部テスト提出 | ✅ 提出済み（審査待ち 2026-05-08） |
| 5 | Google Play Console 広告 ID 宣言（AD_ID）| ✅ 完了 2026-05-08（広告・マーケティング選択） |
| 6 | premium_monthly 定期購入商品作成 | ⏳ 内部テスト審査完了後に実施 |
| 7 | RevenueCat コンソール設定（API Key 取得・商品登録） | ⏳ premium_monthly 作成後に実施 |
| 8 | フェーズ 3: RevenueCat サブスクリプション（Step 3〜4） | ⏳ RevenueCat 設定完了後にコード実装 |
| 9 | フェーズ 4: Firebase Functions Proxy | 未実装（Blaze プランが前提） |
| 10 | iOS Dev Build 実機テスト | ⏳ Firebase 動作確認待ち（build 86d8977a） |
| 11 | EAS Dev Build 再ビルド（Firebase 追加のため） | ✅ 完了 2026-05-07（build 4932d71f） |
| 12 | Gemini API クォータを Cloud Console で設定（推奨200 req/day） | 未実施 |
| 13 | Cloud Vision iOS 対応（X-Ios-Bundle-Identifier ヘッダー追加） | 未実施 |
| 14 | iOS Production Build → App Store 提出 | ⏳ iOS Dev テスト完了後 |

---

## 設計ドキュメント（詳細参照先）

- [docs/history/work-logs.md](docs/history/work-logs.md) — 日付別作業ログ（2026-02-13〜05-09）
- [docs/planning/phase3-4-plan.md](docs/planning/phase3-4-plan.md) — フェーズ3+4（RevenueCat+Firebase）実装計画
- [docs/technical/reconstructor-design.md](docs/technical/reconstructor-design.md) — mlKitTextReconstructor アルゴリズム詳細
- [docs/technical/parser-design.md](docs/technical/parser-design.md) — receiptParser 設計原則
- [docs/history/code-review-history.md](docs/history/code-review-history.md) — 完了済みレビュー詳細（C1〜L7）
