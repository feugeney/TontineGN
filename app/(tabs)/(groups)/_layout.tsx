import { Stack } from "expo-router";
import { COLORS } from "@/constants/Colors";

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTitleStyle: { fontFamily: "Nunito_700Bold", fontSize: 18, color: COLORS.text },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
