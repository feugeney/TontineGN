import React from "react";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import FloatingTabBar from "@/components/FloatingTabBar";
import { Home, Users, Wallet, User } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";

const TABS = [
  { name: "(home)", label: "Accueil", route: "/(tabs)/(home)" as const, icon: "home" as const },
  { name: "(groups)", label: "Tontines", route: "/(tabs)/(groups)" as const, icon: "group" as const },
  { name: "(wallet)", label: "Portefeuille", route: "/(tabs)/(wallet)" as const, icon: "account-balance-wallet" as const },
  { name: "(profile)", label: "Profil", route: "/(tabs)/(profile)" as const, icon: "person" as const },
];

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => (
          <FloatingTabBar
            tabs={TABS}
            containerWidth={340}
            borderRadius={35}
            bottomMargin={20}
          />
        )}
      >
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="(groups)" />
        <Tabs.Screen name="(wallet)" />
        <Tabs.Screen name="(profile)" />
      </Tabs>
    </View>
  );
}
