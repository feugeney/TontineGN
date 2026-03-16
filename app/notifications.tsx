import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  SectionList,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Bell, DollarSign, AlertTriangle, Info } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/utils/api";
import { timeAgo } from "@/utils/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface Section {
  title: string;
  data: Notification[];
}

function AnimatedItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 40, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 40, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function groupByDate(notifications: Notification[]): Section[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, Notification[]> = {
    "Aujourd'hui": [],
    "Hier": [],
    "Cette semaine": [],
    "Plus ancien": [],
  };

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups["Aujourd'hui"].push(n);
    else if (d >= yesterday) groups["Hier"].push(n);
    else if (d >= weekAgo) groups["Cette semaine"].push(n);
    else groups["Plus ancien"].push(n);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([title, data]) => ({ title, data }));
}

const notifIcon = (type: string) => {
  if (type === "payment" || type === "payout") return { icon: DollarSign, bg: "rgba(34,197,94,0.12)", color: COLORS.success };
  if (type === "warning" || type === "late") return { icon: AlertTriangle, bg: "rgba(245,158,11,0.12)", color: COLORS.warning };
  if (type === "info") return { icon: Info, bg: "rgba(14,165,233,0.12)", color: "#0EA5E9" };
  return { icon: Bell, bg: COLORS.primaryMuted, color: COLORS.primary };
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await api.get<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(data.notifications || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, []));
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleMarkAllRead = async () => {
    console.log("[Notifications] Marking all as read");
    try {
      await api.post("/api/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silent
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const sections = groupByDate(notifications);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () =>
            unreadCount > 0 ? (
              <AnimatedPressable onPress={handleMarkAllRead}>
                <Text style={{ fontSize: 14, color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>
                  Tout lire
                </Text>
              </AnimatedPressable>
            ) : null,
        }}
      />

      {loading ? (
        <View style={{ padding: 20, gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
              <SkeletonLoader width={44} height={44} borderRadius={22} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonLoader width="70%" height={13} />
                <SkeletonLoader width="90%" height={11} />
                <SkeletonLoader width="30%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Aucune notification"
          subtitle="Vous n'avez pas encore de notifications. Elles apparaîtront ici."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          renderSectionHeader={({ section }) => (
            <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.background }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textTertiary, fontFamily: "Nunito_700Bold", letterSpacing: 0.5, textTransform: "uppercase" }}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item: n, index }) => {
            const { icon: Icon, bg, color } = notifIcon(n.type);
            const timeStr = timeAgo(n.createdAt);
            return (
              <AnimatedItem index={index}>
                <AnimatedPressable
                  onPress={() => {
                    console.log("[Notifications] Tapped notification", n.id);
                    if (!n.isRead) {
                      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
                    }
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      backgroundColor: n.isRead ? "transparent" : COLORS.primaryMuted,
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.divider,
                    }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={20} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: n.isRead ? "500" : "700",
                            color: COLORS.text,
                            fontFamily: n.isRead ? "Nunito_500Medium" : "Nunito_700Bold",
                          }}
                          numberOfLines={1}
                        >
                          {n.title}
                        </Text>
                        {!n.isRead && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, flexShrink: 0 }} />
                        )}
                      </View>
                      <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", lineHeight: 18, marginBottom: 4 }} numberOfLines={2}>
                        {n.body}
                      </Text>
                      <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>
                        {timeStr}
                      </Text>
                    </View>
                  </View>
                </AnimatedPressable>
              </AnimatedItem>
            );
          }}
        />
      )}
    </View>
  );
}
