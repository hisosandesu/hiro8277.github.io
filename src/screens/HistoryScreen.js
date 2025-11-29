import React, { useState, useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "@react-native-vector-icons/fontawesome6";

const HISTORY_KEY = "@ocr_history";

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);
      if (jsonValue != null) {
        const data = JSON.parse(jsonValue);
        setHistory(data);
        console.log("📚 履歴を読み込みました:", data.length + "件");
      }
    } catch (e) {
      console.error("履歴の読み込みエラー:", e);
      Alert.alert("エラー", "履歴の読み込みに失敗しました");
    }
  };

  const deleteItem = async (id) => {
    try {
      const newHistory = history.filter((item) => item.id !== id);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
      console.log("🗑️ 履歴を削除しました:", id);
    } catch (e) {
      console.error("履歴の削除エラー:", e);
      Alert.alert("エラー", "履歴の削除に失敗しました");
    }
  };

  const clearAllHistory = () => {
    Alert.alert("確認", "すべての履歴を削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(HISTORY_KEY);
            setHistory([]);
            console.log("🗑️ すべての履歴を削除しました");
          } catch (e) {
            console.error("履歴の削除エラー:", e);
            Alert.alert("エラー", "履歴の削除に失敗しました");
          }
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

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
      <ScrollView contentContainerStyle={styles.scroll}>
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="file" size={60} color="#999" solid />
            <Text style={styles.emptyText}>保存された履歴はありません</Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                <TouchableOpacity onPress={() => deleteItem(item.id)}>
                  <Icon name="trash-can" size={18} color="#999" solid />
                </TouchableOpacity>
              </View>
              <Text style={styles.historyText} numberOfLines={3}>
                {item.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  clearAllText: {
    fontSize: 14,
    color: "#ff3b30",
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
    color: "#999",
  },
  historyItem: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
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
    color: "#999",
  },
  historyText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
});
