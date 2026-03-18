# OCR-APP プロジェクト

## プロジェクト概要

React Native (Expo SDK 54) + ML Kit Text Recognition のOCRアプリ。
カメラ/ギャラリーから画像を取得し、日本語テキスト認識して履歴保存する。

- **フレームワーク**: React Native 0.81.5 + Expo SDK 54
- **画面数**: 2 (HomeScreen, HistoryScreen)
- **コンポーネント数**: 5 (ActionButton, FloatingButton, SaveButton, ClearButton, ErrorBoundary)
- **ナビゲーション**: React Navigation Stack
- **ストレージ**: AsyncStorage（secureStorage.js の `AppStorage` ラッパー経由、OCR履歴はユーザー生成テキストのため機密非該当）
- **OCR**: @react-native-ml-kit/text-recognition (日本語) + Cloud Vision API (主エンジン) + Gemini 2.5 Flash（構造化抽出・新SDK）
- **エラー監視**: @sentry/react-native（DSN設定後に有効）
- **アイコン**: lucide-react-native + react-native-svg（2026-03-06 fontawesome6 から移行）

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
    imagePreprocessing.js # 画像前処理（最長辺2400px適応リサイズ、JPEG0.95、EXIF回転補正）
    textFilter.js         # OCR結果フィルタ（空白行・1文字行・記号行・句読点行除去、連続空行正規化）
    cloudVisionOCR.js     # Cloud Vision API OCR（X-Android-Package/Cert ヘッダー付き）
    geminiOCR.js          # Gemini 2.5 Flash OCR（@google/genai 新SDK・マルチモーダル・レシート構造化JSON出力）
    secureStorage.js      # AsyncStorage ラッパー（AppStorage エクスポート）
    monitoring.js         # Sentry エラー監視ラッパー（DSN未設定時はノーオペレーション）
    usageTracker.js       # Cloud Vision + Gemini API 日次使用カウンター（get/increment）
  constants/
    storage.js            # HISTORY_KEY
    colors.js             # COLORS（primary, background, white, textPrimary, textSecondary, ...）
    messages.js           # MESSAGES（ERROR, SUCCESS, CONFIRM, INFO）
    app.js                # HISTORY_LIMIT=100, MAX_TEXT_LENGTH=5000, CLIPBOARD_CLEAR_DELAY=30000, OCR_ENGINE, CLOUD_VISION_DAILY_LIMIT
  navigations/
    RootNavigation.js     # NavigationContainer
    stack/
      HomeStack.js        # Stack.Navigator (Home, History)
docs/
  history/
    code-review-history.md   # 完了済みレビュー詳細（C1〜L7, Phase 5）
    work-logs.md             # 日付別作業ログ（2026-02-13〜03-06）
  planning/
    backend-ocr-architecture.md  # ConoHa VPS + PaddleOCR 計画（未実装・スケール後 Phase 3）
```

---

## 2026-03-18 実施作業

### @google/genai 新SDK 導入・Gemini 2.5 Flash 移行（EAS Dev Build 動作確認済み）

#### 背景
2026-03-17 の実装で `gemini-flash-latest`（v1beta 経由）は動作していたが、モデルが「最新Gemini Flash」のエイリアスであり、明示的に `gemini-2.5-flash` を指定できない問題があった。Google Quickstart が推奨する新SDK（`@google/genai`）を導入することで解決。

#### 変更内容

| ファイル | 内容 |
|---------|------|
| `src/utils/geminiOCR.js` | **書き換え** — 直接 fetch → `@google/genai` 新SDK に移行 |
| `package.json` | `@google/genai: ^1.46.0` 追加 |
| `package-lock.json` | 36パッケージ追加 |

**Gitブランチ**: `feat/gemini-25-flash-new-sdk`（master にマージ済み）

#### 新SDK の書き方（旧fetch方式との比較）

```javascript
// 旧: 直接 fetch（v1beta URL + モデル名制限あり）
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, { ... });

// 新: @google/genai SDK（モデル名を定数で自由に指定可能）
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",   // ← 明示的に指定
  contents: [{ parts: [...] }],
  config: { responseMimeType: "application/json" },
});
const text = response.text;  // ← SDK のショートカットゲッター
```

#### タイムアウト実装の変化

```javascript
// 旧: AbortController + setTimeout（fetch に signal を渡す）
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
response = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);

// 新: Promise.race（SDK は AbortController を直接受け取らないため）
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("Gemini API timeout after 30s")), 30000)
);
const response = await Promise.race([generatePromise, timeoutPromise]);
```

#### Metro Bundler と Web版バンドルの仕組み（重要な知見）

`@google/genai` は2つのバンドルを持つ:
- `dist/node/` — Node.js専用（`fs`, `google-auth-library`, `ws` を含む）
- `dist/web/` — ブラウザ・React Native向け（`fetch` のみ使用）

`package.json` の `exports` フィールドに `"browser"` 条件が定義されており、Metro bundler は React Native ビルド時にこの条件を参照して `dist/web/` を自動選択する。そのため Node.js 固有 API が Hermes に混入しない。

**セキュリティ観点**: Web版の方がバンドルに含まれるコードが少なく攻撃対象領域が狭い。通信経路（fetch → Gemini API）は旧実装と完全に同じ。APIキーのバンドル埋め込みリスクは SDK 選択と無関係で、フェーズ4（Firebase Functions Proxy）で解決予定。

#### リバート方法

```bash
git checkout master
npm install
```

---

## 2026-03-17 実施作業

### Gemini Flash OCR フェーズ1 実装完了（APIエンドポイント問題は 2026-03-18 に解決済み）

#### 実装済みファイル一覧

| ファイル | 内容 |
|---------|------|
| `src/utils/geminiOCR.js` | **新規作成** — `isGeminiAvailable()` + `recognizeTextWithGemini()` |
| `src/utils/usageTracker.js` | `getGeminiUsageToday()` / `incrementGeminiUsage()` を追加 |
| `src/constants/app.js` | `OCR_ENGINE.GEMINI_FLASH` + `GEMINI_DAILY_LIMIT=100` を追加 |
| `src/constants/messages.js` | Gemini 関連メッセージ4件追加 |
| `src/screens/HomeScreen.js` | Gemini import + エンジン選択 + OCR ブランチ追加 |
| `.env.example` | `EXPO_PUBLIC_GEMINI_API_KEY` / `EXPO_PUBLIC_GEMINI_DAILY_LIMIT` テンプレート追加 |

#### Gemini API エンドポイント問題（**解決済み** 2026-03-18）

**根本原因**: v1beta URLでモデル名を直接指定する方式は、AI Studio APIキーで使えるモデルIDが制限されていた。

**解決策**: `@google/genai` 新SDK（v1.46.0）を導入することで解決。
SDKが内部でモデル名の解決を行うため、`"gemini-2.5-flash"` を直接指定可能になった。
→ 詳細は「2026-03-18 実施作業」セクション参照

#### セキュリティインシデント（2026-03-17）
- **APIキースクリーンショット流出**: AI Studio の画面キャプチャにAPIキーが写り込みチャットへ送信
- **対処**: AIキーをローテーション（AI Studio → キーを削除 → 新規作成）+ `.env.local` 更新

---

## 2026-03-16 実施作業（計画フェーズ）

### Gemini Flash OCR 統合計画（技術選定・収益化戦略確定）

#### 技術選定結果: Gemini 2.0 Flash を採用

| 比較軸 | Document AI | Gemini Flash | 決定 |
|--------|-------------|--------------|------|
| 1スキャンコスト | $0.0015 | $0.00001 | Gemini Flash |
| 月10万回コスト | $150 | $1 | Gemini Flash |
| 構造化JSON出力 | ネイティブ | JSONモード対応 | 同等 |
| レシート以外の文書 | 別Processor必要 | 何でも対応 | Gemini Flash |
| 直接画像解析 | OCR経由 | マルチモーダル | Gemini Flash |

**結論**: Document AI は精度は高いがコストが100倍以上。スケール時の収益化を考えるとGemini Flashが圧倒的優位。

#### 収益化戦略: フリーミアムハイブリッド

```
無料プラン:
  - ML Kit OCR（無制限）
  - Gemini Flash 構造化抽出 10回/月
  - 広告表示あり（AdMob）
  - 履歴100件

プレミアムプラン（¥480/月）:
  - Gemini Flash OCR（無制限）
  - 広告なし
  - 履歴無制限 + クラウド同期
  - CSV/Excelエクスポート
  - カテゴリ自動タグ付け
```

#### 実装ロードマップ（4フェーズ）

**フェーズ 1（次回着手）: Gemini Flash OCR統合**
- `src/utils/geminiOCR.js` 新規作成
- `OCR_ENGINE.GEMINI_FLASH` を `constants/app.js` に追加
- `.env.local` に `EXPO_PUBLIC_GEMINI_API_KEY` 追加
- `HomeScreen.js` にエンジン選択肢を追加
- 出力JSON構造: `{ merchant, date, total, tax, items[], raw_text }`

**フェーズ 2: レシートビュー UI**
- `src/components/ReceiptView.js` 新規作成（店名・合計・明細テーブル）
- "テキスト表示" ↔ "レシート表示" トグル
- Share API でCSV/JSONエクスポート

**フェーズ 3: RevenueCat サブスクリプション**
- `react-native-purchases` 導入
- `src/utils/purchaseManager.js` 新規作成
- `src/components/PaywallModal.js` 新規作成（10回消費後に表示）

**フェーズ 4: バックエンド（Firebase）**
- Gemini API をFirebase Functions 経由に移動（セキュリティ強化）
- クラウド履歴同期

#### セキュリティ注意事項（重要）
- **フェーズ1**: 開発確認用として `EXPO_PUBLIC_GEMINI_API_KEY` をクライアントに直接埋め込む
- **フェーズ4以降**: Firebase Functions の Proxy 経由に移行してAPIキーをサーバーサイドに隠蔽する
- Gemini APIキーには Cloud Vision と異なり「Androidアプリ制限」が適用できない点に注意

---

### Gemini API キー設定手順（完了済み）

#### AI Studio でのAPIキー作成
- **作成済み**: aistudio.google.com でAPIキーを作成
- **紐付け**: 既存GCPプロジェクト（Cloud Vision APIと同じプロジェクト）に紐付けが必要

#### 既存GCPプロジェクトへの紐付け手順
```
① aistudio.google.com → 左メニュー「Get API key」
② 「Create API key」→ ドロップダウンで既存プロジェクトを選択
   （Cloud Vision API と同じプロジェクト名）
③ 「Create API key in existing project」

確認方法:
  console.cloud.google.com → プロジェクト選択
  → 「APIとサービス」→「認証情報」
  → APIキー一覧にGeminiキーが表示されていれば紐付け完了
```

#### Generative Language API の有効化（未確認・要実施）
```
Cloud Console → 「APIとサービス」→「ライブラリ」
→「Generative Language API」を検索 → 「有効にする」
```

#### モデル名（コードで使用）
```javascript
model: "gemini-2.0-flash"  // 推奨（最新・無料枠あり）
// または
model: "gemini-1.5-flash"  // 安定版
```

#### Gemini 2.0 Flash 無料枠
- 1日1,500リクエスト無料
- 毎分15リクエスト（RPM）
- 開発中・MVP段階では完全無料で動かせる

---

## 2026-03-15 実施作業

### ネイティブ アドバンス広告を HistoryScreen FlatList に追加

#### 変更ファイル一覧
| ファイル | 内容 |
|---------|------|
| `src/constants/app.js` | `AD_UNIT_IDS.NATIVE` / `NATIVE_AD_INTERVAL=5` / `HISTORY_ITEM_HEIGHT=132` 追加 |
| `src/components/NativeAdCard.js` | **新規作成** — ネイティブ広告カードコンポーネント |
| `src/screens/HistoryScreen.js` | `useMemo` + `listData` + `renderItem` 分岐 + `data={listData}` |
| `.env.example` | `EXPO_PUBLIC_ADMOB_NATIVE_ID` テンプレート追加 |

#### 実装の設計ポイント
- `history` 配列に `{ id: 'ad_N', type: 'ad' }` ダミーを `NATIVE_AD_INTERVAL=5` 件おきに挿入した `listData` を `useMemo` で生成
- `renderItem` で `item.type === 'ad'` を判定して `NativeAdCard` を表示
- ヘッダーの「N件」表示は `history.length`（元配列）を使用 → 広告がカウントに混入しない
- `HISTORY_ITEM_HEIGHT` を `constants/app.js` に移動 → `NativeAdCard` と共有（循環インポート回避）
- `NativeAdCard` の placeholder が `HISTORY_ITEM_HEIGHT` と同一高さ → `getItemLayout` の一貫性を維持

#### NativeAdCard の実装（v16 正しい API）
```javascript
// v16 の正しい API: NativeAd.createForAdRequest()（Promiseベース）
NativeAd.createForAdRequest(AD_UNIT_IDS.NATIVE)
  .then((loaded) => { setNativeAd(loaded); })
  .catch((error) => { captureError(error, ...); });

// クリーンアップ必須（メモリリーク防止）
return () => { ad?.destroy(); };
```

#### AdMob Native Ad ID の管理
- 本番 Native Ad Unit ID: `ca-app-pub-4083422635947412/8337931922`
- Dev Build でテスト広告を使う間は `.env.local` の `EXPO_PUBLIC_ADMOB_NATIVE_ID` をコメントアウト
  → `app.js` のフォールバックでテスト ID `ca-app-pub-3940256099942544/2247696110` が自動使用される
- Production Build 時: `eas secret:create --name EXPO_PUBLIC_ADMOB_NATIVE_ID --value ca-app-pub-4083422635947412/8337931922`

---

### AdMob ネイティブ広告 トラブルシューティング（重要）

#### `useNativeAd is not a function` エラー
- **原因**: `useNativeAd` フックは `react-native-google-mobile-ads` v16 に存在しない（古いドキュメントに記載あり）
- **正しい API（v16）**:
  - `NativeAd.createForAdRequest(adUnitId)` → Promise で `NativeAd` インスタンスを返す
  - `<NativeAdView nativeAd={instance}>` → インスタンスを prop で渡す
  - `<NativeAsset assetType={NativeAssetType.HEADLINE}>` → アセット表示

#### 本番 Native Ad Unit ID で Promise がハング（解決・拒否されない）
- **原因**: AdMob アカウントが「広告配信を制限しています」状態のとき、本番 ID へのリクエストが応答なしでハングする
- **テスト ID は審査状態に関わらず常に動作する**（Google 公式テスト ID は別扱い）
- **判定方法**:
  1. `useEffect` 開始 Alert → 表示される → Promise がハング
  2. テスト ID を直接ハードコード → 成功 Alert が出る → 本番 ID の問題
- **対処**: AdMob 審査完了（「配信中」）になるまでは `.env.local` の本番 ID をコメントアウトしてテスト ID で運用

#### AdMob ポリシー必須事項
- ネイティブ広告には **「広告」ラベルを必ず表示**すること（省略はポリシー違反でアカウント停止リスク）
- `NativeAsset` でラップすることで AdMob SDK のクリック計測が正しく動作する

---

### iOS 向けビルド計画（Apple Developer Program 登録済み・次回以降実施）

#### 本日実施（2026-03-15）
- Apple Developer Program への登録申請（$99/年）

---

## 2026-03-15 iOS 向けビルド計画（Apple Developer Program 登録済み・次回以降実施）

### 概要
Android 向けビルド完成後、iOS 向けに展開する計画。開発環境は Windows のため EAS クラウドビルドを使用。

### 本日実施（2026-03-15）
- Apple Developer Program への登録申請（$99/年）
- 承認メール到着まで次フェーズは進められない（通常24時間以内〜最大3営業日）

### 次回以降の実施手順

#### フェーズ 1: `app.json` iOS セクション追加
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.hiro8277.rnrocr",
      "buildNumber": "1"
    }
  }
}
```
- `bundleIdentifier` は **一度 App Store Connect に登録したら変更不可**

#### フェーズ 2: `eas.json` iOS 設定確認
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false }
    }
  }
}
```

#### フェーズ 3: EAS 証明書設定
```bash
# 証明書・プロビジョニングプロファイルを EAS が自動生成
eas credentials --platform ios

# 実機の UDID を登録（QRコードを iPhone で読み取る）
eas device:create
```

#### フェーズ 4: iOS Development Build
```bash
eas build --profile development --platform ios --no-wait
```
- ビルド完了後: EAS ダッシュボードの QR コード → iPhone のブラウザで .ipa をインストール（Mac 不要）
- ビルド時間目安: 30〜60分

#### フェーズ 5: 要確認事項（コード修正が必要な可能性あり）
- **AdMob iOS 設定**: `Info.plist` への `GADApplicationIdentifier` 追加が必要（Androidは `AndroidManifest.xml`）
  - iOS 用の Ad Unit ID を AdMob コンソールで別途作成する必要あり
  - Config Plugin バグ（#820, #835）が iOS でも存在するか確認が必要
- **ML Kit iOS**: `@react-native-ml-kit/text-recognition` の iOS 向け追加設定の要否を確認
- **Cloud Vision API**: Android ヘッダー（`X-Android-Package` / `X-Android-Cert`）を iOS では送らない分岐が必要

### Windows での .ipa インストール方法
- Apple Configurator 2 は Mac 専用 → 使用不可
- **EAS Internal Distribution の QR コード経由** → iPhone ブラウザからインストール ✅（推奨）
- TestFlight → App Store Connect 経由（フェーズ 5 以降で検討）

### 全体スケジュール（目安）
```
Apple Developer Program 承認（〜3営業日）
  → app.json / eas.json iOS設定追加
  → eas credentials（証明書自動生成）
  → eas device:create（実機 UDID 登録）
  → eas build --platform ios（約30〜60分）
  → QR コードで実機インストール → 動作確認
```

---

## 2026-03-14 実施作業

### Cloud Vision API 429 エラーハンドリング改善

#### 背景
Sentry に `Cloud Vision API HTTP error: 429` が記録された。Google Cloud Console のクォータを意図的に低く設定（1回/分・2回/分）しているため、設定が効いているかの確認目的だった。ただしエラー種別を区別せずサイレントフォールバックしていたためユーザーへの通知がなかった。

#### 変更内容
- **`src/utils/cloudVisionOCR.js`** — `CloudVisionRateLimitError` クラスを追加。429 レスポンス時にこのクラスを throw
- **`src/screens/HomeScreen.js`** — `instanceof CloudVisionRateLimitError` で判定し「しばらくお待ちください」アラートを表示（2箇所: `recognizeText` / `recognizeTextHighPrecision`）
- **`src/constants/messages.js`** — `RATE_LIMIT_TITLE` / `RATE_LIMIT_BODY` を追加

#### 動作
- 429 発生時: アラート「しばらくお待ちください — ML Kitの認識結果を表示しています」
- `recognizeText`（自動OCR）: アラート後も ML Kit 結果は表示される
- `recognizeTextHighPrecision`（手動高精度）: アラートのみ（フォールバック結果なし）

---

### AdMob 導入実装

#### 概要
`react-native-google-mobile-ads`（Invertase）を導入。Banner（HomeScreen最下部常時表示）+ Interstitial（OCR完了後3回に1回）。

#### App ID / Ad Unit ID
- **App ID**: `ca-app-pub-4083422635947412~4707834796`（AndroidManifest に記載）
- **Banner Ad Unit ID（本番）**: `ca-app-pub-4083422635947412/8071125037`
- **Interstitial Ad Unit ID（本番）**: `ca-app-pub-4083422635947412/8597738645`
- 開発中（テスト ID フォールバック）: `process.env.EXPO_PUBLIC_ADMOB_*` 未設定時は Google 公式テスト ID を自動使用

#### 変更ファイル一覧
| ファイル | 内容 |
|---------|------|
| `android/app/src/main/AndroidManifest.xml` | `com.google.android.gms.ads.APPLICATION_ID` の `<meta-data>` 追加 |
| `src/constants/app.js` | `AD_UNIT_IDS` / `INTERSTITIAL_FREQUENCY=3` / `BANNER_HEIGHT=60` 追加 |
| `.env.example` | `EXPO_PUBLIC_ADMOB_BANNER_ID` / `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID` テンプレート追加 |
| `src/utils/adManager.js` | **新規作成** — Interstitial プリロード・OCRカウンター・クリーンアップ |
| `src/screens/HomeScreen.js` | Banner 配置・Interstitial トリガー・paddingBottom=150 追加 |
| `src/components/FloatingButton.js` | `bottom: 30` → `bottom: 90` |
| `src/components/SaveButton.js` | `bottom: 30` → `bottom: 90` |
| `src/components/ClearButton.js` | `bottom: 30` → `bottom: 90` |

#### 重要な設計ポイント
- **Config Plugin は使用しない**（Expo SDK 54 + RN 0.81 でバグ #820, #835）→ `app.json` の `plugins` に追加しないこと
- `adManager.js` でシングルトンパターン: アプリ起動時にプリロード → `CLOSED` イベントで自動リロード
- 本番 ID は `eas secret:create` で EAS Secrets に登録（`.env.local` への記載不要）
- Banner は `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` でデバイス幅に適応

#### 現在の状態
EAS Development Build 完了・動作確認済み（2026-03-15）

#### EAS Dev Build 完了後の確認項目
- [x] Banner 広告が画面最下部に表示される
- [x] OCR 3回目で Interstitial が表示される
- [x] 機内モードでアプリがクラッシュしない
- [x] FloatingButton / SaveButton / ClearButton が Banner と重ならない

#### 本番リリース時の追加作業
```bash
eas secret:create --name EXPO_PUBLIC_ADMOB_BANNER_ID --value ca-app-pub-4083422635947412/8071125037
eas secret:create --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID --value ca-app-pub-4083422635947412/8597738645
```

---

## 2026-03-15 実施作業

### Interstitial 広告 表示タイミング変更

#### 変更内容
- **`src/screens/HomeScreen.js`** — `showInterstitialIfReady()` の呼び出し位置を変更（2箇所）

| 関数 | 変更前 | 変更後 |
|------|--------|--------|
| `recognizeText` | `applyOCRResult()` 直後（OCR完了後） | `setIsLoading(true)` 直後（ローディング開始時） |
| `recognizeTextHighPrecision` | `applyOCRResult()` 直後（OCR完了後） | `setIsLoading(true)` 直後（ローディング開始時） |

#### 動作の変化
- **変更前**: OCR 完了後に広告表示 → 結果が見えた直後に広告で遮られる
- **変更後**: ローディング開始と同時に広告表示 → ユーザーが広告を閉じる頃には OCR 完了済み
- 頻度: 変わらず 3 回に 1 回（`INTERSTITIAL_FREQUENCY = 3`）
- `recognizeTextHighPrecision` の日次上限超過時（早期 return）は広告カウントされない（仕様）

### AdMob 承認状況（要審査）について

#### 現状
- AdMob コンソールで TEXT SCAN が「要審査」から進まない
- ステータス詳細: 「ストア情報を追加してトラフィックの上限を引き上げる」

#### 原因と対処
- **主因**: `ストアを追加` が未実施（AdMob に Play Store URL が未リンク）
- **今すぐやること**: AdMob コンソール → アプリ → `ストアを追加` をクリック → Play Store URL を入力
  - 内部テスト中でも URL は存在する: `https://play.google.com/store/apps/details?id=パッケージ名`
- **完全承認（トラフィック上限解除）**: Production トラック公開後に自動解除
- **開発中への影響なし**: テスト Ad Unit ID を使っている限り広告表示は問題なし

---

## 2026-03-12 実施作業

### Google Play Console 内部テスト提出（EAS Production Build）

#### AAB vs APK の違いと正しいビルドプロファイル
- Google Play Console は **APK を受け付けない**（2021年8月以降、新規アプリは AAB 必須）
- `eas.json` の `production` プロファイルのみ `buildType: "app-bundle"` → **Google Play 用は必ず `--profile production`**
- `development` / `preview` プロファイルは `buildType: "apk"` → 直接インストール用

```bash
# Google Play 提出用（AAB生成）
eas build --profile production --platform android
```

#### EAS キーストアは dev/prod 共通
- EAS 管理キーストアは **1アプリにつき1つ**。`development` も `production` も同じキーストアで署名される
- `.env.local` の `EXPO_PUBLIC_ANDROID_CERT_SHA1` は production ビルドでもそのまま有効
- ローカルでキーストアを手動管理している場合のみ dev/prod が異なる

#### expo-updates インストール時の注意
- production ビルド中に `expo-updates` を初回インストールすると「Command must be re-run」エラーで一旦失敗する
- これは正常動作。**同じコマンドをもう一度実行**するだけで解決

#### runtimeVersion: bare workflow では文字列で指定
- `expo-updates` の自動設定が `{"policy": "appVersion"}` を `app.json` に追加するが、bare workflow では非対応
- **修正**: `"runtimeVersion": "1.0.0"` と文字列で直接指定する
- `version` と `runtimeVersion` は同じ値に揃えて運用する

```json
// NG（Managed Workflow 専用）
"runtimeVersion": { "policy": "appVersion" }

// OK（Bare Workflow）
"runtimeVersion": "1.0.0"
```

### ML Kit 事前スクリーニング実装（Cloud Vision API 節約）

#### 変更内容
- **`src/screens/HomeScreen.js`** — `recognizeText` 関数のフローを変更
- **`src/constants/messages.js`** — `NO_TEXT_DETECTED_TITLE` / `NO_TEXT_DETECTED_BODY` を追加

#### 新しい OCR フロー（Cloud Vision 選択時）
```
変更前: Cloud Vision 直接呼び出し → 失敗時のみ ML Kit
変更後: ML Kit 先行実行
          → テキストなし → アラート表示・終了（Cloud Vision 未呼び出し）
          → テキストあり → Cloud Vision 呼び出し
              → 失敗時: 既取得の ML Kit 結果を再利用（再実行なし）
```

#### 設計のポイント
- ML Kit を先行実行することで **Cloud Vision 失敗フォールバックで ML Kit を再実行する必要がなくなる**（コード重複排除）
- 判定基準: `mlKitText.trim().length === 0`（シンプルかつ信頼性が高い）
- `finally` ブロックにより早期 `return` でも `setIsLoading(false)` は確実に実行される

### Google Play Console 内部テスト 公開完了

#### 内部テスト公開時の警告 2 件（正常）

**① テスター未指定の警告**
- 原因: 内部テストトラックにテスターを設定していないと AAB をアップロードしても誰にも配信されない
- 対処: Play Console → 内部テスト → テスター タブ → リスト作成 → 自分の Gmail を追加
- 追加後にオプトイン URL が発行される → そのURLを開いてテスター登録 → Google Play 経由でインストール可能

**② 難読化解除ファイルなしの警告**
- 原因: React Native は Android ビルド時に R8 が自動有効になるため Google Play が警告を出す
- 対処: **無視してOK**（Sentry でクラッシュ分析可能。MVP では不要）
- 将来対応: EAS Build ログから `mapping.txt` を取得し Play Console にアップロード

#### 「保存して公開」の意味
- 内部テスト（Internal Testing）での「保存して公開」は **指定テスターにのみ配信**。一般公開ではない
- Google Play ストアの検索に表示されない・他ユーザーはアクセス不可
- 一般公開は **製品版（Production）トラック** のみ。内部テスト → クローズドテスト → オープンテスト → 製品版 の順に昇格させないと移動しない
- 修正後は新しい AAB をアップロードするだけで上書き可能

#### Google Play トラック構造
```
内部テスト（Internal Testing）  ← 今ここ（完了）
    ↓ 手動昇格のみ
クローズドテスト（12名・14日間）
    ↓ 手動昇格のみ
オープンテスト
    ↓ 手動昇格のみ
製品版（Production）  ← 一般公開はここだけ
```

### AdMob 導入計画（コード実装は次回）

#### 実装ロードマップ（未着手）
1. AdMob コンソールでアプリ登録 → App ID 取得（`ca-app-pub-XXXX~YYYY` 形式）
2. Banner・Interstitial の Ad Unit ID を作成
3. `npm install react-native-google-mobile-ads`
4. `android/app/src/main/AndroidManifest.xml` に App ID を手動追加（Config Plugin 不使用）
5. `src/constants/app.js` に広告ID定数・表示間隔（3回に1回）追加
6. `src/utils/adManager.js` 新規作成（Interstitial ロード/表示管理）
7. `src/screens/HomeScreen.js` に Banner 配置 + OCR 完了後 Interstitial トリガー
8. `FloatingButton/SaveButton/ClearButton.js` の `bottom: 30` → `bottom: 90`（Banner 分上にずらす）
9. EAS Development Build でテスト広告 ID で動作確認
10. 本番 ID は EAS Secrets で管理（`eas secret:create`）

#### 重要な注意事項
- **Config Plugin バグ**: Expo SDK 54 + RN 0.81 で `react-native-google-mobile-ads` の Expo Plugin にバグあり（GitHub #820, #835）→ `app.json` の `plugins` には追加しない
- **App ID と Ad Unit ID は別物**: AndroidManifest に書くのは App ID（`~` 区切り）
- **テスト ID 固定**: 開発中は必ずテスト Ad Unit ID を使用（本番 ID 使用でアカウント停止リスク）
  - Banner テスト ID: `ca-app-pub-3940256099942544/6300978111`
  - Interstitial テスト ID: `ca-app-pub-3940256099942544/1033173712`
- **App ID はテスト用が存在しない** → AndroidManifest には常に本番 App ID を書く（Ad Unit ID レベルでテスト制御）

---

## 2026-03-10 実施作業

### Phase 1 ストア提出前の「将来対応」項目 判断
- **L1: TypeScript、L2: テスト、L6: 難読化、L7: SSL証明書ピンニング — Phase 1 では全て不要**と確定
- 理由: Google Play は L1/L2 を審査しない。L7 は Google エンドポイントに対してリスクが高い。L6 は Hermes バイトコードで一定難読化済み
- 将来対応: Phase 2 以降（ユーザーフィードバック獲得後）で対応

### Google Play Console 対応
- **プライバシーポリシー URL 登録 完了** (`https://hiro8277.github.io/`)
  - 経路: Play Console → アプリのコンテンツ → プライバシーポリシー
- 本人確認（身元確認）実施中
  - 確認中でもプライバシーポリシー登録・内部テスト提出・ストア掲載情報入力は可能
  - **新規個人アカウント（2023-11-13以降作成）は本番公開前にクローズドテスト12名・14日間が必要**
    → アカウント詳細で該当するか確認すること

### ストア提出ロードマップ（本人確認完了後）
```
本人確認完了
  → ストア掲載情報入力（説明文・スクリーンショット・コンテンツレーティング・データセーフティ）
  → EAS Build (production) + production SHA-1 を EAS 環境変数に設定
  → 内部テスト → クローズドテスト（12名・14日）→ 本番申請
```

### AdMob 導入計画（コード実装前）
- ライブラリ: `react-native-google-mobile-ads`（Invertase）を採用予定
- **⚠️ Expo SDK 54 + RN 0.81 で Config Plugin にバグあり（GitHub #820, #835）**
  → Expo Plugin は使わず手動 AndroidManifest 方式で実装する
- 広告フォーマット: Banner（HomeScreen 最下部）+ Interstitial（OCR完了後）を優先
- **開発中は必ずテスト Ad Unit ID を使うこと**（本番 ID 使用でアカウント停止リスク）
  - Banner テスト ID: `ca-app-pub-3940256099942544/6300978111`
  - Interstitial テスト ID: `ca-app-pub-3940256099942544/1033173712`
- 次のステップ: AdMob コンソールでアプリ登録 → App ID 取得 → コード実装

---

## 2026-03-07 実施作業

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
- `src/constants/messages.js` — エンジン選択・日次上限メッセージ追加
- `.env.example` — `EXPO_PUBLIC_CLOUD_VISION_DAILY_LIMIT=30` 追加
- `src/screens/HomeScreen.js` — `showEngineSelector`・`engineForNextOCR` ref 追加、`openCamera`/`pickImage` 両方にエンジン選択ダイアログを組み込み

**動作フロー（変更後）:**
```
FloatingButton or フォルダアイコン押下
  → 「OCR方法を選択」ダイアログ（Alert.alert）
      ├── ML Kit（通常・オフライン対応）
      ├── Cloud Vision API（高精度）  ← APIキー設定時のみ表示
      └── キャンセル
  → 選択後に画像取得 → 選択エンジンで OCR
  → 日次上限（デフォルト30回）超過時は ML Kit にフォールバック + 通知
  → 「高精度で再認識」ボタンでも日次上限チェック
```

**設計のポイント:**
- `engineForNextOCR` を `useRef` で管理 → レンダリング不要・`useEffect` 依存配列に影響しない
- `OCR_ENGINE.BACKEND` を定数に追加済み → 将来のバックエンド OCR 対応時に拡張するだけ
- 将来のバックエンド計画: `docs/planning/backend-ocr-architecture.md` 参照

### Cloud Vision API 使用制限（Google Cloud Console）
- 「APIs & Services → Cloud Vision API → Quotas」から設定
- **Document text detection requests per minute** を **10** に設定推奨（個人アプリ）
- クォータは開発ビルド・本番ビルドで共有（同一 API キーを使用するため）
- 予算アラート（Billing → Budgets & Alerts）で月 $1 超過時のメール通知を合わせて設定

**3層防御:**
```
Google Cloud Console クォータ 10回/分  ← Hard Limit（コスト保護）
フロントエンド CLOUD_VISION_DAILY_LIMIT=30回/日  ← Soft Limit（UX・事前通知）
将来のバックエンド: ユーザー単位レート制限（Phase 2/3）
```

### APIキーのローテーション
- チャット履歴に API キーが露出 → Google Cloud Console で再生成・`.env.local` を更新済み

---

## 現在の評価状態（2026-03-07 更新）

| 観点 | スコア | 状態 |
|------|--------|------|
| コード品質 | 4.5/5 | ✅ useCallback 全関数対応・useEffect deps 修正完了 |
| セキュリティ | 4.3/5 | ✅ fetchタイムアウト・エラーサニタイズ・microphonePermission削除 |
| パフォーマンス | 4.8/5 | ✅ FlatList最適化・processedURIキャッシュ・全useCallback化 |
| 本番運用準備 | 97/100 | ✅ アイコン・プライバシーポリシー公開完了・Cloud Vision APIキー制限完了 |

**結論: MVPリリース水準に到達。残作業はGoogle Play Console URL登録 → EAS Build (production) → ストア提出。**

### 残タスク（ストア提出前）

1. ~~Google Play Console →「アプリのコンテンツ」→ プライバシーポリシー URL `https://hiro8277.github.io/` を登録~~ ✅ 2026-03-10 完了
2. Google Play Console 本人確認完了待ち（確認中）
3. ストア掲載情報入力（説明文・スクリーンショット・コンテンツレーティング・データセーフティ）
4. EAS Build（production）→ Google Play 内部テストトラックへ提出
5. production EAS Build 時に `EXPO_PUBLIC_ANDROID_CERT_SHA1`（production の SHA-1）を EAS 環境変数に設定
6. AdMob 導入（App ID 取得後 → コード実装 → EAS Dev Build でテスト）

---

## セキュリティ状態サマリー

| カテゴリ | 状態 | リスクレベル |
|---------|------|------------|
| データストレージ | AsyncStorage（OCR履歴は機密情報非該当のため平文で許容）✅ | 🟢 LOW |
| クリップボード | 30秒自動クリア ✅ | 🟢 LOW |
| ログ出力 | 全削除済み ✅ | 🟢 LOW |
| パーミッション | recordAudioAndroid: false ✅ | 🟢 LOW |
| npm脆弱性 | npm audit 0 vulnerabilities ✅ | 🟢 LOW |
| エラー監視 | Sentry統合済み（DSN設定済み: .env.local）✅ | 🟢 LOW |
| Deep Linking | 未設定（実リスクなし） | 🟢 LOW |

将来対応: TypeScript未使用(L1)、テスト0件(L2)、SSL証明書ピンニング(L7)、難読化(L6)

---

## OCR処理フロー（現在）

```
FloatingButton or フォルダアイコン押下
  → 「OCR方法を選択」ダイアログ
      ├── ML Kit（通常・オフライン対応）
      └── Cloud Vision API（高精度）  ← APIキー設定時のみ
  → 画像取得（カメラ or ギャラリー）
  → preprocessImageForOCR（最長辺2400px適応リサイズ + JPEG0.95 + EXIF補正）
  → ローディング表示（ActivityIndicator）
  → 選択エンジンで OCR
      Cloud Vision 選択時: 日次上限チェック → OK なら API 呼び出し → 使用数+1
                           上限超過 or 失敗 → ML Kit にフォールバック
      ML Kit 選択時: ML Kit(JAPANESE) のみ
  → filterOCRResult（記号行・句読点行・1文字行・連続空行を除去）
  → 5000文字制限チェック
  → 表示（ローディング → OCR結果 → 画像プレビュー の順）
      ├ 手動編集トグル（pen/check ボタン）
      └ ML Kit使用時 + APIキーあり: 「高精度で再認識」ボタン → 日次上限チェック → Cloud Vision 強制実行
```

---

## 重要な技術的制約・落とし穴

### Hermes (RN 0.81.5) の制限

- **`crypto.randomUUID()` 使用不可** — Hermes に `crypto` グローバルが存在しない → `expo-crypto` の `Crypto.randomUUID()` を使用
- **`AbortSignal.timeout()` 使用不可** — Hermes の fetch ポリフィルに未実装 → `AbortController + setTimeout` を使用

### expo-file-system v19（legacy API）

```javascript
// NG: import * as FileSystem from "expo-file-system";
// OK:
import * as FileSystem from "expo-file-system/legacy";
// encoding は "base64" 文字列リテラルを直接使用（FileSystem.EncodingType は undefined）
```

### ストレージ選択

- **expo-secure-store**: キー名に `@` 不可・値サイズ 2048 bytes 上限 → OCR 履歴には不適
- **AsyncStorage（AppStorage ラッパー）**: OCR 履歴は機密情報非該当のため採用
- 将来の認証トークン等の機密情報には `expo-secure-store` を推奨

### Cloud Vision API Android アプリ制限

REST API で Android アプリ制限を使う場合:
```javascript
headers: {
  "Content-Type": "application/json",
  "X-Android-Package": "com.yourpackage.name",
  "X-Android-Cert": "abcdef1234...",  // コロンなし・小文字（コロン区切り大文字では 403）
}
```
SHA-1 は `.env.local` に `EXPO_PUBLIC_ANDROID_CERT_SHA1` として設定（Metro 再起動のみで反映）。

### アイコン（lucide-react-native）

`ActionButton` は `IconComponent` prop（文字列ではなくコンポーネントを渡す）:
```javascript
import { Camera } from "lucide-react-native";
<FloatingButton IconComponent={Camera} onPress={openCamera} />
```

### app.json slug

`react-native-text-ml-kit-text-recognition3`（expo.dev 登録値）に固定。**変更すると EAS Build / `eas credentials` が全て失敗する**。

### react-native-reanimated ~4.1.1

`newArchEnabled=true` が必須。`false` に変更するとビルドが失敗する（変更不可）。

### Expo Go

ネイティブモジュールを含むため **Expo Go では動作しない**。実機テストには EAS Development Build が必須。

---

## EAS Build 手順

```bash
# Development Build（実機テスト用）
eas build --profile development --platform android --no-wait

# ビルド後
npx expo start --dev-client
# 実機でAPKをインストール → devサーバーに接続
```

`.env.local` に必要な環境変数:
- `EXPO_PUBLIC_SENTRY_DSN` — Sentry DSN（設定済み）
- `EXPO_PUBLIC_CLOUD_VISION_API_KEY` — Cloud Vision API キー（設定済み・ローテーション済み）
- `EXPO_PUBLIC_ANDROID_CERT_SHA1` — SHA-1（コロンなし・小文字）（設定済み）
- `EXPO_PUBLIC_CLOUD_VISION_DAILY_LIMIT` — 日次使用上限（省略時デフォルト: 30）
