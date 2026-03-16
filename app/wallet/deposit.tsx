import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { X, CheckCircle, Phone, Wallet } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { api } from "@/utils/api";
import { formatGNF } from "@/utils/format";
import { useAuth } from "@/contexts/AuthContext";
import { useRef } from "react";

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 200000];
const METHODS = [
  { key: "mtn", label: "MTN Mobile Money", color: "#FFCC00" },
  { key: "orange", label: "Orange Money", color: "#FF6600" },
];

export default function DepositScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mtn");
  const [phone, setPhone] = useState(user?.phone?.replace("+224", "") || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const handleDeposit = async () => {
    const amt = Number(amount);
    if (amt < 1000) { setError("Montant minimum: 1 000 GNF"); return; }
    setLoading(true);
    setError("");
    console.log("[Wallet] Depositing", amt, "GNF via", method);
    try {
      await api.post("/api/wallet/deposit", {
        amount: amt,
        paymentMethod: method,
        phone: "+224" + phone.replace(/\D/g, ""),
      });
      await refreshUser();
      setSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors du dépôt";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const amt = Number(amount);
  const canDeposit = amt >= 1000 && phone.replace(/\D/g, "").length >= 9;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <AnimatedPressable onPress={() => router.back()}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={COLORS.text} />
          </View>
        </AnimatedPressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>Déposer des fonds</Text>
        <View style={{ width: 36 }} />
      </View>

      {success ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <Animated.View style={{ transform: [{ scale: successScale }], opacity: successOpacity, alignItems: "center", gap: 16 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={52} color={COLORS.success} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", textAlign: "center" }}>Dépôt initié !</Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", textAlign: "center", lineHeight: 22 }}>
              Votre dépôt de {formatGNF(amt)} a été initié. Vous recevrez une confirmation par SMS.
            </Text>
            <AnimatedPressable onPress={() => router.back()} style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Fermer</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 20 }}>
            {/* Amount */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                Montant (GNF)
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 16 }}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="numeric"
                  style={{ flex: 1, fontSize: 28, fontWeight: "800", fontFamily: "Nunito_800ExtraBold", color: COLORS.text, paddingVertical: 16 }}
                  autoFocus
                />
                <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.textSecondary, fontFamily: "Nunito_600SemiBold" }}>GNF</Text>
              </View>
              {amt > 0 && (
                <Text style={{ fontSize: 13, color: COLORS.primary, fontFamily: "Nunito_600SemiBold", marginTop: 6 }}>{formatGNF(amt)}</Text>
              )}
            </View>

            {/* Quick amounts */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {QUICK_AMOUNTS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => { console.log("[Deposit] Quick amount selected:", q); setAmount(String(q)); }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: Number(amount) === q ? COLORS.primary : COLORS.surface,
                    borderWidth: 1.5,
                    borderColor: Number(amount) === q ? COLORS.primary : COLORS.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", fontFamily: "Nunito_600SemiBold", color: Number(amount) === q ? "#FFFFFF" : COLORS.text }}>
                    {formatGNF(q)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Payment method */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
                Mode de paiement
              </Text>
              <View style={{ gap: 8 }}>
                {METHODS.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => { console.log("[Deposit] Method selected:", m.key); setMethod(m.key); }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: COLORS.surface,
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 2,
                      borderColor: method === m.key ? COLORS.primary : COLORS.border,
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.color + "20", alignItems: "center", justifyContent: "center" }}>
                      <Phone size={20} color={m.color} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>{m.label}</Text>
                    {method === m.key && <CheckCircle size={18} color={COLORS.primary} />}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Phone */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                Numéro Mobile Money
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden" }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, borderRightColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ fontSize: 16 }}>🇬🇳</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>+224</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 9))}
                  placeholder="XXX XXX XXX"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="phone-pad"
                  style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16, fontFamily: "Nunito_600SemiBold", color: COLORS.text }}
                />
              </View>
            </View>

            {error ? (
              <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: "Nunito_400Regular", textAlign: "center" }}>{error}</Text>
            ) : null}

            <AnimatedPressable
              onPress={handleDeposit}
              disabled={!canDeposit || loading}
              style={{
                backgroundColor: canDeposit ? COLORS.primary : COLORS.surfaceSecondary,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: canDeposit ? "#FFFFFF" : COLORS.textTertiary, fontSize: 16, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>
                  Déposer {amt > 0 ? formatGNF(amt) : ""}
                </Text>
              )}
            </AnimatedPressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
