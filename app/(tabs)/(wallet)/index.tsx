import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
  Animated,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowDownLeft, ArrowUpRight, Send, TrendingUp, TrendingDown, Repeat } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/utils/api";
import { formatGNF, timeAgo } from "@/utils/format";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  createdAt: string;
  status: string;
}

interface WalletStats {
  incomingThisMonth: number;
  outgoingThisMonth: number;
  contributionsPaid: number;
}

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "deposit", label: "Dépôts" },
  { key: "withdrawal", label: "Retraits" },
  { key: "send", label: "Envois" },
  { key: "contribution", label: "Cotisations" },
  { key: "payout", label: "Versements" },
];

function AnimatedItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<WalletStats>({ incomingThisMonth: 0, outgoingThisMonth: 0, contributionsPaid: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const loadData = async () => {
    try {
      const [txData, balData] = await Promise.all([
        api.get<{ transactions: Transaction[] }>("/api/wallet/transactions"),
        api.get<{ balance: number; stats?: WalletStats }>("/api/wallet/balance"),
      ]);
      setTransactions(txData.transactions || []);
      if (balData.stats) setStats(balData.stats);
      await refreshUser();
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); loadData(); }, []));
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const balance = Number(user?.walletBalance) || 0;

  const filtered = activeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.type === activeFilter);

  const txIconData = (type: string) => {
    if (type === "deposit") return { icon: ArrowDownLeft, bg: "rgba(34,197,94,0.12)", color: COLORS.success };
    if (type === "withdrawal") return { icon: ArrowUpRight, bg: "rgba(239,68,68,0.12)", color: COLORS.danger };
    if (type === "send") return { icon: Send, bg: "rgba(239,68,68,0.12)", color: COLORS.danger };
    if (type === "payout") return { icon: TrendingUp, bg: "rgba(34,197,94,0.12)", color: COLORS.success };
    if (type === "contribution") return { icon: TrendingDown, bg: "rgba(245,158,11,0.12)", color: COLORS.warning };
    return { icon: Repeat, bg: COLORS.primaryMuted, color: COLORS.primary };
  };

  const isCredit = (type: string) => type === "deposit" || type === "payout" || type === "credit";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", letterSpacing: -0.3 }}>
            Portefeuille
          </Text>
        </View>

        {/* Balance card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ borderRadius: 20, backgroundColor: COLORS.primary, padding: 24, boxShadow: "0 8px 24px rgba(27,107,58,0.25)" }}>
            <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Nunito_500Medium", marginBottom: 6 }}>Solde disponible</Text>
            <Text style={{ color: "#FFFFFF", fontSize: 36, fontWeight: "800", fontFamily: "Nunito_800ExtraBold", letterSpacing: -0.5, marginBottom: 24 }}>
              {formatGNF(balance)}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: "Déposer", icon: ArrowDownLeft, onPress: () => { console.log("[Nav] Opening deposit modal"); router.push("/wallet/deposit"); } },
                { label: "Retirer", icon: ArrowUpRight, onPress: () => { console.log("[Nav] Opening withdraw modal"); router.push("/wallet/withdraw"); } },
                { label: "Envoyer", icon: Send, onPress: () => { console.log("[Nav] Opening send modal"); router.push("/wallet/send"); } },
              ].map((btn) => (
                <AnimatedPressable
                  key={btn.label}
                  onPress={btn.onPress}
                  style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingVertical: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}
                >
                  <btn.icon size={18} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600", fontFamily: "Nunito_600SemiBold" }}>{btn.label}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 24 }}>
          {[
            { label: "Entrant ce mois", value: formatGNF(stats.incomingThisMonth), color: COLORS.success },
            { label: "Sortant ce mois", value: formatGNF(stats.outgoingThisMonth), color: COLORS.danger },
            { label: "Cotisations payées", value: String(stats.contributionsPaid), color: COLORS.primary },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: s.color, fontFamily: "Nunito_800ExtraBold" }} numberOfLines={1}>{s.value}</Text>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "Nunito_500Medium", marginTop: 2 }} numberOfLines={2}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => { console.log("[Wallet] Filter changed to", f.key); setActiveFilter(f.key); }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activeFilter === f.key ? COLORS.primary : COLORS.surface,
                borderWidth: 1,
                borderColor: activeFilter === f.key ? COLORS.primary : COLORS.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", fontFamily: "Nunito_600SemiBold", color: activeFilter === f.key ? "#FFFFFF" : COLORS.textSecondary }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Transactions */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", marginBottom: 12 }}>
            Historique
          </Text>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
                  <SkeletonLoader width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1, gap: 6 }}><SkeletonLoader width="60%" height={13} /><SkeletonLoader width="40%" height={11} /></View>
                  <SkeletonLoader width={80} height={14} />
                </View>
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", fontSize: 14 }}>Aucune transaction</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {filtered.map((tx, i) => {
                const { icon: Icon, bg, color } = txIconData(tx.type);
                const credit = isCredit(tx.type);
                const sign = credit ? "+" : "-";
                const amountColor = credit ? COLORS.success : COLORS.danger;
                const dateStr = timeAgo(tx.createdAt);
                return (
                  <AnimatedItem key={tx.id} index={i}>
                    <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: COLORS.border }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                        <Icon size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{tx.description}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>{dateStr}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: amountColor, fontFamily: "Nunito_700Bold" }}>
                          {sign}{formatGNF(Math.abs(Number(tx.amount)))}
                        </Text>
                        {tx.status && tx.status !== "completed" && <StatusBadge status={tx.status} small />}
                      </View>
                    </View>
                  </AnimatedItem>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
