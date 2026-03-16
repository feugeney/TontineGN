import { Stack } from "expo-router";
import { COLORS } from "@/constants/Colors";

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
