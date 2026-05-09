import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import HomeStack from "./stack/HomeStack";
import { getOrCreateAnonymousUser } from "../utils/authManager";
import { captureError } from "../utils/monitoring";

export default function RootNavigation() {
  React.useEffect(() => {
    getOrCreateAnonymousUser().catch((e) =>
      captureError(e, { context: "RootNavigation", action: "anonymousAuth" })
    );
  }, []);

  return (
    <NavigationContainer>
      <HomeStack></HomeStack>
    </NavigationContainer>
  );
}
