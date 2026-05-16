import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "../../screens/HomeScreen";
import HistoryScreen from "../../screens/HistoryScreen";
import { COLORS } from "../../constants/colors";

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: COLORS.white,
        headerStyle: { backgroundColor: COLORS.primary },
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerTitle: "ヨミトルAI" }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ headerTitle: "履歴" }}
      />
    </Stack.Navigator>
  );
}
