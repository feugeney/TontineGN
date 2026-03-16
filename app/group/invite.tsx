import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Search, UserPlus, CheckCircle } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/utils/api";
import { formatPhone } from "@/utils/format";

interface FoundUser {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

export default function InviteScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return;
    setSearching(true);
    setFoundUser(null);
    setNotFound(false);
    setError("");
    const fullPhone = "+224" + digits;
    console.log("[Invite] Searching user by phone:", fullPhone);
    try {
      const data = await api.get<{ user: FoundUser }>(`/api/users/search?phone=${encodeURIComponent(fullPhone)}`);
      setFoundUser(data.user);
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async () => {
    if (!foundUser || !groupId) return;
    setInviting(true);
    setError("");
    console.log("[Invite] Inviting user", foundUser.id, "to group", groupId);
    try {
      await api.post(`/api/groups/${groupId}/invite`, { userId: foundUser.id });
      setSuccess(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'invitation";
      setError(msg);
    } finally {
      setInviting(false);
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
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <AnimatedPressable onPress={() => router.back()}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={COLORS.text} />
          </View>
        </AnimatedPressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>
          Inviter un membre
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {success ? (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 16 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={40} color={COLORS.success} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", textAlign: "center" }}>
              Invitation envoyée !
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", textAlign: "center" }}>
              {foundUser?.name} a été invité à rejoindre le groupe.
            </Text>
            <AnimatedPressable
              onPress={() => router.back()}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Fermer</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular", lineHeight: 22 }}>
              Entrez le numéro de téléphone de la personne à inviter.
            </Text>

            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
                Numéro de téléphone
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden" }}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, borderRightColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 16 }}>🇬🇳</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold" }}>+224</Text>
                  </View>
                  <TextInput
                    value={formatDisplay(phone)}
                    onChangeText={(t) => { setPhone(t.replace(/\D/g, "").slice(0, 9)); setFoundUser(null); setNotFound(false); }}
                    placeholder="XXX XXX XXX"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="phone-pad"
                    style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16, fontFamily: "Nunito_600SemiBold", color: COLORS.text }}
                    autoFocus
                  />
                </View>
                <AnimatedPressable
                  onPress={handleSearch}
                  disabled={phone.replace(/\D/g, "").length < 9 || searching}
                  style={{
                    width: 52,
                    backgroundColor: phone.replace(/\D/g, "").length >= 9 ? COLORS.primary : COLORS.surfaceSecondary,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {searching ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Search size={20} color={phone.replace(/\D/g, "").length >= 9 ? "#FFFFFF" : COLORS.textTertiary} />}
                </AnimatedPressable>
              </View>
            </View>

            {notFound && (
              <View style={{ backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.15)" }}>
                <Text style={{ fontSize: 14, color: COLORS.danger, fontFamily: "Nunito_500Medium", textAlign: "center" }}>
                  Aucun utilisateur trouvé avec ce numéro
                </Text>
              </View>
            )}

            {foundUser && (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: COLORS.primary, gap: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <UserAvatar name={foundUser.name} avatarUrl={foundUser.avatarUrl} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }}>{foundUser.name}</Text>
                    <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>{formatPhone(foundUser.phone)}</Text>
                  </View>
                  <CheckCircle size={20} color={COLORS.success} />
                </View>
                {error ? (
                  <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: "Nunito_400Regular" }}>{error}</Text>
                ) : null}
                <AnimatedPressable
                  onPress={handleInvite}
                  disabled={inviting}
                  style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  {inviting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <UserPlus size={18} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Inviter {foundUser.name.split(" ")[0]}</Text>
                    </>
                  )}
                </AnimatedPressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
