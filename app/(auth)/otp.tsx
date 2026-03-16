import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { api } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react-native";

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useAuth();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [name, setName] = useState("");
  const [pendingToken, setPendingToken] = useState("");

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleDigit = (text: string, index: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newCode.every((d) => d !== "") && digit) {
      handleVerify(newCode.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const finalCode = codeStr || code.join("");
    if (finalCode.length < 6) {
      setError("Veuillez entrer le code à 6 chiffres");
      return;
    }
    setError("");
    setLoading(true);
    console.log("[Auth] Verifying OTP for", phone);
    try {
      const data = await api.post<{ token: string; is_new_user?: boolean }>(
        "/api/auth/verify-otp",
        { phone, code: finalCode }
      );
      if (data.is_new_user) {
        setPendingToken(data.token);
        setShowNameModal(true);
      } else {
        await signIn(data.token);
        router.replace("/(tabs)/(home)");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Code incorrect";
      setError(msg);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    console.log("[Auth] Resending OTP to", phone);
    try {
      await api.post("/api/auth/send-otp", { phone });
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      // ignore
    } finally {
      setResending(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    console.log("[Auth] Saving name for new user:", name);
    try {
      await signIn(pendingToken);
      await api.put("/api/users/me", { name: name.trim() });
      router.replace("/(tabs)/(home)");
    } catch {
      await signIn(pendingToken);
      router.replace("/(tabs)/(home)");
    }
  };

  const phoneDisplay = phone || "";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <View style={{ paddingTop: 56, marginBottom: 32 }}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: COLORS.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </AnimatedPressable>
        </View>

        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: COLORS.text,
            fontFamily: "Nunito_800ExtraBold",
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          Vérification
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: COLORS.textSecondary,
            fontFamily: "Nunito_400Regular",
            lineHeight: 22,
            marginBottom: 40,
          }}
        >
          Code envoyé au{" "}
          <Text style={{ fontFamily: "Nunito_600SemiBold", color: COLORS.text }}>
            {phoneDisplay}
          </Text>
        </Text>

        {/* OTP boxes */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 24, justifyContent: "center" }}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              value={digit}
              onChangeText={(t) => handleDigit(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="numeric"
              maxLength={1}
              autoFocus={i === 0}
              style={{
                width: 48,
                height: 56,
                borderRadius: 12,
                backgroundColor: COLORS.surface,
                borderWidth: 2,
                borderColor: digit ? COLORS.primary : COLORS.border,
                textAlign: "center",
                fontSize: 22,
                fontWeight: "700",
                fontFamily: "Nunito_700Bold",
                color: COLORS.text,
              }}
            />
          ))}
        </View>

        {error ? (
          <Text
            style={{
              fontSize: 13,
              color: COLORS.danger,
              fontFamily: "Nunito_400Regular",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {error}
          </Text>
        ) : null}

        <AnimatedPressable
          onPress={() => handleVerify()}
          disabled={code.join("").length < 6 || loading}
          style={{
            backgroundColor: code.join("").length === 6 ? COLORS.primary : COLORS.surfaceSecondary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={{
                color: code.join("").length === 6 ? "#FFFFFF" : COLORS.textTertiary,
                fontSize: 16,
                fontWeight: "700",
                fontFamily: "Nunito_700Bold",
              }}
            >
              Vérifier le code
            </Text>
          )}
        </AnimatedPressable>

        {/* Resend */}
        <View style={{ alignItems: "center" }}>
          {countdown > 0 ? (
            <Text
              style={{
                fontSize: 14,
                color: COLORS.textSecondary,
                fontFamily: "Nunito_400Regular",
              }}
            >
              Renvoyer dans{" "}
              <Text style={{ fontFamily: "Nunito_700Bold", color: COLORS.text }}>
                {countdown}s
              </Text>
            </Text>
          ) : (
            <AnimatedPressable onPress={handleResend} disabled={resending}>
              <Text
                style={{
                  fontSize: 14,
                  color: COLORS.primary,
                  fontFamily: "Nunito_600SemiBold",
                }}
              >
                {resending ? "Envoi en cours..." : "Renvoyer le code"}
              </Text>
            </AnimatedPressable>
          )}
        </View>

        {/* Demo hint */}
        <View
          style={{
            marginTop: 40,
            backgroundColor: COLORS.accentMuted,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.accent + "30",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: COLORS.accent,
              fontFamily: "Nunito_600SemiBold",
              textAlign: "center",
            }}
          >
            💡 Code de démo: 123456
          </Text>
        </View>
      </ScrollView>

      {/* Name modal for new users */}
      <Modal visible={showNameModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: COLORS.text,
                fontFamily: "Nunito_700Bold",
                marginBottom: 8,
              }}
            >
              Bienvenue !
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: COLORS.textSecondary,
                fontFamily: "Nunito_400Regular",
                marginBottom: 24,
              }}
            >
              Comment vous appelez-vous ?
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: COLORS.textSecondary,
                fontFamily: "Nunito_700Bold",
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Votre nom complet
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Mamadou Diallo"
              placeholderTextColor={COLORS.textTertiary}
              autoFocus
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                fontFamily: "Nunito_400Regular",
                color: COLORS.text,
                borderWidth: 1.5,
                borderColor: COLORS.border,
                marginBottom: 20,
              }}
            />
            <AnimatedPressable
              onPress={handleSaveName}
              disabled={!name.trim()}
              style={{
                backgroundColor: name.trim() ? COLORS.primary : COLORS.surfaceSecondary,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: name.trim() ? "#FFFFFF" : COLORS.textTertiary,
                  fontSize: 16,
                  fontWeight: "700",
                  fontFamily: "Nunito_700Bold",
                }}
              >
                Commencer
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
