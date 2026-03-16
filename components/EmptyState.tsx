import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants/Colors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { LucideIcon } from 'lucide-react-native';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon: Icon, title, subtitle, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: COLORS.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon size={32} color={COLORS.primary} />
      </View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: '600',
          color: COLORS.text,
          fontFamily: 'Nunito_600SemiBold',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 15,
            color: COLORS.textSecondary,
            fontFamily: 'Nunito_400Regular',
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 280,
            marginBottom: ctaLabel ? 24 : 0,
          }}
        >
          {subtitle}
        </Text>
      )}
      {ctaLabel && onCta && (
        <AnimatedPressable
          onPress={onCta}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: '600',
              fontFamily: 'Nunito_600SemiBold',
            }}
          >
            {ctaLabel}
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
}
