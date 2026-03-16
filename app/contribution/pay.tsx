import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, CheckCircle, Wallet, Phone } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { PINInput } from "@/components/PINInput";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { api } from "@/utils/api";
import { formatGNF } from "@/utils/format";
import { useRef } from "react";

interface ContributionInfo {
  groupId: string;
  groupName: string;
  cycleNumber: number;
  amount: number;
  dueDate: string;
  penaltyAmount: number;
  status: string;
}

const PAYMENT_METHODS = [
  { key: "wallet", label: "Portefeuille TontineGN", icon: Wallet, color: COLORS.primary },
  { key: "mtn", label: "MTN Mobile Money", icon: Phone, color: "#FFCC00" },
  { key: "orange", label: "Orange Money", icon: Phone, color: "#FF6600" },
];

export default function PayContributionScreen() {
  const router = useRouter();
  const { groupId, contributionId } = useLocalSearchParams<{ groupId: string; contributionId: string }>();

  const [info, setInfo] = useState<ContributionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [pin, setPin] = useState("");
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadInfo = async () => {
      if (!groupId) { setLoading(false); return; }
      try {
        const data = await api.get<{ contribution: ContributionInfo }>(`/api/groups/${groupId}/contributions/current`);
        setInfo(data.contribution);
      } catch {
        // Use fallback
        setInfo({
          groupId: groupId || "",
          groupName: "Groupe",
          cycleNumber: 1,
          amount: 50000,
          dueDate: new Date().toISOString(),
          penaltyAmount: 0,
          status: "pending",
        });
      } finally {
        setLoading(false);
      }
    };
    loadInfo();
  }, [groupId]);

  const handlePay = async () => {
    if (!info) return;
    if (paymentMethod === "wallet" && pin.length < 4) {
      setError("Veuillez entrer votre PIN");
      return;
    }
    setPaying(true);
    setError("");
    const total = info.amount + info.penaltyAmount;
    console.log("[Contribution] Paying contribution for group", groupId, "amount:", total, "method:", paymentMethod);
    try {
      await api.post(`/api/groups/${groupId}/contributions/pay`, {
        contributionId,
        paymentMethod,
        pin: paymentMethod === "wallet" ? pin : undefined,
        amount: total,
      });
      setSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors du paiement";
      setError(msg);
    } finally {
      setPaying(false);
    }
  };

  const total = info ? info.amount + info.penaltyAmount : 0;
  const dueDate = info ? new Date(info.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <AnimatedPressable onPress={() => router.back()}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={COLORS.text} />
          </View>
        </AnimatedPressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>
          Payer ma cotisation
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {success ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <Animated.View style={{ transform: [{ scale: successScale }], opacity: successOpacity, alignItems: "center", gap: 16 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={52} color={COLORS.success} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", textAlign: "center" }}>
              Paiement réussi !
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", textAlign: "center", lineHeight: 22 }}>
              Votre cotisation de {formatGNF(total)} a été enregistrée avec succès.
            </Text>
            <AnimatedPressable
              onPress={() => router.back()}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Fermer</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {loading ? (
            <View style={{ gap: 16 }}>
              <SkeletonLoader width="100%" height={120} borderRadius={16} />
              <SkeletonLoader width="100%" height={80} borderRadius={16} />
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              {/* Summary card */}
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>
                  {info?.groupName}
                </Text>
                <View style={{ height: 1, backgroundColor: COLORS.divider }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>Cycle</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>#{info?.cycleNumber}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>Cotisation</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{formatGNF(info?.amount || 0)}</Text>
                </View>
                {(info?.penaltyAmount || 0) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: COLORS.danger, fontFamily: "Nunito_400Regular" }}>Pénalité (retard)</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.danger, fontFamily: "Nunito_600SemiBold" }}>+{formatGNF(info?.penaltyAmount || 0)}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: COLORS.divider }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>Total</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.primary, fontFamily: "Nunito_800ExtraBold" }}>{formatGNF(total)}</Text>
                </View>
                <Text style={{ fontSize: 12, color: COLORS.textTertiary, fontFamily: "Nunito_400Regular" }}>Échéance: {dueDate}</Text>
              </View>

              {/* Payment method */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
                  Mode de paiement
                </Text>
                <View style={{ gap: 8 }}>
                  {PAYMENT_METHODS.map((m) => (
                    <Pressable
                      key={m.key}
                      onPress={() => { console.log("[Payment] Method selected:", m.key); setPaymentMethod(m.key); }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: COLORS.surface,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 2,
                        borderColor: paymentMethod === m.key ? COLORS.primary : COLORS.border,
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: paymentMethod === m.key ? COLORS.primaryMuted : COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                        <m.icon size={20} color={paymentMethod === m.key ? COLORS.primary : COLORS.textSecondary} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{m.label}</Text>
                      {paymentMethod === m.key && <CheckCircle size={18} color={COLORS.primary} />}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* PIN input for wallet */}
              {paymentMethod === "wallet" && (
                <View style={{ alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase" }}>
                    Code PIN
                  </Text>
                  <PINInput value={pin} onChange={setPin} />
                </View>
              )}

              {error ? (
                <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: "Nunito_400Regular", textAlign: "center" }}>{error}</Text>
              ) : null}

              <AnimatedPressable
                onPress={handlePay}
                disabled={paying || (paymentMethod === "wallet" && pin.length < 4)}
                style={{
                  backgroundColor: (paying || (paymentMethod === "wallet" && pin.length < 4)) ? COLORS.surfaceSecondary : COLORS.primary,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                {paying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: (paymentMethod === "wallet" && pin.length < 4) ? COLORS.textTertiary : "#FFFFFF", fontSize: 16, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>
                    Payer {formatGNF(total)}
                  </Text>
                )}
              </AnimatedPressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
