# EAS Build トラブルシュート戦略

**抽出日:** 2026-02-15
**コンテキスト:** Expo SDK 54 + React Native 0.81.5 のEASビルドで複数のコンパイルエラーに遭遇

## 問題

EAS Buildで以下のエラーパターンが連続して発生:
1. expo-dev-launcher Kotlinメタデータ不整合
2. react-native-reanimated コンパイルエラー
3. react-native-vision-camera API変更
4. expo-dev-menu JSC参照エラー
5. Theme.EdgeToEdge not found

## 解決策

### 原則: patch-packageよりパッケージアップグレード

patch-packageはEAS Build環境で上書きされることがある（`npm ci`後のステップでnode_modulesが変更される）。

**正しい手順:**
```bash
# 1. SDK期待バージョンを確認
npx expo install --check

# 2. アップグレード
npx expo install <packages>

# 3. 検証
npx expo doctor

# 4. パッチは Expo管理外パッケージのみに限定
# 例: react-native-vision-camera（Expoが管理しない）
```

### EdgeToEdge問題

- `edgeToEdgeEnabled: true` はAndroid 15+ + Material3 + `react-native-edge-to-edge`が必要
- MVPでは無効化が安全: `Theme.AppCompat.Light.NoActionBar`
- `gradle.properties`: `expo.edgeToEdgeEnabled=false`

### RN 0.81.5 での注意点

- JSC (JavaScriptCore) が完全削除、Hermesのみ
- 旧バージョンのexpo-dev-client/expo-dev-menuはJSC APIを参照してエラー
- 解決: SDK 54期待バージョンにアップグレード

## 使用タイミング

- EAS Buildが失敗した時
- Kotlinコンパイルエラーが発生した時
- patch-packageのパッチがEASで適用されない時
- EdgeToEdge関連エラーが発生した時
- React Native バージョンアップ後のビルドエラー時
