import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Share2, BookOpen, Calculator, List, Sparkles, RotateCcw, Lightbulb, Quote } from "lucide-react-native";
import { showInterstitialNow } from "../utils/adManager";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { QUIZ_QUESTION_COUNT, GEMINI_FREE_TRIAL_LIMIT, GEMINI_DAILY_LIMIT } from "../constants/app";
import {
  getGeminiTrialUsedThisMonth,
  getGeminiUsageToday,
  incrementGeminiTrialUsage,
  incrementGeminiUsage,
} from "../utils/usageTracker";
import { generateQuizFromEducationResult } from "../utils/quizGenerator";
import { exportQuizAsAnkiTxt } from "../utils/ankiExporter";
import QuizView from "./QuizView";

/** 学習レベルのラベル・色設定 */
const GRADE_CONFIG = {
  elementary: { label: "小学校",  bg: "#e8f5e9", color: "#2e7d32" },
  middle:     { label: "中学校",  bg: "#e3f2fd", color: "#1565c0" },
  high:       { label: "高校",    bg: "#f3e5f5", color: "#6a1b9a" },
  unknown:    { label: null,      bg: null,      color: null },
};

/** セクションタイプに対応するアイコンコンポーネント */
const SECTION_ICONS = {
  equation:            Calculator,
  list:                List,
  diagram_description: BookOpen,
  problem:             Lightbulb,
  text:                null,
};

/**
 * 構造化結果を Markdown 文字列に変換する純粋関数。
 * LaTeX 数式は $$ で囲み Obsidian / Notion 等に直接貼り付け可能な形式で出力する。
 */
function toMarkdown(result) {
  const {
    subject, title, writing_direction, sections = [],
    important_terms = [], formulas = [], key_dates = [],
  } = result;

  const lines = [];
  const heading = [subject, title].filter(Boolean).join(" — ");
  if (heading) {
    lines.push(`# ${heading}`, "");
  }

  if (writing_direction === "vertical") {
    lines.push("> ※ 縦書きテキストを横書きに変換しています", "");
  }

  for (const s of sections) {
    if (s.heading) lines.push(`## ${s.heading}`);
    if (s.content) lines.push(s.content);
    lines.push("");
  }

  if (formulas.length > 0) {
    lines.push("## 数式", "");
    for (const f of formulas) {
      lines.push(`$$${f}$$`, "");
    }
  }

  if (key_dates.length > 0) {
    lines.push("## 年表", "");
    for (const d of key_dates) {
      lines.push(`- **${d.year}年**: ${d.event}`);
    }
    lines.push("");
  }

  if (important_terms.length > 0) {
    lines.push("## 重要語句", "");
    lines.push(important_terms.map((t) => `\`${t}\``).join(" · "), "");
  }

  return lines.join("\n");
}

/**
 * 解き方ステップを番号付きで表示するサブコンポーネント。
 * 数学・理科の problem / equation セクションで使用する。
 */
function SolutionSteps({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <View style={styles.stepsContainer}>
      <View style={styles.stepsHeader}>
        <Lightbulb color="#b45309" size={12} />
        <Text style={styles.stepsLabel}>解き方</Text>
      </View>
      {steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Gemini 教育モード（黒板・教科書・試験問題）の構造化結果を表示するコンポーネント。
 * subject / title / writing_direction / sections[] / formulas[] / key_dates[] /
 * important_terms[] をビジュアル表示し、Markdown またはテキスト形式でエクスポートする。
 *
 * @param {{ result: {
 *   raw_text, subject, subject_detail, title, writing_direction,
 *   sections, important_terms, formulas, key_dates
 * } }} props
 */
export default function EducationView({ result, readOnly = false, savedQuiz = null, onQuizFinish, onSaveQuiz }) {
  const [exporting, setExporting] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizUsed, setQuizUsed] = useState(false);

  // readOnly モードで保存済みクイズを再プレイするボタン用
  const handleRetryQuiz = useCallback(() => setQuizData(savedQuiz), [savedQuiz]);

  // 新しいスキャン結果が来たらクイズ状態をリセット
  useEffect(() => {
    setQuizData(null);
    setQuizUsed(false);
  }, [result]);

  const handleGenerateQuiz = useCallback(async () => {
    if (quizUsed || isGeneratingQuiz || !result) return;

    // データ充足チェック（Geminiを呼ぶ前に空振りを防ぐ）
    const hasData =
      (result.sections?.length > 0) ||
      (result.important_terms?.length > 0) ||
      (result.key_dates?.length > 0) ||
      (result.formulas?.length > 0);
    if (!hasData) {
      Alert.alert(MESSAGES.QUIZ.NO_DATA_TITLE, MESSAGES.QUIZ.NO_DATA_BODY);
      return;
    }

    // 日次使用量チェック
    const dailyUsed = await getGeminiUsageToday();
    if (dailyUsed >= GEMINI_DAILY_LIMIT) {
      Alert.alert(
        MESSAGES.INFO.GEMINI_DAILY_LIMIT_TITLE,
        MESSAGES.INFO.GEMINI_DAILY_LIMIT_BODY,
      );
      return;
    }

    // 月次お試し回数チェック
    const trialUsed = await getGeminiTrialUsedThisMonth();
    if (trialUsed >= GEMINI_FREE_TRIAL_LIMIT) {
      Alert.alert(
        MESSAGES.INFO.GEMINI_TRIAL_LIMIT_TITLE,
        MESSAGES.INFO.GEMINI_TRIAL_LIMIT_BODY,
      );
      return;
    }

    // 楽観的ロック：二重タップ・失敗後の再呼び出しを防ぐ
    setQuizUsed(true);
    showInterstitialNow();
    setIsGeneratingQuiz(true);

    try {
      await incrementGeminiTrialUsage();
      await incrementGeminiUsage();
      const quiz = await generateQuizFromEducationResult(result, QUIZ_QUESTION_COUNT);
      if (quiz.questions.length === 0) {
        Alert.alert(MESSAGES.QUIZ.NO_DATA_TITLE, MESSAGES.QUIZ.NO_DATA_BODY);
        return;
      }
      setQuizData(quiz);
    } catch {
      Alert.alert(MESSAGES.QUIZ.ERROR_TITLE, MESSAGES.QUIZ.ERROR_BODY);
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [quizUsed, isGeneratingQuiz, result]);

  const runExport = useCallback(async (format) => {
    if (!result) return;
    setExporting(true);
    try {
      if (format === "markdown") {
        const md = toMarkdown(result);
        const path = `${FileSystem.documentDirectory}education_note_${Date.now()}.md`;
        await FileSystem.writeAsStringAsync(path, md);
        await Sharing.shareAsync(path, {
          mimeType: "text/markdown",
          dialogTitle: "Markdownをエクスポート",
        });
      } else {
        const {
          subject, title, sections = [], important_terms = [],
        } = result;
        const hasSections = sections.length > 0;
        const hasTerms    = important_terms.length > 0;
        const lines = [
          subject ? `【科目】${subject}` : null,
          title   ? `【タイトル】${title}` : null,
          hasSections ? "\n── 内容 ──" : null,
          ...sections.map((s) => `${s.heading ? `▶ ${s.heading}\n` : ""}${s.content ?? ""}`),
          hasTerms ? "\n── 重要語句 ──" : null,
          hasTerms ? important_terms.join("　") : null,
        ].filter(Boolean);
        await Share.share({ message: lines.join("\n") });
      }
    } catch {
      Alert.alert("エクスポート失敗", "データの共有に失敗しました");
    } finally {
      setExporting(false);
    }
  }, [result]);

  const handleExport = useCallback(() => {
    const activeQuiz = quizData ?? savedQuiz;
    const options = [
      { text: "Markdown (.md)", onPress: () => runExport("markdown") },
      { text: "テキスト (.txt)",  onPress: () => runExport("text") },
    ];
    if (activeQuiz) {
      options.push({
        text: "Ankiカード (.txt)",
        onPress: () => exportQuizAsAnkiTxt(activeQuiz).catch(() =>
          Alert.alert("エクスポート失敗", "Ankiカードの共有に失敗しました"),
        ),
      });
    }
    options.push({ text: "キャンセル", style: "cancel" });
    Alert.alert("エクスポート形式を選択", undefined, options);
  }, [runExport, quizData, savedQuiz]);

  if (!result) return null;

  const {
    subject, title, writing_direction, grade_level = "unknown",
    sections = [], important_terms = [], formulas = [], key_dates = [],
    reading_theme = null, rhetoric_techniques = [],
  } = result;
  const hasSections  = sections.length > 0;
  const hasTerms     = important_terms.length > 0;
  const hasFormulas  = formulas.length > 0;
  const hasDates     = key_dates.length > 0;
  const hasTheme     = !!reading_theme;
  const hasRhetoric  = rhetoric_techniques.length > 0;
  const gradeConf    = GRADE_CONFIG[grade_level] ?? GRADE_CONFIG.unknown;

  return (
    <View style={styles.wrapper}>
      {/* 縦書き変換バッジ */}
      {writing_direction === "vertical" ? (
        <View style={styles.verticalBadge}>
          <Text style={styles.verticalBadgeText}>縦書き → 横書き変換済み</Text>
        </View>
      ) : null}

      {/* ヘッダー：科目 + 学習レベルバッジ */}
      <View style={styles.headerRow}>
        {subject ? <Text style={[styles.subject, { flex: 1 }]}>{subject}</Text> : null}
        {gradeConf.label ? (
          <View style={[styles.gradeBadge, { backgroundColor: gradeConf.bg }]}>
            <Text style={[styles.gradeBadgeText, { color: gradeConf.color }]}>
              {gradeConf.label}
            </Text>
          </View>
        ) : null}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      {(subject || title) && (hasSections || hasFormulas || hasDates || hasTerms) ? (
        <View style={styles.divider} />
      ) : null}

      {/* 主題・テーマ（国語） */}
      {hasTheme ? (
        <View style={styles.themeBox}>
          <Quote color="#7c3aed" size={12} />
          <Text style={styles.themeText}>{reading_theme}</Text>
        </View>
      ) : null}

      {/* セクション一覧 */}
      {sections.map((section, index) => {
        const Icon = SECTION_ICONS[section.type] ?? null;
        return (
          <View key={index} style={styles.section}>
            {section.heading ? (
              <View style={styles.sectionHeader}>
                {Icon ? <Icon color={COLORS.primary} size={13} /> : null}
                <Text style={styles.sectionHeading}>{section.heading}</Text>
              </View>
            ) : null}
            <Text style={styles.sectionContent}>{section.content ?? ""}</Text>
            {/* 解説テキスト */}
            {section.explanation ? (
              <Text style={styles.sectionExplanation}>{section.explanation}</Text>
            ) : null}
            {/* 解き方ステップ（数学・理科の problem/equation） */}
            <SolutionSteps steps={section.solution_steps} />
          </View>
        );
      })}

      {/* 数式（LaTeX 記法・コードブロック表示） */}
      {hasFormulas ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.formulasLabel}>数式</Text>
          {formulas.map((f, i) => (
            <View key={i} style={styles.formulaBox}>
              <Text style={styles.formulaText} selectable>{f}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* 年表 */}
      {hasDates ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.datesLabel}>年表</Text>
          {key_dates.map((d, i) => (
            <View key={i} style={styles.dateRow}>
              <Text style={styles.dateYear}>{d.year}年</Text>
              <Text style={styles.dateEvent}>{d.event}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* 重要語句タグ */}
      {hasTerms ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.termsLabel}>重要語句</Text>
          <View style={styles.tagsRow}>
            {important_terms.map((term, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{term}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* 修辞技法（国語の詩歌・文学） */}
      {hasRhetoric ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.termsLabel}>修辞技法</Text>
          <View style={styles.rhetoricList}>
            {rhetoric_techniques.map((r, i) => (
              <View key={i} style={styles.rhetoricItem}>
                <Text style={styles.rhetoricTechnique}>{r.technique}</Text>
                {r.example ? (
                  <Text style={styles.rhetoricExample}>「{r.example}」</Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {!subject && !title && !hasSections && !hasTerms && !hasFormulas && !hasDates ? (
        <Text style={styles.noDataText}>
          構造化データが抽出できませんでした。テキスト表示をご利用ください。
        </Text>
      ) : null}

      {/* クイズ生成 / 再トライ ボタン
          - savedQuiz あり & readOnly → 「もう一度トライ」（API呼び出しなし）
          - それ以外（savedQuiz なし、または HomeScreen）→ 「クイズ生成」（Gemini API）
      */}
      <View style={styles.actionRow}>
        {savedQuiz && readOnly ? (
          <TouchableOpacity style={styles.quizButton} onPress={handleRetryQuiz}>
            <RotateCcw color={COLORS.white} size={14} />
            <Text style={styles.quizLabel}>
              {`もう一度トライ${savedQuiz.lastScore ? ` (前回 ${savedQuiz.lastScore.correct}/${savedQuiz.lastScore.total})` : ""}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.quizButton,
              (quizUsed || isGeneratingQuiz) && styles.quizButtonDisabled,
            ]}
            onPress={handleGenerateQuiz}
            disabled={quizUsed || isGeneratingQuiz}
          >
            {isGeneratingQuiz ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Sparkles color={COLORS.white} size={14} />
            )}
            <Text style={styles.quizLabel}>
              {isGeneratingQuiz ? "問題を生成中..." :
               quizUsed      ? "生成済み" :
                               `クイズ生成（${QUIZ_QUESTION_COUNT}問）`}
            </Text>
          </TouchableOpacity>
        )}

        {/* エクスポートボタン */}
        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Share2 color={COLORS.white} size={14} />
          )}
          <Text style={styles.exportLabel}>
            {exporting ? "エクスポート中..." : "エクスポート"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* クイズ表示（生成後） */}
      {quizData && (
        <QuizView
          quiz={quizData}
          onClose={() => setQuizData(null)}
          onFinish={(score) => onQuizFinish?.({ ...quizData, lastScore: score })}
          onSaveAndClose={readOnly ? undefined : onSaveQuiz}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    width: "100%",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // ── 縦書きバッジ ─────────────────────────────────────────────
  verticalBadge: {
    backgroundColor: "rgba(22, 116, 118, 0.10)",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  verticalBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
  },

  // ── ヘッダー ─────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  subject: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  gradeBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  // ── 主題・テーマ（国語） ───────────────────────────────────────
  themeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#f5f3ff",
    borderLeftWidth: 3,
    borderLeftColor: "#7c3aed",
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  themeText: {
    flex: 1,
    fontSize: 13,
    color: "#4c1d95",
    lineHeight: 20,
    fontStyle: "italic",
  },

  // ── 区切り線 ─────────────────────────────────────────────────
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: 10,
  },

  // ── セクション ────────────────────────────────────────────────
  section: {
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  sectionContent: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 20,
    paddingLeft: 4,
  },
  sectionExplanation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontStyle: "italic",
    paddingLeft: 4,
    marginTop: 4,
  },

  // ── 解き方ステップ ────────────────────────────────────────────
  stepsContainer: {
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  stepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  stepsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#b45309",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: "#78350f",
    lineHeight: 20,
  },

  // ── 数式（LaTeX コードブロック） ───────────────────────────────
  formulasLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 2,
  },
  formulaBox: {
    backgroundColor: "#1e1e2e",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  formulaText: {
    fontSize: 13,
    color: "#cdd6f4",
    fontFamily: "monospace",
    lineHeight: 20,
  },

  // ── 年表 ─────────────────────────────────────────────────────
  datesLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  dateYear: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    minWidth: 56,
  },
  dateEvent: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },

  // ── 重要語句 ──────────────────────────────────────────────────
  termsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: "rgba(22, 116, 118, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },

  // ── 修辞技法 ──────────────────────────────────────────────────
  rhetoricList: {
    gap: 6,
    marginTop: 4,
  },
  rhetoricItem: {
    backgroundColor: "#faf5ff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 2,
    borderLeftColor: "#7c3aed",
  },
  rhetoricTechnique: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6d28d9",
    marginBottom: 2,
  },
  rhetoricExample: {
    fontSize: 12,
    color: "#4c1d95",
    fontStyle: "italic",
  },

  // ── その他 ───────────────────────────────────────────────────
  noDataText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: 8,
  },
  // ── ボタン行（クイズ + エクスポート） ───────────────────────────
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quizButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 5,
  },
  quizButtonDisabled: {
    opacity: 0.5,
  },
  quizLabel: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "600",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportLabel: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: "600",
  },
});
