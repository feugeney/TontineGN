import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  User, Shield, Bell, ChevronRight, LogOut, Info,
  FileText, Lock, Fingerprint, Edit3, CheckCircle,
} from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { UserAvatar } from "@/components/UserAvatar";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/utils/api";
import { formatPhone } from "@/utils/format";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileStats {
  groupsJoined: number;
  contributionsPaid: number;
  payoutsReceived: number;
}

function SettingRow({ icon: Icon, label, onPress, danger = false, right }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <AnimatedPressable onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? "rgba(239,68,68,0.10)" : COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={danger ? COLORS.danger : COLORS.primary} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, color: danger ? COLORS.danger : COLORS.text, fontFamily: "Nunito_500Medium" }}>{label}</Text>
        {right || <ChevronRight size={16} color={COLORS.textTertiary} />}
      </View>
    </AnimatedPressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshUser } = useAuth();
  const [stats, setStats] = useState<ProfileStats>({ groupsJoined: 0, contributionsPaid: 0, payoutsReceived: 0 });
  const [loading, setLoading] = useState(true);
  const [biometrics, setBiometrics] = useState(false);

  const loadStats = async () => {
    try {
      const data = await api.get<{ stats: ProfileStats }>("/api/users/me/stats");
      setStats(data.stats || { groupsJoined: 0, contributionsPaid: 0, payoutsReceived: 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadStats(); refreshUser().catch(() => {}); }, []));

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            console.log("[Auth] User logging out");
            await signOut();
            router.replace("/(auth)");
          },
        },
      ]
    );
  };

  const name = user?.name || "Utilisateur";
  const phone = user?.phone ? formatPhone(user.phone) : "";
  const verified = user?.isVerified;

  const sections = [
    {
      title: "Compte",
      items: [
        { icon: User, label: "Modifier le profil", onPress: () => console.log("[Profile] Edit profile") },
        { icon: Lock, label: "Changer le PIN", onPress: () => console.log("[Profile] Change PIN") },
        { icon: Bell, label: "Notifications", onPress: () => { console.log("[Nav] Navigating to notifications"); router.push("/notifications"); } },
      ],
    },
    {
      title: "Sécurité",
      items: [
        {
          icon: Fingerprint,
          label: "Biométrie",
          right: (
            <Switch
              value={biometrics}
              onValueChange={(v) => { console.log("[Profile] Biometrics toggled:", v); setBiometrics(v); }}
              trackColor={{ false: COLORS.surfaceSecondary, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          ),
        },
        { icon: LogOut, label: "Déconnexion", onPress: handleLogout, danger: true },
      ],
    },
    {
      title: "À propos",
      items: [
        { icon: Info, label: "Version 1.0.0", onPress: () => {} },
        { icon: FileText, label: "Conditions d'utilisation", onPress: () => console.log("[Profile] Terms") },
        { icon: Shield, label: "Politique de confidentialité", onPress: () => console.log("[Profile] Privacy") },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, fontFamily: "Nunito_800ExtraBold", letterSpacing: -0.3 }}>
            Profil
          </Text>
        </View>

        {/* Profile card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <UserAvatar name={name} avatarUrl={user?.avatarUrl} size={72} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold" }} numberOfLines={1}>{name}</Text>
                  {verified && <CheckCircle size={16} color={COLORS.success} />}
                </View>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>{phone}</Text>
              </View>
              <AnimatedPressable
                onPress={() => { console.log("[Nav] Opening edit profile"); }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}
              >
                <Edit3 size={16} color={COLORS.primary} />
              </AnimatedPressable>
            </View>

            {/* Stats */}
            <View style={{ flexDirection: "row", gap: 1 }}>
              {[
                { label: "Tontines", value: loading ? "—" : String(stats.groupsJoined) },
                { label: "Cotisations", value: loading ? "—" : String(stats.contributionsPaid) },
                { label: "Versements", value: loading ? "—" : String(stats.payoutsReceived) },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: COLORS.divider }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: COLORS.primary, fontFamily: "Nunito_800ExtraBold" }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "Nunito_500Medium", marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Settings sections */}
        {sections.map((section) => (
          <View key={section.title} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.textTertiary, fontFamily: "Nunito_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
              {section.title}
            </Text>
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
              {section.items.map((item, i) => (
                <View key={item.label}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: COLORS.divider, marginLeft: 64 }} />}
                  <SettingRow icon={item.icon} label={item.label} onPress={item.onPress} danger={(item as { danger?: boolean }).danger} right={(item as { right?: React.ReactNode }).right} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
