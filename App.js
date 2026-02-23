import * as Sentry from "@sentry/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootNavigation from "./src/navigations/RootNavigation";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { initMonitoring } from "./src/utils/monitoring";

initMonitoring();

function AppContent() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootNavigation />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(AppContent);
