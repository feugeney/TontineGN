import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { getInitials } from '@/utils/format';

const AVATAR_COLORS = [
  '#1B6B3A', '#2D8A50', '#D4A017', '#0D9488', '#2563EB',
  '#7C3AED', '#DB2777', '#EA580C', '#0369A1', '#065F46',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface GroupAvatarProps {
  name: string;
  size?: number;
  style?: ViewStyle;
}

export function GroupAvatar({ name, size = 44, style }: GroupAvatarProps) {
  const bg = hashColor(name || '');
  const initials = getInitials(name || '?');
  const fontSize = Math.round(size * 0.36);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize,
          fontWeight: '700',
          fontFamily: 'Nunito_700Bold',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
