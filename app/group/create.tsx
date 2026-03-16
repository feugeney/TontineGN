import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { api } from "@/utils/api";
import { formatGNF, frequencyLabel } from "@/utils/format";

const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
type Frequency = typeof FREQUENCIES[number];

export default function CreateGroupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);

  // Step 2
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [penaltyRate, setPenaltyRate] = useState("5");
  const [graceDays, setGraceDays] = useState("3");

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    console.log("[Group] Creating group:", { name, amount, frequency, maxMembers });
    try {
      await api.post("/api/groups", {
        name: name.trim(),
        description: description.trim(),
        maxMembers,
        contributionAmount: Number(amount),
        frequency,
        startDate,
        penaltyRate: Number(penaltyRate),
        graceDays: Number(graceDays),
      });
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canGoNext1 = name.trim().length >= 2;
  const canGoNext2 = Number(amount) > 0;

  const inputStyle = {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15 as const,
    fontFamily: "Nunito_400Regular" as const,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  };

  const labelStyle = {
    fontSize: 13 as const,
    fontWeight: "700" as const,
    color: COLORS.textSecondary,
    fontFamily: "Nunito_700Bold" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 8,
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
          Créer une tontine
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress indicator */}
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, marginBottom: 24 }}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: s <= step ? COLORS.primary : COLORS.surfaceSecondary,
            }}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={{ gap: 20 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", marginBottom: 4 }}>
              Informations de base
            </Text>

            <View>
              <Text style={labelStyle}>Nom du groupe *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Tontine des amis"
                placeholderTextColor={COLORS.textTertiary}
                style={inputStyle}
                autoFocus
              />
            </View>

            <View>
              <Text style={labelStyle}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre groupe..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
                style={[inputStyle, { height: 90, textAlignVertical: "top" }]}
              />
            </View>

            <View>
              <Text style={labelStyle}>Nombre maximum de membres</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[4, 6, 8, 10, 12, 15, 20].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => { console.log("[Group] Max members set to", n); setMaxMembers(n); }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: maxMembers === n ? COLORS.primary : COLORS.surface,
                      borderWidth: 1.5,
                      borderColor: maxMembers === n ? COLORS.primary : COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", fontFamily: "Nunito_600SemiBold", color: maxMembers === n ? "#FFFFFF" : COLORS.text }}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 20 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", marginBottom: 4 }}>
              Paramètres financiers
            </Text>

            <View>
              <Text style={labelStyle}>Montant de cotisation (GNF) *</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Ex: 50000"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="numeric"
                style={inputStyle}
                autoFocus
              />
              {Number(amount) > 0 && (
                <Text style={{ fontSize: 13, color: COLORS.primary, fontFamily: "Nunito_600SemiBold", marginTop: 6 }}>
                  {formatGNF(Number(amount))}
                </Text>
              )}
            </View>

            <View>
              <Text style={labelStyle}>Fréquence</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {FREQUENCIES.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => { console.log("[Group] Frequency set to", f); setFrequency(f); }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: frequency === f ? COLORS.primary : COLORS.surface,
                      borderWidth: 1.5,
                      borderColor: frequency === f ? COLORS.primary : COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", fontFamily: "Nunito_600SemiBold", color: frequency === f ? "#FFFFFF" : COLORS.text }}>
                      {frequencyLabel(f)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={labelStyle}>Date de début</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textTertiary}
                style={inputStyle}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Taux de pénalité (%)</Text>
                <TextInput
                  value={penaltyRate}
                  onChangeText={setPenaltyRate}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>Jours de grâce</Text>
                <TextInput
                  value={graceDays}
                  onChangeText={setGraceDays}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text, fontFamily: "Nunito_700Bold", marginBottom: 4 }}>
              Confirmation
            </Text>
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 14 }}>
              {[
                { label: "Nom", value: name },
                { label: "Description", value: description || "—" },
                { label: "Max membres", value: String(maxMembers) },
                { label: "Montant", value: formatGNF(Number(amount)) },
                { label: "Fréquence", value: frequencyLabel(frequency) },
                { label: "Date de début", value: startDate },
                { label: "Taux de pénalité", value: `${penaltyRate}%` },
                { label: "Jours de grâce", value: `${graceDays} jours` },
              ].map((row) => (
                <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "Nunito_400Regular" }}>{row.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text, fontFamily: "Nunito_600SemiBold", maxWidth: "60%", textAlign: "right" }} numberOfLines={1}>{row.value}</Text>
                </View>
              ))}
            </View>
            {error ? (
              <Text style={{ fontSize: 13, color: COLORS.danger, fontFamily: "Nunito_400Regular", textAlign: "center" }}>{error}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}>
        {step > 1 && (
          <AnimatedPressable
            onPress={() => setStep((s) => s - 1)}
            style={{ flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
          >
            <ChevronLeft size={18} color={COLORS.text} />
            <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: "600", fontFamily: "Nunito_600SemiBold" }}>Retour</Text>
          </AnimatedPressable>
        )}
        {step < 3 ? (
          <AnimatedPressable
            onPress={() => setStep((s) => s + 1)}
            disabled={step === 1 ? !canGoNext1 : !canGoNext2}
            style={{
              flex: 1,
              backgroundColor: (step === 1 ? canGoNext1 : canGoNext2) ? COLORS.primary : COLORS.surfaceSecondary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: (step === 1 ? canGoNext1 : canGoNext2) ? "#FFFFFF" : COLORS.textTertiary, fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>
              Suivant
            </Text>
            <ChevronRight size={18} color={(step === 1 ? canGoNext1 : canGoNext2) ? "#FFFFFF" : COLORS.textTertiary} />
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPress={handleCreate}
            disabled={loading}
            style={{ flex: 1, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Check size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", fontFamily: "Nunito_700Bold" }}>Créer la tontine</Text>
              </>
            )}
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}
