import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { api } from "@/utils/api";

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  const fullPhone = "+224" + phone.replace(/\D/g, "");

  const handleContinue = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Veuillez entrer un numéro valide (9 chiffres)");
      return;
    }
    setError("");
    setLoading(true);
    console.log("[Auth] Sending OTP to", fullPhone);
    try {
      await api.post("/api/auth/send-otp", { phone: fullPhone });
      router.push({ pathname: "/(auth)/otp", params: { phone: fullPhone } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur réseau";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatDisplay = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  };

  const canContinue = phone.replace(/\D/g, "").length >= 9;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo area */}
        <View style={{ alignItems: "center", paddingTop: 80, paddingBottom: 48 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              boxShadow: "0 8px 24px rgba(27,107,58,0.30)",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 36,
                fontWeight: "800",
                fontFamily: "Nunito_800ExtraBold",
              }}
            >
              T
            </Text>
          </View>
          <Text
            style={{
              fontSize: 32,
              fontWeight: "800",
              color: COLORS.text,
              fontFamily: "Nunito_800ExtraBold",
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            TontineGN
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: COLORS.textSecondary,
              fontFamily: "Nunito_400Regular",
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Épargnez ensemble, prospérez ensemble
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 8, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: COLORS.textSecondary,
              fontFamily: "Nunito_700Bold",
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Numéro de téléphone
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: COLORS.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 16,
                borderRightWidth: 1,
                borderRightColor: COLORS.border,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 18 }}>🇬🇳</Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: COLORS.text,
                  fontFamily: "Nunito_600SemiBold",
                }}
              >
                +224
              </Text>
            </View>
            <TextInput
              ref={inputRef}
              value={formatDisplay(phone)}
              onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 9))}
              placeholder="XXX XXX XXX"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="phone-pad"
              style={{
                flex: 1,
                paddingHorizontal: 14,
                paddingVertical: 16,
                fontSize: 18,
                fontFamily: "Nunito_600SemiBold",
                color: COLORS.text,
              }}
              autoFocus
            />
          </View>
          {error ? (
            <Text
              style={{
                fontSize: 13,
                color: COLORS.danger,
                fontFamily: "Nunito_400Regular",
                marginTop: 4,
              }}
            >
              {error}
            </Text>
          ) : null}
        </View>

        <AnimatedPressable
          onPress={handleContinue}
          disabled={!canContinue || loading}
          style={{
            backgroundColor: canContinue ? COLORS.primary : COLORS.surfaceSecondary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text
              style={{
                color: canContinue ? "#FFFFFF" : COLORS.textTertiary,
                fontSize: 16,
                fontWeight: "700",
                fontFamily: "Nunito_700Bold",
              }}
            >
              Continuer
            </Text>
          )}
        </AnimatedPressable>

        <Text
          style={{
            textAlign: "center",
            marginTop: 32,
            fontSize: 13,
            color: COLORS.textTertiary,
            fontFamily: "Nunito_400Regular",
            lineHeight: 20,
          }}
        >
          En continuant, vous acceptez nos{"\n"}
          <Text style={{ color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>
            Conditions d'utilisation
          </Text>
          {" "}et notre{" "}
          <Text style={{ color: COLORS.primary, fontFamily: "Nunito_600SemiBold" }}>
            Politique de confidentialité
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
