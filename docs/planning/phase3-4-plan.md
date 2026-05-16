# フェーズ 3+4 実装計画（RevenueCat + Firebase）確定 2026-05-05

## 方針決定

| 項目 | 決定内容 |
|------|---------|
| 実装方式 | フェーズ3（RevenueCat）＋フェーズ4（Firebase）を一括実装 |
| 認証方式 | Firebase 匿名認証（ユーザーにログイン要求しない） |
| リリース目標 | 全フェーズ完了後 Google Play 本番リリース |
| Androidパッケージ | `com.hiro8277.reactnativetextmlkittextrecognition3` |
| Firebase ロケーション | asia-northeast1（東京） |

## 実装後のアーキテクチャ

```
Client App
  ├─ Firebase Auth（匿名UID）→ Firestore（使用量・権限確認）
  ├─ RevenueCat（課金処理）
  └─ Firebase Functions（APIプロキシ）
          ├─ Gemini API（キー隠蔽）
          └─ Cloud Vision API（キー隠蔽）

RevenueCat webhook → Firebase Functions → Firestore（isPremium更新）
```

## 事前準備（コード実装前に必須）

```
□ Firebase コンソール（console.firebase.google.com）
  □ プロジェクト "OCR-APP" 作成
  □ Android アプリ追加（package: com.hiro8277.reactnativetextmlkittextrecognition3）
  □ google-services.json → android/app/ に配置
  □ Firestore Database 作成（asia-northeast1）
  □ Authentication → 匿名認証 有効化
  □ Functions → Blaze プランに変更して有効化
  □ サービスアカウントキー JSON → functions/service-account.json に配置

□ RevenueCat（app.revenuecat.com）
  □ プロジェクト "OCR-APP" 作成
  □ Android アプリ追加 → Public API Key を .env.local に保存
  □ Entitlement: "premium" 作成
  □ Product: "premium_monthly" 作成（Google Play Console 設定後）
  □ Offering: $rc_monthly 設定
  □ Webhook URL: Firebase Functions デプロイ後に設定
```

## 新規作成ファイル一覧

| ファイル | 役割 |
|---------|------|
| `src/utils/authManager.js` | Firebase Auth 匿名認証ラッパー |
| `src/utils/purchaseManager.js` | RevenueCat 購入・権限確認ラッパー |
| `src/utils/firestoreSync.js` | Firestore 使用量・権限同期 |
| `src/components/PaywallModal.js` | ¥480/月 購入UI |
| `functions/src/geminiProxy.ts` | Gemini API サーバープロキシ |
| `functions/src/visionProxy.ts` | Cloud Vision API サーバープロキシ |
| `functions/src/webhooks.ts` | RevenueCat → Firestore 権限同期 |
| `functions/src/middleware/auth.ts` | Firebase IDトークン検証ミドルウェア |

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/geminiOCR.js` | APIキー直接呼び出し → Firebase Functions プロキシ呼び出しに変更 |
| `src/utils/cloudVisionOCR.js` | 同上 |
| `src/utils/usageTracker.js` | AsyncStorage → Firestore に移行（改ざん不可） |
| `src/screens/HomeScreen.js` | 権限チェック追加（isPremium確認）・PaywallModal 呼び出し |
| `src/screens/HistoryScreen.js` | 履歴上限（無料100件/プレミアム無制限）ゲート追加 |
| `app.json` | `react-native-purchases` Config Plugin 追加 |
| `package.json` | `react-native-purchases`, `@react-native-firebase/*` 追加 |
| `android/app/build.gradle` | `google-services` プラグイン適用 |
| `android/build.gradle` | Google Services classpath 追加 |
| `.env.local` | `EXPO_PUBLIC_REVENUECAT_KEY` 追加（GEMINI/VISION キーは Functions 移行後削除） |

## 実装順序（依存関係あり）

```
Step 1: Firebase セットアップ（ネイティブ設定）
  - @react-native-firebase/app, auth, firestore インストール
  - google-services.json 配置
  - android/build.gradle 修正
  → EAS Dev Build 再ビルド ← ここが最初のビルドチェックポイント

Step 2: authManager.js
  - Firebase 匿名認証
  - UID を AsyncStorage にキャッシュ

Step 3: RevenueCat セットアップ
  - react-native-purchases インストール
  - app.json Config Plugin 追加
  - purchaseManager.js 作成

Step 4: PaywallModal.js
  - 購入ボタン・¥480表示
  - 購入完了 → Firestore isPremium 更新

Step 5: Firebase Functions 初期化
  - functions/ ディレクトリ作成（TypeScript）
  - auth ミドルウェア（IDトークン検証）
  - デプロイ設定

Step 6: geminiProxy.ts / visionProxy.ts
  - サーバー側でAPIキーを保持
  - 使用量チェック（Firestore）→ Gemini/Vision 呼び出し → レスポンス返却

Step 7: webhooks.ts
  - RevenueCat からの purchase/expiry イベント処理
  - Firestore users/{uid}/isPremium 更新

Step 8: クライアント geminiOCR.js 修正
  - APIキー直接呼び出し削除
  - Firebase Functions エンドポイント呼び出しに変更
  - IDトークン付きリクエスト

Step 9: firestoreSync.js + usageTracker.js 移行
  - AsyncStorage の使用カウンターを Firestore に移行
  - フォールバック: Firestore 失敗時は AsyncStorage を使用

Step 10: HomeScreen / HistoryScreen 権限ゲート追加
  - isGeminiAvailable() → isPremium() チェックに変更
  - 上限超過時に PaywallModal 表示
```

## Firestore セキュリティルール（最終）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // 自分のデータのみ読み取り可
      allow read: if request.auth != null && request.auth.uid == userId;
      // 書き込みは Functions のみ（サービスアカウント経由）
      allow write: if false;
    }
  }
}
```

## 重大な落とし穴

1. **匿名UID → 購入リンク**: RevenueCat appUserID = Firebase UID で紐付け必須
   `await Purchases.logIn(firebaseUser.uid)` を Auth 完了直後に呼ぶ

2. **RevenueCat webhook 署名検証**: `Authorization: Bearer <SECRET>` ヘッダーが一致しない場合は 401 返却
   Firebase Functions 環境変数に `REVENUECAT_WEBHOOK_SECRET` を設定

3. **Firebase Functions コールドスタート**: 初回呼び出し2〜5秒かかる
   `minInstances: 1` で常時起動（$0.02/日）→ 課金ユーザーが付いてから有効化

4. **google-services.json は gitignore 必須**: APIキー・プロジェクトID含む
   → `android/app/google-services.json` を `.gitignore` に追加
   → EAS Secrets または `eas.json` の `files` 配列で管理

5. **@react-native-firebase は Expo Go 不可**: すでに Dev Build 環境なので問題なし

6. **React Native Firebase + New Architecture**: `newArchEnabled: true` 設定済みのため
   `@react-native-firebase` v21+ が必要（v20以下はNew Arch非対応）

## 将来対応（フェーズ3+4完了後）

| 優先度 | タスク | 理由 |
|--------|--------|------|
| 1 | TypeScript 移行（L1） | Firebase/RevenueCat 確定後に移行が最小diff |
| 2 | テスト実装（L2） | Firebase/RevenueCatのモック設計が確定する |
| 3 | SSL証明書ピンニング（L7） | Firebase Functions証明書が確定してからピン先を設定 |
| 4 | 難読化（L6） | APIキーがサーバー移行後はクライアントに守るものが減る |
