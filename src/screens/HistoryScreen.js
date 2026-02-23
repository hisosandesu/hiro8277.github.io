import React, { useState, useCallback } from "react";
import {
  SafeAreaView,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "@react-native-vector-icons/fontawesome6";
import * as Clipboard from "expo-clipboard";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SecureStorage } from "../utils/secureStorage";
import { captureError } from "../utils/monitoring";
import { HISTORY_KEY } from "../constants/storage";
import { COLORS } from "../constants/colors";
import { MESSAGES } from "../constants/messages";
import { CLIPBOARD_CLEAR_DELAY } from "../constants/app";

const SWIPE_THRESHOLD = -100;

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
          <Icon name="trash-can" size={28} color={COLORS.white} solid />
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

  const loadHistory = useCallback(async () => {
    try {
      const jsonValue = await SecureStorage.getItem(HISTORY_KEY);
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
          await SecureStorage.removeItem(HISTORY_KEY);
        }
      }
    } catch (error) {
      captureError(error, { screen: "HistoryScreen", action: "loadHistory" });
      Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.LOAD_FAILED);
    }
  }, []);

  const deleteItem = useCallback((id) => {
    setHistory((prev) => {
      const newHistory = prev.filter((item) => item.id !== id);
      SecureStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)).catch(
        (error) => {
          captureError(error, { screen: "HistoryScreen", action: "deleteItem" });
          Alert.alert(MESSAGES.ERROR.TITLE, MESSAGES.ERROR.DELETE_FAILED);
        }
      );
      return newHistory;
    });
  }, []);

  const clearAllHistory = () => {
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
              await SecureStorage.removeItem(HISTORY_KEY);
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
      ]
    );
  };

  const openItem = useCallback((item) => {
    setSelectedItem(item);
    setModalVisible(true);
  }, []);

  const closeModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const copyToClipboard = async () => {
    if (selectedItem) {
      await Clipboard.setStringAsync(selectedItem.text);
      Alert.alert(MESSAGES.SUCCESS.COPY_TITLE, MESSAGES.SUCCESS.COPY_BODY);
      setTimeout(async () => {
        await Clipboard.setStringAsync("");
      }, CLIPBOARD_CLEAR_DELAY);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const renderItem = useCallback(
    ({ item }) => (
      <SwipeableHistoryItem
        item={item}
        onDelete={deleteItem}
        onPress={openItem}
      />
    ),
    [deleteItem, openItem]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          保存された履歴: {history.length}件
        </Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={clearAllHistory}>
            <Text style={styles.clearAllText}>すべて削除</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="file" size={60} color={COLORS.textSecondary} solid />
            <Text style={styles.emptyText}>保存された履歴はありません</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>テキスト全文</Text>
              <TouchableOpacity onPress={closeModal}>
                <Icon name="circle-xmark" size={24} color={COLORS.textPrimary} solid />
              </TouchableOpacity>
            </View>
            {selectedItem && (
              <>
                <Text style={styles.modalDate}>
                  {formatDate(selectedItem.date)}
                </Text>
                <ScrollView style={styles.modalContent}>
                  <Text style={styles.modalText}>{selectedItem.text}</Text>
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={copyToClipboard}
                  >
                    <Icon name="copy" size={18} color={COLORS.white} solid />
                    <Text style={styles.copyButtonText}>コピー</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  modalDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  modalContent: {
    maxHeight: 400,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "center",
  },
  copyButton: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
  },
  copyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
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
