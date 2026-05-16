import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import TextRecognition, {
  TextRecognitionScript,
} from "@react-native-ml-kit/text-recognition";

import {
  Folder,
  ArrowRight,
  Pen,
  Check,
  RefreshCw,
  Sparkles,
  FileText,
  Receipt,
  GraduationCap,
  Library,
  Calculator,
  FlaskConical,
  BookText,
  Languages,
  Globe,
} from "lucide-react-native";
import FloatingButton from "../components/FloatingButton";
import ClearButton from "../components/ClearButton";
import SaveButton from "../components/SaveButton";
import { preprocessImageForOCR } from "../utils/imagePreprocessing";
import { filterOCRResult } from "../utils/textFilter";
import { reconstructTextSpatially } from "../utils/mlKitTextReconstructor";
import {
  isCloudVisionAvailable,
  recognizeTextWithCloudVision,
  CloudVisionRateLimitError,
} from "../utils/cloudVisionOCR";
import {
  isGeminiAvailable,
  recognizeTextWithGemini,
} from "../utils/geminiOCR";
import { parseReceiptText } from "../utils/receiptParser";
import ReceiptView from "../components/ReceiptView";
import EducationView from "../components/EducationView";
import PrivacyBadge from "../components/PrivacyBadge";
import { AppStorage } from "../utils/secureStorage";
import { captureError } from "../utils/monitoring";
import {
  initializeInterstitial,
  showInterstitialIfReady,
  showInterstitialNow,
  cleanupInterstitial,
} from "../utils/adManager";
import {
  getCloudVisionUsageToday,
  incrementCloudVisionUsage,
  getGeminiUsageToday,
  incrementGeminiUsage,
  getGeminiTrialUsedThisMonth,
  incrementGeminiTrialUsage,
} from "../utils/usageTracker";
import { HISTORY_KEY, LAST_SUBJECT_KEY, LAST_MODE_KEY } from "../constants/storage";
import { COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import {
  HISTORY_LIMIT,
  MAX_TEXT_LENGTH,
  OCR_ENGINE,
  OCR_MODE,
  EDUCATION_SUBJECT,
  CLOUD_VISION_DAILY_LIMIT,
  GEMINI_DAILY_LIMIT,
  GEMINI_FREE_TRIAL_LIMIT,
  GEMINI_PREMIUM_MONTHLY_LIMIT,
  AD_UNIT_IDS,
} from "../constants/app";

/** 科目識別子 → 短い表示名（モーダルラベル用）*/
const SUBJECT_SHORT_LABELS = {
  [EDUCATION_SUBJECT.GENERAL]:  "汎用",
  [EDUCATION_SUBJECT.MATH]:     "数学",
  [EDUCATION_SUBJECT.SCIENCE]:  "理科",
  [EDUCATION_SUBJECT.JAPANESE]: "国語",
  [EDUCATION_SUBJECT.ENGLISH]:  "英語",
  [EDUCATION_SUBJECT.SOCIAL]:   "社会",
};

export default function HomeScreen({ navigation }) {
  const [image, setImage] = useState("");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false); // 3-B: OCR処理中フラグ
  const [isEditing, setIsEditing] = useState(false); // 3-C: テキスト編集モード
  const [engineUsed, setEngineUsed] = useState(null); // 3-D: 使用エンジン ('cloud-vision' | 'ml-kit' | null)
  const [processedUri, setProcessedUri] = useState(null); // 前処理済み画像URIキャッシュ（高精度再認識時の二重処理防止）
  const [geminiResult, setGeminiResult] = useState(null); // Gemini構造化結果（モードにより形状が異なる）
  const [modeUsed, setModeUsed] = useState(null);          // 使用した OCR_MODE（構造化ビュー切替に使用）
  const [viewMode, setViewMode] = useState("text");         // 'text' | 'structured'
  const [aiReRecognizeUsed, setAiReRecognizeUsed] = useState(false); // 1スキャンにつき1回のみ許可
  // 汎用オプション選択モーダル。engine/mode 両方で使い回す
  // null = 非表示, { title: string, items: [{label, onPress}] } = 表示中
  const [optionsModal, setOptionsModal] = useState(null);
  // 前回選択した科目（UI 表示用 state + OCR 用 ref の二刀流）
  const [savedSubject, setSavedSubject] = useState(null);
  // 前回使用した Gemini モード（汎用/レシート/教育）
  const [savedMode, setSavedMode] = useState(null);
  // エンジン・モード・科目選択ダイアログで設定される。refのためレンダリングをトリガーしない
  const engineForNextOCR  = useRef(OCR_ENGINE.ML_KIT);
  const modeForNextOCR    = useRef(OCR_MODE.GENERAL);
  const subjectForNextOCR = useRef(EDUCATION_SUBJECT.GENERAL);
  const [subjectUsed, setSubjectUsed] = useState(null); // reRecognizeWithGemini で再利用
  const quizResultRef      = useRef(null); // クイズ完了データ（saveToHistory の quiz フィールドに含める）
  const lastSavedItemIdRef = useRef(null); // 最後に保存したアイテム ID（クイズ後の history 更新用）

  /** 汎用オプション選択モーダルを閉じる */
  const closeOptionsModal = useCallback(() => setOptionsModal(null), []);

  /** EDUCATIONモード選択後に科目を選ばせるサブモーダル */
  const showSubjectSelector = useCallback((onSelected) => {
    const selectAndSave = (subject) => {
      AppStorage.setItem(LAST_SUBJECT_KEY, subject).catch(() => {});
      setSavedSubject(subject); // モーダルラベルを次回から更新
      onSelected(subject);
    };
    setOptionsModal({
      title: MESSAGES.INFO.SUBJECT_SELECT_TITLE,
      items: [
        { icon: Library,      label: MESSAGES.INFO.SUBJECT_GENERAL,  subtitle: MESSAGES.INFO.SUBJECT_GENERAL_SUB,  onPress: () => selectAndSave(EDUCATION_SUBJECT.GENERAL) },
        { icon: Calculator,   label: MESSAGES.INFO.SUBJECT_MATH,     subtitle: MESSAGES.INFO.SUBJECT_MATH_SUB,     onPress: () => selectAndSave(EDUCATION_SUBJECT.MATH) },
        { icon: FlaskConical, label: MESSAGES.INFO.SUBJECT_SCIENCE,  subtitle: MESSAGES.INFO.SUBJECT_SCIENCE_SUB,  onPress: () => selectAndSave(EDUCATION_SUBJECT.SCIENCE) },
        { icon: BookText,     label: MESSAGES.INFO.SUBJECT_JAPANESE, subtitle: MESSAGES.INFO.SUBJECT_JAPANESE_SUB, onPress: () => selectAndSave(EDUCATION_SUBJECT.JAPANESE) },
        { icon: Languages,    label: MESSAGES.INFO.SUBJECT_ENGLISH,  subtitle: MESSAGES.INFO.SUBJECT_ENGLISH_SUB,  onPress: () => selectAndSave(EDUCATION_SUBJECT.ENGLISH) },
        { icon: Globe,        label: MESSAGES.INFO.SUBJECT_SOCIAL,   subtitle: MESSAGES.INFO.SUBJECT_SOCIAL_SUB,   onPress: () => selectAndSave(EDUCATION_SUBJECT.SOCIAL) },
      ],
    });
  }, []);

  /**
   * Gemini 選択後にスキャンモードを選ばせる。
   * モード確定時に LAST_MODE_KEY を保存してエンジン選択クイックピックに反映する。
   */
  const showModeSelector = useCallback((onSelected) => {
    const confirmMode = (mode) => {
      AppStorage.setItem(LAST_MODE_KEY, mode).catch(() => {});
      setSavedMode(mode);
      onSelected(mode);
    };

    setOptionsModal({
      title: MESSAGES.INFO.MODE_SELECT_TITLE,
      items: [
        { icon: FileText,    label: MESSAGES.INFO.MODE_GENERAL,   subtitle: MESSAGES.INFO.MODE_GENERAL_SUB,   onPress: () => confirmMode(OCR_MODE.GENERAL) },
        { icon: Receipt,     label: MESSAGES.INFO.MODE_RECEIPT,   subtitle: MESSAGES.INFO.MODE_RECEIPT_SUB,   onPress: () => confirmMode(OCR_MODE.RECEIPT) },
        { icon: GraduationCap, label: MESSAGES.INFO.MODE_EDUCATION, subtitle: MESSAGES.INFO.MODE_EDUCATION_SUB, onPress: () => showSubjectSelector((subject) => {
          subjectForNextOCR.current = subject;
          confirmMode(OCR_MODE.EDUCATION);
        }) },
      ],
    });
  }, [showSubjectSelector]);

  /**
   * エンジン選択 → Gemini の場合はさらにモード選択へ進む。
   * 前回使用した Gemini モードがある場合は先頭にクイックピックを表示し、
   * モード選択（+ 教育の場合は科目選択も）をスキップして1タップでカメラ起動できる。
   */
  const showEngineSelector = useCallback((onSelected) => {
    const items = [];
    if (savedMode && isGeminiAvailable()) {
      const quickIcon =
        savedMode === OCR_MODE.EDUCATION ? GraduationCap :
        savedMode === OCR_MODE.RECEIPT   ? Receipt :
        Sparkles;
      const quickSubtitle =
        savedMode === OCR_MODE.EDUCATION
          ? (savedSubject
              ? `Gemini · 教育（${SUBJECT_SHORT_LABELS[savedSubject]}）`
              : "Gemini · 教育")
          : savedMode === OCR_MODE.RECEIPT
          ? "Gemini · レシート"
          : "Gemini · 汎用";
      items.push({
        icon: quickIcon,
        label: "前回の設定で認識",
        subtitle: quickSubtitle,
        onPress: () => {
          if (savedMode === OCR_MODE.EDUCATION && savedSubject) {
            subjectForNextOCR.current = savedSubject;
          }
          onSelected(OCR_ENGINE.GEMINI_FLASH, savedMode);
        },
      });
    }
    items.push({
      icon: FileText,
      label:    MESSAGES.INFO.ENGINE_ML_KIT,
      subtitle: MESSAGES.INFO.ENGINE_ML_KIT_SUB,
      onPress: () => onSelected(OCR_ENGINE.ML_KIT, null),
    });
    if (isCloudVisionAvailable()) {
      items.push({
        icon: RefreshCw,
        label:    MESSAGES.INFO.ENGINE_CLOUD_VISION,
        subtitle: MESSAGES.INFO.ENGINE_CLOUD_VISION_SUB,
        onPress: () => onSelected(OCR_ENGINE.CLOUD_VISION, null),
      });
    }
    if (isGeminiAvailable()) {
      items.push({
        icon: Sparkles,
        label:    MESSAGES.INFO.ENGINE_GEMINI_FLASH,
        subtitle: MESSAGES.INFO.ENGINE_GEMINI_FLASH_SUB,
        onPress: () => showModeSelector((mode) => onSelected(OCR_ENGINE.GEMINI_FLASH, mode)),
      });
    }
    setOptionsModal({ title: MESSAGES.INFO.ENGINE_SELECT_TITLE, items });
  }, [showModeSelector, savedSubject, savedMode]);

  const pickImage = useCallback(() => {
    showEngineSelector(async (engine, mode) => {
      engineForNextOCR.current = engine;
      modeForNextOCR.current = mode ?? OCR_MODE.GENERAL;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    });
  }, [showEngineSelector]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity style={{ marginLeft: 15 }} onPress={pickImage}>
          <Folder color={COLORS.white} size={25} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() => navigation.navigate("History")}
        >
          <ArrowRight color={COLORS.white} size={25} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, pickImage]);

  const openCamera = useCallback(() => {
    showEngineSelector(async (engine, mode) => {
      engineForNextOCR.current = engine;
      modeForNextOCR.current = mode ?? OCR_MODE.GENERAL;
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.CAMERA_PERMISSION);
        return;
      }
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setImage(result.assets[0].uri);
        }
      } catch (error) {
        captureError(error, { screen: "HomeScreen", action: "openCamera" });
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.CAMERA_LAUNCH);
      }
    });
  }, [showEngineSelector]);

  const applyOCRResult = useCallback((rawText) => {
    const filtered = filterOCRResult(rawText);
    if (filtered.length > MAX_TEXT_LENGTH) {
      setText(filtered.slice(0, MAX_TEXT_LENGTH));
      Alert.alert(
        MESSAGES.INFO.TEXT_TRUNCATED_TITLE,
        MESSAGES.INFO.TEXT_TRUNCATED_BODY,
      );
    } else {
      setText(filtered);
    }
  }, []);

  const recognizeText = useCallback(async () => {
    if (!image) return;

    setIsLoading(true);
    setIsEditing(false);
    setEngineUsed(null);
    setAiReRecognizeUsed(false); // 新スキャン開始時にリセット
    // EDUCATIONモードは科目選択が確定した時点で毎回確実表示、それ以外は頻度制御
    if (modeForNextOCR.current === OCR_MODE.EDUCATION) {
      showInterstitialNow();
    } else {
      showInterstitialIfReady();
    }
    try {
      const uri = await preprocessImageForOCR(image);
      setProcessedUri(uri);

      // ステップ1: 常に ML Kit で事前スクリーニング
      const mlKitResult = await TextRecognition.recognize(
        uri,
        TextRecognitionScript.JAPANESE,
      );
      // result.text はブロック単位の連結文字列のため列レイアウトが崩れる。
      // blocks の frame（top/left）で Y 座標グループ化 → 視覚的行順に再構築する。
      const mlKitText = reconstructTextSpatially(mlKitResult?.blocks ?? []);

      // テキストが検出されなければ Cloud Vision API に投げない
      if (mlKitText.trim().length === 0) {
        Alert.alert(
          MESSAGES.INFO.NO_TEXT_DETECTED_TITLE,
          MESSAGES.INFO.NO_TEXT_DETECTED_BODY,
        );
        return;
      }

      let rawText = mlKitText;
      setEngineUsed(OCR_ENGINE.ML_KIT);

      // ステップ2: 選択エンジンで高精度認識
      const engine = engineForNextOCR.current; // refのため依存配列不要

      if (engine === OCR_ENGINE.CLOUD_VISION && isCloudVisionAvailable()) {
        const todayUsage = await getCloudVisionUsageToday();
        if (todayUsage >= CLOUD_VISION_DAILY_LIMIT) {
          // 日次上限超過 → ML Kit 結果をそのまま使用してユーザーに通知
          Alert.alert(
            MESSAGES.INFO.DAILY_LIMIT_TITLE,
            MESSAGES.INFO.DAILY_LIMIT_BODY,
          );
        } else {
          try {
            rawText = await recognizeTextWithCloudVision(uri);
            await incrementCloudVisionUsage();
            setEngineUsed(OCR_ENGINE.CLOUD_VISION);
          } catch (cloudError) {
            captureError(cloudError, {
              screen: "HomeScreen",
              action: "cloudVisionOCR",
            });
            if (cloudError instanceof CloudVisionRateLimitError) {
              Alert.alert(
                MESSAGES.INFO.RATE_LIMIT_TITLE,
                MESSAGES.INFO.RATE_LIMIT_BODY,
              );
            }
            // Cloud Vision 失敗 → ML Kit 結果をそのまま使用（再実行不要）
          }
        }
      } else if (engine === OCR_ENGINE.GEMINI_FLASH && isGeminiAvailable()) {
        // 月次使用上限チェック（Phase 3 で isPremium を RevenueCat に置き換える）
        // __DEV__ = true（開発ビルド）の間はチェックをスキップして動作確認できる
        const isPremium = false; // Phase 3: RevenueCat.getCustomerInfo() で置き換える
        const monthlyLimit = isPremium ? GEMINI_PREMIUM_MONTHLY_LIMIT : GEMINI_FREE_TRIAL_LIMIT;
        const trialUsed = __DEV__ ? 0 : await getGeminiTrialUsedThisMonth();
        if (trialUsed >= monthlyLimit) {
          Alert.alert(
            isPremium
              ? MESSAGES.INFO.GEMINI_PREMIUM_LIMIT_TITLE
              : MESSAGES.INFO.GEMINI_TRIAL_LIMIT_TITLE,
            isPremium
              ? MESSAGES.INFO.GEMINI_PREMIUM_LIMIT_BODY
              : MESSAGES.INFO.GEMINI_TRIAL_LIMIT_BODY,
          );
          // 上限のためここで終了。ML Kit 結果はそのまま表示
        } else {
          const geminiUsage = await getGeminiUsageToday();
          if (geminiUsage >= GEMINI_DAILY_LIMIT) {
            // 日次上限超過 → ML Kit 結果をそのまま使用してユーザーに通知
            Alert.alert(
              MESSAGES.INFO.GEMINI_DAILY_LIMIT_TITLE,
              MESSAGES.INFO.GEMINI_DAILY_LIMIT_BODY,
            );
          } else {
            const selectedMode = modeForNextOCR.current;
            try {

              if (selectedMode === OCR_MODE.GENERAL) {
                // GENERALモード: ML Kit のみで完結。Gemini 呼び出しなし。
                // rawText はすでに ML Kit 結果を保持しているためそのまま使用。
                // 前回の構造化ビューをリセットして古い結果が残らないようにする。
                setGeminiResult(null);
                setModeUsed(null);
              } else if (selectedMode === OCR_MODE.RECEIPT) {
                // RECEIPTモード: ハイブリッド方式
                //   1. ML Kit + 正規表現パーサーを先行実行（常に無料）
                //   2. total と items が取れた場合は Gemini を消費しない
                //   3. 品質不十分（total/items 未取得）の場合のみ Gemini にフォールバック
                //   ※ここに到達した時点で月次/日次上限チェックは完了済み
                const parsed = parseReceiptText(mlKitText);
                const isHighQuality = parsed.total != null && parsed.items.length > 0;

                if (isHighQuality) {
                  // 品質十分 → ML Kit 結果で確定（Gemini 未消費）
                  rawText = mlKitText;
                  setGeminiResult({
                    raw_text: mlKitText,
                    merchant: parsed.merchant,
                    date:     parsed.date,
                    total:    parsed.total,
                    tax:      parsed.tax,
                    items:    parsed.items,
                  });
                  setModeUsed(selectedMode);
                  setEngineUsed(OCR_ENGINE.ML_KIT);
                } else {
                  // 品質不十分 → Gemini にフォールバック
                  const geminiData = await recognizeTextWithGemini(uri, OCR_MODE.RECEIPT);
                  await incrementGeminiUsage();
                  await incrementGeminiTrialUsage();
                  rawText = geminiData.raw_text;
                  setGeminiResult(geminiData);
                  setModeUsed(selectedMode);
                  setEngineUsed(OCR_ENGINE.GEMINI_FLASH);
                }
              } else {
                // EDUCATION: 画像入力で Gemini に送信（科目ヒントを付加して精度向上）
                const geminiOptions = selectedMode === OCR_MODE.EDUCATION
                  ? { subject: subjectForNextOCR.current }
                  : {};
                const geminiData = await recognizeTextWithGemini(uri, selectedMode, geminiOptions);
                await incrementGeminiUsage();
                await incrementGeminiTrialUsage();
                rawText = geminiData.raw_text;
                setGeminiResult(geminiData);
                setModeUsed(selectedMode);
                if (selectedMode === OCR_MODE.EDUCATION) {
                  setSubjectUsed(subjectForNextOCR.current);
                }
                setEngineUsed(OCR_ENGINE.GEMINI_FLASH);
              }
            } catch (geminiError) {
              captureError(geminiError, {
                screen: "HomeScreen",
                action: "geminiOCR",
              });
              // modeUsed を設定して「AIで再認識」ボタンを表示させる。
              // geminiResult は null のまま → 構造化ビューは出ず、テキストのみ表示。
              setModeUsed(selectedMode);
              if (selectedMode === OCR_MODE.EDUCATION) {
                setSubjectUsed(subjectForNextOCR.current);
              }
              Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.GEMINI_FAILED);
            }
          }
        }
      }

      applyOCRResult(rawText);
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "recognizeText" });
      if (error.message === "IMAGE_TOO_LARGE") {
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.IMAGE_TOO_LARGE);
      } else if (error.message === "IMAGE_INVALID_ASPECT") {
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.IMAGE_INVALID_ASPECT);
      } else {
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.OCR_FAILED);
      }
    } finally {
      setIsLoading(false);
    }
  }, [image, applyOCRResult]);

  const recognizeTextHighPrecision = useCallback(async () => {
    if (!image || !isCloudVisionAvailable()) return;

    // 日次上限チェック（ユーザーが明示的に高精度を選んだため、超過時はエラー表示）
    const todayUsage = await getCloudVisionUsageToday();
    if (todayUsage >= CLOUD_VISION_DAILY_LIMIT) {
      Alert.alert(
        MESSAGES.INFO.DAILY_LIMIT_TITLE,
        MESSAGES.INFO.DAILY_LIMIT_BODY,
      );
      return;
    }

    setIsLoading(true);
    setIsEditing(false);
    showInterstitialIfReady();
    try {
      // recognizeText 実行済みの場合は前処理済みURIを再利用（二重処理防止）
      const uri = processedUri ?? (await preprocessImageForOCR(image));
      const rawText = await recognizeTextWithCloudVision(uri);
      await incrementCloudVisionUsage();
      setEngineUsed(OCR_ENGINE.CLOUD_VISION);
      applyOCRResult(rawText);

      // GENERALモードのみ Cloud Vision を使うため、ここに到達するのは GENERAL のみ。
      // 将来 GENERAL 以外でも使う場合は modeUsed で分岐すること。
    } catch (error) {
      captureError(error, {
        screen: "HomeScreen",
        action: "recognizeTextHighPrecision",
      });
      if (error instanceof CloudVisionRateLimitError) {
        Alert.alert(
          MESSAGES.INFO.RATE_LIMIT_TITLE,
          MESSAGES.INFO.RATE_LIMIT_BODY,
        );
      } else {
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.HIGH_PRECISION_FAILED);
      }
    } finally {
      setIsLoading(false);
    }
  }, [image, processedUri, applyOCRResult]);

  /**
   * 構造化モード（RECEIPT/EDUCATION）でGeminiを使って再認識する。
   * ユーザーが認識結果に不満な場合の再試行エントリーポイント。
   * 月次・日次上限チェックは recognizeText の Gemini パスと同一ロジック。
   */
  const reRecognizeWithGemini = useCallback(async () => {
    if (!image || !isGeminiAvailable() || !modeUsed || modeUsed === OCR_MODE.GENERAL) return;

    // 1スキャンにつき1回のみ許可（API保護）。即座に disable して二重タップも防ぐ。
    setAiReRecognizeUsed(true);
    showInterstitialNow(); // 頻度カウンター非依存・ロード済みなら必ず表示

    const isPremium = false; // Phase 3: RevenueCat で置き換える
    const monthlyLimit = isPremium ? GEMINI_PREMIUM_MONTHLY_LIMIT : GEMINI_FREE_TRIAL_LIMIT;
    const trialUsed = __DEV__ ? 0 : await getGeminiTrialUsedThisMonth();
    if (trialUsed >= monthlyLimit) {
      Alert.alert(
        isPremium ? MESSAGES.INFO.GEMINI_PREMIUM_LIMIT_TITLE : MESSAGES.INFO.GEMINI_TRIAL_LIMIT_TITLE,
        isPremium ? MESSAGES.INFO.GEMINI_PREMIUM_LIMIT_BODY  : MESSAGES.INFO.GEMINI_TRIAL_LIMIT_BODY,
      );
      return;
    }
    const geminiUsage = await getGeminiUsageToday();
    if (geminiUsage >= GEMINI_DAILY_LIMIT) {
      Alert.alert(MESSAGES.INFO.GEMINI_DAILY_LIMIT_TITLE, MESSAGES.INFO.GEMINI_DAILY_LIMIT_BODY);
      return;
    }

    setIsLoading(true);
    setIsEditing(false);
    try {
      const uri = processedUri ?? (await preprocessImageForOCR(image));
      // EDUCATION の場合は初回スキャン時の科目を引き継ぐ
      const geminiOptions = modeUsed === OCR_MODE.EDUCATION
        ? { subject: subjectUsed ?? EDUCATION_SUBJECT.GENERAL }
        : {};
      const geminiData = await recognizeTextWithGemini(uri, modeUsed, geminiOptions);
      await incrementGeminiUsage();
      await incrementGeminiTrialUsage();
      applyOCRResult(geminiData.raw_text);
      setGeminiResult(geminiData);
      setEngineUsed(OCR_ENGINE.GEMINI_FLASH);
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "reRecognizeWithGemini" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.GEMINI_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [image, processedUri, modeUsed, subjectUsed, applyOCRResult]);

  const clearResult = useCallback(() => {
    setImage("");
    setText("");
    setIsEditing(false);
    setEngineUsed(null);
    setProcessedUri(null);
    setGeminiResult(null);
    setModeUsed(null);
    setSubjectUsed(null);
    setViewMode("text");
    setAiReRecognizeUsed(false);
    quizResultRef.current = null;
    lastSavedItemIdRef.current = null;
  }, []);

  const updateHistoryQuizScore = useCallback(async (id, quizData) => {
    try {
      const jsonValue = await AppStorage.getItem(HISTORY_KEY);
      const history = jsonValue ? JSON.parse(jsonValue) : [];
      const updated = history.map((item) =>
        item.id === id ? { ...item, quiz: quizData } : item,
      );
      await AppStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "updateHistoryQuizScore" });
    }
  }, []);

  const saveToHistory = useCallback(async () => {
    if (!text) {
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.NO_TEXT);
      return;
    }

    try {
      const jsonValue = await AppStorage.getItem(HISTORY_KEY);
      let history = [];
      try {
        history = jsonValue != null ? JSON.parse(jsonValue) : [];
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        history = [];
      }

      const newItem = {
        id: Crypto.randomUUID(),
        text: text,
        date: Date.now(),
        mode: modeUsed ?? OCR_MODE.GENERAL,
        subject: modeUsed === OCR_MODE.EDUCATION ? (subjectUsed ?? EDUCATION_SUBJECT.GENERAL) : null,
        geminiResult: geminiResult ?? null,
        quiz: quizResultRef.current,
      };

      const newHistory = [newItem, ...history];

      await AppStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(newHistory.slice(0, HISTORY_LIMIT)),
      );
      lastSavedItemIdRef.current = newItem.id;

      Alert.alert(MESSAGES.SUCCESS.SAVE_TITLE, MESSAGES.SUCCESS.SAVE_BODY);
    } catch (error) {
      captureError(error, { screen: "HomeScreen", action: "saveToHistory" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.SAVE_FAILED);
    }
  }, [text, modeUsed, geminiResult]);

  const toggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  // Interstitial 広告の初期化とクリーンアップ
  useEffect(() => {
    initializeInterstitial();
    return () => cleanupInterstitial();
  }, []);

  // 前回選択した科目・モードを復元してデフォルト化する
  useEffect(() => {
    AppStorage.getItem(LAST_SUBJECT_KEY).then((saved) => {
      if (saved && Object.values(EDUCATION_SUBJECT).includes(saved)) {
        subjectForNextOCR.current = saved;
        setSavedSubject(saved);
      }
    }).catch(() => {});
    AppStorage.getItem(LAST_MODE_KEY).then((saved) => {
      if (saved && Object.values(OCR_MODE).includes(saved)) {
        setSavedMode(saved);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (image) {
      recognizeText();
    }
  }, [image, recognizeText]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          {/* 3-B: ローディング表示 */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>認識中...</Text>
            </View>
          ) : null}

          {/* テキスト/構造化表示 切替トグル（Gemini かつ GENERAL 以外のモード） */}
          {text && !isLoading && geminiResult && modeUsed && modeUsed !== OCR_MODE.GENERAL ? (
            <>
              <PrivacyBadge />
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, viewMode === "text" && styles.toggleActive]}
                  onPress={() => setViewMode("text")}
                >
                  <Text style={[styles.toggleLabel, viewMode === "text" && styles.toggleLabelActive]}>
                    テキスト
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, viewMode === "structured" && styles.toggleActive]}
                  onPress={() => setViewMode("structured")}
                >
                  <Text style={[styles.toggleLabel, viewMode === "structured" && styles.toggleLabelActive]}>
                    {{ [OCR_MODE.RECEIPT]: "レシート", [OCR_MODE.EDUCATION]: "教育" }[modeUsed] ?? "構造化"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* 構造化ビュー（モードに応じてコンポーネントを切り替え） */}
          {text && !isLoading && viewMode === "structured" && geminiResult ? (
            <>
              {modeUsed === OCR_MODE.RECEIPT   && <ReceiptView      result={geminiResult} onResultChange={setGeminiResult} />}
              {modeUsed === OCR_MODE.EDUCATION && (
                <EducationView
                  result={geminiResult}
                  onQuizFinish={(quizData) => {
                    quizResultRef.current = quizData;
                    if (lastSavedItemIdRef.current) {
                      updateHistoryQuizScore(lastSavedItemIdRef.current, quizData);
                    }
                  }}
                  onSaveQuiz={saveToHistory}
                />
              )}
            </>
          ) : null}

          {/* OCR結果テキスト + 3-C: 手動編集トグル（テキストモード または GENERAL モード） */}
          {text && !isLoading && viewMode === "text" ? (
            <View style={styles.textContainer}>
              <TouchableOpacity style={styles.editButton} onPress={toggleEdit}>
                {isEditing ? (
                  <Check color={COLORS.primary} size={14} />
                ) : (
                  <Pen color={COLORS.primary} size={14} />
                )}
                <Text style={styles.editButtonLabel}>
                  {isEditing ? "完了" : "編集"}
                </Text>
              </TouchableOpacity>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={text}
                  onChangeText={setText}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
              ) : (
                <Text style={styles.textContent}>{text}</Text>
              )}
            </View>
          ) : null}

          {/* 再認識ボタン群 */}
          {text && !isLoading ? (
            <>
              {/* AIで再認識（Gemini）: 構造化モードのみ表示・1スキャン1回限り */}
              {modeUsed && modeUsed !== OCR_MODE.GENERAL && isGeminiAvailable() ? (
                <TouchableOpacity
                  style={[
                    styles.geminiReRecognizeButton,
                    aiReRecognizeUsed && styles.buttonDisabled,
                  ]}
                  onPress={reRecognizeWithGemini}
                  disabled={aiReRecognizeUsed}
                >
                  <Sparkles
                    color={aiReRecognizeUsed ? COLORS.textSecondary : COLORS.white}
                    size={12}
                  />
                  <Text
                    style={[
                      styles.reRecognizeButtonLabel,
                      aiReRecognizeUsed && styles.reRecognizeButtonLabelDisabled,
                    ]}
                  >
                    {aiReRecognizeUsed ? "再認識済み" : "AIで再認識"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* 手書き認識（Cloud Vision）: GENERALモードのみ表示 */}
              {(!modeUsed || modeUsed === OCR_MODE.GENERAL) && isCloudVisionAvailable() ? (
                <TouchableOpacity
                  style={styles.highPrecisionButton}
                  onPress={recognizeTextHighPrecision}
                >
                  <RefreshCw color={COLORS.white} size={12} />
                  <Text style={styles.highPrecisionButtonLabel}>
                    手書き認識
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {/* 3-A: 画像プレビュー — OCR結果の下に表示 */}
          {image ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: image }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            </View>
          ) : null}

        </View>
      </ScrollView>
      <FloatingButton onPress={openCamera} />
      {text && !isLoading ? <SaveButton onPress={saveToHistory} /> : null}
      {text && !isLoading ? <ClearButton onPress={clearResult} /> : null}
      <BannerAd
        unitId={AD_UNIT_IDS.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(error) =>
          captureError(error, { context: "BannerAd", action: "load" })
        }
        style={styles.banner}
      />
      <StatusBar style="light" />

      {/* 汎用オプション選択モーダル（Alert.alert スタイルのセンターダイアログ） */}
      <Modal
        visible={optionsModal !== null}
        transparent
        animationType="fade"
        onRequestClose={closeOptionsModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeOptionsModal}>
          {/* 内側の Pressable でタップ伝播を止める */}
          <Pressable style={styles.modalDialog}>
            <Text style={styles.modalTitle}>{optionsModal?.title}</Text>
            {optionsModal?.items.map(({ label, subtitle, icon: IconComp, onPress }, index) => (
              <TouchableOpacity
                key={index}
                style={styles.modalItem}
                onPress={() => {
                  closeOptionsModal();
                  onPress();
                }}
              >
                <View style={styles.modalItemRow}>
                  {IconComp && (
                    <IconComp size={18} color={COLORS.textPrimary} style={styles.modalItemIcon} />
                  )}
                  <Text style={styles.modalItemText}>{label}</Text>
                </View>
                {subtitle && (
                  <Text style={styles.modalItemSubtitle}>{subtitle}</Text>
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.modalDividerThick} />
            <TouchableOpacity style={styles.modalItem} onPress={closeOptionsModal}>
              <Text style={styles.modalCancelText}>
                {MESSAGES.CONFIRM.CANCEL}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingBottom: 150, // Banner(60px) + FloatingButton(90px)分の余白
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: 16,
  },
  // 3-A: 画像プレビュー
  imageContainer: {
    width: "100%",
    marginTop: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  imagePreview: {
    width: "100%",
    height: 200,
  },
  // 3-B: ローディング
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    width: "100%",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // OCR結果テキストエリア
  textContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: "100%",
  },
  // 3-C: 編集ボタン
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonLabel: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.primary,
  },
  textContent: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    textAlign: "justify",
  },
  // 3-C: 編集時 TextInput（Text と同じフォントスタイル）
  textInput: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    minHeight: 100,
    textAlignVertical: "top",
  },
  // テキスト/レシート 切替トグル
  toggleRow: {
    flexDirection: "row",
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignSelf: "center",
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleLabel: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  toggleLabelActive: {
    color: COLORS.white,
  },
  // AIで再認識ボタン（Gemini・構造化モード専用）
  geminiReRecognizeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    alignSelf: "center",
  },
  reRecognizeButtonLabel: {
    marginLeft: 6,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "600",
  },
  reRecognizeButtonLabelDisabled: {
    color: COLORS.textSecondary,
  },
  buttonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  // 手書き認識ボタン（Cloud Vision・GENERALモード専用）
  highPrecisionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
    alignSelf: "center",
  },
  highPrecisionButtonLabel: {
    marginLeft: 6,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "600",
  },
  banner: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  // 汎用オプション選択モーダル（Alert.alert スタイル）
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  modalDialog: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: "hidden",
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  modalItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalItemIcon: {
    flexShrink: 0,
  },
  modalItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  modalItemSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 3,
  },
  modalDividerThick: {
    height: 8,
    backgroundColor: COLORS.background,
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: "center",
    fontWeight: "600",
  },
});
