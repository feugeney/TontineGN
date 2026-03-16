import "react-native-reanimated";
import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme, View, ActivityIndicator } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { COLORS } from "@/constants/Colors";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) {
      router.replace("/(auth)");
    } else if (user && inAuth) {
      router.replace("/(tabs)/(home)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: COLORS.primary,
      background: COLORS.background,
      card: COLORS.surface,
      text: COLORS.text,
      border: COLORS.border,
      notification: COLORS.danger,
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "#2D8A50",
      background: "#0A140A",
      card: "#111A11",
      text: "#E8F0E8",
      border: "rgba(255,255,255,0.08)",
      notification: COLORS.danger,
    },
  };

  return (
    <ThemeProvider value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthGuard>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="group/[id]"
                options={{ headerShown: true, headerBackButtonDisplayMode: "minimal" }}
              />
              <Stack.Screen
                name="group/create"
                options={{
                  presentation: "formSheet",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="group/invite"
                options={{
                  presentation: "formSheet",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="contribution/pay"
                options={{
                  presentation: "formSheet",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="wallet/deposit"
                options={{
                  presentation: "formSheet",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="wallet/withdraw"
                options={{
                  presentation: "formSheet",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="wallet/send"
                options={{
                  presentation: "formSheet",
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="notifications"
                options={{ headerShown: true, title: "Notifications" }}
              />
            </Stack>
          </AuthGuard>
          <SystemBars style="auto" />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
  );
}
