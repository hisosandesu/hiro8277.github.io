# OCR アプリ シーケンス図

このファイルは各 OCR フローの処理手順を Mermaid 記法で記述したものです。
VS Code の Markdown Preview Enhanced 拡張機能や GitHub でレンダリングできます。

---

## 1. GENERALモード OCR フロー（ML Kit のみ）

```mermaid
sequenceDiagram
  actor User
  participant HomeScreen
  participant imagePreprocessing
  participant MLKit as ML Kit<br/>(TextRecognition)
  participant mlKitReconstructor as mlKitText<br/>Reconstructor
  participant textFilter

  User->>HomeScreen: カメラ/ギャラリーから画像選択
  HomeScreen->>HomeScreen: エンジン選択 → ML_KIT
  HomeScreen->>HomeScreen: setImage(uri) → useEffect 発火
  HomeScreen->>HomeScreen: showInterstitialIfReady()

  HomeScreen->>imagePreprocessing: preprocessImageForOCR(image)
  Note over imagePreprocessing: 最長辺 2400px リサイズ<br/>JPEG 0.95 品質<br/>EXIF 回転補正
  imagePreprocessing-->>HomeScreen: processedUri

  HomeScreen->>MLKit: recognize(uri, JAPANESE)
  MLKit-->>HomeScreen: mlKitResult.blocks[]

  HomeScreen->>mlKitReconstructor: reconstructTextSpatially(blocks)
  Note over mlKitReconstructor: Y 座標グループ化 → X 座標ソート<br/>視覚的行順に再構築
  mlKitReconstructor-->>HomeScreen: mlKitText

  alt テキスト未検出
    HomeScreen->>User: Alert「テキストが見つかりませんでした」
  else テキスト検出
    HomeScreen->>textFilter: filterOCRResult(mlKitText)
    Note over textFilter: 空白行・1文字行・記号行除去<br/>連続空行正規化
    textFilter-->>HomeScreen: filteredText
    HomeScreen->>HomeScreen: setText(filteredText)
    HomeScreen->>User: テキスト表示
  end
```

---

## 2. RECEIPTモード OCR フロー（ハイブリッド方式）

```mermaid
sequenceDiagram
  actor User
  participant HomeScreen
  participant imagePreprocessing
  participant MLKit as ML Kit
  participant receiptParser
  participant usageTracker
  participant authManager
  participant GeminiProxy as Firebase Functions<br/>geminiProxy
  participant GeminiAPI as Gemini 2.5<br/>Flash Lite

  User->>HomeScreen: 画像選択（エンジン:Gemini, モード:RECEIPT）
  HomeScreen->>usageTracker: getGeminiTrialUsedThisMonth()
  usageTracker-->>HomeScreen: trialUsed

  alt 月次上限超過
    HomeScreen->>User: Alert「月次制限に達しました」
  else 上限内
    HomeScreen->>usageTracker: getGeminiUsageToday()
    usageTracker-->>HomeScreen: dailyUsed

    alt 日次上限超過
      HomeScreen->>User: Alert「本日の上限に達しました」
    else 上限内
      HomeScreen->>imagePreprocessing: preprocessImageForOCR(image)
      imagePreprocessing-->>HomeScreen: processedUri

      HomeScreen->>MLKit: recognize(uri, JAPANESE)
      MLKit-->>HomeScreen: mlKitText

      HomeScreen->>receiptParser: parseReceiptText(mlKitText)
      Note over receiptParser: 正規表現で total/items/date 抽出<br/>コスト ¥0（Gemini 不使用）
      receiptParser-->>HomeScreen: parsed {total, items, ...}

      alt 高品質（total != null && items.length > 0）
        Note over HomeScreen: ML Kit 結果で確定<br/>Gemini 未消費
        HomeScreen->>HomeScreen: setGeminiResult(parsed)
        HomeScreen->>User: ReceiptView 表示
      else 低品質
        HomeScreen->>authManager: getOrCreateAnonymousUser()
        authManager->>authManager: Firebase 匿名認証
        authManager-->>HomeScreen: uid
        HomeScreen->>authManager: getIdToken()
        authManager-->>HomeScreen: idToken

        HomeScreen->>GeminiProxy: POST /geminiProxy<br/>{imageBase64, mode:RECEIPT}<br/>Authorization: Bearer idToken
        GeminiProxy->>GeminiAPI: Gemini API 呼び出し
        GeminiAPI-->>GeminiProxy: 構造化 JSON
        GeminiProxy-->>HomeScreen: {raw_text, merchant, date, total, items}

        HomeScreen->>usageTracker: incrementGeminiUsage()
        HomeScreen->>usageTracker: incrementGeminiTrialUsage()
        HomeScreen->>HomeScreen: setGeminiResult(geminiData)
        HomeScreen->>User: ReceiptView 表示
      end
    end
  end
```

---

## 3. EDUCATIONモード OCR フロー

```mermaid
sequenceDiagram
  actor User
  participant HomeScreen
  participant imagePreprocessing
  participant MLKit as ML Kit
  participant authManager
  participant GeminiProxy as Firebase Functions<br/>geminiProxy
  participant GeminiAPI as Gemini 2.5<br/>Flash Lite
  participant EducationView
  participant quizGenerator
  participant QuizView

  User->>HomeScreen: 画像選択（モード:EDUCATION, 科目選択）
  HomeScreen->>HomeScreen: showInterstitialNow()（教育モードは必ず表示）
  HomeScreen->>imagePreprocessing: preprocessImageForOCR(image)
  imagePreprocessing-->>HomeScreen: processedUri

  HomeScreen->>MLKit: recognize(uri, JAPANESE)
  MLKit-->>HomeScreen: mlKitText（事前スクリーニング用）

  HomeScreen->>authManager: getOrCreateAnonymousUser() + getIdToken()
  authManager-->>HomeScreen: idToken

  HomeScreen->>GeminiProxy: POST /geminiProxy<br/>{imageBase64, mode:EDUCATION, options:{subject}}
  GeminiProxy->>GeminiAPI: 科目ヒント付きプロンプト
  GeminiAPI-->>GeminiProxy: {raw_text, subject, title, sections[], important_terms[]}
  GeminiProxy-->>HomeScreen: 構造化 JSON

  HomeScreen->>HomeScreen: setGeminiResult(geminiData)
  HomeScreen->>User: EducationView 表示

  opt ユーザーが「クイズ生成」タップ
    EducationView->>quizGenerator: generateQuizFromEducationResult(result)
    Note over quizGenerator: テキスト JSON 入力<br/>base64 不要・低コスト
    quizGenerator-->>EducationView: quiz[] (5問)
    EducationView->>QuizView: クイズ開始
    User->>QuizView: カードめくり・自己採点
    QuizView-->>HomeScreen: onQuizFinish(quizData)
    HomeScreen->>HomeScreen: quizResultRef.current = quizData
  end

  opt ユーザーが「AIで再認識」タップ（1回限り）
    HomeScreen->>GeminiProxy: POST /geminiProxy（同科目で再送信）
    GeminiProxy-->>HomeScreen: 新しい構造化 JSON
    HomeScreen->>User: EducationView 更新
  end
```

---

## 4. Cloud Vision 手書き認識フロー（GENERALモード）

```mermaid
sequenceDiagram
  actor User
  participant HomeScreen
  participant usageTracker
  participant imagePreprocessing
  participant MLKit as ML Kit
  participant authManager
  participant VisionProxy as Firebase Functions<br/>visionProxy
  participant CloudVision as Cloud Vision API<br/>(ADC 認証)

  User->>HomeScreen: エンジン選択 → Cloud Vision
  Note over HomeScreen: 画像取得後 → recognizeText()

  HomeScreen->>imagePreprocessing: preprocessImageForOCR(image)
  imagePreprocessing-->>HomeScreen: processedUri

  rect rgb(240, 248, 255)
    Note over HomeScreen,MLKit: ステップ1: ML Kit 事前スクリーニング（常に実行）
    HomeScreen->>MLKit: recognize(uri, JAPANESE)
    MLKit-->>HomeScreen: mlKitText
  end

  alt テキスト未検出（mlKitText == ""）
    HomeScreen->>User: Alert「テキストが見つかりません」<br/>Cloud Vision 未呼び出し
  else テキスト検出
    HomeScreen->>usageTracker: getCloudVisionUsageToday()
    usageTracker-->>HomeScreen: todayUsage

    alt 日次上限超過
      HomeScreen->>User: Alert「本日の上限に達しました」<br/>ML Kit 結果をそのまま表示
    else 上限内
      HomeScreen->>authManager: getOrCreateAnonymousUser() + getIdToken()
      authManager-->>HomeScreen: idToken

      HomeScreen->>VisionProxy: POST /visionProxy<br/>{imageBase64}<br/>Authorization: Bearer idToken
      VisionProxy->>CloudVision: @google-cloud/vision ADC 認証
      CloudVision-->>VisionProxy: テキスト
      VisionProxy-->>HomeScreen: {text}

      alt Cloud Vision 成功
        HomeScreen->>usageTracker: incrementCloudVisionUsage()
        HomeScreen->>User: 高精度テキスト表示
      else 429 レート制限
        HomeScreen->>User: Alert「しばらくお待ちください」
        Note over HomeScreen: ML Kit 結果を再利用（再実行不要）
      else その他エラー
        Note over HomeScreen: ML Kit 結果を再利用
      end
    end
  end
```

---

## 5. Firebase 匿名認証フロー（authManager.js）

```mermaid
sequenceDiagram
  participant Caller as geminiOCR.js /<br/>cloudVisionOCR.js
  participant authManager
  participant Firebase as Firebase Auth<br/>(@react-native-firebase)
  participant AsyncStorage

  Caller->>authManager: getOrCreateAnonymousUser()
  authManager->>authManager: ensureAuthListener()<br/>（初回のみリスナー登録）

  alt _currentUser キャッシュあり
    authManager-->>Caller: uid（即時返却）
  else auth().currentUser あり
    authManager->>Firebase: auth(getApp()).currentUser
    Firebase-->>authManager: currentUser
    authManager-->>Caller: uid
  else 未認証
    authManager->>Firebase: auth(getApp()).signInAnonymously()
    Firebase-->>authManager: userCredential
    authManager->>AsyncStorage: setItem("firebase_anon_uid", uid)
    authManager-->>Caller: uid
  end

  Caller->>authManager: getIdToken()
  authManager->>Firebase: user.getIdToken(forceRefresh)
  Firebase-->>authManager: idToken（JWT）
  authManager-->>Caller: idToken

  Note over Caller,Firebase: 以降の API リクエストで<br/>Authorization: Bearer idToken を付与
```
