# React Native OCR アプリ

React Native と ML Kit を使用したテキスト認識（OCR）アプリケーションです。カメラで撮影した画像や写真ライブラリから選択した画像から日本語テキストを認識し、履歴として保存できます。

## 概要

このアプリケーションは、スマートフォンのカメラやギャラリーから画像を取得し、ML Kit の Text Recognition API を使用して日本語テキストを自動認識します。認識したテキストは履歴として保存され、後から参照することができます。

### 主な機能

- **画像からのテキスト認識**：カメラ撮影または写真ライブラリから選択した画像から日本語テキストを認識
- **リアルタイム認識**：画像選択後、自動的にテキスト認識を実行
- **履歴管理**：認識したテキストを保存し、履歴画面で一覧表示
- **履歴の削除**：個別削除またはすべての履歴を一括削除
- **直感的なUI**：フローティングボタンによる簡単な操作

## 技術スタック

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 19.0.0 | UIフレームワーク |
| React Native | 0.79.5 | モバイルアプリ開発フレームワーク |
| Expo | ~53.0.20 | 開発環境・ビルドツール |

### 主要な依存ライブラリ

#### ナビゲーション
- `@react-navigation/native` (^7.1.17)
- `@react-navigation/native-stack` (^7.3.25)
- `@react-navigation/stack` (^7.4.7)

#### 機能ライブラリ
- `@react-native-ml-kit/text-recognition` (^1.5.2) - テキスト認識（OCR）
- `react-native-image-picker` (^8.2.1) - 画像選択
- `expo-camera` (^16.1.11) - カメラ機能
- `expo-image-picker` (^16.1.4) - 画像ピッカー
- `@react-native-async-storage/async-storage` (^2.2.0) - ローカルストレージ

#### UI関連
- `@react-native-vector-icons/fontawesome6` (^12.2.0) - アイコン
- `react-native-gesture-handler` (~2.24.0) - ジェスチャー制御
- `react-native-reanimated` (~3.17.4) - アニメーション
- `react-native-safe-area-context` (5.4.0) - セーフエリア対応
- `react-native-screens` (~4.11.1) - ネイティブ画面管理

## プロジェクト構造

```
rn-ocr/
├── src/
│   ├── components/          # 再利用可能なUIコンポーネント
│   │   ├── ClearButton.js   # クリアボタンコンポーネント
│   │   ├── FloatingButton.js # フローティングアクションボタン
│   │   └── SaveButton.js    # 保存ボタンコンポーネント
│   │
│   ├── navigations/         # ナビゲーション設定
│   │   ├── RootNavigation.js # ルートナビゲーション
│   │   └── stack/
│   │       └── HomeStack.js  # ホームスタックナビゲーター
│   │
│   └── screens/             # 画面コンポーネント
│       ├── HomeScreen.js     # ホーム画面（OCR機能）
│       └── HistoryScreen.js  # 履歴画面
│
├── assets/                  # 画像・アイコンなどのアセット
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
│
├── android/                 # Android固有の設定とコード
├── App.js                   # アプリケーションのエントリーポイント
├── index.js                 # React Nativeのエントリーポイント
├── app.json                 # Expo設定ファイル
├── eas.json                 # EAS Build設定
├── package.json             # 依存関係の定義
└── README.md               # このファイル
```

### ディレクトリ詳細

#### `src/components/`
再利用可能なUIコンポーネントを格納します。各ボタンコンポーネントは独自のスタイルとアイコンを持ち、`onPress` プロパティでアクションを受け取ります。

- **FloatingButton.js**: カメラ起動用のフローティングアクションボタン（右下配置）
- **SaveButton.js**: テキストを履歴に保存するボタン（左下配置）
- **ClearButton.js**: 認識結果をクリアするボタン（中央下配置）

#### `src/navigations/`
React Navigation を使用したナビゲーション構造を定義します。

- **RootNavigation.js**: `NavigationContainer` でアプリ全体のナビゲーションをラップ
- **stack/HomeStack.js**: ホームと履歴画面のスタックナビゲーター

#### `src/screens/`
アプリケーションの各画面コンポーネントを格納します。

- **HomeScreen.js**: OCR機能のメイン画面
- **HistoryScreen.js**: 保存されたテキストの履歴を表示する画面

## 機能詳細

### ホーム画面（HomeScreen.js）

#### 主な機能
1. **画像選択**
   - 写真ライブラリから画像を選択
   - カメラで新規撮影（権限が必要）

2. **自動テキスト認識**
   - 画像選択後、自動的に日本語テキストを認識
   - ML Kit Text Recognition API（日本語スクリプト指定）を使用

3. **結果の保存**
   - 認識したテキストを AsyncStorage に履歴として保存
   - 最大100件まで保存（古いものから自動削除）

4. **結果のクリア**
   - 認識結果をクリアして新しい認識を開始

#### UI要素
- ヘッダー右側：履歴画面への遷移ボタン、画像選択ボタン
- メインエリア：認識したテキストを表示
- フローティングボタン：カメラ起動（右下）
- SaveButton：テキスト保存（左下、テキスト認識時のみ表示）
- ClearButton：結果クリア（中央下、テキスト認識時のみ表示）

#### 実装の詳細
- カメラ権限リクエスト処理
- 画像選択時の自動認識（useEffect フック）
- AsyncStorage を使用した履歴管理
- エラーハンドリングとアラート表示

### 履歴画面（HistoryScreen.js）

#### 主な機能
1. **履歴一覧表示**
   - 保存されたすべてのテキストを日時とともに表示
   - 最新の履歴が上部に表示される

2. **個別削除**
   - 各履歴項目のゴミ箱アイコンで個別削除

3. **一括削除**
   - 「すべて削除」ボタンで全履歴を削除（確認ダイアログ付き）

4. **画面フォーカス時の自動更新**
   - 画面表示時に履歴を再読み込み（useFocusEffect フック）

#### UI要素
- ヘッダー：履歴件数表示、すべて削除ボタン
- 履歴カード：日時、テキスト（3行まで表示）、削除ボタン
- 空状態：履歴がない場合のアイコンとメッセージ表示

## セットアップ

### 必要な環境
- Node.js (推奨: 18.x 以上)
- npm または yarn
- Android Studio（Android開発の場合）
- Xcode（iOS開発の場合、macOSのみ）

### インストール手順

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd rn-ocr
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **Expo DevClientのビルド（初回のみ）**
   ```bash
   npx expo prebuild
   ```

4. **アプリの起動**

   **Android:**
   ```bash
   npm run android
   # または
   npx expo run:android
   ```

   **iOS:**
   ```bash
   npm run ios
   # または
   npx expo run:ios
   ```

   **開発サーバーの起動:**
   ```bash
   npm start
   # または
   npx expo start
   ```

### トラブルシューティング

#### フォントアイコンが表示されない場合
```bash
npx react-native-asset
npx expo run:android --clear
```

#### キャッシュクリア
```bash
npx expo start --clear
```

## 使い方

### 基本的な操作フロー

1. **アプリ起動**
   - ホーム画面が表示されます

2. **画像の選択**
   - 右下のフローティングボタン（カメラアイコン）をタップしてカメラ起動
   - または、ヘッダー右上のフォルダーアイコンをタップして写真ライブラリから選択

3. **テキスト認識**
   - 画像選択後、自動的にテキスト認識が実行されます
   - 認識結果が画面中央に表示されます

4. **結果の保存**
   - 左下の保存アイコンをタップして履歴に保存

5. **履歴の確認**
   - ヘッダー右上の矢印アイコンをタップして履歴画面へ移動
   - 保存されたすべてのテキストを確認できます

6. **履歴の削除**
   - 個別削除：各項目のゴミ箱アイコンをタップ
   - 一括削除：ヘッダーの「すべて削除」をタップ

7. **結果のクリア**
   - 中央下のゴミ箱アイコンをタップして認識結果をクリア

## 権限

アプリは以下の権限を要求します：

### Android
- `CAMERA` - カメラでの撮影に必要
- `READ_EXTERNAL_STORAGE` - 写真ライブラリへのアクセスに必要（Android 12以下）
- `READ_MEDIA_IMAGES` - 写真ライブラリへのアクセスに必要（Android 13以上）

### iOS
- `NSCameraUsageDescription` - カメラへのアクセス
- `NSPhotoLibraryUsageDescription` - 写真ライブラリへのアクセス

権限設定は `app.json` で定義されています。

## ビルド

### 開発ビルド
```bash
npx expo run:android
npx expo run:ios
```

### プロダクションビルド（EAS Build）
```bash
# 初回セットアップ
eas login
eas build:configure

# ビルド実行
eas build --platform android
eas build --platform ios
```

## データストレージ

### AsyncStorage
アプリは `@react-native-async-storage/async-storage` を使用して以下のデータをローカルに保存します：

- **ストレージキー**: `@ocr_history`
- **データ形式**: JSON配列
- **保存内容**:
  ```javascript
  {
    id: string,        // タイムスタンプベースの一意ID
    text: string,      // 認識されたテキスト
    date: number       // 保存日時（Unix timestamp）
  }
  ```
- **保存件数**: 最大100件（超過分は古いものから削除）

## カスタマイズ

### テーマカラー変更
アプリのメインカラーは `#167476` です。変更する場合は以下のファイルを編集してください：

- `src/navigations/stack/HomeStack.js` - ヘッダー背景色
- `src/components/FloatingButton.js` - ボタン背景色
- `src/components/SaveButton.js` - ボタン背景色
- `src/components/ClearButton.js` - ボタン背景色

### アイコンの変更
FontAwesome 6 のアイコンを使用しています。アイコンを変更する場合：

```javascript
<Icon name="アイコン名" size={25} color={"white"} solid />
```

アイコン名は [FontAwesome 6 公式サイト](https://fontawesome.com/search?o=r&m=free&s=solid) で検索できます。

### 認識言語の変更
日本語以外のテキストを認識する場合、`HomeScreen.js` の以下の部分を変更：

```javascript
const result = await TextRecognition.recognize(
  image,
  TextRecognitionScript.JAPANESE  // 他の言語に変更可能
);
```

利用可能なスクリプト：
- `TextRecognitionScript.LATIN`
- `TextRecognitionScript.CHINESE`
- `TextRecognitionScript.DEVANAGARI`
- `TextRecognitionScript.JAPANESE`
- `TextRecognitionScript.KOREAN`

## ライセンス

Private（プライベートプロジェクト）

## 技術仕様

### アーキテクチャ
- **パターン**: 関数コンポーネント + Hooks
- **状態管理**: React Hooks（useState, useEffect, useFocusEffect）
- **ナビゲーション**: Stack Navigator（React Navigation）
- **ストレージ**: AsyncStorage（キー・バリュー型ローカルストレージ）

### パフォーマンス最適化
- 画像認識は非同期処理で実行
- 履歴画面は表示時のみデータを読み込み
- 履歴は最大100件に制限してストレージを節約

### エラーハンドリング
- カメラ権限拒否時のアラート表示
- テキスト認識失敗時のエラーメッセージ
- ストレージ操作失敗時のエラーハンドリング

## 今後の改善案

- [ ] 認識したテキストの編集機能
- [ ] 履歴のテキスト検索機能
- [ ] テキストのクリップボードコピー
- [ ] 複数画像の一括認識
- [ ] 認識精度向上のための画像前処理
- [ ] ダークモード対応
- [ ] 多言語対応（UI）
- [ ] テキストの共有機能（SNS、メール等）
- [ ] OCR結果のエクスポート機能（CSV、TXT）

## パッケージ情報

- **パッケージ名**: `com.hiro8277.reactnativetextmlkittextrecognition3`
- **バージョン**: 1.0.0
- **EAS Project ID**: `28fb87b6-2976-486c-9461-d475f35335dc`

## お問い合わせ

プロジェクトに関する質問や提案がある場合は、Issueを作成してください。
