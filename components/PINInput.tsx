import React, { useRef } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';
import { COLORS } from '@/constants/Colors';

interface PINInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  length?: number;
}

export function PINInput({ value, onChange, onComplete, length = 4 }: PINInputProps) {
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length && onComplete) {
      onComplete(digits);
    }
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: COLORS.surfaceSecondary,
                borderWidth: 2,
                borderColor: filled ? COLORS.primary : COLORS.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filled && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: COLORS.primary,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="numeric"
        secureTextEntry
        maxLength={length}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}
