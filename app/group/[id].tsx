import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Users, Plus, MoreHorizontal, Crown, Wallet, CheckCircle,
  Clock, AlertCircle, ChevronRight, ArrowRight,
} from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLoader, SkeletonCard } from "@/components/SkeletonLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { GroupAvatar } from "@/components/GroupAvatar";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/utils/api";
import { formatGNF, frequencyLabel, statusLabel } from "@/utils/format";
import { useAuth } from "@/contexts/AuthContext";

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  frequency: string;
  memberCount: number;
  maxMembers: number;
  status: string;
  currentCycle: number;
  totalCycles: number;
  startDate: string;
  penaltyRate: number;
  graceDays: number;
  myRole: string;
}

interface Member {
  id: string;
  userId: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  role: string;
  joinedAt: string;
}

interface Contribution {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  amount: number;
  status: string;
  paidAt?: string;
}

interface Payout {
  id: string;
  cycle: number;
  userId: string;
  userName: string;
  avatarUrl?: string;
  amount: number;
  status: string;
  scheduledDate: string;
}

function AnimatedItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"contributions" | "payouts">("contributions");

  const loadData = async () => {
    if (!id) return;
    try {
      const [groupData, membersData, contribData, payoutsData] = await Promise.all([
        api.get<{ group: GroupDetail }>(`/api/groups/${id}`),
        api.get<{ members: Member[] }>(`/api/groups/${id}/members`),
        api.get<{ contributions: Contribution[] }>(`/api/groups/${id}/contributions`),
        api.get<{ payouts: Payout[] }>(`/api/groups/${id}/payouts`),
      ]);
      setGroup(groupData.group);
      setMembers(membersData.members || []);
      setContributions(contribData.contributions || []);
      setPayouts(payoutsData.payouts || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, [id]));
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const myContribution = contributions.find((c) => c.userId === user?.id);
  const hasNotPaid = myContribution?.status !== "paid";
  const isAdminOrTreasurer = group?.myRole === "admin" || group?.myRole === "treasurer";

  const roleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "treasurer") return "Trésorier";
    return "Membre";
  };

  const roleIcon = (role: string) => {
    if (role === "admin") return <Crown size={12} color={COLORS.accent} />;
    if (role === "treasurer") return <Wallet size={12} color={COLORS.primary} />;
    return null;
  };

  const handleMenu = () => {
    Alert.alert(
      group?.name || "Groupe",
      "Options du groupe",
      [
        { text: "Modifier", onPress: () => console.log("[Group] Edit group", id) },
        { text: "Quitter le groupe", style: "destructive", onPress: () => console.log("[Group] Leave group", id) },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <Stack.Screen options={{ title: "Chargement..." }} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <SkeletonLoader width="100%" height={160} borderRadius={20} />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <Stack.Screen options={{ title: "Groupe" }} />
        <Text style={{ color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>Groupe introuvable</Text>
      </View>
    );
  }

  const progressPct = group.totalCycles > 0 ? Math.round((group.currentCycle / group.totalCycles) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack.Screen
        options={{
          title: group.name,
          headerBackButtonDisplayMode: "minimal",
          headerRight: () => (
            <AnimatedPressable onPress={handleMenu}>
              <MoreHorizontal size={22} color={COLORS.text} />
            </AnimatedPressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Hero card */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, marginBottom: 20 }}>
          <View
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 8px 24px rgba(27,107,58,0.20)",
            }}
          >
            <View style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <GroupAvatar name={group.name} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF", fontFamily: "Nunito_700Bold" }} numberOfLines={1}>{group.name}</Text>
                {group.description ? (
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Nunito_400Regular" }} numberOfLines={2}>{group.description}</Text>
                ) : null}
              </View>
              <StatusBadge status={group.status} />
            </View>

            {/* Stats grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Montant", value: formatGNF(group.contributionAmount) },
                { label: "Fréquence", value: frequencyLabel(group.frequency) },
                { label: "Membres", value: `${group.memberCount}/${group.maxMembers}` },
                { label: "Cycle actuel", value: `${group.currentCycle}/${group.totalCycles}` },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF", fontFamily: "Nunito_700Bold" }} numberOfLines={1}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "Nunito_500Medium", marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Progress */}
            {group.totalCycles > 0 && (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "Nunito_500Medium" }}>Progression du cycle</Text>
                  <Text style={{ fontSize: 11, color: "#FFFFFF", fontFamily: "Nunito_600SemiBold" }}>{progressPct}%</Text>
                </View>
                <View style={{ height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
                  <View style={{ height: 4, width: `${progressPct}%`, backgroundColor: COLORS.accent, borderRadius: 2 }} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Members section */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>Membres</Text>
            <AnimatedPressable
              onPress={() => { console.log("[Nav] Opening invite member for group", id); router.push({ pathname: "/group/invite", params: { groupId: id } }); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
            >
              <Plus size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 13, color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>Inviter</Text>
            </AnimatedPressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}>
            {members.map((m, i) => (
              <AnimatedItem key={m.id} index={i}>
                <View style={{ alignItems: "center", width: 72 }}>
                  <View style={{ position: "relative", marginBottom: 6 }}>
                    <UserAvatar name={m.name} avatarUrl={m.avatarUrl} size={52} />
                    {m.role !== "member" && (
                      <View style={{ position: "absolute", bottom: -2, right: -2, backgroundColor: COLORS.surface, borderRadius: 10, padding: 2 }}>
                        {roleIcon(m.role)}
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold", textAlign: "center" }}>{m.name.split(" ")[0]}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>{roleLabel(m.role)}</Text>
                </View>
              </AnimatedItem>
            ))}
          </ScrollView>
        </View>

        {/* Segmented control */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 4 }}>
            {(["contributions", "payouts"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => { console.log("[Group] Tab changed to", tab); setActiveTab(tab); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: activeTab === tab ? COLORS.surface : "transparent",
                  boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", fontFamily: "Nunito_600SemiBold", color: activeTab === tab ? COLORS.text : COLORS.textSecondary }}>
                  {tab === "contributions" ? "Cotisations" : "Versements"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Tab content */}
        <View style={{ paddingHorizontal: 20 }}>
          {activeTab === "contributions" ? (
            <View style={{ gap: 8 }}>
              {hasNotPaid && (
                <AnimatedPressable
                  onPress={() => { console.log("[Nav] Opening pay contribution for group", id); router.push({ pathname: "/contribution/pay", params: { groupId: id } }); }}
                  style={{
                    backgroundColor: COLORS.primary,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>
                    Payer ma cotisation
                  </Text>
                </AnimatedPressable>
              )}
              {contributions.length === 0 ? (
                <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>Aucune cotisation pour ce cycle</Text>
                </View>
              ) : (
                contributions.map((c, i) => {
                  const statusIcon = c.status === "paid"
                    ? <CheckCircle size={18} color={COLORS.success} />
                    : c.status === "late"
                    ? <AlertCircle size={18} color={COLORS.danger} />
                    : <Clock size={18} color={COLORS.warning} />;
                  return (
                    <AnimatedItem key={c.id} index={i}>
                      <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: COLORS.border }}>
                        <UserAvatar name={c.userName} avatarUrl={c.avatarUrl} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{c.userName}</Text>
                          <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>{formatGNF(c.amount)}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          {statusIcon}
                          <StatusBadge status={c.status} small />
                        </View>
                      </View>
                    </AnimatedItem>
                  );
                })
              )}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {isAdminOrTreasurer && (
                <AnimatedPressable
                  onPress={() => console.log("[Group] Process payout for group", id)}
                  style={{
                    backgroundColor: COLORS.accent,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>
                    Traiter le versement
                  </Text>
                </AnimatedPressable>
              )}
              {payouts.length === 0 ? (
                <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>Aucun versement planifié</Text>
                </View>
              ) : (
                payouts.map((p, i) => {
                  const isCurrent = p.cycle === group.currentCycle;
                  return (
                    <AnimatedItem key={p.id} index={i}>
                      <View
                        style={{
                          backgroundColor: isCurrent ? COLORS.primaryMuted : COLORS.surface,
                          borderRadius: 12,
                          padding: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          borderWidth: 1.5,
                          borderColor: isCurrent ? COLORS.primary : COLORS.border,
                        }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isCurrent ? COLORS.primary : COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: isCurrent ? "#FFFFFF" : COLORS.textSecondary, fontFamily: "Nunito_700Bold" }}>{p.cycle}</Text>
                        </View>
                        <UserAvatar name={p.userName} avatarUrl={p.avatarUrl} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{p.userName}</Text>
                          <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>{formatGNF(p.amount)}</Text>
                        </View>
                        <StatusBadge status={p.status} small />
                      </View>
                    </AnimatedItem>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
