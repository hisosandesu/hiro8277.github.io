import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS } from "../constants/colors";
import { captureError } from "../utils/monitoring";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>問題が発生しました</Text>
          <Text style={styles.message}>アプリを再起動してください</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 32,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 30,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
