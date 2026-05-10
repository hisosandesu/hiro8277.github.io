import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Trash2, FileText, XCircle, Share2, Receipt, GraduationCap, Star, Library, Calculator, FlaskConical, BookText, Languages, Globe } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { AppStorage } from "../utils/secureStorage";
import { captureError } from "../utils/monitoring";
import { HISTORY_KEY } from "../constants/storage";
import { COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { HISTORY_ITEM_HEIGHT, NATIVE_AD_INTERVAL, OCR_MODE, EDUCATION_SUBJECT } from "../constants/app";
import NativeAdCard from "../components/NativeAdCard";
import ReceiptView from "../components/ReceiptView";
import EducationView from "../components/EducationView";

const SWIPE_THRESHOLD = -100;

const MODE_BADGE = {
  [OCR_MODE.GENERAL]:   { Icon: FileText,      bg: "#f3f4f6", color: "#6b7280" },
  [OCR_MODE.RECEIPT]:   { Icon: Receipt,       bg: "#fff3cd", color: "#856404" },
  [OCR_MODE.EDUCATION]: { Icon: GraduationCap, bg: "#d1ecf1", color: "#0c5460" },
};

const MODE_FILTERS = [
  { key: "all",                  label: "すべて",   Icon: null },
  { key: OCR_MODE.GENERAL,       label: "テキスト", Icon: FileText },
  { key: OCR_MODE.RECEIPT,       label: "レシート", Icon: Receipt },
  { key: OCR_MODE.EDUCATION,     label: "教育",     Icon: GraduationCap },
];

const SUBJECT_FILTERS = [
  { key: "all",                       label: "すべて", Icon: null },
  { key: EDUCATION_SUBJECT.GENERAL,   label: "汎用",   Icon: Library },
  { key: EDUCATION_SUBJECT.MATH,      label: "数学",   Icon: Calculator },
  { key: EDUCATION_SUBJECT.SCIENCE,   label: "理科",   Icon: FlaskConical },
  { key: EDUCATION_SUBJECT.JAPANESE,  label: "国語",   Icon: BookText },
  { key: EDUCATION_SUBJECT.ENGLISH,   label: "英語",   Icon: Languages },
  { key: EDUCATION_SUBJECT.SOCIAL,    label: "社会",   Icon: Globe },
];

function FilterChip({ label, Icon, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      {Icon && <Icon size={12} color={active ? COLORS.white : COLORS.textSecondary} />}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

const SwipeableHistoryItem = React.memo(function SwipeableHistoryItem({
  item,
  onDelete,
  onPress,
}) {
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, SWIPE_THRESHOLD * 1.5);
      }
    })
    .onEnd((event) => {
      if (event.translationX < SWIPE_THRESHOLD) {
        translateX.value = withTiming(SWIPE_THRESHOLD);
      } else {
        translateX.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value < -20 ? 1 : 0),
  }));

  const handleDelete = () => {
    translateX.value = withTiming(-500, { duration: 300 }, () => {
      runOnJS(onDelete)(item.id);
    });
  };

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.deleteBackground, deleteButtonStyle]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Trash2 size={28} color={COLORS.white} />
        </TouchableOpacity>
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            style={styles.historyItem}
            onPress={() => onPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.historyHeader}>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
              <View style={styles.badgeRow}>
                {item.mode && MODE_BADGE[item.mode] && (() => {
                  const { Icon, bg, color } = MODE_BADGE[item.mode];
                  return (
                    <View style={[styles.modeBadge, { backgroundColor: bg }]}>
                      <Icon size={12} color={color} />
                    </View>
                  );
                })()}
                {item.quiz?.lastScore && (
                  <View style={styles.scoreBadge}>
                    <Star size={10} color="#92400e" fill="#92400e" />
                    <Text style={styles.scoreBadgeText}>
                      {item.quiz.lastScore.correct}/{item.quiz.lastScore.total}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.historyText} numberOfLines={3}>
              {item.text}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterMode, setFilterMode] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");

  // setState 外でも最新の history を参照するための ref（deleteItem の stale closure 回避）
  const historyRef = useRef(history);
  const flatListRef = useRef(null);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const loadHistory = useCallback(async () => {
    try {
      const jsonValue = await AppStorage.getItem(HISTORY_KEY);
      if (jsonValue != null) {
        try {
          const data = JSON.parse(jsonValue);
          if (Array.isArray(data)) {
            setHistory(data);
          } else {
            setHistory([]);
          }
        } catch (parseError) {
          setHistory([]);
          await AppStorage.removeItem(HISTORY_KEY);
        }
      }
    } catch (error) {
      captureError(error, { screen: "HistoryScreen", action: "loadHistory" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.LOAD_FAILED);
    }
  }, []);

  const deleteItem = useCallback((id) => {
    // historyRef を使って stale closure を回避しつつ、
    // ストレージ書き込みを setState updater の外で実行する（副作用分離）
    const newHistory = historyRef.current.filter((item) => item.id !== id);
    setHistory(newHistory);
    AppStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)).catch(
      (error) => {
        captureError(error, { screen: "HistoryScreen", action: "deleteItem" });
        Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.DELETE_FAILED);
      },
    );
  }, []);

  const clearAllHistory = useCallback(() => {
    Alert.alert(
      MESSAGES.CONFIRM.DELETE_ALL_TITLE,
      MESSAGES.CONFIRM.DELETE_ALL_BODY,
      [
        { text: MESSAGES.CONFIRM.CANCEL, style: "cancel" },
        {
          text: MESSAGES.CONFIRM.DELETE,
          style: "destructive",
          onPress: async () => {
            try {
              await AppStorage.removeItem(HISTORY_KEY);
              setHistory([]);
            } catch (error) {
              captureError(error, {
                screen: "HistoryScreen",
                action: "clearAllHistory",
              });
              Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.DELETE_FAILED);
            }
          },
        },
      ],
    );
  }, []);

  const openItem = useCallback((item) => {
    setSelectedItem(item);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  const handleFilterModeChange = useCallback((key) => {
    setFilterMode(key);
    if (key !== OCR_MODE.EDUCATION) setFilterSubject("all");
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleFilterSubjectChange = useCallback((key) => {
    setFilterSubject(key);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const filteredHistory = useMemo(() => {
    if (filterMode === "all") return history;
    const byMode = history.filter((item) => item.mode === filterMode);
    if (filterMode !== OCR_MODE.EDUCATION || filterSubject === "all") return byMode;
    return byMode.filter((item) => {
      const subject = item.subject
        ?? item.geminiResult?.subject_detail
        ?? EDUCATION_SUBJECT.GENERAL;
      return subject === filterSubject;
    });
  }, [history, filterMode, filterSubject]);

  const updateHistoryQuizScore = useCallback(async (id, quizData) => {
    const newHistory = historyRef.current.map((item) =>
      item.id === id ? { ...item, quiz: quizData } : item,
    );
    setHistory(newHistory);
    setSelectedItem((prev) => (prev?.id === id ? { ...prev, quiz: quizData } : prev));
    AppStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)).catch((error) =>
      captureError(error, { screen: "HistoryScreen", action: "updateHistoryQuizScore" }),
    );
  }, []);

  const exportItemAsText = useCallback(async () => {
    if (!selectedItem) return;
    try {
      const dateStr = formatDate(selectedItem.date).replace(/[:/\s]/g, "_");
      const filePath = `${FileSystem.documentDirectory}ocr_${dateStr}.txt`;
      await FileSystem.writeAsStringAsync(filePath, selectedItem.text ?? "");
      await Sharing.shareAsync(filePath, {
        mimeType: "text/plain",
        dialogTitle: "テキストをエクスポート",
      });
    } catch {
      Alert.alert("エクスポート失敗", "ファイルの共有に失敗しました");
    }
  }, [selectedItem]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  // 履歴アイテムに広告ダミーを NATIVE_AD_INTERVAL 件おきに挿入
  const listData = useMemo(() => {
    const result = [];
    filteredHistory.forEach((item, index) => {
      result.push(item);
      if ((index + 1) % NATIVE_AD_INTERVAL === 0) {
        result.push({ id: `ad_${index}`, type: "ad" });
      }
    });
    return result;
  }, [filteredHistory]);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.type === "ad") {
        return <NativeAdCard />;
      }
      return (
        <SwipeableHistoryItem
          item={item}
          onDelete={deleteItem}
          onPress={openItem}
        />
      );
    },
    [deleteItem, openItem],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {filterMode === "all"
            ? `保存された履歴: ${history.length}件`
            : `${filteredHistory.length}件 / ${history.length}件`}
        </Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={clearAllHistory}>
            <Text style={styles.clearAllText}>すべて削除</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* スティッキーフィルターバー */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {MODE_FILTERS.map(({ key, label, Icon }) => (
            <FilterChip
              key={key}
              label={label}
              Icon={Icon}
              active={filterMode === key}
              onPress={() => handleFilterModeChange(key)}
            />
          ))}
        </ScrollView>
        {filterMode === OCR_MODE.EDUCATION && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.subjectRow}
          >
            {SUBJECT_FILTERS.map(({ key, label, Icon }) => (
              <FilterChip
                key={key}
                label={label}
                Icon={Icon}
                active={filterSubject === key}
                onPress={() => handleFilterSubjectChange(key)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        renderItem={renderItem}
        getItemLayout={(_data, index) => ({
          length: HISTORY_ITEM_HEIGHT,
          offset: HISTORY_ITEM_HEIGHT * index,
          index,
        })}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>保存された履歴はありません</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalFullScreen}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal} hitSlop={8}>
              <XCircle size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedItem?.mode === OCR_MODE.RECEIPT   ? "レシート詳細"   :
               selectedItem?.mode === OCR_MODE.EDUCATION ? "教育スキャン詳細" : "テキスト全文"}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedItem && (
            <Text style={styles.modalDate}>{formatDate(selectedItem.date)}</Text>
          )}

          {/* モード別コンテンツ */}
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {selectedItem?.mode === OCR_MODE.RECEIPT && selectedItem.geminiResult ? (
              <ReceiptView result={selectedItem.geminiResult} readOnly />
            ) : selectedItem?.mode === OCR_MODE.EDUCATION && selectedItem.geminiResult ? (
              <EducationView
                result={selectedItem.geminiResult}
                readOnly
                savedQuiz={selectedItem.quiz}
                onQuizFinish={(quizData) => updateHistoryQuizScore(selectedItem.id, quizData)}
              />
            ) : selectedItem ? (
              <View style={styles.textCard}>
                <Text style={styles.modalText}>{selectedItem.text}</Text>
                <View style={styles.textCardActions}>
                  <TouchableOpacity
                    style={styles.exportTxtButton}
                    onPress={exportItemAsText}
                  >
                    <Share2 color={COLORS.white} size={14} />
                    <Text style={styles.exportTxtLabel}>テキスト出力 (.txt)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </ScrollView>

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  clearAllText: {
    fontSize: 14,
    color: COLORS.danger,
    fontWeight: "600",
  },
  scroll: {
    flexGrow: 1,
    padding: 16,
  },
  filterBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  subjectRow: {
    marginTop: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  historyItem: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  historyText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  // ── フルスクリーンモーダル ─────────────────────────────────────
  modalFullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  modalDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.background,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  // ── GENERAL モード テキストカード（ReceiptView / EducationView と統一） ───
  textCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  textCardActions: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },
  exportTxtButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 5,
  },
  exportTxtLabel: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  // ── モード・スコアバッジ ────────────────────────────────────────
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modeBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
  },
  swipeContainer: {
    marginBottom: 12,
    position: "relative",
  },
  deleteBackground: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: COLORS.danger,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
});
