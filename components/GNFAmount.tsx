import React from 'react';
import { Text, TextStyle } from 'react-native';
import { COLORS } from '@/constants/Colors';
import { formatGNF } from '@/utils/format';

interface GNFAmountProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  showSign?: boolean;
  style?: TextStyle;
}

const sizeMap = {
  sm: { fontSize: 13, fontWeight: '500' as const },
  md: { fontSize: 15, fontWeight: '600' as const },
  lg: { fontSize: 20, fontWeight: '700' as const },
  xl: { fontSize: 32, fontWeight: '800' as const },
};

export function GNFAmount({ amount, size = 'md', color, showSign = false, style }: GNFAmountProps) {
  const num = Number(amount) || 0;
  const sign = showSign && num > 0 ? '+' : '';
  const textColor = color || (showSign ? (num >= 0 ? COLORS.success : COLORS.danger) : COLORS.text);
  const formatted = formatGNF(Math.abs(num));
  const display = `${sign}${showSign && num < 0 ? '-' : ''}${formatted}`;

  return (
    <Text
      style={[sizeMap[size], { color: textColor, fontFamily: 'Nunito_700Bold' }, style]}
    >
      {display}
    </Text>
  );
}
