import React from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants/Colors';
import { statusLabel } from '@/utils/format';

interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', text: COLORS.warning },
  paid: { bg: 'rgba(34,197,94,0.12)', text: COLORS.success },
  late: { bg: 'rgba(239,68,68,0.12)', text: COLORS.danger },
  penalized: { bg: 'rgba(239,68,68,0.12)', text: COLORS.danger },
  active: { bg: 'rgba(27,107,58,0.10)', text: COLORS.primary },
  completed: { bg: 'rgba(34,197,94,0.12)', text: COLORS.success },
  cancelled: { bg: 'rgba(139,168,136,0.15)', text: COLORS.textSecondary },
  processing: { bg: 'rgba(14,165,233,0.12)', text: '#0EA5E9' },
  failed: { bg: 'rgba(239,68,68,0.12)', text: COLORS.danger },
};

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const colors = statusColors[status] || { bg: COLORS.primaryMuted, text: COLORS.textSecondary };
  const label = statusLabel(status);

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: 6,
        paddingHorizontal: small ? 6 : 8,
        paddingVertical: small ? 2 : 3,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: small ? 10 : 11,
          fontWeight: '700',
          color: colors.text,
          fontFamily: 'Nunito_700Bold',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
