import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { X, CheckCircle, Search, Send } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { PINInput } from "@/components/PINInput";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/utils/api";
import { formatGNF, formatPhone } from "@/utils/format";
import { useAuth } from "@/contexts/AuthContext";
import { useRef } from "react";

interface FoundUser {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

export default function SendScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [recipientPhone, setRecipientPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<FoundUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const balance = Number(user?.walletBalance) || 0;
  const amt = Number(amount);

  const handleSearch = async () => {
    const digits = recipientPhone.replace(/\D/g, "");
    if (digits.length < 9) return;
    setSearching(true);
    setRecipient(null);
    setNotFound(false);
    const fullPhone = "+224" + digits;
    console.log("[Send] Searching recipient by phone:", fullPhone);
    try {
      const data = await api.get<{ user: FoundUser }>(`/api/users/search?phone=${encodeURIComponent(fullPhone)}`);
      setRecipient(data.user);
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async () => {
    if (!recipient) return;
    if (amt < 100) { setError("Montant minimum: 100 GNF"); return; }
    if (amt > balance) { setError("Solde insuffisant"); return; }
    if (pin.length < 4) { setError("Veuillez entrer votre PIN"); return; }
    setLoading(true);
    setError("");
    console.log("[Send] Sending", amt, "GNF to", recipient.id);
    try {
      await api.post("/api/wallet/send", {
        recipientId: recipient.id,
        amount: amt,
        note: note.trim(),
        pin,
      });
      await refreshUser();
      setSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'envoi";
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <AnimatedPressable onPress={() => router.back()}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={COLORS.text} />
          </View>
        </AnimatedPressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>Envoyer de l'argent</Text>
        <View style={{ width: 36 }} />
      </View>

      {success ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <Animated.View style={{ transform: [{ scale: successScale }], opacity: successOpacity, alignItems: "center", gap: 16 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={52} color={COLORS.success} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", textAlign: "center" }}>Envoi réussi !</Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", textAlign: "center", lineHeight: 22 }}>
              {formatGNF(amt)} envoyé à {recipient?.name} avec succès.
            </Text>
            <AnimatedPressable onPress={() => router.back()} style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Fermer</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 20 }}>
            {/* Balance */}
            <View style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>Solde disponible</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.primary, fontFamily: "Nunito_700Bold" }}>{formatGNF(balance)}</Text>
            </View>

            {/* Recipient search */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                Destinataire
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden" }}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, borderRightColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 16 }}>🇬🇳</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>+224</Text>
                  </View>
                  <TextInput
                    value={formatDisplay(recipientPhone)}
                    onChangeText={(t) => { setRecipientPhone(t.replace(/\D/g, "").slice(0, 9)); setRecipient(null); setNotFound(false); }}
                    placeholder="XXX XXX XXX"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="phone-pad"
                    style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16, fontFamily: "Nunito_600SemiBold", color: COLORS.text }}
                    autoFocus
                  />
                </View>
                <AnimatedPressable
                  onPress={handleSearch}
                  disabled={recipientPhone.replace(/\D/g, "").length < 9 || searching}
                  style={{ width: 52, backgroundColor: recipientPhone.replace(/\D/g, "").length >= 9 ? COLORS.primary : COLORS.surfaceSecondary, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                >
                  {searching ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Search size={20} color={recipientPhone.replace(/\D/g, "").length >= 9 ? "#FFFFFF" : COLORS.textTertiary} />}
                </AnimatedPressable>
              </View>
            </View>

            {notFound && (
              <View style={{ backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.15)" }}>
                <Text style={{ fontSize: 14, color: COLORS.danger, fontFamily: "Nunito_500Medium", textAlign: "center" }}>Aucun utilisateur trouvé</Text>
              </View>
            )}

            {recipient && (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: COLORS.primary, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <UserAvatar name={recipient.name} avatarUrl={recipient.avatarUrl} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>{recipient.name}</Text>
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>{formatPhone(recipient.phone)}</Text>
                </View>
                <CheckCircle size={20} color={COLORS.success} />
              </View>
            )}

            {recipient && (
              <>
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
                    />
                    <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.textSecondary, fontFamily: "Nunito_600SemiBold" }}>GNF</Text>
                  </View>
                  {amt > balance && <Text style={{ fontSize: 12, color: COLORS.danger, fontFamily: "Nunito_400Regular", marginTop: 4 }}>Solde insuffisant</Text>}
                </View>

                {/* Note */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                    Note (optionnel)
                  </Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Ex: Remboursement repas"
                    placeholderTextColor={COLORS.textTertiary}
                    style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Nunito_400Regular", color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border }}
                  />
                </View>

                {/* PIN */}
                <View style={{ alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase" }}>
                    Code PIN
                  </Text>
                  <PINInput value={pin} onChange={setPin} />
                </View>

                {error ? (
                  <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: "Nunito_400Regular", textAlign: "center" }}>{error}</Text>
                ) : null}

                <AnimatedPressable
                  onPress={handleSend}
                  disabled={loading || amt < 100 || pin.length < 4}
                  style={{
                    backgroundColor: (amt >= 100 && pin.length === 4 && !loading) ? COLORS.primary : COLORS.surfaceSecondary,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Send size={18} color={(amt >= 100 && pin.length === 4) ? "#FFFFFF" : COLORS.textTertiary} />
                      <Text style={{ color: (amt >= 100 && pin.length === 4) ? "#FFFFFF" : COLORS.textTertiary, fontSize: 16, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>
                        Envoyer {amt > 0 ? formatGNF(amt) : ""}
                      </Text>
                    </>
                  )}
                </AnimatedPressable>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
