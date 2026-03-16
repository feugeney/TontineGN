import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Bell, ArrowRight, TrendingUp, Users, Calendar } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonCard, SkeletonLoader } from "@/components/SkeletonLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { GroupAvatar } from "@/components/GroupAvatar";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/utils/api";
import { formatGNF, frequencyLabel, timeAgo } from "@/utils/format";

interface Group {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: string;
  memberCount: number;
  status: string;
  myRole: string;
  currentCycle: number;
}

interface Contribution {
  id: string;
  groupId: string;
  groupName: string;
  amount: number;
  dueDate: string;
  status: string;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  createdAt: string;
  status: string;
}

function AnimatedListItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [groupsData, contribData, txData] = await Promise.all([
        api.get<{ groups: Group[] }>("/api/groups"),
        api.get<{ contributions: Contribution[] }>("/api/contributions/upcoming"),
        api.get<{ transactions: Transaction[] }>("/api/wallet/transactions?limit=5"),
      ]);
      setGroups(groupsData.groups || []);
      setContributions(contribData.contributions || []);
      setTransactions(txData.transactions || []);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refreshUser().catch(() => {});
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    refreshUser().catch(() => {});
    loadData();
  };

  const userName = user?.name?.split(" ")[0] || "Utilisateur";
  const balance = Number(user?.walletBalance) || 0;

  const txIcon = (type: string) => {
    if (type === "deposit" || type === "credit" || type === "payout") return { bg: "rgba(34,197,94,0.12)", color: COLORS.success };
    return { bg: "rgba(239,68,68,0.12)", color: COLORS.danger };
  };

  const txSign = (type: string) => {
    return type === "deposit" || type === "credit" || type === "payout" ? "+" : "-";
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Accueil",
          headerLargeTitle: true,
          headerRight: () => (
            <AnimatedPressable
              onPress={() => {
                console.log("[Nav] Navigating to notifications");
                router.push("/notifications");
              }}
            >
              <Bell size={22} color={COLORS.primary} />
            </AnimatedPressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Balance card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24, marginTop: 8 }}>
          <View
            style={{
              borderRadius: 20,
              backgroundColor: COLORS.primary,
              padding: 24,
              boxShadow: "0 8px 24px rgba(27,107,58,0.25)",
            }}
          >
            <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Nunito_500Medium", marginBottom: 6 }}>
              Bonjour {userName} · Solde disponible
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 32, fontWeight: "800", fontFamily: "Nunito_800ExtraBold", letterSpacing: -0.5, marginBottom: 20 }}>
              {formatGNF(balance)}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AnimatedPressable
                onPress={() => { console.log("[Nav] Opening deposit modal"); router.push("/wallet/deposit"); }}
                style={{ flex: 1, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Déposer</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { console.log("[Nav] Opening send modal"); router.push("/wallet/send"); }}
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Envoyer</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        {/* Upcoming contributions */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", paddingHorizontal: 20, marginBottom: 12 }}>
            Contributions à venir
          </Text>
          {loading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ width: 200, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
                  <SkeletonLoader width={120} height={14} />
                  <SkeletonLoader width={80} height={20} />
                  <SkeletonLoader width={100} height={11} />
                </View>
              ))}
            </ScrollView>
          ) : contributions.length === 0 ? (
            <View style={{ paddingHorizontal: 20 }}>
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", fontSize: 14 }}>Aucune contribution à venir</Text>
              </View>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {contributions.map((c, i) => {
                const dueDate = new Date(c.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                return (
                  <AnimatedListItem key={c.id} index={i}>
                    <View style={{ width: 200, backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border }}>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, fontFamily: "Nunito_600SemiBold", marginBottom: 6 }}>{c.groupName}</Text>
                      <Text style={{ fontSize: 20, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", marginBottom: 4 }}>{formatGNF(c.amount)}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <Calendar size={12} color={COLORS.textTertiary} />
                        <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>{dueDate}</Text>
                        <StatusBadge status={c.status} small />
                      </View>
                      <AnimatedPressable
                        onPress={() => { console.log("[Nav] Opening pay contribution for group", c.groupId); router.push({ pathname: "/contribution/pay", params: { groupId: c.groupId, contributionId: c.id } }); }}
                        style={{ backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 8, alignItems: "center" }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Payer</Text>
                      </AnimatedPressable>
                    </View>
                  </AnimatedListItem>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* My Tontines */}
        <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>Mes Tontines</Text>
            <AnimatedPressable onPress={() => router.push("/(tabs)/(groups)")}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 13, color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>Voir tout</Text>
                <ArrowRight size={14} color={COLORS.primary} />
              </View>
            </AnimatedPressable>
          </View>
          {loading ? (
            <View style={{ gap: 12 }}><SkeletonCard /><SkeletonCard /></View>
          ) : groups.length === 0 ? (
            <EmptyState icon={Users} title="Aucune tontine" subtitle="Rejoignez ou créez votre première tontine" ctaLabel="Créer une tontine" onCta={() => router.push("/group/create")} />
          ) : (
            <View style={{ gap: 12 }}>
              {groups.slice(0, 3).map((g, i) => (
                <AnimatedListItem key={g.id} index={i}>
                  <AnimatedPressable onPress={() => { console.log("[Nav] Navigating to group", g.id); router.push({ pathname: "/group/[id]", params: { id: g.id } }); }}>
                    <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: COLORS.border }}>
                      <GroupAvatar name={g.name} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", marginBottom: 3 }}>{g.name}</Text>
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", marginBottom: 6 }}>{formatGNF(g.contributionAmount)} · {frequencyLabel(g.frequency)}</Text>
                        <StatusBadge status={g.status} small />
                      </View>
                      <ArrowRight size={16} color={COLORS.textTertiary} />
                    </View>
                  </AnimatedPressable>
                </AnimatedListItem>
              ))}
            </View>
          )}
        </View>

        {/* Recent transactions */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>Transactions récentes</Text>
            <AnimatedPressable onPress={() => router.push("/(tabs)/(wallet)")}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 13, color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>Voir tout</Text>
                <ArrowRight size={14} color={COLORS.primary} />
              </View>
            </AnimatedPressable>
          </View>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
                  <SkeletonLoader width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1, gap: 6 }}><SkeletonLoader width="60%" height={13} /><SkeletonLoader width="40%" height={11} /></View>
                  <SkeletonLoader width={80} height={14} />
                </View>
              ))}
            </View>
          ) : transactions.length === 0 ? (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", fontSize: 14 }}>Aucune transaction récente</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {transactions.map((tx, i) => {
                const iconStyle = txIcon(tx.type);
                const sign = txSign(tx.type);
                const amountColor = sign === "+" ? COLORS.success : COLORS.danger;
                const dateStr = timeAgo(tx.createdAt);
                return (
                  <AnimatedListItem key={tx.id} index={i}>
                    <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: COLORS.border }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconStyle.bg, alignItems: "center", justifyContent: "center" }}>
                        <TrendingUp size={18} color={iconStyle.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{tx.description}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>{dateStr}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: amountColor, fontFamily: "Nunito_700Bold" }}>{sign}{formatGNF(Math.abs(Number(tx.amount)))}</Text>
                    </View>
                  </AnimatedListItem>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
