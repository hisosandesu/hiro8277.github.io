import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { X, CheckCircle, XCircle, RotateCcw } from "lucide-react-native";
import { COLORS } from "../constants/colors";

const CORRECT_COLOR   = "#22863a";
const INCORRECT_COLOR = "#d73a49";

// ── 満点お祝い演出（花火） ─────────────────────────────────────────────────
const BURST_COLORS = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
  "#FF6FC8", "#C77DFF", "#4CC9F0", "#F8961E",
];
const PARTICLES = [0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
  const rad = (deg * Math.PI) / 180;
  const dist = 72;
  return { color: BURST_COLORS[i], tx: Math.cos(rad) * dist, ty: Math.sin(rad) * dist };
});

function ConfettiBurst() {
  const progress = useRef(new Animated.Value(0)).current;
  const animStyles = useMemo(
    () => PARTICLES.map(({ tx, ty }) => ({
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
        { scale: progress.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0.2, 1.4, 1.0, 0.2] }) },
      ],
      opacity: progress.interpolate({ inputRange: [0, 0.08, 0.65, 1], outputRange: [0, 1, 0.9, 0] }),
    })),
    [progress],
  );
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
  }, [progress]);
  return (
    <View style={styles.burstContainer} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Animated.View key={i} style={[styles.burstParticle, { backgroundColor: p.color }, animStyles[i]]} />
      ))}
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * カードめくり式クイズ表示コンポーネント。
 * 1問ずつ表示 → タップで答え表示 → 正解/不正解の自己採点 → スコア表示。
 *
 * @param {{ quiz: { subject: string, questions: object[] }, onClose: function }} props
 */
export default function QuizView({ quiz, onClose, onFinish, onSaveAndClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);

  const total = quiz.questions.length;
  const question = quiz.questions[currentIndex];
  const correctCount = answers.filter((a) => a.correct).length;

  const revealAnswer = useCallback(() => setRevealed(true), []);

  const judge = useCallback((isCorrect) => {
    const next = [...answers, { correct: isCorrect }];
    setAnswers(next);
    if (currentIndex + 1 >= total) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
    }
  }, [answers, currentIndex, total]);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setAnswers([]);
    setFinished(false);
  }, []);

  const scoreComment =
    correctCount === total              ? "満点！素晴らしい！" :
    correctCount >= Math.ceil(total * 0.8) ? "よくできました！" :
    correctCount >= Math.ceil(total * 0.5) ? "もう少し復習しましょう" :
                                            "教材を見直してみましょう";

  // finished=true のとき（結果画面）は onFinish にスコアを通知してから閉じる
  const handleClose = useCallback(() => {
    if (finished) onFinish?.({ correct: correctCount, total });
    onClose();
  }, [finished, correctCount, total, onFinish, onClose]);

  // 「保存して閉じる」: onFinish でスコアをセット → 保存 → クイズを閉じる
  const handleSaveAndClose = useCallback(() => {
    if (finished) onFinish?.({ correct: correctCount, total });
    onSaveAndClose?.();
    onClose();
  }, [finished, correctCount, total, onFinish, onSaveAndClose, onClose]);

  if (finished) {
    const isPerfect = correctCount === total;
    return (
      <View style={styles.wrapper}>
        {isPerfect && <ConfettiBurst />}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{quiz.subject} — 結果</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={8}>
            <X color={COLORS.textSecondary} size={18} />
          </TouchableOpacity>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.scoreLabel}>スコア</Text>
          <Text style={styles.scoreBig}>
            {correctCount}
            <Text style={styles.scoreTotal}> / {total}</Text>
          </Text>
          <Text style={styles.scoreComment}>{scoreComment}</Text>
        </View>

        <View style={styles.resultActions}>
          <TouchableOpacity style={styles.restartButton} onPress={restart}>
            <RotateCcw color={COLORS.white} size={14} />
            <Text style={styles.restartLabel}>もう一度</Text>
          </TouchableOpacity>
          {onSaveAndClose ? (
            <TouchableOpacity style={styles.saveCloseButton} onPress={handleSaveAndClose}>
              <Text style={styles.saveCloseLabel}>保存して閉じる</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.outlineButton} onPress={handleClose}>
              <Text style={styles.outlineLabel}>閉じる</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (!question) return null;

  return (
    <View style={styles.wrapper}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{quiz.subject} クイズ</Text>
        <TouchableOpacity onPress={handleClose} hitSlop={8}>
          <X color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* プログレスバー */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(currentIndex / total) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{currentIndex + 1} / {total}問</Text>

      {/* 問題カード */}
      <View style={styles.card}>
        <Text style={styles.typeLabel}>
          {question.type === "fill_in_blank" ? "穴埋め問題" : "選択問題"}
        </Text>
        <Text style={styles.questionText}>{question.question}</Text>

        {/* 選択問題: 選択肢リスト（答え非表示時のみ） */}
        {question.type === "multiple_choice" &&
          !revealed &&
          Array.isArray(question.choices) && (
            <View style={styles.choices}>
              {question.choices.map((choice, i) => (
                <View key={i} style={styles.choiceRow}>
                  <Text style={styles.choiceLetter}>
                    {["A", "B", "C", "D"][i]}
                  </Text>
                  <Text style={styles.choiceText}>{choice}</Text>
                </View>
              ))}
            </View>
          )}

        {/* 答え表示 or 「答えを見る」ボタン */}
        {revealed ? (
          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>答え</Text>
            <Text style={styles.answerText}>{question.answer}</Text>
            {question.hint ? (
              <Text style={styles.hintText}>💡 {question.hint}</Text>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity style={styles.revealButton} onPress={revealAnswer}>
            <Text style={styles.revealLabel}>答えを見る</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 自己採点ボタン（答え表示後） */}
      {revealed && (
        <View style={styles.judgeRow}>
          <TouchableOpacity
            style={[styles.judgeButton, { backgroundColor: INCORRECT_COLOR }]}
            onPress={() => judge(false)}
          >
            <XCircle color={COLORS.white} size={15} />
            <Text style={styles.judgeLabel}>不正解</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.judgeButton, { backgroundColor: CORRECT_COLOR }]}
            onPress={() => judge(true)}
          >
            <CheckCircle color={COLORS.white} size={15} />
            <Text style={styles.judgeLabel}>正解</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary + "40",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  // ── ヘッダー ──────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // ── プログレス ────────────────────────────────────────────────
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginBottom: 10,
  },

  // ── 問題カード ────────────────────────────────────────────────
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 23,
    marginBottom: 12,
  },

  // ── 選択肢 ───────────────────────────────────────────────────
  choices: {
    gap: 6,
    marginBottom: 12,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  choiceLetter: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    minWidth: 18,
  },
  choiceText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },

  // ── 答えを見るボタン ──────────────────────────────────────────
  revealButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  revealLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },

  // ── 答え表示ボックス ──────────────────────────────────────────
  answerBox: {
    backgroundColor: "#edf7ed",
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: CORRECT_COLOR,
  },
  answerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: CORRECT_COLOR,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  // ── 自己採点ボタン ────────────────────────────────────────────
  judgeRow: {
    flexDirection: "row",
    gap: 10,
  },
  judgeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  judgeLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },

  // ── 結果画面 ──────────────────────────────────────────────────
  resultCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  scoreBig: {
    fontSize: 44,
    fontWeight: "800",
    color: COLORS.primary,
    lineHeight: 52,
  },
  scoreTotal: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  scoreComment: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  resultActions: {
    flexDirection: "row",
    gap: 10,
  },
  restartButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  restartLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  outlineButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  outlineLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // ── 保存して閉じるボタン ──────────────────────────────────────────────────
  saveCloseButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CORRECT_COLOR,
    borderRadius: 8,
    paddingVertical: 10,
  },
  saveCloseLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── 花火パーティクル ──────────────────────────────────────────────────────
  burstContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  burstParticle: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
});
