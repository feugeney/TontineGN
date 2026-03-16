import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Plus, Users, ArrowRight, ChevronRight } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { GroupAvatar } from "@/components/GroupAvatar";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/utils/api";
import { formatGNF, frequencyLabel } from "@/utils/format";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Group {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: string;
  memberCount: number;
  maxMembers: number;
  status: string;
  myRole: string;
  currentCycle: number;
  totalCycles: number;
}

interface Stats {
  activeGroups: number;
  totalContributed: number;
  nextPayout: number;
}

function AnimatedItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Stats>({ activeGroups: 0, totalContributed: 0, nextPayout: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await api.get<{ groups: Group[]; stats?: Stats }>("/api/groups");
      const gs = data.groups || [];
      setGroups(gs);
      const active = gs.filter((g) => g.status === "active").length;
      setStats({ activeGroups: active, totalContributed: 0, nextPayout: 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, []));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const cycleProgress = (current: number, total: number) => {
    if (!total) return 0;
    return Math.min(current / total, 1);
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "treasurer") return "Trésorier";
    return "Membre";
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", letterSpacing: -0.3 }}>
          Mes Tontines
        </Text>
        <AnimatedPressable
          onPress={() => { console.log("[Nav] Opening create group modal"); router.push("/group/create"); }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus size={22} color="#FFFFFF" />
        </AnimatedPressable>
      </View>

      {/* Stats row */}
      {!loading && (
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
          {[
            { label: "Groupes actifs", value: String(stats.activeGroups) },
            { label: "Total cotisé", value: formatGNF(stats.totalContributed) },
            { label: "Membres total", value: String(groups.reduce((s, g) => s + (g.memberCount || 0), 0)) },
          ].map((s, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                padding: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.primary, fontFamily: "Nunito_800ExtraBold" }} numberOfLines={1}>
                {s.value}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "Nunito_500Medium", textAlign: "center", marginTop: 2 }} numberOfLines={2}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={loading ? [] : groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon={Users}
              title="Aucune tontine"
              subtitle="Créez votre première tontine ou rejoignez un groupe existant"
              ctaLabel="Créer une tontine"
              onCta={() => { console.log("[Nav] Opening create group modal"); router.push("/group/create"); }}
            />
          )
        }
        renderItem={({ item: g, index }) => {
          const progress = cycleProgress(g.currentCycle, g.totalCycles);
          const progressPct = Math.round(progress * 100);
          const freqLabel = frequencyLabel(g.frequency);
          const role = roleLabel(g.myRole);
          return (
            <AnimatedItem index={index}>
              <AnimatedPressable
                onPress={() => { console.log("[Nav] Navigating to group", g.id); router.push({ pathname: "/group/[id]", params: { id: g.id } }); }}
              >
                <View
                  style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <GroupAvatar name={g.name} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", marginBottom: 3 }}>
                        {g.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>
                        {freqLabel} · {formatGNF(g.contributionAmount)} · {g.memberCount} membres
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <StatusBadge status={g.status} small />
                      <View style={{ backgroundColor: COLORS.accentMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.accent, fontFamily: "Nunito_700Bold" }}>{role}</Text>
                      </View>
                    </View>
                  </View>
                  {/* Progress bar */}
                  {g.totalCycles > 0 && (
                    <View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: COLORS.textTertiary, fontFamily: "Nunito_500Medium" }}>
                          Cycle {g.currentCycle}/{g.totalCycles}
                        </Text>
                        <Text style={{ fontSize: 11, color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>
                          {progressPct}%
                        </Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: COLORS.surfaceSecondary, borderRadius: 2 }}>
                        <View style={{ height: 4, width: `${progressPct}%`, backgroundColor: COLORS.primary, borderRadius: 2 }} />
                      </View>
                    </View>
                  )}
                </View>
              </AnimatedPressable>
            </AnimatedItem>
          );
        }}
      />
    </View>
  );
}
